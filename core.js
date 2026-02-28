// === Global State ===
let lastCoords = null;
let lastIsRamadan = false;
let lastTimings = null;
let lastRamadanRows = null;

let currentLanguageCode = "tr";
let notificationsEnabled = false;
let notifImsak10Sent = false;
let notifIftar10Sent = false;

let currentLanguageData = null;

let PRAYER_APIS = [];
let PRAYER_ROUTING = {};
const MUSLIMSALAT_KEY = "";
const PEXELS_KEY = ""; // Pexels API anahtarı (isteğe bağlı)
const IPGEO_KEY = ""; // IPGeolocation Astronomy API anahtarı (opsiyonel)



async function loadPrayerApis() {
  // Varsayılan API listesi (JSON okunamazsa bunlar kullanılır)
  const fallbackApis = [
    {
      id: "aladhan",
      label: "Aladhan Global Prayer Times API",
      scope: "global",
      regions: ["*"],
      priority: 10,
      authRequired: false,
      strategy: "coords"
    },
    {
      id: "prayzone",
      label: "Pray.Zone API",
      scope: "global",
      regions: ["*"],
      priority: 8,
      authRequired: false,
      strategy: "city"
    }
  ];

  try {
    const res = await fetch("prayer-apis.json");
    if (!res.ok) {
      console.warn("prayer-apis.json yüklenemedi, fallback kullanılacak:", res.status);
      PRAYER_APIS = fallbackApis;
      return;
    }
    const json = await res.json();
    const fromFile = Array.isArray(json.apis) ? json.apis : [];
    PRAYER_APIS = fromFile.length > 0 ? fromFile : fallbackApis;
  } catch (e) {
    console.error("Prayer API config yüklenemedi, fallback kullanılacak", e);
    PRAYER_APIS = fallbackApis;
  }

const SUPPORTED_LANGS = ["tr","en","de","ar","es","fr","ru","pt","hi","zh"];

async function collectClientInfo() {
  let geo = null;
  if ("geolocation" in navigator) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 5000
        });
      });
      geo = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        source: "browser"
      };
    } catch (e) {
      // izin verilmemiş olabilir, önemli değil
    }
  }

  const ua = navigator.userAgent || "";
  const lang = navigator.language || "";

  return {
    timestamp: new Date().toISOString(),
    userAgent: ua,
    language: lang,
    geo
  };
}

