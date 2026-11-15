# Technical Specification: DiagnoseMyDisk for macOS

**Target Architecture:** Apple Silicon (arm64) & macOS 14.0+ (Sonoma / Sequoia)  
**Technology Stack:** Swift 6, SwiftUI, AppKit, XcodeGen, Hardened Runtime  
**Bundle Identifier:** `com.geadalfa.DiagnoseMyDisk`  
**License:** CC BY-NC 4.0 (Non-Commercial)  
**Privacy & Compliance:** 100% Offline, Zero Telemetry, UU PDP (Law No. 27 of 2022) Compliant  

---

## 1. Problem Statement & User Workflow

1. **Unmasking Firmware Normalization:** Many modern SSDs (both internal NVMe and external drives) report "100% Good" or "Verified" even when physical flash cells, spare block pools, or error rates show initial degradation. DiagnoseMyDisk provides evidence-first, unmasked true health analysis.
2. **Apple Silicon & APFS Forensic Storage Telemetry:** Deliver native storage inspection for internal Apple Fabric NVMe SSDs, external Thunderbolt/USB drives, and APFS containers without relying on heavy third-party kernel extensions.
3. **200-Block LBA Surface Scanner:** Provide a high-visibility, 40×5 grid surface block latency tester that scans storage blocks sequentially, recording millisecond-precision response times to detect slow, degraded, or bad sectors before data loss occurs.
4. **Drive Doctor (Filesystem & APFS Maintenance):** Offer guarded, non-destructive filesystem health checks (`diskutil verifyVolume`, APFS container integrity, and local APFS snapshot auditing) directly within a native desktop interface.
5. **PC Manager Style Storage Reclamation:** Safely identify and reclaim gigabytes of orphaned developer caches (Xcode DerivedData, CocoaPods, Homebrew, npm), user caches, duplicate files via SHA-256 byte-matching, and large files without touching protected SIP or system files.

---

## 2. Window & Scene Topology

- **Window Topology:** Standard macOS desktop document/utility window with unified titlebar (`.windowToolbarStyle(.unified)`).
- **Scene Architecture:**
  - `WindowGroup`: Primary application workspace with responsive `NavigationSplitView`.
  - `Settings`: Native macOS settings window triggered via standard keyboard shortcut (`Cmd + ,`).
- **Sidebar Navigation Hierarchy:**
  1. 💽 **Disks & Telemetry** (`Cmd + 1`): Drive selector, True Health ring, firmware anomaly indicators, partition tree, and technical registers.
  2. 🔍 **Surface Scanner** (`Cmd + 2`): 40-column × 5-row interactive 200-block LBA map with real-time latency heatmap, speed metrics, and error tally.
  3. 🩺 **Drive Doctor** (`Cmd + 3`): Volume integrity verification, APFS container check, local snapshot viewer, and real-time terminal output.
  4. 🧹 **Storage & Cleanup** (`Cmd + 4`): Segmented disk capacity breakdown, developer/system cache cleaner, large/old files table, and SHA-256 duplicate manager.
  5. 📈 **Health History** (`Cmd + 5`): Local persistent snapshot timeline (up to 30 snapshots per disk) with trend diffs and export tools.
  6. 📋 **Diagnostic Logs** (`Cmd + 6`): Live activity logs with filter, copy, and export functions.
- **Top Bar / Toolbar:**
  - Active disk indicator badge
  - "Scan / Refresh" primary action (`Cmd + R`)
  - Export Diagnostic Report button (`Cmd + E`)
  - Language toggle (English / Bahasa Indonesia)

---

## 3. Data & State Contract

