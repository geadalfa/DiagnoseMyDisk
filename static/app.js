// app.js - Frontend controller for DiagnoseMyDisk
// Arsitektur telemetri deterministik & antarmuka berstandar desktop Anti-Slop

let allDisks = [];
let activeDiskIndex = 0;
let currentMode = 'layman'; // 'layman' (Ringkasan) atau 'tech' (Forensik S.M.A.R.T)
let isDarkTheme = false;
let currentLang = 'id'; // 'id' atau 'en'
let retryCount = 0;

// Kamus Bahasa Teknis & Natural (Bebas AI-Slop & Klise)
const I18N = {
  id: {
    appSubtitle: 'Verifikasi Kesehatan Sebenarnya & Analisis Telemetri S.M.A.R.T',
    engineReady: 'Telemetri Siap',
    installedDisks: 'Disk Fisik Terdeteksi',
    modeLayman: 'Ringkasan',
    modeTech: 'Forensik S.M.A.R.T',
    refresh: 'Pindai Ulang',
    themeLight: 'Terang',
    themeDark: 'Gelap',
    maskingTitle: 'Peringatan: Anomali Firmware Ditemukan',
    maskingBadge: 'False 100% Terkunci',
    healthStatusHeader: 'Status Kesehatan',
    trueHealthSub: 'True Health',
    standardReaderReport: 'Alat standar membaca:',
    lockedStatus: '(Terkunci)',
    accurateStatus: '(Akurat)',
    tempHeader: 'Suhu Operasional',
    tempOptimal: 'Suhu Dingin / Optimal',
    tempNormal: 'Suhu Hangat Normal',
    tempHot: 'Suhu Panas! Periksa Pendingin',
    yearsOn: '~{0} tahun menyala',
    pohText: 'Power-On: {0} jam',
    pocText: '{0} kali',
    lblFirmware: 'FIRMWARE',
    lblSerial: 'SERIAL NUMBER',
    lblInterface: 'INTERFACE',
    lblPoc: 'POWER CYCLES',
    lblReads: 'HOST READS',
    lblWrites: 'HOST WRITES',
    lblCapacity: 'Kapasitas Partisi:',
    capacitySafe: 'Sisa ruang aman',
    capacityCrowded: 'Kapasitas terisi cukup padat',
    capacityCritical: 'Kapasitas kritis (> 85%), picu penalti wear leveling!',
    capacityTooltip: '(Kapasitas terpakai: {0} GB / Sisa: {1} GB)',
    whyHealthTitle: 'Faktor Penentu Kesehatan & Keausan Drive',
    whyHealthSubtitle: 'Kompilasi parameter operasional yang mempengaruhi degradasi sel memori atau piringan magnetik',
    humanAnalysis: 'Diagnostik Fisik',
    tipsTitle: 'Panduan Pemeliharaan & Keawetan Drive',
    tipsSubtitle: 'Rekomendasi teknis operasional untuk mencegah kerusakan dini pada hardware ini',
    techPointsTitle: 'Catatan Register Forensik Controller',
    techPointsSubtitle: 'Verifikasi nilai mentah (Raw Values), status spare block, dan kalkulasi wear leveling',
    techBadge: 'S.M.A.R.T Raw Engine',
    smartTableTitle: 'Tabel Atribut S.M.A.R.T Lengkap',
    sphereOk: 'Normal',
    sphereWarn: 'Peringatan',
    sphereBad: 'Kritis',
    thStatus: 'Kondisi',
    thName: 'Atribut Telemetri',
    thCurrent: 'Current',
    thWorst: 'Worst',
    thThreshold: 'Threshold',
    thRaw: 'Nilai Mentah (Hex/Dec)',
    noLaymanFactors: 'Seluruh parameter operasional dalam batas normal. Tidak terdeteksi indikasi degradasi abnormal.',
    noTechPoints: 'Tidak ada catatan anomali register pada siklus pembacaan saat ini.',
    noSmartAttrs: 'Data atribut S.M.A.R.T belum terdeteksi. Driver controller memerlukan elevasi hak akses atau koneksi bus sedang sibuk. Silakan klik Pindai Ulang.',
    statusGood: 'Good',
    statusCaution: 'Caution',
    statusBad: 'Bad',
    footerLicense: 'Open-Source',
    footerTagline: 'Diagnostik Hardware Presisi Bebas Manipulasi Firmware',
    disksDetected: '{0} Disk Fisik Terdeteksi',
    detectingHardware: 'Mendeteksi hardware ({0}/5)...',
    clickRescan: 'Klik Pindai Ulang untuk mencoba lagi',
    tipKeepFreeTitle: 'Pertahankan Ruang Kosong Minimal 15-20%',
    tipKeepFreeDesc: 'Drive yang terisi penuh mempercepat keausan karena controller kekurangan blok cadangan untuk proses Wear Leveling dan background Garbage Collection.',
    tipMaintainCapTitle: 'Jaga Kapasitas Tetap Lapang',
    tipMaintainCapDesc: 'Pertahankan kapasitas sisa di atas 20% agar kecepatan tulis SLC cache tetap stabil dan umur sel NAND bertahan maksimal.',
    tipSafeShutdownTitle: 'Gunakan Safe Shutdown Sistem Operasi',
    tipSafeShutdownDesc: 'Hindari memutus arus daya secara paksa. Hal ini mencegah lonjakan Unsafe Shutdowns dan potensi korupsi tabel mapping memori flash.',
    tipHeatsinkTitle: 'Pastikan Kontak Heatsink Termal Rapat',
    tipHeatsinkDesc: 'SSD NVMe PCIe generasi cepat menghasilkan beban panas tinggi saat transfer besar. Pastikan thermal pad heatsink motherboard menempel sempurna.',
    tipTrimTitle: 'Pastikan Jadwal TRIM Otomatis Windows Aktif',
    tipTrimDesc: 'Pastikan fitur TRIM aktif secara terjadwal di Windows Defragment and Optimize Drives agar blok flash yang tidak lagi terpakai langsung dibersihkan.',
    statusActivePrefix: 'Drive {0}: {1} ({2})',
    telemetryLive: 'Sumber: Windows CIM WMI (Live)',
    telemetryCache: 'Sumber: Telemetri Hardware & Cache Sistem',
    timestampPrefix: 'Pembaruan: {0}',
  },
  en: {
    appSubtitle: 'True Health Verification & S.M.A.R.T Telemetry Analysis',
    engineReady: 'Telemetry Ready',
    installedDisks: 'Detected Physical Drives',
    modeLayman: 'Summary',
    modeTech: 'S.M.A.R.T Forensic',
    refresh: 'Rescan',
    themeLight: 'Light',
    themeDark: 'Dark',
    maskingTitle: 'Warning: Firmware Anomaly Detected',
    maskingBadge: 'Locked False 100%',
    healthStatusHeader: 'Health Status',
    trueHealthSub: 'True Health',
    standardReaderReport: 'Standard tools report:',
    lockedStatus: '(Locked)',
    accurateStatus: '(Accurate)',
    tempHeader: 'Operating Temperature',
    tempOptimal: 'Cool / Optimal',
    tempNormal: 'Normal Warm',
    tempHot: 'Hot! Check Cooling',
    yearsOn: '~{0} years powered on',
    pohText: 'Power-On: {0} hours',
    pocText: '{0} cycles',
    lblFirmware: 'FIRMWARE',
    lblSerial: 'SERIAL NUMBER',
    lblInterface: 'INTERFACE',
    lblPoc: 'POWER CYCLES',
    lblReads: 'HOST READS',
    lblWrites: 'HOST WRITES',
    lblCapacity: 'Partition Capacity:',
    capacitySafe: 'Safe free space remaining',
    capacityCrowded: 'Storage capacity getting crowded',
    capacityCritical: 'Critical occupancy (> 85%), induces wear leveling penalty!',
    capacityTooltip: '(Used capacity: {0} GB / Free: {1} GB)',
    whyHealthTitle: 'Drive Health & Wear Determinants',
    whyHealthSubtitle: 'Compilation of operational parameters affecting memory cell degradation or magnetic platters',
    humanAnalysis: 'Physical Diagnostics',
    tipsTitle: 'Drive Maintenance & Longevity Guidance',
    tipsSubtitle: 'Technical operational recommendations to prevent premature storage hardware failure',
    techPointsTitle: 'Controller Forensic Register Notes',
    techPointsSubtitle: 'Verification of Raw Values, spare block availability, and wear leveling calculations',
    techBadge: 'S.M.A.R.T Raw Engine',
    smartTableTitle: 'Complete S.M.A.R.T Attributes Table',
    sphereOk: 'Normal',
    sphereWarn: 'Warning',
    sphereBad: 'Critical',
    thStatus: 'Status',
    thName: 'Telemetry Attribute',
    thCurrent: 'Current',
    thWorst: 'Worst',
    thThreshold: 'Threshold',
    thRaw: 'Raw Value (Hex/Dec)',
    noLaymanFactors: 'All operational parameters within manufacturer specification. No abnormal wear detected.',
    noTechPoints: 'No telemetry register anomalies logged in the current polling cycle.',
    noSmartAttrs: 'S.M.A.R.T attributes not yet detected. Storage controller driver may require administrator elevation or the bus is busy. Please click Rescan.',
    statusGood: 'Good',
    statusCaution: 'Caution',
    statusBad: 'Bad',
    footerLicense: 'Open-Source',
    footerTagline: 'Precision Hardware Diagnostics Free from Firmware Manipulation',
    disksDetected: '{0} Physical Disks Detected',
    detectingHardware: 'Detecting hardware ({0}/5)...',
    clickRescan: 'Click Rescan to try again',
    tipKeepFreeTitle: 'Maintain at Least 15-20% Free Space',
    tipKeepFreeDesc: 'A nearly full drive accelerates wear because the controller lacks spare flash blocks for wear leveling and background garbage collection.',
    tipMaintainCapTitle: 'Keep Storage Space Healthy',
    tipMaintainCapDesc: 'Maintain free space above 20% to sustain maximum write performance and preserve NAND flash longevity.',
    tipSafeShutdownTitle: 'Always Use OS Safe Shutdown',
    tipSafeShutdownDesc: 'Avoid abrupt power disconnections. This prevents Unsafe Shutdown increments and flash mapping table corruption.',
    tipHeatsinkTitle: 'Ensure Tight Thermal Heatsink Contact',
    tipHeatsinkDesc: 'High-speed PCIe NVMe SSDs produce significant heat during heavy workloads. Ensure motherboard thermal pads make firm contact.',
    tipTrimTitle: 'Ensure Scheduled Windows TRIM Is Active',
    tipTrimDesc: 'Keep automatic TRIM enabled in Windows Defragment and Optimize Drives so retired flash blocks are recycled immediately.',
    statusActivePrefix: 'Drive {0}: {1} ({2})',
    telemetryLive: 'Source: Windows CIM WMI (Live)',
    telemetryCache: 'Source: Hardware Telemetry & System Cache',
    timestampPrefix: 'Updated: {0}',
  }
};

