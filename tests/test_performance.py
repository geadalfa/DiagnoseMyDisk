# -*- coding: utf-8 -*-
"""Performance guardrails for the storage engine and local API."""

import os
import sys
import shutil
import tempfile
import time
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.storage_manager import StorageManager, get_available_drives


class TestStoragePerformance(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="diagnose_perf_")
        for folder_index in range(10):
            folder = os.path.join(self.test_dir, f"Folder{folder_index}")
            os.makedirs(folder, exist_ok=True)
            for file_index in range(60):
                path = os.path.join(folder, f"file_{folder_index}_{file_index}.bin")
                with open(path, "wb") as f:
                    f.write((f"{folder_index}-{file_index}-" * 64).encode("utf-8"))
        self.mgr = StorageManager()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_scan_600_files_completes_quickly(self):
        start = time.perf_counter()
        self.mgr._run_scan_worker(
            [self.test_dir],
            scan_duplicates=True,
            min_large_mb=0,
            min_dup_bytes=1024,
            include_recommendations=False,
        )
        elapsed = time.perf_counter() - start
        self.assertLess(elapsed, 8.0)
        self.assertGreaterEqual(self.mgr.get_status()["files_scanned"], 600)

    def test_recommendation_size_walk_respects_time_budget(self):
        start = time.perf_counter()
        size = self.mgr._calculate_path_size(self.test_dir, time_budget=0.0)
        elapsed = time.perf_counter() - start
        self.assertGreaterEqual(size, 0)
        self.assertLess(elapsed, 2.0)
        self.assertTrue(self.mgr.scan_truncated)

    def test_duplicate_analysis_stays_bounded(self):
        start = time.perf_counter()
        self.mgr._run_scan_worker(
            [self.test_dir],
            scan_duplicates=True,
            min_large_mb=0,
            min_dup_bytes=1024,
            include_recommendations=False,
        )
        elapsed = time.perf_counter() - start
        self.assertLess(elapsed, 8.0)
        groups = self.mgr.get_results()["duplicate_groups"]
        self.assertIsInstance(groups, list)

    def test_drive_enumeration_is_fast(self):
        start = time.perf_counter()
        drives = get_available_drives()
        elapsed = time.perf_counter() - start
        self.assertGreater(len(drives), 0)
        self.assertLess(elapsed, 2.0)


if __name__ == "__main__":
    unittest.main()
