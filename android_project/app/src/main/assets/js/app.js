/**
 * Toshkent Masjidlari & Namoz Vaqtlari - Asosiy JavaScript
 * Toshkentdagi barcha 98+ masjidlar, klasterizatsiya (MarkerCluster),
 * interaktiv xarita va namoz vaqtlarini boshqarish tizimi
 */

// Global State
let map;
let markerClusterGroup;
let mosquesList = [];
let activeMosque = null;
let activeMarker = null;
let adminMode = false;
let currentFilter = 'all';
let currentTileLayer = null;
let isSatellite = false;
let searchDebounceTimeout = null;
let userLocation = null; // { lat, lng }
let qiblaLine = null;
let isDarkMode = false;
let audioCtx = null;

// Raqamli Tasbeh holati
const ZIKRLAR = [
  { name: "Subhanalloh", max: 33, arabic: "سُبْحَانَ ٱللَّٰهِ" },
  { name: "Alhamdulillah", max: 33, arabic: "ٱلْحَمْدُ لِلَّٰهِ" },
  { name: "Allohu Akbar", max: 34, arabic: "ٱللَّٰهُ أَكْبَرُ" }
];
let currentZikrIndex = 0;
let currentZikrCount = 0;
let totalZikrCount = 0;

// O'zbekcha oylar va hafta kunlari
const OYLAR = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

const KUNLAR = [
  'Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'
];

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLiveClock();
  initMap();
  loadMosquesData();
  bindUIEvents();
  initSwipeToClose();
  initTasbeh();
  initPWAInstallation();
  initAuth();
  autoDetectLocation();
});

/**
 * 1. Jonli vaqt va sana (O'zbek tilida) & Namoz kirish holatini real vaqtda kuzatish
 */
let lastCheckedPrayerMinute = -1;

