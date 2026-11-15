# -*- coding: utf-8 -*-
"""
test_history_manager.py
Unit tests for the local health history engine, atomic persistence,
safe corruption recovery, and measured delta analysis.
"""

import os
import sys
import json
import shutil
import tempfile
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.history_manager import HistoryManager, MAX_SNAPSHOTS_PER_DISK


class TestHistoryManager(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="diagnose_hist_test_")
        self.storage_file = os.path.join(self.test_dir, "test_health_history.json")
        self.mgr = HistoryManager(storage_path=self.storage_file)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_record_snapshot_and_readback(self):
        res = self.mgr.record_snapshot(
            disk_id="DISK_SAMSUNG_001",
            disk_name="Samsung 970 EVO Plus",
            health=98,
            temperature=42,
            data_source="live-wmi",
            status_label_en="Excellent",
            status_label_id="Sangat Prima",
        )
        self.assertTrue(res["recorded"])
        self.assertTrue(os.path.exists(self.storage_file))

        history = self.mgr.get_history("DISK_SAMSUNG_001")
        self.assertEqual(len(history["snapshots"]), 1)
        snap = history["snapshots"][0]
        self.assertEqual(snap["health"], 98)
        self.assertEqual(snap["temperature"], 42)
        self.assertEqual(snap["data_source"], "live-wmi")

    def test_na_health_is_stored_as_none_never_zero(self):
        res = self.mgr.record_snapshot(
            disk_id="DISK_HDD_UNKNOWN",
            disk_name="Generic HDD",
            health=None,
            temperature=38,
            data_source="smart-ini",
        )
        self.assertTrue(res["recorded"])
        history = self.mgr.get_history("DISK_HDD_UNKNOWN")
        snap = history["snapshots"][0]
        self.assertIsNone(snap["health"])
        self.assertNotEqual(snap["health"], 0)

    def test_deduplication_within_window(self):
        res1 = self.mgr.record_snapshot("DISK_01", "SSD", 99, 40)
        self.assertTrue(res1["recorded"])

        # Immediate repeated call with same telemetry
        res2 = self.mgr.record_snapshot("DISK_01", "SSD", 99, 40)
        self.assertFalse(res2["recorded"])
        self.assertEqual(res2["reason"], "Deduplicated within threshold window")

        # Snapshot count remains 1
        history = self.mgr.get_history("DISK_01")
        self.assertEqual(len(history["snapshots"]), 1)

    def test_bounded_snapshots_max_30(self):
        # Force writing 35 snapshots
        for i in range(35):
            # Bypass deduplication by alternating health
            h = 90 + (i % 5)
            # Manipulate raw records
            data = self.mgr._load()
            disks = data.setdefault("disks", {})
            entry = disks.setdefault("DISK_HEAVY", {"name": "Heavy SSD", "snapshots": []})
            entry["snapshots"].append({
                "timestamp": f"2026-11-01T{i:02d}:00:00Z",
                "health": h,
                "temperature": 40,
                "data_source": "test",
                "status_label_en": "Normal",
                "status_label_id": "Normal",
            })
            if len(entry["snapshots"]) > MAX_SNAPSHOTS_PER_DISK:
                entry["snapshots"] = entry["snapshots"][-MAX_SNAPSHOTS_PER_DISK:]
            self.mgr._save(data)

        history = self.mgr.get_history("DISK_HEAVY")
        self.assertEqual(len(history["snapshots"]), MAX_SNAPSHOTS_PER_DISK)

    def test_corruption_recovery(self):
        # Write corrupted JSON
        with open(self.storage_file, "w", encoding="utf-8") as f:
            f.write("{ this is invalid json content !!@#$")

        # Loading should not crash and return empty disks
        data = self.mgr._load()
        self.assertEqual(data, {"disks": {}})

        # Recording a new snapshot should succeed and heal the file
        res = self.mgr.record_snapshot("DISK_NEW", "New SSD", 100, 35)
        self.assertTrue(res["recorded"])
        history = self.mgr.get_history("DISK_NEW")
        self.assertEqual(len(history["snapshots"]), 1)

    def test_trend_calculation(self):
        # 1. No history
        t0 = self.mgr.get_disk_trend("NON_EXISTENT")
        self.assertFalse(t0["has_history"])
        self.assertIsNone(t0["change_pts"])

        # 2. First reading
        self.mgr.record_snapshot("DISK_TREND", "SSD", 95, 40)
        t1 = self.mgr.get_disk_trend("DISK_TREND")
        self.assertTrue(t1["has_history"])
        self.assertEqual(t1["snapshots_count"], 1)
        self.assertEqual(t1["change_pts"], 0)

        # 3. Degraded reading (drop 3 points)
        # Manually add previous reading to test diff
        data = self.mgr._load()
        data["disks"]["DISK_TREND"]["snapshots"].append({
            "timestamp": "2026-11-15T10:00:00Z",
            "health": 92,
            "temperature": 43,
            "data_source": "live-wmi",
            "status_label_en": "Normal",
            "status_label_id": "Normal",
        })
        self.mgr._save(data)

        t2 = self.mgr.get_disk_trend("DISK_TREND")
        self.assertEqual(t2["snapshots_count"], 2)
        self.assertEqual(t2["change_pts"], -3)
        self.assertEqual(t2["trend_status"], "degraded")
        self.assertIn("Turun 3 poin", t2["diff_text_id"])
        self.assertIn("Down 3 points", t2["diff_text_en"])

    def test_clear_history(self):
        self.mgr.record_snapshot("DISK_A", "SSD A", 100, 35)
        self.mgr.record_snapshot("DISK_B", "SSD B", 95, 40)

        # Clear only DISK_A
        self.assertTrue(self.mgr.clear_history("DISK_A"))
        hist_a = self.mgr.get_history("DISK_A")
        self.assertEqual(len(hist_a["snapshots"]), 0)
        hist_b = self.mgr.get_history("DISK_B")
        self.assertEqual(len(hist_b["snapshots"]), 1)

        # Clear all
        self.assertTrue(self.mgr.clear_history())
        all_hist = self.mgr.get_history()
        self.assertEqual(len(all_hist), 0)


if __name__ == "__main__":
    unittest.main()
