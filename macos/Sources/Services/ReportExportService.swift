import Foundation
import AppKit

public struct ReportExportService: Sendable {
    public static func exportHTML(
        disk: DiskInfo,
        blocks: [SurfaceBlock],
        metrics: SurfaceScanMetrics,
        snapshots: [HistorySnapshot]
    ) -> String {
        let dateFormatter = ISO8601DateFormatter()
        let nowString = dateFormatter.string(from: Date())
        
        let smartRows = disk.smartAttributes.map { attr in
            """
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #27272a; font-family: monospace;">\(attr.id)</td>
                <td style="padding: 8px; border-bottom: 1px solid #27272a; font-weight: 500;">\(attr.name)</td>
                <td style="padding: 8px; border-bottom: 1px solid #27272a; text-align: center; font-family: monospace;">\(attr.current)</td>
                <td style="padding: 8px; border-bottom: 1px solid #27272a; text-align: center; font-family: monospace;">\(attr.worst)</td>
                <td style="padding: 8px; border-bottom: 1px solid #27272a; text-align: center; font-family: monospace;">\(attr.threshold)</td>
                <td style="padding: 8px; border-bottom: 1px solid #27272a; font-family: monospace;">\(attr.rawValue)</td>
                <td style="padding: 8px; border-bottom: 1px solid #27272a; color: \(attr.status == "OK" ? "#10b981" : "#f59e0b");">\(attr.status)</td>
            </tr>
            """
        }.joined(separator: "\n")
        
        let surfaceCells = blocks.prefix(200).map { block in
            let color: String
            switch block.status {
            case .healthy: color = "#10b981"
            case .warning: color = "#f59e0b"
            case .slow: color = "#f97316"
            case .bad: color = "#ef4444"
            case .scanning: color = "#3b82f6"
            case .unscanned: color = "#3f3f46"
            }
            return "<div style=\"width: 14px; height: 14px; background: \(color); border-radius: 2px;\" title=\"Block #\(block.id): \(String(format: "%.1f", block.latencyMs))ms\"></div>"
        }.joined(separator: "\n")
        
        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>DiagnoseMyDisk Forensic Report - \(disk.model)</title>
            <style>
                body {
                    background-color: #09090b;
                    color: #fafafa;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    margin: 0;
                    padding: 40px;
                }
                .container { max-width: 1000px; margin: 0 auto; }
                .header { border-bottom: 1px solid #27272a; padding-bottom: 20px; margin-bottom: 30px; }
                .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #27272a; }
                .card { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
                table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
                th { padding: 10px 8px; border-bottom: 2px solid #27272a; color: #a1a1aa; font-weight: 500; }
                .grid { display: grid; grid-template-columns: repeat(40, 1fr); gap: 4px; padding: 16px; background: #09090b; border-radius: 6px; border: 1px solid #27272a; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <span class="badge">OFFLINE FORENSIC STORAGE AUDIT</span>
                    <h1 style="margin: 12px 0 4px 0;">DiagnoseMyDisk Diagnostic Report</h1>
                    <p style="color: #a1a1aa; margin: 0;">Generated on \(nowString) · macOS Native Edition</p>
                </div>
                
                <div class="card">
                    <h2 style="margin-top: 0;">Storage Hardware Telemetry</h2>
                    <p><strong>Device Model:</strong> \(disk.model) (BSD: \(disk.bsdName))</p>
                    <p><strong>Serial Number:</strong> \(disk.serialNumber)</p>
                    <p><strong>True Health Score:</strong> <span style="font-size: 20px; font-weight: bold; color: \(disk.trueHealthScore > 80 ? "#10b981" : "#f59e0b");">\(disk.trueHealthScore)% (\(disk.verdict.rawValue))</span></p>
                    <p><strong>Data Provenance:</strong> \(disk.dataProvenance)</p>
                    <p><strong>Firmware Assessment:</strong> \(disk.firmwareNotes)</p>
                </div>
                
                <div class="card">
                    <h2 style="margin-top: 0;">200-Block Surface LBA Latency Map</h2>
                    <p style="color: #a1a1aa; font-size: 13px;">Scanned: \(metrics.scannedBlocks)/\(metrics.totalBlocks) · Healthy: \(metrics.healthyCount) · Warning: \(metrics.warningCount) · Slow: \(metrics.slowCount) · Errors: \(metrics.badCount)</p>
                    <div class="grid">
                        \(surfaceCells)
                    </div>
                </div>
                
                <div class="card">
                    <h2 style="margin-top: 0;">S.M.A.R.T. Forensic Register Telemetry</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Attribute Name</th>
                                <th style="text-align: center;">Current</th>
                                <th style="text-align: center;">Worst</th>
                                <th style="text-align: center;">Thresh</th>
                                <th>Raw Register</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            \(smartRows)
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
        </html>
        """
    }
}