function initLiveClock() {
  function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds}`;

    const dayName = KUNLAR[now.getDay()];
    const day = now.getDate();
    const monthName = OYLAR[now.getMonth()];
    const year = now.getFullYear();
    const dateStr = `${dayName}, ${day}-${monthName} ${year}`;

    const headerTime = document.getElementById('header-live-time');
    const headerDate = document.getElementById('header-live-date');
    if (headerTime) headerTime.textContent = timeStr;
    if (headerDate) headerDate.textContent = dateStr;

    const modalTime = document.getElementById('modal-current-time');
    const modalDate = document.getElementById('modal-current-date');
    if (modalTime) modalTime.textContent = timeStr;
    if (modalDate) modalDate.textContent = `${day}-${monthName}, ${year}`;

    // Har daqiqada namoz vaqti o'zgarganini tekshirish (Masjidlar darhol yashil rangda miltillashni boshlashi uchun)
    const curTotalMin = now.getHours() * 60 + now.getMinutes();
    if (curTotalMin !== lastCheckedPrayerMinute) {
      lastCheckedPrayerMinute = curTotalMin;
      updateHeaderActivePrayerBadge();
      if (markerClusterGroup && mosquesList.length > 0) {
        markerClusterGroup.clearLayers();
        renderMosqueMarkers();
      }
    }

    // Agar masjid oynasi ochiq bo'lsa, keyingi namozgacha soniyalarni jonli hisoblash
    if (activeMosque && document.getElementById('mosque-modal')?.classList.contains('active')) {
      updateModalNextPrayer(activeMosque.vaqtlar);
    }
  }

  updateTime();
  setInterval(updateTime, 1000);
}

/**
 * Yuqori qismdagi faol namoz ko'rsatkichi (Pill badge)
 */
function updateHeaderActivePrayerBadge() {
  const badge = document.getElementById('header-active-prayer-badge');
  const textEl = document.getElementById('header-active-prayer-text');
  if (!badge || !textEl) return;

  const sampleMosque = mosquesList[0] || {
    vaqtlar: { bomdod: '05:40', peshin: '12:45', asr: '16:30', shom: '17:50', hufton: '19:15' }
  };
  const active = getActivePrayerInfo(sampleMosque);

  if (active) {
    badge.style.display = 'inline-flex';
    textEl.textContent = `${active.name} ${active.time}`;
  } else {
    badge.style.display = 'none';
  }
}

/**
 * 2. Leaflet Xaritasini to'liq ishonchli ishga tushirish
 */
function initMap() {
  // Toshkent shahar markazi
  const toshkentCenter = [41.311081, 69.240562];
  const defaultZoom = 13;

  map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true
  }).setView(toshkentCenter, defaultZoom);

  // Zoom boshqaruvi (o'ng yuqorida)
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Dastlabki xarita qatlami: Tungi rejimda CartoDB Dark, kunduzi Google Roadmap
  setMapLayer(isDarkMode ? 'dark' : 'roadmap');

  // Progressive Hierarchical Clustering with Smooth Reuniting & Splitting Animations
  markerClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: true,
    animate: true,
    animateAddingMarkers: false,
    removeOutsideVisibleBounds: true,
    chunkedLoading: true,
    chunkInterval: 100,
    chunkDelay: 10,
    maxClusterRadius: function(zoom) {
      // Zoom 11 va undan kichik bo'lganda butun Toshkent bitta yagona klasterga birlashadi (166 ta)
      if (zoom <= 10) return 280;
      if (zoom === 11) return 180;
      if (zoom === 12) return 110;
      if (zoom === 13) return 75;
      if (zoom === 14) return 50;
      return 35; // Zoom >= 15 ko'cha darajasida har bir masjid alohida joyida ochiladi
    },
    iconCreateFunction: function(cluster) {
      const count = cluster.getChildCount();
      const allMarkers = cluster.getAllChildMarkers();
      const hasActive = allMarkers.some(m => m._mosqueData && getActivePrayerInfo(m._mosqueData) !== null);

      let cClass = 'cluster-small';
      let size = 42;
      if (count >= 100) {
        cClass = 'cluster-huge';
        size = 56;
      } else if (count >= 20) {
        cClass = 'cluster-large';
        size = 50;
      } else if (count >= 8) {
        cClass = 'cluster-medium';
        size = 46;
      }

      if (hasActive) {
        cClass += ' cluster-active-prayer';
      }

      const dotHtml = hasActive ? '<div class="cluster-active-dot"></div>' : '';

      return L.divIcon({
        html: `<div class="mosque-cluster-badge ${cClass}" title="${count} ta masjid">${dotHtml}<span>${count}</span></div>`,
        className: 'mosque-cluster-wrap',
        iconSize: [size + 24, size + 24],
        iconAnchor: [(size + 24) / 2, (size + 24) / 2]
      });
    }
  }).addTo(map);

  // Xarita surilganda yoki kattalashtirilganda animatsiyalarni vaqtincha to'xtatib, 144 FPS o'ta silliq harakatni ta'minlash
  map.on('movestart zoomstart', () => {
    document.body.classList.add('map-moving');
  });
  map.on('moveend zoomend', () => {
    document.body.classList.remove('map-moving');
  });

  // Kulrang kvadratlar bo'lmasligi uchun invalidateSize chaqirish
  setTimeout(() => { if (map) map.invalidateSize(); }, 150);
  setTimeout(() => { if (map) map.invalidateSize(); }, 450);
  window.addEventListener('resize', () => { if (map) map.invalidateSize(); });

  // Xaritaga bosilganda (Admin rejimida yangi masjid qo'shish)
  map.on('click', (e) => {
    if (adminMode) {
      openAddMosqueModal(e.latlng.lat, e.latlng.lng);
    }
  });
}

function setMapLayer(type) {
  const mapEl = document.getElementById('map');

  if (type === 'satellite') {
    if (currentTileLayer) map.removeLayer(currentTileLayer);
    currentTileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Google Satellite'
    }).addTo(map);
    isSatellite = true;
    if (mapEl) mapEl.classList.add('satellite-active');
  } else if (type === 'osm') {
    if (currentTileLayer) map.removeLayer(currentTileLayer);
    currentTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: 'OpenStreetMap'
    }).addTo(map);
    isSatellite = false;
    if (mapEl) mapEl.classList.remove('satellite-active');
  } else {
    // Google Maps Roadmap: Ishonchli, tez va barcha ko'chalar aniq ko'rinadi
    // Tungi rejimda GPU filtri orqali xarita yo'qolmasdan, lahzada yuqori kontrastli qora rejimga o'tadi
    if (!currentTileLayer || isSatellite) {
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      currentTileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Google Maps'
      }).addTo(map);
    }
    isSatellite = false;
    if (mapEl) mapEl.classList.remove('satellite-active');
  }
}

/**
 * Masjidda hozir biror namoz vaqti kirganligini aniqlash
 * Foydalanuvchi talabi: "измени свечение оно должно светиться только 5 минут не больше"
 * Namoz vaqti kirgan paytdan boshlab AYNAN 5 DAQIQA davomida
 * (masalan: 16:30 da kirdi -> 16:30 dan 16:34:59 gacha, ya'ni roppa-rosa 5 daqiqa)
 * masjid zumrad-yashil nur sochib miltillaydi, 5 daqiqadan so'ng esa nur darhol o'chadi!
 */
function getActivePrayerInfo(mosque) {
  if (!mosque || !mosque.vaqtlar) return null;

  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();

  function parseMin(str) {
    if (!str || !str.includes(':')) return -1;
    const [h, m] = str.split(':').map(Number);
    return isNaN(h) || isNaN(m) ? -1 : h * 60 + m;
  }

  // QAT'IY TALAB: Roppa-rosa 5 daqiqa (5 minut) miltillab nur sochadi, ortiq emas!
  const EXACT_GLOW_LIMIT_MINUTES = 5;

  const v = mosque.vaqtlar;
  const config = [
    { key: 'bomdod', name: 'Bomdod', min: parseMin(v.bomdod), time: v.bomdod },
    { key: 'peshin', name: 'Peshin', min: parseMin(v.peshin), time: v.peshin },
    { key: 'asr',    name: 'Asr',    min: parseMin(v.asr),    time: v.asr },
    { key: 'shom',   name: 'Shom',   min: parseMin(v.shom),   time: v.shom },
    { key: 'hufton', name: 'Hufton', min: parseMin(v.hufton), time: v.hufton }
  ];

  for (const p of config) {
    if (p.min >= 0) {
      const diff = curMin - p.min;
      // 0, 1, 2, 3, 4-daqiqalarda (jami 5 daqiqa) miltillaydi; 5-daqiqadan so'ng (diff >= 5) to'xtaydi!
      if (diff >= 0 && diff < EXACT_GLOW_LIMIT_MINUTES) {
        return {
          key: p.key,
          name: p.name,
          time: p.time,
          minutesActive: diff
        };
      }
    }
  }

  return null;
}

/**
 * Xaritada aniq va chiroyli ko'rinadigan Masjid nishoni
 * Agar namoz vaqti kirgan bo'lsa: saytning zumrad-yashil mavzuviy rangida yorqin nur sochib miltillaydi
 */
function createMosqueIcon(mosqueInput, isSelected = false) {
  const isObj = typeof mosqueInput === 'object' && mosqueInput !== null;
  const name = isObj ? mosqueInput.nomi : String(mosqueInput || '');
  const activePrayer = isObj ? getActivePrayerInfo(mosqueInput) : null;

  let short = name.replace(/ jome masjidi| masjidi| \(Oq masjid\)|\(Xasti Imom\)|\(Koʻkcha\)|\(Ko'kcha\)|\(Juma\)/gi, '').trim();
  if (short.length > 15) {
    short = short.slice(0, 14) + '...';
  }

  const selectedClass = isSelected ? 'active-selected-marker' : '';
  const activeClass = activePrayer ? 'prayer-time-active-marker' : '';

  // Namoz vaqti kirganda zumrad-yashil yorqin miltillovchi to'lqin auralari
  const auraHtml = activePrayer ? `
    <div class="prayer-pulse-aura"></div>
    <div class="prayer-pulse-ring-outer"></div>
  ` : '';

  const tagHtml = activePrayer ? `
    <div class="mosque-pin-tag prayer-tag-active">
      <span class="active-dot"></span>
      <span>${short} • ${activePrayer.name}</span>
    </div>
  ` : `
    <div class="mosque-pin-tag">${short}</div>
  `;

  return L.divIcon({
    className: 'leaflet-div-icon',
    html: `
      <div class="mosque-pin-container ${selectedClass} ${activeClass}" title="${name}${activePrayer ? ` (Hozir ${activePrayer.name} namozi vaqti: ${activePrayer.time})` : ''}">
        ${auraHtml}
        <img src="icons/mosque_pin.svg" class="mosque-pin-body" alt="Masjid" />
        ${tagHtml}
      </div>
    `,
    iconSize: [120, 96],
    iconAnchor: [60, 48],
    popupAnchor: [0, -48]
  });
}

// Yangi kesh kalitlari va eski keshni tozalash
const STORAGE_KEY = 'uz_toshkent_masjidlar_v5_osm_yandex';
const USER_EDITS_KEY = 'uz_masjid_user_edits_v5';

// Eski noto'g'ri koordinatali kesh ma'lumotlarini tozalash
['uz_toshkent_masjidlar', 'uz_toshkent_masjidlar_v1', 'uz_toshkent_masjidlar_v2', 'uz_toshkent_masjidlar_v3', 'uz_toshkent_masjidlar_v4_exact'].forEach(k => {
  try { localStorage.removeItem(k); } catch (e) {}
});

function getUserEdits() {
  try {
    const raw = localStorage.getItem(USER_EDITS_KEY);
    return raw ? JSON.parse(raw) : { updatedTimes: {}, customMosques: [] };
  } catch (e) {
    return { updatedTimes: {}, customMosques: [] };
  }
}

function saveUserEdits(edits) {
  try {
    localStorage.setItem(USER_EDITS_KEY, JSON.stringify(edits));
  } catch (e) {}
}

function mergeUserEdits(baseList, userEdits) {
  if (!userEdits) return baseList;
  const list = baseList.map(m => {
    if (userEdits.updatedTimes && userEdits.updatedTimes[m.id]) {
      const u = userEdits.updatedTimes[m.id];
      return {
        ...m,
        sana: u.sana || m.sana,
        vaqtlar: { ...m.vaqtlar, ...u.vaqtlar },
        juma: u.juma !== undefined ? u.juma : m.juma,
        izoh: u.izoh !== undefined ? u.izoh : m.izoh
      };
    }
    return m;
  });

  if (Array.isArray(userEdits.customMosques)) {
    userEdits.customMosques.forEach(cm => {
      if (!list.some(x => x.id === cm.id)) {
        list.push(cm);
      }
    });
  }

  return list;
}

/**
 * 3. Masjidlar ma'lumotlarini yuklash (Aniq GPS koordinatalari bilan)
 */
async function loadMosquesData() {
  let loadedFromNetwork = false;

  try {
    const isFileProto = window.location.protocol === 'file:';
    const url = isFileProto ? 'data/masjidlar.json' : ('data/masjidlar.json?v=' + Date.now());
    const res = await fetch(url, isFileProto ? {} : { cache: 'no-store' });
    if (res.ok) {
      const baseMosques = await res.json();
      if (Array.isArray(baseMosques) && baseMosques.length > 0) {
        const edits = getUserEdits();
        mosquesList = mergeUserEdits(baseMosques, edits);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mosquesList));
        loadedFromNetwork = true;
      }
    }
  } catch (err) {
    console.warn('Tarmoq orqali yuklanmadi, keshdan foydalaniladi:', err);
  }

  if (!loadedFromNetwork) {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      try {
        mosquesList = JSON.parse(localData);
      } catch (e) {
        console.warn('Kesh ma\'lumotini o\'qishda xatolik:', e);
      }
    }
  }

  renderMosqueMarkers();
  renderMosqueDrawer();
  updateCounter(mosquesList.length);
  populateMosqueSelectOptions();
}

function updateCounter(count) {
  const counter = document.getElementById('header-counter');
  if (counter) {
    counter.textContent = `${count} ta masjid`;
  }
}

function saveMosquesToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mosquesList));
  syncWithBackend();
}

async function syncWithBackend() {
  if (window.location.protocol === 'file:') return;
  try {
    await fetch('/api/masjidlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mosquesList)
    });
  } catch (e) {
    // Offline yoki mahalliylikda davom etaveradi
  }
}

/**
 * 4. Xaritada klasterlangan masjid markerlarini chizish
/**
 * Kirillcha (Ruscha/O'zbekcha) matnni Lotin alifbosiga o'tkazish
 * Foydalanuvchi "Минор", "Кукча", "Хазрати Имом" deb qidirsa ham topishi uchun
 */
function cyrillicToLatin(str) {
  if (!str) return '';
  const map = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '',
    'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': "o'", 'қ': 'q',
    'ғ': "g'", 'ҳ': 'h'
  };
  return str.toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('');
}

/**
 * 4. O'yinlardagi Frustum / Viewport Culling texnologiyasi:
 * Faqat ko'rinayotgan masjid nishonlari xaritaga joylashtiriladi va uzluksiz oqim (stream) qilinadi.
 * Foydalanuvchi talabi: "Ту часть, которую не видно, он не должен прогружать"
 */
function getFilteredMosques() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const qLatin = cyrillicToLatin(query).replace(/['`ʻ’\- ]/g, '');

  return mosquesList.filter(m => {
    // Tuman bo'yicha filtr
    if (currentFilter !== 'all') {
      const tumanClean = (m.tuman || '').toLowerCase();
      if (!tumanClean.includes(currentFilter.toLowerCase())) {
        return false;
      }
    }

    // Qidiruv bo'yicha filtr (Lotin va Kirill / Ruscha so'zlarni ham avtomatik topadi)
    if (query) {
      const nameLatin = cyrillicToLatin(m.nomi).replace(/['`ʻ’\- ]/g, '');
      const distLatin = cyrillicToLatin(m.tuman || '').replace(/['`ʻ’\- ]/g, '');
      const addrLatin = cyrillicToLatin(m.manzil || '').replace(/['`ʻ’\- ]/g, '');

      const matchName = nameLatin.includes(qLatin) || m.nomi.toLowerCase().includes(query);
      const matchDist = distLatin.includes(qLatin) || (m.tuman || '').toLowerCase().includes(query);
      const matchAddr = addrLatin.includes(qLatin) || (m.manzil || '').toLowerCase().includes(query);
      if (!matchName && !matchDist && !matchAddr) return false;
    }

    return true;
  });
}

function createSingleMosqueMarker(m) {
  const isSelected = activeMosque && activeMosque.id === m.id;
  const marker = L.marker([m.lat, m.lng], {
    icon: createMosqueIcon(m, isSelected)
  });
  marker._mosqueData = m;

  marker.on('click', () => {
    openMosquePrayerModal(m, marker);
  });

  return marker;
}

function renderMosqueMarkers(forceFit = false) {
  if (!map || !markerClusterGroup) return;

  const filtered = getFilteredMosques();
  updateCounter(filtered.length);

  // Agar tuman tanlanganda va forceFit bo'lsa, xaritani moslab joylashtirish
  if (forceFit && currentFilter !== 'all' && filtered.length > 0) {
    const points = filtered.map(m => [m.lat, m.lng]);
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
  }

  markerClusterGroup.clearLayers();
  const markersToAdd = [];

  for (let i = 0; i < filtered.length; i++) {
    const m = filtered[i];
    const marker = createSingleMosqueMarker(m);
    markersToAdd.push(marker);
  }

  markerClusterGroup.addLayers(markersToAdd);
}

/**
 * 5. MASJID NAMOZ VAQTLARI OYNASI (ASOSIY TALAB)
 * "когда нажимается на мачеть нужно чтобы выходило окно с время и дата bomdod peshin asr shom va hufton"
 */
function openMosquePrayerModal(mosque, marker = null) {
  activeMosque = mosque;
  activeMarker = marker;

  const modal = document.getElementById('mosque-modal');
  const modalName = document.getElementById('modal-mosque-name');
  const modalAddress = document.getElementById('modal-mosque-address');
  const modalNote = document.getElementById('modal-mosque-note');

  modalName.textContent = mosque.nomi;
  modalAddress.textContent = `${mosque.tuman || 'Toshkent'}, ${mosque.manzil}`;

  // 5 ta namoz vaqti: Bomdod, Peshin, Asr, Shom, Hufton (toza, ortiqcha belgilarsiz!)
  const v = mosque.vaqtlar;
  document.getElementById('time-bomdod').textContent = v.bomdod || '--:--';
  document.getElementById('time-peshin').textContent = v.peshin || '--:--';
  document.getElementById('time-asr').textContent = v.asr || '--:--';
  document.getElementById('time-shom').textContent = v.shom || '--:--';
  document.getElementById('time-hufton').textContent = v.hufton || '--:--';

  // Juma namozi vaqti
  const jumaRow = document.getElementById('juma-row');
  const timeJuma = document.getElementById('time-juma');
  if (mosque.juma) {
    jumaRow.style.display = 'flex';
    timeJuma.textContent = mosque.juma;
  } else {
    jumaRow.style.display = 'none';
  }

  // Izoh va Tasdiqlangan mas'ul
  const noteBox = document.getElementById('mosque-note-box');
  if (mosque.tahrirchi) {
    modalNote.innerHTML = `<strong>✅ Tasdiqlangan:</strong> ${mosque.tahrirchi} (${mosque.tahrirchiRole || 'Imom'}) tomonidan kiritilgan.${mosque.izoh ? '<br><em>📢 ' + mosque.izoh + '</em>' : ''}`;
    if (noteBox) noteBox.style.display = 'flex';
  } else if (mosque.izoh) {
    modalNote.textContent = mosque.izoh;
    if (noteBox) noteBox.style.display = 'flex';
  } else {
    modalNote.textContent = "Masjid mas'ullari tomonidan belgilangan aniq namoz vaqtlari.";
    if (noteBox) noteBox.style.display = 'flex';
  }

  // Masofani ko'rsatish
  const distEl = document.getElementById('modal-mosque-distance');
  if (userLocation && distEl) {
    const d = getDistanceKm(userLocation.lat, userLocation.lng, mosque.lat, mosque.lng);
    distEl.textContent = `• 🚶 ${formatDistance(d)}`;
    distEl.style.display = 'inline-block';
  } else if (distEl) {
    distEl.style.display = 'none';
  }

  // Keyingi namozni hisoblash va ajratib ko'rsatish
  highlightUpcomingPrayer(v);

  // Faqat rasmiy tayinlangan imom yoki bosh administrator tahrir tugmasini ko'ra oladi
  const editBtn = document.getElementById('btn-open-edit');
  if (editBtn) {
    const isAuthorized = currentUser && (
      currentUser.role === 'Bosh Administrator' ||
      currentUser.mosqueId === 'all' ||
      String(currentUser.mosqueId) === String(mosque.id)
    );
    editBtn.style.display = isAuthorized ? 'inline-flex' : 'none';
  }

  // Modalni ochish
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');

  // Xaritani shu masjidga qaratish (telefonda modal pastdan chiqishi tufayli masjidni ekranning yuqori ochiq qismida ko'rsatish)
  if (window.innerWidth < 640) {
    const targetPoint = map.project([mosque.lat, mosque.lng], map.getZoom()).add([0, 130]);
    const targetLatLng = map.unproject(targetPoint, map.getZoom());
    map.panTo(targetLatLng, { animate: true, duration: 0.5 });
  } else {
    map.panTo([mosque.lat, mosque.lng], { animate: true, duration: 0.5 });
  }
}

function closeMosquePrayerModal() {
  const modal = document.getElementById('mosque-modal');
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Keyingi namozni hisoblash
 */
function highlightUpcomingPrayer(vaqtlar) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  function timeToMin(timeStr) {
    if (!timeStr) return 9999;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  const prayers = [
    { key: 'bomdod', name: 'Bomdod', min: timeToMin(vaqtlar.bomdod), time: vaqtlar.bomdod },
    { key: 'peshin', name: 'Peshin', min: timeToMin(vaqtlar.peshin), time: vaqtlar.peshin },
    { key: 'asr', name: 'Asr', min: timeToMin(vaqtlar.asr), time: vaqtlar.asr },
    { key: 'shom', name: 'Shom', min: timeToMin(vaqtlar.shom), time: vaqtlar.shom },
    { key: 'hufton', name: 'Hufton', min: timeToMin(vaqtlar.hufton), time: vaqtlar.hufton },
  ];

  ['bomdod', 'peshin', 'asr', 'shom', 'hufton'].forEach(k => {
    const card = document.getElementById(`card-${k}`);
    if (card) {
      card.classList.remove('highlight');
      card.classList.remove('active-prayer-highlight');
      card.querySelector('.active-prayer-badge-chip')?.remove();
    }
  });

  // Hozirgi kirgan faol namozni yashil rangda miltillatib ko'rsatish
  if (activeMosque) {
    const curActive = getActivePrayerInfo(activeMosque);
    if (curActive) {
      const activeCard = document.getElementById(`card-${curActive.key}`);
      if (activeCard) {
        activeCard.classList.add('active-prayer-highlight');
        if (!activeCard.querySelector('.active-prayer-badge-chip')) {
          const badge = document.createElement('div');
          badge.className = 'active-prayer-badge-chip';
          badge.innerHTML = '🟢 HOZIR VAQTI!';
          activeCard.appendChild(badge);
        }
      }
    }
  }

  let next = prayers.find(p => p.min > currentMinutes);
  let isTomorrow = false;
  if (!next) {
    next = prayers[0];
    isTomorrow = true;
  }

  const nextCard = document.getElementById(`card-${next.key}`);
  if (nextCard) nextCard.classList.add('highlight');

  // Exact countdown calculation down to the second
  const curSeconds = now.getSeconds();
  let diffSeconds = (next.min * 60) - (now.getHours() * 3600 + now.getMinutes() * 60 + curSeconds);
  if (diffSeconds < 0) {
    diffSeconds += 24 * 3600;
  }
  const remH = Math.floor(diffSeconds / 3600);
  const remM = Math.floor((diffSeconds % 3600) / 60);
  const remS = diffSeconds % 60;
  const timeStr = `${String(remH).padStart(2,'0')}:${String(remM).padStart(2,'0')}:${String(remS).padStart(2,'0')}`;

  const bannerLabel = document.getElementById('next-prayer-label');
  const bannerTime = document.getElementById('next-prayer-time');
  if (bannerLabel && bannerTime) {
    bannerLabel.innerHTML = `Keyingi namoz: <strong>${next.name}</strong> (${next.time})${isTomorrow ? ' <em>(ertaga)</em>' : ''}`;
    bannerTime.innerHTML = `⏳ <strong>${timeStr}</strong> <span style="font-size:0.76rem; font-weight:600; opacity:0.85;">qoldi</span>`;
  }
}

const updateModalNextPrayer = highlightUpcomingPrayer;

/**
 * 6. NAMOZ VAQTLARINI O'ZGARTIRISH VA KIRITISH (ADMIN / USER)
 */
function openEditTimesModal(targetMosque = null) {
  const mosqueToEdit = targetMosque || activeMosque;
  if (!mosqueToEdit) return;

  // 1. Tizimga kirganlik va vakolatni tekshirish
  if (!currentUser) {
    showToast("🔒 Vaqtlarni faqat tayinlangan masjid imomi o'zgartira oladi!");
    window.location.href = 'admin.html';
    return;
  }

  const isAuthorized = currentUser.role === 'Bosh Administrator' ||
    currentUser.mosqueId === 'all' ||
    String(currentUser.mosqueId) === String(mosqueToEdit.id);

  if (!isAuthorized) {
    showToast("⛔ Siz faqat o'zingizga biriktirilgan masjid vaqtlarini tahrirlashingiz mumkin!");
    return;
  }

  activeMosque = mosqueToEdit;

  // Mas'ul shaxs ma'lumotlarini aks ettirish
  const authorName = document.getElementById('edit-author-name');
  const authorRole = document.getElementById('edit-author-role');
  if (authorName) authorName.textContent = currentUser.name;
  if (authorRole) authorRole.textContent = `${currentUser.role || 'Imom'} • ${currentUser.phone}`;

  const editModal = document.getElementById('edit-modal');
  document.getElementById('edit-mosque-subtitle').textContent = activeMosque.nomi;

  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('edit-date').value = activeMosque.sana || todayStr;

  const v = activeMosque.vaqtlar;
  document.getElementById('input-bomdod').value = v.bomdod || '05:40';
  document.getElementById('input-peshin').value = v.peshin || '12:45';
  document.getElementById('input-asr').value = v.asr || '16:30';
  document.getElementById('input-shom').value = v.shom || '17:50';
  document.getElementById('input-hufton').value = v.hufton || '19:15';
  document.getElementById('input-juma').value = activeMosque.juma || '12:45';
  document.getElementById('input-izoh').value = activeMosque.izoh || '';

  editModal.classList.add('active');
  editModal.setAttribute('aria-hidden', 'false');
}

function closeEditTimesModal() {
  const editModal = document.getElementById('edit-modal');
  editModal.classList.remove('active');
  editModal.setAttribute('aria-hidden', 'true');
}

function handleSavePrayerTimes(e) {
  e.preventDefault();
  if (!activeMosque) return;

  const dateVal = document.getElementById('edit-date').value;
  const bomdod = document.getElementById('input-bomdod').value;
  const peshin = document.getElementById('input-peshin').value;
  const asr = document.getElementById('input-asr').value;
  const shom = document.getElementById('input-shom').value;
  const hufton = document.getElementById('input-hufton').value;
  const juma = document.getElementById('input-juma').value;
  const izoh = document.getElementById('input-izoh').value;

  activeMosque.sana = dateVal;
  activeMosque.vaqtlar = { bomdod, peshin, asr, shom, hufton };
  activeMosque.juma = juma;
  activeMosque.izoh = izoh;
  activeMosque.tahrirchi = currentUser ? currentUser.name : 'Masjid xodimi';
  activeMosque.tahrirchiRole = currentUser ? currentUser.role : 'Imom';

  const idx = mosquesList.findIndex(m => m.id === activeMosque.id);
  if (idx !== -1) {
    mosquesList[idx] = activeMosque;
  }

  // Foydalanuvchi tahrirlagan vaqtlarini saqlab borish
  const edits = getUserEdits();
  edits.updatedTimes = edits.updatedTimes || {};
  edits.updatedTimes[activeMosque.id] = {
    sana: dateVal,
    vaqtlar: { bomdod, peshin, asr, shom, hufton },
    juma,
    izoh,
    tahrirchi: activeMosque.tahrirchi,
    tahrirchiRole: activeMosque.tahrirchiRole
  };
  saveUserEdits(edits);

  // Shaxsiy kabinet tarixiga yozish
  if (currentUser) {
    currentUser.history = currentUser.history || [];
    currentUser.history.unshift({
      date: dateVal,
      mosqueName: activeMosque.nomi,
      times: `Bomdod: ${bomdod} | Peshin: ${peshin} | Asr: ${asr} | Shom: ${shom} | Hufton: ${hufton}`,
      timestamp: Date.now()
    });
    saveCurrentUser();
  }

  saveMosquesToStorage();
  renderMosqueDrawer();
  openMosquePrayerModal(activeMosque);
  closeEditTimesModal();

  showToast(`✅ "${activeMosque.nomi}" vaqtlari ${activeMosque.tahrirchi} tomonidan saqlandi!`);
}

/**
 * 7. YANGI MASJID QO'SHISH
 */
function openAddMosqueModal(lat = null, lng = null) {
  const addModal = document.getElementById('add-mosque-modal');
  if (lat && lng) {
    document.getElementById('add-lat').value = Number(lat).toFixed(4);
    document.getElementById('add-lng').value = Number(lng).toFixed(4);
  } else {
    const center = map.getCenter();
    document.getElementById('add-lat').value = center.lat.toFixed(4);
    document.getElementById('add-lng').value = center.lng.toFixed(4);
  }
  addModal.classList.add('active');
  addModal.setAttribute('aria-hidden', 'false');
}

function closeAddMosqueModal() {
  const addModal = document.getElementById('add-mosque-modal');
  addModal.classList.remove('active');
  addModal.setAttribute('aria-hidden', 'true');
}

function handleAddMosqueSubmit(e) {
  e.preventDefault();

  const nomi = document.getElementById('add-nomi').value.trim();
  const shahar = document.getElementById('add-shahar').value.trim() || 'Toshkent';
  const tuman = document.getElementById('add-tuman').value.trim();
  const manzil = document.getElementById('add-manzil').value.trim();
  const lat = parseFloat(document.getElementById('add-lat').value);
  const lng = parseFloat(document.getElementById('add-lng').value);

  const bomdod = document.getElementById('add-bomdod').value;
  const peshin = document.getElementById('add-peshin').value;
  const asr = document.getElementById('add-asr').value;
  const shom = document.getElementById('add-shom').value;
  const hufton = document.getElementById('add-hufton').value;

  const newMosque = {
    id: 'masjid-' + Date.now(),
    nomi,
    shahar,
    tuman,
    manzil,
    lat,
    lng,
    sana: new Date().toISOString().split('T')[0],
    soat_yangilangan: new Date().toLocaleTimeString('uz-UZ').slice(0, 5),
    juma: "12:45",
    vaqtlar: { bomdod, peshin, asr, shom, hufton },
    izoh: "Masjid boshqaruvchisi tomonidan belgilangan namoz vaqtlari."
  };

  mosquesList.push(newMosque);

  const edits = getUserEdits();
  edits.customMosques = edits.customMosques || [];
  edits.customMosques.push(newMosque);
  saveUserEdits(edits);

  saveMosquesToStorage();
  renderMosqueMarkers();
  renderMosqueDrawer();

  closeAddMosqueModal();
  e.target.reset();

  showToast(`🎉 "${nomi}" xaritaga muvaffaqiyatli qo'shildi!`);
  openMosquePrayerModal(newMosque);
}

/**
 * 8. Masjidlar ro'yxati (Drawer)
 */
function renderMosqueDrawer() {
  const container = document.getElementById('drawer-items-container');
  if (!container) return;

  if (!container._hasClickDelegate) {
    container.addEventListener('click', (e) => {
      const item = e.target.closest('.drawer-item');
      if (!item) return;
      const mosqueId = item.dataset.id;
      const mosque = mosquesList.find(m => String(m.id) === String(mosqueId));
      if (mosque) {
        closeDrawer();
        openMosquePrayerModal(mosque);
      }
    });
    container._hasClickDelegate = true;
  }

  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  mosquesList.forEach(m => {
    const item = document.createElement('div');
    item.className = 'drawer-item';
    item.dataset.id = m.id;
    const distBadge = m.distanceKm !== undefined ? `<span class="distance-chip">🚶 ${formatDistance(m.distanceKm)}</span>` : '';
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div class="drawer-item-title">🕌 ${m.nomi}</div>
        ${distBadge}
      </div>
      <div class="drawer-item-sub">📍 ${m.tuman || 'Toshkent'}, ${m.manzil}</div>
      <div class="drawer-item-times">
        <span>Bomdod: ${m.vaqtlar.bomdod}</span>
        <span>Peshin: ${m.vaqtlar.peshin}</span>
        <span>Asr: ${m.vaqtlar.asr}</span>
        <span>Shom: ${m.vaqtlar.shom}</span>
        <span>Hufton: ${m.vaqtlar.hufton}</span>
      </div>
    `;
    fragment.appendChild(item);
  });

  container.appendChild(fragment);
}

function openDrawer() {
  document.getElementById('drawer-list')?.classList.add('active');
}

function closeDrawer() {
  document.getElementById('drawer-list')?.classList.remove('active');
}

/**
 * 9. Toast xabari
 */
function showToast(message) {
  const toast = document.getElementById('app-toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/**
 * 10. Mobil qurilmalarda oynani pastga surib yopish (Swipe to close)
 */
function initSwipeToClose() {
  const sheet = document.querySelector('#mosque-modal .modal-sheet');
  const handle = document.querySelector('#mosque-modal .sheet-handle');
  const header = document.querySelector('#mosque-modal .mosque-modal-header');
  if (!sheet) return;

  let startY = 0;
  let currentY = 0;
  let isSwiping = false;

  const onTouchStart = (e) => {
    if (e.target.closest('#btn-close-modal') || e.target.closest('.modal-close-btn')) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    isSwiping = true;
    sheet.style.transition = 'none';
  };

  const onTouchMove = (e) => {
    if (!isSwiping) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      sheet.style.transform = `translateY(${diff}px)`;
    }
  };

  const onTouchEnd = () => {
    if (!isSwiping) return;
    isSwiping = false;
    const diff = currentY - startY;
    sheet.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    if (diff > 90) {
      sheet.style.transform = 'translateY(100%)';
      setTimeout(() => {
        closeMosquePrayerModal();
        sheet.style.transform = '';
      }, 200);
    } else {
      sheet.style.transform = '';
    }
  };

  if (handle) {
    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    handle.addEventListener('touchmove', onTouchMove, { passive: true });
    handle.addEventListener('touchend', onTouchEnd);
  }
  if (header) {
    header.addEventListener('touchstart', onTouchStart, { passive: true });
    header.addEventListener('touchmove', onTouchMove, { passive: true });
    header.addEventListener('touchend', onTouchEnd);
  }
}

/**
 * 11. UI hodisalarini bog'lash
 */
function bindUIEvents() {
  document.getElementById('btn-close-modal')?.addEventListener('click', closeMosquePrayerModal);
  document.getElementById('btn-close-edit')?.addEventListener('click', closeEditTimesModal);
  document.getElementById('btn-close-add')?.addEventListener('click', closeAddMosqueModal);
  document.getElementById('btn-close-drawer')?.addEventListener('click', closeDrawer);

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  document.getElementById('btn-open-edit')?.addEventListener('click', openEditTimesModal);
  document.getElementById('edit-times-form')?.addEventListener('submit', handleSavePrayerTimes);

  document.getElementById('btn-add-mosque')?.addEventListener('click', () => openAddMosqueModal());
  document.getElementById('add-mosque-form')?.addEventListener('submit', handleAddMosqueSubmit);

  document.getElementById('btn-toggle-list')?.addEventListener('click', openDrawer);

  // Mobil va Kompyuter menyuni ochish / yopish (Modern animated menu toggle)
  const menuToggleBtn = document.getElementById('btn-toggle-menu');
  const collapsePanel = document.getElementById('header-collapse-section');
  if (menuToggleBtn && collapsePanel) {
    // Dastlabki holat: Kompyuterda (>= 769px) qulaylik uchun ochiq holda boshlanadi
    if (window.innerWidth >= 769) {
      collapsePanel.classList.add('open');
      menuToggleBtn.classList.add('is-open');
      menuToggleBtn.setAttribute('aria-expanded', 'true');
      const label = menuToggleBtn.querySelector('.menu-label');
      if (label) label.textContent = 'Yopish';
    }

    menuToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = collapsePanel.classList.toggle('open');
      menuToggleBtn.classList.toggle('is-open', isOpen);
      menuToggleBtn.setAttribute('aria-expanded', String(isOpen));
      
      const label = menuToggleBtn.querySelector('.menu-label');
      if (label) label.textContent = isOpen ? 'Yopish' : 'Menyu';

      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 380);
    });

    // Foydalanuvchi xaritaga bosganda menyu ochiq bo'lsa uni chiroyli yopish
    if (map) {
      map.on('click', () => {
        if (window.innerWidth < 768 && collapsePanel.classList.contains('open')) {
          collapsePanel.classList.remove('open');
          menuToggleBtn.classList.remove('is-open');
          menuToggleBtn.setAttribute('aria-expanded', 'false');
          const label = menuToggleBtn.querySelector('.menu-label');
          if (label) label.textContent = 'Menyu';
          setTimeout(() => { if (map) map.invalidateSize(); }, 380);
        }
      });
    }
  }

  // Shaxsiy Kabinet / Kirish tugmasi
  const cabinetBtn = document.getElementById('btn-user-cabinet');
  cabinetBtn?.addEventListener('click', () => {
    if (currentUser) {
      openCabinetModal();
    } else {
      openAuthModal('login');
    }
  });

  // Auth Modal hodisalari (Kirish / Ro'yxatdan o'tish)
  document.getElementById('tab-btn-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-btn-register')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('btn-close-auth')?.addEventListener('click', closeAuthModal);
  document.getElementById('form-login')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('form-register')?.addEventListener('submit', handleRegisterSubmit);
  document.getElementById('btn-demo-imam-login')?.addEventListener('click', handleDemoLogin);

  // Shaxsiy Kabinet hodisalari
  document.getElementById('btn-close-cabinet')?.addEventListener('click', closeCabinetModal);
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-cabinet-edit-my-mosque')?.addEventListener('click', handleCabinetEditMyMosque);
  document.getElementById('btn-cabinet-locate-mosque')?.addEventListener('click', handleCabinetLocateMosque);
  document.getElementById('btn-cabinet-add-mosque')?.addEventListener('click', () => {
    closeCabinetModal();
    openAddMosqueModal();
  });

  // Xarita qatlami almashtirish (Sun'iy yo'ldosh / Oddiy xarita)
  const layerBtn = document.getElementById('btn-map-layer');
  layerBtn?.addEventListener('click', () => {
    if (isSatellite) {
      setMapLayer('roadmap');
      showToast(isDarkMode ? '🌙 Tungi xarita qatlami yoqildi' : '🗺️ Kunduzgi xarita qatlami yoqildi');
    } else {
      setMapLayer('satellite');
      showToast('🛰️ Sun\'iy yo\'ldosh qatlami yoqildi');
    }
  });

  // Toshkent tumanlari bo'yicha filter chiplari
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.getAttribute('data-filter');
      markerClusterGroup.clearLayers();
      if (currentFilter === 'all') {
        map.flyTo([41.311081, 69.240562], 12, { duration: 0.8 });
        renderMosqueMarkers(false);
      } else {
        renderMosqueMarkers(true);
      }
    });
  });

  // Qidiruv maydoni (Debounce 150ms + Clear button)
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('btn-clear-search');

  searchInput?.addEventListener('input', () => {
    if (clearBtn) {
      clearBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
    }
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      markerClusterGroup.clearLayers();
      renderMosqueMarkers(false);
    }, 150);
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      markerClusterGroup.clearLayers();
      renderMosqueMarkers(false);
    }
  });

  // Toshkent markaziga qaytish
  document.getElementById('btn-recenter')?.addEventListener('click', () => {
    map.flyTo([41.311081, 69.240562], 12, { duration: 0.8 });
  });

  // Mening joylashuvim (GPS)
  document.getElementById('btn-my-location')?.addEventListener('click', handleGetMyLocation);

  // Qibla yo'nalishi
  document.getElementById('btn-qibla')?.addEventListener('click', openQiblaModal);
  document.getElementById('btn-close-qibla')?.addEventListener('click', closeQiblaModal);
  document.getElementById('btn-show-qibla-line')?.addEventListener('click', drawQiblaLineOnMap);
  document.getElementById('btn-request-compass')?.addEventListener('click', requestCompassPermission);

  // Raqamli Tasbeh
  document.getElementById('btn-tasbeh')?.addEventListener('click', openTasbehModal);
  document.getElementById('btn-close-tasbeh')?.addEventListener('click', closeTasbehModal);
  document.getElementById('btn-tasbeh-count')?.addEventListener('click', handleTasbehTap);
  document.getElementById('btn-tasbeh-reset')?.addEventListener('click', resetTasbeh);
  document.querySelectorAll('.tasbeh-chip').forEach((chip, idx) => {
    chip.addEventListener('click', () => selectZikr(idx));
  });

  // Tungi rejim (Dark Mode)
  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);

  // Azon ovozi
  document.getElementById('btn-play-azan')?.addEventListener('click', playAzanChime);

  // Oylik namoz taqvimi
  document.getElementById('btn-open-calendar')?.addEventListener('click', openCalendarModal);
  document.getElementById('btn-close-calendar')?.addEventListener('click', closeCalendarModal);

  // Yaqinlik bo'yicha saralash
  document.getElementById('btn-sort-nearest')?.addEventListener('click', sortMosquesByDistance);

  // Yandex Go / Yandex Xaritalar orqali borish
  document.getElementById('btn-navigate-yandex')?.addEventListener('click', () => {
    if (!activeMosque) return;
    const url = `https://yandex.uz/maps/?rtext=~${activeMosque.lat},${activeMosque.lng}&rtt=auto`;
    window.open(url, '_blank');
  });

  // Google Maps orqali navigatsiya
  document.getElementById('btn-navigate-google')?.addEventListener('click', () => {
    if (!activeMosque) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${activeMosque.lat},${activeMosque.lng}`;
    window.open(url, '_blank');
  });

  // Namoz vaqtlarini ulashish (Telegram / WhatsApp / SMS)
  document.getElementById('btn-share')?.addEventListener('click', () => {
    if (!activeMosque) return;
    const v = activeMosque.vaqtlar;
    const shareText = `🕌 ${activeMosque.nomi}\n` +
      `📍 Manzil: ${activeMosque.tuman || 'Toshkent'}, ${activeMosque.manzil}\n` +
      `📅 Sana: ${activeMosque.sana || 'Bugun'}\n\n` +
      `⏰ NAMOZ VAQTLARI:\n` +
      `• Bomdod: ${v.bomdod}\n` +
      `• Peshin: ${v.peshin}\n` +
      `• Asr: ${v.asr}\n` +
      `• Shom: ${v.shom}\n` +
      `• Hufton: ${v.hufton}\n` +
      (activeMosque.juma ? `• Juma namozi: ${activeMosque.juma}\n` : '') +
      `\n🗺️ Xaritada ko'rish:\nhttps://maps.google.com/?q=${activeMosque.lat},${activeMosque.lng}\n\n` +
      `📲 "Toshkent Masjidlari" ilovasi`;

    if (navigator.share) {
      navigator.share({
        title: activeMosque.nomi,
        text: shareText
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText).then(() => {
        showToast("📋 Namoz vaqtlari nusxalandi, Telegram orqali yuborishingiz mumkin!");
      });
    }
  });
}

/**
 * 12. TUNGI REJIM (DARK MODE)
 */
function initTheme() {
  const saved = localStorage.getItem('uz_masjid_theme');
  if (saved === 'dark') {
    enableDarkMode(true);
  }
}

function enableDarkMode(enabled) {
  isDarkMode = enabled;
  document.body.classList.toggle('dark-mode', isDarkMode);
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.textContent = isDarkMode ? '☀️' : '🌙';
  localStorage.setItem('uz_masjid_theme', isDarkMode ? 'dark' : 'light');
  if (map && !isSatellite) {
    setMapLayer(isDarkMode ? 'dark' : 'roadmap');
  }
}

function toggleTheme() {
  enableDarkMode(!isDarkMode);
  showToast(isDarkMode ? '🌙 Tungi rejim yoqildi' : '☀️ Kunduzgi rejim yoqildi');
}

/**
 * 13. MASOFA VA ENG YAQIN MASJIDNI HISOBLASH
 */
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(distKm) {
  if (distKm === undefined || distKm === null) return '';
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)} m`;
  }
  return `${distKm.toFixed(1)} km`;
}

function autoDetectLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    userLocation = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };
    updateNearestMosque();
    renderMosqueDrawer();
  }, () => {}, { timeout: 8000 });
}

// Native iOS va Android integratsiyasi uchun joylashuvni to'g'ridan-to'g'ri o'rnatish
window.setUserLocationFromNative = function(latitude, longitude) {
  userLocation = { lat: Number(latitude), lng: Number(longitude) };
  updateNearestMosque();
  renderMosqueDrawer();
  if (typeof updateQiblaGeodesics === 'function') {
    updateQiblaGeodesics();
  }
};

function handleGetMyLocation() {
  if (!navigator.geolocation) {
    showToast("❌ Geolokatsiya qurilmangizda qo'llab-quvvatlanmaydi.");
    return;
  }
  showToast("📍 Joylashuvingiz aniqlanmoqda...");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      userLocation = { lat: latitude, lng: longitude };
      map.flyTo([latitude, longitude], 15);
      L.circleMarker([latitude, longitude], {
        radius: 9,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.95
      }).addTo(map).bindPopup("Sizning joylashuvingiz").openPopup();

      updateNearestMosque();
      renderMosqueDrawer();
      showToast("✅ Joylashuvingiz xaritada ko'rsatildi!");
    },
    (err) => {
      showToast("⚠️ Joylashuvni aniqlashga ruxsat berilmadi.");
    },
    { enableHighAccuracy: true }
  );
}

function updateNearestMosque() {
  if (!userLocation || mosquesList.length === 0) return;

  let nearest = null;
  let minDist = Infinity;

  mosquesList.forEach(m => {
    const d = getDistanceKm(userLocation.lat, userLocation.lng, m.lat, m.lng);
    m.distanceKm = d;
    if (d < minDist) {
      minDist = d;
      nearest = m;
    }
  });

  const banner = document.getElementById('nearest-mosque-banner');
  const nameEl = document.getElementById('nearest-mosque-name');
  const distEl = document.getElementById('nearest-mosque-dist');

  if (banner && nearest) {
    nameEl.textContent = nearest.nomi;
    distEl.textContent = formatDistance(minDist);
    banner.style.display = 'flex';

    document.getElementById('btn-view-nearest').onclick = () => {
      openMosquePrayerModal(nearest);
    };
  }
}

function sortMosquesByDistance() {
  if (!userLocation) {
    showToast("📍 Avval GPS joylashuvingizni yoqing!");
    handleGetMyLocation();
    return;
  }

  mosquesList.sort((a, b) => (a.distanceKm || 9999) - (b.distanceKm || 9999));
  renderMosqueDrawer();
  showToast("📍 Masjidlar sizga yaqinligi bo'yicha saralandi!");
}

/**
 * 14. QIBLA KOMPASI (ANIK GEODEZIK AZIMUT & 3D ORIENTATSIYA DATCHIGI)
 */
let qiblaHapticFired = false;
let currentQiblaBearing = 240.28; // Toshkent markazi uchun standart geodezik azimut
let currentQiblaDistanceKm = 3360;
let lastCompassHeading = 0;
let unwrappedCompassHeading = 0;
let compassSensorListening = false;
let compassReceivedEvent = false;

// Aniq geodezik azimutni hisoblash (Great-Circle Bearing to Kaaba)
function calculateQiblaBearing(lat, lng) {
  const kaabaLat = 21.422487 * Math.PI / 180;
  const kaabaLng = 39.826206 * Math.PI / 180;
  const userLat = lat * Math.PI / 180;
  const userLng = lng * Math.PI / 180;

  const dLng = kaabaLng - userLng;
  const y = Math.sin(dLng) * Math.cos(kaabaLat);
  const x = Math.cos(userLat) * Math.sin(kaabaLat) - Math.sin(userLat) * Math.cos(kaabaLat) * Math.cos(dLng);

  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360;
}

function updateQiblaGeodesics() {
  const lat = userLocation ? userLocation.lat : 41.311081;
  const lng = userLocation ? userLocation.lng : 69.240562;
  currentQiblaBearing = calculateQiblaBearing(lat, lng);
  currentQiblaDistanceKm = Math.round(getDistanceKm(lat, lng, 21.422487, 39.826206));

  const targetVal = document.getElementById('qibla-target-val');
  const distVal = document.getElementById('qibla-distance-val');
  const kaabaTarget = document.getElementById('qibla-kaaba-target');

  if (targetVal) targetVal.textContent = `${currentQiblaBearing.toFixed(1)}°`;
  if (distVal) distVal.textContent = `${currentQiblaDistanceKm.toLocaleString()} km`;
  if (kaabaTarget) {
    kaabaTarget.style.transform = `rotate(${currentQiblaBearing}deg)`;
  }
}

function openQiblaModal() {
  const modal = document.getElementById('qibla-modal');
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');

  updateQiblaGeodesics();
  startCompassListening();
}

function closeQiblaModal() {
  const modal = document.getElementById('qibla-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  stopCompassListening();
}

async function requestCompassPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response === 'granted') {
        startCompassListening();
        showToast("✅ Kompas datchigiga ruxsat berildi!");
        const btn = document.getElementById('btn-request-compass');
        if (btn) btn.style.display = 'none';
      } else {
        showToast("⚠️ Kompas datchigiga ruxsat berilmadi.");
      }
    } catch (err) {
      console.warn("Sensor ruxsat xatoligi:", err);
    }
  } else {
    startCompassListening();
  }
}

function startCompassListening() {
  if (compassSensorListening) return;

  compassReceivedEvent = false;
  const btnPerm = document.getElementById('btn-request-compass');
  const statusText = document.getElementById('compass-status-text');

  // iOS 13+ permission check
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    if (btnPerm) btnPerm.style.display = 'inline-flex';
    if (statusText) statusText.innerHTML = `⚠️ <em>iOS qurilmangizda kompas ishlashi uchun yuqoridagi "Ruxsat berish" tugmasini bosing.</em>`;
  }

  // Android va standart hodisalarni tinglash
  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', handleDeviceOrientationEvent, true);
    compassSensorListening = true;
  } else if ('ondeviceorientation' in window || window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', handleDeviceOrientationEvent, true);
    compassSensorListening = true;
  }

  // Qo'lda boshqarish slaydri (PC / Desktop yoki sinash uchun)
  const manualSlider = document.getElementById('qibla-manual-slider');
  if (manualSlider) {
    manualSlider.oninput = (e) => {
      const angle = Number(e.target.value);
      const label = document.getElementById('slider-angle-label');
      if (label) label.textContent = `${angle}°`;
      applyCompassHeading(angle, true);
    };
  }

  // Datchikdan signal kelmasa 1.5 soniyadan so'ng foydalanuvchiga yordam ko'rsatish
  setTimeout(() => {
    if (!compassReceivedEvent) {
      if (statusText) {
        statusText.innerHTML = `💡 <em>Kompas datchigi kutilyapti yoki stol kompyuteridasiz. Pastdagi slayder orqali qo'lda sinashingiz mumkin!</em>`;
      }
      applyCompassHeading(0, false);
    }
  }, 1500);
}

function stopCompassListening() {
  if (compassSensorListening) {
    window.removeEventListener('deviceorientationabsolute', handleDeviceOrientationEvent, true);
    window.removeEventListener('deviceorientation', handleDeviceOrientationEvent, true);
    compassSensorListening = false;
  }
}

function handleDeviceOrientationEvent(e) {
  let heading = null;

  // 1. iOS Safari (webkitCompassHeading)
  if (typeof e.webkitCompassHeading !== 'undefined' && e.webkitCompassHeading !== null) {
    heading = e.webkitCompassHeading;
  }
  // 2. Android Chrome (deviceorientationabsolute yoki alpha)
  else if (e.alpha !== null && e.alpha !== undefined) {
    heading = (360 - e.alpha) % 360;

    // Telefon yotiq (tilted) turganda 3D burchakni to'g'rilash
    if (e.beta !== null && e.gamma !== null) {
      const rad = Math.PI / 180;
      const b = (e.beta || 0) * rad;
      const g = (e.gamma || 0) * rad;
      const a = (e.alpha || 0) * rad;
      const cY = Math.cos(g);
      const cZ = Math.cos(a);
      const sX = Math.sin(b);
      const sY = Math.sin(g);
      const sZ = Math.sin(a);
      const Vx = -cZ * sY - sZ * sX * cY;
      const Vy = -sZ * sY + cZ * sX * cY;
      let comp = Math.atan2(Vx, Vy) * (180 / Math.PI);
      if (comp < 0) comp += 360;
      heading = (360 - comp) % 360;
    }
  }

  if (heading !== null && !isNaN(heading)) {
    compassReceivedEvent = true;
    const btnPerm = document.getElementById('btn-request-compass');
    if (btnPerm) btnPerm.style.display = 'none';

    applyCompassHeading(heading, false);
  }
}

function applyCompassHeading(heading, isManual = false) {
  const dial = document.getElementById('qibla-dial');
  const needle = document.getElementById('qibla-needle');
  const headingVal = document.getElementById('compass-heading-val');
  const banner = document.getElementById('qibla-alignment-banner');
  const bannerText = document.getElementById('qibla-alignment-text');
  const bannerIcon = document.getElementById('alignment-icon');
  const statusText = document.getElementById('compass-status-text');

  // Aylanishni 360° dan 0° ga o'tishda sakrab ketmasligi uchun tekislash (Shortest unwrapped delta)
  let delta = heading - lastCompassHeading;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  unwrappedCompassHeading += delta;
  lastCompassHeading = heading;

  // 1. Kompas diskini aylantirish (N doimo real Shimolga qaraydi)
  if (dial) {
    dial.style.transform = `rotate(${-unwrappedCompassHeading}deg)`;
  }

  // 2. Qiblaga bo'lgan farqni hisoblash (Telefon oldi qismiga nisbatan)
  const qiblaRelative = (currentQiblaBearing - heading + 360) % 360;
  const diff = qiblaRelative > 180 ? qiblaRelative - 360 : qiblaRelative;

  // 3. Markaziy ko'rsatkichni Qiblaga yo'naltirish
  if (needle) {
    needle.style.transform = `rotate(${diff}deg)`;
  }

  if (headingVal) {
    headingVal.textContent = `${Math.round(heading)}°`;
  }

  // 4. Qiblaga to'g'rilanganlik holatini tekshirish (±5 daraja aniqlikda)
  const isAligned = Math.abs(diff) <= 5;

  if (isAligned) {
    if (dial) dial.classList.add('qibla-aligned');
    if (banner) banner.classList.add('qibla-aligned');
    if (bannerIcon) bannerIcon.textContent = '🟢';
    if (bannerText) bannerText.innerHTML = `<strong>ALHAMDULILLAH!</strong> Siz to'g'ri Qiblaga qarabsiz!`;

    if (statusText) {
      statusText.innerHTML = `✅ <strong>To'g'ri yo'nalishdasiz:</strong> ${Math.round(currentQiblaBearing)}° (Janubiy-G'arb)`;
    }

    if (navigator.vibrate && !qiblaHapticFired) {
      navigator.vibrate([40, 60, 40]);
      qiblaHapticFired = true;
    }
  } else {
    if (dial) dial.classList.remove('qibla-aligned');
    if (banner) banner.classList.remove('qibla-aligned');
    if (bannerIcon) bannerIcon.textContent = '🧭';

    const turnDir = diff > 0 ? `O'ngga (${Math.abs(Math.round(diff))}°)` : `Chapga (${Math.abs(Math.round(diff))}°)`;
    if (bannerText) bannerText.textContent = `Qibla: ${turnDir} buring`;

    if (statusText && !isManual) {
      statusText.innerHTML = `🧭 <em>Telefonni ${diff > 0 ? "o'ngga 👉" : "chapga 👈"} buring (${Math.round(currentQiblaBearing)}° Qibla tomon).</em>`;
    }
    qiblaHapticFired = false;
  }
}

function drawQiblaLineOnMap() {
  const start = userLocation ? [userLocation.lat, userLocation.lng] : [41.311081, 69.240562];
  const kaaba = [21.422487, 39.826206]; // Makka Ka'ba koordinatalari

  if (qiblaLine) {
    map.removeLayer(qiblaLine);
  }

  qiblaLine = L.polyline([start, kaaba], {
    color: '#f59e0b',
    weight: 4,
    dashArray: '8, 8',
    opacity: 0.95
  }).addTo(map);

  map.fitBounds(qiblaLine.getBounds(), { padding: [40, 40] });
  closeQiblaModal();
  showToast("🕋 Qibla (Ka'ba) tomon yo'nalish chizig'i xaritada ko'rsatildi!");
}

/**
 * 15. RAQAMLI TASBEH (ZIKR COUNTER)
 */
function initTasbeh() {
  updateTasbehUI();
}

function openTasbehModal() {
  const modal = document.getElementById('tasbeh-modal');
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  updateTasbehUI();
}

function closeTasbehModal() {
  const modal = document.getElementById('tasbeh-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function selectZikr(idx) {
  currentZikrIndex = idx;
  currentZikrCount = 0;
  document.querySelectorAll('.tasbeh-chip').forEach((c, i) => {
    c.classList.toggle('active', i === idx);
  });
  updateTasbehUI();
}

function handleTasbehTap() {
  currentZikrCount++;
  totalZikrCount++;

  if (navigator.vibrate) {
    navigator.vibrate(35);
  }

  const zikr = ZIKRLAR[currentZikrIndex];
  if (currentZikrCount >= zikr.max) {
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    showToast(`🎉 "${zikr.name}" yakunlandi!`);
    currentZikrIndex = (currentZikrIndex + 1) % ZIKRLAR.length;
    currentZikrCount = 0;
    document.querySelectorAll('.tasbeh-chip').forEach((c, i) => {
      c.classList.toggle('active', i === currentZikrIndex);
    });
  }

  updateTasbehUI();
}

function resetTasbeh() {
  currentZikrCount = 0;
  totalZikrCount = 0;
  updateTasbehUI();
  showToast("🔄 Tasbeh sanagich qayta nolga tushirildi.");
}

function updateTasbehUI() {
  const zikr = ZIKRLAR[currentZikrIndex];
  const title = document.getElementById('tasbeh-title');
  const arabic = document.getElementById('tasbeh-arabic');
  const num = document.getElementById('tasbeh-current-count');
  const max = document.getElementById('tasbeh-max-count');
  const total = document.getElementById('tasbeh-total-count');

  if (title) title.textContent = zikr.name;
  if (arabic) arabic.textContent = zikr.arabic;
  if (num) num.textContent = currentZikrCount;
  if (max) max.textContent = `/ ${zikr.max}`;
  if (total) total.textContent = `Jami: ${totalZikrCount} zikr`;
}

/**
 * 16. AZON VA ESLATMA QO'NG'IROG'I (WEB AUDIO API)
 */
function playAzanChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const notes = [329.63, 392.00, 440.00, 523.25]; // E4, G4, A4, C5
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.35);
      gain.gain.setValueAtTime(0.001, audioCtx.currentTime + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + i * 0.35 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.35 + 1.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.35);
      osc.stop(audioCtx.currentTime + i * 0.35 + 1.2);
    });

    const icon = document.getElementById('azan-icon');
    const label = document.getElementById('azan-label');
    if (icon && label) {
      icon.textContent = '🔊';
      label.textContent = 'Chalinmoqda...';
      setTimeout(() => {
        icon.textContent = '🔔';
        label.textContent = 'Azon ovozi';
      }, 2000);
    }
    showToast("🔔 Namoz vaqti ovozli xabarnomasi yangradi!");
  } catch (e) {
    console.warn("Audio xatosi:", e);
  }
}

