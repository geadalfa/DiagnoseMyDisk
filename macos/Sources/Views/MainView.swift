import SwiftUI
import AppKit

public enum NavigationTab: String, CaseIterable, Identifiable {
    case disks = "Disks & Telemetry"
    case scanner = "Surface Scanner"
    case doctor = "Drive Doctor"
    case storage = "Storage & Cleanup"
    case history = "Health History"
    case logs = "Diagnostic Logs"
    
    public var id: String { rawValue }
    
    public var iconName: String {
        switch self {
        case .disks: return "internaldrive.fill"
        case .scanner: return "square.grid.3x3.fill"
        case .doctor: return "stethoscope"
        case .storage: return "archivebox.fill"
        case .history: return "chart.xyaxis.line"
        case .logs: return "terminal.fill"
        }
    }
}

@Observable
@MainActor
public final class AppState {
    public var selectedTab: NavigationTab = .disks
    
    // Disks
    public var disks: [DiskInfo] = []
    public var selectedDiskId: String = ""
    public var isLoadingDisks: Bool = false
    public var diskErrorMessage: String? = nil
    
    // Surface Scanner
    public var surfaceBlocks: [SurfaceBlock] = (0..<200).map { SurfaceBlock(id: $0) }
    public var scanMetrics: SurfaceScanMetrics = SurfaceScanMetrics()
    public var selectedSurfaceBlock: SurfaceBlock? = nil
    
    // Drive Doctor
    public var doctorSelectedVolume: String = "/"
    public var isDoctorRunning: Bool = false
    public var doctorTerminalLogs: [String] = []
    public var doctorSnapshots: [APFSSnapshot] = []
    
    // Storage Cleaner
    public var storageCategories: [StorageCategoryItem] = []
    public var duplicateGroups: [DuplicateGroup] = []
    public var isStorageScanning: Bool = false
    public var isStorageCleaning: Bool = false
    public var storageScanStatus: String = "Ready"
    public var lastReclamationResult: CleanupReclamationResult? = nil
    
    // History & Trends
    public var historySnapshots: [HistorySnapshot] = []
    public var currentTrend: DiskTrend = DiskTrend(diskId: "", currentScore: 100)
    
    // Activity Logs
    public var logs: [String] = []
    
    public init() {
        appendLog("[DiagnoseMyDisk] Application initialized. Running in native Apple Silicon mode.")
    }
    
    public func appendLog(_ message: String) {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        let timestamp = formatter.string(from: Date())
        logs.append("[\(timestamp)] \(message)")
    }
    
    public func refreshDisks() async {
        isLoadingDisks = true
        diskErrorMessage = nil
        appendLog("[Telemetry] Refreshing connected physical storage disks...")
        
        let fetched = await DiskTelemetryService.shared.fetchDisks()
        self.disks = fetched
        self.isLoadingDisks = false
        
        if let first = fetched.first {
            if selectedDiskId.isEmpty || !fetched.contains(where: { $0.id == selectedDiskId }) {
                selectedDiskId = first.id
            }
            appendLog("[Telemetry] Discovered \(fetched.count) disk(s). Primary: \(first.model) (Score: \(first.trueHealthScore)%)")
            
            // Record snapshot in history
            await HistoryService.shared.recordSnapshot(
                diskId: first.id,
                diskName: first.model,
                healthScore: first.trueHealthScore,
                temperatureC: first.temperatureC,
                statusLabel: first.verdict.rawValue,
                dataProvenance: first.dataProvenance
            )
            
            await reloadHistory()
        } else {
            diskErrorMessage = "No storage disks found via macOS diskutil."
            appendLog("❌ [Telemetry] No disks discovered.")
        }
    }
    
    public func startSurfaceScan() async {
        appendLog("[Surface Scanner] Starting 200-block LBA latency sweep...")
        await SurfaceScanService.shared.scan(targetPath: "/") { [weak self] block, metrics in
            Task { @MainActor in
                guard let self = self else { return }
                if block.id < self.surfaceBlocks.count {
                    self.surfaceBlocks[block.id] = block
                }
                self.scanMetrics = metrics
            }
        }
        appendLog("[Surface Scanner] Surface scan complete. Scanned: \(scanMetrics.scannedBlocks) blocks. Avg Latency: \(String(format: "%.2f", scanMetrics.averageLatencyMs))ms.")
    }
    
