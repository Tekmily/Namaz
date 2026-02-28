// === Prayer visuals metadata (language independent) ===

const prayerMeta = {
  Imsak: {
    emoji: "🌙",
    imageQuery: "mosque,night,stars"
  },
  Fajr: {
    emoji: "🌅",
    imageQuery: "mosque,dawn,sky"
  },
  Sunrise: {
    emoji: "🌤️",
    imageQuery: "mosque,sunrise,light"
  },
  Dhuhr: {
    emoji: "☀️",
    imageQuery: "mosque,daylight,blue-sky"
  },
  Asr: {
    emoji: "🌇",
    imageQuery: "mosque,afternoon,sun"
  },
  Maghrib: {
    emoji: "🌆",
    imageQuery: "mosque,sunset,evening"
  },
  Isha: {
    emoji: "🌌",
    imageQuery: "mosque,night,city-lights"
  }
};

// === Inspiration (ayah snippets) ===

function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff =
    now - start +
    (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

let inspirationOffset = 0;

function pickLocalizedText(key, dayIndex, isRamadan) {
  const texts = getPrayerTextsFor(key);
  const ramadanNotes = getRamadanNotes();
  const useRamadanPool = isRamadan && ramadanNotes.length > 0;
  let chosenText = "";

  if (useRamadanPool) {
    const idx = dayIndex % ramadanNotes.length;
    chosenText = ramadanNotes[idx];
  } else if (texts.length > 0) {
    const idx = dayIndex % texts.length;
    chosenText = texts[idx];
  }

  const visual = resolveInspirationVisual(key, isRamadan);

  return {
    text: chosenText,
    visual
  };
}

async async function fetchDailyAyah(langCode) {
  try {
    const edition =
      langCode === "tr"
        ? "tr.diyanet"
        : langCode === "de"
        ? "de.aburida"
        : "en.sahih";

    // Kur'anda yaklaşık 6236 ayet var, 1–6236 arası rastgele seç
    const maxAyah = 6236;
    const randomAyahNumber = Math.floor(Math.random() * maxAyah) + 1;

    const res = await fetch(
      `https://api.alquran.cloud/v1/ayah/${randomAyahNumber}/${edition}`
    );
    if (!res.ok) throw new Error("Ayah API error");
    const json = await res.json();
    if (json && json.data && json.data.text && json.data.surah) {
      const meta = json.data;
      const surah = meta.surah || {};
      const displayText =
        meta.text +
        " (" +
        (surah.englishName || "") +
        " " +
        meta.numberInSurah +
        ")";
      return {
        text: displayText,
        surahEnglishName: surah.englishName || "",
        surahNumber: typeof surah.number === "number" ? surah.number : null,
        ayahInSurah: meta.numberInSurah || null
      };
    }
  } catch (e) {
    console.warn("Ayah API failed", e);
  }
  return null;
}





function getPexelsQueryForAyah(ayahMeta, isRamadan) {
  if (!ayahMeta) return "quran light abstract";
  const num = ayahMeta.surahNumber;
  const name = (ayahMeta.surahEnglishName || "").toLowerCase();

  // Özel temalar: Nur, Rahman, Yasin, Kehf, Meryem vb.
  if (num === 24 || name.includes("nur")) {
    // Nur Suresi - ışık, pencereler, aydınlık
    return "light rays window mosque";
  }
  if (num === 55 || name.includes("rahman")) {
    // Rahman Suresi - deniz, doğa, nimet teması
    return "sea ocean sunset nature";
  }
  if (num === 36 || name.includes("ya-sin") || name.includes("yaseen")) {
    // Yasin - şehir ışıkları, gece, yolculuk
    return "city night lights skyline";
  }
  if (num === 18 || name.includes("cave") || name.includes("al-kahf")) {
    // Kehf - mağara, dağ, korunaklılık
    return "mountain cave sunrise";
  }
  if (num === 19 || name.includes("maryam")) {
    // Meryem - bahçe, huzurlu doğa
    return "garden trees soft light";
  }
  if (num === 2 || name.includes("baqarah")) {
    // Bakara - geniş arazi, yol, ufuk
    return "desert field horizon path";
  }

  // Ramazan içinde ise, fener ve kandil temalı fonlar
  if (isRamadan) {
    return "ramadan lantern mosque night";
  }

  // Varsayılan sakin Kur'an temalı görseller
  return "quran light abstract";
}

async async function loadInspirationImageForAyah(ayahMeta, visualEl, isRamadan) {
  if (!visualEl) return;
  if (!PEXELS_KEY) return;

  const query = getPexelsQueryForAyah(ayahMeta, isRamadan);

  try {
    const url =
      "https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=" +
      encodeURIComponent(query);
    const res = await fetch(url, {
      headers: {
        Authorization: PEXELS_KEY
      }
    });
    if (!res.ok) {
      throw new Error("Pexels HTTP " + res.status);
    }
    const json = await res.json();
    if (json && Array.isArray(json.photos) && json.photos.length > 0) {
      const photo = json.photos[0];
      const src =
        (photo.src && (photo.src.landscape || photo.src.large)) || photo.url;
      if (src) {
        visualEl.style.backgroundImage = "url('" + src + "')";
        visualEl.dataset.source = "Pexels";
        visualEl.dataset.photographer = photo.photographer || "";
      }
    }
  } catch (e) {
    console.warn("Fotoğraf API hatası (Pexels/ayah)", e);
  }
}

async async function loadInspirationImageForKey(key, isRamadan, visualEl) {
  if (!visualEl) return;
  if (!PEXELS_KEY) {
    // Pexels anahtarı tanımlı değilse, degrade arka planı koru
    return;
  }

  // Temaya ve Ramazan durumuna göre arama sorgusu oluştur
  let query = "quran light abstract";
  if (isRamadan) {
    query = "ramadan lantern mosque night";
  } else if (key === "inspiration") {
    query = "sky stars calm nature";
  } else if (key === "gratitude") {
    query = "sunrise mountains gratitude";
  }

  try {
    const url =
      "https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=" +
      encodeURIComponent(query);
    const res = await fetch(url, {
      headers: {
        Authorization: PEXELS_KEY
      }
    });
    if (!res.ok) {
      throw new Error("Pexels HTTP " + res.status);
    }
    const json = await res.json();
    if (json && Array.isArray(json.photos) && json.photos.length > 0) {
      const photo = json.photos[0];
      const src =
        (photo.src && (photo.src.landscape || photo.src.large)) || photo.url;
      if (src) {
        visualEl.style.backgroundImage = "url('" + src + "')";
        visualEl.dataset.source = "Pexels";
        visualEl.dataset.photographer = photo.photographer || "";
      }
    }
  } catch (e) {
    console.warn("Fotoğraf API hatası (Pexels)", e);
  }
}

function updateInspirationFromKey(key, isRamadan, advance) {
  if (advance) {
    inspirationOffset++;
  }
  const idx = getDayOfYear() + inspirationOffset;
  const data = pickLocalizedText(key, idx, isRamadan);

  const visualEl = document.getElementById("insp-visual");
  const textEl = document.getElementById("insp-text");

  // Önce hızlı bir placeholder arka plan (senkron)
  if (visualEl) {
    if (data.visual) {
      visualEl.style.backgroundImage = data.visual;
    } else {
      visualEl.style.backgroundImage =
        "radial-gradient(circle at 0% 0%, #020617, #111827)";
    }
    // Ardından, asenkron olarak fotoğraf API'lerinden birini dene
    if (typeof loadInspirationImageForKey === "function") {
      loadInspirationImageForKey(key, isRamadan, visualEl);
    }
  }

  if (data.text && textEl) {
    textEl.textContent = data.text;
  } else {
    // Yedek: API'den rastgele bir ayet dene
    fetchDailyAyah(currentLanguageCode).then((res) => {
      if (!res || !textEl) return;
      const text = typeof res === "string" ? res : res.text;
      if (text) {
        textEl.textContent = text;
      }
      if (res && typeof res === "object") {
        const visual2 = document.getElementById("insp-visual");
        if (visual2 && typeof loadInspirationImageForAyah === "function") {
          loadInspirationImageForAyah(res, visual2, isRamadan);
        }
      }
    });
  }
}

// === Prayer Times via AlAdhan ===


function isInTurkey(lat, lon) {
  return lat >= 35.8 && lat <= 42.3 && lon >= 25.5 && lon <= 45.0;
}


async async function fetchPrayerTimes(lat, lon) {
  try {
    setStatus("statusLoadingTimes", "info", true);
    const loc = {
      lat,
      lon,
      displayName: "",
      countryCode: null,
      city: ""
    };
    await fetchPrayerTimesMultiApi(loc);
    setStatus("statusSuccessTimes", "success", true);
  } catch (err) {
    console.error(err);
    const prefix = getUI("statusErrorTimesPrefix");
    setStatus(prefix + (err && err.message ? err.message : ""), "error", false);
  }
}

function getTodayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const parts = hhmm.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// === Prayer API cache ve config ===

// Ana ve yedek API'lerin sırası
const PRIMARY_API = "aladhan";
const SECONDARY_API = "prayzone";
const TERTIARY_API = "muslimsalat";

// Cache süresi: 24 saat
const TIMINGS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Konuma ve güne göre cache anahtarı üretir
function buildTimingsCacheKey(loc, method, school) {
  const lat = Number(loc.lat || 0).toFixed(3);
  const lon = Number(loc.lon || 0).toFixed(3);
  const dateIso = getTodayIso();
  const methodPart = method != null ? method : "m";
  const schoolPart = school != null ? school : "s";
  return `nv_timings_${lat}_${lon}_${dateIso}_${methodPart}_${schoolPart}`;
}

// Timings verisini cache'e yazar
function saveTimingsToCache(cacheKey, payload) {
  try {
    const envelope = {
      savedAt: Date.now(),
      data: payload
    };
    localStorage.setItem(cacheKey, JSON.stringify(envelope));
  } catch (e) {
    console.warn("Timings cache yazılamadı", e);
  }
}

// Timings verisini cache'ten okur
function loadTimingsFromCache(cacheKey, maxAgeMs) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const envelope = JSON.parse(raw);
    if (!envelope || !envelope.data || !envelope.savedAt) return null;
    const age = Date.now() - envelope.savedAt;
    if (age > maxAgeMs) {
      return null;
    }
    return envelope.data;
  } catch (e) {
    console.warn("Timings cache okunamadı", e);
    return null;
  }
}