/**
 * 17. OYLIK NAMOZ TAQVIMI JADVALI
 */
function openCalendarModal() {
  const modal = document.getElementById('calendar-modal');
  if (!modal) return;
  renderCalendarTable(activeMosque);
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeCalendarModal() {
  const modal = document.getElementById('calendar-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function adjustTime(timeStr, deltaMinutes) {
  if (!timeStr) return '--:--';
  const [h, m] = timeStr.split(':').map(Number);
  let total = h * 60 + m + deltaMinutes;
  if (total < 0) total += 1440;
  total = total % 1440;
  const newH = String(Math.floor(total / 60)).padStart(2, '0');
  const newM = String(total % 60).padStart(2, '0');
  return `${newH}:${newM}`;
}

function renderCalendarTable(mosque) {
  const tbody = document.getElementById('calendar-table-body');
  const subtitle = document.getElementById('calendar-subtitle');
  if (!tbody) return;
  tbody.innerHTML = '';

  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const base = mosque ? mosque.vaqtlar : { bomdod: '05:40', peshin: '12:45', asr: '16:30', shom: '17:50', hufton: '19:15' };

  if (subtitle && mosque) {
    subtitle.textContent = `${mosque.nomi} bo'yicha (${now.toLocaleString('uz-UZ', { month: 'long' })} oyi)`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === currentDay;
    const tr = document.createElement('tr');
    if (isToday) tr.className = 'today-row';

    const drift = Math.floor((d - currentDay) / 4);

    tr.innerHTML = `
      <td>${d}${isToday ? ' (Bugun)' : ''}</td>
      <td>${adjustTime(base.bomdod, drift)}</td>
      <td>${base.peshin}</td>
      <td>${adjustTime(base.asr, drift)}</td>
      <td>${adjustTime(base.shom, -drift)}</td>
      <td>${adjustTime(base.hufton, -drift)}</td>
    `;
    tbody.appendChild(tr);
  }
}

/**
 * 17. PWA SERVICE WORKER & APP INSTALLATION (STANDALONE ANDROID / IOS)
 */
let deferredInstallPrompt = null;

function initPWAInstallation() {
  // Always ensure ServiceWorker is updated and stale caches are purged
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          reg.update();
          console.log('[PWA] ServiceWorker registered:', reg.scope);
        })
        .catch((err) => console.warn('[PWA] ServiceWorker error:', err));

      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key !== 'masjid-namoz-v18-darkfix') {
              caches.delete(key);
            }
          });
        });
      }
    });
  }

  // Check if running as standalone app already (installed)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    console.log('[PWA] Running in standalone mode');
    return;
  }

  const pwaBtn = document.getElementById('btn-pwa-install');
  const banner = document.getElementById('pwa-install-banner');
  const btnAction = document.getElementById('btn-install-action');
  const btnDismiss = document.getElementById('btn-install-dismiss');

  // Listen for beforeinstallprompt event (Android Chrome / Edge / etc.)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    if (pwaBtn) pwaBtn.style.display = 'inline-flex';

    // Check if dismissed recently (24 hours)
    const dismissedTime = localStorage.getItem('pwa_install_dismissed');
    const now = Date.now();
    if (!dismissedTime || (now - Number(dismissedTime) > 24 * 3600 * 1000)) {
      if (banner) banner.style.display = 'flex';
    }
  });

  if (pwaBtn) {
    pwaBtn.addEventListener('click', triggerInstallPrompt);
  }

  if (btnAction) {
    btnAction.addEventListener('click', triggerInstallPrompt);
  }

  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      if (banner) banner.style.display = 'none';
      localStorage.setItem('pwa_install_dismissed', String(Date.now()));
    });
  }

  // App installed event
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App successfully installed!');
    deferredInstallPrompt = null;
    if (pwaBtn) pwaBtn.style.display = 'none';
    if (banner) banner.style.display = 'none';
    showToast("🎉 Ilova telefoningizga muvaffaqiyatli o'rnatildi!");
  });
}