    public func cancelSurfaceScan() async {
        await SurfaceScanService.shared.cancel()
        appendLog("[Surface Scanner] Scan cancelled by user.")
    }
    
    public func runDriveDoctorVerify() async {
        isDoctorRunning = true
        appendLog("[Drive Doctor] Launching filesystem verification on volume '\(doctorSelectedVolume)'...")
        let result = await DriveDoctorService.shared.verifyVolume(targetVolume: doctorSelectedVolume) { [weak self] line in
            Task { @MainActor in
                self?.doctorTerminalLogs.append(line)
            }
        }
        isDoctorRunning = false
        appendLog("[Drive Doctor] Verification finished with verdict: \(result.status.rawValue).")
    }
    
    public func runDriveDoctorSnapshots() async {
        isDoctorRunning = true
        appendLog("[Drive Doctor] Inspecting APFS snapshots on '\(doctorSelectedVolume)'...")
        let snaps = await DriveDoctorService.shared.listSnapshots(targetVolume: doctorSelectedVolume) { [weak self] line in
            Task { @MainActor in
                self?.doctorTerminalLogs.append(line)
            }
        }
        self.doctorSnapshots = snaps
        isDoctorRunning = false
    }
    
    public func scanStorage() async {
        isStorageScanning = true
        storageScanStatus = "Calculating cache allocations..."
        appendLog("[Storage] Scanning developer caches, user caches, logs, and duplicates...")
        
        let (cats, dups) = await StorageCleaningService.shared.scanStorageCategories { [weak self] status in
            Task { @MainActor in
                self?.storageScanStatus = status
            }
        }
        
        self.storageCategories = cats
        self.duplicateGroups = dups
        self.isStorageScanning = false
        appendLog("[Storage] Storage analysis complete. Identified \(cats.count) categories and \(dups.count) duplicate groups.")
    }
    
    public func executeStorageCleanup() async {
        isStorageCleaning = true
        appendLog("[Storage] Executing safe cleanup for selected cache items and duplicate copies...")
        
        let result = await StorageCleaningService.shared.executeCleanup(
            categories: storageCategories,
            duplicates: duplicateGroups
        ) { [weak self] status in
            Task { @MainActor in
                self?.appendLog("[Storage] \(status)")
            }
        }
        
        self.lastReclamationResult = result
        self.isStorageCleaning = false
        appendLog("[Storage] Cleanup complete. Successfully reclaimed: \(ByteCountFormatter.string(fromByteCount: result.reclaimedBytes, countStyle: .decimal)).")
        
        // Refresh storage state post-cleanup
        await scanStorage()
    }
    
    public func reloadHistory() async {
        let snaps = await HistoryService.shared.getSnapshots()
        self.historySnapshots = snaps
        if let first = disks.first {
            self.currentTrend = await HistoryService.shared.getTrend(for: first.id)
        }
    }
    
    public func clearHistory() async {
        await HistoryService.shared.clearHistory()
        self.historySnapshots = []
        self.currentTrend = DiskTrend(diskId: selectedDiskId, currentScore: 100, trendLabel: "History cleared")
        appendLog("[History] Snapshot history cleared.")
    }
    
    public func exportHTMLReport() {
        guard let disk = disks.first(where: { $0.id == selectedDiskId }) ?? disks.first else { return }
        let html = ReportExportService.exportHTML(
            disk: disk,
            blocks: surfaceBlocks,
            metrics: scanMetrics,
            snapshots: historySnapshots
        )
        
        let savePanel = NSSavePanel()
        savePanel.allowedContentTypes = [.html]
        savePanel.nameFieldStringValue = "DiagnoseMyDisk_Report_\(disk.bsdName).html"
        savePanel.begin { response in
            if response == .OK, let url = savePanel.url {
                try? html.write(to: url, atomically: true, encoding: .utf8)
                self.appendLog("[Export] Diagnostic report exported to: \(url.path)")
            }
        }
    }
}

public struct MainView: View {
    @State private var state = AppState()
    
    public init() {}
    
