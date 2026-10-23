// app.js - Frontend controller for DiagnoseMyDisk
// Arsitektur telemetri deterministik & antarmuka berstandar desktop Anti-Slop

let allDisks = [];
let activeDiskIndex = 0;
let currentMode = 'layman'; // 'layman', 'tech', atau 'scanner'
let isDarkTheme = false;
let currentLang = 'id'; // 'id' atau 'en'
let retryCount = 0;
let isAdminMode = true;

// State Pemindaian Sektor (Bad Sector Scanner)
const TOTAL_SCAN_BLOCKS = 200;
let isScanning = false;
let currentScanBlock = 0;
let scanStats = {
  excellent: 0,
  good: 0,
  slow: 0,
  weak: 0,
  bad: 0,
};
let scanBlocksData = [];

// Kamus Bahasa Teknis & Natural (Bebas AI-Slop & Klise)
const I18N = {
  id: {
    appSubtitle: 'Verifikasi Kesehatan Sebenarnya, Pindai Bad Sector & Telemetri S.M.A.R.T',
    engineReady: 'Telemetri Siap',
    installedDisks: 'Disk Fisik Terdeteksi',
    modeLayman: 'Ringkasan',
    modeTech: 'Forensik S.M.A.R.T',
    modeScanner: 'Pindai Sektor & Pemulihan',
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
    detectingHardware: 'Mendeteksi hardware ({0}/8)...',
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
    txtSurfaceTitle: 'Peta Verifikasi Permukaan Sektor (LBA Map)',
    txtSurfaceSubtitle: 'Pemindaian non-destruktif mengukur kecepatan respon dan mendeteksi bad sector / blok lemah',
    txtRepairTitle: 'Alat Pemulihan & Reparasi Sistem (Drive Doctor)',
    txtRepairSubtitle: 'Perbaikan struktur cluster sistem file, force remap firmware, dan optimasi sel flash NAND',
    scanStart: 'Mulai Pemindaian Sektor',
    scanPause: 'Jeda Pemindaian',
    scanResume: 'Lanjutkan Pemindaian',
  },
  en: {
    appSubtitle: 'True Health Verification, Bad Sector Scan & S.M.A.R.T Telemetry',
    engineReady: 'Telemetry Ready',
    installedDisks: 'Detected Physical Drives',
    modeLayman: 'Summary',
    modeTech: 'S.M.A.R.T Forensic',
    modeScanner: 'Bad Sector & Repair',
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
    detectingHardware: 'Detecting hardware ({0}/8)...',
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
    txtSurfaceTitle: 'Surface Sector Verification Map (LBA Map)',
    txtSurfaceSubtitle: 'Non-destructive read benchmark measuring latency and spotting bad sectors / weak blocks',
    txtRepairTitle: 'System Recovery & Repair Tools (Drive Doctor)',
    txtRepairSubtitle: 'Filesystem cluster repair, firmware force remapping, and NAND flash cell optimization',
    scanStart: 'Start Surface Scan',
    scanPause: 'Pause Scan',
    scanResume: 'Resume Scan',
  }
};

// Helper eksekusi ikon Lucide yang aman
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
  const shouldUseDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  enableDarkTheme(shouldUseDark);

  const savedLang = localStorage.getItem('diagnose_lang');
  setLanguage(savedLang === 'en' ? 'en' : 'id', false);

  initSurfaceGrid();
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
  document.getElementById('txt-installed-disks').textContent = t.installedDisks;
  document.getElementById('txt-mode-layman').textContent = t.modeLayman;
  document.getElementById('txt-mode-tech').textContent = t.modeTech;
  document.getElementById('txt-mode-scanner').textContent = t.modeScanner;
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
  document.getElementById('txt-surface-title').textContent = t.txtSurfaceTitle;
  document.getElementById('txt-surface-subtitle').textContent = t.txtSurfaceSubtitle;
  document.getElementById('txt-repair-title').textContent = t.txtRepairTitle;
  document.getElementById('txt-repair-subtitle').textContent = t.txtRepairSubtitle;

  const themeText = document.getElementById('theme-text');
  if (themeText) {
    themeText.textContent = isDarkTheme ? t.themeDark : t.themeLight;
  }

  const scanBtnText = document.getElementById('txt-scan-btn');
  if (scanBtnText) {
    scanBtnText.textContent = isScanning ? t.scanPause : (currentScanBlock > 0 && currentScanBlock < TOTAL_SCAN_BLOCKS ? t.scanResume : t.scanStart);
  }

  if (triggerRender && allDisks.length > 0) {
    renderDriveTabs();
    renderActiveDisk();
  }
}

