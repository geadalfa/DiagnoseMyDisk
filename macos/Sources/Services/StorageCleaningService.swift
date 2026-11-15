import Foundation
import CryptoKit

public actor StorageCleaningService {
    public static let shared = StorageCleaningService()
    
    private let fileManager = FileManager.default
    
    public init() {}
    
    // Protected path prefixes that can NEVER be deleted under any circumstance
    private let protectedSystemPrefixes = [
        "/System",
        "/usr",
        "/bin",
        "/sbin",
        "/private/var/db",
        "/Library/Apple",
        "/Applications"
    ]
    
    public func scanStorageCategories(
        onProgress: @Sendable @escaping (String) -> Void
    ) async -> (categories: [StorageCategoryItem], duplicates: [DuplicateGroup]) {
        var categoryItems: [StorageCategoryItem] = []
        let home = fileManager.homeDirectoryForCurrentUser
        
        // 1. Developer Caches
        onProgress("Scanning developer caches (Xcode, Homebrew, CocoaPods, npm)...")
        let devPaths = [
            home.appendingPathComponent("Library/Developer/Xcode/DerivedData").path,
            home.appendingPathComponent("Library/Caches/CocoaPods").path,
            home.appendingPathComponent("Library/Caches/Homebrew").path,
            home.appendingPathComponent(".npm/_cacache").path,
            home.appendingPathComponent("Library/Caches/Yarn").path
        ]
        let devItems = inspectDirectories(at: devPaths)
        categoryItems.append(StorageCategoryItem(type: .developerCaches, items: devItems))
        
        // 2. User Caches
        onProgress("Scanning user application caches...")
        let userCacheDir = home.appendingPathComponent("Library/Caches")
        let userCacheItems = inspectTopLevelSubdirectories(in: userCacheDir, skipNames: ["CocoaPods", "Homebrew", "Yarn"])
        categoryItems.append(StorageCategoryItem(type: .userCaches, items: userCacheItems))
        
        // 3. System & App Logs
        onProgress("Scanning application log files...")
        let logsDir = home.appendingPathComponent("Library/Logs")
        let logItems = inspectTopLevelFiles(in: logsDir)
        categoryItems.append(StorageCategoryItem(type: .systemLogs, items: logItems))
        
        // 4. Trash
        onProgress("Scanning Trash...")
        let trashDir = home.appendingPathComponent(".Trash")
        let trashItems = inspectTopLevelFiles(in: trashDir)
        categoryItems.append(StorageCategoryItem(type: .trash, items: trashItems))
        
        // 5. Large Files (> 100 MB)
        onProgress("Scanning large files (>100MB)...")
        let largeItems = scanLargeFiles(home: home, minSizeBytes: 100 * 1024 * 1024)
        categoryItems.append(StorageCategoryItem(type: .largeFiles, items: largeItems, isSelected: false))
        
        // 6. Duplicate Files (SHA-256)
        onProgress("Analyzing candidate duplicate files via SHA-256...")
        let duplicates = findDuplicateFiles(home: home)
        
        onProgress("Storage scan complete.")
        return (categoryItems, duplicates)
    }
    
    public func executeCleanup(
        categories: [StorageCategoryItem],
        duplicates: [DuplicateGroup],
        onProgress: @Sendable @escaping (String) -> Void
    ) async -> CleanupReclamationResult {
        let home = fileManager.homeDirectoryForCurrentUser
        let initialFree = getAvailableDiskSpace(for: home)
        
        var cleanedPaths: [String] = []
        var failedPaths: [String] = []
        
        // 1. Gather all selected candidate paths
        var targetsToDelete: [String] = []
        for cat in categories {
            for item in cat.items where item.isSelected {
                targetsToDelete.append(item.path)
            }
        }
        for dup in duplicates {
            // Only delete selected items if there are more than 1 items in the group
            let selected = dup.items.filter(\.isSelected)
            for item in selected {
                targetsToDelete.append(item.path)
            }
        }
        
        onProgress("Starting safe reclamation for \(targetsToDelete.count) target items...")
        
        for path in targetsToDelete {
            guard isPathSafeForDeletion(path) else {
                failedPaths.append(path)
                onProgress("⚠️ Skipped protected path: \(path)")
                continue
            }
            
            do {
                if fileManager.fileExists(atPath: path) {
                    try fileManager.removeItem(atPath: path)
                    cleanedPaths.append(path)
                    onProgress("Purged: \(path)")
                }
            } catch {
                failedPaths.append(path)
                onProgress("❌ Error deleting \(path): \(error.localizedDescription)")
            }
        }
        
        let finalFree = getAvailableDiskSpace(for: home)
        let reclaimed = max(0, finalFree - initialFree)
        
        return CleanupReclamationResult(
            initialFreeBytes: initialFree,
            finalFreeBytes: finalFree,
            reclaimedBytes: reclaimed,
            cleanedPaths: cleanedPaths,
            failedPaths: failedPaths
        )
    }
    
    public nonisolated func isPathSafeForDeletion(_ path: String) -> Bool {
        let standard = (path as NSString).standardizingPath
        for prefix in protectedSystemPrefixes {
            if standard == prefix || standard.hasPrefix(prefix + "/") {
                return false
            }
        }
        if standard == "/" || standard == NSHomeDirectory() {
            return false
        }
        return true
    }
    
    private func getAvailableDiskSpace(for url: URL) -> Int64 {
        if let values = try? url.resourceValues(forKeys: [.volumeAvailableCapacityKey]),
           let capacity = values.volumeAvailableCapacity {
            return Int64(capacity)
        }
        return 0
    }
    
    private func inspectDirectories(at paths: [String]) -> [StorageItem] {
        var items: [StorageItem] = []
        for path in paths {
            var isDir: ObjCBool = false
            if fileManager.fileExists(atPath: path, isDirectory: &isDir), isDir.boolValue {
                let size = calculateDirectorySize(at: URL(fileURLWithPath: path))
                if size > 0 {
                    let name = (path as NSString).lastPathComponent
                    items.append(StorageItem(path: path, name: name, byteSize: size))
                }
            }
        }
        return items
    }
    
    private func inspectTopLevelSubdirectories(in dir: URL, skipNames: [String]) -> [StorageItem] {
        guard let contents = try? fileManager.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.isDirectoryKey]) else {
            return []
        }
        var items: [StorageItem] = []
        for url in contents {
            if skipNames.contains(url.lastPathComponent) { continue }
            if let values = try? url.resourceValues(forKeys: [.isDirectoryKey]), values.isDirectory == true {
                let size = calculateDirectorySize(at: url)
                if size > 10 * 1024 * 1024 { // Report items > 10MB
                    items.append(StorageItem(path: url.path, name: url.lastPathComponent, byteSize: size))
                }
            }
        }
        return items.sorted(by: { $0.byteSize > $1.byteSize })
    }
    
    private func inspectTopLevelFiles(in dir: URL) -> [StorageItem] {
        guard let contents = try? fileManager.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey]) else {
            return []
        }
        var items: [StorageItem] = []
        for url in contents {
            let size = calculateDirectorySize(at: url)
            if size > 0 {
                let modDate = (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? Date()
                items.append(StorageItem(path: url.path, name: url.lastPathComponent, byteSize: size, modificationDate: modDate))
            }
        }
        return items.sorted(by: { $0.byteSize > $1.byteSize })
    }
    
    private func scanLargeFiles(home: URL, minSizeBytes: Int64) -> [StorageItem] {
        var items: [StorageItem] = []
        let candidateDirs = [
            home.appendingPathComponent("Downloads"),
            home.appendingPathComponent("Documents"),
            home.appendingPathComponent("Movies")
        ]
        
        for dir in candidateDirs {
            guard let enumerator = fileManager.enumerator(
                at: dir,
                includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey, .contentModificationDateKey],
                options: [.skipsHiddenFiles, .skipsPackageDescendants]
            ) else { continue }
            
            for case let fileURL as URL in enumerator {
                if let values = try? fileURL.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .contentModificationDateKey]),
                   values.isRegularFile == true,
                   let size = values.fileSize, Int64(size) >= minSizeBytes {
                    let modDate = values.contentModificationDate ?? Date()
                    items.append(StorageItem(
                        path: fileURL.path,
                        name: fileURL.lastPathComponent,
                        byteSize: Int64(size),
                        modificationDate: modDate,
                        isSelected: false // default unselected for user safety
                    ))
                }
            }
        }
        return items.sorted(by: { $0.byteSize > $1.byteSize })
    }
    
    private func findDuplicateFiles(home: URL) -> [DuplicateGroup] {
        var sizeMap: [Int64: [URL]] = [:]
        let scanDir = home.appendingPathComponent("Downloads")
        
        guard let enumerator = fileManager.enumerator(
            at: scanDir,
            includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey],
            options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else { return [] }
        
        for case let fileURL as URL in enumerator {
            if let values = try? fileURL.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey]),
               values.isRegularFile == true,
               let size = values.fileSize, size > 1024 * 1024 { // > 1MB
                sizeMap[Int64(size), default: []].append(fileURL)
            }
        }
        
        var duplicateGroups: [DuplicateGroup] = []
        
        for (size, urls) in sizeMap where urls.count > 1 {
            var hashMap: [String: [URL]] = [:]
            for url in urls {
                if let hash = computeSHA256(for: url) {
                    hashMap[hash, default: []].append(url)
                }
            }
            
            for (hash, matchingURLs) in hashMap where matchingURLs.count > 1 {
                var storageItems: [StorageItem] = []
                for (index, url) in matchingURLs.enumerated() {
                    // Keep first copy unselected by default, select subsequent copies for safe deletion
                    let isSelected = index > 0
                    storageItems.append(StorageItem(
                        path: url.path,
                        name: url.lastPathComponent,
                        byteSize: size,
                        isSelected: isSelected
                    ))
                }
                duplicateGroups.append(DuplicateGroup(id: hash, byteSize: size, items: storageItems))
            }
        }
        
        return duplicateGroups
    }
    
    private func computeSHA256(for url: URL) -> String? {
        do {
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            // Read first 1MB for fast hash anchor
            guard let data = try handle.read(upToCount: 1024 * 1024) else { return nil }
            let digest = SHA256.hash(data: data)
            return digest.map { String(format: "%02hhx", $0) }.joined()
        } catch {
            return nil
        }
    }
    
    private func calculateDirectorySize(at url: URL) -> Int64 {
        var total: Int64 = 0
        var isDir: ObjCBool = false
        if fileManager.fileExists(atPath: url.path, isDirectory: &isDir), !isDir.boolValue {
            return (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize.map { Int64($0) }) ?? 0
        }
        guard let enumerator = fileManager.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey], options: [.skipsPackageDescendants]) else {
            return 0
        }
        for case let fileURL as URL in enumerator {
            if let values = try? fileURL.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey]),
               values.isRegularFile == true,
               let size = values.fileSize {
                total += Int64(size)
            }
        }
        return total
    }
}
