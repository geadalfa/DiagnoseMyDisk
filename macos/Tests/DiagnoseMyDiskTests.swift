import XCTest
@testable import DiagnoseMyDisk

final class DiagnoseMyDiskTests: XCTestCase {
    
    // MARK: - 1. Telemetry & Health Engine Tests
    
    func testTrueHealthEvaluationOptimal() async {
        let (score, verdict, anomaly, notes) = await DiskTelemetryService.shared.evaluateTrueHealth(
            smartStatus: "Verified",
            isSSD: true,
            totalBytes: 500_000_000_000,
            freeBytes: 250_000_000_000
        )
        
        XCTAssertEqual(score, 100)
        XCTAssertEqual(verdict, .optimal)
        XCTAssertFalse(anomaly)
        XCTAssertTrue(notes.contains("healthy"))
    }
    
    func testTrueHealthEvaluationNearCapacityPenalty() async {
        // Disk at 96% capacity (<4% free)
        let (score, _, anomaly, notes) = await DiskTelemetryService.shared.evaluateTrueHealth(
            smartStatus: "Verified",
            isSSD: true,
            totalBytes: 500_000_000_000,
            freeBytes: 15_000_000_000
        )
        
        XCTAssertLessThan(score, 85)
        XCTAssertTrue(anomaly)
        XCTAssertTrue(notes.contains("95% capacity"))
    }
    
    func testTrueHealthEvaluationFailingSmart() async {
        let (score, verdict, anomaly, notes) = await DiskTelemetryService.shared.evaluateTrueHealth(
            smartStatus: "Failing",
            isSSD: true,
            totalBytes: 500_000_000_000,
            freeBytes: 200_000_000_000
        )
        
        XCTAssertEqual(score, 30)
        XCTAssertEqual(verdict, .critical)
        XCTAssertTrue(anomaly)
        XCTAssertTrue(notes.contains("CRITICAL"))
    }
    
    func testSmartAttributesGeneration() async {
        let attrs = await DiskTelemetryService.shared.generateSmartAttributes(score: 95, smartStatus: "Verified")
        XCTAssertEqual(attrs.count, 15)
        let firstAttr = attrs.first
        XCTAssertEqual(firstAttr?.name, "Critical Warning")
        XCTAssertEqual(firstAttr?.status, "OK")
    }
    
    func testVolumeUsageCalculation() {
        let vol = VolumeInfo(
            name: "Macintosh HD",
            bsdName: "disk0s2",
            mountPoint: "/",
            fileSystem: "APFS",
            totalBytes: 200_000_000_000,
            freeBytes: 50_000_000_000,
            isWritable: true
        )
        XCTAssertEqual(vol.usedBytes, 150_000_000_000)
        XCTAssertEqual(vol.usagePercentage, 75.0, accuracy: 0.01)
    }
    
    // MARK: - 2. Surface Scanner Tests
    
    func testSurfaceBlockLatencyClassification() {
        let b1 = SurfaceBlock(id: 0, latencyMs: 5.2, status: .healthy)
        let b2 = SurfaceBlock(id: 1, latencyMs: 45.0, status: .warning)
        let b3 = SurfaceBlock(id: 2, latencyMs: 120.0, status: .slow)
        let b4 = SurfaceBlock(id: 3, latencyMs: 0.0, status: .bad)
        
        XCTAssertEqual(b1.status.label, "< 20ms")
        XCTAssertEqual(b2.status.label, "20-100ms")
        XCTAssertEqual(b3.status.label, "> 100ms")
        XCTAssertEqual(b4.status.label, "Bad / Error")
    }
    
    func testSurfaceScanExecution() async {
        final class TestBox: @unchecked Sendable {
            var count = 0
        }
        let box = TestBox()
        let expectation = expectation(description: "Scan finished")
        
        await SurfaceScanService.shared.scan(targetPath: "/", totalBlocks: 10) { block, metrics in
            if metrics.scannedBlocks == 10 && !metrics.isScanning {
                box.count = metrics.scannedBlocks
                expectation.fulfill()
            }
        }
        
        await fulfillment(of: [expectation], timeout: 5.0)
        XCTAssertEqual(box.count, 10)
    }
    
    // MARK: - 3. Storage Cleaner & Security Guard Tests
    
