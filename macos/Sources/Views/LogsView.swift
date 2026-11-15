import SwiftUI
import AppKit

public struct LogsView: View {
    public let logs: [String]
    public let onClearLogs: () -> Void
    
    @State private var filterQuery: String = ""
    
    public init(logs: [String], onClearLogs: @escaping () -> Void) {
        self.logs = logs
        self.onClearLogs = onClearLogs
    }
    
    private var filteredLogs: [String] {
        if filterQuery.isEmpty { return logs }
        return logs.filter { $0.localizedCaseInsensitiveContains(filterQuery) }
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Header Bar
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Live Diagnostic Activity Logs")
                        .font(.title2)
                        .fontWeight(.bold)
                    Text("Real-time telemetry queries, surface sector checks, and filesystem operations.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Copy All") {
                    let pasteboard = NSPasteboard.general
                    pasteboard.clearContents()
                    pasteboard.setString(logs.joined(separator: "\n"), forType: .string)
                }
                .buttonStyle(.bordered)
                
                Button("Clear", role: .destructive, action: onClearLogs)
                    .buttonStyle(.bordered)
            }
            .padding([.top, .horizontal], 20)
            
            // Search field
            TextField("Filter diagnostic logs...", text: $filterQuery)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 20)
            
            // Console Window
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 4) {
                        if filteredLogs.isEmpty {
                            Text("No log messages recorded.")
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(Array(filteredLogs.enumerated()), id: \.offset) { index, line in
                                Text(line)
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundStyle(line.contains("❌") ? .red : (line.contains("⚠️") ? .yellow : (line.contains("✅") ? .green : .primary)))
                                    .id(index)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                }
                .background(Color.black.opacity(0.85))
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                )
                .padding([.bottom, .horizontal], 20)
                .onChange(of: filteredLogs.count) { _, _ in
                    if let last = filteredLogs.indices.last {
                        proxy.scrollTo(last, anchor: .bottom)
                    }
                }
            }
        }
    }
}
