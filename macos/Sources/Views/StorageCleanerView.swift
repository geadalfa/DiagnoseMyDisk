import SwiftUI

public struct StorageCleanerView: View {
    public let categories: [StorageCategoryItem]
    public let duplicates: [DuplicateGroup]
    public let isScanning: Bool
    public let isCleaning: Bool
    public let scanStatus: String
    public let lastReclamation: CleanupReclamationResult?
    public let onScan: () -> Void
    public let onToggleCategory: (StorageCategoryType) -> Void
    public let onToggleItem: (String) -> Void
    public let onToggleDuplicate: (String) -> Void
    public let onClean: () -> Void
    
    public init(
        categories: [StorageCategoryItem],
        duplicates: [DuplicateGroup],
        isScanning: Bool,
        isCleaning: Bool,
        scanStatus: String,
        lastReclamation: CleanupReclamationResult?,
        onScan: @escaping () -> Void,
        onToggleCategory: @escaping (StorageCategoryType) -> Void,
        onToggleItem: @escaping (String) -> Void,
        onToggleDuplicate: @escaping (String) -> Void,
        onClean: @escaping () -> Void
    ) {
        self.categories = categories
        self.duplicates = duplicates
        self.isScanning = isScanning
        self.isCleaning = isCleaning
        self.scanStatus = scanStatus
        self.lastReclamation = lastReclamation
        self.onScan = onScan
        self.onToggleCategory = onToggleCategory
        self.onToggleItem = onToggleItem
        self.onToggleDuplicate = onToggleDuplicate
        self.onClean = onClean
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .decimal
        formatter.allowedUnits = [.useAll]
        return formatter.string(fromByteCount: bytes)
    }
    
    private var totalReclaimableBytes: Int64 {
        let catBytes = categories.reduce(0) { $0 + $1.selectedBytes }
        let dupBytes = duplicates.reduce(0) { $0 + $1.reclaimableBytes }
        return catBytes + dupBytes
    }
    
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header with Controls
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("PC Manager Style Storage Reclamation")
                            .font(.title2)
                            .fontWeight(.bold)
                        Text("Safe, evidence-measured disk cleanup for developer caches, logs, duplicates, and trash.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if isScanning {
                        ProgressView()
                            .controlSize(.small)
                        Text(scanStatus)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if isCleaning {
                        ProgressView()
                            .controlSize(.small)
                        Text("Reclaiming storage...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Button("Scan Storage", action: onScan)
                            .buttonStyle(.bordered)
                        
                        Button(action: onClean) {
                            Label("Reclaim \(formatBytes(totalReclaimableBytes))", systemImage: "sparkles")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(totalReclaimableBytes == 0)
                    }
                }
                
                // Last Reclamation Summary Card (if any)
                if let res = lastReclamation {
                    HStack(spacing: 16) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                            .font(.title)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Storage Successfully Reclaimed: \(formatBytes(res.reclaimedBytes))")
                                .font(.headline)
                                .fontWeight(.bold)
                            Text("Initial Free: \(formatBytes(res.initialFreeBytes))  ·  Current Free: \(formatBytes(res.finalFreeBytes))  ·  Purged \(res.cleanedPaths.count) items")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        Spacer()
                    }
                    .padding(14)
                    .background(Color.green.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.green.opacity(0.3), lineWidth: 1)
                    )
                }
                
                // Categories List
                if categories.isEmpty {
                    ContentUnavailableView(
                        "No Storage Analysis Performed",
                        systemImage: "internaldrive",
                        description: Text("Click 'Scan Storage' to calculate reclaimable space across caches, logs, and duplicates.")
                    )
                } else {
                    VStack(spacing: 12) {
                        ForEach(categories) { cat in
                            categoryCard(cat)
                        }
                    }
                    
                    // Duplicate Files Section
                    if !duplicates.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Label("SHA-256 Duplicate File Groups", systemImage: "square.on.square.fill")
                                    .font(.headline)
                                Spacer()
                                Text("\(duplicates.count) groups identified")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            
                            ForEach(duplicates) { dup in
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        Text("Hash: \(dup.id.prefix(12))...  ·  File Size: \(formatBytes(dup.byteSize))")
                                            .font(.caption)
                                            .fontWeight(.semibold)
                                            .monospacedDigit()
                                        Spacer()
                                        Text("\(dup.items.count) copies")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    
                                    ForEach(dup.items) { item in
                                        HStack {
                                            Toggle("", isOn: Binding(
                                                get: { item.isSelected },
                                                set: { _ in onToggleDuplicate(item.path) }
                                            ))
                                            .labelsHidden()
                                            
                                            Text(item.path)
                                                .font(.caption)
                                                .lineLimit(1)
                                                .truncationMode(.middle)
                                            Spacer()
                                        }
                                        .padding(.leading, 8)
                                    }
                                }
                                .padding(10)
                                .background(Color(nsColor: .controlBackgroundColor))
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                                    )
                            }
                        }
                    }
                }
            }
            .padding(20)
        }
    }
    
    private func categoryCard(_ cat: StorageCategoryItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Toggle("", isOn: Binding(
                    get: { cat.isSelected },
                    set: { _ in onToggleCategory(cat.type) }
                ))
                .labelsHidden()
                
                Image(systemName: cat.type.iconName)
                    .foregroundStyle(.secondary)
                    .frame(width: 20)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(cat.type.rawValue)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Text("\(cat.items.count) items")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                Text(formatBytes(cat.totalBytes))
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .monospacedDigit()
            }
            
            // Sub-items list (truncated to top 5)
            if cat.isSelected && !cat.items.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(cat.items.prefix(6)) { item in
                        HStack {
                            Toggle("", isOn: Binding(
                                get: { item.isSelected },
                                set: { _ in onToggleItem(item.path) }
                            ))
                            .labelsHidden()
                            
                            Text(item.name)
                                .font(.caption)
                                .lineLimit(1)
                            Spacer()
                            Text(formatBytes(item.byteSize))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        .padding(.leading, 28)
                    }
                }
            }
        }
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
        )
    }
}