function triggerInstallPrompt() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        showToast("📲 O'rnatish boshlandi...");
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }
      deferredInstallPrompt = null;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'none';
    });
  } else {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      const choice = confirm("🍏 iPhone uchun o'rnatish:\n\n1. Safari orqali 'Ulashish' (Share ⎋) tugmasini bosing\n2. 'Bosh ekranga qo'shish' (На экран Домой) ni tanlang\n\nYoki to'g'ridan-to'g'ri 1-klikli WebClip profilini yuklab olishni xohlaysizmi?");
      if (choice) {
        window.location.href = 'MasjidNamozVaqtlari.mobileconfig';
      }
    } else {
      alert("📲 Ilovani o'rnatish uchun:\n\n1. Brauzer menyusini (yuqori o'ng burchakdagi 3 nuqta ⋮) bosing.\n2. \"Ilovani o'rnatish\" yoki \"Bosh ekranga qo'shish\" (Add to Home screen) ni tanlang.\n\nShundan so'ng telefoningiz ish stolida mustaqil ilova belgisi paydo bo'ladi!");
    }
  }
}

/**
 * 18. FOYDALANUVCHI / MASJID MAS'ULI SHAXSIY KABINETI VA AUTORIZATSIYA
 */
const AUTH_USERS_KEY = 'uz_masjid_auth_users_v1';
const CURRENT_USER_KEY = 'uz_masjid_current_user_v1';

