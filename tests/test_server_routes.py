# -*- coding: utf-8 -*-
"""
Integration and security tests for the DiagnoseMyDisk HTTP server.
Every API call must carry the per-launch token, local Host/Origin must be
enforced, and destructive endpoints must reject paths outside scan results.
"""

import os
import sys
import json
import tempfile
import shutil
import unittest
import threading
import time
import http.client
import urllib.parse
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from http.server import HTTPServer

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from server import DiagnoseDiskHandler, APP_TOKEN, storage_manager


class TestServerRoutesIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seed_dir = tempfile.mkdtemp(prefix="diagnose_http_seed_")
        cls.seed_file = os.path.join(cls.seed_dir, "seed.bin")
        with open(cls.seed_file, "wb") as f:
            f.write(b"seed-data" * 512)
        storage_manager.get_storage_manager()._run_scan_worker(
            [cls.seed_dir],
            scan_duplicates=False,
            min_large_mb=0,
            include_recommendations=False,
        )

        cls.server = HTTPServer(("127.0.0.1", 0), DiagnoseDiskHandler)
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.2)
        cls.base_url = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        try:
            cls.server.shutdown()
        except Exception:
            pass
        shutil.rmtree(cls.seed_dir, ignore_errors=True)

    def _request(self, path, method="GET", data=None, token=True, extra_headers=None):
        headers = {}
        if token:
            headers["X-App-Token"] = APP_TOKEN
        if extra_headers:
            headers.update(extra_headers)
        body = None
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = Request(self.base_url + path, data=body, headers=headers, method=method)
        return urlopen(req, timeout=5.0)

    def _get_json(self, path, **kwargs):
        with self._request(path, **kwargs) as resp:
            self.assertEqual(resp.status, 200)
            return json.loads(resp.read().decode("utf-8"))

    def _post_json(self, path, data, **kwargs):
        with self._request(path, method="POST", data=data, **kwargs) as resp:
            self.assertEqual(resp.status, 200)
            return json.loads(resp.read().decode("utf-8"))

    def _expect_http_error(self, path, status, **kwargs):
        with self.assertRaises(HTTPError) as ctx:
            self._request(path, **kwargs)
        self.assertEqual(ctx.exception.code, status)
        return ctx.exception.read().decode("utf-8")

    # ------------------------------------------------------------------
    # Functional routes
    # ------------------------------------------------------------------
    def test_index_injects_token_and_security_headers(self):
        with self._request("/", token=False) as resp:
            body = resp.read().decode("utf-8")
            self.assertEqual(resp.status, 200)
            self.assertEqual(resp.headers.get("X-App-Id"), "DiagnoseMyDisk")
            self.assertIn("Content-Security-Policy", resp.headers)
            self.assertIn(APP_TOKEN, body)
            self.assertNotIn("__APP_TOKEN__", body)

    def test_api_storage_drives(self):
        data = self._get_json("/api/storage/drives")
        self.assertTrue(data.get("success"))
        self.assertGreater(len(data["drives"]), 0)

    def test_api_storage_scan_status(self):
        data = self._get_json("/api/storage/scan_status")
        self.assertIn("is_scanning", data)
        self.assertIn("progress", data)
        self.assertIn("truncated", data)

    def test_api_storage_results(self):
        data = self._get_json("/api/storage/results")
        self.assertTrue(data.get("success"))
        self.assertIn("recommendations", data)
        self.assertIn("breakdown", data)

    def test_api_logs(self):
        data = self._get_json("/api/logs")
        self.assertTrue(data.get("success"))
        self.assertIsInstance(data["logs"], list)
        self.assertIn("log_file", data)

    def test_api_preferences(self):
        get_res = self._get_json("/api/preferences")
        self.assertTrue(get_res.get("success"))
        post_id = self._post_json("/api/preferences", {"language": "id"})
        self.assertEqual(post_id["preferences"]["language"], "id")
        post_en = self._post_json("/api/preferences", {"language": "en"})
        self.assertEqual(post_en["preferences"]["language"], "en")

    def test_api_storage_inspect_folder_only_after_scan(self):
        encoded = urllib.parse.quote(self.seed_dir)
        data = self._get_json(f"/api/storage/inspect_folder?path={encoded}")
        self.assertTrue(data.get("success"))
        self.assertIn("items", data)

    def test_api_storage_clean_empty(self):
        data = self._post_json("/api/storage/clean", {"paths": []})
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("deleted_count"), 0)

    # ------------------------------------------------------------------
    # Security guardrails
    # ------------------------------------------------------------------
    def test_api_without_token_is_rejected(self):
        body = self._expect_http_error("/api/storage/drives", 401, token=False)
        self.assertIn("Sesi API", body)

    def test_api_with_wrong_token_is_rejected(self):
        self._expect_http_error(
            "/api/storage/drives",
            401,
            extra_headers={"X-App-Token": "wrong-token"},
        )

    def test_cross_origin_post_is_rejected(self):
        self._expect_http_error(
            "/api/preferences",
            403,
            method="POST",
            data={"language": "id"},
            extra_headers={"Origin": "https://evil.example"},
        )

    def test_foreign_host_header_is_rejected(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            conn.request(
                "GET",
                "/api/storage/drives",
                headers={"Host": "evil.example", "X-App-Token": APP_TOKEN},
            )
            resp = conn.getresponse()
            self.assertEqual(resp.status, 403)
            resp.read()
        finally:
            conn.close()

    def test_arbitrary_directory_inspection_is_rejected(self):
        encoded = urllib.parse.quote(PROJECT_ROOT)
        data = self._get_json(f"/api/storage/inspect_folder?path={encoded}")
        self.assertFalse(data.get("success"))
        self.assertIn("tidak termasuk", data.get("error", "").lower())

    def test_cleanup_rejects_path_outside_scan_results(self):
        outsider = os.path.join(self.seed_dir, "not_scanned.bin")
        with open(outsider, "wb") as f:
            f.write(b"keep-me")
        data = self._post_json("/api/storage/clean", {"paths": [outsider]})
        self.assertTrue(data["success"])
        self.assertTrue(os.path.exists(outsider))
        self.assertEqual(len(data.get("rejected", [])), 1)

    def test_cleanup_rejects_drive_root(self):
        data = self._post_json("/api/storage/clean", {"paths": ["C:\\"]})
        self.assertTrue(data["success"])
        self.assertEqual(len(data.get("rejected", [])), 1)

    def test_start_scan_rejects_arbitrary_path(self):
        body = self._expect_http_error(
            "/api/storage/start_scan", 400, method="POST", data={"drives": [self.seed_dir]}
        )
        self.assertIn("drive", body.lower())

    def test_repair_endpoints_reject_command_injection(self):
        body = self._expect_http_error(
            "/api/repair_trim", 400, method="POST", data={"drive": "C; Start-Process calc"}
        )
        self.assertIn("tidak valid", body.lower())
        body = self._expect_http_error(
            "/api/repair_chkdsk", 400, method="POST", data={"drive": "C & whoami"}
        )
        self.assertIn("drive", body.lower())

    def test_dirty_check_rejects_invalid_drive(self):
        self._expect_http_error("/api/dirty_check?drive=C%3Bwhoami", 400)

    def test_get_shutdown_is_not_allowed(self):
        self._expect_http_error("/api/shutdown", 405)

    def test_oversized_body_is_rejected(self):
        big = {"padding": "x" * (1024 * 1024 + 128)}
        self._expect_http_error("/api/preferences", 413, method="POST", data=big)

    def test_scan_chunk_clamps_parameters(self):
        data = self._get_json(
            "/api/scan_chunk?disk_index=999&start_block=9999&count=9999&total_blocks=9999&disk_size=1048576"
        )
        self.assertTrue(data.get("success"))
        self.assertLessEqual(len(data.get("blocks", [])), 64)


if __name__ == "__main__":
    unittest.main()
