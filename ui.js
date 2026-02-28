// === Location ===

function requestAutoLocation() {
  if (!navigator.geolocation) {
    setStatus("statusLocationUnsupported", "error", true);
    return;
  }

  setStatus("statusGettingLocation", "info", true);

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      lastCoords = { lat, lon };
      updateCoordsText(lat, lon, null);
      saveLastCoords(lat, lon, null);
      fetchPrayerTimes(lat, lon);
    },
    (err) => {
      console.error(err);
      if (err && err.code === err.PERMISSION_DENIED) {
        setStatus("statusLocationDenied", "error", true);
      } else {
        setStatus("statusLocationError", "error", true);
      }
    }
  );
}

function useManualCoords() {
  const latInput = document.getElementById("lat-input");
  const lonInput = document.getElementById("lon-input");
  if (!latInput || !lonInput) return;

  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  if (isNaN(lat) || isNaN(lon)) {
    setStatus("statusInvalidCoords", "error", true);
    return;
  }
  lastCoords = { lat, lon };
  updateCoordsText(lat, lon, null);
  saveLastCoords(lat, lon, null);
  fetchPrayerTimes(lat, lon);
}


async function geocodeByName(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&limit=1&addressdetails=1`;

  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "namaz-vakitleri-web/1.0 (personal use)"
    }
  });
  if (!res.ok) throw new Error("HTTP " + res.status);

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("NOT_FOUND");
  }

  const item = data[0];
  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);
  const displayName = item.display_name || query;
  let countryCode = null;
  let city = query;
  if (item.address) {
    if (item.address.country_code) {
      countryCode = item.address.country_code.toUpperCase();
    }
    city =
      item.address.city ||
      item.address.town ||
      item.address.village ||
      item.address.state ||
      query;
  }

  if (isNaN(lat) || isNaN(lon)) {
    throw new Error("INVALID_COORDS");
  }

  return { lat, lon, displayName, countryCode, city };
}

async function searchByName() {
  const input = document.getElementById("name-input");
  if (!input) return;
  const query = (input.value || "").trim();
  if (!query) {
    setStatus("statusInvalidName", "error", true);
    return;
  }

  try {
    setStatus(getUI("statusLoadingTimes"), "info", false);

    const loc = await geocodeByName(query);

    lastCoords = { lat: loc.lat, lon: loc.lon };
    updateCoordsText(loc.lat, loc.lon, loc.displayName);
    saveLastCoords(loc.lat, loc.lon, loc.displayName);

    await fetchPrayerTimesMultiApi(loc);
    setStatus("statusSuccessTimes", "success", true);
  } catch (err) {
    console.error(err);
    const prefix = getUI("statusErrorTimesPrefix");
    setStatus(prefix + (err && err.message ? err.message : ""), "error", false);
  }
}

function saveLastCoords(lat, lon, name) {
  try {
    const payload = { lat, lon, name: name || "" };
    localStorage.setItem("nv_last_coords", JSON.stringify(payload));
  } catch (e) {
    console.warn("Could not save coords", e);
  }

  // Kullanıcı konum seçtiğinde logla
  logUsageToServer({
    event: "location_set",
    lat,
    lon,
    label: name || ""
  });

  // Ay / hilal widget'ını güncelle
  updateMoonWidgetForCoords(lat, lon);
}

function loadLastCoords() {
  try {
    const raw = localStorage.getItem("nv_last_coords");
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (
      obj &&
      typeof obj.lat === "number" &&
      typeof obj.lon === "number"
    ) {
      lastCoords = { lat: obj.lat, lon: obj.lon };
      updateCoordsText(obj.lat, obj.lon, obj.name || null);
      const nameInput = document.getElementById("name-input");
      if (nameInput && obj.name) {
        nameInput.value = obj.name;
      }
      updateMoonWidgetForCoords(obj.lat, obj.lon);
      fetchPrayerTimes(obj.lat, obj.lon);
    }
  } catch (e) {
    console.warn("Could not load saved coords", e);
  }
}

// === Events ===

function setupEventListeners() {
  const langSelect = document.getElementById("language-select");
  if (langSelect) {
    langSelect.addEventListener("change", () => {
      const val = langSelect.value;
      if (val === "auto") {
        const navLang = detectLanguageFromNavigator();
        loadLanguage(navLang);
      } else {
        loadLanguage(val);
      }
    });
  }

  const btnAuto = document.getElementById("btn-use-auto");
  if (btnAuto) {
    btnAuto.addEventListener("click", () => {
      requestAutoLocation();
    });
  }

  const btnManual = document.getElementById("btn-use-manual");
  if (btnManual) {
    btnManual.addEventListener("click", () => {
      useManualCoords();
    });
  }

  const btnName = document.getElementById("btn-search-name");
  if (btnName) {
    btnName.addEventListener("click", () => {
      searchByName();
    });
  }

  const nameInput = document.getElementById("name-input");
  if (nameInput) {
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchByName();
      }
    });
  }

  const btnRefresh = document.getElementById("btn-refresh-data");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      if (lastCoords) {
        fetchPrayerTimes(lastCoords.lat, lastCoords.lon);
      }
    });
  }

  const btnInsp = document.getElementById("btn-refresh-insp");
  if (btnInsp) {
    btnInsp.addEventListener("click", () => {
      updateInspirationFromKey("Imsak", lastIsRamadan, true);
    });
  }

  const btnRamadan = document.getElementById("btn-load-ramadan");
  if (btnRamadan) {
    btnRamadan.addEventListener("click", () => {
      if (!lastCoords) {
        const statusEl = document.getElementById("cal-status");
        if (statusEl) {
          statusEl.textContent = getUI("statusWaiting");
        }
        return;
      }
      const yearInput = document.getElementById("cal-year");
      let year = new Date().getFullYear();
      if (yearInput) {
        const parsed = parseInt(yearInput.value, 10);
        if (!isNaN(parsed)) {
          year = parsed;
        } else {
          yearInput.value = String(year);
        }
      }
      fetchRamadanCalendar(lastCoords.lat, lastCoords.lon, year);
    });
  }
}

// Auto refresh prayer times every 6 hours if a location is set
function setupAutoRefresh() {
  setInterval(() => {
    if (lastCoords) {
      fetchPrayerTimes(lastCoords.lat, lastCoords.lon);
    }
  }, 6 * 60 * 60 * 1000);
}

// === Init ===

document.addEventListener("DOMContentLoaded", () => {
  const navLang = detectLanguageFromNavigator();
  const selectEl = document.getElementById("language-select");
  if (selectEl) {
    selectEl.value = "auto";
  }
  Promise.all([loadLanguage(navLang), loadPrayerApis()]).then(() => {
    // Set default year in Ramadan field
    const yearInput = document.getElementById("cal-year");
    if (yearInput) {
      yearInput.value = String(new Date().getFullYear());
    }
    setupEventListeners();
    loadLastCoords();
    if (!lastCoords) {
      // Tarayıcı konumunu otomatik iste (kullanıcı izin verirse)
      requestAutoLocation();
    }

    // Kullanıcı sayfayı açtığında bir kere log gönder
    logUsageToServer({ event: "page_open" });

    setupAutoRefresh();
  });
});;


// Refresh prayer times button
const btnRefreshTimes = document.getElementById("btn-refresh-times");
if (btnRefreshTimes) {
  btnRefreshTimes.addEventListener("click", () => {
    if (lastCoords) {
      fetchPrayerTimes(lastCoords.lat, lastCoords.lon, lastCoords.label);
    }
  });
}



// === Notification permission & button handling (FIXED) ===
const notifBtn = document.getElementById("btn-enable-notifications");
const notifText = document.getElementById("notif-btn-text");

function updateNotifUI(state) {
  if (!notifBtn || !notifText) return;
  if (state === "granted") {
    notifBtn.classList.add("active");
    notifText.textContent = "Bildirimler aktif";
  } else if (state === "denied") {
    notifText.textContent = "Bildirim izni reddedildi";
  } else {
    notifText.textContent = "Bildirimlere izin ver";
  }
}

if (typeof Notification !== "undefined") {
  console.log("[NOTIF] Initial permission:", Notification.permission);

  if (Notification.permission === "granted") {
    notificationsEnabled = true;
    updateNotifUI("granted");
  }

  if (notifBtn) {
    notifBtn.addEventListener("click", async () => {
      console.log("[NOTIF] Button clicked");
      try {
        const perm = await Notification.requestPermission();
        console.log("[NOTIF] Permission result:", perm);
        if (perm === "granted") {
          notificationsEnabled = true;
          updateNotifUI("granted");
        } else {
          updateNotifUI("denied");
        }
      } catch (e) {
        console.error("[NOTIF] Error requesting permission", e);
      }
    });
  }
} else {
  console.warn("[NOTIF] Notification API not supported in this browser");
}


function updateRamadanCountdown() {
  if (!lastIsRamadan || !lastTimings || !lastTimings.timings) return;

  const now = new Date();
  const t = lastTimings.timings;

  const imsakEl = document.getElementById("ramadan-imsak-count");
  const iftarEl = document.getElementById("ramadan-iftar-count");

  const imsakDate = parseTimingToDate(now, t.Imsak);
  const iftarDate = parseTimingToDate(now, t.Maghrib);

  const mins = (ms) => Math.max(0, Math.ceil(ms / 60000));

  if (imsakDate && imsakDate > now) {
    imsakEl.textContent = `İmsak vaktine ${mins(imsakDate - now)} dakika kaldı`;
  } else {
    imsakEl.textContent = `İmsak vakti girdi`;
  }

  if (iftarDate && iftarDate > now) {
    iftarEl.textContent = `İftar vaktine ${mins(iftarDate - now)} dakika kaldı`;
  } else {
    iftarEl.textContent = `İftar vakti girdi`;
  }
}

