import Foundation

public struct HistorySnapshot: Sendable, Identifiable, Codable {
    public var id: UUID
    public var diskId: String
    public var diskName: String
    public var timestamp: Date
    public var healthScore: Int
    public var temperatureC: Int?
    public var statusLabel: String
    public var dataProvenance: String
    
    public init(
        id: UUID = UUID(),
        diskId: String,
        diskName: String,
        timestamp: Date = Date(),
        healthScore: Int,
        temperatureC: Int? = nil,
        statusLabel: String,
        dataProvenance: String
    ) {
        self.id = id
        self.diskId = diskId
        self.diskName = diskName
        self.timestamp = timestamp
        self.healthScore = healthScore
        self.temperatureC = temperatureC
        self.statusLabel = statusLabel
        self.dataProvenance = dataProvenance
    }
}

public struct DiskTrend: Sendable {
    public var diskId: String
    public var currentScore: Int
    public var previousScore: Int?
    public var delta: Int
    public var trendLabel: String
    
    public init(diskId: String, currentScore: Int, previousScore: Int? = nil, delta: Int = 0, trendLabel: String = "Stable") {
        self.diskId = diskId
        self.currentScore = currentScore
        self.previousScore = previousScore
        self.delta = delta
        self.trendLabel = trendLabel
    }
}