// Hijri tarih bilgisinden Ramazan olup olmadığını tahmin eder
function detectRamadanFromDateInfo(dateInfo) {
  try {
    if (!dateInfo || !dateInfo.hijri) return false;
    const hijri = dateInfo.hijri;
    const monthObj = hijri.month || {};
    let monthNumber = null;
    if (typeof monthObj.number === "number") {
      monthNumber = monthObj.number;
    } else if (hijri.monthNumber) {
      monthNumber = Number(hijri.monthNumber);
    } else if (hijri.month_no) {
      monthNumber = Number(hijri.month_no);
    }
    return monthNumber === 9;
  } catch (e) {
    return false;
  }
}


async function callAladhan(loc) {
  const api = PRAYER_APIS.find(a => a.id === "aladhan");
  if (!api) throw new Error("Aladhan API config bulunamadı");

  const inTurkey = loc.countryCode === "TR" || isInTurkey(loc.lat, loc.lon);
  const method = inTurkey ? 13 : 3;
  const school = 1;
  const latAdj = 3;
  const tune = "0,0,0,0,0,0";

  const timestamp = Math.floor(Date.now() / 1000);
  const url = `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${encodeURIComponent(
    loc.lat
  )}&longitude=${encodeURIComponent(
    loc.lon
  )}&method=${method}&school=${school}&latitudeAdjustmentMethod=${latAdj}&tune=${encodeURIComponent(
    tune
  )}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("ALADHAN_HTTP_" + res.status);
  const json = await res.json();
  if (!json || json.code !== 200 || !json.data || !json.data.timings) {
    throw new Error("ALADHAN_BAD_RESPONSE");
  }

  const greg = json.data.date.gregorian;
  let isoDate = null;
  if (greg && greg.date) {
    const [dd, mm, yyyy] = greg.date.split("-");
    isoDate = `${yyyy}-${mm}-${dd}`;
  }

  return {
    apiId: "aladhan",
    label: api.label,
    date: isoDate,
    dateInfo: json.data.date,
    timings: {
      Fajr: json.data.timings.Fajr,
      Sunrise: json.data.timings.Sunrise,
      Dhuhr: json.data.timings.Dhuhr,
      Asr: json.data.timings.Asr,
      Maghrib: json.data.timings.Maghrib,
      Isha: json.data.timings.Isha
    }
  };
}

async function callPrayZone(loc) {
  const api = PRAYER_APIS.find(a => a.id === "prayzone");
  if (!api) throw new Error("Pray.Zone API config bulunamadı");
  if (!loc.city) throw new Error("PRAYZONE_CITY_REQUIRED");

  const url = `https://api.pray.zone/v2/times/today.json?city=${encodeURIComponent(
    loc.city
  )}${loc.countryCode ? `&country=${encodeURIComponent(loc.countryCode)}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("PRAYZONE_HTTP_" + res.status);
  const json = await res.json();
  if (!json || !json.results || !json.results.datetime || !json.results.datetime[0]) {
    throw new Error("PRAYZONE_BAD_RESPONSE");
  }

  const dt = json.results.datetime[0];
  let dateStr = null;
  if (dt.date) {
    dateStr = dt.date.gregorian || dt.date.date || null;
  }
  const times = dt.times || {};

  return {
    apiId: "prayzone",
    label: api.label,
    date: dateStr,
    dateInfo: null,
    timings: {
      Fajr: times.Fajr || times.FAJR,
      Sunrise: times.Sunrise || times.SUNRISE,
      Dhuhr: times.Dhuhr || times.DHUHR,
      Asr: times.Asr || times.ASR,
      Maghrib: times.Maghrib || times.MAGHRIB,
      Isha: times.Isha || times.ISHA
    }
  };
}

async function callMuslimSalat(loc) {
  if (!MUSLIMSALAT_KEY) {
    throw new Error("MUSLIMSALAT_DISABLED");
  }
  const api = PRAYER_APIS.find(a => a.id === "muslimsalat");
  if (!api) throw new Error("MuslimSalat API config bulunamadı");
  if (!loc.city) throw new Error("MUSLIMSALAT_CITY_REQUIRED");

  const url = `https://muslimsalat.com/${encodeURIComponent(
    loc.city
  )}.json?country=${encodeURIComponent(
    loc.countryCode || ""
  )}&key=${encodeURIComponent(MUSLIMSALAT_KEY)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("MUSLIMSALAT_HTTP_" + res.status);
  const json = await res.json();
  if (!json || !json.items || !json.items[0]) {
    throw new Error("MUSLIMSALAT_BAD_RESPONSE");
  }

  const item = json.items[0];
  return {
    apiId: "muslimsalat",
    label: api.label,
    date: item.date_for,
    dateInfo: null,
    timings: {
      Fajr: item.fajr,
      Sunrise: item.sunrise,
      Dhuhr: item.dhuhr,
      Asr: item.asr,
      Maghrib: item.maghrib,
      Isha: item.isha
    }
  };
}
// API id -> fonksiyon haritası
const PRAYER_API_CALLERS = {
  aladhan: callAladhan,
  prayzone: callPrayZone,
  muslimsalat: callMuslimSalat
};

