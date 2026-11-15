import Foundation

public enum DoctorStatus: String, Sendable, Codable {
    case ready = "Ready"
    case running = "Running"
    case healthy = "Passed"
    case warning = "Warning"
    case failed = "Failed"
}

public struct APFSSnapshot: Sendable, Identifiable, Codable {
    public var id: String { uuid.isEmpty ? name : uuid }
    public var name: String
    public var uuid: String
    public var volume: String
    
    public init(name: String, uuid: String, volume: String) {
        self.name = name
        self.uuid = uuid
        self.volume = volume
    }
}

public struct DoctorTaskResult: Sendable, Identifiable {
    public var id: UUID
    public var title: String
    public var targetVolume: String
    public var status: DoctorStatus
    public var executionTime: Date
    public var logs: [String]
    
    public init(id: UUID = UUID(), title: String, targetVolume: String, status: DoctorStatus, executionTime: Date = Date(), logs: [String] = []) {
        self.id = id
        self.title = title
        self.targetVolume = targetVolume
        self.status = status
        self.executionTime = executionTime
        self.logs = logs
    }
}
