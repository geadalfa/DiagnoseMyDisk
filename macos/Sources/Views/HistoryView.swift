import SwiftUI

public struct HistoryView: View {
    public let snapshots: [HistorySnapshot]
    public let trend: DiskTrend
    public let onClearHistory: () -> Void
    
    public init(snapshots: [HistorySnapshot], trend: DiskTrend, onClearHistory: @escaping () -> Void) {
        self.snapshots = snapshots
        self.trend = trend
        self.onClearHistory = onClearHistory
    }
    
    private let dateFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateStyle = .medium
        df.timeStyle = .short
        return df
    }()
    
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Local Health History & Forensic Trends")
                            .font(.title2)
                            .fontWeight(.bold)
                        Text("Durable offline storage degradation tracking (retains up to 30 snapshots per disk).")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if !snapshots.isEmpty {
                        Button("Clear History", role: .destructive, action: onClearHistory)
                            .buttonStyle(.bordered)
                    }
                }
                
                // Trend Summary Card
                HStack(spacing: 16) {
                    Image(systemName: trend.delta < 0 ? "arrow.down.right.circle.fill" : "arrow.right.circle.fill")
                        .foregroundStyle(trend.delta < 0 ? .orange : .green)
                        .font(.title)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Health Degradation Trajectory: \(trend.trendLabel)")
                            .font(.headline)
                            .fontWeight(.bold)
                        Text("Current Score: \(trend.currentScore)%  ·  Previous Score: \(trend.previousScore.map { "\($0)%" } ?? "N/A")  ·  Delta: \(trend.delta)%")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    Spacer()
                }
                .padding(14)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                )
                
                // Snapshot Timeline
                if snapshots.isEmpty {
                    ContentUnavailableView(
                        "No Snapshots Recorded",
                        systemImage: "clock.arrow.circlepath",
                        description: Text("Snapshots are automatically recorded during disk inspection.")
                    )
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Historical Snapshots")
                            .font(.headline)
                        
                        Table(snapshots) {
                            TableColumn("Timestamp") { snap in
                                Text(dateFormatter.string(from: snap.timestamp))
                                    .font(.caption)
                                    .monospacedDigit()
                            }
                            TableColumn("Disk Target") { snap in
                                Text(snap.diskName)
                                    .fontWeight(.medium)
                            }
                            TableColumn("Health Score") { snap in
                                Text("\(snap.healthScore)%")
                                    .foregroundStyle(snap.healthScore > 80 ? .green : .orange)
                                    .fontWeight(.bold)
                                    .monospacedDigit()
                            }
                            TableColumn("Temp") { snap in
                                Text(snap.temperatureC.map { "\($0) °C" } ?? "N/A")
                                    .monospacedDigit()
                            }
                            TableColumn("Verdict") { snap in
                                Text(snap.statusLabel)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            TableColumn("Data Provenance") { snap in
                                Text(snap.dataProvenance)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
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
            }
            .padding(20)
        }
    }
}