// Config'ten önceliklendirilmiş API listesi üretir
function getOrderedPrayerApis() {
  if (!Array.isArray(PRAYER_APIS) || PRAYER_APIS.length === 0) {
    return [];
  }
  return PRAYER_APIS
    .slice()
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}


function chooseBestPrayerSet(results, countryCode) {
  const today = getTodayIso();

  let valid = results.filter(r => r && r.date && r.date.startsWith(today));
  if (valid.length === 0) {
    valid = results.filter(Boolean);
  }
  if (valid.length === 0) {
    throw new Error("NO_VALID_PRAYER_DATA");
  }
  if (valid.length === 1) return valid[0];

  const keys = ["Fajr","Dhuhr","Asr","Maghrib","Isha"];
  const filtered = [];

  for (const r of valid) {
    let outlier = false;

    for (const key of keys) {
      const vals = valid
        .map(v => timeToMinutes(v.timings[key]))
        .filter(v => v != null);
      if (vals.length < 2) continue;

      const avg = vals.reduce((a,b) => a + b, 0) / vals.length;
      const my = timeToMinutes(r.timings[key]);
      if (my == null) continue;

      const diff = Math.abs(my - avg);
      if (diff > 20) {
        outlier = true;
        break;
      }
    }
    if (!outlier) filtered.push(r);
  }

  const candidates = filtered.length > 0 ? filtered : valid;
  const preferredOrder =
    countryCode === "TR"
      ? ["aladhan","prayzone","muslimsalat"]
      : ["aladhan","prayzone","muslimsalat"];

  for (const id of preferredOrder) {
    const hit = candidates.find(c => c.apiId === id);
    if (hit) return hit;
  }
  return candidates[0];
}