    func testProtectedPathSecurityGuards() {
        let service = StorageCleaningService.shared
        
        // Critical system paths MUST return false (unsafe for deletion)
        XCTAssertFalse(service.isPathSafeForDeletion("/System"))
        XCTAssertFalse(service.isPathSafeForDeletion("/System/Library/CoreServices"))
        XCTAssertFalse(service.isPathSafeForDeletion("/usr/bin/python3"))
        XCTAssertFalse(service.isPathSafeForDeletion("/bin/sh"))
        XCTAssertFalse(service.isPathSafeForDeletion("/sbin/fsck"))
        XCTAssertFalse(service.isPathSafeForDeletion("/Applications/Safari.app"))
        XCTAssertFalse(service.isPathSafeForDeletion("/"))
        XCTAssertFalse(service.isPathSafeForDeletion(NSHomeDirectory()))
        
        // User temporary and cache paths should be safe
        let safeCachePath = (NSHomeDirectory() as NSString).appendingPathComponent("Library/Caches/TestAppCache")
        XCTAssertTrue(service.isPathSafeForDeletion(safeCachePath))
    }
    
    func testStorageCategoryByteAccounting() {
        let item1 = StorageItem(path: "/tmp/a.cache", name: "a.cache", byteSize: 10_000_000, isSelected: true)
        let item2 = StorageItem(path: "/tmp/b.cache", name: "b.cache", byteSize: 20_000_000, isSelected: false)
        let category = StorageCategoryItem(type: .developerCaches, items: [item1, item2], isSelected: true)
        
        XCTAssertEqual(category.totalBytes, 30_000_000)
        XCTAssertEqual(category.selectedBytes, 10_000_000)
    }
    
    // MARK: - 4. History & Trend Tests
    
    func testHistorySnapshotRecordingAndTrend() async {
        let history = HistoryService.shared
        await history.clearHistory(for: "test-disk-1")
        
        // Snapshot 1: 95%
        await history.recordSnapshot(
            diskId: "test-disk-1",
            diskName: "Test SSD",
            healthScore: 95,
            temperatureC: 38,
            statusLabel: "Optimal",
            dataProvenance: "TEST"
        )
        
        var trend = await history.getTrend(for: "test-disk-1")
        XCTAssertEqual(trend.currentScore, 95)
        XCTAssertTrue(trend.trendLabel.contains("Initial"))
        
        // Snapshot 2: 90% (Degrading by 5%)
        await history.recordSnapshot(
            diskId: "test-disk-1",
            diskName: "Test SSD",
            healthScore: 90,
            temperatureC: 40,
            statusLabel: "Good",
            dataProvenance: "TEST"
        )
        
        trend = await history.getTrend(for: "test-disk-1")
        XCTAssertEqual(trend.currentScore, 90)
        XCTAssertEqual(trend.delta, -5)
        XCTAssertTrue(trend.trendLabel.contains("Degrading"))
        
        // Clear history
        await history.clearHistory(for: "test-disk-1")
        let snapshots = await history.getSnapshots(for: "test-disk-1")
        XCTAssertTrue(snapshots.isEmpty)
    }
    
    // MARK: - 5. Report Export Tests
    
    func testReportHTMLExportContainsEssentialForensicTokens() {
        let disk = DiskInfo(
            id: "APPLE-SSD-TEST",
            bsdName: "disk0",
            model: "APPLE SSD AP0256Q",
            serialNumber: "TEST-SERIAL-1234",
            totalBytes: 250_000_000_000,
            freeBytes: 100_000_000_000,
            isInternal: true,
            isSolidState: true,
            smartStatus: "Verified",
            trueHealthScore: 98,
            verdict: .optimal,
            busProtocol: "Apple Fabric",
            trimSupported: true,
            dataProvenance: "LIVE TEST",
            firmwareAnomalyDetected: false,
            firmwareNotes: "Optimal performance",
            smartAttributes: [
                SmartAttribute(id: 1, name: "Critical Warning", current: 100, worst: 100, threshold: 0, rawValue: "0x00", status: "OK")
            ]
        )
        
        let blocks = (0..<200).map { SurfaceBlock(id: $0, status: .healthy) }
        let metrics = SurfaceScanMetrics(totalBlocks: 200, scannedBlocks: 200, healthyCount: 200)
        
        let html = ReportExportService.exportHTML(
            disk: disk,
            blocks: blocks,
            metrics: metrics,
            snapshots: []
        )
        
        XCTAssertTrue(html.contains("APPLE SSD AP0256Q"))
        XCTAssertTrue(html.contains("TEST-SERIAL-1234"))
        XCTAssertTrue(html.contains("98%"))
        XCTAssertTrue(html.contains("Critical Warning"))
        XCTAssertTrue(html.contains("200-Block Surface LBA Latency Map"))
    }
}
