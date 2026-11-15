import SwiftUI

public struct HealthGaugeView: View {
    public let score: Int
    public let verdict: HealthVerdict
    public let size: CGFloat
    
    public init(score: Int, verdict: HealthVerdict, size: CGFloat = 110) {
        self.score = score
        self.verdict = verdict
        self.size = size
    }
    
    private var statusColor: Color {
        switch verdict {
        case .optimal: return .green
        case .good: return .green
        case .caution: return .yellow
        case .warning: return .orange
        case .critical: return .red
        case .unknown: return .secondary
        }
    }
    
    public var body: some View {
        ZStack {
            // Background track
            Circle()
                .stroke(Color(nsColor: .separatorColor), lineWidth: 10)
                .frame(width: size, height: size)
            
            // Progress ring
            Circle()
                .trim(from: 0.0, to: CGFloat(min(100, max(0, score))) / 100.0)
                .stroke(
                    statusColor,
                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .frame(width: size, height: size)
            
            // Label
            VStack(spacing: 2) {
                Text("\(score)%")
                    .font(.system(size: size * 0.26, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.primary)
                
                Text(verdict.rawValue.uppercased())
                    .font(.system(size: size * 0.1, weight: .semibold))
                    .foregroundStyle(statusColor)
            }
        }
        .frame(width: size, height: size)
    }
}