// Penangan Penggantian Tema (Gelap / Terang) Modern Anti-Slop
function toggleTheme() {
  enableDarkTheme(!isDarkTheme);
}

function enableDarkTheme(enable) {
  isDarkTheme = enable;
  const root = document.documentElement;
  const body = document.body;
  const themeIcon = document.getElementById('theme-icon');
  const themeText = document.getElementById('theme-text');
  const t = I18N[currentLang] || I18N.id;

  if (isDarkTheme) {
    root.classList.add('dark');
    body.classList.add('dark');
    body.classList.add('dark-theme');
    localStorage.setItem('diagnose_theme', 'dark');
    if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
    if (themeText) themeText.textContent = t.themeDark;
  } else {
    root.classList.remove('dark');
    body.classList.remove('dark');
    body.classList.remove('dark-theme');
    localStorage.setItem('diagnose_theme', 'light');
    if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
    if (themeText) themeText.textContent = t.themeLight;
  }
  safeCreateIcons();
}

// Penangan Pergantian Tab Mode (Ringkasan / Forensik / Scanner)
function setMode(mode) {
  currentMode = mode;
  const btnLayman = document.getElementById('btn-mode-layman');
  const btnTech = document.getElementById('btn-mode-tech');
  const btnScanner = document.getElementById('btn-mode-scanner');
  const viewLayman = document.getElementById('view-layman');
  const viewTech = document.getElementById('view-tech');
  const viewScanner = document.getElementById('view-scanner');

  const activeClass = 'flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs';
  const inactiveClass = 'flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100';

  btnLayman.className = mode === 'layman' ? activeClass : inactiveClass;
  btnTech.className = mode === 'tech' ? activeClass : inactiveClass;
  btnScanner.className = mode === 'scanner' ? activeClass : inactiveClass;

  viewLayman.classList.toggle('hidden', mode !== 'layman');
  viewTech.classList.toggle('hidden', mode !== 'tech');
  viewScanner.classList.toggle('hidden', mode !== 'scanner');

  safeCreateIcons();
}

