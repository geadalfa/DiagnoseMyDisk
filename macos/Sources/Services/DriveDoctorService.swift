import Foundation

public actor DriveDoctorService {
    public static let shared = DriveDoctorService()
    
    public init() {}
    
    public func verifyVolume(
        targetVolume: String,
        onLog: @Sendable @escaping (String) -> Void
    ) async -> DoctorTaskResult {
        onLog("[Drive Doctor] Initializing non-destructive filesystem verification for: \(targetVolume)...")
        
        // Execute diskutil verifyVolume via Process with argument array (No shell injection)
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/diskutil")
        process.arguments = ["verifyVolume", targetVolume]
        
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        
        var logs: [String] = []
        logs.append("[CMD] diskutil verifyVolume \(targetVolume)")
        
        do {
            try process.run()
            
            let handle = pipe.fileHandleForReading
            let data = handle.readDataToEndOfFile()
            process.waitUntilExit()
            
            if let output = String(data: data, encoding: .utf8) {
                let lines = output.components(separatedBy: .newlines).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                for line in lines {
                    logs.append(line)
                    onLog(line)
                }
            }
            
            let exitCode = process.terminationStatus
            let status: DoctorStatus
            if exitCode == 0 {
                status = .healthy
                let msg = "✅ Verification complete. The volume \(targetVolume) is clean and healthy."
                logs.append(msg)
                onLog(msg)
            } else {
                status = .warning
                let msg = "⚠️ Verification returned status code \(exitCode). Review volume report above."
                logs.append(msg)
                onLog(msg)
            }
            
            return DoctorTaskResult(
                title: "Volume Verification",
                targetVolume: targetVolume,
                status: status,
                executionTime: Date(),
                logs: logs
            )
        } catch {
            let errMsg = "❌ Process execution failed: \(error.localizedDescription)"
            logs.append(errMsg)
            onLog(errMsg)
            return DoctorTaskResult(
                title: "Volume Verification",
                targetVolume: targetVolume,
                status: .failed,
                executionTime: Date(),
                logs: logs
            )
        }
    }
    
    public func listSnapshots(
        targetVolume: String,
        onLog: @Sendable @escaping (String) -> Void
    ) async -> [APFSSnapshot] {
        onLog("[Drive Doctor] Querying local APFS snapshots on: \(targetVolume)...")
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/diskutil")
        process.arguments = ["apfs", "listSnapshots", targetVolume]
        
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        
        var snapshots: [APFSSnapshot] = []
        
        do {
            try process.run()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            
            if let output = String(data: data, encoding: .utf8) {
                let lines = output.components(separatedBy: .newlines)
                var currentName = ""
                var currentUUID = ""
                
                for line in lines {
                    let trimmed = line.trimmingCharacters(in: .whitespaces)
                    if trimmed.isEmpty { continue }
                    onLog(trimmed)
                    
                    if trimmed.contains("Snapshot Name:") {
                        currentName = trimmed.replacingOccurrences(of: "Snapshot Name:", with: "").trimmingCharacters(in: .whitespaces)
                    } else if trimmed.contains("Snapshot UUID:") {
                        currentUUID = trimmed.replacingOccurrences(of: "Snapshot UUID:", with: "").trimmingCharacters(in: .whitespaces)
                        if !currentName.isEmpty {
                            snapshots.append(APFSSnapshot(name: currentName, uuid: currentUUID, volume: targetVolume))
                            currentName = ""
                            currentUUID = ""
                        }
                    }
                }
            }
            
            onLog("[Drive Doctor] Total APFS snapshots discovered: \(snapshots.count)")
            return snapshots
        } catch {
            onLog("❌ Failed to query snapshots: \(error.localizedDescription)")
            return []
        }
    }
}
