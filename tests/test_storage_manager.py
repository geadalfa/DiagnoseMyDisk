# -*- coding: utf-8 -*-
"""
Unit tests for DiagnoseMyDisk v2.0.0 Storage Management Engine
Author: Gemi (Pair-programmed with Alfa)
Standard: Zero-Hallucination & Deterministic QA Testing
"""

import os
import sys
import time
import shutil
import tempfile
import unittest

# Add project root to sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.storage_manager import (
    format_bytes,
    is_reparse_point,
    get_available_drives,
    StorageManager,
    execute_cleanup
)


class TestStorageManagerHelpers(unittest.TestCase):
    """Test standalone helper functions in storage_manager."""

    def test_format_bytes(self):
        """Test human-readable byte formatting across multiple unit boundaries."""
        self.assertEqual(format_bytes(0), "0 B")
        self.assertEqual(format_bytes(512), "512 B")
        self.assertTrue(format_bytes(1024).startswith("1.0"))
        self.assertTrue(format_bytes(1024 * 1024).startswith("1.0"))
        self.assertTrue(format_bytes(1024 * 1024 * 1024).startswith("1.0"))
        self.assertTrue(format_bytes(5 * 1024 * 1024 * 1024).startswith("5.0"))
        self.assertTrue(format_bytes(1024 * 1024 * 1024 * 1024).startswith("1.0"))

    def test_get_available_drives(self):
        """Test that get_available_drives returns properly structured drive objects."""
        drives = get_available_drives()
        self.assertIsInstance(drives, list)
        self.assertGreater(len(drives), 0, "At least one drive (e.g. C:) must be returned")

        for d in drives:
            self.assertIn("drive", d)
            self.assertIn("mount", d)
            self.assertIn("total", d)
            self.assertIn("used", d)
            self.assertIn("free", d)
            self.assertIn("percent", d)
            self.assertGreaterEqual(d["total"], 0)
            self.assertGreaterEqual(d["free"], 0)

    def test_is_reparse_point_normal_file(self):
        """Ensure standard files and directories are not flagged as reparse points."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            self.assertFalse(is_reparse_point(tmp_dir))
            test_file = os.path.join(tmp_dir, "test.txt")
            with open(test_file, "w") as f:
                f.write("hello")
            self.assertFalse(is_reparse_point(test_file))


class TestStorageManagerEngine(unittest.TestCase):
    """Test StorageManager scanning, duplicate detection, and cleanup execution."""

    def setUp(self):
        """Create a temporary sandbox directory with known files and duplicates."""
        self.test_dir = tempfile.mkdtemp(prefix="diagnose_test_")

        # Create subdirectories
        self.sub_a = os.path.join(self.test_dir, "FolderA")
        self.sub_b = os.path.join(self.test_dir, "FolderB")
        os.makedirs(self.sub_a, exist_ok=True)
        os.makedirs(self.sub_b, exist_ok=True)

        # Create two identical files (Duplicates)
        self.dup_content = b"IDENTICAL_CONTENT_FOR_DUPLICATE_TEST" * 500  # ~18.5 KB
        self.file_orig = os.path.join(self.sub_a, "document_orig.dat")
        self.file_copy = os.path.join(self.sub_b, "document_copy.dat")
        with open(self.file_orig, "wb") as f:
            f.write(self.dup_content)
        with open(self.file_copy, "wb") as f:
            f.write(self.dup_content)

        # Create a unique large file
        self.file_large = os.path.join(self.sub_a, "large_archive.bin")
        with open(self.file_large, "wb") as f:
            f.write(b"LARGE_ARCHIVE_MOCK_DATA" * 5000)  # ~115 KB

        # Create an old file (> 100 days old, > 1 KB)
        self.file_old = os.path.join(self.sub_b, "old_backup.log")
        with open(self.file_old, "wb") as f:
            f.write(b"OLD_SYSTEM_LOG_ENTRY_DATA_FOR_AUDIT" * 100)  # ~3.5 KB
        old_time = time.time() - (120 * 86400)  # 120 days ago
        os.utime(self.file_old, (old_time, old_time))

        self.mgr = StorageManager()

    def tearDown(self):
        """Clean up test sandbox."""
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_initial_state(self):
        """Test initial status of StorageManager singleton."""
        status = self.mgr.get_status()
        self.assertIn("is_scanning", status)
        self.assertIn("progress", status)
        self.assertIn("has_results", status)
        self.assertIn("files_scanned", status)

    def test_scan_and_duplicate_detection(self):
        """Test that scanning finds the files and identifies duplicates."""
        # Run scan worker on test sandbox with min_large_mb=0 to catch test files
        drives_to_scan = [self.test_dir]
        self.mgr._run_scan_worker(drives_to_scan, scan_duplicates=True, min_large_mb=0)

        status = self.mgr.get_status()
        self.assertFalse(status["is_scanning"])
        self.assertTrue(status["has_results"])
        self.assertGreaterEqual(status["files_scanned"], 4)

        results = self.mgr.get_results()
        self.assertEqual(results["status"], "ok")
        self.assertIn("duplicate_groups", results)
        self.assertIn("large_items", results)
        self.assertIn("old_items", results)

        # Verify duplicate detection
        dup_groups = results["duplicate_groups"]
        self.assertGreaterEqual(len(dup_groups), 1, "Duplicate group must be identified")
        group = dup_groups[0]
        self.assertEqual(group["count"], 2)
        paths = [f["path"] for f in group["files"]]
        self.assertIn(self.file_orig, paths)
        self.assertIn(self.file_copy, paths)

        # Verify old items detection
        old_items = results["old_items"]
        old_paths = [item["path"] for item in old_items]
        self.assertIn(self.file_old, old_paths)

    def test_execute_cleanup(self):
        """Test safe cleanup execution on selected paths."""
        self.assertTrue(os.path.exists(self.file_copy))
        res = execute_cleanup([self.file_copy])

        self.assertTrue(res["success"])
        self.assertEqual(res["deleted_count"], 1)
        self.assertFalse(os.path.exists(self.file_copy), "Target file must be deleted")
        self.assertTrue(os.path.exists(self.file_orig), "Original file must remain intact")

    def test_execute_cleanup_nonexistent_handled_safely(self):
        """Ensure cleanup of missing files does not crash."""
        bogus_path = os.path.join(self.test_dir, "non_existent_file.xyz")
        res = execute_cleanup([bogus_path])
        self.assertTrue(res["success"])
        self.assertEqual(res["deleted_count"], 0)


if __name__ == "__main__":
    unittest.main()
