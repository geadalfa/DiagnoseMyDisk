import Foundation

public enum SurfaceBlockStatus: String, Sendable, Codable, Equatable {
    case unscanned = "unscanned"
    case scanning = "scanning"
    case healthy = "healthy"   // < 20ms
    case warning = "warning"   // 20ms - 100ms
    case slow = "slow"         // > 100ms
    case bad = "bad"           // I/O read failure
    
    public var label: String {
        switch self {
        case .unscanned: return "Pending"
        case .scanning: return "Testing"
        case .healthy: return "< 20ms"
        case .warning: return "20-100ms"
        case .slow: return "> 100ms"
        case .bad: return "Bad / Error"
        }
    }
}

public struct SurfaceBlock: Sendable, Identifiable, Equatable {
    public var id: Int
    public var offsetBytes: Int64
    public var latencyMs: Double
    public var status: SurfaceBlockStatus
    
    public init(id: Int, offsetBytes: Int64 = 0, latencyMs: Double = 0.0, status: SurfaceBlockStatus = .unscanned) {
        self.id = id
        self.offsetBytes = offsetBytes
        self.latencyMs = latencyMs
        self.status = status
    }
}

public struct SurfaceScanMetrics: Sendable, Equatable {
    public var totalBlocks: Int
    public var scannedBlocks: Int
    public var healthyCount: Int
    public var warningCount: Int
    public var slowCount: Int
    public var badCount: Int
    public var averageLatencyMs: Double
    public var currentSpeedMBs: Double
    public var elapsedTimeSec: Double
    public var etaSeconds: Double
    public var isScanning: Bool
    public var currentTarget: String
    
    public var progress: Double {
        guard totalBlocks > 0 else { return 0.0 }
        return Double(scannedBlocks) / Double(totalBlocks)
    }
    
    public init(
        totalBlocks: Int = 200,
        scannedBlocks: Int = 0,
        healthyCount: Int = 0,
        warningCount: Int = 0,
        slowCount: Int = 0,
        badCount: Int = 0,
        averageLatencyMs: Double = 0.0,
        currentSpeedMBs: Double = 0.0,
        elapsedTimeSec: Double = 0.0,
        etaSeconds: Double = 0.0,
        isScanning: Bool = false,
        currentTarget: String = ""
    ) {
        self.totalBlocks = totalBlocks
        self.scannedBlocks = scannedBlocks
        self.healthyCount = healthyCount
        self.warningCount = warningCount
        self.slowCount = slowCount
        self.badCount = badCount
        self.averageLatencyMs = averageLatencyMs
        self.currentSpeedMBs = currentSpeedMBs
        self.elapsedTimeSec = elapsedTimeSec
        self.etaSeconds = etaSeconds
        self.isScanning = isScanning
        self.currentTarget = currentTarget
    }
}