- **State Framework:** Swift Observation framework (`@Observable` macro) with strict `@MainActor` UI isolation.
- **Data Models:**
  - `DiskInfo` (`Sendable`, `Identifiable`, `Codable`):
    - `id`: Unique identifier (serial number or BSD name fallback)
    - `bsdName`: BSD device node (e.g., `disk0`, `disk1`)
    - `model`: Device model string (e.g., `APPLE SSD AP0256Q`)
    - `serialNumber`: Hardware serial number
    - `sizeInBytes`: Total storage capacity
    - `freeSpaceInBytes`: Available free storage
    - `isInternal`: Boolean internal vs external/removable
    - `isSolidState`: Boolean SSD vs HDD
    - `smartStatus`: Native status (`Verified`, `Failing`, `Unsupported`)
    - `trueHealthScore`: Computed true health percentage (0–100%)
    - `statusLabel`: Honest verdict (`Optimal`, `Good`, `Caution`, `Warning`, `Critical`)
    - `busProtocol`: Protocol string (`Apple Fabric`, `PCI-Express`, `USB`, `SATA`)
    - `trimSupported`: Boolean TRIM support
    - `dataProvenance`: Tag indicating source (e.g., `LIVE DISKUTIL / SPSTORAGE`)
    - `volumes`: List of child volume representations
  - `SurfaceBlock` (`Sendable`, `Identifiable`, `Equatable`):
    - `id`: Index 0..199
    - `status`: `unscanned`, `scanning`, `healthy` (<20ms), `warning` (20-100ms), `slow` (>100ms), `bad` (I/O error)
    - `latencyMs`: Microsecond-measured response time in milliseconds
    - `byteOffset`: Disk offset tested
  - `StorageCategory` (`Sendable`, `Identifiable`):
    - `id`: Category enum (`developerCaches`, `userCaches`, `systemLogs`, `trash`, `largeFiles`, `duplicates`)
    - `displayName`: Localized name
    - `byteSize`: Total calculated size
    - `itemCount`: Number of files/directories
    - `paths`: Candidate items with size and modification date
    - `isSelected`: Selection state for cleanup
  - `HistorySnapshot` (`Sendable`, `Codable`, `Identifiable`):
    - `id`: UUID
    - `diskId`: Disk identifier
    - `timestamp`: Date recorded
    - `healthScore`: Recorded health percentage
    - `temperatureC`: Optional temperature reading
    - `statusLabel`: Verdict string

---

## 4. Security & Entitlements Matrix

- **Principles:** Strictly adhere to the Principle of Least Privilege and Apple Hardened Runtime.
- **Entitlements (`App.entitlements`):**
  - `com.apple.security.app-sandbox`: Disabled for low-level disk diagnostic tools (`diskutil`, `fsck_apfs`, raw storage queries) to access physical drive telemetry.
  - `com.apple.security.cs.allow-unsigned-executable-memory`: `false`
  - `com.apple.security.cs.disable-library-validation`: `false`
  - `com.apple.security.files.user-selected.read-write`: `true`
- **Guards:**
  - Zero Shell Interpolation: All child processes (`diskutil`, `system_profiler`) run via `Foundation.Process` with argument arrays. No `sh -c` invocations.
  - SIP Protection: Storage cleaner strictly excludes `/System`, `/usr`, `/bin`, `/sbin`, `/Library/Apple`, and active application bundles (`.app`).
  - Zero Network Calls: The application makes zero HTTP/HTTPS network requests. All diagnostics execute entirely locally on Apple Silicon.

---

## 5. UI/UX Anti-Slop Thesis (Apple Human Interface Guidelines)

- **Palette & Contrast:**
  - Semantic system colors: `Color(nsColor: .windowBackgroundColor)`, `Color(nsColor: .controlBackgroundColor)`, `.primary`, `.secondary`, `.accentColor`.
  - Health status colors: Apple system `.green`, `.yellow`, `.orange`, `.red`, and neutral `.secondary`.
  - Surface scanner heatmap:
    - Normal (<20ms): `.green`
    - Warning (20–100ms): `.yellow`
    - Slow (>100ms): `.orange`
    - Bad / I/O Error: `.red`
    - Pending / Unscanned: `Color(nsColor: .separatorColor)`
  - Materials: `.ultraThinMaterial` and native desktop grouped form backgrounds.
  - Zero gradients, zero generic SaaS card hover animations.
- **Typography:**
  - Apple SF Pro for UI prose.
  - SF Mono with mandatory `.monospacedDigit()` for all numeric values, disk sizes, percentages, temperatures, LBA block latencies, and timestamps.
- **Keyboard Shortcuts:**
  - `Cmd + 1` through `Cmd + 6`: Switch sidebar workspaces
  - `Cmd + R`: Refresh disk telemetry
  - `Cmd + E`: Export comprehensive diagnostic report
  - `Cmd + ,`: Open Preferences / Settings
- **Five Interactive States:**
  - Every view defines:
    1. Empty State (`ContentUnavailableView`)
    2. Loading State (`ProgressView` with explanatory label)
    3. Populated State (high-density, clean visual hierarchy)
    4. Error State (actionable recovery with "Coba Lagi / Retry" button)
    5. Focus / Hover State (subtle native selection styling)
