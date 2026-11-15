import SwiftUI

public struct DisksView: View {
    public let disks: [DiskInfo]
    public let selectedDiskId: String
    public let isLoading: Bool
    public let errorMessage: String?
    public let onSelectDisk: (String) -> Void
    public let onRefresh: () -> Void
    
    public init(
        disks: [DiskInfo],
        selectedDiskId: String,
        isLoading: Bool,
        errorMessage: String?,
        onSelectDisk: @escaping (String) -> Void,
        onRefresh: @escaping () -> Void
    ) {
        self.disks = disks
        self.selectedDiskId = selectedDiskId
        self.isLoading = isLoading
        self.errorMessage = errorMessage
        self.onSelectDisk = onSelectDisk
        self.onRefresh = onRefresh
    }
    
    private var activeDisk: DiskInfo? {
        disks.first(where: { $0.id == selectedDiskId }) ?? disks.first
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .decimal
        formatter.allowedUnits = [.useAll]
        return formatter.string(fromByteCount: bytes)
    }
    
    public var body: some View {
        Group {
            if isLoading && disks.isEmpty {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Scanning storage hardware and S.M.A.R.T. registers...")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage, disks.isEmpty {
                ContentUnavailableView {
                    Label("Diagnostic Query Failed", systemImage: "exclamationmark.triangle.fill")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry Storage Scan", action: onRefresh)
                        .buttonStyle(.borderedProminent)
                }
            } else if let disk = activeDisk {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        // Drive Selector Bar (if multiple disks exist)
                        if disks.count > 1 {
                            HStack(spacing: 8) {
                                ForEach(disks) { d in
                                    Button {
                                        onSelectDisk(d.id)
                                    } label: {
                                        HStack(spacing: 6) {
                                            Image(systemName: d.isSolidState ? "internaldrive.fill" : "opticaldiscdrive.fill")
                                            Text(d.model)
                                                .fontWeight(d.id == disk.id ? .semibold : .regular)
                                        }
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(d.id == disk.id ? Color.accentColor.opacity(0.15) : Color(nsColor: .controlBackgroundColor))
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        
                        // Top Summary Hero Card
                        HStack(alignment: .top, spacing: 20) {
                            HealthGaugeView(score: disk.trueHealthScore, verdict: disk.verdict, size: 105)
                            
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(disk.model)
                                        .font(.title2)
                                        .fontWeight(.bold)
                                    Spacer()
                                    Text(disk.dataProvenance)
                                        .font(.caption2)
                                        .fontWeight(.medium)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color(nsColor: .separatorColor).opacity(0.5))
                                        .clipShape(RoundedRectangle(cornerRadius: 4))
                                }
                                
                                Text("BSD Identifier: \(disk.bsdName)  ·  Serial: \(disk.serialNumber)  ·  Protocol: \(disk.busProtocol)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                                
                                if disk.firmwareAnomalyDetected {
                                    HStack(spacing: 6) {
                                        Image(systemName: "exclamationmark.shield.fill")
                                            .foregroundStyle(.orange)
                                        Text(disk.firmwareNotes)
                                            .font(.caption)
                                            .foregroundStyle(.orange)
                                    }
                                    .padding(8)
                                    .background(Color.orange.opacity(0.1))
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                                } else {
                                    HStack(spacing: 6) {
                                        Image(systemName: "checkmark.shield.fill")
                                            .foregroundStyle(.green)
                                        Text(disk.firmwareNotes)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                
                                // Storage capacity bar
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text("Capacity: \(formatBytes(disk.usedBytes)) used of \(formatBytes(disk.totalBytes))")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .monospacedDigit()
                                        Spacer()
                                        Text(String(format: "%.1f%%", disk.usagePercentage))
                                            .font(.caption)
                                            .fontWeight(.semibold)
                                            .monospacedDigit()
                                    }
                                    ProgressView(value: Double(disk.usedBytes), total: Double(max(1, disk.totalBytes)))
                                        .tint(disk.usagePercentage > 90 ? .red : (disk.usagePercentage > 75 ? .orange : .blue))
                                }
                                .padding(.top, 4)
                            }
                        }
                        .padding(16)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                        )
                        
                        // Technical Specifications Row
                        HStack(spacing: 12) {
                            statBox(title: "SMART Status", value: disk.smartStatus, icon: "shield.lefthalf.filled")
                            statBox(title: "TRIM Support", value: disk.trimSupported ? "Active" : "Disabled", icon: "bolt.fill")
                            statBox(title: "Temperature", value: disk.temperatureC.map { "\($0) °C" } ?? "N/A", icon: "thermometer.medium")
                            statBox(title: "Power On Hours", value: disk.powerOnHours.map { "\($0) hrs" } ?? "N/A", icon: "clock.fill")
                        }
                        
                        // Volumes Section
                        if !disk.volumes.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("APFS Volumes & Partitions")
                                    .font(.headline)
                                
                                ForEach(disk.volumes) { vol in
                                    HStack(spacing: 12) {
                                        Image(systemName: "internaldrive")
                                            .foregroundStyle(.secondary)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(vol.name)
                                                .font(.subheadline)
                                                .fontWeight(.medium)
                                            Text("Mount: \(vol.mountPoint.isEmpty ? "Unmounted" : vol.mountPoint) (\(vol.fileSystem)) · Free: \(formatBytes(vol.freeBytes)) of \(formatBytes(vol.totalBytes))")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                                .monospacedDigit()
                                        }
                                        Spacer()
                                        Text(String(format: "%.1f%%", vol.usagePercentage))
                                            .font(.caption)
                                            .monospacedDigit()
                                            .foregroundStyle(.secondary)
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
                        
                        // Forensic S.M.A.R.T. Registers Table
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Forensic S.M.A.R.T. Registers")
                                    .font(.headline)
                                Spacer()
                                Text("\(disk.smartAttributes.count) registers monitored")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            
                            Table(disk.smartAttributes) {
                                TableColumn("ID") { attr in
                                    Text("\(attr.id)")
                                        .monospacedDigit()
                                        .frame(width: 32, alignment: .leading)
                                }
                                TableColumn("Attribute Name") { attr in
                                    Text(attr.name)
                                        .fontWeight(.medium)
                                }
                                TableColumn("Current") { attr in
                                    Text("\(attr.current)")
                                        .monospacedDigit()
                                }
                                TableColumn("Worst") { attr in
                                    Text("\(attr.worst)")
                                        .monospacedDigit()
                                }
                                TableColumn("Thresh") { attr in
                                    Text("\(attr.threshold)")
                                        .monospacedDigit()
                                }
                                TableColumn("Raw Telemetry") { attr in
                                    Text(attr.rawValue)
                                        .font(.system(.caption, design: .monospaced))
                                }
                                TableColumn("Status") { attr in
                                    Text(attr.status)
                                        .foregroundStyle(attr.status == "OK" ? .green : .orange)
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(minHeight: 280)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                            )
                        }
                    }
                    .padding(20)
                }
            } else {
                ContentUnavailableView(
                    "No Storage Drives Discovered",
                    systemImage: "internaldrive",
                    description: Text("Connect an internal or external drive and click Refresh.")
                )
            }
        }
    }
    
    private func statBox(title: String, value: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .monospacedDigit()
            }
            Spacer()
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