async function logUsageToServer(extra) {
  try {
    const baseInfo = await collectClientInfo();
    const payload = Object.assign({}, baseInfo, extra || {});

    await fetch("/api/log-usage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn("Log gönderilemedi", e);
  }
}



let countdownIntervalId = null;

function tickCurrentTime() {
  const el = document.getElementById("current-time-display");
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  el.textContent = `${hh}:${mm}:${ss}`;
}

setInterval(tickCurrentTime, 1000);



function clearCountdown() {
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
}





function updateRamadanCountdown() {
  if (!lastIsRamadan || !lastTimings || !lastTimings.timings) return;

  const now = new Date();
  const t = lastTimings.timings;

  const imsakEl = document.getElementById("ramadan-imsak-countdown");
  const iftarEl = document.getElementById("ramadan-iftar-countdown");

  const imsakDate = parseTimingToDate(now, t.Imsak);
  const iftarDate = parseTimingToDate(now, t.Maghrib);

  const formatMin = (ms) => {
    if (ms <= 0) return "0 dk";
    return Math.ceil(ms / 60000) + " dk";
  };

  if (imsakEl) {
    if (imsakDate && imsakDate > now) {
      imsakEl.textContent = "İmsak vaktine " + formatMin(imsakDate - now) + " kaldı";
    } else {
      imsakEl.textContent = "İmsak vakti girdi";
    }
  }

  if (iftarEl) {
    if (iftarDate && iftarDate > now) {
      iftarEl.textContent = "İftar vaktine " + formatMin(iftarDate - now) + " kaldı";
    } else {
      iftarEl.textContent = "İftar vakti girdi";
    }
  }
}

function updateCountdownDisplay(currentSegment, nextSegment, remainingMs) {
  const el = document.getElementById("countdown-text");
  if (!el) return;

  const now = new Date();

  // Ramazan için özel: sahur (imsak) ve iftar sürelerini birlikte göster
  if (lastIsRamadan && lastTimings && lastTimings.timings) {
    const t = lastTimings.timings;
    const today = new Date();
    const imsakDate = parseTimingToDate(today, t.Imsak);
    const maghribDate = parseTimingToDate(today, t.Maghrib);

    let remImsak = imsakDate ? imsakDate - now : null;
    let remIftar = maghribDate ? maghribDate - now : null;

    const formatRemain = (ms) => {
      if (ms == null) return "";
      if (ms <= 0) return "0:00:00";
      const totalSeconds = Math.floor(ms / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const ss = String(s).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    };

    let line = "";

    if (remImsak != null && remImsak > 0) {
      const tpl = getUI("ramadanImsakInTime") || "İmsak vaktine {time} kaldı";
      line += tpl.replace("{time}", formatRemain(remImsak));
    } else if (imsakDate) {
      line += getUI("ramadanImsakStarted") || "İmsak vakti girdi";
    }

    if (remIftar != null && remIftar > 0) {
      const tpl2 = getUI("ramadanIftarInTime") || "İftara {time} kaldı";
      const part = tpl2.replace("{time}", formatRemain(remIftar));
      line += (line ? " • " : "") + part;
    } else if (maghribDate) {
      const started = getUI("ramadanIftarStarted") || "İftar vakti girdi";
      line += (line ? " • " : "") + started;
    }

    // Üstteki genel geri sayım paneli için tam saat formatı
    el.textContent = line || (getUI("countdownFinished") || "Bugün için vakit kalmadı");

    // Ramazan bölümündeki yerel geri sayım için dakika bazlı metin
    const ramadanEl = document.getElementById("ramadan-countdown-text");
    if (ramadanEl) {
      let minuteLine = "";
      if (remImsak != null && remImsak > 0) {
        const minsImsak = Math.ceil(remImsak / 60000);
        const tplMinImsak =
          getUI("ramadanImsakInMinutes") || "İmsak vaktine {minutes} dakika kaldı";
        minuteLine += tplMinImsak.replace("{minutes}", String(minsImsak));
      } else if (imsakDate) {
        minuteLine += getUI("ramadanImsakStarted") || "İmsak vakti girdi";
      }
      if (remIftar != null && remIftar > 0) {
        const minsIftar = Math.ceil(remIftar / 60000);
        const tplMinIftar =
          getUI("ramadanIftarInMinutes") || "İftar vaktine {minutes} dakika kaldı";
        const partMin = tplMinIftar.replace("{minutes}", String(minsIftar));
        minuteLine += (minuteLine ? " • " : "") + partMin;
      } else if (maghribDate) {
        const started = getUI("ramadanIftarStarted") || "İftar vakti girdi";
        minuteLine += (minuteLine ? " • " : "") + started;
      }
      ramadanEl.textContent =
        minuteLine || (getUI("countdownFinished") || "Bugün için vakit kalmadı");
    }

    return;
  }

  // Normal günler
  if (!currentSegment || remainingMs <= 0) {
    el.textContent = getUI("countdownFinished") || "Bugün için vakit kalmadı";
    return;
  }

  const minutesLeft = Math.ceil(remainingMs / 60000);
  const currentLabel = getLabelForPrayer(currentSegment.key);
  const nextLabel = nextSegment ? getLabelForPrayer(nextSegment.key) : "";

  if (nextLabel) {
    const tpl = getUI("countdownCurrentAndNext") ||
      "Şu an {current} vakti • {next} vaktine {minutes} dk kaldı";
    el.textContent = tpl
      .replace("{current}", currentLabel)
      .replace("{next}", nextLabel)
      .replace("{minutes}", String(minutesLeft));
  } else {
    const tpl = getUI("countdownCurrentAndGeneric") ||
      "Şu an {current} vakti • Sonraki vakte {minutes} dk kaldı";
    el.textContent = tpl
      .replace("{current}", currentLabel)
      .replace("{minutes}", String(minutesLeft));
  }
}

function updateRamadanInlineCountdown(now) {
  const el = document.getElementById("ramadan-inline-text");
  if (!el || !lastIsRamadan || !lastTimings || !lastTimings.timings) return;

  const t = lastTimings.timings;
  const today = new Date();
  const imsakDate = parseTimingToDate(today, t.Imsak);
  const maghribDate = parseTimingToDate(today, t.Maghrib);

  const toMinutes = (ms) => Math.max(0, Math.ceil(ms / 60000));

  let parts = [];

  if (imsakDate) {
    const diffImsak = imsakDate - now;
    if (diffImsak > 0) {
      const minsImsak = toMinutes(diffImsak);
      const tplMinImsak =
        getUI("ramadanImsakInMinutes") || "İmsak vaktine {minutes} dakika kaldı";
      parts.push(tplMinImsak.replace("{minutes}", String(minsImsak)));
    } else {
      parts.push(getUI("ramadanImsakStarted") || "İmsak vakti girdi");
    }
  }

  if (maghribDate) {
    const diffIftar = maghribDate - now;
    if (diffIftar > 0) {
      const minsIftar = toMinutes(diffIftar);
      const tplMinIftar =
        getUI("ramadanIftarInMinutes") || "İftar vaktine {minutes} dakika kaldı";
      parts.push(tplMinIftar.replace("{minutes}", String(minsIftar)));
    } else {
      parts.push(getUI("ramadanIftarStarted") || "İftar vakti girdi");
    }
  }

  if (!parts.length) {
    const fallback =
      getUI("ramadanInlineNoData") ||
      "Ramazan geri sayımı için bugün uygun veri bulunamadı.";
    el.textContent = fallback;
  } else {
    el.textContent = parts.join(" • ");
  }
}
function parseTimingToDate(today, t) {
  if (!t) return null;
  const main = t.split(" ")[0]; // "05:34" gibi
  const parts = main.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    h,
    m,
    0,
    0
  );
}


function setupCountdown(timings) {
  clearCountdown();
  if (!timings) {
    updateCountdownDisplay(null, null, 0);
    return;
  }
  const keys = ["Imsak", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const today = new Date();
  const segments = [];
  keys.forEach((k) => {
    const d = parseTimingToDate(today, timings[k]);
    if (d) segments.push({ key: k, time: d });
  });
  segments.sort((a, b) => a.time - b.time);
  if (!segments.length) {
    updateCountdownDisplay(null, null, 0);
    return;
  }

  // Bildirim bayraklarını sıfırla
  notifImsak10Sent = false;
  notifIftar10Sent = false;

  
  function tick() {
    const now = new Date();
    let nextIndex = segments.findIndex((s) => s.time > now);
    let currentSegment = null;
    let nextSegment = null;
    let remainingMs = 0;

    if (nextIndex === -1) {
      // Günün son vaktinden sonra
      currentSegment = segments[segments.length - 1] || null;
      nextSegment = null;
      remainingMs = 0;
    } else if (nextIndex === 0) {
      // İlk vaktin öncesinde: ilk vakti "bulunulan" vakit olarak ele al
      currentSegment = segments[0];
      nextSegment = segments.length > 1 ? segments[1] : null;
      remainingMs = segments[0].time - now;
    } else {
      // İki vakit arasındayız
      currentSegment = segments[nextIndex - 1];
      nextSegment = segments[nextIndex] || null;
      remainingMs = segments[nextIndex].time - now;
    }

// Ramazan için bildirimler: imsak ve iftar
    if (
      notificationsEnabled && lastIsRamadan &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      lastIsRamadan &&
      lastTimings &&
      lastTimings.timings
    ) {
      const t = lastTimings.timings;
      const todayForNotif = new Date();
      const imsakDate = parseTimingToDate(todayForNotif, t.Imsak);
      const maghribDate = parseTimingToDate(todayForNotif, t.Maghrib);

      if (imsakDate) {
        const diffImsak = imsakDate - now;
        if (diffImsak <= 10 * 60 * 1000 && diffImsak > 0 && !notifImsak10Sent) {
          try {
            new Notification(getUI("notifImsakSoon") || "İmsak vaktine son 10 dakika kaldı");
          } catch (e) {}
          notifImsak10Sent = true;
        }
      }

      if (maghribDate) {
        const diffIftar = maghribDate - now;
        if (diffIftar <= 10 * 60 * 1000 && diffIftar > 0 && !notifIftar10Sent) {
          try {
            new Notification(getUI("notifIftarSoon") || "İftar vaktine son 10 dakika kaldı");
          } catch (e) {}
          notifIftar10Sent = true;
        }
      }
    }

    updateCountdownDisplay(currentSegment, nextSegment, remainingMs);
    updateRamadanCountdown();
    updateRamadanCountdown();
  }

  tick();
  countdownIntervalId = setInterval(tick, 1000);
}


// === Language loading ===


function detectLanguageFromNavigator() {
  const nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
  if (nav.startsWith("tr")) return "tr";
  if (nav.startsWith("de")) return "de";
  if (nav.startsWith("ar")) return "ar";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("hi")) return "hi";
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("ru")) return "ru";
  return "en";
}
async function loadLanguage(code) {
  let normalized = SUPPORTED_LANGS.includes(code) ? code : "en";
  try {
    const res = await fetch(`${normalized}.json`);
    if (!res.ok) throw new Error("Failed to load language file");
    currentLanguageData = await res.json();
    currentLanguageCode = normalized;
  } catch (err) {
    console.error("Language load error", err);
    if (normalized !== "en") {
      try {
        const res2 = await fetch("en.json");
        if (res2.ok) {
          currentLanguageData = await res2.json();
          currentLanguageCode = "en";
        }
      } catch (e2) {
        console.error("Fallback language load error", e2);
      }
    }
  }
  applyTranslations();
  // If we already have timings, re-render them in the new language
  if (lastTimings && lastTimings.timings) {
    renderPrayerList(lastTimings.timings, lastIsRamadan);
    updateInspirationFromKey("Imsak", lastIsRamadan);
  }
  // Re-render Ramadan table if it exists
  if (lastRamadanRows && lastRamadanRows.length > 0) {
    renderRamadanTable(lastRamadanRows);
  }
}

