// app.js - Frontend controller for DiagnoseMyDisk v3.0.0
// Arsitektur telemetri deterministik & antarmuka berstandar desktop Anti-Slop

const APP_TOKEN = (document.querySelector('meta[name="app-token"]') || {}).content || '';
const nativeFetch = window.fetch.bind(window);

async function apiFetch(input, init = {}) {
  const options = { ...init };
  options.headers = { ...(init.headers || {}), 'X-App-Token': APP_TOKEN };
  return nativeFetch(input, options);
}

let allDisks = [];
let activeDiskIndex = 0;
let currentMode = 'layman'; // 'layman', 'tech', atau 'scanner'
let isDarkTheme = false;
let currentLang = 'en'; // Default to English (v3.0.0)
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
    modeScanner: 'Bad Sector & Perbaikan',
    modeStorage: 'Penyimpanan & Pembersihan',
    storageTitle: 'Manajemen & Analisis Penyimpanan Disk',
    storageSubtitle: 'Pindai seluruh disk, temukan berkas duplikat, filter berkas besar/lawas, dan bersihkan cache sistem',
    refresh: 'Pindai Ulang',
    themeLight: 'Terang',
    themeDark: 'Gelap',
    maskingTitle: 'Peringatan: Anomali Firmware Ditemukan',
    maskingBadge: 'False 100% Terkunci',
    healthStatusHeader: 'Status Kesehatan',
    trueHealthSub: 'Kesehatan Sebenarnya',
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
    statusGood: 'Baik',
    statusCaution: 'Perhatian',
    statusBad: 'Kritis',
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
    lblNandType: 'TIPE FLASH / MEDIA',
    lblCacheType: 'CACHE / HMB',
    flashArchTitle: 'Arsitektur Flash & Fitur Hardware',
    flashArchSubtitle: 'Spesifikasi teknologi sel memori (TLC/QLC/SLC), arsitektur DRAM/HMB, dan kontroler hardware',
    btnGlossary: 'Panduan Edukasi QLC/TLC & Fitur',
    lblHwNand: 'Tipe Sel Flash',
    lblHwCache: 'Arsitektur Cache',
    lblHwSlc: 'Akselerasi Tulis',
    lblHwPe: 'Rating Siklus P/E',
    lblHwSummaryTitle: 'Maksud Fitur & Karakteristik untuk Drive Ini:',
    lblActiveFeatures: 'Fitur & Instruksi Hardware Aktif:',
    modalGlossaryTitle: 'Panduan Edukasi Teknologi Flash NAND & Fitur SSD/Disk',
    modalGlossarySubtitle: 'Penjelasan mendalam tentang QLC, TLC, MLC, SLC, DRAM, HMB, TRIM & SMR',
    modalFooterTip: 'Tekan Esc atau klik tombol untuk menutup',
    modalBtnClose: 'Tutup Panduan',
  },
  en: {
    appSubtitle: 'True Health Verification, Bad Sector Scan & S.M.A.R.T Telemetry',
    engineReady: 'Telemetry Ready',
    installedDisks: 'Detected Physical Drives',
    modeLayman: 'Summary',
    modeTech: 'S.M.A.R.T Forensic',
    modeScanner: 'Bad Sector & Repair',
    modeStorage: 'Storage & Cleanup',
    storageTitle: 'Disk Storage Management & Analysis',
    storageSubtitle: 'Scan all drives, detect duplicate files, filter large/old files, and clean up system bloat',
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
    lblNandType: 'FLASH / MEDIA TYPE',
    lblCacheType: 'CACHE / HMB',
    flashArchTitle: 'Flash Architecture & Hardware Features',
    flashArchSubtitle: 'Memory cell technology (TLC/QLC/SLC), DRAM/HMB caching, and hardware controller specs',
    btnGlossary: 'QLC/TLC Educational Guide',
    lblHwNand: 'Flash Cell Type',
    lblHwCache: 'Cache Architecture',
    lblHwSlc: 'Write Acceleration',
    lblHwPe: 'P/E Cycle Rating',
    lblHwSummaryTitle: 'Feature Purpose & Drive Characteristics:',
    lblActiveFeatures: 'Active Hardware Features & Instructions:',
    modalGlossaryTitle: 'Educational Guide: NAND Flash Technology & Disk Features',
    modalGlossarySubtitle: 'Deep dive into QLC, TLC, MLC, SLC, DRAM, HMB, TRIM & SMR',
    modalFooterTip: 'Press Esc or click button to close',
    modalBtnClose: 'Close Guide',
  }
};

// Static copy map for elements marked with data-i18n / data-i18n-html /
// data-i18n-title / data-i18n-placeholder. Keeps every visible string in one
// place so the two language modes cannot drift apart.
const STATIC_I18N = {
  navSummary: { en: 'Summary', id: 'Ringkasan' },
  navSmart: { en: 'S.M.A.R.T forensic view', id: 'Tampilan forensik S.M.A.R.T' },
  navScanner: { en: 'Bad sector scan and repair', id: 'Pindai dan perbaiki bad sector' },
  navStorage: { en: 'Storage and cleanup', id: 'Penyimpanan dan pembersihan' },
  navLogs: { en: 'Application diagnostic logs', id: 'Log diagnostik aplikasi' },
  navExport: { en: 'Export diagnostic report as HTML', id: 'Ekspor laporan diagnostik sebagai HTML' },
  apiCardLabel: { en: 'LOCAL API', id: 'API LOKAL' },
  apiCardMeta: { en: 'Local only. Open reference.', id: 'Hanya lokal. Buka referensi.' },
  waitingTelemetry: { en: 'Waiting for telemetry', id: 'Menunggu telemetri' },
  nonAdminNotice: {
    en: 'The app is running in <strong>Standard Mode (Non-Elevated)</strong>. Raw PhysicalDrive access and TRIM require Administrator rights.',
    id: 'Aplikasi berjalan dalam <strong>Mode Standar (Non-Elevated)</strong>. Akses PhysicalDrive mentah dan TRIM memerlukan hak Administrator.',
  },
  relaunchAdmin: { en: 'Restart as Administrator', id: 'Mulai ulang sebagai Administrator' },
  loading: { en: 'Loading...', id: 'Memuat...' },
  waitingData: { en: 'Waiting for data', id: 'Menunggu data' },
  powerYearsUnknown: { en: 'Power-on time unavailable', id: 'Jam terbang tidak tersedia' },
  powerOnUnknown: { en: 'Power-on: -- hours', id: 'Power-on: -- jam' },
  capacitySafe: { en: 'Free space is safe', id: 'Sisa ruang aman' },
  writeAmplification: { en: 'Write amplification: N/A', id: 'Write amplification: N/A' },
  resetMap: { en: 'Reset map', id: 'Reset peta' },
  scanSpeed: { en: 'SPEED', id: 'KECEPATAN' },
  scanLba: { en: 'LBA POSITION', id: 'LOKASI LBA' },
  scanProgress: { en: 'PROGRESS', id: 'PROGRES' },
  latencyExcellent: { en: '< 10ms (Excellent)', id: '< 10ms (Prima)' },
  latencyGood: { en: '< 50ms (Good)', id: '< 50ms (Baik)' },
  latencySlow: { en: '50-150ms (Slow)', id: '50-150ms (Lambat)' },
  latencyWeak: { en: '150-500ms (Weak)', id: '150-500ms (Lemah)' },
  latencyBad: { en: 'Bad sector (failed)', id: 'Bad sector (rusak)' },
  repairExplainerTitle: { en: 'How bad-sector repair actually works', id: 'Bagaimana mekanisme perbaikan bad sector bekerja' },
  repairExplainerBody: {
    en: '• <strong>Mechanical HDD:</strong> A pending bad sector (SMART 0xC5) is resolved on the next write cycle. The drive firmware remaps the defective sector to a spare sector (SMART 0x05 Reallocated Sector).<br>• <strong>SSD (NVMe & SATA):</strong> Physically worn NAND cells cannot be repaired by software. Software can repair corrupt file-system clusters (MFT), verify partition integrity, and issue <strong>TRIM</strong> so the controller retires dead blocks and refreshes wear leveling.',
    id: '• <strong>HDD mekanikal:</strong> Bad sector pending (SMART 0xC5) diperbaiki saat siklus penulisan berikutnya. Firmware drive merelokasi sektor cacat ke sektor cadangan (SMART 0x05 Reallocated Sector).<br>• <strong>SSD (NVMe & SATA):</strong> Sel NAND yang aus secara fisik tidak bisa diperbaiki software. Software dapat memperbaiki kluster sistem file yang rusak (MFT), memverifikasi integritas partisi, dan mengirim <strong>TRIM</strong> agar controller memensiunkan blok mati dan menyegarkan wear leveling.',
  },
  chkdskTitle: { en: 'File system repair (CHKDSK)', id: 'Perbaikan sistem file (CHKDSK)' },
  chkdskDesc: { en: 'Scan and repair partition metadata, file indexes, and bad clusters online without a restart.', id: 'Pindai dan perbaiki metadata partisi, indeks file, dan kluster buruk secara online tanpa restart.' },
  chkdskAction: { en: 'Run scan & fix', id: 'Jalankan scan & fix' },
  trimTitle: { en: 'NAND cell TRIM optimization', id: 'Optimasi TRIM sel NAND' },
  trimDesc: { en: 'Send ReTrim to the SSD controller to clear stale blocks and restore write performance.', id: 'Kirim ReTrim ke controller SSD untuk membersihkan blok sampah dan memulihkan performa tulis.' },
  trimAction: { en: 'Send TRIM command', id: 'Kirim perintah TRIM' },
  dirtyTitle: { en: 'Partition dirty-bit check', id: 'Verifikasi dirty bit partisi' },
  dirtyDesc: { en: 'Check whether Windows flagged this volume as corrupt (dirty) after an unsafe shutdown.', id: 'Periksa apakah Windows menandai volume ini korup (dirty) akibat unsafe shutdown.' },
  dirtyAction: { en: 'Check partition status', id: 'Cek status partisi' },
  executionLog: { en: 'Hardware & system execution log', id: 'Log eksekusi hardware & sistem' },
  clearLog: { en: 'Clear log', id: 'Bersihkan log' },
  terminalIdle: { en: 'Waiting for a repair or scan command...', id: 'Menunggu instruksi pemulihan atau pemindaian...' },
  chooseTarget: { en: 'Choose target drive', id: 'Pilih target disk' },
  targetLabel: { en: 'Target:', id: 'Target:' },
  allDrives: { en: 'All drives', id: 'Semua disk' },
  scanDisk: { en: 'Scan disk', id: 'Pindai disk' },
  scanningFiles: { en: 'Scanning files...', id: 'Memindai berkas...' },
  liveLog: { en: 'Live log', id: 'Log live' },
  cancel: { en: 'Cancel', id: 'Batal' },
  allSizes: { en: 'All sizes', id: 'Semua ukuran' },
  filesOnly: { en: 'Files only', id: 'Hanya berkas' },
  foldersOnly: { en: 'Folders only', id: 'Hanya folder' },
  largestFirst: { en: 'Largest → smallest', id: 'Terbesar → terkecil' },
  smallestFirst: { en: 'Smallest → largest', id: 'Terkecil → terbesar' },
  searchFiles: { en: 'Search file or folder name...', id: 'Cari nama berkas atau folder...' },
  noResultsYet: { en: 'No scan results yet', id: 'Belum ada hasil pemindaian' },
  thItemName: { en: 'ITEM NAME', id: 'NAMA ITEM' },
  thType: { en: 'TYPE', id: 'TIPE' },
  thSize: { en: 'SIZE', id: 'UKURAN' },
  thModified: { en: 'LAST MODIFIED', id: 'TERAKHIR DIUBAH' },
  thAction: { en: 'ACTION', id: 'AKSI' },
  thOldName: { en: 'FILE / APP NAME', id: 'NAMA BERKAS / APLIKASI' },
  thAge: { en: 'AGE', id: 'USIA' },
  oneMonth: { en: '> 1 month', id: '> 1 bulan' },
  threeMonths: { en: '> 3 months', id: '> 3 bulan' },
  sixMonths: { en: '> 6 months', id: '> 6 bulan' },
  oneYear: { en: '> 1 year', id: '> 1 tahun' },
  noScanSession: { en: 'No scan has run in this session.', id: 'Belum ada pemindaian pada sesi ini.' },
  cleanSelected: { en: 'Clean selected', id: 'Bersihkan terpilih' },
  deleteSelectedCopies: { en: 'Delete selected copies', id: 'Hapus salinan terpilih' },
  waitingTelemetryShort: { en: 'Source: waiting for telemetry', id: 'Sumber: menunggu telemetri' },
  updatedDash: { en: 'Updated: --', id: 'Diperbarui: --' },
  glossarySec1Title: { en: 'Flash cell hierarchy: SLC vs MLC vs TLC vs QLC', id: 'Hierarki sel flash: SLC vs MLC vs TLC vs QLC' },
  glossaryCellType: { en: 'Cell type', id: 'Tipe sel' },
  glossaryBits: { en: 'Bits / cell', id: 'Bit / sel' },
  glossaryVoltage: { en: 'Voltage states', id: 'Status voltase' },
  glossaryPE: { en: 'P/E endurance', id: 'Ketahanan P/E' },
  glossaryTraits: { en: 'Characteristics & performance', id: 'Karakteristik & performa' },
  glossarySec2Title: { en: 'What is the point of QLC?', id: 'Apa maksud dan tujuan fitur QLC?' },
  glossarySec3Title: { en: 'DRAM cache vs DRAM-less (HMB)', id: 'DRAM cache vs DRAM-less (HMB)' },
  glossaryTrimTitle: { en: 'Why TRIM matters', id: 'Pentingnya TRIM' },
  glossarySmrTitle: { en: 'SMR vs CMR (hard disks)', id: 'SMR vs CMR (hard disk)' },
  glossarySlcTrait: { en: 'Fastest, lowest latency, highest endurance. Most expensive. Used as cache.', id: 'Tercepat, latensi terendah, daya tahan tertinggi. Paling mahal. Dipakai sebagai cache.' },
  glossaryMlcTrait: { en: 'Very fast and durable. Used in older Samsung Pro drives.', id: 'Sangat kencang dan awet. Dipakai di seri Samsung Pro lama.' },
  glossaryTlcTrait: { en: '<strong>The modern standard</strong> (ADATA Legend 900, 980 Pro). Balanced price, capacity, and multi-year endurance.', id: '<strong>Standar emas modern</strong> (ADATA Legend 900, 980 Pro). Seimbang antara harga, kapasitas, dan ketahanan puluhan tahun.' },
  glossaryQlcTrait: { en: 'About 33% denser and much cheaper. Relies on SLC cache for everyday speed.', id: 'Sekitar 33% lebih padat dan jauh lebih murah. Mengandalkan SLC cache untuk kecepatan harian.' },
  glossarySec1Desc: { en: 'NAND flash stores electrons inside silicon transistors. The main difference between SLC, MLC, TLC, and QLC is <strong>how many data bits are packed into one physical cell</strong>:', id: 'Sel flash NAND menyimpan elektron di dalam transistor silikon. Perbedaan utama SLC, MLC, TLC, dan QLC adalah <strong>berapa banyak bit data yang dijejalkan ke dalam satu sel fisik</strong>:' },
  glossaryQlcWhy: { en: '<strong>1. Why do manufacturers build QLC?</strong><br>Fitting 4 bits into one cell (16 micro voltage states) raises capacity by about 33% on the same silicon wafer. That makes very large SSDs (2TB, 4TB, even 8TB) far more affordable for regular users.', id: '<strong>1. Kenapa produsen membuat QLC?</strong><br>Dengan memuat 4 bit ke dalam satu sel (16 status voltase mikro), kapasitas naik sekitar 33% pada wafer silikon yang sama. Ini membuat SSD berkapasitas besar (2TB, 4TB, hingga 8TB) jauh lebih terjangkau.' },
  glossaryQlcCache: { en: '<strong>2. Why does it need SLC cache?</strong><br>Because the controller must resolve 16 tightly spaced voltage levels, direct-to-die QLC writes are slow (~80-150 MB/s). To hide that, the controller programs part of the free capacity as <strong>SLC cache (fast 1-bit writes)</strong>. Everyday copies can hit 3,000-5,000 MB/s. Copy a very large file until the cache fills, and speed drops to native QLC speed.', id: '<strong>2. Kenapa butuh SLC cache?</strong><br>Karena controller harus membedakan 16 tingkat voltase yang sangat rapat, tulis QLC langsung ke die lambat (~80-150 MB/s). Untuk menyiasatinya, controller memprogram sebagian kapasitas kosong sebagai <strong>SLC cache (tulis 1-bit cepat)</strong>. Salin file harian bisa mencapai 3.000-5.000 MB/s. Salin file sangat besar sampai cache penuh, kecepatan turun ke kecepatan QLC asli.' },
  glossaryQlcEndurance: { en: '<strong>3. Does QLC wear out quickly?</strong><br>Despite a ~300-1,000 P/E rating, a modern 2TB QLC SSD is usually rated for 400-800 TBW. For normal use and gaming (about 30-50 GB written per day), it can last well over 15-20 years before reaching its endurance limit.', id: '<strong>3. Apakah QLC cepat rusak?</strong><br>Meski rating P/E sekitar 300-1.000, SSD QLC 2TB modern biasanya memiliki rating 400-800 TBW. Untuk pemakaian normal dan gaming (sekitar 30-50 GB per hari), drive bisa bertahan lebih dari 15-20 tahun sebelum mencapai batas aus.' },
  logsTitle: { en: 'Application diagnostic logs', id: 'Log diagnostik aplikasi' },
  logsSubtitle: { en: 'Live runtime log for troubleshooting by you, support, or an AI assistant.', id: 'Log runtime langsung untuk troubleshooting oleh Anda, support, atau asisten AI.' },
  copy: { en: 'Copy', id: 'Salin' },
  openFile: { en: 'Open file', id: 'Buka file' },
  clear: { en: 'Clear', id: 'Bersihkan' },
  livePolling: { en: 'Live polling', id: 'Polling langsung' },
  autoScroll: { en: 'Auto scroll', id: 'Auto scroll' },
  apiTitle: { en: 'Local API reference', id: 'Referensi API lokal' },
  apiSubtitle: { en: 'The desktop app exposes a read-only JSON API on the loopback interface only.', id: 'Aplikasi desktop menyediakan API JSON read-only hanya di antarmuka loopback.' },
  apiBaseUrl: { en: 'Base URL', id: 'Base URL' },
  apiAuth: { en: 'Auth header', id: 'Header autentikasi' },
  apiScope: { en: 'Scope', id: 'Cakupan' },
  apiScopeValue: { en: 'Localhost only', id: 'Hanya localhost' },
  apiTokenLabel: { en: 'Session token', id: 'Token sesi' },
  copyToken: { en: 'Copy token', id: 'Salin token' },
  apiTokenNote: { en: 'The token changes every launch. Requests must come from 127.0.0.1 with the matching Host header. All data stays on this machine.', id: 'Token berubah setiap kali aplikasi dijalankan. Permintaan harus berasal dari 127.0.0.1 dengan Host header yang cocok. Semua data tetap di komputer ini.' },
  apiEndpointsTitle: { en: 'Endpoints', id: 'Endpoint' },
  apiExampleTitle: { en: 'Example request', id: 'Contoh permintaan' },
  epDisks: { en: 'Full disk telemetry snapshot', id: 'Snapshot telemetri seluruh disk' },
  epRefresh: { en: 'Rescan hardware and return fresh telemetry', id: 'Pindai ulang hardware dan kembalikan telemetri terbaru' },
  epGlossary: { en: 'Flash technology glossary', id: 'Glosarium teknologi flash' },
  epLogs: { en: 'Recent application log entries', id: 'Entri log aplikasi terbaru' },
  epStorageResults: { en: 'Latest storage scan results', id: 'Hasil pemindaian penyimpanan terbaru' },
  epDirty: { en: 'NTFS dirty-bit status for a volume', id: 'Status dirty bit NTFS untuk sebuah volume' },
  epRefreshPost: { en: 'Trigger a rescan from automation', id: 'Picu pemindaian ulang dari otomasi' },
  epPreferences: { en: 'Persist the UI language preference', id: 'Simpan preferensi bahasa antarmuka' },
};