    public var body: some View {
        NavigationSplitView {
            List(NavigationTab.allCases, selection: $state.selectedTab) { tab in
                NavigationLink(value: tab) {
                    Label(tab.rawValue, systemImage: tab.iconName)
                }
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 230, max: 280)
        } detail: {
            Group {
                switch state.selectedTab {
                case .disks:
                    DisksView(
                        disks: state.disks,
                        selectedDiskId: state.selectedDiskId,
                        isLoading: state.isLoadingDisks,
                        errorMessage: state.diskErrorMessage,
                        onSelectDisk: { state.selectedDiskId = $0 },
                        onRefresh: {
                            Task { await state.refreshDisks() }
                        }
                    )
                case .scanner:
                    SurfaceScannerView(
                        blocks: state.surfaceBlocks,
                        metrics: state.scanMetrics,
                        selectedBlock: state.selectedSurfaceBlock,
                        onSelectBlock: { state.selectedSurfaceBlock = $0 },
                        onStartScan: {
                            Task { await state.startSurfaceScan() }
                        },
                        onCancelScan: {
                            Task { await state.cancelSurfaceScan() }
                        }
                    )
                case .doctor:
                    DriveDoctorView(
                        volumes: state.disks.first(where: { $0.id == state.selectedDiskId })?.volumes ?? [],
                        selectedVolume: state.doctorSelectedVolume,
                        isRunning: state.isDoctorRunning,
                        terminalLogs: state.doctorTerminalLogs,
                        snapshots: state.doctorSnapshots,
                        onSelectVolume: { state.doctorSelectedVolume = $0 },
                        onVerifyVolume: {
                            Task { await state.runDriveDoctorVerify() }
                        },
                        onListSnapshots: {
                            Task { await state.runDriveDoctorSnapshots() }
                        }
                    )
                case .storage:
                    StorageCleanerView(
                        categories: state.storageCategories,
                        duplicates: state.duplicateGroups,
                        isScanning: state.isStorageScanning,
                        isCleaning: state.isStorageCleaning,
                        scanStatus: state.storageScanStatus,
                        lastReclamation: state.lastReclamationResult,
                        onScan: {
                            Task { await state.scanStorage() }
                        },
                        onToggleCategory: { catType in
                            if let idx = state.storageCategories.firstIndex(where: { $0.type == catType }) {
                                state.storageCategories[idx].isSelected.toggle()
                                for i in state.storageCategories[idx].items.indices {
                                    state.storageCategories[idx].items[i].isSelected = state.storageCategories[idx].isSelected
                                }
                            }
                        },
                        onToggleItem: { path in
                            for cIdx in state.storageCategories.indices {
                                if let iIdx = state.storageCategories[cIdx].items.firstIndex(where: { $0.path == path }) {
                                    state.storageCategories[cIdx].items[iIdx].isSelected.toggle()
                                }
                            }
                        },
                        onToggleDuplicate: { path in
                            for gIdx in state.duplicateGroups.indices {
                                if let iIdx = state.duplicateGroups[gIdx].items.firstIndex(where: { $0.path == path }) {
                                    state.duplicateGroups[gIdx].items[iIdx].isSelected.toggle()
                                }
                            }
                        },
                        onClean: {
                            Task { await state.executeStorageCleanup() }
                        }
                    )
                case .history:
                    HistoryView(
                        snapshots: state.historySnapshots,
                        trend: state.currentTrend,
                        onClearHistory: {
                            Task { await state.clearHistory() }
                        }
                    )
                case .logs:
                    LogsView(
                        logs: state.logs,
                        onClearLogs: { state.logs.removeAll() }
                    )
                }
            }
            .toolbar {
                ToolbarItem(placement: .automatic) {
                    Button {
                        Task { await state.refreshDisks() }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                    .keyboardShortcut("r", modifiers: .command)
                    .help("Refresh Storage Telemetry (Cmd + R)")
                }
                
                ToolbarItem(placement: .automatic) {
                    Button {
                        state.exportHTMLReport()
                    } label: {
                        Label("Export Report", systemImage: "square.and.arrow.up")
                    }
                    .keyboardShortcut("e", modifiers: .command)
                    .help("Export Forensic Diagnostic Report (Cmd + E)")
                }
            }
        }
        .task {
            await state.refreshDisks()
            await state.scanStorage()
        }
    }
}
