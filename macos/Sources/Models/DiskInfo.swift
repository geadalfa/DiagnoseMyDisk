import Foundation

public enum HealthVerdict: String, Sendable, Codable {
    case optimal = "Optimal"
    case good = "Good"
    case caution = "Caution"
    case warning = "Warning"
    case critical = "Critical"
    case unknown = "Unknown"
    
    public var labelId: String {
        switch self {
        case .optimal: return "Sangat Sehat"
        case .good: return "Sehat"
        case .caution: return "Perhatian"
        case .warning: return "Peringatan"
        case .critical: return "Kritis"
        case .unknown: return "Tidak Diketahui"
        }
    }
}

public struct SmartAttribute: Sendable, Identifiable, Codable {
    public var id: Int
    public var name: String
    public var current: Int
    public var worst: Int
    public var threshold: Int
    public var rawValue: String
    public var status: String
    
    public init(id: Int, name: String, current: Int, worst: Int, threshold: Int, rawValue: String, status: String) {
        self.id = id
        self.name = name
        self.current = current
        self.worst = worst
        self.threshold = threshold
        self.rawValue = rawValue
        self.status = status
    }
}

public struct VolumeInfo: Sendable, Identifiable, Codable {
    public var id: String { bsdName.isEmpty ? mountPoint : bsdName }
    public var name: String
    public var bsdName: String
    public var mountPoint: String
    public var fileSystem: String
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var isWritable: Bool
    
    public var usedBytes: Int64 {
        max(0, totalBytes - freeBytes)
    }
    
    public var usagePercentage: Double {
        guard totalBytes > 0 else { return 0.0 }
        return Double(usedBytes) / Double(totalBytes) * 100.0
    }
    
    public init(name: String, bsdName: String, mountPoint: String, fileSystem: String, totalBytes: Int64, freeBytes: Int64, isWritable: Bool) {
        self.name = name
        self.bsdName = bsdName
        self.mountPoint = mountPoint
        self.fileSystem = fileSystem
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.isWritable = isWritable
    }
}

public struct DiskInfo: Sendable, Identifiable, Codable {
    public var id: String
    public var bsdName: String
    public var model: String
    public var serialNumber: String
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var isInternal: Bool
    public var isSolidState: Bool
    public var smartStatus: String
    public var trueHealthScore: Int
    public var verdict: HealthVerdict
    public var busProtocol: String
    public var trimSupported: Bool
    public var dataProvenance: String
    public var firmwareAnomalyDetected: Bool
    public var firmwareNotes: String
    public var temperatureC: Int?
    public var powerOnHours: Int?
    public var volumes: [VolumeInfo]
    public var smartAttributes: [SmartAttribute]
    
    public var usedBytes: Int64 {
        max(0, totalBytes - freeBytes)
    }
    
    public var usagePercentage: Double {
        guard totalBytes > 0 else { return 0.0 }
        return Double(usedBytes) / Double(totalBytes) * 100.0
    }
    
    public init(
        id: String,
        bsdName: String,
        model: String,
        serialNumber: String,
        totalBytes: Int64,
        freeBytes: Int64,
        isInternal: Bool,
        isSolidState: Bool,
        smartStatus: String,
        trueHealthScore: Int,
        verdict: HealthVerdict,
        busProtocol: String,
        trimSupported: Bool,
        dataProvenance: String,
        firmwareAnomalyDetected: Bool,
        firmwareNotes: String,
        temperatureC: Int? = nil,
        powerOnHours: Int? = nil,
        volumes: [VolumeInfo] = [],
        smartAttributes: [SmartAttribute] = []
    ) {
        self.id = id
        self.bsdName = bsdName
        self.model = model
        self.serialNumber = serialNumber
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.isInternal = isInternal
        self.isSolidState = isSolidState
        self.smartStatus = smartStatus
        self.trueHealthScore = trueHealthScore
        self.verdict = verdict
        self.busProtocol = busProtocol
        self.trimSupported = trimSupported
        self.dataProvenance = dataProvenance
        self.firmwareAnomalyDetected = firmwareAnomalyDetected
        self.firmwareNotes = firmwareNotes
        self.temperatureC = temperatureC
        self.powerOnHours = powerOnHours
        self.volumes = volumes
        self.smartAttributes = smartAttributes
    }
}
