# -*- coding: utf-8 -*-
"""
Integration QA tests for DiagnoseMyDisk HTTP Server Routes
Author: Gemi (Pair-programmed with Alfa)
"""

import os
import sys
import json
import unittest
from urllib.request import urlopen, Request
from http.server import HTTPServer
import threading
import time

# Add project root to sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from server import DiagnoseDiskHandler


class TestServerRoutesIntegration(unittest.TestCase):
    """Integration QA testing against real local server instance."""

    @classmethod
    def setUpClass(cls):
        """Start a test server on an ephemeral OS-assigned port."""
        cls.server = HTTPServer(("127.0.0.1", 0), DiagnoseDiskHandler)
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.3)
        cls.base_url = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        """Shutdown the test server."""
        try:
            cls.server.shutdown()
        except Exception:
            pass

    def _get_json(self, path):
        url = f"{self.base_url}{path}"
        with urlopen(url, timeout=3.0) as resp:
            self.assertEqual(resp.status, 200)
            return json.loads(resp.read().decode("utf-8"))

    def _post_json(self, path, data):
        url = f"{self.base_url}{path}"
        req = Request(url, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(req, timeout=3.0) as resp:
            self.assertEqual(resp.status, 200)
            return json.loads(resp.read().decode("utf-8"))

    def test_api_storage_drives(self):
        """Test GET /api/storage/drives."""
        data = self._get_json("/api/storage/drives")
        self.assertTrue(data.get("success"))
        self.assertIn("drives", data)
        self.assertGreater(len(data["drives"]), 0)

    def test_api_storage_scan_status(self):
        """Test GET /api/storage/scan_status."""
        data = self._get_json("/api/storage/scan_status")
        self.assertIn("is_scanning", data)
        self.assertIn("progress", data)

    def test_api_storage_results(self):
        """Test GET /api/storage/results."""
        data = self._get_json("/api/storage/results")
        self.assertTrue(data.get("success"))
        self.assertIn("recommendations", data)
        self.assertIn("large_items", data)
        self.assertIn("old_items", data)

    def test_api_storage_clean_empty(self):
        """Test POST /api/storage/clean with empty paths."""
        data = self._post_json("/api/storage/clean", {"paths": []})
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("deleted_count"), 0)

    def test_api_logs(self):
        """Test GET /api/logs."""
        data = self._get_json("/api/logs")
        self.assertTrue(data.get("success"))
        self.assertIn("logs", data)
        self.assertIn("log_file", data)
        self.assertIsInstance(data["logs"], list)

    def test_api_storage_inspect_folder(self):
        """Test GET & POST /api/storage/inspect_folder."""
        # GET test on static folder
        static_dir = os.path.join(PROJECT_ROOT, "static")
        import urllib.parse
        encoded_path = urllib.parse.quote(static_dir)
        data = self._get_json(f"/api/storage/inspect_folder?path={encoded_path}")
        self.assertTrue(data.get("success"))
        self.assertIn("items", data)
        self.assertGreater(len(data["items"]), 0)

        # POST test
        data_post = self._post_json("/api/storage/inspect_folder", {"path": static_dir})
        self.assertTrue(data_post.get("success"))
        self.assertEqual(data["path"], data_post["path"])

    def test_api_preferences(self):
        """Test GET & POST /api/preferences for persistent user settings."""
        # GET preferences
        get_res = self._get_json("/api/preferences")
        self.assertTrue(get_res.get("success"))
        self.assertIn("preferences", get_res)

        # POST preferences (change to id)
        post_id = self._post_json("/api/preferences", {"language": "id"})
        self.assertTrue(post_id.get("success"))
        self.assertEqual(post_id["preferences"]["language"], "id")

        # POST preferences (revert to en default)
        post_en = self._post_json("/api/preferences", {"language": "en"})
        self.assertTrue(post_en.get("success"))
        self.assertEqual(post_en["preferences"]["language"], "en")


if __name__ == "__main__":
    unittest.main()