// Relaunch as Administrator Action
async function relaunchAsAdmin() {
  try {
    const resp = await fetch('/api/relaunch_admin', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      alert(currentLang === 'en' ? 'Restarting application with Administrator privileges...' : 'Memulai ulang aplikasi dengan hak Administrator...');
    }
  } catch (err) {
    console.error('Error relaunching:', err);
  }
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

    // Cek status hak akses Administrator
    isAdminMode = data.is_admin !== false;
    const adminBanner = document.getElementById('non-admin-banner');
    const adminDot = document.getElementById('admin-dot');
    const lblAdmin = document.getElementById('lbl-admin-status');

    if (isAdminMode) {
      if (adminBanner) adminBanner.classList.add('hidden');
      if (adminDot) adminDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
      if (lblAdmin) {
        lblAdmin.textContent = 'Admin OK';
        lblAdmin.className = 'text-[11px] font-medium text-emerald-600 dark:text-emerald-400 font-mono';
      }
    } else {
      if (adminBanner) adminBanner.classList.remove('hidden');
      if (adminDot) adminDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';
      if (lblAdmin) {
        lblAdmin.textContent = 'Non-Admin';
        lblAdmin.className = 'text-[11px] font-medium text-amber-600 dark:text-amber-400 font-mono';
      }
    }

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

function refreshData() {
  fetchDisksData(true);
}

// Render Tab Pilihan Drive Fisik
function renderDriveTabs() {
  const container = document.getElementById('drive-tabs');
  if (!container) return;

  container.innerHTML = allDisks.map((disk, idx) => {
    const isActive = idx === activeDiskIndex;
    const ha = disk.health_analysis || {};
    const trueHealth = ha.true_health !== undefined ? ha.true_health : 100;
    const reportedHealth = ha.reported_health !== undefined ? ha.reported_health : 100;
    const isMasking = ha.is_masking || false;

    let badgeClass = 'health-badge-good';
    let statusLabel = 'Good';

    if (trueHealth < 60) {
      badgeClass = 'health-badge-bad';
      statusLabel = 'Bad';
    } else if (trueHealth < 90 || isMasking) {
      badgeClass = 'health-badge-caution';
      statusLabel = 'Caution';
    }

    const driveLetters = disk.drive_letters_str || '-';
    const sizeGb = disk.size_gb || 0;

    return `
      <div onclick="selectDisk(${idx})" class="disk-tab-card ${isActive ? 'active' : ''}">
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-0.5 truncate">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">${disk.name}</span>
            </div>
            <div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-1.5">
              <span class="font-bold text-blue-600 dark:text-blue-400">${sizeGb} GB</span>
              <span>•</span>
              <span>${disk.bus_type}</span>
              <span>•</span>
              <span class="font-bold text-zinc-700 dark:text-zinc-300">${driveLetters}</span>
            </div>
          </div>
          
          <div class="shrink-0 flex flex-col items-end">
            <span class="${badgeClass} px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight">
              ${trueHealth}%
            </span>
            ${isMasking ? '<span class="text-[9px] text-rose-600 font-bold tracking-tighter">MASKED</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function selectDisk(index) {
  if (index === activeDiskIndex) return;
  activeDiskIndex = index;
  renderDriveTabs();
  renderActiveDisk();
  resetSurfaceGrid();
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
    maskingText.textContent = currentLang === 'en' 
      ? (ha.masking_explanation_en || ha.masking_explanation_id || '')
      : (ha.masking_explanation_id || '');
  } else {
    maskingBanner.classList.add('hidden');
  }

  // Health Metric Badge
  const badgeHealth = document.getElementById('cdi-health-badge');
  const badgeLabel = document.getElementById('badge-label');
  const badgePct = document.getElementById('badge-percentage');
  const cdiClaimVal = document.getElementById('cdi-claim-val');
  const badgeCdiCompare = document.getElementById('badge-cdi-compare');

  if (badgePct) badgePct.textContent = `${trueHealth}%`;

  if (badgeCdiCompare) {
    if (isMasking) {
      badgeCdiCompare.innerHTML = `${t.standardReaderReport} <span id="cdi-claim-val" class="text-zinc-900 dark:text-zinc-100 font-mono font-bold">${reportedHealth}%</span> <span class="text-rose-600 font-bold">${t.lockedStatus}</span>`;
    } else {
      badgeCdiCompare.innerHTML = `${t.standardReaderReport} <span id="cdi-claim-val" class="text-zinc-900 dark:text-zinc-100 font-mono font-bold">${reportedHealth}%</span> <span class="text-emerald-600 font-bold">${t.accurateStatus}</span>`;
    }
  } else if (cdiClaimVal) {
    cdiClaimVal.textContent = `${reportedHealth}%`;
  }

  badgeHealth.className = 'w-44 py-2.5 px-3 rounded-lg flex flex-col items-center justify-center text-center select-none shadow-xs border transition-all';
  if (trueHealth < 60) {
    badgeHealth.classList.add('health-badge-bad', 'border-rose-600');
    badgeLabel.textContent = t.statusBad;
  } else if (trueHealth < 90 || isMasking) {
    badgeHealth.classList.add('health-badge-caution', 'border-amber-500');
    badgeLabel.textContent = t.statusCaution;
  } else {
    badgeHealth.classList.add('health-badge-good', 'border-emerald-600');
    badgeLabel.textContent = t.statusGood;
  }

  // Suhu Operasional
  const temp = disk.temperature_c || 40;
  document.getElementById('badge-temp').textContent = `${temp} °C`;
  const badgeTempDesc = document.getElementById('badge-temp-desc');
  if (temp < 45) {
    badgeTempDesc.textContent = t.tempOptimal;
    badgeTempDesc.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1';
  } else if (temp <= 55) {
    badgeTempDesc.textContent = t.tempNormal;
    badgeTempDesc.className = 'text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1';
  } else {
    badgeTempDesc.textContent = t.tempHot;
    badgeTempDesc.className = 'text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-1 animate-pulse';
  }

  // Header Drive Hero
  document.getElementById('disk-model-name').textContent = disk.name;
  document.getElementById('disk-capacity-type').textContent = `${disk.size_gb} GB`;
  document.getElementById('disk-interface-type').textContent = `${disk.media_type} (${disk.bus_type})`;
  document.getElementById('disk-drive-letters').textContent = disk.drive_letters_str || '-';

  // Jam Operasional
  const poh = disk.power_on_hours || 0;
  const years = (poh / 8760).toFixed(1);
  document.getElementById('disk-power-years').textContent = t.yearsOn.replace('{0}', years);
  document.getElementById('disk-poh-text').textContent = t.pohText.replace('{0}', poh.toLocaleString());

  // Spesifikasi Teknis
  document.getElementById('spec-firmware').textContent = disk.firmware || '-';
  document.getElementById('spec-serial').textContent = disk.serial_number || '-';
  const interfaceSpeed = disk.bus_type === 'NVMe' ? 'PCIe NVMe' : `${disk.bus_type || 'SATA'} 6.0 Gb/s`;
  document.getElementById('spec-interface').textContent = interfaceSpeed;
  document.getElementById('spec-poc').textContent = disk.power_on_count !== undefined ? t.pocText.replace('{0}', disk.power_on_count.toLocaleString()) : '-';

  const hostWritesTb = metrics.host_writes_tb !== undefined ? `${metrics.host_writes_tb} TB` : '-';
  const hostReadsTb = metrics.host_reads_tb !== undefined ? `${metrics.host_reads_tb} TB` : '-';
  document.getElementById('spec-reads').textContent = hostReadsTb;
  document.getElementById('spec-writes').textContent = hostWritesTb;

  // Kapasitas Partisi
  const volumes = disk.volumes || [];
  let totalCapGb = 0;
  let totalUsedGb = 0;
  let totalFreeGb = 0;

  volumes.forEach(v => {
    totalCapGb += (v.size_gb || 0);
    totalUsedGb += (v.used_gb || 0);
    totalFreeGb += (v.free_gb || 0);
  });

  const usedPct = totalCapGb > 0 ? Math.round((totalUsedGb / totalCapGb) * 100) : 75;
  document.getElementById('capacity-text').textContent = `${totalUsedGb.toFixed(1)} / ${totalCapGb.toFixed(1)} GB`;
  document.getElementById('capacity-pct').textContent = `${usedPct}%`;

  const capBar = document.getElementById('capacity-bar');
  capBar.style.width = `${Math.min(100, usedPct)}%`;

  const capWarn = document.getElementById('capacity-warning');
  if (usedPct >= 85) {
    capBar.className = 'bg-rose-500 h-2 rounded-full transition-all duration-300';
    capWarn.textContent = t.capacityCritical;
    capWarn.className = 'text-rose-600 font-bold';
  } else if (usedPct >= 70) {
    capBar.className = 'bg-amber-500 h-2 rounded-full transition-all duration-300';
    capWarn.textContent = t.capacityCrowded;
    capWarn.className = 'text-amber-600 font-medium';
  } else {
    capBar.className = 'bg-blue-600 h-2 rounded-full transition-all duration-300';
    capWarn.textContent = t.capacitySafe;
    capWarn.className = 'text-zinc-500 dark:text-zinc-400';
  }

  const tooltipText = document.getElementById('capacity-tooltip-text');
  if (tooltipText) {
    tooltipText.textContent = t.capacityTooltip.replace('{0}', totalUsedGb.toFixed(1)).replace('{1}', totalFreeGb.toFixed(1));
  }

  // Status Bar
  document.getElementById('status-active-disk').textContent = t.statusActivePrefix.replace('{0}', disk.device_id).replace('{1}', disk.name).replace('{2}', disk.drive_letters_str);
  document.getElementById('status-timestamp').textContent = t.timestampPrefix.replace('{0}', new Date().toLocaleTimeString());

  // Render Subviews
  renderLaymanView(ha, disk);
  renderTechView(ha, disk);
  safeCreateIcons();
}

// Render Konten Mode Ringkasan (Layman)
function renderLaymanView(ha, disk) {
  const factorsContainer = document.getElementById('layman-factors-list');
  const tipsContainer = document.getElementById('layman-tips-list');
  const t = I18N[currentLang];

  const factors = ha.layman_factors || [];
  if (factors.length === 0) {
    factorsContainer.innerHTML = `<div class="text-zinc-500 text-xs py-2 col-span-full">${t.noLaymanFactors}</div>`;
  } else {
    factorsContainer.innerHTML = factors.map(f => {
      let icon = 'info';
      let iconColor = 'text-blue-500';
      let cardBg = 'bg-zinc-50 dark:bg-zinc-850';

      if (f.severity === 'danger' || f.severity === 'critical') {
        icon = 'alert-octagon';
        iconColor = 'text-rose-500';
        cardBg = 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40';
      } else if (f.severity === 'warning') {
        icon = 'alert-triangle';
        iconColor = 'text-amber-500';
        cardBg = 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40';
      } else if (f.severity === 'success') {
        icon = 'check-circle-2';
        iconColor = 'text-emerald-500';
      }

      const title = currentLang === 'en' ? (f.title_en || f.title_id || f.title) : (f.title_id || f.title);
      const desc = currentLang === 'en' ? (f.desc_en || f.desc_id || f.desc) : (f.desc_id || f.desc);

      return `
        <div class="${cardBg} rounded-md p-3 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
          <div class="flex items-center gap-2 ${iconColor} text-xs font-bold">
            <i data-lucide="${icon}" class="w-3.5 h-3.5 shrink-0"></i>
            <span class="text-zinc-900 dark:text-zinc-100">${title}</span>
          </div>
          <p class="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">${desc}</p>
        </div>
      `;
    }).join('');
  }

  // Tips Pemeliharaan
  const tips = [
    {
      icon: 'pie-chart',
      title: t.tipKeepFreeTitle,
      desc: t.tipKeepFreeDesc,
    },
    {
      icon: 'power-off',
      title: t.tipSafeShutdownTitle,
      desc: t.tipSafeShutdownDesc,
    }
  ];

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
    <div class="bg-zinc-50 dark:bg-zinc-850 rounded-md p-3 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
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

// Render Baris Tabel S.M.A.R.T
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
      <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-850/60 transition-colors">
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

// =========================================================================
// FITUR BAD SECTOR SURFACE SCANNER & DRIVE DOCTOR (Yudha & Alfa Request)
// =========================================================================

function initSurfaceGrid() {
  const grid = document.getElementById('surface-grid');
  if (!grid) return;

  grid.innerHTML = '';
  scanBlocksData = [];

  for (let i = 0; i < TOTAL_SCAN_BLOCKS; i++) {
    const blockEl = document.createElement('div');
    blockEl.id = `block-${i}`;
    blockEl.className = 'surface-block block-unscanned';
    blockEl.setAttribute('data-index', i);

    blockEl.addEventListener('mouseenter', (e) => showSurfaceTooltip(e, i));
    blockEl.addEventListener('mouseleave', hideSurfaceTooltip);

    grid.appendChild(blockEl);
    scanBlocksData.push({
      index: i,
      status: 'unscanned',
      latency_ms: 0,
      speed_mb_s: 0,
      offset_gb: 0,
      error: null,
    });
  }
}

function showSurfaceTooltip(e, blockIndex) {
  const tooltip = document.getElementById('surface-tooltip');
  if (!tooltip) return;

  const b = scanBlocksData[blockIndex];
  if (!b) return;

  let statusText = 'Belum Dipindai';
  if (b.status === 'excellent') statusText = 'Prima (<10ms)';
  else if (b.status === 'good') statusText = 'Baik (<50ms)';
  else if (b.status === 'slow') statusText = 'Cukup Lambat (50-150ms)';
  else if (b.status === 'weak') statusText = 'Sangat Lambat (150-500ms)';
  else if (b.status === 'bad') statusText = `Bad Sector / Error: ${b.error || '>500ms'}`;

  tooltip.innerHTML = `
    <div class="font-bold text-zinc-200">Blok #${blockIndex + 1} / ${TOTAL_SCAN_BLOCKS}</div>
    <div class="text-[10px] text-zinc-400">Offset: ~${b.offset_gb} GB</div>
    <div class="text-[10px] text-zinc-300">Latensi: <span class="font-bold text-blue-400">${b.latency_ms} ms</span></div>
    <div class="text-[10px] text-zinc-300">Kecepatan: <span class="font-bold text-emerald-400">${b.speed_mb_s} MB/s</span></div>
    <div class="text-[10px] text-zinc-400 mt-0.5">Status: <span class="font-bold text-zinc-100">${statusText}</span></div>
  `;
  tooltip.classList.remove('hidden');
}

function hideSurfaceTooltip() {
  const tooltip = document.getElementById('surface-tooltip');
  if (tooltip) tooltip.classList.add('hidden');
}

function resetSurfaceGrid() {
  isScanning = false;
  currentScanBlock = 0;
  scanStats = { excellent: 0, good: 0, slow: 0, weak: 0, bad: 0 };
  updateScanStatsUI();

  const progressBar = document.getElementById('scan-progress-bar');
  const progressText = document.getElementById('scan-progress-text');
  const speedText = document.getElementById('scan-speed');
  const locText = document.getElementById('scan-location');

  if (progressBar) progressBar.style.width = '0%';
  if (progressText) progressText.textContent = '0%';
  if (speedText) speedText.textContent = '-- MB/s';
  if (locText) locText.textContent = '-- GB';

  const t = I18N[currentLang];
  const btn = document.getElementById('txt-scan-btn');
  const icon = document.getElementById('icon-scan-btn');
  if (btn) btn.textContent = t.scanStart;
  if (icon) icon.setAttribute('data-lucide', 'play');

  initSurfaceGrid();
  safeCreateIcons();
}

function toggleScanProcess() {
  const t = I18N[currentLang];
  const btn = document.getElementById('txt-scan-btn');
  const icon = document.getElementById('icon-scan-btn');

  if (isScanning) {
    // Jeda Pemindaian
    isScanning = false;
    if (btn) btn.textContent = t.scanResume;
    if (icon) icon.setAttribute('data-lucide', 'play');
    safeCreateIcons();
  } else {
    // Mulai atau Lanjutkan Pemindaian
    if (currentScanBlock >= TOTAL_SCAN_BLOCKS) {
      resetSurfaceGrid();
    }
    isScanning = true;
    if (btn) btn.textContent = t.scanPause;
    if (icon) icon.setAttribute('data-lucide', 'pause');
    safeCreateIcons();
    appendTerminalLog(`[START] Memulai pemindaian permukaan sektor pada PhysicalDrive...`);
    executeScanStep();
  }
}

async function executeScanStep() {
  if (!isScanning) return;
  if (currentScanBlock >= TOTAL_SCAN_BLOCKS) {
    // Selesai Pemindaian
    isScanning = false;
    const t = I18N[currentLang];
    const btn = document.getElementById('txt-scan-btn');
    const icon = document.getElementById('icon-scan-btn');
    if (btn) btn.textContent = t.scanStart;
    if (icon) icon.setAttribute('data-lucide', 'play');
    safeCreateIcons();
    appendTerminalLog(`[SELESAI] Pemindaian selesai: ${scanStats.bad} bad sectors terdeteksi, ${scanStats.weak} blok lemah.`);
    return;
  }

  const disk = allDisks[activeDiskIndex] || {};
  const rawDevId = String(disk.device_id || '0');
  const match = rawDevId.match(/\d+/);
  const diskIndex = match ? parseInt(match[0], 10) : 0;
  const diskSize = Math.floor((disk.size_gb || 240) * (1024 ** 3));
  const chunkSize = 5;

  // Sorot blok aktif yang sedang dipindai
  const prevActive = document.querySelector('.surface-block.block-active');
  if (prevActive) prevActive.classList.remove('block-active');

  const curEl = document.getElementById(`block-${currentScanBlock}`);
  if (curEl) curEl.classList.add('block-active');

  try {
    const url = `/api/scan_chunk?disk_index=${diskIndex}&start_block=${currentScanBlock}&count=${chunkSize}&total_blocks=${TOTAL_SCAN_BLOCKS}&disk_size=${diskSize}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
    const data = await resp.json();

    if (data.success && data.blocks) {
      data.blocks.forEach(b => {
        const bIndex = b.block;
        const el = document.getElementById(`block-${bIndex}`);
        if (!el) return;

        el.className = 'surface-block';
        if (b.status === 'excellent') {
          el.classList.add('block-excellent');
          scanStats.excellent++;
        } else if (b.status === 'good') {
          el.classList.add('block-good');
          scanStats.good++;
        } else if (b.status === 'slow') {
          el.classList.add('block-slow');
          scanStats.slow++;
        } else if (b.status === 'weak') {
          el.classList.add('block-weak');
          scanStats.weak++;
        } else {
          el.classList.add('block-bad');
          scanStats.bad++;
        }

        scanBlocksData[bIndex] = {
          index: bIndex,
          status: b.status,
          latency_ms: b.latency_ms,
          speed_mb_s: b.speed_mb_s,
          offset_gb: b.offset_gb,
          error: b.error,
        };

        // Update speedometer & location
        document.getElementById('scan-speed').textContent = `${b.speed_mb_s} MB/s`;
        document.getElementById('scan-location').textContent = `${b.offset_gb} GB`;
      });

      currentScanBlock += data.blocks.length;
      const pct = Math.min(100, Math.round((currentScanBlock / TOTAL_SCAN_BLOCKS) * 100));
      document.getElementById('scan-progress-bar').style.width = `${pct}%`;
      document.getElementById('scan-progress-text').textContent = `${pct}%`;
      updateScanStatsUI();
    }
  } catch (err) {
    console.error('Scan step error:', err);
    appendTerminalLog(`[ERROR] Gagal memindai blok ${currentScanBlock}: ${err.message}`);
    currentScanBlock += chunkSize;
  }

  if (isScanning) {
    setTimeout(executeScanStep, 40);
  }
}

function updateScanStatsUI() {
  document.getElementById('cnt-excellent').textContent = scanStats.excellent;
  document.getElementById('cnt-good').textContent = scanStats.good;
  document.getElementById('cnt-slow').textContent = scanStats.slow;
  document.getElementById('cnt-weak').textContent = scanStats.weak;
  document.getElementById('cnt-bad').textContent = scanStats.bad;
}

function appendTerminalLog(msg) {
  const terminal = document.getElementById('repair-terminal');
  if (!terminal) return;
  const time = new Date().toLocaleTimeString();
  terminal.textContent += `\n[${time}] ${msg}`;
  terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminalLog() {
  const terminal = document.getElementById('repair-terminal');
  if (terminal) {
    terminal.textContent = 'Log dibersihkan. Menunggu instruksi pemulihan atau pemindaian...';
  }
}

// Aksi Perbaikan Sistem File (CHKDSK)
async function runChkdskAction() {
  const disk = allDisks[activeDiskIndex] || {};
  const drive = (disk.drive_letters && disk.drive_letters[0]) || 'C';
  const btn = document.getElementById('btn-action-chkdsk');

  if (btn) btn.disabled = true;
  appendTerminalLog(`[CHKDSK] Menjalankan pemeriksaan struktur cluster & sistem file pada Drive ${drive}: ...`);

  try {
    const resp = await fetch('/api/repair_chkdsk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drive })
    });
    const data = await resp.json();
    if (data.success) {
      appendTerminalLog(`[CHKDSK SUKSES]\n${data.output}`);
    } else {
      appendTerminalLog(`[CHKDSK GAGAL] ${data.error || data.message}`);
    }
  } catch (err) {
    appendTerminalLog(`[CHKDSK ERROR] ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Aksi Optimasi TRIM Sel NAND
async function runTrimAction() {
  const disk = allDisks[activeDiskIndex] || {};
  const drive = (disk.drive_letters && disk.drive_letters[0]) || 'C';
  const btn = document.getElementById('btn-action-trim');

  if (btn) btn.disabled = true;
  appendTerminalLog(`[TRIM] Mengirim instruksi deallokasi sel flash (ReTrim) ke controller disk ${drive}: ...`);

  try {
    const resp = await fetch('/api/repair_trim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drive })
    });
    const data = await resp.json();
    if (data.success) {
      appendTerminalLog(`[TRIM SUKSES]\n${data.output}`);
    } else {
      appendTerminalLog(`[TRIM GAGAL] ${data.error || data.message}`);
    }
  } catch (err) {
    appendTerminalLog(`[TRIM ERROR] ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Aksi Verifikasi Dirty Bit
async function runDirtyCheckAction() {
  const disk = allDisks[activeDiskIndex] || {};
  const drive = (disk.drive_letters && disk.drive_letters[0]) || 'C';
  const btn = document.getElementById('btn-action-dirty');

  if (btn) btn.disabled = true;
  appendTerminalLog(`[DIRTY BIT] Memeriksa status integritas volume ${drive}: ...`);

  try {
    const resp = await fetch(`/api/dirty_check?drive=${drive}`);
    const data = await resp.json();
    if (data.success) {
      const statusDirty = data.is_dirty ? 'PERINGATAN: Partisi kotor (Dirty Bit aktif)! Diperlukan chkdsk /f.' : 'STATUS BERSIH: Partisi sehat dan tersinkronisasi sempurna.';
      appendTerminalLog(`[HASIL DIRTY BIT] ${statusDirty}\n${data.output}`);
    } else {
      appendTerminalLog(`[DIRTY BIT GAGAL] ${data.error}`);
    }
  } catch (err) {
    appendTerminalLog(`[DIRTY BIT ERROR] ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}
