import Foundation

public actor HistoryService {
    public static let shared = HistoryService()
    
    private let fileManager = FileManager.default
    private var snapshots: [HistorySnapshot] = []
    
    private static var historyFileURL: URL {
        let fm = FileManager.default
        let appSupport = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first ?? fm.temporaryDirectory
        let dmdDir = appSupport.appendingPathComponent("DiagnoseMyDisk", isDirectory: true)
        if !fm.fileExists(atPath: dmdDir.path) {
            try? fm.createDirectory(at: dmdDir, withIntermediateDirectories: true)
        }
        return dmdDir.appendingPathComponent("history.json")
    }
    
    public init() {
        self.snapshots = Self.loadInitialSnapshots(from: Self.historyFileURL)
    }
    
    private static func loadInitialSnapshots(from fileURL: URL) -> [HistorySnapshot] {
        let fm = FileManager.default
        guard fm.fileExists(atPath: fileURL.path),
              let data = try? Data(contentsOf: fileURL) else {
            return []
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let decoded = try? decoder.decode([HistorySnapshot].self, from: data) {
            return decoded
        }
        return []
    }
    
    private func saveSnapshots() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(snapshots) else { return }
        
        let tempURL = Self.historyFileURL.deletingLastPathComponent().appendingPathComponent("history.tmp")
        do {
            try data.write(to: tempURL, options: .atomic)
            _ = try fileManager.replaceItemAt(Self.historyFileURL, withItemAt: tempURL)
        } catch {
            try? data.write(to: Self.historyFileURL, options: .atomic)
        }
    }
    
    public func recordSnapshot(
        diskId: String,
        diskName: String,
        healthScore: Int,
        temperatureC: Int?,
        statusLabel: String,
        dataProvenance: String
    ) {
        let snapshot = HistorySnapshot(
            diskId: diskId,
            diskName: diskName,
            timestamp: Date(),
            healthScore: healthScore,
            temperatureC: temperatureC,
            statusLabel: statusLabel,
            dataProvenance: dataProvenance
        )
        
        snapshots.insert(snapshot, at: 0)
        
        // Retain maximum 30 snapshots per disk
        let diskSnapshots = snapshots.filter { $0.diskId == diskId }
        if diskSnapshots.count > 30 {
            let toRemove = Set(diskSnapshots.suffix(from: 30).map(\.id))
            snapshots.removeAll { toRemove.contains($0.id) }
        }
        
        saveSnapshots()
    }
    
    public func getSnapshots(for diskId: String? = nil) -> [HistorySnapshot] {
        if let diskId = diskId {
            return snapshots.filter { $0.diskId == diskId }
        }
        return snapshots
    }
    
    public func getTrend(for diskId: String) -> DiskTrend {
        let diskSnaps = snapshots.filter { $0.diskId == diskId }
        guard let current = diskSnaps.first else {
            return DiskTrend(diskId: diskId, currentScore: 100, trendLabel: "No history yet")
        }
        
        if diskSnaps.count > 1 {
            let previous = diskSnaps[1]
            let delta = current.healthScore - previous.healthScore
            let label: String
            if delta > 0 {
                label = "Improving (+\(delta)%)"
            } else if delta < 0 {
                label = "Degrading (\(delta)%)"
            } else {
                label = "Stable (0% variance)"
            }
            return DiskTrend(diskId: diskId, currentScore: current.healthScore, previousScore: previous.healthScore, delta: delta, trendLabel: label)
        }
        
        return DiskTrend(diskId: diskId, currentScore: current.healthScore, delta: 0, trendLabel: "Stable (Initial snapshot)")
    }
    
    public func clearHistory(for diskId: String? = nil) {
        if let diskId = diskId {
            snapshots.removeAll { $0.diskId == diskId }
        } else {
            snapshots.removeAll()
        }
        saveSnapshots()
    }
}
