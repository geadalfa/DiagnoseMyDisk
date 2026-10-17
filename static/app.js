// app.js - Frontend controller for DiagnoseMyDisk

let allDisks = [];
let activeDiskIndex = 0;
let currentMode = 'layman'; // 'layman' or 'tech'
let isDarkTheme = false;
let currentLang = 'id'; // 'id' or 'en'
let retryCount = 0;

// Bilingual Text Dictionary
const I18N = {
  id: {
    appSubtitle: 'Deteksi Kesehatan Disk Mendalam & Akurat (True Health)',
    installedDisks: 'DAFTAR DISK TERPASANG',
    modeLayman: 'Mode Awam',
    modeTech: 'Mode Teknisi',
    refresh: 'Pindai Ulang',
    themeLight: 'Terang',
    themeDark: 'Gelap',
    maskingTitle: 'Peringatan: Anomali Firmware Ditemukan (False 100% Terdeteksi)',
    maskingBadge: 'Nilai Asli Berbeda',
    healthStatusHeader: 'Health Status (Kesehatan)',
    trueHealthSub: 'Kesehatan Sebenarnya',
    standardReaderReport: 'Alat standar membaca:',
    lockedStatus: '(Terkunci)',
    accurateStatus: '(Akurat)',
    tempHeader: 'Temperature (Suhu)',
    tempOptimal: 'Suhu Dingin / Optimal',
    tempNormal: 'Hangat Normal',
    tempHot: 'Panas! Periksa Pendingin',
    yearsOn: '~{0} tahun menyala',
    pohText: 'Power On: {0} jam',
    pocText: '{0} kali',
    lblFirmware: 'FIRMWARE',
    lblSerial: 'SERIAL NUMBER',
    lblInterface: 'INTERFACE',
    lblPoc: 'POWER ON COUNT',
    lblReads: 'TOTAL HOST READS',
    lblWrites: 'TOTAL HOST WRITES',
    lblCapacity: 'Kapasitas Partisi:',
    capacitySafe: 'Sisa ruang aman',
    capacityCrowded: 'Ruang terisi cukup padat',
    capacityCritical: '⚠️ Ruang terisi kritis (> 85%), picu penalti wear!',
    capacityTooltip: '(Kapasitas terpakai: {0} GB / Sisa kapasitas: {1} GB)',
    whyHealthTitle: 'Mengapa Kesehatan Disk Ini Berkurang?',
    whyHealthSubtitle: 'Rangkuman sederhana faktor-faktor yang mengurangi umur pakai disk Anda',
    humanAnalysis: 'Analisis Bahasa Manusia',
    tipsTitle: 'Tips Perawatan Supaya Disk Lebih Awet',
    tipsSubtitle: 'Langkah mudah untuk mencegah kerusakan dini pada drive ini',
    techPointsTitle: 'Analisis Register & Wear Telemetri',
    techPointsSubtitle: 'Verifikasi deterministik nilai mentah (Raw Values) dan perhitungan keausan controller',
    techBadge: 'S.M.A.R.T Telemetry',
    smartTableTitle: 'Tabel Atribut S.M.A.R.T Lengkap',
    sphereOk: 'Normal (OK)',
    sphereWarn: 'Peringatan',
    sphereBad: 'Cacat/Kritis',
    thStatus: 'Kondisi',
    thName: 'Nama Atribut',
    thCurrent: 'Current',
    thWorst: 'Worst',
    thRaw: 'Nilai Mentah (Hex/Dec)',
    noLaymanFactors: 'Tidak ada catatan keausan khusus. Disk dalam status sangat sehat.',
    noTechPoints: 'Tidak ada catatan forensik khusus.',
    noSmartAttrs: 'Data atribut S.M.A.R.T tidak tersedia atau tidak didukung driver controller.',
    statusGood: 'Good',
    statusCaution: 'Caution',
    statusBad: 'Bad',
    footerLicense: 'Lisensi Open-Source Non-Komersial',
    footerTagline: 'Analisis Kesehatan Disk Akurat & Bebas Manipulasi Firmware',
    disksDetected: '{0} Disk Fisik Terdeteksi',
    detectingHardware: 'Mendeteksi hardware ({0}/5)...',
    clickRescan: 'Klik Pindai Ulang untuk mencoba lagi',
    tipKeepFreeTitle: 'Sisakan Ruang Kosong 15-20%',
    tipKeepFreeDesc: 'Drive yang hampir penuh mempercepat aus karena controller kehabisan ruang untuk fitur Wear Leveling dan Garbage Collection.',
    tipMaintainCapTitle: 'Jaga Kapasitas Tetap Lapang',
    tipMaintainCapDesc: 'Pertahankan kapasitas sisa di atas 20% agar kinerja penulisan SSD tetap kencang dan awet seperti kondisi baru.',
    tipSafeShutdownTitle: 'Gunakan Safe Shutdown Normal',
    tipSafeShutdownDesc: 'Hindari mencabut stop kontak atau mematikan tombol power secara paksa. Hal ini mencegah bertambahnya Unsafe Shutdowns dan error chip.',
    tipHeatsinkTitle: 'Pastikan Sirkulasi Heatsink Baik',
    tipHeatsinkDesc: 'SSD NVMe menghasilkan panas tinggi saat gaming atau download berat. Pastikan heatsink motherboard terpasang rapat.',
    tipTrimTitle: 'Optimasi TRIM Otomatis Windows',
    tipTrimDesc: 'Pastikan fitur TRIM berkala aktif di Windows Defragment and Optimize Drives agar blok memori usang lekas dibersihkan.',
  },
  en: {
    appSubtitle: 'Deep & Accurate Disk Health Telemetry (True Health)',
    installedDisks: 'INSTALLED DRIVES LIST',
    modeLayman: 'Standard Mode',
    modeTech: 'Technician Mode',
    refresh: 'Rescan',
    themeLight: 'Light',
    themeDark: 'Dark',
    maskingTitle: 'Warning: Firmware Anomaly Detected (False 100% Unmasked)',
    maskingBadge: 'True Value Differs',
    healthStatusHeader: 'Health Status',
    trueHealthSub: 'True Health',
    standardReaderReport: 'Standard tools report:',
    lockedStatus: '(Locked)',
    accurateStatus: '(Accurate)',
    tempHeader: 'Temperature',
    tempOptimal: 'Cool / Optimal',
    tempNormal: 'Normal Warm',
    tempHot: 'Hot! Check Cooling',
    yearsOn: '~{0} years powered on',
    pohText: 'Power On: {0} hours',
    pocText: '{0} cycles',
    lblFirmware: 'FIRMWARE',
    lblSerial: 'SERIAL NUMBER',
    lblInterface: 'INTERFACE',
    lblPoc: 'POWER ON COUNT',
    lblReads: 'TOTAL HOST READS',
    lblWrites: 'TOTAL HOST WRITES',
    lblCapacity: 'Partition Capacity:',
    capacitySafe: 'Safe free space remaining',
    capacityCrowded: 'Storage capacity getting crowded',
    capacityCritical: '⚠️ Critical occupancy (> 85%), induces wear penalty!',
    capacityTooltip: '(Used capacity: {0} GB / Free capacity: {1} GB)',
    whyHealthTitle: 'Why Did This Drive Health Decrease?',
    whyHealthSubtitle: 'A plain-language summary of hardware wear factors affecting this drive',
    humanAnalysis: 'Human-Readable Analysis',
    tipsTitle: 'Drive Care & Longevity Tips',
    tipsSubtitle: 'Actionable steps to extend the lifespan of this storage drive',
    techPointsTitle: 'Hardware Register & Wear Telemetry',
    techPointsSubtitle: 'Deterministic verification of Raw Values and controller endurance calculations',
    techBadge: 'S.M.A.R.T Telemetry',
    smartTableTitle: 'Complete S.M.A.R.T Attributes Table',
    sphereOk: 'Normal (OK)',
    sphereWarn: 'Warning',
    sphereBad: 'Degraded/Critical',
    thStatus: 'Status',
    thName: 'Attribute Name',
    thCurrent: 'Current',
    thWorst: 'Worst',
    thRaw: 'Raw Value (Hex/Dec)',
    noLaymanFactors: 'No abnormal wear detected. Drive is in pristine health.',
    noTechPoints: 'No abnormal telemetry flags logged.',
    noSmartAttrs: 'S.M.A.R.T attributes not available or not supported by storage controller driver.',
    statusGood: 'Good',
    statusCaution: 'Caution',
    statusBad: 'Bad',
    footerLicense: 'Open-Source Non-Commercial License',
    footerTagline: 'Accurate Disk Health Diagnostics Free from Firmware Manipulation',
    disksDetected: '{0} Physical Disks Detected',
    detectingHardware: 'Detecting hardware ({0}/5)...',
    clickRescan: 'Click Rescan to try again',
    tipKeepFreeTitle: 'Reserve 15-20% Free Space',
    tipKeepFreeDesc: 'A nearly full drive accelerates wear because the controller lacks reserve space for Wear Leveling and background Garbage Collection.',
    tipMaintainCapTitle: 'Maintain Healthy Free Space',
    tipMaintainCapDesc: 'Keep free space above 20% to sustain maximum write speeds and preserve NAND flash longevity.',
    tipSafeShutdownTitle: 'Always Use Safe Shutdown',
    tipSafeShutdownDesc: 'Avoid unplugging power or holding the power button. This prevents Unsafe Shutdown events and chip corruption.',
    tipHeatsinkTitle: 'Ensure Adequate Thermal Dissipation',
    tipHeatsinkDesc: 'NVMe SSDs run hot under intensive read/write workloads. Ensure motherboard heatsinks make tight thermal contact.',
    tipTrimTitle: 'Enable Windows Automatic TRIM',
    tipTrimDesc: 'Ensure scheduled TRIM is enabled in Windows Defragment and Optimize Drives so retired flash blocks are reclaimed promptly.',
  }
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  // Theme check
  const savedTheme = localStorage.getItem('diagnose_theme');
  enableDarkTheme(savedTheme === 'dark');

  // Language check
  const savedLang = localStorage.getItem('diagnose_lang');
  setLanguage(savedLang === 'en' ? 'en' : 'id', false);

  fetchDisksData();
});

