import Foundation

public enum StorageCategoryType: String, Sendable, Codable, CaseIterable, Identifiable {
    case developerCaches = "Developer Caches"
    case userCaches = "User Caches"
    case systemLogs = "System & App Logs"
    case trash = "Trash"
    case largeFiles = "Large Files (>100MB)"
    case duplicates = "Duplicate Files"
    
    public var id: String { rawValue }
    
    public var labelId: String {
        switch self {
        case .developerCaches: return "Cache Pengembang (Xcode/Brew/npm)"
        case .userCaches: return "Cache Pengguna"
        case .systemLogs: return "Log Sistem & Aplikasi"
        case .trash: return "Tempat Sampah"
        case .largeFiles: return "File Berukuran Besar (>100MB)"
        case .duplicates: return "File Duplikat (SHA-256)"
        }
    }
    
    public var iconName: String {
        switch self {
        case .developerCaches: return "hammer.fill"
        case .userCaches: return "archivebox.fill"
        case .systemLogs: return "doc.text.fill"
        case .trash: return "trash.fill"
        case .largeFiles: return "doc.badge.arrow.up.fill"
        case .duplicates: return "square.on.square.fill"
        }
    }
}

public struct StorageItem: Sendable, Identifiable, Equatable {
    public var id: String { path }
    public var path: String
    public var name: String
    public var byteSize: Int64
    public var modificationDate: Date
    public var isSelected: Bool
    
    public init(path: String, name: String, byteSize: Int64, modificationDate: Date = Date(), isSelected: Bool = true) {
        self.path = path
        self.name = name
        self.byteSize = byteSize
        self.modificationDate = modificationDate
        self.isSelected = isSelected
    }
}

public struct DuplicateGroup: Sendable, Identifiable, Equatable {
    public var id: String // SHA-256 hash or size anchor
    public var byteSize: Int64
    public var items: [StorageItem]
    
    public var reclaimableBytes: Int64 {
        guard items.count > 1 else { return 0 }
        let selectedCount = items.filter(\.isSelected).count
        // Keep at least one copy or calculate selected copies
        return byteSize * Int64(max(0, selectedCount))
    }
    
    public init(id: String, byteSize: Int64, items: [StorageItem]) {
        self.id = id
        self.byteSize = byteSize
        self.items = items
    }
}

public struct StorageCategoryItem: Sendable, Identifiable {
    public var id: StorageCategoryType { type }
    public var type: StorageCategoryType
    public var items: [StorageItem]
    public var isSelected: Bool
    
    public var totalBytes: Int64 {
        items.reduce(0) { $0 + $1.byteSize }
    }
    
    public var selectedBytes: Int64 {
        items.filter(\.isSelected).reduce(0) { $0 + $1.byteSize }
    }
    
    public init(type: StorageCategoryType, items: [StorageItem] = [], isSelected: Bool = true) {
        self.type = type
        self.items = items
        self.isSelected = isSelected
    }
}

public struct CleanupReclamationResult: Sendable, Identifiable {
    public var id: UUID
    public var initialFreeBytes: Int64
    public var finalFreeBytes: Int64
    public var reclaimedBytes: Int64
    public var cleanedPaths: [String]
    public var failedPaths: [String]
    public var completedAt: Date
    
    public init(
        id: UUID = UUID(),
        initialFreeBytes: Int64,
        finalFreeBytes: Int64,
        reclaimedBytes: Int64,
        cleanedPaths: [String],
        failedPaths: [String] = [],
        completedAt: Date = Date()
    ) {
        self.id = id
        self.initialFreeBytes = initialFreeBytes
        self.finalFreeBytes = finalFreeBytes
        self.reclaimedBytes = reclaimedBytes
        self.cleanedPaths = cleanedPaths
        self.failedPaths = failedPaths
        self.completedAt = completedAt
    }
}