// ---------------------------------------------------------------------------
// Shared UI utilities
// ---------------------------------------------------------------------------
function showToast(message, type = 'info', duration = 4200) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const palette = {
    success: 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100',
    error: 'border-rose-500/40 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100',
    warning: 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100',
    info: 'border-blue-500/40 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100',
  };
  const icons = { success: 'check-circle-2', error: 'alert-octagon', warning: 'alert-triangle', info: 'info' };
  const el = document.createElement('div');
  el.className = `pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium shadow-lg transition-all ${palette[type] || palette.info}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 shrink-0 mt-0.5"></i><span class="leading-relaxed">${escapeHtml(message)}</span>`;
  container.appendChild(el);
  safeCreateIcons();
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 180);
  }, duration);
}

function getWindowsHealthMeta(disk) {
  const status = disk && disk.windows_health ? disk.windows_health.status : null;
  if (!status) return null;
  const map = {
    healthy: {
      tone: 'good',
      label: txt('Healthy', 'Sehat'),
      short: txt('HEALTHY', 'SEHAT'),
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
    warning: {
      tone: 'caution',
      label: txt('Needs attention', 'Perlu perhatian'),
      short: txt('ATTENTION', 'PERHATIAN'),
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    },
    unhealthy: {
      tone: 'bad',
      label: txt('Unhealthy', 'Tidak sehat'),
      short: txt('UNHEALTHY', 'TIDAK SEHAT'),
      className: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    },
  };
  return map[status] || null;
}

function telemetryReasonText(disk) {
  switch (disk && disk.telemetry_reason) {
    case 'not-elevated':
      return txt(
        'Windows blocks raw S.M.A.R.T access for standard apps. Restart as Administrator to read wear and temperature.',
        'Windows memblokir akses S.M.A.R.T mentah untuk aplikasi standar. Mulai ulang sebagai Administrator untuk membaca wear dan suhu.'
      );
    case 'nvme-smart-not-exposed':
      return txt(
        'The NVMe driver does not expose raw S.M.A.R.T registers to apps. Windows still reports the device health below.',
        'Driver NVMe tidak mengekspos register S.M.A.R.T mentah ke aplikasi. Windows tetap melaporkan status perangkat di bawah ini.'
      );
    case 'smart-not-exposed':
      return txt(
        'This controller does not expose raw S.M.A.R.T registers to apps. Windows still reports the device health below.',
        'Controller ini tidak mengekspos register S.M.A.R.T mentah ke aplikasi. Windows tetap melaporkan status perangkat di bawah ini.'
      );
    default:
      return '';
  }
}

function getDataSourceMeta(disk) {
  const source = disk.data_source || 'unavailable';
  if (source === 'live-wmi') {
    return {
      key: source,
      label: currentLang === 'en' ? 'LIVE WMI' : 'WMI LIVE',
      detail: currentLang === 'en' ? 'Live registers via Windows WMI/CIM' : 'Register live via Windows WMI/CIM',
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    };
  }
  if (source === 'cdi-cache') {
    const date = disk.data_source_date ? ` · ${disk.data_source_date}` : '';
    return {
      key: source,
      label: currentLang === 'en' ? 'CDI CACHE' : 'CACHE CDI',
      detail: (currentLang === 'en' ? 'Historical CrystalDiskInfo snapshot' : 'Snapshot historis CrystalDiskInfo') + date,
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    };
  }
  if (source === 'windows-health') {
    return {
      key: source,
      label: currentLang === 'en' ? 'WINDOWS HEALTH' : 'STATUS WINDOWS',
      detail: txt(
        'Device health reported by Windows; raw S.M.A.R.T is not exposed by the driver.',
        'Status kesehatan perangkat dari Windows; S.M.A.R.T mentah tidak diekspos driver.'
      ),
      className: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    };
  }
  const reason = telemetryReasonText(disk);
  return {
    key: source,
    label: currentLang === 'en' ? 'UNAVAILABLE' : 'TIDAK TERSEDIA',
    detail: reason || (currentLang === 'en' ? 'Telemetry could not be read.' : 'Telemetri tidak dapat dibaca.'),
    className: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  };
}

function jsPathArg(path) {
  return encodeURIComponent(String(path || '')).replace(/'/g, '%27');
}

function txt(en, id) {
  return currentLang === 'en' ? en : id;
}

function staticText(key) {
  const entry = STATIC_I18N[key];
  if (!entry) return null;
  return entry[currentLang] !== undefined ? entry[currentLang] : entry.en;
}

function applyStaticI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = staticText(el.getAttribute('data-i18n'));
    if (value !== null) el.textContent = value;
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const value = staticText(el.getAttribute('data-i18n-html'));
    if (value !== null) el.innerHTML = value;
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const value = staticText(el.getAttribute('data-i18n-title'));
    if (value !== null) el.setAttribute('title', value);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const value = staticText(el.getAttribute('data-i18n-placeholder'));
    if (value !== null) el.setAttribute('placeholder', value);
  });
}

function syncApiDocs() {
  const origin = window.location.origin;
  const tokenInput = document.getElementById('api-token-value');
  if (tokenInput) tokenInput.value = APP_TOKEN;
  const baseUrl = document.getElementById('api-base-url');
  if (baseUrl) baseUrl.textContent = origin;
  const sidebarBase = document.getElementById('api-base-url-sidebar');
  if (sidebarBase) sidebarBase.textContent = origin.replace('http://', '');
  const example = document.getElementById('api-example');
  if (example) {
    example.textContent = `curl -s ${origin}/api/disks -H "X-App-Token: ${APP_TOKEN}"`;
  }
}

async function copyApiToken() {
  try {
    await navigator.clipboard.writeText(APP_TOKEN);
    showToast(txt('API token copied.', 'Token API disalin.'), 'success');
  } catch (err) {
    showToast(txt('Could not copy the token.', 'Gagal menyalin token.'), 'error');
  }
}

async function copyApiExample() {
  const example = document.getElementById('api-example');
  try {
    await navigator.clipboard.writeText(example ? example.textContent : '');
    showToast(txt('Example copied.', 'Contoh perintah disalin.'), 'success');
  } catch (err) {
    showToast(txt('Could not copy the example.', 'Gagal menyalin contoh.'), 'error');
  }
}

function formatNumberOrDash(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return `${Number(value).toLocaleString()}${suffix}`;
}

function healthValue(ha) {
  const value = ha && ha.true_health !== undefined ? ha.true_health : null;
  return value === null || Number.isNaN(Number(value)) ? null : Number(value);
}

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

  // 1. Initial fast boot: check localStorage synchronously, default strictly to English 'en'
  const localLang = localStorage.getItem('diagnose_lang');
  const initialLang = (localLang === 'id' || localLang === 'en') ? localLang : 'en';
  setLanguage(initialLang, false);

  // 2. Background sync: synchronize with durable server-side profile preferences
  syncServerPreferences();

  initSurfaceGrid();
  startHeartbeat();
  fetchDisksData();
}