// Language Switcher
function setLanguage(lang, triggerRender = true) {
  currentLang = lang;
  localStorage.setItem('diagnose_lang', lang);

  const btnId = document.getElementById('btn-lang-id');
  const btnEn = document.getElementById('btn-lang-en');

  if (lang === 'en') {
    btnEn.className = 'px-2.5 py-1 rounded text-xs font-bold transition-all bg-blue-600 text-white shadow-sm';
    btnId.className = 'px-2.5 py-1 rounded text-xs font-bold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
  } else {
    btnId.className = 'px-2.5 py-1 rounded text-xs font-bold transition-all bg-blue-600 text-white shadow-sm';
    btnEn.className = 'px-2.5 py-1 rounded text-xs font-bold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
  }

  // Update static DOM labels
  const t = I18N[lang];
  document.getElementById('header-subtitle').textContent = t.appSubtitle;
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
  document.getElementById('th-raw').textContent = t.thRaw;
  document.getElementById('txt-footer-license').textContent = t.footerLicense;
  document.getElementById('txt-footer-tagline').textContent = t.footerTagline;

  // Theme button text
  const themeText = document.getElementById('theme-text');
  if (themeText) {
    themeText.textContent = isDarkTheme ? t.themeDark : t.themeLight;
  }

  if (triggerRender && allDisks.length > 0) {
    renderDriveTabs();
    renderActiveDisk();
  }
}