let currentUser = null;
let registeredUsers = [];
let pendingEditMosque = null;

// Standart tayyor demo foydalanuvchi (tezkor sinash uchun)
const DEMO_IMAM = {
  id: 'user_hazrati_imom',
  name: 'Abdurashid domla',
  phone: '+998 90 123 45 67',
  password: '123',
  role: 'Imom-xatib',
  mosqueId: 1,
  mosqueName: 'Hazrati Imom jome masjidi',
  mosqueAddress: 'Olmazor tumani, Qorasaroy ko\'chasi',
  history: [
    {
      date: 'Bugun',
      mosqueName: 'Hazrati Imom jome masjidi',
      times: 'Bomdod: 05:40 | Peshin: 12:45 | Asr: 16:30 | Shom: 17:50 | Hufton: 19:15',
      timestamp: Date.now() - 3600000
    }
  ]
};

function initAuth() {
  loadAuthData();
  populateMosqueSelectOptions();
  updateAuthUI();
}

function loadAuthData() {
  try {
    const rawUsers = localStorage.getItem(AUTH_USERS_KEY);
    registeredUsers = rawUsers ? JSON.parse(rawUsers) : [DEMO_IMAM];
    if (!registeredUsers.some(u => u.phone === DEMO_IMAM.phone)) {
      registeredUsers.push(DEMO_IMAM);
    }
  } catch (e) {
    registeredUsers = [DEMO_IMAM];
  }

  try {
    const rawCurrent = localStorage.getItem(CURRENT_USER_KEY);
    currentUser = rawCurrent ? JSON.parse(rawCurrent) : null;
  } catch (e) {
    currentUser = null;
  }
}

