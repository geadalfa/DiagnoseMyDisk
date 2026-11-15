import SwiftUI

public struct SurfaceScannerView: View {
    public let blocks: [SurfaceBlock]
    public let metrics: SurfaceScanMetrics
    public let selectedBlock: SurfaceBlock?
    public let onSelectBlock: (SurfaceBlock) -> Void
    public let onStartScan: () -> Void
    public let onCancelScan: () -> Void
    
    public init(
        blocks: [SurfaceBlock],
        metrics: SurfaceScanMetrics,
        selectedBlock: SurfaceBlock?,
        onSelectBlock: @escaping (SurfaceBlock) -> Void,
        onStartScan: @escaping () -> Void,
        onCancelScan: @escaping () -> Void
    ) {
        self.blocks = blocks
        self.metrics = metrics
        self.selectedBlock = selectedBlock
        self.onSelectBlock = onSelectBlock
        self.onStartScan = onStartScan
        self.onCancelScan = onCancelScan
    }
    
    private func formatTime(_ seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%02d:%02d", mins, secs)
    }
    
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header with Controls
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("200-Block Surface LBA Scanner")
                            .font(.title2)
                            .fontWeight(.bold)
                        Text("Sequential latency probe across storage blocks to detect weak, slow, or damaged sectors.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if metrics.isScanning {
                        Button("Cancel Scan", role: .destructive, action: onCancelScan)
                            .buttonStyle(.bordered)
                    } else {
                        Button(action: onStartScan) {
                            Label("Start Surface Scan", systemImage: "play.fill")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                
                // Progress Bar
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Progress: \(metrics.scannedBlocks) of \(metrics.totalBlocks) blocks (\(Int(metrics.progress * 100))%)")
                            .font(.caption)
                            .fontWeight(.medium)
                            .monospacedDigit()
                        Spacer()
                        if metrics.isScanning {
                            Text("Speed: \(String(format: "%.1f", metrics.currentSpeedMBs)) MB/s  ·  ETA: \(formatTime(metrics.etaSeconds))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        } else if metrics.scannedBlocks == metrics.totalBlocks && metrics.totalBlocks > 0 {
                            Text("Scan Completed")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(.green)
                        }
                    }
                    ProgressView(value: metrics.progress)
                        .tint(.accentColor)
                }
                .padding(12)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                )
                
                // 200-Block Surface Heatmap Grid
                SurfaceGridView(blocks: blocks, onSelectBlock: onSelectBlock)
                
                // Legend and Metrics Cards
                HStack(spacing: 12) {
                    legendBox(title: "< 20ms Normal", count: metrics.healthyCount, color: .green)
                    legendBox(title: "20-100ms Warning", count: metrics.warningCount, color: .yellow)
                    legendBox(title: "> 100ms Slow", count: metrics.slowCount, color: .orange)
                    legendBox(title: "Bad / Error", count: metrics.badCount, color: .red)
                }
                
                // Diagnostics Summary Metrics
                HStack(spacing: 12) {
                    metricCard(title: "Average Latency", value: String(format: "%.2f ms", metrics.averageLatencyMs))
                    metricCard(title: "Elapsed Time", value: formatTime(metrics.elapsedTimeSec))
                    metricCard(title: "Target Volume", value: metrics.currentTarget.isEmpty ? "Macintosh HD" : metrics.currentTarget)
                    metricCard(title: "Block Condition", value: metrics.badCount > 0 ? "Degraded" : (metrics.slowCount > 5 ? "Caution" : "Healthy"))
                }
                
                // Selected Block Inspector
                if let block = selectedBlock {
                    HStack(spacing: 16) {
                        Image(systemName: "info.circle.fill")
                            .foregroundStyle(.blue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Selected Block #\(block.id)")
                                .font(.subheadline)
                                .fontWeight(.bold)
                            Text("Status: \(block.status.label)  ·  Response Latency: \(String(format: "%.2f", block.latencyMs)) ms")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        Spacer()
                    }
                    .padding(12)
                    .background(Color.blue.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }
            .padding(20)
        }
    }
    
    private func legendBox(title: String, count: Int, color: Color) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 10, height: 10)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text("\(count)")
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .monospacedDigit()
            }
            Spacer()
        }
        .padding(8)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
        )
    }
    
    private func metricCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
        )
    }
}
