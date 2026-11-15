"""
test_updater.py
Unit tests and integration tests for DiagnoseMyDisk updater engine and API routes.
"""

import os
import sys
import json
import unittest
from unittest.mock import patch, MagicMock
from io import BytesIO

# Pastikan backend dan root server masuk ke sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from updater import parse_version, compare_versions, is_newer_version, UpdateManager
import server


class TestVersionParsing(unittest.TestCase):
    def test_parse_version(self):
        self.assertEqual(parse_version("v3.2.0"), (3, 2, 0))
        self.assertEqual(parse_version("3.2.1"), (3, 2, 1))
        self.assertEqual(parse_version("v1.0.0-rc1"), (1, 0, 0))
        self.assertEqual(parse_version(""), (0, 0, 0))
        self.assertEqual(parse_version(None), (0, 0, 0))

    def test_compare_versions(self):
        self.assertEqual(compare_versions("3.2.1", "3.2.0"), 1)
        self.assertEqual(compare_versions("v3.2.0", "3.2.0"), 0)
        self.assertEqual(compare_versions("3.1.9", "3.2.0"), -1)
        self.assertEqual(compare_versions("4.0.0", "3.99.99"), 1)

    def test_is_newer_version(self):
        self.assertTrue(is_newer_version("3.2.1", "3.2.0"))
        self.assertTrue(is_newer_version("v4.0.0", "v3.2.0"))
        self.assertFalse(is_newer_version("3.2.0", "3.2.0"))
        self.assertFalse(is_newer_version("3.1.0", "3.2.0"))