function saveCurrentUser() {
  if (currentUser) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    // Foydalanuvchilar ro'yxatida ham yangilash
    const idx = registeredUsers.findIndex(u => u.id === currentUser.id || u.phone === currentUser.phone);
    if (idx !== -1) {
      registeredUsers[idx] = currentUser;
      saveRegisteredUsers();
    }
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
  updateAuthUI();
}

function saveRegisteredUsers() {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(registeredUsers));
}

function populateMosqueSelectOptions() {
  const select = document.getElementById('reg-mosque-select');
  if (!select) return;

  select.innerHTML = '<option value="">-- Masjidni tanlang --</option>';

  const sorted = [...mosquesList].sort((a, b) => a.nomi.localeCompare(b.nomi, 'uz'));
  sorted.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.nomi} (${m.tuman || 'Toshkent'})`;
    select.appendChild(opt);
  });
}

function updateAuthUI() {
  const userLabel = document.getElementById('header-user-label');
  const userBtn = document.getElementById('btn-user-cabinet');
  const imamIndicator = document.getElementById('header-imam-indicator');
  const addMosqueBtn = document.getElementById('btn-add-mosque');

  if (currentUser) {
    const firstName = currentUser.name.split(' ')[0] || "Mas'ul";
    if (userLabel) userLabel.textContent = firstName;
    if (imamIndicator) {
      imamIndicator.style.display = 'inline-flex';
      imamIndicator.title = `${currentUser.name} (${currentUser.role || 'Imom'}) - Boshqaruv portali`;
    }
    if (userBtn) {
      userBtn.classList.add('user-logged-in');
      userBtn.title = `${currentUser.name} (${currentUser.role || 'Imom'}) - Shaxsiy kabinet`;
    }
    if (addMosqueBtn) {
      addMosqueBtn.style.display = (currentUser.role === 'Bosh Administrator' || currentUser.mosqueId === 'all') ? 'inline-flex' : 'none';
    }
  } else {
    if (userLabel) userLabel.textContent = 'Kirish';
    if (imamIndicator) {
      imamIndicator.style.display = 'none';
    }
    if (userBtn) {
      userBtn.classList.remove('user-logged-in');
      userBtn.title = "Masjid mas'uli shaxsiy kabineti";
    }
    if (addMosqueBtn) {
      addMosqueBtn.style.display = 'none';
    }
  }
}

function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tab-btn-login');
  const tabReg = document.getElementById('tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formReg = document.getElementById('form-register');
  const title = document.getElementById('auth-modal-title');
  const subtitle = document.getElementById('auth-modal-subtitle');

  if (tab === 'login') {
    tabLogin?.classList.add('active');
    tabReg?.classList.remove('active');
    if (formLogin) formLogin.style.display = 'flex';
    if (formReg) formReg.style.display = 'none';
    if (title) title.textContent = "Masjid Boshqaruvi";
    if (subtitle) subtitle.textContent = "Namoz vaqtlarini kiritish uchun hisobingizga kiring";
  } else {
    tabLogin?.classList.remove('active');
    tabReg?.classList.add('active');
    if (formLogin) formLogin.style.display = 'none';
    if (formReg) formReg.style.display = 'flex';
    if (title) title.textContent = "Yangi Hisob Yaratish";
    if (subtitle) subtitle.textContent = "Masjid imomi yoki mutasaddisi sifatida ro'yxatdan o'ting";
    populateMosqueSelectOptions();
  }
}

function openAuthModal(tab = 'login', customSubtitle = null) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  switchAuthTab(tab);
  if (customSubtitle) {
    const sub = document.getElementById('auth-modal-subtitle');
    if (sub) sub.textContent = customSubtitle;
  }
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function openCabinetModal() {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  const modal = document.getElementById('cabinet-modal');
  if (!modal) return;

  document.getElementById('cabinet-name').textContent = currentUser.name;
  document.getElementById('cabinet-role').textContent = currentUser.role || 'Masjid vakili';
  document.getElementById('cabinet-phone').textContent = `📞 ${currentUser.phone}`;
  document.getElementById('cabinet-mosque-name').textContent = currentUser.mosqueName || 'Toshkent masjidi';
  document.getElementById('cabinet-mosque-address').textContent = currentUser.mosqueAddress || 'Toshkent shahri';

  renderCabinetHistory();

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeCabinetModal() {
  const modal = document.getElementById('cabinet-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function renderCabinetHistory() {
  const container = document.getElementById('cabinet-history-list');
  if (!container) return;

  const history = currentUser?.history || [];
  if (history.length === 0) {
    container.innerHTML = '<div class="history-empty">Hozircha o\'zgartirishlar tarixi mavjud emas</div>';
    return;
  }

  container.innerHTML = '';
  history.slice(0, 10).forEach(h => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-item-top">
        <span>🕌 ${h.mosqueName}</span>
        <span class="history-item-date">${h.date || 'Yaqinda'}</span>
      </div>
      <div class="history-item-times">${h.times}</div>
    `;
    container.appendChild(item);
  });
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const phone = document.getElementById('login-phone').value.trim();
  const pass = document.getElementById('login-password').value;

  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const user = registeredUsers.find(u => {
    const uPhoneClean = u.phone.replace(/[^0-9+]/g, '');
    return (uPhoneClean === cleanPhone || u.phone === phone) && u.password === pass;
  });

  if (user) {
    currentUser = user;
    saveCurrentUser();
    closeAuthModal();
    showToast(`✅ Xush kelibsiz, ${user.name}!`);

    if (pendingEditMosque) {
      const m = pendingEditMosque;
      pendingEditMosque = null;
      openEditTimesModal(m);
    } else {
      openCabinetModal();
    }
  } else {
    showToast("❌ Telefon raqami yoki parol noto'g'ri!");
  }
}

