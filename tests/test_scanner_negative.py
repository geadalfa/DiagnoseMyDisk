# -*- coding: utf-8 -*-
"""
test_scanner_negative.py
Unit tests for scanner negative flows: fsutil non-zero failures and repair timeout honesty.
"""

import os
import sys
import subprocess
import unittest
from unittest.mock import patch, MagicMock

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.scanner import check_dirty_bit, repair_filesystem


class TestScannerNegativeCases(unittest.TestCase):
    @patch("subprocess.run")
    def test_check_dirty_bit_nonzero_exit_code_fails_honestly(self, mock_run):
        mock_proc = MagicMock()
        mock_proc.returncode = 1
        mock_proc.stdout = "Error: Access is denied."
        mock_proc.stderr = "Access is denied."
        mock_run.return_value = mock_proc

        res = check_dirty_bit("C")
        self.assertFalse(res["success"])
        self.assertIn("error", res)
        self.assertIn("Access is denied", res["error"])

    @patch("subprocess.run")
    def test_repair_filesystem_timeout_reports_failure(self, mock_run):
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="Repair-Volume", timeout=60)

        res = repair_filesystem("C")
        self.assertFalse(res["success"])
        self.assertIn("error", res)
        self.assertIn("timeout", res["error"].lower())

    @patch("subprocess.run")
    def test_repair_filesystem_nonzero_exit_code_reports_failure(self, mock_run):
        mock_proc = MagicMock()
        mock_proc.returncode = 2
        mock_proc.stdout = "Repair-Volume : The volume cannot be checked online."
        mock_proc.stderr = ""
        mock_run.return_value = mock_proc

        res = repair_filesystem("C")
        self.assertFalse(res["success"])
        self.assertIn("error", res)
        self.assertIn("Repair-Volume gagal", res["error"])


if __name__ == "__main__":
    unittest.main()