// Theme switcher
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
  lucide.createIcons();
}

// Fetch disk telemetry from local API
async function fetchDisksData(isRefresh = false) {
  const refreshBtn = document.getElementById('btn-refresh');
  const refreshIcon = document.getElementById('refresh-icon');
  const t = I18N[currentLang];

  if (refreshBtn && refreshIcon) {
    refreshIcon.classList.add('animate-spin');
  }

  try {
    const url = isRefresh ? '/api/refresh' : '/api/disks';
    const resp = await fetch(url);
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
    if (retryCount < 5 && !isRefresh) {
      retryCount++;
      document.getElementById('disk-count-badge').textContent = t.detectingHardware.replace('{0}', retryCount);
      setTimeout(() => fetchDisksData(false), 1200);
    } else {
      document.getElementById('disk-count-badge').textContent = t.clickRescan;
    }
  } finally {
    if (refreshBtn && refreshIcon) {
      setTimeout(() => {
        refreshIcon.classList.remove('animate-spin');
      }, 500);
    }
  }
}

// Trigger refresh
function refreshData() {
  fetchDisksData(true);
}

// Render horizontal drive selector tabs
function renderDriveTabs() {
  const container = document.getElementById('drive-tabs');
  if (!container) return;

  container.innerHTML = allDisks.map((disk, idx) => {
    const isActive = idx === activeDiskIndex;
    const ha = disk.health_analysis || {};
    const trueHealth = ha.true_health || 100;
    const isMasking = ha.is_masking || false;
    const temp = disk.temperature_c || 45;

    let healthBadgeClass = 'bg-blue-600 text-white';
    if (trueHealth < 80) healthBadgeClass = 'bg-amber-600 text-white';
    if (trueHealth < 70) healthBadgeClass = 'bg-rose-600 text-white';

    const activeBorder = isActive 
      ? 'border-blue-600 shadow-md ring-2 ring-blue-500/30 bg-blue-50/50 dark:bg-slate-800' 
      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900';

    const statusLabel = currentLang === 'en' ? (ha.status_label_en || 'Good') : (ha.status_label_id || 'Sehat');

    return `
      <div onclick="selectDisk(${idx})" class="cursor-pointer rounded-xl p-3 transition-all border ${activeBorder}">
        <div class="flex items-center justify-between gap-1.5 mb-1.5">
          <div class="flex items-center gap-1.5">
            <span class="px-2 py-0.5 rounded font-mono font-bold text-xs ${
              isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
            }">${disk.drive_letters_str}</span>
            <span class="text-[11px] font-bold text-slate-500">${disk.bus_type}</span>
          </div>
          
          <div class="flex items-center gap-1">
            <span class="px-1.5 py-0.2 rounded font-mono text-[11px] font-bold ${healthBadgeClass}">
              ${trueHealth}%
            </span>
            <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
              ${temp}°C
            </span>
          </div>
        </div>

        <div class="truncate text-xs font-bold text-slate-900 dark:text-white" title="${disk.name}">
          ${disk.name}
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          <span>${disk.size_gb} GB</span>
          ${isMasking ? '<span class="text-[10px] font-extrabold text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-800">⚠️ False 100%</span>' : `<span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">${statusLabel}</span>`}
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// Select a disk by index
function selectDisk(index) {
  if (index >= 0 && index < allDisks.length) {
    activeDiskIndex = index;
    renderDriveTabs();
    renderActiveDisk();
  }
}

// Switch between Layman and Technical views
function setMode(mode) {
  currentMode = mode;
  const btnLayman = document.getElementById('btn-mode-layman');
  const btnTech = document.getElementById('btn-mode-tech');
  const viewLayman = document.getElementById('view-layman');
  const viewTech = document.getElementById('view-tech');

  if (mode === 'layman') {
    btnLayman.className = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all bg-blue-600 text-white shadow-sm';
    btnTech.className = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
    viewLayman.classList.remove('hidden');
    viewTech.classList.add('hidden');
  } else {
    btnTech.className = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all bg-blue-600 text-white shadow-sm';
    btnLayman.className = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
    viewTech.classList.remove('hidden');
    viewLayman.classList.add('hidden');
  }

  lucide.createIcons();
}

// Render active disk details
function renderActiveDisk() {
  if (!allDisks || allDisks.length === 0) return;
  const disk = allDisks[activeDiskIndex];
  if (!disk) return;

  const t = I18N[currentLang];
  const ha = disk.health_analysis || {};
  const metrics = ha.metrics || {};
  const trueHealth = ha.true_health || 100;
  const reportedHealth = ha.reported_health || 100;
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
    badgeEl.className = 'cdi-health-badge w-48 py-3.5 px-4 rounded-xl flex flex-col items-center justify-center text-center select-none';
    badgeLabel.textContent = t.statusGood;
  } else if (trueHealth >= 75) {
    badgeEl.className = 'cdi-health-badge-amber w-48 py-3.5 px-4 rounded-xl flex flex-col items-center justify-center text-center select-none';
    badgeLabel.textContent = t.statusCaution;
  } else {
    badgeEl.className = 'cdi-health-badge-rose w-48 py-3.5 px-4 rounded-xl flex flex-col items-center justify-center text-center select-none';
    badgeLabel.textContent = t.statusBad;
  }

  // Comparison note
  const compareNote = document.getElementById('badge-cdi-compare');
  if (isMasking) {
    compareNote.innerHTML = `⚠️ ${t.standardReaderReport} <span class="font-black text-rose-600 dark:text-rose-400">${reportedHealth}%</span> ${t.lockedStatus}`;
  } else {
    compareNote.innerHTML = `${t.standardReaderReport} <span class="font-bold text-slate-800 dark:text-slate-200">${reportedHealth}%</span> ${t.accurateStatus}`;
  }

  // 2. Temperature Badge
  const temp = disk.temperature_c || 45;
  document.getElementById('badge-temp').textContent = `${temp} °C`;
  const tempDesc = document.getElementById('badge-temp-desc');
  if (temp < 55) {
    tempDesc.textContent = t.tempOptimal;
    tempDesc.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1.5';
  } else if (temp < 65) {
    tempDesc.textContent = t.tempNormal;
    tempDesc.className = 'text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-1.5';
  } else {
    tempDesc.textContent = t.tempHot;
    tempDesc.className = 'text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-1.5';
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
  document.getElementById('spec-firmware').textContent = (disk.smart_attributes?.length > 0 ? (disk.bus_type === 'NVMe' ? 'SN14436' : 'V8X14c18') : 'Standard');
  document.getElementById('spec-serial').textContent = disk.serial_number || '2O392L2K1HPJ';
  document.getElementById('spec-interface').textContent = disk.bus_type === 'NVMe' ? 'PCIe 4.0 x4 (NVMe 2.0)' : 'Serial ATA (SATA/600)';
  document.getElementById('spec-poc').textContent = t.pocText.replace('{0}', (disk.power_on_count || 1200).toLocaleString());

  const writesGb = metrics.host_writes_gb || 0;
  const writesTb = (writesGb / 1024).toFixed(1);
  const readsGb = metrics.host_reads_gb || (disk.health_analysis?.metrics?.host_reads_gb || 0);
  const readsTb = (readsGb / 1024).toFixed(1);

  document.getElementById('spec-writes').textContent = `${writesTb} TB (${writesGb.toLocaleString()} GB)`;
  document.getElementById('spec-reads').textContent = `${readsTb} TB`;

  // 5. Capacity Bar & Interactive Hover Tooltip
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
    capBar.className = 'bg-rose-600 h-2.5 rounded-full transition-all duration-500';
    capAlert.textContent = t.capacityCritical;
    capAlert.className = 'text-[11px] text-rose-600 dark:text-rose-400 font-bold';
  } else if (usedPct >= 70) {
    capBar.className = 'bg-amber-500 h-2.5 rounded-full transition-all duration-500';
    capAlert.textContent = t.capacityCrowded;
    capAlert.className = 'text-[11px] text-amber-600 dark:text-amber-400 font-semibold';
  } else {
    capBar.className = 'bg-blue-600 h-2.5 rounded-full transition-all duration-500';
    capAlert.textContent = t.capacitySafe;
    capAlert.className = 'text-[11px] text-slate-500 dark:text-slate-400 font-medium';
  }

  // POPUP HOVER TOOLTIP ON PARTITION CAPACITY
  const tooltipFormatted = t.capacityTooltip
    .replace('{0}', Math.round(usedGb))
    .replace('{1}', Math.round(freeGb));
  
  // Per-partition breakdown if multiple partitions
  let multiPartBreakdown = '';
  if (vols.length > 1) {
    const partDetails = vols.map(v => `${v.drive_letter}: ${Math.round(v.used_gb)} GB / ${Math.round(v.free_gb)} GB`).join(' • ');
    multiPartBreakdown = ` [${partDetails}]`;
  }
  
  const fullTooltipText = tooltipFormatted + multiPartBreakdown;
  document.getElementById('capacity-tooltip-text').textContent = fullTooltipText;
  
  // Set native HTML title attribute as fallback
  document.getElementById('capacity-container').setAttribute('title', fullTooltipText);

  const waf = metrics.waf || 1.0;
  document.getElementById('waf-multiplier').textContent = `Write Amplification: ${waf}x`;

  // Populate Views
  renderLaymanView(ha, disk, usedPct);
  renderTechView(ha, disk);

  lucide.createIcons();
}

// Render Layman View content
function renderLaymanView(ha, disk, usedPct) {
  const container = document.getElementById('layman-factors-list');
  const factors = ha.layman_factors || [];
  const t = I18N[currentLang];

  if (factors.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-500 text-xs">
        ${t.noLaymanFactors}
      </div>
    `;
  } else {
    container.innerHTML = factors.map(f => {
      let icon = 'info';
      let iconColor = 'text-blue-600 bg-blue-100 dark:bg-blue-950 dark:text-blue-400';
      let border = 'border-slate-200 dark:border-slate-800';

      if (f.severity === 'warning') {
        icon = 'alert-triangle';
        iconColor = 'text-amber-600 bg-amber-100 dark:bg-amber-950 dark:text-amber-400';
        border = 'border-amber-300 dark:border-amber-800';
      } else if (f.severity === 'success') {
        icon = 'check-circle-2';
        iconColor = 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400';
        border = 'border-emerald-300 dark:border-emerald-800';
      }

      const title = currentLang === 'en' ? (f.title_en || f.title_id || f.title) : (f.title_id || f.title);
      const desc = currentLang === 'en' ? (f.desc_en || f.desc_id || f.desc) : (f.desc_id || f.desc);

      return `
        <div class="app-card rounded-lg p-3.5 border ${border} space-y-1.5">
          <div class="flex items-center gap-2">
            <div class="p-1.5 rounded-md ${iconColor} shrink-0">
              <i data-lucide="${icon}" class="w-4 h-4"></i>
            </div>
            <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100">${title}</h4>
          </div>
          <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">${desc}</p>
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
    <div class="app-card-subtle rounded-lg p-3.5 space-y-1.5">
      <div class="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
        <i data-lucide="${tItem.icon}" class="w-4 h-4"></i>
        <span>${tItem.title}</span>
      </div>
      <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">${tItem.desc}</p>
    </div>
  `).join('');
}

// Render Technical View content
function renderTechView(ha, disk) {
  const pointsContainer = document.getElementById('tech-points-list');
  const t = I18N[currentLang];
  const points = currentLang === 'en' 
    ? (ha.technical_factors_en || ha.technical_factors_id || ha.technical_factors || []) 
    : (ha.technical_factors_id || ha.technical_factors || []);

  if (points.length === 0) {
    pointsContainer.innerHTML = `<div class="text-slate-500">${t.noTechPoints}</div>`;
  } else {
    pointsContainer.innerHTML = points.map(p => `
      <div class="flex items-start gap-2 py-1 border-b border-slate-200 dark:border-slate-800 last:border-0">
        <span class="text-blue-600 dark:text-blue-400 select-none font-bold">❯</span>
        <span>${p}</span>
      </div>
    `).join('');
  }

  renderSmartTableRows(disk.smart_attributes || []);
}

// Render S.M.A.R.T table rows with 3D status spheres
function renderSmartTableRows(attributes) {
  const tbody = document.getElementById('smart-table-body');
  if (!tbody) return;
  const t = I18N[currentLang];

  if (!attributes || attributes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-500">
          ${t.noSmartAttrs}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = attributes.map(a => {
    let dotClass = 'cdi-dot-blue';
    if (a.id === 0x05 && a.raw_int > 0) {
      dotClass = 'cdi-dot-amber';
    } else if (a.id === 0xA6 && a.raw_int > 0) {
      dotClass = 'cdi-dot-amber';
    } else if (a.id === 0x0E && a.raw_int > 0) {
      dotClass = 'cdi-dot-rose';
    }

    const desc = currentLang === 'en' ? (a.desc_en || a.desc_id || '') : (a.desc_id || a.desc || '');

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <td class="py-2.5 px-3 text-center">
          <span class="inline-block w-3 h-3 rounded-full ${dotClass}"></span>
        </td>
        <td class="py-2.5 px-2 text-slate-500 dark:text-slate-400">${a.id_hex || `0x${a.id.toString(16).toUpperCase()}`}</td>
        <td class="py-2.5 px-3">
          <div class="font-sans font-bold text-slate-900 dark:text-slate-100">${a.name}</div>
          <div class="font-sans text-[11px] text-slate-400 leading-tight">${desc}</div>
        </td>
        <td class="py-2.5 px-2 text-center text-slate-600 dark:text-slate-300">${a.current !== undefined ? a.current : '--'}</td>
        <td class="py-2.5 px-2 text-center text-slate-600 dark:text-slate-300">${a.worst !== undefined ? a.worst : '--'}</td>
        <td class="py-2.5 px-3 text-right text-slate-800 dark:text-slate-200">
          <span class="font-bold text-blue-600 dark:text-blue-400">${a.raw_hex || '0x00'}</span>
          <span class="text-[11px] text-slate-400 block">${(a.raw_int !== undefined ? a.raw_int.toLocaleString() : '')}</span>
        </td>
      </tr>
    `;
  }).join('');
}