function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const mosqueId = document.getElementById('reg-mosque-select').value;
  const role = document.getElementById('reg-role').value;
  const pass = document.getElementById('reg-password').value;

  if (!mosqueId) {
    showToast("⚠️ Iltimos, o'zingiz mas'ul bo'lgan masjidni tanlang!");
    return;
  }

  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  if (registeredUsers.some(u => u.phone.replace(/[^0-9+]/g, '') === cleanPhone)) {
    showToast("⚠️ Bu telefon raqami allaqachon ro'yxatdan o'tgan! Kirish bo'limiga o'ting.");
    switchAuthTab('login');
    return;
  }

  const mosqueObj = mosquesList.find(m => String(m.id) === String(mosqueId));
  const mosqueName = mosqueObj ? mosqueObj.nomi : 'Toshkent masjidi';
  const mosqueAddress = mosqueObj ? `${mosqueObj.tuman || 'Toshkent'}, ${mosqueObj.manzil || ''}` : 'Toshkent shahri';

  const newUser = {
    id: 'user_' + Date.now(),
    name,
    phone,
    password: pass,
    role,
    mosqueId,
    mosqueName,
    mosqueAddress,
    history: []
  };

  registeredUsers.push(newUser);
  saveRegisteredUsers();

  currentUser = newUser;
  saveCurrentUser();

  closeAuthModal();
  showToast(`🎉 Xush kelibsiz, ${name}! Hisobingiz muvaffaqiyatli yaratildi.`);

  if (pendingEditMosque) {
    const m = pendingEditMosque;
    pendingEditMosque = null;
    openEditTimesModal(m);
  } else {
    openCabinetModal();
  }
}

function handleDemoLogin() {
  currentUser = DEMO_IMAM;
  saveCurrentUser();
  closeAuthModal();
  showToast("⚡ Demo Imom sifatida tizimga kirdingiz!");

  if (pendingEditMosque) {
    const m = pendingEditMosque;
    pendingEditMosque = null;
    openEditTimesModal(m);
  } else {
    openCabinetModal();
  }
}

function handleLogout() {
  currentUser = null;
  saveCurrentUser();
  closeCabinetModal();
  showToast("🚪 Tizimdan chiqildi.");
}

function handleCabinetEditMyMosque() {
  if (!currentUser) return;
  closeCabinetModal();
  const m = mosquesList.find(item => String(item.id) === String(currentUser.mosqueId)) || mosquesList[0];
  if (m) {
    openMosquePrayerModal(m);
    setTimeout(() => openEditTimesModal(m), 300);
  }
}

function handleCabinetLocateMosque() {
  if (!currentUser) return;
  closeCabinetModal();
  const m = mosquesList.find(item => String(item.id) === String(currentUser.mosqueId));
  if (m && map) {
    map.flyTo([m.lat, m.lng], 16, { duration: 1.2 });
    openMosquePrayerModal(m);
  }
}