class TestUpdateManager(unittest.TestCase):
    def setUp(self):
        self.mgr = UpdateManager(app_name="DiagnoseMyDisk", current_version="3.2.0")

    def test_initial_status(self):
        status = self.mgr.get_status()
        self.assertEqual(status["status"], "idle")
        self.assertEqual(status["current_version"], "3.2.0")
        self.assertFalse(status["update_available"])

    @patch("urllib.request.urlopen")
    def test_check_for_updates_available(self, mock_urlopen):
        fake_release = {
            "tag_name": "v3.3.0",
            "name": "DiagnoseMyDisk v3.3.0",
            "body": "Fitur baru pembaruan otomatis",
            "html_url": "https://github.com/geadalfa/DiagnoseMyDisk/releases/tag/v3.3.0",
            "published_at": "2026-11-13T12:00:00Z",
            "assets": [
                {
                    "name": "DiagnoseMyDisk_Setup.exe",
                    "browser_download_url": "https://github.com/geadalfa/DiagnoseMyDisk/releases/download/v3.3.0/DiagnoseMyDisk_Setup.exe",
                    "size": 8900000
                },
                {
                    "name": "DiagnoseMyDisk-v3.3.0-portable.zip",
                    "browser_download_url": "https://github.com/geadalfa/DiagnoseMyDisk/releases/download/v3.3.0/DiagnoseMyDisk-v3.3.0-portable.zip",
                    "size": 9200000
                }
            ]
        }
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps(fake_release).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        res = self.mgr.check_for_updates(force=True)
        self.assertEqual(res["status"], "available")
        self.assertTrue(res["update_available"])
        self.assertEqual(res["latest_version"], "3.3.0")
        self.assertEqual(res["release_info"]["download_url"], "https://github.com/geadalfa/DiagnoseMyDisk/releases/download/v3.3.0/DiagnoseMyDisk_Setup.exe")

    @patch("urllib.request.urlopen")
    def test_check_for_updates_up_to_date(self, mock_urlopen):
        fake_release = {
            "tag_name": "v3.2.0",
            "name": "DiagnoseMyDisk v3.2.0",
            "assets": []
        }
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps(fake_release).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        res = self.mgr.check_for_updates(force=True)
        self.assertEqual(res["status"], "up_to_date")
        self.assertFalse(res["update_available"])

    def test_preferences_auto_update_default(self):
        prefs = server.get_user_preferences()
        self.assertIn("auto_update", prefs)
        self.assertTrue(prefs["auto_update"])

    def test_download_rejects_non_https(self):
        self.mgr.latest_release_info = {
            "download_url": "http://insecure.example.com/setup.exe",
            "setup_filename": "setup.exe",
            "download_size": 1000,
        }
        res = self.mgr.start_download()
        self.assertEqual(res["status"], "error")
        self.assertIn("HTTPS", res["error"])

    def test_apply_update_refuses_unverified_installer(self):
        self.mgr.installer_path = "non_existent.exe"
        self.mgr.hash_verified = False
        res = self.mgr.apply_update()
        self.assertFalse(res["success"])
        self.assertIn("error", res)

    @patch("urllib.request.urlopen")
    def test_download_verifies_valid_sha256(self, mock_urlopen):
        import hashlib
        fake_binary = b"MZ-test-installer-binary-payload"
        valid_sha256 = hashlib.sha256(fake_binary).hexdigest()

        self.mgr.latest_release_info = {
            "download_url": "https://github.com/geadalfa/DiagnoseMyDisk/releases/download/v3.4.0/DiagnoseMyDisk_Setup.exe",
            "checksum_url": "https://github.com/geadalfa/DiagnoseMyDisk/releases/download/v3.4.0/SHA256SUMS.txt",
            "setup_filename": "DiagnoseMyDisk_Setup.exe",
            "download_size": len(fake_binary),
        }

        # Mock first call (checksum) and second call (binary download)
        mock_chk_resp = MagicMock()
        mock_chk_resp.read.return_value = f"{valid_sha256}  DiagnoseMyDisk_Setup.exe\n".encode("utf-8")
        mock_chk_resp.__enter__.return_value = mock_chk_resp

        mock_bin_resp = MagicMock()
        mock_bin_resp.headers = {"Content-Length": str(len(fake_binary))}
        mock_bin_resp.read.side_effect = [fake_binary, b""]
        mock_bin_resp.__enter__.return_value = mock_bin_resp

        mock_urlopen.side_effect = [mock_chk_resp, mock_bin_resp]

        self.mgr.start_download()
        if self.mgr._download_thread:
            self.mgr._download_thread.join(timeout=3.0)

        self.assertEqual(self.mgr.status, "ready_to_install")
        self.assertTrue(self.mgr.hash_verified)
        self.assertEqual(self.mgr.downloaded_hash, valid_sha256)
        if self.mgr.installer_path and os.path.exists(self.mgr.installer_path):
            try:
                os.remove(self.mgr.installer_path)
            except Exception:
                pass

    @patch("urllib.request.urlopen")
    def test_download_fails_on_sha256_mismatch(self, mock_urlopen):
        fake_binary = b"MZ-corrupted-binary-payload"
        mismatch_sha256 = "0000000000000000000000000000000000000000000000000000000000000000"

        self.mgr.latest_release_info = {
            "download_url": "https://github.com/geadalfa/DiagnoseMyDisk/releases/download/v3.4.0/DiagnoseMyDisk_Setup.exe",
            "checksum_url": "https://github.com/geadalfa/DiagnoseMyDisk/releases/download/v3.4.0/SHA256SUMS.txt",
            "setup_filename": "DiagnoseMyDisk_Setup.exe",
            "download_size": len(fake_binary),
        }

        mock_chk_resp = MagicMock()
        mock_chk_resp.read.return_value = f"{mismatch_sha256}  DiagnoseMyDisk_Setup.exe\n".encode("utf-8")
        mock_chk_resp.__enter__.return_value = mock_chk_resp

        mock_bin_resp = MagicMock()
        mock_bin_resp.headers = {"Content-Length": str(len(fake_binary))}
        mock_bin_resp.read.side_effect = [fake_binary, b""]
        mock_bin_resp.__enter__.return_value = mock_bin_resp

        mock_urlopen.side_effect = [mock_chk_resp, mock_bin_resp]

        self.mgr.start_download()
        if self.mgr._download_thread:
            self.mgr._download_thread.join(timeout=3.0)

        self.assertEqual(self.mgr.status, "error")
        self.assertFalse(self.mgr.hash_verified)
        self.assertIn("Integritas installer gagal", self.mgr.error_message)


if __name__ == "__main__":
    unittest.main()