// Seçili konuma göre birden fazla API'den veri çekip
// en iyi sonucu seçer, cache kullanır ve UI'yi günceller
async function fetchPrayerTimesMultiApi(loc) {
  // 1) Cache anahtarını hazırla
  const inTurkey = loc.countryCode === "TR" || isInTurkey(loc.lat, loc.lon);
  const method = inTurkey ? 13 : 3;
  const school = 1;
  const cacheKey = buildTimingsCacheKey(loc, method, school);

  // 2) Önce cache'i dene
  const cached = loadTimingsFromCache(cacheKey, TIMINGS_CACHE_MAX_AGE_MS);
  if (cached && cached.timings) {
    console.info("Namaz vakitleri cache'ten okundu", cacheKey);

    lastTimings = cached;
    lastIsRamadan = !!cached.isRamadan;

    const dateLineEl = document.getElementById("date-line");
    if (dateLineEl && cached.date) {
      dateLineEl.textContent = cached.date;
    }

    renderPrayerList(cached.timings, lastIsRamadan);
    setupCountdown(cached.timings);
    updateInspirationFromKey("Imsak", lastIsRamadan);
    updateRamadanCountdown();

    const srcEl = document.getElementById("api-source");
    if (srcEl && cached.label) {
      srcEl.textContent = `Kaynak: ${cached.label}`;
    }

    return cached;
  }

  // 3) Cache yoksa API'lerden veri çek
  const orderedApis = getOrderedPrayerApis();
  if (!orderedApis.length) {
    throw new Error("Prayer API config bulunamadı");
  }

  const calls = [];

  function addCallForId(id) {
    const config = orderedApis.find(a => a.id === id);
    if (!config) return;

    if (
      config.scope === "regional" &&
      config.regions &&
      loc.countryCode &&
      !config.regions.includes(loc.countryCode)
    ) {
      return;
    }

    const fn = PRAYER_API_CALLERS[id];
    if (typeof fn !== "function") return;

    if (id === "prayzone" && !loc.city) return;
    if (id === "muslimsalat" && (!loc.city || !MUSLIMSALAT_KEY)) return;

    calls.push(fn(loc));
  }

  const preferredOrder = [PRIMARY_API, SECONDARY_API, TERTIARY_API].filter(Boolean);
  for (const id of preferredOrder) {
    addCallForId(id);
  }

  for (const api of orderedApis) {
    if (preferredOrder.includes(api.id)) continue;
    addCallForId(api.id);
  }

  if (calls.length === 0) {
    calls.push(callAladhan(loc));
  }

  // 4) Tüm istekleri paralel çalıştır
  const settled = await Promise.allSettled(calls);
  const results = settled
    .filter(s => s.status === "fulfilled")
    .map(s => s.value)
    .filter(Boolean);

  if (!results.length) {
    throw new Error("Namaz vakitleri için hiç geçerli API sonucu alınamadı");
  }

  // 5) En iyi seti seç
  const best = chooseBestPrayerSet(results, loc.countryCode || null);

  lastTimings = best;
  lastIsRamadan = detectRamadanFromDateInfo(best.dateInfo);

  const dateLineEl2 = document.getElementById("date-line");
  if (dateLineEl2 && best.date) {
    dateLineEl2.textContent = best.date;
  }

  // 6) Cache'e kaydet
  saveTimingsToCache(cacheKey, {
    apiId: best.apiId,
    label: best.label,
    date: best.date,
    dateInfo: best.dateInfo,
    timings: best.timings,
    isRamadan: lastIsRamadan
  });

  // 7) UI'yi güncelle
  renderPrayerList(best.timings, lastIsRamadan);
  setupCountdown(best.timings);
  updateInspirationFromKey("Imsak", lastIsRamadan);
  updateRamadanCountdown();

  const srcEl2 = document.getElementById("api-source");
  if (srcEl2 && best.label) {
    srcEl2.textContent = `Kaynak: ${best.label}`;
  }

  return best;
}


