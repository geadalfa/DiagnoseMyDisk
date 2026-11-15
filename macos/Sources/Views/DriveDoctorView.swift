import SwiftUI

public struct DriveDoctorView: View {
    public let volumes: [VolumeInfo]
    public let selectedVolume: String
    public let isRunning: Bool
    public let terminalLogs: [String]
    public let snapshots: [APFSSnapshot]
    public let onSelectVolume: (String) -> Void
    public let onVerifyVolume: () -> Void
    public let onListSnapshots: () -> Void
    
    public init(
        volumes: [VolumeInfo],
        selectedVolume: String,
        isRunning: Bool,
        terminalLogs: [String],
        snapshots: [APFSSnapshot],
        onSelectVolume: @escaping (String) -> Void,
        onVerifyVolume: @escaping () -> Void,
        onListSnapshots: @escaping () -> Void
    ) {
        self.volumes = volumes
        self.selectedVolume = selectedVolume
        self.isRunning = isRunning
        self.terminalLogs = terminalLogs
        self.snapshots = snapshots
        self.onSelectVolume = onSelectVolume
        self.onVerifyVolume = onVerifyVolume
        self.onListSnapshots = onListSnapshots
    }
    
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header
                VStack(alignment: .leading, spacing: 4) {
                    Text("Drive Doctor: Filesystem & APFS Maintenance")
                        .font(.title2)
                        .fontWeight(.bold)
                    Text("Guarded, non-destructive filesystem consistency verification and local APFS snapshot inspection.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                // Volume Selection & Action Bar
                HStack(spacing: 12) {
                    Picker("Target Volume", selection: Binding(
                        get: { selectedVolume },
                        set: { onSelectVolume($0) }
                    )) {
                        if volumes.isEmpty {
                            Text("Macintosh HD (/)").tag("/")
                        } else {
                            ForEach(volumes) { vol in
                                Text("\(vol.name) (\(vol.mountPoint.isEmpty ? vol.bsdName : vol.mountPoint))")
                                    .tag(vol.mountPoint.isEmpty ? vol.bsdName : vol.mountPoint)
                            }
                        }
                    }
                    .frame(width: 300)
                    
                    Button(action: onVerifyVolume) {
                        Label("Verify Filesystem", systemImage: "checkmark.shield.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isRunning)
                    
                    Button(action: onListSnapshots) {
                        Label("Inspect APFS Snapshots", systemImage: "camera.fill")
                    }
                    .buttonStyle(.bordered)
                    .disabled(isRunning)
                    
                    Spacer()
                    
                    if isRunning {
                        ProgressView()
                            .controlSize(.small)
                        Text("Executing...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(14)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                )
                
                // APFS Snapshots Card (if any found)
                if !snapshots.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Discovered APFS Local Snapshots")
                                .font(.headline)
                            Spacer()
                            Text("\(snapshots.count) snapshot(s) found")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        
                        ForEach(snapshots) { snap in
                            HStack {
                                Image(systemName: "camera.badge.clock.fill")
                                    .foregroundStyle(.blue)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(snap.name)
                                        .font(.subheadline)
                                        .fontWeight(.medium)
                                    Text("UUID: \(snap.uuid)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .monospacedDigit()
                                }
                                Spacer()
                            }
                            .padding(10)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                    }
                }
                
                // Live Terminal Output Console
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Label("Diagnostic Terminal Output", systemImage: "terminal.fill")
                            .font(.headline)
                        Spacer()
                        Text("\(terminalLogs.count) log lines")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(alignment: .leading, spacing: 4) {
                                if terminalLogs.isEmpty {
                                    Text("No tasks executed yet. Select a volume and click 'Verify Filesystem'.")
                                        .font(.system(.caption, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                } else {
                                    ForEach(Array(terminalLogs.enumerated()), id: \.offset) { index, line in
                                        Text(line)
                                            .font(.system(.caption, design: .monospaced))
                                            .foregroundStyle(line.contains("✅") ? .green : (line.contains("❌") ? .red : (line.contains("⚠️") ? .yellow : .primary)))
                                            .id(index)
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                        }
                        .frame(height: 280)
                        .background(Color.black.opacity(0.85))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                        )
                        .onChange(of: terminalLogs.count) { _, _ in
                            if let last = terminalLogs.indices.last {
                                proxy.scrollTo(last, anchor: .bottom)
                            }
                        }
                    }
                }
            }
            .padding(20)
        }
    }
}