function getUI(key) {
  if (currentLanguageData && currentLanguageData.ui && currentLanguageData.ui[key]) {
    return currentLanguageData.ui[key];
  }
  return key;
}

function getLabelForPrayer(key) {
  if (
    currentLanguageData &&
    currentLanguageData.prayerLabels &&
    currentLanguageData.prayerLabels[key]
  ) {
    return currentLanguageData.prayerLabels[key];
  }
  return key;
}

function getPrayerTextsFor(key) {
  if (
    currentLanguageData &&
    currentLanguageData.prayerTexts &&
    currentLanguageData.prayerTexts[key] &&
    Array.isArray(currentLanguageData.prayerTexts[key])
  ) {
    return currentLanguageData.prayerTexts[key];
  }
  return [];
}

function getRamadanNotes() {
  if (
    currentLanguageData &&
    Array.isArray(currentLanguageData.ramadanNotes)
  ) {
    return currentLanguageData.ramadanNotes;
  }
  return [];
}

function getCalendarHeaders() {
  if (currentLanguageData && currentLanguageData.calendarHeaders) {
    return currentLanguageData.calendarHeaders;
  }
  return {
    gregorian: "Date",
    hijri: "Hijri",
    imsak: "Imsak",
    fajr: "Fajr",
    maghrib: "Maghrib",
    isha: "Isha"
  };
}