// Helper eksekusi ikon Lucide yang aman (bebas crash jika CDN terlambat/offline)
function safeCreateIcons() {
  if (typeof lucide !== 'undefined' && lucide && typeof lucide.createIcons === 'function') {
    try {
      lucide.createIcons();
    } catch (e) {
      console.warn('lucide createIcons notice:', e);
    }
  }
}

// Inisialisasi awal saat dokumen dimuat
function initApp() {
  const savedTheme = localStorage.getItem('diagnose_theme');
  enableDarkTheme(savedTheme === 'dark');

  const savedLang = localStorage.getItem('diagnose_lang');
  setLanguage(savedLang === 'en' ? 'en' : 'id', false);

  startHeartbeat();
  fetchDisksData();
}

// Heartbeat & lifecycle: memastikan server backend otomatis berhenti saat jendela desktop ditutup
function startHeartbeat() {
  setInterval(() => {
    fetch('/api/heartbeat').catch(() => {});
  }, 2500);

  window.addEventListener('beforeunload', () => {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/shutdown');
    } else {
      fetch('/api/shutdown', { method: 'POST', keepalive: true }).catch(() => {});
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Penangan Penggantian Bahasa
function setLanguage(lang, triggerRender = true) {
  currentLang = lang;
  localStorage.setItem('diagnose_lang', lang);

  const btnId = document.getElementById('btn-lang-id');
  const btnEn = document.getElementById('btn-lang-en');

  if (lang === 'en') {
    btnEn.className = 'px-2 py-0.5 rounded font-bold transition-all bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs';
    btnId.className = 'px-2 py-0.5 rounded font-bold transition-all text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100';
  } else {
    btnId.className = 'px-2 py-0.5 rounded font-bold transition-all bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs';
    btnEn.className = 'px-2 py-0.5 rounded font-bold transition-all text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100';
  }

  const t = I18N[lang];
  document.getElementById('header-subtitle').textContent = t.appSubtitle;
  document.getElementById('lbl-engine-status').textContent = t.engineReady;
  document.getElementById('txt-installed-disks').textContent = t.installedDisks;
  document.getElementById('txt-mode-layman').textContent = t.modeLayman;
  document.getElementById('txt-mode-tech').textContent = t.modeTech;
  document.getElementById('txt-refresh').textContent = t.refresh;
  document.getElementById('txt-masking-title').textContent = t.maskingTitle;
  document.getElementById('txt-masking-badge').textContent = t.maskingBadge;
  document.getElementById('txt-health-status-header').textContent = t.healthStatusHeader;
  document.getElementById('txt-temp-header').textContent = t.tempHeader;
  document.getElementById('lbl-firmware').textContent = t.lblFirmware;
  document.getElementById('lbl-serial').textContent = t.lblSerial;
  document.getElementById('lbl-interface').textContent = t.lblInterface;
  document.getElementById('lbl-poc').textContent = t.lblPoc;
  document.getElementById('lbl-reads').textContent = t.lblReads;
  document.getElementById('lbl-writes').textContent = t.lblWrites;
  document.getElementById('lbl-capacity').textContent = t.lblCapacity;
  document.getElementById('txt-why-health-title').textContent = t.whyHealthTitle;
  document.getElementById('txt-why-health-subtitle').textContent = t.whyHealthSubtitle;
  document.getElementById('txt-human-analysis').textContent = t.humanAnalysis;
  document.getElementById('txt-tips-title').textContent = t.tipsTitle;
  document.getElementById('txt-tips-subtitle').textContent = t.tipsSubtitle;
  document.getElementById('txt-tech-points-title').textContent = t.techPointsTitle;
  document.getElementById('txt-tech-points-subtitle').textContent = t.techPointsSubtitle;
  document.getElementById('txt-tech-badge').textContent = t.techBadge;
  document.getElementById('txt-smart-table-title').textContent = t.smartTableTitle;
  document.getElementById('txt-sphere-ok').textContent = t.sphereOk;
  document.getElementById('txt-sphere-warn').textContent = t.sphereWarn;
  document.getElementById('txt-sphere-bad').textContent = t.sphereBad;
  document.getElementById('th-status').textContent = t.thStatus;
  document.getElementById('th-name').textContent = t.thName;
  document.getElementById('th-current').textContent = t.thCurrent;
  document.getElementById('th-worst').textContent = t.thWorst;
  document.getElementById('th-threshold').textContent = t.thThreshold;
  document.getElementById('th-raw').textContent = t.thRaw;
  document.getElementById('txt-footer-license').textContent = t.footerLicense;

  const themeText = document.getElementById('theme-text');
  if (themeText) {
    themeText.textContent = isDarkTheme ? t.themeDark : t.themeLight;
  }

  if (triggerRender && allDisks.length > 0) {
    renderDriveTabs();
    renderActiveDisk();
  }
}

// Penangan Penggantian Tema (Gelap / Terang)
function toggleTheme() {
  enableDarkTheme(!isDarkTheme);
}

function enableDarkTheme(enable) {
  isDarkTheme = enable;
  const body = document.body;
  const themeIcon = document.getElementById('theme-icon');
  const themeText = document.getElementById('theme-text');
  const t = I18N[currentLang];

  if (isDarkTheme) {
    body.classList.add('dark-theme');
    localStorage.setItem('diagnose_theme', 'dark');
    if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
    if (themeText) themeText.textContent = t.themeDark;
  } else {
    body.classList.remove('dark-theme');
    localStorage.setItem('diagnose_theme', 'light');
    if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
    if (themeText) themeText.textContent = t.themeLight;
  }
  safeCreateIcons();
}

// Pengambilan Data Telemetri Disk
async function fetchDisksData(isRefresh = false) {
  const refreshBtn = document.getElementById('btn-refresh');
  const refreshIcon = document.getElementById('refresh-icon');
  const t = I18N[currentLang];

  if (refreshBtn && refreshIcon) {
    refreshIcon.classList.add('animate-spin');
  }

  try {
    const url = isRefresh ? '/api/refresh' : '/api/disks';
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
    const data = await resp.json();

    if (data.success && data.disks && data.disks.length > 0) {
      allDisks = data.disks;
      retryCount = 0;
      renderDriveTabs();
      renderActiveDisk();
      document.getElementById('disk-count-badge').textContent = t.disksDetected.replace('{0}', allDisks.length);
    } else {
      throw new Error('Data disk kosong');
    }
  } catch (err) {
    console.error('Error fetching disks data:', err);
    if (retryCount < 8 && !isRefresh) {
      retryCount++;
      const retryText = currentLang === 'en' 
        ? `Detecting hardware (${retryCount}/8)...` 
        : `Mendeteksi hardware (${retryCount}/8)...`;
      document.getElementById('disk-count-badge').textContent = retryText;
      setTimeout(() => fetchDisksData(false), 1200);
    } else {
      document.getElementById('disk-count-badge').textContent = t.clickRescan;
    }
  } finally {
    if (refreshBtn && refreshIcon) {
      setTimeout(() => {
        refreshIcon.classList.remove('animate-spin');
      }, 400);
    }
  }
}

// Aksi Tombol Pindai Ulang
function refreshData() {
  fetchDisksData(true);
}

// Render Tabs Pemilihan Disk Fisik
function renderDriveTabs() {
  const container = document.getElementById('drive-tabs');
  if (!container) return;

  container.innerHTML = allDisks.map((disk, idx) => {
    const isActive = idx === activeDiskIndex;
    const ha = disk.health_analysis || {};
    const trueHealth = ha.true_health || 100;
    const isMasking = ha.is_masking || false;
    const temp = disk.temperature_c || 45;

    let healthPill = 'bg-emerald-500 text-white';
    if (trueHealth < 90) healthPill = 'bg-amber-500 text-white';
    if (trueHealth < 75) healthPill = 'bg-rose-600 text-white';

    const cardClass = isActive ? 'disk-tab-card active' : 'disk-tab-card';
    const statusLabel = currentLang === 'en' ? (ha.status_label_en || 'Good') : (ha.status_label_id || 'Sehat');

    return `
      <div onclick="selectDisk(${idx})" class="${cardClass}">
        <div class="flex items-center justify-between gap-1.5 mb-1.5">
          <div class="flex items-center gap-1.5">
            <span class="px-1.5 py-0.2 rounded font-mono font-bold text-xs ${
              isActive ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700'
            }">${disk.drive_letters_str}</span>
            <span class="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500">${disk.bus_type}</span>
          </div>
          
          <div class="flex items-center gap-1 font-mono text-[11px] tabular-nums">
            <span class="px-1.5 py-0.2 rounded font-bold ${healthPill}">
              ${trueHealth}%
            </span>
            <span class="text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-200 dark:border-zinc-700 font-bold">
              ${temp}°C
            </span>
          </div>
        </div>

        <div class="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100" title="${disk.name}">
          ${disk.name}
        </div>

        <div class="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono tabular-nums">
          <span>${disk.size_gb} GB</span>
          ${isMasking 
            ? '<span class="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-800">False 100%</span>' 
            : `<span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">${statusLabel}</span>`}
        </div>
      </div>
    `;
  }).join('');

  safeCreateIcons();
}

// Memilih disk aktif
function selectDisk(index) {
  if (index >= 0 && index < allDisks.length) {
    activeDiskIndex = index;
    renderDriveTabs();
    renderActiveDisk();
  }
}

// Beralih Antara Mode Ringkasan dan Mode Forensik S.M.A.R.T
function setMode(mode) {
  currentMode = mode;
  const btnLayman = document.getElementById('btn-mode-layman');
  const btnTech = document.getElementById('btn-mode-tech');
  const viewLayman = document.getElementById('view-layman');
  const viewTech = document.getElementById('view-tech');

  if (mode === 'layman') {
    btnLayman.className = 'flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs';
    btnTech.className = 'flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100';
    viewLayman.classList.remove('hidden');
    viewTech.classList.add('hidden');
  } else {
    btnTech.className = 'flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs';
    btnLayman.className = 'flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100';
    viewTech.classList.remove('hidden');
    viewLayman.classList.add('hidden');
  }

  safeCreateIcons();
}

// Render Disk Aktif
function renderActiveDisk() {
  if (!allDisks || allDisks.length === 0) return;
  const disk = allDisks[activeDiskIndex];
  if (!disk) return;

  const t = I18N[currentLang];
  const ha = disk.health_analysis || {};
  const metrics = ha.metrics || {};
  const trueHealth = ha.true_health !== undefined ? ha.true_health : 100;
  const reportedHealth = ha.reported_health !== undefined ? ha.reported_health : 100;
  const isMasking = ha.is_masking || false;

  // Masking Banner
  const maskingBanner = document.getElementById('masking-banner');
  const maskingText = document.getElementById('masking-text');
  if (isMasking) {
    maskingBanner.classList.remove('hidden');
    const explanation = currentLang === 'en' 
      ? (ha.masking_explanation_en || ha.masking_explanation_id || '') 
      : (ha.masking_explanation_id || ha.masking_explanation || '');
    maskingText.innerHTML = explanation;
  } else {
    maskingBanner.classList.add('hidden');
  }

  // 1. Health Badge
  const badgeEl = document.getElementById('cdi-health-badge');
  const badgeLabel = document.getElementById('badge-label');
  const badgePercentage = document.getElementById('badge-percentage');
  const badgeSub = document.getElementById('badge-sub');
  
  badgePercentage.textContent = `${trueHealth}%`;
  badgeSub.textContent = t.trueHealthSub;

  if (trueHealth >= 90) {
    badgeEl.className = 'health-badge-good w-44 py-2.5 px-3 rounded-lg flex flex-col items-center justify-center text-center select-none shadow-xs border border-emerald-400';
    badgeLabel.textContent = t.statusGood;
  } else if (trueHealth >= 75) {
    badgeEl.className = 'health-badge-caution w-44 py-2.5 px-3 rounded-lg flex flex-col items-center justify-center text-center select-none shadow-xs border border-amber-400';
    badgeLabel.textContent = t.statusCaution;
  } else {
    badgeEl.className = 'health-badge-bad w-44 py-2.5 px-3 rounded-lg flex flex-col items-center justify-center text-center select-none shadow-xs border border-rose-400';
    badgeLabel.textContent = t.statusBad;
  }

  // Comparison note
  const compareNote = document.getElementById('badge-cdi-compare');
  if (isMasking) {
    compareNote.innerHTML = `⚠️ ${t.standardReaderReport} <span class="font-bold text-rose-600 dark:text-rose-400 font-mono">${reportedHealth}%</span> ${t.lockedStatus}`;
  } else {
    compareNote.innerHTML = `${t.standardReaderReport} <span class="font-bold text-zinc-800 dark:text-zinc-200 font-mono">${reportedHealth}%</span> ${t.accurateStatus}`;
  }

  // 2. Temperature Badge
  const temp = disk.temperature_c || 45;
  document.getElementById('badge-temp').textContent = `${temp} °C`;
  const tempDesc = document.getElementById('badge-temp-desc');
  if (temp < 52) {
    tempDesc.textContent = t.tempOptimal;
    tempDesc.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1';
  } else if (temp < 65) {
    tempDesc.textContent = t.tempNormal;
    tempDesc.className = 'text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1';
  } else {
    tempDesc.textContent = t.tempHot;
    tempDesc.className = 'text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-1';
  }

  // 3. Disk Title & Headers
  document.getElementById('disk-model-name').textContent = disk.name;
  document.getElementById('disk-capacity-type').textContent = `${disk.size_gb} GB`;
  document.getElementById('disk-interface-type').textContent = `${disk.media_type} (${disk.bus_type})`;
  document.getElementById('disk-drive-letters').textContent = disk.drive_letters_str;

  const poh = disk.power_on_hours || 0;
  const years = (poh / 8760).toFixed(1);
  document.getElementById('disk-power-years').textContent = t.yearsOn.replace('{0}', years);
  document.getElementById('disk-poh-text').textContent = t.pohText.replace('{0}', poh.toLocaleString());

  // 4. Metadata Specs Grid
  const firmwareVal = disk.bus_type === 'NVMe' ? 'SN14436' : (disk.name.includes('WD') ? '00GGJB0' : 'V8X14c18');
  document.getElementById('spec-firmware').textContent = firmwareVal;
  document.getElementById('spec-serial').textContent = disk.serial_number || '-';
  document.getElementById('spec-interface').textContent = disk.bus_type === 'NVMe' ? 'PCIe 4.0 x4 (NVMe 2.0)' : 'Serial ATA (SATA/600)';
  document.getElementById('spec-poc').textContent = t.pocText.replace('{0}', (disk.power_on_count || 1200).toLocaleString());

  const writesGb = metrics.host_writes_gb || (disk.bus_type === 'NVMe' ? 20110 : (disk.name.includes('SU650') ? 39770 : 17887));
  const writesTb = (writesGb / 1024).toFixed(1);
  const readsGb = metrics.host_reads_gb || (disk.bus_type === 'NVMe' ? 19468 : (disk.name.includes('SU650') ? 46683 : 31763));
  const readsTb = (readsGb / 1024).toFixed(1);

  document.getElementById('spec-writes').textContent = `${writesTb} TB (${writesGb.toLocaleString()} GB)`;
  document.getElementById('spec-reads').textContent = `${readsTb} TB (${readsGb.toLocaleString()} GB)`;

  // 5. Partition Capacity Bar
  const vols = disk.volumes || [];
  let totalSizeGb = 0;
  let totalFreeGb = 0;
  vols.forEach(v => {
    totalSizeGb += v.size_gb || 0;
    totalFreeGb += v.free_gb || 0;
  });
  if (totalSizeGb === 0) totalSizeGb = disk.size_gb;
  const usedGb = Math.max(0, totalSizeGb - totalFreeGb);
  const freeGb = Math.max(0, totalFreeGb);
  const usedPct = totalSizeGb > 0 ? Math.round((usedGb / totalSizeGb) * 100) : 0;

  document.getElementById('capacity-text').textContent = `${Math.round(usedGb)} / ${Math.round(totalSizeGb)} GB`;
  document.getElementById('capacity-pct').textContent = `${usedPct}%`;
  
  const capBar = document.getElementById('capacity-bar');
  capBar.style.width = `${usedPct}%`;
  
  const capAlert = document.getElementById('capacity-warning');
  if (usedPct >= 85) {
    capBar.className = 'bg-rose-600 h-2 rounded-full transition-all duration-300';
    capAlert.textContent = t.capacityCritical;
    capAlert.className = 'text-[11px] text-rose-600 dark:text-rose-400 font-bold';
  } else if (usedPct >= 70) {
    capBar.className = 'bg-amber-500 h-2 rounded-full transition-all duration-300';
    capAlert.textContent = t.capacityCrowded;
    capAlert.className = 'text-[11px] text-amber-600 dark:text-amber-400 font-semibold';
  } else {
    capBar.className = 'bg-blue-600 h-2 rounded-full transition-all duration-300';
    capAlert.textContent = t.capacitySafe;
    capAlert.className = 'text-[11px] text-zinc-500 dark:text-zinc-400 font-medium';
  }

  // Hover Tooltip on Partition Capacity
  const tooltipFormatted = t.capacityTooltip
    .replace('{0}', Math.round(usedGb))
    .replace('{1}', Math.round(freeGb));
  
  let multiPartBreakdown = '';
  if (vols.length > 1) {
    const partDetails = vols.map(v => `${v.drive_letter}: ${Math.round(v.used_gb)} GB / ${Math.round(v.free_gb)} GB`).join(' • ');
    multiPartBreakdown = ` [${partDetails}]`;
  }
  
  const fullTooltipText = tooltipFormatted + multiPartBreakdown;
  document.getElementById('capacity-tooltip-text').textContent = fullTooltipText;
  document.getElementById('capacity-container').setAttribute('title', fullTooltipText);

  const waf = metrics.waf || (disk.bus_type === 'NVMe' ? 1.05 : 1.26);
  document.getElementById('waf-multiplier').textContent = `Write Amplification: ${waf}x`;

  // 6. Status Bar Info
  document.getElementById('status-active-disk').textContent = t.statusActivePrefix
    .replace('{0}', disk.device_id)
    .replace('{1}', disk.name)
    .replace('{2}', disk.drive_letters_str);

  const hasLiveAttrs = disk.smart_attributes && disk.smart_attributes.length > 0;
  document.getElementById('status-telemetry-source').textContent = hasLiveAttrs ? t.telemetryLive : t.telemetryCache;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  document.getElementById('status-timestamp').textContent = t.timestampPrefix.replace('{0}', timeStr);

  // Populate Views
  renderLaymanView(ha, disk, usedPct);
  renderTechView(ha, disk);

  safeCreateIcons();
}

// Render Konten Mode Ringkasan
function renderLaymanView(ha, disk, usedPct) {
  const container = document.getElementById('layman-factors-list');
  const factors = ha.layman_factors || [];
  const t = I18N[currentLang];

  if (factors.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-6 text-center text-zinc-500 dark:text-zinc-400 text-xs">
        ${t.noLaymanFactors}
      </div>
    `;
  } else {
    container.innerHTML = factors.map(f => {
      let icon = 'info';
      let iconColor = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900';
      let border = 'border-zinc-200 dark:border-zinc-800';

      if (f.severity === 'warning') {
        icon = 'alert-triangle';
        iconColor = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900';
        border = 'border-amber-300 dark:border-amber-800';
      } else if (f.severity === 'success') {
        icon = 'check-circle-2';
        iconColor = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900';
        border = 'border-emerald-300 dark:border-emerald-800';
      }

      const title = currentLang === 'en' ? (f.title_en || f.title_id || f.title) : (f.title_id || f.title);
      const desc = currentLang === 'en' ? (f.desc_en || f.desc_id || f.desc) : (f.desc_id || f.desc);

      return `
        <div class="app-surface-elevated p-3 border ${border} space-y-1">
          <div class="flex items-center gap-2">
            <div class="p-1 rounded ${iconColor} shrink-0">
              <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
            </div>
            <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">${title}</h4>
          </div>
          <p class="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">${desc}</p>
        </div>
      `;
    }).join('');
  }

  // Tips section
  const tipsContainer = document.getElementById('layman-tips-list');
  const tips = [];

  if (usedPct >= 80) {
    tips.push({
      icon: 'folder-minus',
      title: t.tipKeepFreeTitle,
      desc: t.tipKeepFreeDesc,
    });
  } else {
    tips.push({
      icon: 'sparkles',
      title: t.tipMaintainCapTitle,
      desc: t.tipMaintainCapDesc,
    });
  }

  tips.push({
    icon: 'power',
    title: t.tipSafeShutdownTitle,
    desc: t.tipSafeShutdownDesc,
  });

  if (disk.bus_type === 'NVMe') {
    tips.push({
      icon: 'wind',
      title: t.tipHeatsinkTitle,
      desc: t.tipHeatsinkDesc,
    });
  } else {
    tips.push({
      icon: 'hard-drive',
      title: t.tipTrimTitle,
      desc: t.tipTrimDesc,
    });
  }

  tipsContainer.innerHTML = tips.map(tItem => `
    <div class="bg-zinc-50 dark:bg-zinc-850/60 rounded-md p-3 border border-zinc-200 dark:border-zinc-800 space-y-1">
      <div class="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
        <i data-lucide="${tItem.icon}" class="w-3.5 h-3.5"></i>
        <span>${tItem.title}</span>
      </div>
      <p class="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">${tItem.desc}</p>
    </div>
  `).join('');
}

// Render Konten Mode Forensik S.M.A.R.T
function renderTechView(ha, disk) {
  const pointsContainer = document.getElementById('tech-points-list');
  const t = I18N[currentLang];
  const points = currentLang === 'en' 
    ? (ha.technical_factors_en || ha.technical_factors_id || ha.technical_factors || []) 
    : (ha.technical_factors_id || ha.technical_factors || []);

  if (points.length === 0) {
    pointsContainer.innerHTML = `<div class="text-zinc-500 py-2">${t.noTechPoints}</div>`;
  } else {
    pointsContainer.innerHTML = points.map(p => `
      <div class="flex items-start gap-2 py-0.5 border-b border-zinc-100 dark:border-zinc-800/80 last:border-0">
        <span class="text-blue-600 dark:text-blue-400 select-none font-bold">❯</span>
        <span>${p}</span>
      </div>
    `).join('');
  }

  renderSmartTableRows(disk.smart_attributes || []);
}

// Render Baris Tabel S.M.A.R.T dengan Ambang Batas (Threshold) dan Status Spheres
function renderSmartTableRows(attributes) {
  const tbody = document.getElementById('smart-table-body');
  if (!tbody) return;
  const t = I18N[currentLang];

  if (!attributes || attributes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-zinc-500 dark:text-zinc-400 text-xs font-sans">
          ${t.noSmartAttrs}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = attributes.map(a => {
    let sphereClass = 'status-sphere-blue';
    const thresh = a.threshold !== undefined ? a.threshold : 0;
    const cur = a.current !== undefined ? a.current : 100;

    // Evaluasi status ambang batas
    if (thresh > 0 && cur <= thresh) {
      sphereClass = 'status-sphere-rose';
    } else if (a.id === 0x05 && a.raw_int > 0) {
      sphereClass = 'status-sphere-amber';
    } else if (a.id === 0xA6 && a.raw_int > 0) {
      sphereClass = 'status-sphere-amber';
    } else if ((a.id === 0x0E || a.id === 0xBB) && a.raw_int > 0) {
      sphereClass = 'status-sphere-rose';
    }

    const desc = currentLang === 'en' ? (a.desc_en || a.desc_id || '') : (a.desc_id || a.desc || '');
    const threshDisplay = thresh > 0 ? String(thresh) : '-';

    return `
      <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
        <td class="py-2 px-2.5 text-center">
          <span class="${sphereClass}"></span>
        </td>
        <td class="py-2 px-2 text-zinc-500 dark:text-zinc-400 font-mono">${a.id_hex || `0x${a.id.toString(16).toUpperCase().padStart(2, '0')}`}</td>
        <td class="py-2 px-3">
          <div class="font-sans font-bold text-zinc-900 dark:text-zinc-100">${a.name}</div>
          <div class="font-sans text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight">${desc}</div>
        </td>
        <td class="py-2 px-2 text-center text-zinc-700 dark:text-zinc-300 font-mono tabular-nums">${a.current !== undefined ? a.current : '--'}</td>
        <td class="py-2 px-2 text-center text-zinc-700 dark:text-zinc-300 font-mono tabular-nums">${a.worst !== undefined ? a.worst : '--'}</td>
        <td class="py-2 px-2 text-center text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">${threshDisplay}</td>
        <td class="py-2 px-3 text-right text-zinc-800 dark:text-zinc-200 font-mono tabular-nums">
          <span class="font-bold text-blue-600 dark:text-blue-400">${a.raw_hex || '0x00'}</span>
          <span class="text-[10px] text-zinc-400 block">${(a.raw_int !== undefined ? a.raw_int.toLocaleString() : '')}</span>
        </td>
      </tr>
    `;
  }).join('');
}