// === Ramadan Calendar (Imsakiyah) ===
// === Ramadan Calendar (Imsakiyah) ===

async async function fetchRamadanCalendar(lat, lon, year) {
  try {
    const statusEl = document.getElementById("cal-status");
    if (statusEl) {
      statusEl.textContent = getUI("calStatusLoading");
    }

    const baseUrl = "https://api.aladhan.com/v1/calendar";
    const inTurkey = isInTurkey(lat, lon);
    const method = inTurkey ? 13 : 3;
    const allRows = [];

    for (let month = 1; month <= 12; month++) {
      const url = `${baseUrl}/${year}/${month}?latitude=${encodeURIComponent(
        lat
      )}&longitude=${encodeURIComponent(
        lon
      )}&method=${method}&school=1`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("HTTP " + res.status + " (month " + month + ")");
      }
      const json = await res.json();
      if (!json || json.code !== 200 || !Array.isArray(json.data)) {
        throw new Error("Unexpected response for month " + month);
      }

      json.data.forEach((dayObj) => {
        const hijri = dayObj.date && dayObj.date.hijri;
        if (hijri && hijri.month && hijri.month.number === 9) {
          const g = dayObj.date.readable;
          const hDay = hijri.day;
          const hMonthName = (hijri.month.ar || hijri.month.en || "");
          const hYear = hijri.year;
          const hijriLabel = `${hDay} ${hMonthName} ${hYear}`;
          const t = dayObj.timings || {};
          allRows.push({
            gregorian: g,
            hijri: hijriLabel,
            imsak: (t.Imsak || "").split(" ")[0],
            fajr: (t.Fajr || "").split(" ")[0],
            maghrib: (t.Maghrib || "").split(" ")[0],
            isha: (t.Isha || "").split(" ")[0]
          });
        }
      });
    }

    lastRamadanRows = allRows.slice();
    if (allRows.length === 0) {
      if (statusEl) {
        statusEl.textContent = getUI("calStatusNoData");
      }
      renderRamadanTable([]);
      return;
    }

    if (statusEl) {
      statusEl.textContent = "";
    }
    renderRamadanTable(allRows);
  } catch (err) {
    console.error(err);
    const statusEl = document.getElementById("cal-status");
    if (statusEl) {
      const prefix = getUI("calStatusErrorPrefix");
      statusEl.textContent = prefix + (err && err.message ? err.message : "");
    }
  }
}