// Heartbeat & lifecycle: memastikan server backend otomatis berhenti saat jendela desktop ditutup
function startHeartbeat() {
  // The server watchdog exits after the heartbeat stops for ~10 seconds.
  // Do not call /api/shutdown here: a simple reload must not kill the backend.
  setInterval(() => {
    apiFetch('/api/heartbeat').catch(() => {});
  }, 2500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Penangan Penggantian Bahasa
function setLanguage(lang, triggerRender = true) {
  currentLang = (lang === 'id' || lang === 'en') ? lang : 'en';
  try {
    localStorage.setItem('diagnose_lang', currentLang);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }

  // Persist preference to local server profile for bulletproof cross-session persistence
  apiFetch('/api/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: currentLang })
  }).catch(() => {});

  const btnId = document.getElementById('btn-lang-id');
  const btnEn = document.getElementById('btn-lang-en');

    if (btnEn) {
    btnEn.classList.toggle('is-active', lang === 'en');
    btnEn.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
  }
  if (btnId) {
    btnId.classList.toggle('is-active', lang === 'id');
    btnId.setAttribute('aria-pressed', lang === 'id' ? 'true' : 'false');
  }

  const t = I18N[lang];
  const subtitle = document.getElementById('header-subtitle');
  if (subtitle) {
    subtitle.textContent = lang === 'en'
      ? 'Evidence first. Never invent telemetry.'
      : 'Bukti dulu. Tidak mengarang telemetri.';
  }
  document.getElementById('txt-installed-disks').textContent = t.installedDisks;
  const diskCountBadge = document.getElementById('disk-count-badge');
  if (diskCountBadge) {
    diskCountBadge.textContent = allDisks.length > 0
      ? t.disksDetected.replace('{0}', allDisks.length)
      : (currentLang === 'en' ? 'Loading...' : 'Memuat...');
  }
  document.getElementById('txt-mode-layman').textContent = t.modeLayman;
  document.getElementById('txt-mode-tech').textContent = t.modeTech;
  document.getElementById('txt-mode-scanner').textContent = t.modeScanner;
  const txtModeStorage = document.getElementById('txt-mode-storage');
  if (txtModeStorage) txtModeStorage.textContent = t.modeStorage || 'Penyimpanan & Bersih';
  const txtModeLogs = document.getElementById('txt-mode-logs');
  if (txtModeLogs) txtModeLogs.textContent = currentLang === 'en' ? 'Logs' : 'Log';
  const txtStorageTitle = document.getElementById('txt-storage-title');
  if (txtStorageTitle && t.storageTitle) txtStorageTitle.textContent = t.storageTitle;
  const txtStorageSubtitle = document.getElementById('txt-storage-subtitle');
  if (txtStorageSubtitle && t.storageSubtitle) txtStorageSubtitle.textContent = t.storageSubtitle;
  document.getElementById('txt-refresh').textContent = t.refresh;
  const exportLabel = document.getElementById('txt-export-report');
  if (exportLabel) exportLabel.textContent = currentLang === 'en' ? 'Export report' : 'Ekspor laporan';
  const topbarEyebrow = document.getElementById('topbar-eyebrow');
  if (topbarEyebrow) topbarEyebrow.textContent = currentLang === 'en' ? 'Active drive' : 'Drive aktif';
  const sideWorkspace = document.getElementById('lbl-sidebar-workspace');
  if (sideWorkspace) sideWorkspace.textContent = currentLang === 'en' ? 'Diagnose' : 'Diagnosa';
  const sideMaintain = document.getElementById('lbl-sidebar-maintain');
  if (sideMaintain) sideMaintain.textContent = currentLang === 'en' ? 'Maintain' : 'Perawatan';
  const sideTools = document.getElementById('lbl-sidebar-tools');
  if (sideTools) sideTools.textContent = currentLang === 'en' ? 'Tools' : 'Alat';
  const sidePreferences = document.getElementById('lbl-sidebar-preferences');
  if (sidePreferences) sidePreferences.textContent = currentLang === 'en' ? 'Preferences' : 'Preferensi';

  const storageLabels = {
    'txt-btn-storage-scan': ['Scan Disk', 'Pindai Disk'],
    'lbl-rec-cleanable': ['RECLAIMABLE', 'POTENSI HEMAT'],
    'txt-rec-banner-title': ['Safe cleanup recommendations', 'Rekomendasi pembersihan aman'],
    'txt-rec-banner-sub': ['Remove installer caches, crash dumps, and temporary files without touching personal data.', 'Hapus cache installer, crash dump, dan file temporary tanpa mengganggu data pribadi.'],
    'txt-sub-recommend': ['Cleanup recommendations', 'Rekomendasi pembersihan'],
    'txt-sub-large': ['Large files & folders', 'Berkas & folder besar'],
    'txt-sub-old': ['Old files & apps', 'Berkas / aplikasi lawas'],
    'txt-sub-dup': ['Duplicate files', 'Berkas duplikat'],
    'lbl-large-filter': ['Size:', 'Ukuran:'],
    'lbl-large-type': ['Type:', 'Tipe:'],
    'lbl-large-sort': ['Order:', 'Urutan:'],
    'lbl-old-filter': ['Inactive for:', 'Batas ketidakaktifan:'],
    'txt-dup-banner-title': ['Identical duplicate file management', 'Manajemen berkas duplikat identik'],
    'txt-dup-banner-sub': ['Select the copies to remove and keep the original file intact.', 'Pilih salinan yang ingin dihapus tanpa kehilangan berkas asli.'],
    'btn-dup-keep-newest': ['Keep newest', 'Pertahankan terbaru'],
    'btn-dup-keep-oldest': ['Keep oldest', 'Pertahankan tertua'],
    'lbl-seg-user': ['User files', 'Berkas pengguna'],
    'lbl-seg-app': ['Applications', 'Aplikasi'],
    'lbl-seg-system': ['Windows system', 'Sistem Windows'],
    'lbl-seg-recycle': ['Recycle Bin', 'Tempat sampah'],
    'lbl-seg-other': ['Other / unclassified', 'Lainnya / belum terklasifikasi'],
  };
  Object.entries(storageLabels).forEach(([id, labels]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt(labels[0], labels[1]);
  });
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

  const elLblNand = document.getElementById('lbl-nand-type');
  if (elLblNand) elLblNand.textContent = t.lblNandType;
  const elLblCache = document.getElementById('lbl-cache-type');
  if (elLblCache) elLblCache.textContent = t.lblCacheType;
  const elFlashTitle = document.getElementById('txt-flash-arch-title');
  if (elFlashTitle) elFlashTitle.textContent = t.flashArchTitle;
  const elFlashSub = document.getElementById('txt-flash-arch-subtitle');
  if (elFlashSub) elFlashSub.textContent = t.flashArchSubtitle;
  const elBtnGlossary = document.getElementById('txt-btn-glossary');
  if (elBtnGlossary) elBtnGlossary.textContent = t.btnGlossary;
  const elHwNandLbl = document.getElementById('lbl-hw-nand');
  if (elHwNandLbl) elHwNandLbl.textContent = t.lblHwNand;
  const elHwCacheLbl = document.getElementById('lbl-hw-cache');
  if (elHwCacheLbl) elHwCacheLbl.textContent = t.lblHwCache;
  const elHwSlcLbl = document.getElementById('lbl-hw-slc');
  if (elHwSlcLbl) elHwSlcLbl.textContent = t.lblHwSlc;
  const elHwPeLbl = document.getElementById('lbl-hw-pe');
  if (elHwPeLbl) elHwPeLbl.textContent = t.lblHwPe;
  const elHwSumTitle = document.getElementById('lbl-hw-summary-title');
  if (elHwSumTitle) elHwSumTitle.textContent = t.lblHwSummaryTitle;
  const elActFeatLbl = document.getElementById('lbl-active-features');
  if (elActFeatLbl) elActFeatLbl.textContent = t.lblActiveFeatures;
  const elModalTitle = document.getElementById('modal-glossary-title');
  if (elModalTitle) elModalTitle.textContent = t.modalGlossaryTitle;
  const elModalSub = document.getElementById('modal-glossary-subtitle');
  if (elModalSub) elModalSub.textContent = t.modalGlossarySubtitle;
  const elModalTip = document.getElementById('modal-footer-tip');
  if (elModalTip) elModalTip.textContent = t.modalFooterTip;

  const themeText = document.getElementById('theme-text');
  if (themeText) {
    themeText.textContent = isDarkTheme ? t.themeDark : t.themeLight;
  }

  const scanBtnText = document.getElementById('txt-scan-btn');
  if (scanBtnText) {
    scanBtnText.textContent = isScanning ? t.scanPause : (currentScanBlock > 0 && currentScanBlock < TOTAL_SCAN_BLOCKS ? t.scanResume : t.scanStart);
  }

  document.documentElement.lang = currentLang;
  document.title = currentLang === 'en'
    ? 'DiagnoseMyDisk — Disk health, bad sectors & S.M.A.R.T telemetry'
    : 'DiagnoseMyDisk — Kesehatan disk, bad sector & telemetri S.M.A.R.T';
  applyStaticI18n();
  syncApiDocs();

  if (triggerRender && allDisks.length > 0) {
    renderDriveTabs();
    renderActiveDisk();
  }
  if (triggerRender) {
    updateDriveUsageHero();
    if (typeof renderStorageDriveDropdown === 'function' && document.getElementById('storage-drive-select')) {
      renderStorageDriveDropdown();
    }
    if (storageResults) {
      renderStorageResults(storageResults);
    } else {
      renderRecommendationsSubTab();
    }
  }
  if (triggerRender && currentMode === 'logs') {
    fetchAppLogs();
  }
}

// Background preferences synchronization (v3.0.0)
async function syncServerPreferences() {
  try {
    const res = await apiFetch('/api/preferences');
    const data = await res.json();
    if (data.success && data.preferences && data.preferences.language) {
      const serverLang = data.preferences.language;
      if (serverLang !== currentLang && (serverLang === 'en' || serverLang === 'id')) {
        setLanguage(serverLang, true);
      }
    }
  } catch (err) {
    // Fail silently to local storage
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
    root.style.colorScheme = 'dark';
    body.classList.add('dark');
    body.classList.add('dark-theme');
    body.style.colorScheme = 'dark';
    localStorage.setItem('diagnose_theme', 'dark');
    if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
    if (themeText) themeText.textContent = t.themeDark;
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    body.classList.remove('dark');
    body.classList.remove('dark-theme');
    body.style.colorScheme = 'light';
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
  const btnStorage = document.getElementById('btn-mode-storage');
  const btnLogs = document.getElementById('btn-mode-logs');
  const btnApi = document.getElementById('btn-open-api');
  const viewLayman = document.getElementById('view-layman');
  const viewTech = document.getElementById('view-tech');
  const viewScanner = document.getElementById('view-scanner');
  const viewStorage = document.getElementById('view-storage');
  const viewLogs = document.getElementById('view-logs');
  const viewApi = document.getElementById('view-api');

  const navItems = {
    layman: btnLayman,
    tech: btnTech,
    scanner: btnScanner,
    storage: btnStorage,
    logs: btnLogs,
    api: btnApi,
  };
  Object.entries(navItems).forEach(([key, button]) => {
    if (!button) return;
    const isActive = key === mode;
    button.classList.toggle('is-active', isActive);
    if (isActive) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  if (viewLayman) viewLayman.classList.toggle('hidden', mode !== 'layman');
  if (viewTech) viewTech.classList.toggle('hidden', mode !== 'tech');
  if (viewScanner) viewScanner.classList.toggle('hidden', mode !== 'scanner');
  if (viewStorage) viewStorage.classList.toggle('hidden', mode !== 'storage');
  if (viewLogs) viewLogs.classList.toggle('hidden', mode !== 'logs');
  if (viewApi) viewApi.classList.toggle('hidden', mode !== 'api');

  // Each mode owns its workspace. The large hero is reserved for Summary.
  const isSummary = mode === 'layman';
  const isDataView = mode === 'layman' || mode === 'tech' || mode === 'scanner';
  const heroSection = document.getElementById('disk-hero-section');
  if (heroSection) heroSection.classList.toggle('hidden', !isSummary);
  const driveSelector = document.getElementById('drive-selector-section');
  if (driveSelector) driveSelector.classList.toggle('hidden', !isDataView);
  const gapBanner = document.getElementById('telemetry-gap-banner');
  if (gapBanner) gapBanner.classList.toggle('hidden', !isSummary);
  const maskingBanner = document.getElementById('masking-banner');
  if (maskingBanner && !isSummary) maskingBanner.classList.add('hidden');

  if (isDataView && allDisks.length > 0) {
    renderActiveDisk();
  }

  if (mode === 'storage') {
    initStorageView();
  }
  if (mode === 'logs') {
    startLogsPolling();
  } else {
    stopLogsPolling();
  }
  if (mode === 'api') {
    syncApiDocs();
  }

  const main = document.querySelector('main');
  if (main) main.scrollTop = 0;

  safeCreateIcons();
}

// Relaunch as Administrator Action
async function relaunchAsAdmin() {
  try {
    const resp = await apiFetch('/api/relaunch_admin', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showToast(txt('Restarting with Administrator privileges...', 'Memulai ulang dengan hak Administrator...'), 'info');
    } else {
      showToast(data.error || txt('Failed to restart the app.', 'Gagal memulai ulang aplikasi.'), 'error');
    }
  } catch (err) {
    showToast(txt(`Restart failed: ${err.message}`, `Gagal memulai ulang: ${err.message}`), 'error');
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
    const resp = await apiFetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
    const data = await resp.json();

    // Cek status hak akses Administrator
    isAdminMode = data.is_admin !== false;
    const adminBanner = document.getElementById('non-admin-banner');
    const adminDot = document.getElementById('admin-dot');
    const lblAdmin = document.getElementById('lbl-admin-status');

    if (isAdminMode) {
      if (adminBanner) adminBanner.classList.add('hidden');
      if (adminDot) adminDot.className = 'admin-dot is-ok';
      if (lblAdmin) {
        lblAdmin.textContent = 'Admin OK';
        lblAdmin.className = 'sidebar-admin-text is-ok';
      }
    } else {
      if (adminBanner) adminBanner.classList.remove('hidden');
      if (adminDot) adminDot.className = 'admin-dot is-warn';
      if (lblAdmin) {
        lblAdmin.textContent = 'Non-Admin';
        lblAdmin.className = 'sidebar-admin-text is-warn';
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
    const trueHealth = healthValue(ha);
    const isMasking = ha.is_masking || false;
    const source = getDataSourceMeta(disk);
    const winMeta = getWindowsHealthMeta(disk);

    let badgeClass = 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200';
    if (trueHealth !== null) {
      if (trueHealth < 60) {
        badgeClass = 'health-badge-bad';
      } else if (trueHealth < 90 || isMasking) {
        badgeClass = 'health-badge-caution';
      } else {
        badgeClass = 'health-badge-good';
      }
    } else if (winMeta) {
      badgeClass = winMeta.tone === 'bad' ? 'health-badge-bad' : (winMeta.tone === 'caution' ? 'health-badge-caution' : 'health-badge-good');
    }

    const driveLetters = disk.drive_letters_str || '-';
    const sizeGb = disk.size_gb ? `${disk.size_gb} GB` : 'N/A';
    const hw = disk.hardware_profile || {};
    const mediaBadge = hw.cell_tech_name ? (hw.cell_tech_name.includes('TLC') ? 'TLC' : (hw.cell_tech_name.includes('QLC') ? 'QLC' : (hw.cell_tech_name.includes('SMR') ? 'SMR' : disk.bus_type))) : disk.bus_type;

    return `
      <div onclick="selectDisk(${idx})" class="disk-tab-card ${isActive ? 'active' : ''}" role="button" tabindex="0" title="${escapeHtml(disk.name)} · ${escapeHtml(driveLetters)} · ${escapeHtml(String(disk.size_gb || 'N/A'))} GB" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectDisk(${idx});}">
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-0.5 truncate">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">${escapeHtml(disk.name)}</span>
              <span class="px-1 py-0.2 rounded text-[9px] font-mono font-bold border ${source.className}" title="${escapeHtml(source.detail)}">${source.label}</span>
            </div>
            <div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-1.5">
              <span class="font-bold text-blue-600 dark:text-blue-400">${sizeGb}</span>
              <span>•</span>
              <span class="px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[10px]">${escapeHtml(mediaBadge)}</span>
              <span>•</span>
              <span class="font-bold text-zinc-700 dark:text-zinc-300">${escapeHtml(driveLetters)}</span>
            </div>
          </div>
          
          <div class="shrink-0 flex flex-col items-end">
            <span class="${badgeClass} px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight">
              ${trueHealth === null ? (winMeta ? winMeta.short : 'N/A') : `${trueHealth}%`}
            </span>
            ${isMasking ? `<span class="text-[9px] text-rose-600 font-bold tracking-tighter">${txt('MASKED', 'TERKUNCI')}</span>` : ''}
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
  const trueHealth = healthValue(ha);
  const reportedHealth = ha.reported_health !== undefined ? ha.reported_health : null;
  const isMasking = ha.is_masking || false;
  const source = getDataSourceMeta(disk);
  const gaps = Array.isArray(disk.data_gaps) ? disk.data_gaps : [];
  const winMeta = getWindowsHealthMeta(disk);
  const reasonText = telemetryReasonText(disk);

  const topName = document.getElementById('topbar-disk-name');
  const topMeta = document.getElementById('topbar-disk-meta');
  const topChip = document.getElementById('topbar-health-chip');
  const topSource = document.getElementById('topbar-source-badge');
  const topUpdated = document.getElementById('topbar-updated');
  if (topName) topName.textContent = disk.name;
  if (topMeta) {
    const size = disk.size_gb ? `${disk.size_gb} GB` : txt('size N/A', 'ukuran N/A');
    topMeta.textContent = `${size} · ${disk.media_type || 'N/A'} / ${disk.bus_type || 'N/A'} · ${disk.drive_letters_str || '-'}`;
  }
  if (topChip) {
    if (trueHealth === null && winMeta) {
      topChip.textContent = winMeta.short;
      topChip.className = 'topbar-chip';
      topChip.classList.add(winMeta.tone === 'bad' ? 'is-bad' : (winMeta.tone === 'caution' ? 'is-warn' : 'is-good'));
    } else {
      topChip.textContent = trueHealth === null
        ? (currentLang === 'en' ? 'HEALTH N/A' : 'KESEHATAN N/A')
        : `${trueHealth}% ${currentLang === 'en' ? 'TRUE HEALTH' : 'KESEHATAN'}`;
      topChip.className = 'topbar-chip';
      if (trueHealth === null) topChip.classList.add('is-unknown');
      else if (trueHealth < 60) topChip.classList.add('is-bad');
      else if (trueHealth < 90 || isMasking) topChip.classList.add('is-warn');
      else topChip.classList.add('is-good');
    }
  }
  if (topSource) {
    topSource.textContent = source.label;
    topSource.title = source.detail;
  }
  if (topUpdated) {
    topUpdated.textContent = `${currentLang === 'en' ? 'Updated' : 'Diperbarui'}: ${new Date().toLocaleTimeString()}`;
  }

  const sourceBadge = document.getElementById('disk-data-source-badge');
  if (sourceBadge) {
    sourceBadge.textContent = source.label;
    sourceBadge.title = source.detail;
    sourceBadge.className = `px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${source.className}`;
  }
  const gapBanner = document.getElementById('telemetry-gap-banner');
  const gapText = document.getElementById('telemetry-gap-text');
  const gapBadge = document.getElementById('telemetry-source-badge');
  if (gapBanner && gapText) {
    if ((source.key === 'unavailable' || gaps.length > 0) && currentMode === 'layman') {
      gapBanner.classList.remove('hidden');
      let detail = reasonText || source.detail;
      if (gaps.length > 0 && !winMeta) {
        detail += ` · ${txt('Unavailable', 'Tidak tersedia')}: ${gaps.join(', ')}`;
      }
      gapText.textContent = detail;
      if (gapBadge) {
        gapBadge.textContent = source.label;
        gapBadge.className = winMeta
          ? 'font-mono font-bold px-2 py-0.5 rounded border border-blue-400/40 bg-blue-500/10 shrink-0'
          : 'font-mono font-bold px-2 py-0.5 rounded border border-amber-400/40 bg-amber-500/10 shrink-0';
      }
    } else {
      gapBanner.classList.add('hidden');
    }
  }

  // Masking Banner
  const maskingBanner = document.getElementById('masking-banner');
  const maskingText = document.getElementById('masking-text');
  if (isMasking && currentMode === 'layman') {
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
  const badgeSub = document.getElementById('badge-sub');
  const cdiClaimVal = document.getElementById('cdi-claim-val');
  const badgeCdiCompare = document.getElementById('badge-cdi-compare');

  if (badgePct) badgePct.textContent = trueHealth === null ? (winMeta ? '—' : 'N/A') : `${trueHealth}%`;
  if (badgeSub) {
    badgeSub.textContent = trueHealth === null && winMeta
      ? txt('Device status', 'Status perangkat')
      : t.trueHealthSub;
  }

  if (badgeCdiCompare) {
    if (reportedHealth === null) {
      if (winMeta) {
        badgeCdiCompare.innerHTML = `${txt('Windows reports', 'Windows melaporkan')} <span class="font-bold text-zinc-900 dark:text-zinc-100">${winMeta.label}</span>. ${reasonText ? `<span class="block mt-1">${escapeHtml(reasonText)}</span>` : ''}`;
      } else {
        badgeCdiCompare.innerHTML = `<span class="text-zinc-500 dark:text-zinc-400">${reasonText ? escapeHtml(reasonText) : txt('No comparative health source', 'Tidak ada sumber pembanding')}</span>`;
      }
    } else if (isMasking) {
      badgeCdiCompare.innerHTML = `${t.standardReaderReport} <span id="cdi-claim-val" class="text-zinc-900 dark:text-zinc-100 font-mono font-bold">${reportedHealth}%</span> <span class="text-rose-600 font-bold">${t.lockedStatus}</span>`;
    } else {
      badgeCdiCompare.innerHTML = `${t.standardReaderReport} <span id="cdi-claim-val" class="text-zinc-900 dark:text-zinc-100 font-mono font-bold">${reportedHealth}%</span> <span class="text-emerald-600 font-bold">${t.accurateStatus}</span>`;
    }
  } else if (cdiClaimVal) {
    cdiClaimVal.textContent = reportedHealth === null ? 'N/A' : `${reportedHealth}%`;
  }

  const orbitTone = trueHealth === null
    ? (winMeta ? winMeta.tone : 'unknown')
    : (trueHealth < 60 ? 'bad' : (trueHealth < 90 || isMasking ? 'caution' : 'good'));
  const orbitPct = trueHealth !== null
    ? trueHealth
    : (winMeta ? (winMeta.tone === 'good' ? 100 : (winMeta.tone === 'caution' ? 55 : 18)) : 0);
  badgeHealth.className = `health-orbit health-orbit--${orbitTone} select-none`;
  badgeHealth.style.setProperty('--health', `${orbitPct}%`);
  if (trueHealth === null) {
    badgeLabel.textContent = winMeta ? winMeta.label : (currentLang === 'en' ? 'Unknown' : 'Tidak Diketahui');
  } else if (trueHealth < 60) {
    badgeLabel.textContent = t.statusBad;
  } else if (trueHealth < 90 || isMasking) {
    badgeLabel.textContent = t.statusCaution;
  } else {
    badgeLabel.textContent = t.statusGood;
  }

  // Suhu Operasional (tidak mengarang nilai bila sensor tidak tersedia)
  const temp = disk.temperature_c !== undefined && disk.temperature_c !== null ? Number(disk.temperature_c) : null;
  const tempBadge = document.getElementById('badge-temp');
  const badgeTempDesc = document.getElementById('badge-temp-desc');
  if (tempBadge) tempBadge.textContent = temp === null ? 'N/A' : `${temp} °C`;
  if (badgeTempDesc) {
    const isNvme = String(disk.bus_type || '').toUpperCase() === 'NVME';
    const optimalLimit = isNvme ? 65 : 45;
    const warmLimit = isNvme ? 75 : 55;
    if (temp === null) {
      badgeTempDesc.textContent = currentLang === 'en' ? 'Temperature sensor unavailable' : 'Sensor suhu tidak tersedia';
      badgeTempDesc.className = 'text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1';
    } else if (temp <= optimalLimit) {
      badgeTempDesc.textContent = t.tempOptimal;
      badgeTempDesc.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1';
    } else if (temp <= warmLimit) {
      badgeTempDesc.textContent = t.tempNormal;
      badgeTempDesc.className = 'text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1';
    } else {
      badgeTempDesc.textContent = t.tempHot;
      badgeTempDesc.className = 'text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-1 animate-pulse';
    }
  }

  // Header Drive Hero
  document.getElementById('disk-model-name').textContent = disk.name;
  document.getElementById('disk-capacity-type').textContent = disk.size_gb ? `${disk.size_gb} GB` : 'N/A';
  document.getElementById('disk-interface-type').textContent = `${disk.media_type || 'N/A'} (${disk.bus_type || 'N/A'})`;
  document.getElementById('disk-drive-letters').textContent = disk.drive_letters_str || '-';

  // Hardware Profile & NAND Telemetry
  const hw = disk.hardware_profile || {};
  const hwExpl = hw.explanation || {};
  const hwFeatures = hw.features || [];

  // Hero Badges (Interactive Flash & Cache chips)
  const heroBadgesContainer = document.getElementById('disk-hero-badges');
  if (heroBadgesContainer) {
    let heroBadgesHtml = '';
    if (hw.cell_tech_name) {
      heroBadgesHtml += `<button onclick="openGlossaryModal()" class="cursor-pointer px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:scale-105 transition-transform" title="Klik untuk panduan edukasi sel flash">${hw.cell_tech_name}</button>`;
    }
    if (hw.dram_cache) {
      const cacheShort = hw.dram_cache.includes('HMB') ? 'HMB (DMA)' : (hw.dram_cache.includes('Dedicated') ? 'DRAM Cache' : (hw.dram_cache.includes('256') ? '256MB DRAM' : 'SLC Cache'));
      heroBadgesHtml += `<button onclick="openGlossaryModal()" class="cursor-pointer px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 hover:scale-105 transition-transform" title="Klik untuk penjelasan arsitektur cache">${cacheShort}</button>`;
    }
    if (hwFeatures.some(f => f.tag === 'TRIM')) {
      heroBadgesHtml += `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">TRIM</span>`;
    }
    if (hw.profile_confidence === 'generic-estimate') {
      const note = currentLang === 'en' ? (hw.profile_note_en || '') : (hw.profile_note_id || '');
      heroBadgesHtml += `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700" title="${escapeHtml(note)}">${currentLang === 'en' ? 'ESTIMATED PROFILE' : 'PROFIL ESTIMASI'}</span>`;
    }
    heroBadgesContainer.innerHTML = heroBadgesHtml;
  }

  // Jam Operasional
  const poh = disk.power_on_hours !== undefined && disk.power_on_hours !== null ? Number(disk.power_on_hours) : null;
  const powYearsEl = document.getElementById('disk-power-years');
  const pohTextEl = document.getElementById('disk-poh-text');
  if (poh === null) {
    if (powYearsEl) powYearsEl.textContent = currentLang === 'en' ? 'Power-on time unavailable' : 'Jam terbang tidak tersedia';
    if (pohTextEl) pohTextEl.textContent = t.pohText.replace('{0}', 'N/A');
  } else {
    if (powYearsEl) powYearsEl.textContent = t.yearsOn.replace('{0}', (poh / 8760).toFixed(1));
    if (pohTextEl) pohTextEl.textContent = t.pohText.replace('{0}', poh.toLocaleString());
  }

  // Spesifikasi Teknis
  document.getElementById('spec-firmware').textContent = disk.firmware || 'N/A';
  document.getElementById('spec-serial').textContent = disk.serial_number || 'N/A';
  const interfaceSpeed = disk.bus_type === 'NVMe' ? 'PCIe NVMe' : `${disk.bus_type || 'SATA'} 6.0 Gb/s`;
  document.getElementById('spec-interface').textContent = interfaceSpeed;

  const specNandElem = document.getElementById('spec-nand-type');
  if (specNandElem) specNandElem.textContent = hw.cell_tech_name || 'N/A';

  const specCacheElem = document.getElementById('spec-cache-type');
  if (specCacheElem) {
    const cacheSummary = hw.dram_cache ? (hw.dram_cache.includes('HMB') ? 'HMB (DMA)' : (hw.dram_cache.includes('Dedicated') ? 'Dedicated DRAM' : (hw.dram_cache.includes('256') ? '256MB DRAM' : 'SLC Caching'))) : '-';
    specCacheElem.textContent = cacheSummary;
  }

  document.getElementById('spec-poc').textContent =
    disk.power_on_count !== undefined && disk.power_on_count !== null
      ? t.pocText.replace('{0}', Number(disk.power_on_count).toLocaleString())
      : 'N/A';

  const hostWritesTb = metrics.host_writes_tb !== undefined && metrics.host_writes_tb !== null
    ? `${metrics.host_writes_tb} TB`
    : 'N/A';
  const hostReadsTb = metrics.host_reads_tb !== undefined && metrics.host_reads_tb !== null
    ? `${metrics.host_reads_tb} TB`
    : 'N/A';
  document.getElementById('spec-reads').textContent = hostReadsTb;
  document.getElementById('spec-writes').textContent = hostWritesTb;
  document.querySelectorAll('#disk-hero-section .spec-value').forEach((el) => {
    el.title = el.textContent;
  });

  // 4 Pillars Flash & Hardware Grid
  const elHwNand = document.getElementById('hw-nand-type');
  if (elHwNand) elHwNand.textContent = hw.nand_type || disk.media_type;
  const elHwNandSub = document.getElementById('hw-nand-sub');
  if (elHwNandSub) elHwNandSub.textContent = hw.cell_tech_name || (disk.media_type === 'SSD' ? '3D NAND Flash' : 'Piringan Magnetik');

  const elHwCache = document.getElementById('hw-cache-type');
  if (elHwCache) elHwCache.textContent = hw.dram_cache ? (hw.dram_cache.includes('HMB') ? 'DRAM-less (HMB)' : (hw.dram_cache.includes('Dedicated') ? 'DRAM Dedicated' : (hw.dram_cache.includes('256') ? '256 MB DRAM' : 'DRAM-less (SLC Caching)'))) : '-';
  const elHwCacheSub = document.getElementById('hw-cache-sub');
  if (elHwCacheSub) elHwCacheSub.textContent = hw.controller_family || '-';

  const elHwSlc = document.getElementById('hw-slc-type');
  if (elHwSlc) elHwSlc.textContent = hw.slc_cache_type || 'N/A';
  const elHwSlcSub = document.getElementById('hw-slc-sub');
  if (elHwSlcSub) elHwSlcSub.textContent = hw.interface_standard || 'N/A';

  const elHwPe = document.getElementById('hw-pe-cycles');
  if (elHwPe) elHwPe.textContent = hw.durability_pe_cycles || 'N/A';
  const elHwPeSub = document.getElementById('hw-pe-sub');
  if (elHwPeSub) elHwPeSub.textContent = currentLang === 'en' ? 'Rated write endurance' : 'Batas ketahanan hapus-tulis';

  // Hardware summary explanation
  const elHwSummaryText = document.getElementById('hw-summary-text');
  if (elHwSummaryText) {
    const summary = currentLang === 'en' ? (hwExpl.summary_en || hwExpl.summary_id || '') : (hwExpl.summary_id || '');
    elHwSummaryText.innerHTML = summary.replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-900 dark:text-zinc-50">$1</strong>');
  }

  // Active hardware features badges
  const elFeaturesContainer = document.getElementById('hw-features-container');
  if (elFeaturesContainer) {
    if (hwFeatures.length > 0) {
      elFeaturesContainer.innerHTML = hwFeatures.map(feat => {
        let colorClasses = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
        if (feat.badge_color === 'emerald') {
          colorClasses = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
        } else if (feat.badge_color === 'blue') {
          colorClasses = 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
        } else if (feat.badge_color === 'purple') {
          colorClasses = 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
        } else if (feat.badge_color === 'amber') {
          colorClasses = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
        } else if (feat.badge_color === 'rose') {
          colorClasses = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
        }

        const name = currentLang === 'en' ? (feat.name_en || feat.name_id) : (feat.name_id || feat.name_en);
        const desc = currentLang === 'en' ? (feat.desc_en || feat.desc_id) : (feat.desc_id || feat.desc_en);

        return `
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border ${colorClasses} select-none" title="${desc}">
            <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
            <span class="font-bold">${feat.tag}</span>
            <span class="text-[10px] opacity-75 hidden sm:inline">• ${name}</span>
          </div>
        `;
      }).join('');
    } else {
      elFeaturesContainer.innerHTML = `<span class="text-xs text-zinc-500 font-mono">S.M.A.R.T, TRIM (Standard Features Active)</span>`;
    }
  }

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

  const usedPct = totalCapGb > 0 ? Math.round((totalUsedGb / totalCapGb) * 100) : null;
  document.getElementById('capacity-text').textContent =
    totalCapGb > 0 ? `${totalUsedGb.toFixed(1)} / ${totalCapGb.toFixed(1)} GB` : 'N/A';
  document.getElementById('capacity-pct').textContent = usedPct === null ? 'N/A' : `${usedPct}%`;

  const capBar = document.getElementById('capacity-bar');
  capBar.style.width = usedPct === null ? '0%' : `${Math.min(100, usedPct)}%`;

  const capWarn = document.getElementById('capacity-warning');
  if (usedPct === null) {
    capBar.className = 'bg-zinc-400 h-2 rounded-full transition-all duration-300';
    capWarn.textContent = currentLang === 'en' ? 'Volume mapping unavailable' : 'Pemetaan volume tidak tersedia';
    capWarn.className = 'text-zinc-500 dark:text-zinc-400 font-medium';
  } else if (usedPct >= 85) {
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
    tooltipText.textContent = totalCapGb > 0
      ? t.capacityTooltip.replace('{0}', totalUsedGb.toFixed(1)).replace('{1}', totalFreeGb.toFixed(1))
      : (currentLang === 'en' ? 'Partition mapping unavailable' : 'Pemetaan partisi tidak tersedia');
  }

  const wafEl = document.getElementById('waf-multiplier');
  if (wafEl) {
    wafEl.textContent = metrics.waf !== undefined && metrics.waf !== null
      ? `Write Amplification: ${metrics.waf}x`
      : 'Write Amplification: N/A';
  }

  // Status Bar
  document.getElementById('status-active-disk').textContent = t.statusActivePrefix.replace('{0}', disk.device_id).replace('{1}', disk.name).replace('{2}', disk.drive_letters_str);
  document.getElementById('status-timestamp').textContent = t.timestampPrefix.replace('{0}', new Date().toLocaleTimeString());
  const telemetrySourceEl = document.getElementById('status-telemetry-source');
  if (telemetrySourceEl) telemetrySourceEl.textContent = `${currentLang === 'en' ? 'Source' : 'Sumber'}: ${source.detail}`;

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
            <span class="text-zinc-900 dark:text-zinc-100">${escapeHtml(title)}</span>
          </div>
          <p class="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">${escapeHtml(desc)}</p>
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
        <span>${escapeHtml(p)}</span>
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
    const thresh = a.threshold !== undefined && a.threshold !== null ? Number(a.threshold) : 0;
    const cur = a.current !== undefined && a.current !== null ? Number(a.current) : null;
    const rawInt = a.raw_int !== undefined && a.raw_int !== null ? Number(a.raw_int) : null;

    if (thresh > 0 && cur !== null && cur <= thresh) {
      sphereClass = 'status-sphere-rose';
    } else if (a.id === 0x05 && rawInt > 0) {
      sphereClass = 'status-sphere-amber';
    } else if (a.id === 0xA6 && rawInt > 0) {
      sphereClass = 'status-sphere-amber';
    } else if ((a.id === 0x0E || a.id === 0xBB) && rawInt > 0) {
      sphereClass = 'status-sphere-rose';
    } else if (cur === null) {
      sphereClass = 'status-sphere-gray';
    }

    const desc = currentLang === 'en' ? (a.desc_en || a.desc_id || '') : (a.desc_id || a.desc || '');
    const threshDisplay = thresh > 0 ? String(thresh) : '-';

    return `
      <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-850/60 transition-colors">
        <td class="py-2 px-2.5 text-center">
          <span class="${sphereClass}"></span>
        </td>
        <td class="py-2 px-2 text-zinc-500 dark:text-zinc-400 font-mono">${escapeHtml(a.id_hex || `0x${a.id.toString(16).toUpperCase().padStart(2, '0')}`)}</td>
        <td class="py-2 px-3">
          <div class="font-sans font-bold text-zinc-900 dark:text-zinc-100">${escapeHtml(a.name)}</div>
          <div class="font-sans text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight">${escapeHtml(desc)}</div>
        </td>
        <td class="py-2 px-2 text-center text-zinc-700 dark:text-zinc-300 font-mono tabular-nums">${cur === null ? '--' : cur}</td>
        <td class="py-2 px-2 text-center text-zinc-700 dark:text-zinc-300 font-mono tabular-nums">${a.worst !== undefined && a.worst !== null ? a.worst : '--'}</td>
        <td class="py-2 px-2 text-center text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">${threshDisplay}</td>
        <td class="py-2 px-3 text-right text-zinc-800 dark:text-zinc-200 font-mono tabular-nums">
          <span class="font-bold text-blue-600 dark:text-blue-400">${escapeHtml(a.raw_hex || 'N/A')}</span>
          <span class="text-[10px] text-zinc-400 block">${rawInt === null ? 'N/A' : rawInt.toLocaleString()}</span>
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

  let statusText = txt('Not scanned', 'Belum dipindai');
  if (b.status === 'excellent') statusText = txt('Excellent (<10ms)', 'Prima (<10ms)');
  else if (b.status === 'good') statusText = txt('Good (<50ms)', 'Baik (<50ms)');
  else if (b.status === 'slow') statusText = txt('Slow (50-150ms)', 'Cukup lambat (50-150ms)');
  else if (b.status === 'weak') statusText = txt('Very slow (150-500ms)', 'Sangat lambat (150-500ms)');
  else if (b.status === 'bad') statusText = txt(`Bad sector / error: ${b.error || '>500ms'}`, `Bad sector / error: ${b.error || '>500ms'}`);

  tooltip.innerHTML = `
    <div class="font-bold text-zinc-200">${txt('Block', 'Blok')} #${blockIndex + 1} / ${TOTAL_SCAN_BLOCKS}</div>
    <div class="text-[10px] text-zinc-400">Offset: ~${b.offset_gb} GB</div>
    <div class="text-[10px] text-zinc-300">${txt('Latency', 'Latensi')}: <span class="font-bold text-blue-400">${b.latency_ms} ms</span></div>
    <div class="text-[10px] text-zinc-300">${txt('Speed', 'Kecepatan')}: <span class="font-bold text-emerald-400">${b.speed_mb_s} MB/s</span></div>
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
    appendTerminalLog(txt(`[START] Starting surface scan on PhysicalDrive...`, `[START] Memulai pemindaian permukaan sektor pada PhysicalDrive...`));
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
    appendTerminalLog(txt(`[DONE] Scan complete: ${scanStats.bad} bad sectors, ${scanStats.weak} weak blocks.`, `[SELESAI] Pemindaian selesai: ${scanStats.bad} bad sector, ${scanStats.weak} blok lemah.`));
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
    const resp = await apiFetch(url);
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
    appendTerminalLog(txt(`[ERROR] Failed to scan block ${currentScanBlock}: ${err.message}`, `[ERROR] Gagal memindai blok ${currentScanBlock}: ${err.message}`));
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
    terminal.textContent = txt('Log cleared. Waiting for a repair or scan command...', 'Log dibersihkan. Menunggu instruksi pemulihan atau pemindaian...');
  }
}

// Aksi Perbaikan Sistem File (CHKDSK)
async function runChkdskAction() {
  const disk = allDisks[activeDiskIndex] || {};
  const drive = (disk.drive_letters && disk.drive_letters[0]) || 'C';
  const btn = document.getElementById('btn-action-chkdsk');

  if (btn) btn.disabled = true;
  appendTerminalLog(txt(`[CHKDSK] Checking file-system and cluster structure on drive ${drive}: ...`, `[CHKDSK] Memeriksa struktur cluster dan sistem file pada drive ${drive}: ...`));

  try {
    const resp = await apiFetch('/api/repair_chkdsk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drive })
    });
    const data = await resp.json();
    if (data.success) {
      appendTerminalLog(txt(`[CHKDSK OK]\n${data.output}`, `[CHKDSK SUKSES]\n${data.output}`));
    } else {
      appendTerminalLog(txt(`[CHKDSK FAILED] ${data.error || data.message}`, `[CHKDSK GAGAL] ${data.error || data.message}`));
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
  appendTerminalLog(txt(`[TRIM] Sending flash-cell deallocation (ReTrim) to drive ${drive}: ...`, `[TRIM] Mengirim deallokasi sel flash (ReTrim) ke drive ${drive}: ...`));

  try {
    const resp = await apiFetch('/api/repair_trim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drive })
    });
    const data = await resp.json();
    if (data.success) {
      appendTerminalLog(txt(`[TRIM OK]\n${data.output}`, `[TRIM SUKSES]\n${data.output}`));
    } else {
      appendTerminalLog(txt(`[TRIM FAILED] ${data.error || data.message}`, `[TRIM GAGAL] ${data.error || data.message}`));
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
  appendTerminalLog(txt(`[DIRTY BIT] Checking volume integrity on drive ${drive}: ...`, `[DIRTY BIT] Memeriksa integritas volume ${drive}: ...`));

  try {
    const resp = await apiFetch(`/api/dirty_check?drive=${drive}`);
    const data = await resp.json();
    if (data.success) {
      const statusDirty = data.is_dirty ? 'PERINGATAN: Partisi kotor (Dirty Bit aktif)! Diperlukan chkdsk /f.' : 'STATUS BERSIH: Partisi sehat dan tersinkronisasi sempurna.';
      appendTerminalLog(`[HASIL DIRTY BIT] ${statusDirty}\n${data.output}`);
    } else {
      appendTerminalLog(txt(`[DIRTY BIT FAILED] ${data.error}`, `[DIRTY BIT GAGAL] ${data.error}`));
    }
  } catch (err) {
    appendTerminalLog(`[DIRTY BIT ERROR] ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Modal Glosarium & Panduan Edukasi NAND Flash
function openGlossaryModal() {
  const modal = document.getElementById('glossary-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    safeCreateIcons();
  }
}

function closeGlossaryModal() {
  const modal = document.getElementById('glossary-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

// Event listener ESC dan klik latar belakang modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeGlossaryModal();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const modalElem = document.getElementById('glossary-modal');
  if (modalElem) {
    modalElem.addEventListener('click', (e) => {
      if (e.target === modalElem) {
        closeGlossaryModal();
      }
    });
  }
});



// ==============================================================================
// STORAGE MANAGEMENT & SMART CLEANUP CONTROLLER (v2.0.0)
// ==============================================================================

let storageDrives = [];
let selectedStorageDrive = 'all';
let currentStorageSubTab = 'recommend';
let storageScanPollTimer = null;
let storageResults = null;
let storageIsScanning = false;

// Filter states for Large Items
let storageLargeFilterMinBytes = 100 * 1024 * 1024; // Default 100MB
let storageLargeFilterType = 'all'; // 'all', 'file', 'dir'
let storageLargeSortOrder = 'desc'; // 'desc', 'asc'
let storageLargeSearchQuery = '';

// Filter states for Old Items
let storageOldFilterDays = 90; // Default > 90 days

// Selected checkboxes
let selectedRecommendationIndices = new Set();
let selectedDuplicatePaths = new Set();

// Utility format bytes for frontend display
function formatStorageBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (!bytes || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format relative date or days
function formatAgeDays(days) {
  if (days < 30) return `${days} hari`;
  if (days < 365) return `~${Math.floor(days / 30)} bulan (${days} hr)`;
  const years = (days / 365).toFixed(1);
  return `~${years} thn (${days} hr)`;
}

// 1. Initialize Storage View
async function initStorageView() {
  await loadStorageDrives();
  await checkStorageScanStatus();
  if (!storageResults) {
    renderStorageResults({});
  }
}

// 2. Load available drives
async function loadStorageDrives() {
  try {
    const res = await apiFetch('/api/storage/drives');
    const data = await res.json();
    if (data.success && data.drives) {
      storageDrives = data.drives;
      renderStorageDriveDropdown();
      updateDriveUsageHero();
    }
  } catch (err) {
    console.error('Failed to load storage drives:', err);
  }
}

// Toggle & Close Custom Drive Dropdown (Zero White Flash Invariant)
function toggleDriveDropdown() {
  const menu = document.getElementById('drive-dropdown-menu');
  const chevron = document.getElementById('icon-drive-dropdown-chevron');
  if (!menu) return;

  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  } else {
    menu.classList.add('hidden');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  }
}

function closeDriveDropdown() {
  const menu = document.getElementById('drive-dropdown-menu');
  const chevron = document.getElementById('icon-drive-dropdown-chevron');
  if (menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  }
}

function selectStorageDrive(val) {
  selectedStorageDrive = val;
  const select = document.getElementById('storage-drive-select');
  if (select) select.value = val;

  renderStorageDriveDropdown();
  updateDriveUsageHero();
  if (storageResults) {
    renderStorageResults(storageResults);
  }
  closeDriveDropdown();
}

// Render drive selector dropdown (Supports both Custom Dropdown and hidden native select)
function renderStorageDriveDropdown() {
  const select = document.getElementById('storage-drive-select');
  const list = document.getElementById('drive-dropdown-list');
  const txtSelected = document.getElementById('txt-selected-drive');

  const currentVal = selectedStorageDrive || (select ? select.value : 'all');

  // 1. Synchronize hidden native select
  if (select) {
    select.innerHTML = `<option value="all">${txt('All drives', 'Semua disk')}</option>`;
    storageDrives.forEach((drv) => {
      const opt = document.createElement('option');
      opt.value = drv.drive;
      const freeStr = formatStorageBytes(drv.free);
      const totalStr = formatStorageBytes(drv.total);
      opt.textContent = `${drv.drive} (${freeStr} ${txt('free', 'bebas')} / ${totalStr})`;
      select.appendChild(opt);
    });
    select.value = currentVal;
    select.onchange = (e) => {
      selectStorageDrive(e.target.value);
    };
  }

  // 2. Render high-taste custom dropdown popover list
  if (list) {
    let listHtml = '';
    const isAllActive = currentVal === 'all';

    // Option: Semua Disk (All Disks)
    listHtml += `
      <button type="button" onclick="selectStorageDrive('all')" class="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors app-dropdown-item ${isAllActive ? 'active' : ''}">
        <div class="flex items-center gap-2.5 truncate">
          <i data-lucide="hard-drive" class="w-4 h-4 text-blue-500 shrink-0"></i>
          <div class="text-left">
            <div class="font-mono font-bold text-zinc-900 dark:text-zinc-100">${txt('All drives', 'Semua disk')}</div>
            <div class="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans">${txt('Scan all storage capacity on this computer', 'Pindai seluruh kapasitas penyimpanan komputer')}</div>
          </div>
        </div>
        ${isAllActive ? '<i data-lucide="check" class="w-4 h-4 text-blue-500 shrink-0"></i>' : ''}
      </button>`;

    let activeLabelText = txt('All drives', 'Semua disk');

    // Individual Drives
    storageDrives.forEach((drv) => {
      const isDriveActive = currentVal.toUpperCase() === drv.drive.toUpperCase();
      const freeStr = formatStorageBytes(drv.free);
      const totalStr = formatStorageBytes(drv.total);
      const pctUsed = drv.percent || drv.percent_used || 0;

      if (isDriveActive) {
        activeLabelText = `${drv.drive} (${freeStr} ${txt('free', 'bebas')} / ${totalStr})`;
      }

      listHtml += `
        <button type="button" onclick="selectStorageDrive('${escapePath(drv.drive)}')" class="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors app-dropdown-item ${isDriveActive ? 'active' : ''}">
          <div class="flex items-center gap-2.5 truncate">
            <i data-lucide="disc" class="w-4 h-4 text-emerald-500 shrink-0"></i>
            <div class="text-left">
              <div class="flex items-center gap-1.5 font-mono">
                <span class="font-bold text-zinc-900 dark:text-zinc-100">${escapeHtml(drv.drive)}</span>
                <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">${freeStr} ${txt('free', 'bebas')}</span>
              </div>
              <div class="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">${txt('Total', 'Total')} ${totalStr} · ${txt('Used', 'Terpakai')} ${pctUsed}%</div>
            </div>
          </div>
          ${isDriveActive ? '<i data-lucide="check" class="w-4 h-4 text-blue-500 shrink-0"></i>' : ''}
        </button>`;
    });

    list.innerHTML = listHtml;

    if (txtSelected) {
      txtSelected.textContent = activeLabelText;
    }

    safeCreateIcons();
  }
}

// Update PC Manager segmented bar and numbers
function updateDriveUsageHero() {
  const labelElem = document.getElementById('storage-active-label');
  const freeSummary = document.getElementById('storage-free-summary');
  const usedSummary = document.getElementById('storage-used-summary');

  let totalBytes = 0;
  let usedBytes = 0;
  let freeBytes = 0;
  const breakdown = storageResults && storageResults.breakdown;

  if (breakdown && breakdown.total_size) {
    // Align the hero with the drives that were actually scanned.
    totalBytes = breakdown.total_size;
    usedBytes = breakdown.total_used;
    freeBytes = breakdown.total_free;
    const scanned = (storageResults.drives_scanned || []).join(', ');
    if (labelElem) labelElem.textContent = scanned ? `Scanned: ${scanned}` : txt('Scan results', 'Hasil pemindaian');
  } else if (selectedStorageDrive === 'all') {
    if (labelElem) labelElem.textContent = txt('All drives combined', 'Semua disk tergabung');
    storageDrives.forEach((d) => {
      totalBytes += d.total || 0;
      usedBytes += d.used || 0;
      freeBytes += d.free || 0;
    });
  } else {
    const d = storageDrives.find((drv) => drv.drive.toUpperCase() === selectedStorageDrive.toUpperCase());
    if (d) {
      if (labelElem) labelElem.textContent = `Drive ${d.drive}`;
      totalBytes = d.total || 0;
      usedBytes = d.used || 0;
      freeBytes = d.free || 0;
    }
  }

  const percentUsed = totalBytes > 0 ? ((usedBytes / totalBytes) * 100).toFixed(1) : 0;
  if (freeSummary) freeSummary.textContent = `${txt('Free', 'Tersedia')} ${formatStorageBytes(freeBytes)}`;
  if (usedSummary) usedSummary.textContent = `${txt('Used', 'Terpakai')} ${formatStorageBytes(usedBytes)} / ${formatStorageBytes(totalBytes)} (${percentUsed}%)`;

  // Segmented bar breakdown: measured bytes only, no proportional fabrication.
  if (breakdown && breakdown.measured_bytes !== undefined) {
    const total = totalBytes > 0 ? totalBytes : (breakdown.total_used || 1);

    const pUser = Math.min(100, (breakdown.user_files / total) * 100);
    const pApp = Math.min(100, (breakdown.app_files / total) * 100);
    const pSys = Math.min(100, (breakdown.system_files / total) * 100);
    const pRecycle = Math.min(100, (breakdown.recycle_bin / total) * 100);
    const pOther = Math.max(0, 100 - (pUser + pApp + pSys + pRecycle));

    setSegmentWidth('seg-user', pUser);
    setSegmentWidth('seg-app', pApp);
    setSegmentWidth('seg-system', pSys);
    setSegmentWidth('seg-recycle', pRecycle);
    setSegmentWidth('seg-other', pOther);

    setElementText('val-seg-user', formatStorageBytes(breakdown.user_files));
    setElementText('val-seg-app', formatStorageBytes(breakdown.app_files));
    setElementText('val-seg-system', formatStorageBytes(breakdown.system_files));
    setElementText('val-seg-recycle', formatStorageBytes(breakdown.recycle_bin));
    setElementText('val-seg-other', formatStorageBytes(breakdown.other));

    if (usedSummary) {
      usedSummary.textContent = `${txt('Used', 'Terpakai')} ${formatStorageBytes(usedBytes)} / ${formatStorageBytes(totalBytes)} (${percentUsed}%) · ${txt('measured', 'terukur')} ${breakdown.coverage_pct}%`;
    }
  } else {
    setSegmentWidth('seg-user', 0);
    setSegmentWidth('seg-app', 0);
    setSegmentWidth('seg-system', 0);
    setSegmentWidth('seg-recycle', 0);
    setSegmentWidth('seg-other', 0);
    ['val-seg-user', 'val-seg-app', 'val-seg-system', 'val-seg-recycle', 'val-seg-other'].forEach((id) => setElementText(id, '—'));
  }
}

function setSegmentWidth(id, pct) {
  const elem = document.getElementById(id);
  if (elem) elem.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function setElementText(id, text) {
  const elem = document.getElementById(id);
  if (elem) elem.textContent = text;
}

// 3. Check scan status on page load or tab switch
async function checkStorageScanStatus() {
  try {
    const res = await apiFetch('/api/storage/scan_status');
    const status = await res.json();
    if (status.is_scanning) {
      showStorageProgress(true);
      startStoragePolling();
    } else if (status.has_results) {
      loadStorageResults();
    }
  } catch (err) {
    console.error('Error checking storage status:', err);
  }
}

// 4. Trigger Scan
async function triggerStorageScan() {
  const select = document.getElementById('storage-drive-select');
  const drive = selectedStorageDrive || (select ? select.value : 'all');

  const btnScan = document.getElementById('btn-storage-scan');
  const txtScan = document.getElementById('txt-btn-storage-scan');
  if (btnScan) btnScan.disabled = true;
  if (txtScan) txtScan.textContent = txt('Preparing scan...', 'Menyiapkan pindai...');

  try {
    const res = await apiFetch('/api/storage/start_scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drive: drive, drives: [drive] })
    });
    const data = await res.json();
    if (data.success) {
      showStorageProgress(true);
      startStoragePolling();
    } else {
      showToast(txt(`Could not start the scan: ${data.message || data.error}`, `Gagal memulai pemindaian: ${data.message || data.error}`), 'error');
    }
  } catch (err) {
    showToast(txt(`Network error: ${err.message}`, `Kesalahan jaringan: ${err.message}`), 'error');
  } finally {
    if (btnScan) btnScan.disabled = false;
  }
}

// 5. Cancel Scan
async function cancelStorageScan() {
  try {
    const btnCancel = document.getElementById('btn-storage-cancel');
    if (btnCancel) btnCancel.disabled = true;
    await apiFetch('/api/storage/cancel_scan', { method: 'POST' });
    const statusElem = document.getElementById('storage-progress-status');
    if (statusElem) statusElem.textContent = 'Membatalkan pemindaian...';
  } catch (err) {
    console.error('Failed to cancel scan:', err);
  }
}

// 6. Polling Scan Progress
function startStoragePolling() {
  if (storageScanPollTimer) clearInterval(storageScanPollTimer);
  storageIsScanning = true;

  const btnScan = document.getElementById('btn-storage-scan');
  const txtScan = document.getElementById('txt-btn-storage-scan');
  const iconScan = document.getElementById('storage-scan-icon');
  if (btnScan) {
    btnScan.classList.replace('bg-blue-600', 'bg-zinc-600');
    btnScan.classList.replace('hover:bg-blue-700', 'hover:bg-zinc-700');
  }
  if (txtScan) txtScan.textContent = txt('Scanning...', 'Memindai...');
  if (iconScan) iconScan.setAttribute('data-lucide', 'loader-2');
  safeCreateIcons();

  storageScanPollTimer = setInterval(async () => {
    try {
      const res = await apiFetch('/api/storage/scan_status');
      const st = await res.json();

      updateStorageProgressBar(st);

      if (!st.is_scanning) {
        clearInterval(storageScanPollTimer);
        storageScanPollTimer = null;
        storageIsScanning = false;

        if (btnScan) {
          btnScan.classList.replace('bg-zinc-600', 'bg-blue-600');
          btnScan.classList.replace('hover:bg-zinc-700', 'hover:bg-blue-700');
        }
        if (txtScan) txtScan.textContent = txt('Scan disk', 'Mulai pindai disk');
        if (iconScan) iconScan.setAttribute('data-lucide', 'play');
        safeCreateIcons();

        setTimeout(() => {
          showStorageProgress(false);
          loadStorageResults();
        }, 600);
      }
    } catch (err) {
      console.error('Error polling storage scan:', err);
    }
  }, 400);
}

function storageStatusText(st) {
  const args = (st && st.status_args) || {};
  switch (st && st.status_code) {
    case 'cancelling':
      return txt('Cancelling scan...', 'Membatalkan pemindaian...');
    case 'preparing':
      return txt('Preparing scan...', 'Menyiapkan pemindaian...');
    case 'checking_cache':
      return txt('Checking system caches and leftover installers...', 'Memeriksa cache sistem & sisa instalasi...');
    case 'scanning_drive':
      return txt(`Scanning drive ${args.drive || ''}...`, `Memindai drive ${args.drive || ''}...`);
    case 'analyzing_duplicates':
      return txt('Analyzing duplicate files...', 'Menganalisis berkas duplikat...');
    case 'analyzing_duplicates_progress':
      return txt(`Analyzing duplicate files (${args.current}/${args.total})...`, `Menganalisis berkas duplikat (${args.current}/${args.total})...`);
    case 'done':
      return txt('Scan complete.', 'Pemindaian selesai.');
    case 'cancelled':
      return txt('Scan cancelled.', 'Pemindaian dibatalkan.');
    case 'error':
      return st.status_text || txt('Scan failed.', 'Pemindaian gagal.');
    case 'idle':
      return txt('Idle', 'Idle');
    default:
      return st.status_text || txt('Scanning files...', 'Sedang memindai berkas...');
  }
}

function updateStorageProgressBar(st) {
  const pBar = document.getElementById('storage-progress-fill') || document.getElementById('storage-progress-bar');
  const pPct = document.getElementById('storage-progress-pct') || document.getElementById('storage-progress-percentage');
  const pStatus = document.getElementById('storage-progress-status');
  const pPath = document.getElementById('storage-progress-path');
  const pCount = document.getElementById('storage-progress-stats') || document.getElementById('storage-progress-count');

  const pct = Math.max(0, Math.min(100, st.progress || 0));
  if (pBar) pBar.style.width = `${pct}%`;
  if (pPct) pPct.textContent = `${pct}%`;
  if (pStatus) pStatus.textContent = storageStatusText(st);
  if (pPath) pPath.textContent = st.current_path || '-';
  if (pCount) {
    const filesStr = (st.files_scanned || 0).toLocaleString();
    const bytesStr = formatStorageBytes(st.bytes_scanned || 0);
    pCount.textContent = `${filesStr} ${txt('files', 'berkas')} (${bytesStr})`;
  }
}

function showStorageProgress(show) {
  const card = document.getElementById('storage-progress-card');
  if (card) {
    card.classList.toggle('hidden', !show);
  }
}

// 7. Load and Render Results
async function loadStorageResults() {
  try {
    const res = await apiFetch('/api/storage/results');
    const data = await res.json();
    if (data.status === 'ok') {
      storageResults = data;
      renderStorageResults(data);
      updateDriveUsageHero();
    }
  } catch (err) {
    console.error('Failed to load storage results:', err);
  }
}

function renderStorageResults(data) {
  // Update badge counts
  const countRec = data.recommendations ? data.recommendations.length : 0;
  const countLarge = data.large_items ? data.large_items.length : 0;
  const countOld = data.old_items ? data.old_items.length : 0;
  const countDup = data.duplicate_groups ? data.duplicate_groups.length : 0;

  setElementText('badge-recommend-count', countRec);
  setElementText('badge-large-count', countLarge);
  setElementText('badge-old-count', countOld);
  setElementText('badge-dup-count', countDup);

  // Render tabs
  renderRecommendationsSubTab();
  renderLargeItemsSubTab();
  renderOldItemsSubTab();
  renderDuplicatesSubTab();
}

// Sub-Tab Switcher
function setStorageSubTab(tab) {
  currentStorageSubTab = tab;
  const tabs = ['recommend', 'large', 'old', 'dup'];

  tabs.forEach((t) => {
    const btn = document.getElementById(`btn-sub-${t}`);
    const view = document.getElementById(`subview-${t}`);

    const isActive = t === tab;
    if (btn) {
      if (isActive) {
        btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200 dark:border-zinc-700/80 transition-all';
      } else {
        btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all';
      }
    }
    if (view) {
      view.classList.toggle('hidden', !isActive);
    }
  });

  safeCreateIcons();
}

// Subview 1: Recommendations
function renderRecommendationsSubTab() {
  const container = document.getElementById('recommendations-container');
  if (!container) return;

  if (!storageResults) {
    container.innerHTML = `
      <div class="app-surface p-8 text-center space-y-2">
        <i data-lucide="hard-drive-download" class="w-8 h-8 text-zinc-400 mx-auto"></i>
        <h4 class="text-sm font-bold text-zinc-800 dark:text-zinc-200">${currentLang === 'en' ? 'No scan has run yet' : 'Belum ada pemindaian'}</h4>
        <p class="text-xs text-zinc-500">${currentLang === 'en' ? 'Choose a target drive and start a scan to see cleanup recommendations.' : 'Pilih target disk lalu mulai pemindaian untuk melihat rekomendasi pembersihan.'}</p>
      </div>`;
    safeCreateIcons();
    selectedRecommendationIndices.clear();
    updateRecommendationSummary();
    return;
  }

  const items = storageResults.recommendations || [];
  if (items.length === 0) {
    container.innerHTML = `
      <div class="app-surface p-8 text-center space-y-2">
        <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-500 mx-auto"></i>
        <h4 class="text-sm font-bold text-zinc-800 dark:text-zinc-200">Sistem Bersih dan Rapi</h4>
        <p class="text-xs text-zinc-500">${txt('No cache build-up or junk files above 1 MB were found on this target.', 'Tidak ada penumpukan cache atau berkas sampah di atas 1 MB pada target ini.')}</p>
      </div>`;
    safeCreateIcons();
    selectedRecommendationIndices.clear();
    updateRecommendationSummary();
    return;
  }

  // Pre-select only items the backend marked as default-safe and selectable.
  selectedRecommendationIndices.clear();
  items.forEach((item, idx) => {
    if (item.selectable !== false && item.default_checked) selectedRecommendationIndices.add(idx);
  });

  let html = '';
  items.forEach((item, idx) => {
    const isChecked = selectedRecommendationIndices.has(idx);
    const sizeStr = formatStorageBytes(item.size);
    const isFolder = item.is_dir === true;
    const selectable = item.selectable !== false;
    const safeLabel = selectable
      ? (item.safe_level === 'medium'
        ? (currentLang === 'en' ? 'Rebuildable cache' : 'Cache dapat dibangun ulang')
        : (currentLang === 'en' ? 'Safe to delete' : 'Aman dihapus'))
      : (currentLang === 'en' ? 'Manual inspection only' : 'Inspeksi manual');
    const safeClass = selectable
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600';
    const pathArg = jsPathArg(item.path);

    html += `
      <div class="storage-card overflow-hidden transition-all duration-200 border border-zinc-200 dark:border-zinc-800 rounded-lg ${isChecked ? 'ring-1 ring-emerald-500/30 bg-emerald-500/5' : ''}" id="rec-card-${idx}">
        <div class="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isFolder ? 'cursor-pointer select-none hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors' : ''}" onclick="${isFolder ? `toggleRecommendationFolderExpand(${idx}, decodeURIComponent('${pathArg}'))` : ''}">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <input type="checkbox" id="chk-rec-${idx}" onclick="event.stopPropagation()" onchange="toggleRecommendation(${idx})" ${selectable ? '' : 'disabled'} class="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-600 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed" ${isChecked ? 'checked' : ''}>
            <div class="space-y-0.5 flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">${escapeHtml(item.category)}</span>
                <span class="badge-tag ${safeClass}">${safeLabel}</span>
                ${isFolder ? `<span class="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700/60 shadow-xs"><i data-lucide="chevron-right" id="rec-chevron-${idx}" class="w-3 h-3 transition-transform duration-200 text-zinc-400"></i><span id="rec-expand-lbl-${idx}">${currentLang === 'en' ? 'Inspect contents' : 'Lihat isi'}</span></span>` : ''}
              </div>
              <p class="text-[11px] text-zinc-500 dark:text-zinc-400">${escapeHtml(currentLang === 'en' ? (item.desc_en || item.description || item.desc || '') : (item.description || item.desc || ''))}</p>
              <div class="text-[10px] font-mono text-zinc-400 truncate max-w-md">${escapeHtml(item.path)}</div>
            </div>
          </div>

          <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-200 dark:border-zinc-800" onclick="event.stopPropagation()">
            <div class="text-right">
              <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">${sizeStr}</div>
              <div class="text-[10px] text-zinc-400">${selectable ? txt('Potential savings', 'Potensi hemat') : txt('Info only', 'Hanya informasi')}</div>
            </div>
            <button onclick="openInExplorer(decodeURIComponent('${pathArg}'))" class="btn-icon-action px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all shadow-xs" title="${txt('Open in File Explorer', 'Buka di File Explorer')}">
              <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
              <span>${txt('Open', 'Buka')}</span>
            </button>
          </div>
        </div>

        ${isFolder ? `
        <div id="rec-expand-panel-${idx}" class="hidden border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 p-3">
          <div id="rec-expand-content-${idx}" class="text-xs text-zinc-500 font-mono"></div>
        </div>` : ''}
      </div>`;
  });

  container.innerHTML = html;
  safeCreateIcons();
  updateRecommendationSummary();
}

function toggleRecommendation(idx) {
  const item = (storageResults && storageResults.recommendations || [])[idx];
  if (!item || item.selectable === false) return;
  if (selectedRecommendationIndices.has(idx)) {
    selectedRecommendationIndices.delete(idx);
  } else {
    selectedRecommendationIndices.add(idx);
  }
  const card = document.getElementById(`rec-card-${idx}`);
  if (card) {
    card.classList.toggle('ring-1', selectedRecommendationIndices.has(idx));
    card.classList.toggle('ring-emerald-500/30', selectedRecommendationIndices.has(idx));
    card.classList.toggle('bg-emerald-500/5', selectedRecommendationIndices.has(idx));
  }
  updateRecommendationSummary();
}

function updateRecommendationSummary() {
  const items = (storageResults && storageResults.recommendations) || [];
  let totalReclaimable = 0;
  selectedRecommendationIndices.forEach((idx) => {
    if (items[idx]) totalReclaimable += items[idx].size || 0;
  });

  const summaryElem = document.getElementById('txt-recommendations-summary');
  const totalElem = document.getElementById('rec-total-cleanable');
  const btnClean = document.getElementById('btn-clean-recommended');
  const btnText = document.getElementById('txt-btn-clean-rec');
  const count = selectedRecommendationIndices.size;

  if (totalElem) totalElem.textContent = formatStorageBytes(totalReclaimable);
  if (summaryElem) {
    summaryElem.textContent = storageResults
      ? txt(
          `${count} of ${items.length} selected · Potential free space: ${formatStorageBytes(totalReclaimable)}`,
          `${count} dari ${items.length} item terpilih · Potensi ruang bebas: ${formatStorageBytes(totalReclaimable)}`
        )
      : txt('No scan has run in this session.', 'Belum ada pemindaian pada sesi ini.');
  }
  if (btnClean) {
    btnClean.disabled = count === 0;
    btnClean.classList.toggle('opacity-50', count === 0);
  }
  if (btnText) {
    btnText.textContent = count === 0
      ? (currentLang === 'en' ? 'Select items' : 'Pilih item')
      : (currentLang === 'en' ? `Clean ${formatStorageBytes(totalReclaimable)}` : `Bersihkan ${formatStorageBytes(totalReclaimable)}`);
  }
}

async function cleanRecommendedItems() {
  const items = (storageResults && storageResults.recommendations) || [];
  const pathsToClean = [];
  selectedRecommendationIndices.forEach((idx) => {
    if (items[idx] && items[idx].path) pathsToClean.push(items[idx].path);
  });

  if (pathsToClean.length === 0) return;

  const confirmMsg = txt(
    `Clean ${pathsToClean.length} selected cache folders?

Only temporary files, compiler/package caches, and crash dumps are removed.`,
    `Bersihkan ${pathsToClean.length} folder cache terpilih?

Hanya file sementara, cache compiler/package, dan crash dump yang dihapus.`
  );
  if (!confirm(confirmMsg)) return;

  const btnClean = document.getElementById('btn-clean-recommended');
  if (btnClean) btnClean.disabled = true;

  try {
    const res = await apiFetch('/api/storage/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: pathsToClean })
    });
    const result = await res.json();
    const freed = result.freed_formatted || result.reclaimed_formatted || '0 B';
    if (result.success) {
      if (result.rejected && result.rejected.length > 0) {
        showToast(`Dibersihkan ${freed}. ${result.rejected.length} path ditolak oleh pengaman.`, 'warning', 6000);
      } else {
        showToast(`Pembersihan selesai. Ruang dibebaskan: ${freed} (${result.deleted_count} item).`, 'success');
      }
      await loadStorageDrives();
      showToast(txt('Run the scan again to refresh the numbers.', 'Jalankan pemindaian ulang untuk memperbarui angka.'), 'info');
    } else {
      showToast(txt(`Cleanup failed: ${result.error || 'No allowed path.'}`, `Pembersihan gagal: ${result.error || 'Tidak ada path yang diizinkan.'}`), 'error');
    }
  } catch (err) {
    showToast(txt(`Something went wrong: ${err.message}`, `Terjadi kesalahan: ${err.message}`), 'error');
  } finally {
    if (btnClean) btnClean.disabled = false;
  }
}

// Subview 2: Large Items
function filterLargeBySize(minMB) {
  storageLargeFilterMinBytes = minMB * 1024 * 1024;
  ['100', '500', '1024'].forEach((val) => {
    const btn = document.getElementById(`btn-size-${val === '1024' ? '1gb' : val + 'mb'}`);
    if (btn) {
      const isActive = (val === '1024' && minMB >= 1024) || (val === String(minMB));
      if (isActive) {
        btn.className = 'px-2 py-0.5 rounded text-xs font-semibold bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs transition-all';
      } else {
        btn.className = 'px-2 py-0.5 rounded text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all';
      }
    }
  });
  renderLargeItemsSubTab();
}

function onLargeSizeChange() {
  const sel = document.getElementById('filter-large-size');
  if (!sel || sel.value === 'all') {
    storageLargeFilterMinBytes = 0;
  } else {
    const mb = Number(sel.value);
    storageLargeFilterMinBytes = Number.isFinite(mb) ? mb * 1024 * 1024 : 0;
  }
  renderLargeItemsSubTab();
}

function onLargeSearchInput() {
  const inp = document.getElementById('search-large-input') || document.getElementById('large-search-input');
  storageLargeSearchQuery = (inp ? inp.value : '').toLowerCase().trim();
  renderLargeItemsSubTab();
}

function onLargeTypeChange() {
  const sel = document.getElementById('filter-large-type') || document.getElementById('large-type-select');
  storageLargeFilterType = sel ? sel.value : 'all';
  renderLargeItemsSubTab();
}

function onLargeSortChange() {
  const sel = document.getElementById('sort-large-order') || document.getElementById('large-sort-select');
  storageLargeSortOrder = sel ? sel.value : 'desc';
  renderLargeItemsSubTab();
}

function renderLargeItemsSubTab() {
  const tbody = document.getElementById('table-large-items');
  const summaryElem = document.getElementById('large-items-summary');
  if (!tbody) return;

  let items = (storageResults && storageResults.large_items) || [];

  // Filter by size
  items = items.filter((item) => (item.size || 0) >= storageLargeFilterMinBytes);

  // Filter by type
  if (storageLargeFilterType === 'file') {
    items = items.filter((item) => !item.is_dir);
  } else if (storageLargeFilterType === 'dir') {
    items = items.filter((item) => item.is_dir);
  }

  // Filter by search query
  if (storageLargeSearchQuery) {
    items = items.filter((item) =>
      (item.name || '').toLowerCase().includes(storageLargeSearchQuery) ||
      (item.path || '').toLowerCase().includes(storageLargeSearchQuery)
    );
  }

  // Sort
  items.sort((a, b) => {
    if (storageLargeSortOrder === 'asc') return (a.size || 0) - (b.size || 0);
    return (b.size || 0) - (a.size || 0);
  });

  if (summaryElem) {
    const totalBytes = items.reduce((acc, cur) => acc + (cur.size || 0), 0);
    summaryElem.textContent = txt(
      `Showing ${items.length} items · Total: ${formatStorageBytes(totalBytes)}`,
      `Menampilkan ${items.length} item · Total: ${formatStorageBytes(totalBytes)}`
    );
  }

  if (!storageResults) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-zinc-500 text-xs">
          ${txt('No scan has run. Pick a target drive and start a scan.', 'Belum ada pemindaian. Pilih target disk lalu mulai pindai.')}
        </td>
      </tr>`;
    return;
  }

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-zinc-500 text-xs">
          ${txt('No file or folder matches the current filters.', 'Tidak ada berkas atau folder yang cocok dengan filter saat ini.')}
        </td>
      </tr>`;
    return;
  }

  let html = '';
  items.slice(0, 150).forEach((item, idx) => {
    const isFolder = item.is_dir === true;
    const pathArg = jsPathArg(item.path);
    const typeBadge = isFolder
      ? `<span class="badge-tag bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 cursor-pointer">Folder</span>`
      : `<span class="badge-tag bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">${txt('File', 'Berkas')}</span>`;

    html += `
      <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${isFolder ? 'cursor-pointer' : ''}" onclick="${isFolder ? `toggleLargeFolderExpand(${idx}, decodeURIComponent('${pathArg}'))` : ''}">
        <td class="py-2 px-3">
          <div class="flex items-center gap-2">
            <i data-lucide="${isFolder ? 'folder' : 'file'}" class="w-3.5 h-3.5 ${isFolder ? 'text-amber-500' : 'text-zinc-400'} shrink-0"></i>
            ${isFolder ? `<i data-lucide="chevron-right" id="large-chevron-${idx}" class="w-3 h-3 text-zinc-400 transition-transform duration-200 shrink-0"></i>` : ''}
            <div class="truncate max-w-sm font-semibold text-zinc-900 dark:text-zinc-100" title="${escapeHtml(item.path)}">
              ${escapeHtml(item.name)}
            </div>
          </div>
          <div class="text-[10px] text-zinc-400 truncate max-w-sm pl-5 font-mono">${escapeHtml(item.path)}</div>
        </td>
        <td class="py-2 px-3 text-center" onclick="event.stopPropagation()">${typeBadge}</td>
        <td class="py-2 px-3 text-right font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">${formatStorageBytes(item.size)}</td>
        <td class="py-2 px-3 text-zinc-500 text-[10px] tabular-nums">${item.mtime_str || '-'}</td>
        <td class="py-2 px-3 text-center" onclick="event.stopPropagation()">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="openInExplorer(decodeURIComponent('${pathArg}'))" class="btn-icon-action p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300" title="Buka di File Explorer">
              <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
            </button>
            ${isFolder ? '' : `<button onclick="deleteSingleItem(decodeURIComponent('${pathArg}'), '${escapeHtml(item.name).replace(/'/g, '&#039;')}')" class="btn-icon-action p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400" title="Hapus Berkas Ini">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>`}
          </div>
        </td>
      </tr>
      ${isFolder ? `
      <tr id="large-expand-row-${idx}" class="hidden bg-zinc-50/80 dark:bg-zinc-950/80">
        <td colspan="5" class="p-3 border-t border-b border-zinc-200 dark:border-zinc-800">
          <div id="large-expand-content-${idx}" class="text-xs text-zinc-500 font-mono"></div>
        </td>
      </tr>` : ''}`;
  });

  tbody.innerHTML = html;
  safeCreateIcons();
}

// Subview 3: Old & Unused Items
function filterOldByDays(days) {
  storageOldFilterDays = days;
  [30, 90, 180, 365].forEach((d) => {
    const btn = document.getElementById(`btn-old-${d}`);
    if (btn) {
      if (d === days) {
        btn.className = 'px-2.5 py-1 rounded text-xs font-semibold transition-all bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs';
      } else {
        btn.className = 'px-2.5 py-1 rounded text-xs font-semibold transition-all text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100';
      }
    }
  });
  renderOldItemsSubTab();
}

function renderOldItemsSubTab() {
  const tbody = document.getElementById('table-old-items');
  const summaryElem = document.getElementById('old-items-summary');
  if (!tbody) return;

  let items = (storageResults && storageResults.old_items) || [];
  items = items.filter((item) => (item.age_days || 0) >= storageOldFilterDays);

  // Sort by age descending
  items.sort((a, b) => (b.age_days || 0) - (a.age_days || 0));

  if (summaryElem) {
    const totalBytes = items.reduce((acc, cur) => acc + (cur.size || 0), 0);
    summaryElem.textContent = txt(
      `Showing ${items.length} inactive items (> ${storageOldFilterDays} days) · Total: ${formatStorageBytes(totalBytes)}`,
      `Menampilkan ${items.length} item tidak aktif (> ${storageOldFilterDays} hari) · Total: ${formatStorageBytes(totalBytes)}`
    );
  }

  if (!storageResults) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-zinc-500 text-xs">
          Belum ada pemindaian. Pilih target disk lalu klik Mulai Pindai Disk.
        </td>
      </tr>`;
    return;
  }

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-zinc-500 text-xs">
          ${txt(`No file or folder older than ${storageOldFilterDays} days on this target.`, `Tidak ada berkas atau folder lebih tua dari ${storageOldFilterDays} hari pada target ini.`)}
        </td>
      </tr>`;
    return;
  }

  let html = '';
  items.slice(0, 150).forEach((item) => {
    const pathArg = jsPathArg(item.path);
    const isFolder = item.is_dir === true;
    html += `
      <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
        <td class="py-2 px-3">
          <div class="flex items-center gap-2">
            <i data-lucide="${isFolder ? 'folder' : 'file'}" class="w-3.5 h-3.5 text-purple-400 shrink-0"></i>
            <div class="truncate max-w-sm font-semibold text-zinc-900 dark:text-zinc-100" title="${escapeHtml(item.path)}">
              ${escapeHtml(item.name)}
            </div>
          </div>
          <div class="text-[10px] text-zinc-400 truncate max-w-sm pl-5 font-mono">${escapeHtml(item.path)}</div>
        </td>
        <td class="py-2 px-3 text-right font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">${formatStorageBytes(item.size)}</td>
        <td class="py-2 px-3 text-center">
          <span class="badge-tag bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">${formatAgeDays(item.age_days || 0)}</span>
        </td>
        <td class="py-2 px-3 text-zinc-500 text-[10px] tabular-nums">${item.mtime_str || '-'}</td>
        <td class="py-2 px-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="openInExplorer(decodeURIComponent('${pathArg}'))" class="btn-icon-action p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300" title="Buka di File Explorer">
              <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
            </button>
            ${isFolder ? '' : `<button onclick="deleteSingleItem(decodeURIComponent('${pathArg}'), '${escapeHtml(item.name).replace(/'/g, '&#039;')}')" class="btn-icon-action p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400" title="Hapus Berkas Ini">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>`}
          </div>
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
  safeCreateIcons();
}

// Subview 4: Duplicate Files Finder
function renderDuplicatesSubTab() {
  const container = document.getElementById('duplicates-container');
  if (!container) return;

  if (!storageResults) {
    container.innerHTML = `
      <div class="app-surface p-8 text-center space-y-2">
        <i data-lucide="hard-drive-download" class="w-8 h-8 text-zinc-400 mx-auto"></i>
        <h4 class="text-sm font-bold text-zinc-800 dark:text-zinc-200">Belum ada pemindaian</h4>
        <p class="text-xs text-zinc-500">${txt('Duplicate detection reads and hashes files on the target drive.', 'Pemindaian duplikat membaca dan melakukan hashing berkas pada drive target.')}</p>
      </div>`;
    safeCreateIcons();
    updateDuplicateDeleteButton();
    return;
  }

  const groups = storageResults.duplicate_groups || [];
  if (groups.length === 0) {
    container.innerHTML = `
      <div class="app-surface p-8 text-center space-y-2">
        <i data-lucide="check-check" class="w-8 h-8 text-emerald-500 mx-auto"></i>
        <h4 class="text-sm font-bold text-zinc-800 dark:text-zinc-200">Tidak Ditemukan Berkas Duplikat</h4>
        <p class="text-xs text-zinc-500">${txt('No identical file groups were found within this scan limit.', 'Tidak ada kelompok berkas identik pada batas pemindaian ini.')}</p>
      </div>`;
    safeCreateIcons();
    updateDuplicateDeleteButton();
    return;
  }

  let html = '';
  groups.forEach((grp, gIdx) => {
    const sizeStr = formatStorageBytes(grp.size);
    const potentialWaste = formatStorageBytes(grp.size * (grp.count - 1));

    html += `
      <div class="dup-group-box p-3 space-y-2">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <div class="flex items-center gap-2">
            <i data-lucide="copy" class="w-4 h-4 text-rose-500"></i>
            <span class="font-bold text-xs text-zinc-900 dark:text-zinc-100">${escapeHtml(grp.file_name)}</span>
            <span class="badge-tag bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">${grp.count} Salinan Identik</span>
          </div>
          <div class="text-[11px] font-mono text-zinc-500">
            Ukuran per file: <span class="font-bold text-zinc-700 dark:text-zinc-300">${sizeStr}</span> · Terbuang: <span class="font-bold text-rose-500">${potentialWaste}</span>
          </div>
        </div>

        <div class="space-y-1.5 pt-1">`;

    grp.files.forEach((f, fIdx) => {
      const isChecked = selectedDuplicatePaths.has(f.path);
      html += `
        <div class="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-[11px] font-mono">
          <div class="flex items-center gap-2 truncate max-w-lg">
            <input type="checkbox" id="chk-dup-${gIdx}-${fIdx}" onchange="toggleDuplicateItem(decodeURIComponent('${jsPathArg(f.path)}'))" class="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 border-zinc-300 dark:border-zinc-600 cursor-pointer" ${isChecked ? 'checked' : ''}>
            <span class="truncate text-zinc-700 dark:text-zinc-300" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</span>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span class="text-zinc-400 text-[10px]">${f.mtime_str || '-'}</span>
            <button onclick="openInExplorer(decodeURIComponent('${jsPathArg(f.path)}'))" class="btn-icon-action p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300" title="Buka di File Explorer">
              <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>`;
    });

    html += `
        </div>
      </div>`;
  });

  container.innerHTML = html;
  safeCreateIcons();
  updateDuplicateDeleteButton();
}

function toggleDuplicateItem(path) {
  if (selectedDuplicatePaths.has(path)) {
    selectedDuplicatePaths.delete(path);
  } else {
    selectedDuplicatePaths.add(path);
  }
  updateDuplicateDeleteButton();
}

// Auto-select duplicates: keep newest or keep oldest
function autoSelectDuplicates(strategy) {
  selectedDuplicatePaths.clear();
  const groups = (storageResults && storageResults.duplicate_groups) || [];

  groups.forEach((grp) => {
    if (!grp.files || grp.files.length <= 1) return;

    // Sort files by mtime ascending
    const sorted = [...grp.files].sort((a, b) => (a.mtime || 0) - (b.mtime || 0));

    if (strategy === 'newest') {
      // Keep newest (last item), delete all earlier
      for (let i = 0; i < sorted.length - 1; i++) {
        selectedDuplicatePaths.add(sorted[i].path);
      }
    } else if (strategy === 'oldest') {
      // Keep oldest (first item), delete all later
      for (let i = 1; i < sorted.length; i++) {
        selectedDuplicatePaths.add(sorted[i].path);
      }
    }
  });

  renderDuplicatesSubTab();
}

function updateDuplicateDeleteButton() {
  const btnDelete = document.getElementById('btn-delete-dup');
  const txtDelete = document.getElementById('txt-btn-delete-dup');
  const count = selectedDuplicatePaths.size;

  if (btnDelete) btnDelete.disabled = count === 0;
  if (txtDelete) {
    txtDelete.textContent = txt(`Delete ${count} selected copies`, `Hapus ${count} salinan terpilih`);
  }
}

async function deleteSelectedDuplicates() {
  const paths = Array.from(selectedDuplicatePaths);
  if (paths.length === 0) return;

  const confirmMsg = txt(
    `Permanently delete ${paths.length} selected duplicate copies?

The original copy you keep will not be deleted.`,
    `Hapus permanen ${paths.length} salinan duplikat terpilih?

Salinan asli yang dipertahankan tidak akan terhapus.`
  );
  if (!confirm(confirmMsg)) return;

  const btnDelete = document.getElementById('btn-delete-dup');
  if (btnDelete) btnDelete.disabled = true;

  try {
    const res = await apiFetch('/api/storage/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Duplikat dibersihkan. Ruang dibebaskan: ${result.freed_formatted || result.reclaimed_formatted || '0 B'}.`, 'success');
      selectedDuplicatePaths.clear();
      await loadStorageDrives();
      showToast(txt('Run the scan again to refresh duplicates.', 'Jalankan pemindaian ulang untuk memperbarui daftar duplikat.'), 'info');
    } else {
      showToast(`Pembersihan gagal: ${result.error || 'Tidak ada path yang diizinkan.'}`, 'error');
    }
  } catch (err) {
    showToast(`Terjadi kesalahan: ${err.message}`, 'error');
  } finally {
    if (btnDelete) btnDelete.disabled = false;
  }
}

// Open File or Folder in Windows Explorer
async function openInExplorer(path) {
  if (!path) return;
  try {
    const res = await apiFetch('/api/storage/open_explorer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(txt(`Could not open Explorer: ${data.error || data.message || 'Path not found'}`, `Gagal membuka Explorer: ${data.error || data.message || 'Jalur tidak ditemukan'}`), 'error');
    }
  } catch (err) {
    showToast(txt(`Could not open Explorer: ${err.message}`, `Gagal membuka Explorer: ${err.message}`), 'error');
  }
}

// Delete a single item with confirmation
async function deleteSingleItem(path, name) {
  if (!path) return;
  const confirmMsg = txt(
    `Delete ${name || path}?

This removes the file from disk permanently.`,
    `Hapus ${name || path}?

Tindakan ini menghapus berkas dari disk secara permanen.`
  );
  if (!confirm(confirmMsg)) return;

  try {
    const res = await apiFetch('/api/storage/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [path] })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Berhasil menghapus: ${name || path}. Ruang dibebaskan: ${data.freed_formatted || data.reclaimed_formatted || '0 B'}.`, 'success');
      await loadStorageDrives();
    } else {
      showToast(txt(`Delete failed: ${data.error || 'The file is in use by another program.'}`, `Gagal menghapus: ${data.error || 'Berkas sedang digunakan program lain.'}`), 'error');
    }
  } catch (err) {
    showToast(`Terjadi kesalahan: ${err.message}`, 'error');
  }
}

// Helper escape functions
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapePath(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function exportDiagnosticReport() {
  if (!allDisks || allDisks.length === 0) {
    showToast(currentLang === 'en' ? 'No disk telemetry available to export.' : 'Belum ada telemetri disk untuk diekspor.', 'warning');
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sourceLabel = (disk) => getDataSourceMeta(disk).detail;
  const diskSections = allDisks.map((disk) => {
    const ha = disk.health_analysis || {};
    const metrics = ha.metrics || {};
    const health = healthValue(ha);
    const factors = (currentLang === 'en' ? (ha.layman_factors || []).map(f => f.title_en || f.title_id) : (ha.layman_factors || []).map(f => f.title_id || f.title_en));
    const gaps = Array.isArray(disk.data_gaps) ? disk.data_gaps : [];
    const attrs = (disk.smart_attributes || []).map((a) => `
      <tr><td>${escapeHtml(a.id_hex || '')}</td><td>${escapeHtml(a.name || '')}</td>
      <td>${a.current ?? '--'}</td><td>${a.worst ?? '--'}</td><td>${a.threshold ?? '--'}</td>
      <td>${a.raw_int ?? '--'}</td></tr>`).join('');
    return `
      <section>
        <h2>${escapeHtml(disk.name)} <small>${escapeHtml(disk.drive_letters_str || '-')}</small></h2>
        <p><b>Health:</b> ${health === null ? 'N/A' : `${health}%`} · <b>Source:</b> ${escapeHtml(sourceLabel(disk))}</p>
        <p><b>Interface:</b> ${escapeHtml(disk.bus_type || 'N/A')} · <b>Media:</b> ${escapeHtml(disk.media_type || 'N/A')} · <b>Size:</b> ${disk.size_gb ? `${disk.size_gb} GB` : 'N/A'} · <b>Temperature:</b> ${disk.temperature_c ?? 'N/A'} °C · <b>Power-On:</b> ${disk.power_on_hours ?? 'N/A'} h</p>
        <p><b>Data gaps:</b> ${gaps.length ? escapeHtml(gaps.join(', ')) : 'none reported'}</p>
        <p><b>Factors:</b> ${factors.length ? escapeHtml(factors.join(' · ')) : '—'}</p>
        <p><b>Metrics:</b> ${escapeHtml(JSON.stringify(metrics))}</p>
        <table><thead><tr><th>ID</th><th>Attribute</th><th>Current</th><th>Worst</th><th>Threshold</th><th>Raw</th></tr></thead><tbody>${attrs || '<tr><td colspan="6">No attributes available</td></tr>'}</tbody></table>
      </section>`;
  }).join('');
  const storageSection = storageResults ? `
    <section>
      <h2>Storage analysis</h2>
      <p><b>Scanned:</b> ${escapeHtml((storageResults.drives_scanned || []).join(', '))} · <b>Measured coverage:</b> ${storageResults.breakdown ? storageResults.breakdown.coverage_pct : 'N/A'}%</p>
      <p><b>Recommendations:</b> ${(storageResults.recommendations || []).length} · <b>Large items:</b> ${(storageResults.large_items || []).length} · <b>Duplicate groups:</b> ${(storageResults.duplicate_groups || []).length}</p>
    </section>` : '';
  const report = `<!DOCTYPE html><html lang="${currentLang}"><head><meta charset="utf-8">
    <title>DiagnoseMyDisk Diagnostic Report</title>
    <style>
      body{font:14px/1.55 system-ui,Segoe UI,sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;color:#18181b}
      h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px;border-bottom:1px solid #e4e4e7;padding-bottom:6px}
      small{font:600 12px ui-monospace,monospace;color:#71717a}p{margin:6px 0}
      table{width:100%;border-collapse:collapse;font:12px ui-monospace,monospace;margin-top:8px}
      th,td{border:1px solid #e4e4e7;padding:5px 7px;text-align:left}th{background:#fafafa}
      footer{margin-top:32px;color:#71717a;font-size:12px}
    </style></head><body>
    <h1>DiagnoseMyDisk Diagnostic Report</h1>
    <p>Generated ${new Date().toLocaleString()} · App version 3.0.0 · Local-only, zero telemetry</p>
    ${diskSections}
    ${storageSection}
    <footer>Every unavailable field is reported as N/A or listed as a data gap. This report was generated locally and was not uploaded anywhere.</footer>
    </body></html>`;
  const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `DiagnoseMyDisk-report-${stamp}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  showToast(currentLang === 'en' ? 'Diagnostic report downloaded.' : 'Laporan diagnostik berhasil diunduh.', 'success');
}


// Event listener klik di luar dropdown untuk menutup popover drive selector
document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('dropdown-drive-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    closeDriveDropdown();
  }
});

// Event listener ESC untuk menutup popover
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDriveDropdown();
    closeLogsModal();
  }
});


// ==============================================================================
// APPLICATION LOGS & DIAGNOSTICS CONTROLLER (v2.0.0)
// ==============================================================================
let appLogsPollTimer = null;

// Legacy aliases: the log console is now a workspace page, not a modal.
function openLogsModal() {
  setMode('logs');
}

function closeLogsModal() {
  if (currentMode === 'logs') setMode('layman');
}

function startLogsPolling() {
  fetchAppLogs();
  if (!appLogsPollTimer) {
    appLogsPollTimer = setInterval(fetchAppLogs, 1500);
  }
}

function stopLogsPolling() {
  if (appLogsPollTimer) {
    clearInterval(appLogsPollTimer);
    appLogsPollTimer = null;
  }
}

async function fetchAppLogs() {
  try {
    const res = await apiFetch('/api/logs');
    const data = await res.json();
    if (data.success && data.logs) {
      renderAppLogs(data.logs, data.log_file);
    }
  } catch (err) {
    console.error('Failed to fetch app logs:', err);
  }
}

function renderAppLogs(logs, logFilePath) {
  const consoleElem = document.getElementById('app-logs-console');
  const countElem = document.getElementById('app-logs-count');
  const pathElem = document.getElementById('app-logs-file-path');
  const chkAutoScroll = document.getElementById('chk-auto-scroll-logs');

  if (pathElem && logFilePath) {
    pathElem.textContent = `File: ${logFilePath}`;
    pathElem.title = logFilePath;
  }
  if (countElem) {
    countElem.textContent = txt(`${logs.length} entries`, `${logs.length} entri`);
  }
  if (!consoleElem) return;

  if (logs.length === 0) {
    consoleElem.innerHTML = `<div class="text-zinc-500 py-6 text-center font-mono text-xs">${txt('No application log entries yet.', 'Belum ada catatan log aplikasi.')}</div>`;
    return;
  }

  let html = '';
  logs.forEach((log) => {
    const lvl = (log.level || 'INFO').toUpperCase();
    let badgeColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (lvl === 'WARN') {
      badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    } else if (lvl === 'ERROR') {
      badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    }

    html += `
      <div class="flex items-start gap-2 hover:bg-zinc-900/60 p-0.5 rounded transition-colors text-[11px] font-mono leading-tight">
        <span class="text-zinc-500 shrink-0 text-[10px] tabular-nums">${log.timestamp || ''}</span>
        <span class="px-1 py-0.2 rounded text-[9px] font-bold border shrink-0 ${badgeColor}">${lvl}</span>
        <span class="text-purple-400 font-semibold shrink-0 text-[10px]">[${escapeHtml(log.component || 'App')}]</span>
        <span class="text-zinc-200 break-all select-text">${escapeHtml(log.message || '')}</span>
      </div>`;
  });

  consoleElem.innerHTML = html;

  if (chkAutoScroll && chkAutoScroll.checked) {
    consoleElem.scrollTop = consoleElem.scrollHeight;
  }
}

async function copyLogsToClipboard() {
  try {
    const res = await apiFetch('/api/logs');
    const data = await res.json();
    if (data.success && data.logs) {
      const textLines = data.logs.map(l => `[${l.timestamp}] [${l.level}] [${l.component}] ${l.message}`).join('\n');
      await navigator.clipboard.writeText(textLines);
      showToast(txt(`Copied ${data.logs.length} log lines.`, `${data.logs.length} baris log disalin.`), 'success');
    }
  } catch (err) {
    showToast(txt(`Could not copy logs: ${err.message}`, `Gagal menyalin log: ${err.message}`), 'error');
  }
}

async function openLogFileInNotepad() {
  try {
    const res = await apiFetch('/api/open_log_file', { method: 'POST' });
    const data = await res.json();
    if (!data.success) {
      showToast(txt(`Could not open the log file: ${data.error}`, `Gagal membuka file log: ${data.error}`), 'error');
    }
  } catch (err) {
    showToast(txt(`Could not open the log file: ${err.message}`, `Gagal membuka file log: ${err.message}`), 'error');
  }
}

async function clearAppLogs() {
  const prompt = txt('Clear all current log entries?', 'Bersihkan seluruh log saat ini?');
  if (!confirm(prompt)) return;
  try {
    await apiFetch('/api/clear_logs', { method: 'POST' });
    await fetchAppLogs();
  } catch (err) {
    console.error('Failed to clear logs:', err);
  }
}

// ==============================================================================
// INTERACTIVE FOLDER INSPECTION & EXPANSION CONTROLLER (v2.1.0)
// ==============================================================================
const expandedFoldersCache = new Map();

async function toggleRecommendationFolderExpand(idx, path) {
  const panel = document.getElementById(`rec-expand-panel-${idx}`);
  const chevron = document.getElementById(`rec-chevron-${idx}`);
  const lbl = document.getElementById(`rec-expand-lbl-${idx}`);
  const content = document.getElementById(`rec-expand-content-${idx}`);
  if (!panel || !chevron) return;

  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    chevron.classList.add('rotate-90');
    chevron.classList.add('text-blue-500');
    if (lbl) lbl.textContent = txt('Close folder contents', 'Tutup isi folder');

    if (expandedFoldersCache.has(path)) {
      renderFolderFileList(content, expandedFoldersCache.get(path));
      return;
    }

    content.innerHTML = `
      <div class="flex items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400 py-3 px-2 justify-center font-mono">
        <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-500"></i>
        <span>${txt('Reading folder contents...', 'Memindai daftar berkas di dalam folder...')}</span>
      </div>`;
    safeCreateIcons();

    try {
      const res = await apiFetch(`/api/storage/inspect_folder?path=${encodeURIComponent(path)}&limit=100`);
      const data = await res.json();
      if (data.success) {
        expandedFoldersCache.set(path, data);
        renderFolderFileList(content, data);
      } else {
        content.innerHTML = `
          <div class="p-3 text-xs text-rose-500 font-mono bg-rose-500/10 rounded border border-rose-500/20">
            ${txt('Could not read folder: ', 'Gagal membaca folder: ')}${escapeHtml(data.error || 'Akses ditolak atau folder tidak ditemukan.')}
          </div>`;
      }
    } catch (err) {
      content.innerHTML = `
        <div class="p-3 text-xs text-rose-500 font-mono bg-rose-500/10 rounded border border-rose-500/20">
          ${txt('Network error while reading: ', 'Kesalahan jaringan saat memindai: ')}${escapeHtml(err.message)}
        </div>`;
    }
  } else {
    panel.classList.add('hidden');
    chevron.classList.remove('rotate-90');
    chevron.classList.remove('text-blue-500');
    if (lbl) lbl.textContent = txt('Inspect contents', 'Lihat isi');
  }
}

async function toggleLargeFolderExpand(idx, path) {
  const row = document.getElementById(`large-expand-row-${idx}`);
  const chevron = document.getElementById(`large-chevron-${idx}`);
  const content = document.getElementById(`large-expand-content-${idx}`);
  if (!row || !content) return;

  const isHidden = row.classList.contains('hidden');
  if (isHidden) {
    row.classList.remove('hidden');
    if (chevron) {
      chevron.classList.add('rotate-90');
      chevron.classList.add('text-blue-500');
    }

    if (expandedFoldersCache.has(path)) {
      renderFolderFileList(content, expandedFoldersCache.get(path));
      return;
    }

    content.innerHTML = `
      <div class="flex items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400 py-3 px-2 justify-center font-mono">
        <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-500"></i>
        <span>${txt('Reading folder contents...', 'Memindai daftar berkas di dalam folder...')}</span>
      </div>`;
    safeCreateIcons();

    try {
      const res = await apiFetch(`/api/storage/inspect_folder?path=${encodeURIComponent(path)}&limit=100`);
      const data = await res.json();
      if (data.success) {
        expandedFoldersCache.set(path, data);
        renderFolderFileList(content, data);
      } else {
        content.innerHTML = `
          <div class="p-3 text-xs text-rose-500 font-mono bg-rose-500/10 rounded border border-rose-500/20">
            ${txt('Could not read folder: ', 'Gagal membaca folder: ')}${escapeHtml(data.error || 'Akses ditolak atau folder tidak ditemukan.')}
          </div>`;
      }
    } catch (err) {
      content.innerHTML = `
        <div class="p-3 text-xs text-rose-500 font-mono bg-rose-500/10 rounded border border-rose-500/20">
          ${txt('Network error while reading: ', 'Kesalahan jaringan saat memindai: ')}${escapeHtml(err.message)}
        </div>`;
    }
  } else {
    row.classList.add('hidden');
    if (chevron) {
      chevron.classList.remove('rotate-90');
      chevron.classList.remove('text-blue-500');
    }
  }
}

function renderFolderFileList(container, data) {
  if (!container) return;
  const items = data.items || [];
  if (items.length === 0) {
    container.innerHTML = `
      <div class="py-3 px-2 text-center text-xs text-zinc-400 font-mono">
        ${txt('This folder is empty (0 files).', 'Folder ini kosong (0 berkas).')}
      </div>`;
    return;
  }

  let html = `
    <div class="space-y-2">
      <div class="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400 pb-1.5 border-b border-zinc-200 dark:border-zinc-800 flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <span class="font-bold text-zinc-800 dark:text-zinc-200">${txt(`${data.total_items} top items`, `${data.total_items} item teratas`)}</span>
          <span>•</span>
          <span class="text-zinc-500">${txt(`${data.total_files} files (${data.total_bytes_formatted}), ${data.total_dirs} sub-folders`, `${data.total_files} berkas (${data.total_bytes_formatted}), ${data.total_dirs} sub-folder`)}</span>
        </div>
        <span class="text-[10px] text-zinc-400">${txt('Sorted by largest size', 'Urut dari ukuran terbesar')}</span>
      </div>

      <div class="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scroll">`;

  items.forEach((file) => {
    const isDir = file.is_dir;
    let iconName = isDir ? 'folder' : 'file';
    let iconColor = isDir ? 'text-amber-500' : 'text-blue-400';

    if (!isDir) {
      const ext = (file.extension || '').toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp', '.ico', '.svg'].includes(ext)) {
        iconName = 'image';
        iconColor = 'text-emerald-400';
      } else if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
        iconName = 'archive';
        iconColor = 'text-amber-400';
      } else if (['.exe', '.msi', '.dll'].includes(ext)) {
        iconName = 'cpu';
        iconColor = 'text-purple-400';
      } else if (['.log', '.txt', '.json', '.xml', '.yaml'].includes(ext)) {
        iconName = 'file-text';
        iconColor = 'text-zinc-400';
      }
    }

    html += `
      <div class="flex items-center justify-between gap-3 p-1.5 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 transition-colors text-xs font-mono group">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <i data-lucide="${iconName}" class="w-3.5 h-3.5 shrink-0 ${iconColor}"></i>
          <span class="font-medium text-zinc-800 dark:text-zinc-200 truncate" title="${escapeHtml(file.path)}">
            ${escapeHtml(file.name)}
          </span>
          ${isDir ? '<span class="text-[9px] px-1 rounded bg-amber-500/10 text-amber-500 shrink-0">Folder</span>' : ''}
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-[11px] text-zinc-400 hidden sm:inline tabular-nums">${file.mtime_str || '-'}</span>
          <span class="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums min-w-[70px] text-right">${file.size_formatted}</span>
          <button onclick="openInExplorer(decodeURIComponent('${jsPathArg(file.path)}'))" class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all" title="${txt('Open file in File Explorer', 'Buka berkas di File Explorer')}">
            <i data-lucide="folder-open" class="w-3 h-3"></i>
          </button>
        </div>
      </div>`;
  });

  html += `
      </div>
    </div>`;

  container.innerHTML = html;
  safeCreateIcons();
}
