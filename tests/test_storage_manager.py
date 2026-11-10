# -*- coding: utf-8 -*-
"""
Unit tests for the DiagnoseMyDisk v3 storage engine.
Focus: deterministic scanning, measured summaries, and cleanup allowlists.
"""

import os
import sys
import time
import shutil
import tempfile
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.storage_manager import (
    format_bytes,
    is_reparse_point,
    get_available_drives,
    StorageManager,
    execute_cleanup,
)


class TestStorageManagerHelpers(unittest.TestCase):
    def test_format_bytes(self):
        self.assertEqual(format_bytes(0), "0 B")
        self.assertEqual(format_bytes(512), "512 B")
        self.assertTrue(format_bytes(1024).startswith("1.0"))
        self.assertTrue(format_bytes(1024 * 1024).startswith("1.0"))
        self.assertTrue(format_bytes(1024 * 1024 * 1024).startswith("1.0"))
        self.assertTrue(format_bytes(5 * 1024 * 1024 * 1024).startswith("5.0"))
        self.assertTrue(format_bytes(1024 * 1024 * 1024 * 1024).startswith("1.0"))

    def test_get_available_drives(self):
        drives = get_available_drives()
        self.assertIsInstance(drives, list)
        self.assertGreater(len(drives), 0)
        for drive in drives:
            for key in ("drive", "mount", "total", "used", "free", "percent"):
                self.assertIn(key, drive)
            self.assertGreaterEqual(drive["total"], 0)
            self.assertGreaterEqual(drive["free"], 0)

    def test_is_reparse_point_normal_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            self.assertFalse(is_reparse_point(tmp_dir))
            test_file = os.path.join(tmp_dir, "test.txt")
            with open(test_file, "w", encoding="utf-8") as f:
                f.write("hello")
            self.assertFalse(is_reparse_point(test_file))