function renderRamadanTable(rows) {
  const container = document.getElementById("cal-table-container");
  if (!container) return;
  container.innerHTML = "";

  if (!rows || rows.length === 0) {
    return;
  }

  const headers = getCalendarHeaders();
  const table = document.createElement("table");
  table.className = "calendar-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["gregorian", "hijri", "imsak", "fajr", "maghrib", "isha"].forEach((key) => {
    const th = document.createElement("th");
    th.textContent = headers[key] || key;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    ["gregorian", "hijri", "imsak", "fajr", "maghrib", "isha"].forEach((key) => {
      const td = document.createElement("td");
      td.textContent = r[key] || "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}


// === Moon / Hilal Widget ===


async function fetchMoonForCoords(lat, lon) {
  // Önce IPGeolocation Astronomy API (ana kaynak, API key gerektirir)
  if (IPGEO_KEY) {
    try {
      const url =
        "https://api.ipgeolocation.io/astronomy?apiKey=" +
        encodeURIComponent(IPGEO_KEY) +
        "&lat=" +
        encodeURIComponent(lat) +
        "&long=" +
        encodeURIComponent(lon);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("MOON_HTTP_" + res.status);
      }
      const a = await res.json();
      if (!a) return null;

      const rawPhase = a.moon_phase || "";
      const phaseCode = (rawPhase || "").toUpperCase().replace(/\s+/g, "_");

      const altRaw = a.moon_altitude;
      const illumRaw = a.moon_illumination;
      const altitude =
        typeof altRaw === "number" ? altRaw : parseFloat(altRaw || "0");
      const illumination =
        typeof illumRaw === "number" ? illumRaw : parseFloat(illumRaw || "0");

      return {
        phaseCode,
        altitude: isNaN(altitude) ? null : altitude,
        illumination: isNaN(illumination) ? null : illumination,
        moonrise: a.moonrise || null,
        moonset: a.moonset || null,
        status: a.moon_status || "",
        date: a.date || null,
        currentTime: a.current_time || null
      };
    } catch (e) {
      console.warn("Moon API error (IPGeolocation)", e);
      // Devamında free fallback'e düşeceğiz
    }
  }

  // IPGEO_KEY yoksa veya IPGeolocation başarısız olursa
  // PhaseOfTheMoonToday.com free API ile genel ay fazası bilgisi al
  try {
    const res = await fetch("https://api.phaseofthemoontoday.com/v1/current");
    if (!res.ok) {
      throw new Error("MOON_PHASE_TODAY_HTTP_" + res.status);
    }
    const a = await res.json();
    if (!a) return null;

    const rawPhase = a.phase || "";
    const phaseCode = (rawPhase || "").toUpperCase().replace(/\s+/g, "_");
    const illumRaw = a.illumination;
    const illumination =
      typeof illumRaw === "number" ? illumRaw : parseFloat(illumRaw || "0");

    return {
      phaseCode,
      altitude: null,
      illumination: isNaN(illumination) ? null : illumination,
      moonrise: null,
      moonset: null,
      status: "",
      date: null,
      currentTime: null
    };
  } catch (e) {
    console.warn("Moon API error (PhaseOfTheMoonToday)", e);
    return null;
  }
}


function mapMoonPhase(phaseCode) {
  const code = (phaseCode || "").toUpperCase();
  if (!code) {
    return {
      emoji: "🌙",
      label: getUI("moonLoading") || "Ay durumu"
    };
  }
  if (code.includes("NEW")) {
    return { emoji: "🌑", label: getUI("moonPhaseNew") || "New Moon" };
  }
  if (code.includes("FULL")) {
    return { emoji: "🌕", label: getUI("moonPhaseFull") || "Full Moon" };
  }
  if (code.includes("WAXING_CRESCENT")) {
    return {
      emoji: "🌒",
      label: getUI("moonPhaseWaxingCrescent") || "Waxing crescent"
    };
  }
  if (code.includes("WANING_CRESCENT")) {
    return {
      emoji: "🌘",
      label: getUI("moonPhaseWaningCrescent") || "Waning crescent"
    };
  }
  if (code.includes("FIRST_QUARTER")) {
    return {
      emoji: "🌓",
      label: getUI("moonPhaseFirstQuarter") || "First quarter"
    };
  }
  if (code.includes("LAST_QUARTER") || code.includes("THIRD_QUARTER")) {
    return {
      emoji: "🌗",
      label: getUI("moonPhaseLastQuarter") || "Last quarter"
    };
  }
  if (code.includes("WAXING_GIBBOUS")) {
    return {
      emoji: "🌔",
      label: getUI("moonPhaseWaxingGibbous") || "Waxing gibbous"
    };
  }
  if (code.includes("WANING_GIBBOUS")) {
    return {
      emoji: "🌖",
      label: getUI("moonPhaseWaningGibbous") || "Waning gibbous"
    };
  }
  // Fallback
  return { emoji: "🌙", label: getUI("moonCardTitle") || "Moon" };
}

function isCrescentPhase(phaseCode) {
  const code = (phaseCode || "").toUpperCase();
  return code.includes("CRESCENT");
}


function getMoonThemeFromPhase(phaseCode) {
  const code = (phaseCode || "").toUpperCase();
  if (!code) return "other";
  if (code.includes("NEW")) return "new";
  if (code.includes("FULL")) return "full";
  if (code.includes("CRESCENT")) return "crescent";
  if (code.includes("GIBBOUS")) return "gibbous";
  if (code.includes("QUARTER")) return "quarter";
  return "other";
}

function computeHilalVisibility(moon) {
  if (!moon || !moon.phaseCode) return "unknown";
  if (!isCrescentPhase(moon.phaseCode)) {
    // Hilal fazında değil
    return "no";
  }
  if (moon.status && moon.status.toLowerCase().includes("below")) {
    return "no";
  }
  if (typeof moon.altitude === "number" && moon.altitude <= 0) {
    return "no";
  }
  if (typeof moon.altitude === "number" && moon.altitude > 0) {
    return "yes";
  }
  return "unknown";
}

async async function updateMoonWidgetForCoords(lat, lon) {
  const widget = document.getElementById("moon-widget");
  if (!widget) return;
  const iconEl = document.getElementById("moon-phase-icon");
  const phaseEl = document.getElementById("moon-phase-text");
  const visEl = document.getElementById("moon-visibility-text");

  if (phaseEl) {
    phaseEl.textContent = getUI("moonLoading") || "Ay durumu yükleniyor…";
  }
  if (visEl) {
    visEl.textContent = "";
  }

  const moon = await fetchMoonForCoords(lat, lon);
  if (!moon) {
    if (phaseEl) {
      phaseEl.textContent = getUI("moonVisibleUnknown") || "Ay bilgisi alınamadı";
    }
    if (visEl) {
      visEl.textContent = "";
    }
    // Varsayılan tema
    document.documentElement.setAttribute("data-moon-theme", "other");
    return;
  }

  const desc = mapMoonPhase(moon.phaseCode);
  const theme = getMoonThemeFromPhase(moon.phaseCode);
  document.documentElement.setAttribute("data-moon-theme", theme);

  if (iconEl && desc.emoji) {
    iconEl.textContent = desc.emoji;
  }
  if (phaseEl) {
    phaseEl.textContent = desc.label;
  }
  if (visEl) {
    const vis = computeHilalVisibility(moon);
    let key = "moonVisibleUnknown";
    if (vis === "yes") key = "moonVisibleYes";
    else if (vis === "no") key = "moonVisibleNo";
    visEl.textContent = getUI(key);
  }
}