// === UI helpers ===

function applyTranslations() {
  const t = getUI;
  const titleEl = document.getElementById("app-title");
  if (titleEl) titleEl.textContent = t("title");
  const subEl = document.getElementById("app-subtitle");
  if (subEl) subEl.textContent = t("subtitle");

  const langLabel = document.getElementById("language-label");
  if (langLabel) langLabel.textContent = t("languageLabel") || "🌐 Dil";

  const ramadanTitle = document.getElementById("ramadan-countdown-title");
  if (ramadanTitle) ramadanTitle.textContent = t("ramadanCountdownTitle") || "Ramazan Geri Sayımı";

  const notifBtnText = document.getElementById("notif-btn-text");
  if (notifBtnText) notifBtnText.textContent = t("notifButton") || "Bildirimlere izin ver";


  const moonPhaseText = document.getElementById("moon-phase-text");
  if (moonPhaseText) moonPhaseText.textContent = t("moonCardTitle");
  const moonVisText = document.getElementById("moon-visibility-text");
  if (moonVisText) moonVisText.textContent = "";
  const locTitle = document.getElementById("location-title");
  if (locTitle) locTitle.textContent = t("locationTitle");
  const locHelp = document.getElementById("location-help");
  if (locHelp) locHelp.textContent = t("locationHelp");

  const btnAutoText = document.getElementById("btn-use-auto-text");
  if (btnAutoText) btnAutoText.textContent = t("locationButton");

  const latLabel = document.getElementById("lat-label");
  if (latLabel) latLabel.textContent = t("latLabel");
  const lonLabel = document.getElementById("lon-label");
  if (lonLabel) lonLabel.textContent = t("lonLabel");

  const manualHelp = document.getElementById("manual-help");
  if (manualHelp) manualHelp.textContent = t("manualHelp");

  const manualBtnText = document.getElementById("btn-use-manual-text");
  if (manualBtnText) manualBtnText.textContent = t("manualButton");

  const nameLabel = document.getElementById("name-label");
  if (nameLabel) nameLabel.textContent = t("nameLabel");
  const nameInput = document.getElementById("name-input");
  if (nameInput) nameInput.placeholder = t("namePlaceholder");
  const nameHelp = document.getElementById("name-help");
  if (nameHelp) nameHelp.textContent = t("nameHelp");

  const statusEl = document.getElementById("status");
  if (statusEl && !lastCoords) {
    statusEl.textContent = t("statusWaiting");
  }

  const inspTitle = document.getElementById("insp-title");
  if (inspTitle) inspTitle.textContent = t("inspTitle");
  const inspHelp = document.getElementById("insp-help");
  if (inspHelp) inspHelp.textContent = t("inspHelp");
  const inspBtnText = document.getElementById("btn-refresh-insp-text");
  if (inspBtnText) inspBtnText.textContent = t("inspRefresh");

  const refreshTimesText = document.getElementById("refresh-times-text");
  if (refreshTimesText) refreshTimesText.textContent = t("refreshTimes");


    const currentTimeTitleEl = document.getElementById("current-time-title");
  if (currentTimeTitleEl) currentTimeTitleEl.textContent = t("currentTimeTitle");

  const countdownTitleEl = document.getElementById("countdown-title");
  if (countdownTitleEl) countdownTitleEl.textContent = t("countdownTitle");
  const countdownTextEl = document.getElementById("countdown-text");
  if (countdownTextEl && !lastTimings) {
    countdownTextEl.textContent = t("countdownNoData");
  }
  const ramadanInlineEl = document.getElementById("ramadan-inline-text");
  if (ramadanInlineEl && (!lastIsRamadan || !lastTimings)) {
    ramadanInlineEl.textContent = t("ramadanInlinePlaceholder") || ramadanInlineEl.textContent;
  }

  const ramadanCountdownTextEl = document.getElementById("ramadan-countdown-text");
  if (ramadanCountdownTextEl && (!lastIsRamadan || !lastTimings)) {
    ramadanCountdownTextEl.textContent = t("ramadanCountdownText") || ramadanCountdownTextEl.textContent;
  }

  const footerSource = document.getElementById("footer-source");
  if (footerSource) footerSource.textContent = t("footerSource");
  const footerNote = document.getElementById("footer-note");
  if (footerNote) footerNote.textContent = t("footerNote");

  const calTitle = document.getElementById("cal-title");
  if (calTitle) calTitle.textContent = t("calTitle");
  const calHelp = document.getElementById("cal-help");
  if (calHelp) calHelp.textContent = t("calHelp");
  const calYearLabel = document.getElementById("cal-year-label");
  if (calYearLabel) calYearLabel.textContent = t("calYearLabel");
  const calBtnText = document.getElementById("cal-btn-text");
  if (calBtnText) calBtnText.textContent = t("calBtnText");
}

function setStatus(messageKeyOrText, type, fromKey = true) {
  const el = document.getElementById("status");
  if (!el) return;
  const text = fromKey ? getUI(messageKeyOrText) : messageKeyOrText;
  el.textContent = text;
  el.classList.remove("info", "error", "success");
  if (type === "error") el.classList.add("error");
  else if (type === "success") el.classList.add("success");
  else el.classList.add("info");
}

function updateCoordsText(lat, lon, name) {
  const el = document.getElementById("coords-label");
  if (!el) return;
  const prefix = getUI("coordsPrefix");
  const roundedLat = typeof lat === "number" ? lat.toFixed(4) : lat;
  const roundedLon = typeof lon === "number" ? lon.toFixed(4) : lon;
  if (name && name.trim().length > 0) {
    el.textContent = `${prefix} ${name} (${roundedLat}, ${roundedLon})`;
  } else {
    el.textContent = `${prefix} ${roundedLat}, ${roundedLon}`;
  }
}