class TestStorageManagerEngine(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="diagnose_test_")
        self.sub_a = os.path.join(self.test_dir, "FolderA")
        self.sub_b = os.path.join(self.test_dir, "FolderB")
        os.makedirs(self.sub_a, exist_ok=True)
        os.makedirs(self.sub_b, exist_ok=True)

        self.dup_content = b"IDENTICAL_CONTENT_FOR_DUPLICATE_TEST" * 500
        self.file_orig = os.path.join(self.sub_a, "document_orig.dat")
        self.file_copy = os.path.join(self.sub_b, "document_copy.dat")
        with open(self.file_orig, "wb") as f:
            f.write(self.dup_content)
        with open(self.file_copy, "wb") as f:
            f.write(self.dup_content)

        self.file_large = os.path.join(self.sub_a, "large_archive.bin")
        with open(self.file_large, "wb") as f:
            f.write(b"LARGE_ARCHIVE_MOCK_DATA" * 5000)

        self.file_old = os.path.join(self.sub_b, "old_backup.log")
        with open(self.file_old, "wb") as f:
            f.write(b"OLD_SYSTEM_LOG_ENTRY_DATA_FOR_AUDIT" * 100)
        old_time = time.time() - (120 * 86400)
        os.utime(self.file_old, (old_time, old_time))

        self.mgr = StorageManager()

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def _scan(self):
        self.mgr._run_scan_worker(
            [self.test_dir],
            scan_duplicates=True,
            min_large_mb=0,
            min_dup_bytes=1024,
            include_recommendations=False,
        )

    def test_initial_state(self):
        status = self.mgr.get_status()
        for key in ("is_scanning", "progress", "has_results", "files_scanned", "truncated"):
            self.assertIn(key, status)

    def test_scan_and_duplicate_detection(self):
        self._scan()
        status = self.mgr.get_status()
        self.assertFalse(status["is_scanning"])
        self.assertTrue(status["has_results"])
        self.assertGreaterEqual(status["files_scanned"], 4)

        results = self.mgr.get_results()
        self.assertEqual(results["status"], "ok")
        for key in ("duplicate_groups", "large_items", "old_items", "breakdown", "truncated"):
            self.assertIn(key, results)

        duplicate_groups = results["duplicate_groups"]
        self.assertGreaterEqual(len(duplicate_groups), 1)
        group = duplicate_groups[0]
        self.assertEqual(group["count"], 2)
        paths = [f["path"] for f in group["files"]]
        self.assertIn(self.file_orig, paths)
        self.assertIn(self.file_copy, paths)

        old_paths = [item["path"] for item in results["old_items"]]
        self.assertIn(self.file_old, old_paths)

    def test_summary_uses_measured_bytes(self):
        self._scan()
        breakdown = self.mgr.get_results()["breakdown"]
        for key in ("user_files", "app_files", "system_files", "recycle_bin", "other", "measured_bytes", "coverage_pct"):
            self.assertIn(key, breakdown)
        self.assertGreater(breakdown["measured_bytes"], 0)
        self.assertGreaterEqual(breakdown["coverage_pct"], 0)
        self.assertLessEqual(breakdown["coverage_pct"], 100)

    def test_start_scan_rejects_arbitrary_directory(self):
        ok, message = self.mgr.start_scan([self.test_dir])
        self.assertFalse(ok)
        self.assertIn("drive", message.lower())
        self.assertFalse(self.mgr.is_scanning)

    def test_cleanup_allowlist_rejects_unknown_paths(self):
        self._scan()
        outsider = os.path.join(self.test_dir, "FolderA", "not_in_results.bin")
        with open(outsider, "wb") as f:
            f.write(b"x" * 2048)

        result = self.mgr.clean_paths([outsider])
        self.assertTrue(result["success"])
        self.assertTrue(os.path.exists(outsider))
        self.assertEqual(len(result["rejected"]), 1)
        self.assertEqual(result["deleted_count"], 0)

    def test_cleanup_allowlist_accepts_duplicate_file(self):
        self._scan()
        self.assertTrue(os.path.exists(self.file_copy))
        result = self.mgr.clean_paths([self.file_copy])
        self.assertTrue(result["success"])
        self.assertFalse(os.path.exists(self.file_copy))
        self.assertTrue(os.path.exists(self.file_orig))
        self.assertEqual(len(result["rejected"]), 0)

    def test_cleanup_rejects_large_directory(self):
        self._scan()
        result = self.mgr.clean_paths([self.sub_a])
        self.assertTrue(os.path.exists(self.sub_a))
        self.assertEqual(len(result["rejected"]), 1)

    def test_execute_cleanup_protects_system_named_directories(self):
        protected = os.path.join(self.test_dir, "Windows")
        os.makedirs(protected, exist_ok=True)
        guarded = os.path.join(protected, "keep.txt")
        with open(guarded, "w", encoding="utf-8") as f:
            f.write("keep")

        res = execute_cleanup([protected])
        self.assertTrue(os.path.exists(guarded))
        self.assertGreaterEqual(len(res["errors"]), 1)

    def test_execute_cleanup_nonexistent_handled_safely(self):
        bogus_path = os.path.join(self.test_dir, "non_existent_file.xyz")
        res = execute_cleanup([bogus_path])
        self.assertTrue(res["success"])
        self.assertEqual(res["deleted_count"], 0)
        self.assertEqual(res["freed_formatted"], "0 B")

    def test_inspect_directory(self):
        res_top = self.mgr.inspect_directory(self.test_dir, limit=50, enforce_allowlist=False)
        self.assertTrue(res_top["success"])
        self.assertEqual(res_top["total_dirs"], 2)
        top_names = [item["name"] for item in res_top["items"]]
        self.assertIn("FolderA", top_names)
        self.assertIn("FolderB", top_names)

        res_sub = self.mgr.inspect_directory(self.sub_a, limit=50, enforce_allowlist=False)
        self.assertTrue(res_sub["success"])
        self.assertEqual(res_sub["total_files"], 2)
        sub_names = [item["name"] for item in res_sub["items"]]
        self.assertIn("document_orig.dat", sub_names)
        self.assertIn("large_archive.bin", sub_names)

        res_bad = self.mgr.inspect_directory(os.path.join(self.test_dir, "nonexistent"), enforce_allowlist=False)
        self.assertFalse(res_bad["success"])
        self.assertIn("error", res_bad)

    def test_inspect_directory_enforces_allowlist(self):
        result = self.mgr.inspect_directory(self.test_dir, enforce_allowlist=True)
        self.assertFalse(result["success"])
        self.assertIn("tidak termasuk", result["error"].lower())

    def test_inspect_directory_allowed_after_scan(self):
        self._scan()
        result = self.mgr.inspect_directory(self.test_dir, enforce_allowlist=True)
        self.assertTrue(result["success"])


if __name__ == "__main__":
    unittest.main()
