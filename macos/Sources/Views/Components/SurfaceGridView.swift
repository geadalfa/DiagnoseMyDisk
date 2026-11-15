import SwiftUI

public struct SurfaceGridView: View {
    public let blocks: [SurfaceBlock]
    public let onSelectBlock: (SurfaceBlock) -> Void
    
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 40)
    
    public init(blocks: [SurfaceBlock], onSelectBlock: @escaping (SurfaceBlock) -> Void = { _ in }) {
        self.blocks = blocks
        self.onSelectBlock = onSelectBlock
    }
    
    private func color(for status: SurfaceBlockStatus) -> Color {
        switch status {
        case .healthy: return .green
        case .warning: return .yellow
        case .slow: return .orange
        case .bad: return .red
        case .scanning: return .blue
        case .unscanned: return Color(nsColor: .separatorColor)
        }
    }
    
    public var body: some View {
        LazyVGrid(columns: columns, spacing: 4) {
            ForEach(blocks.prefix(200)) { block in
                Button {
                    onSelectBlock(block)
                } label: {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(color(for: block.status))
                        .frame(height: 12)
                }
                .buttonStyle(.plain)
                .help("Block #\(block.id): \(block.status.label) (\(String(format: "%.1f", block.latencyMs)) ms)")
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
