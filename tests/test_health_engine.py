# -*- coding: utf-8 -*-
"""Tests that health evaluation never fabricates telemetry."""

import os
import sys
import tempfile
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.health_engine import (
    calculate_sata_true_health,
    calculate_nvme_true_health,
    calculate_hdd_health,
)
from backend.collector import parse_smart_ini


def make_attrs(values):
    attrs = []
    for attr_id, current, raw_int in values:
        attrs.append({
            "id": attr_id,
            "id_hex": f"0x{attr_id:02X}",
            "name": f"Attr {attr_id:02X}",
            "current": current,
            "worst": current,
            "threshold": 0,
            "raw_int": raw_int,
        })
    return attrs


class TestSataHealth(unittest.TestCase):
    def test_firmware_locked_current_does_not_hide_wear(self):
        attrs = make_attrs([
            (0x05, 100, 32),
            (0xA9, 100, 89),
            (0xA6, 100, 170),
            (0xE8, 100, 91),
        ])
        result = calculate_sata_true_health("Test SSD", attrs, power_on_hours=17000)
        self.assertIsNotNone(result["true_health"])
        self.assertLess(result["true_health"], 95)
        self.assertEqual(result["reported_health"], 100)
        self.assertTrue(result["firmware_current_locked"])
        self.assertTrue(result["is_masking"])
        self.assertIn("Current", result["technical_factors_en"][0] + result["technical_factors_en"][1])

    def test_cdi_snapshot_is_used_as_basis(self):
        attrs = make_attrs([(0x05, 100, 32), (0xA9, 100, 89)])
        result = calculate_sata_true_health("Test SSD", attrs, power_on_hours=100, cdi_life=85)
        self.assertEqual(result["reported_health"], 85)
        self.assertFalse(result["is_masking"])
        self.assertIsNotNone(result["true_health"])

    def test_zero_a9_is_treated_as_missing_not_dead_drive(self):
        attrs = make_attrs([(0xA9, 100, 0), (0x05, 100, 0)])
        result = calculate_sata_true_health("SanDisk Test", attrs, cdi_life=83)
        self.assertEqual(result["true_health"], 83)
        self.assertIn("0xA9 Remaining Life raw value", result["data_gaps"])

    def test_missing_telemetry_reports_unknown(self):
        result = calculate_sata_true_health("Unknown SSD", [], power_on_hours=0)
        self.assertIsNone(result["true_health"])
        self.assertIsNone(result["reported_health"])
        self.assertEqual(result["status_label_en"], "Unknown")
        self.assertGreater(len(result["data_gaps"]), 0)


class TestNvmeHealth(unittest.TestCase):
    def test_percentage_used_maps_to_health(self):
        result = calculate_nvme_true_health(
            "Test NVMe",
            {"percentage_used": 4, "available_spare": 96, "host_writes": 2048},
            power_on_hours=1000,
            vol_info={"used_pct": 50, "free_gb": 100},
        )
        self.assertEqual(result["true_health"], 96)
        self.assertEqual(result["reported_health"], 96)
        self.assertIn("Host Writes", " ".join(result["technical_factors_en"]))

    def test_missing_percentage_used_is_unknown(self):
        result = calculate_nvme_true_health("Test NVMe", {}, 0, {})
        self.assertIsNone(result["true_health"])
        self.assertEqual(result["status_label_en"], "Unknown")
        self.assertIn("Percentage Used (NVMe Log Page 02h)", result["data_gaps"])

    def test_low_spare_applies_penalty(self):
        result = calculate_nvme_true_health(
            "Test NVMe",
            {"percentage_used": 10, "available_spare": 5},
            0,
            {},
        )
        self.assertLess(result["true_health"], 90)


class TestHddHealth(unittest.TestCase):
    def test_pending_sectors_reduce_health(self):
        attrs = make_attrs([(0x05, 200, 0), (0xC5, 200, 2), (0xC6, 200, 0)])
        result = calculate_hdd_health(attrs, power_on_hours=5000, temperature=40)
        self.assertIsNotNone(result["true_health"])
        self.assertLess(result["true_health"], 100)

    def test_clean_hdd_is_100(self):
        attrs = make_attrs([(0x05, 200, 0), (0xC5, 200, 0), (0xC6, 200, 0)])
        result = calculate_hdd_health(attrs, power_on_hours=5000, temperature=40)
        self.assertEqual(result["true_health"], 100)

    def test_missing_attributes_is_unknown(self):
        result = calculate_hdd_health([], 0, None)
        self.assertIsNone(result["true_health"])
        self.assertEqual(result["status_label_en"], "Unknown")


class TestSmartIniParsing(unittest.TestCase):
    def _write_ini(self, content):
        fd, path = tempfile.mkstemp(suffix=".ini")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        self.addCleanup(lambda: os.path.exists(path) and os.remove(path))
        return path

    def test_nvme_cache_uses_only_present_values(self):
        path = self._write_ini(
            "[PC]\nComputerName=TEST\n"
            "[TEST NVME 100]\nDate=2026/01/02 03:04:05\nLife=90\nPowerOnHours=123\n"
            "PowerOnCount=5\nHostWrites=100\nHostReads=50\nTemperature=40\n"
            "[TEST NVME 100THRESHOLD]\n"
        )
        props, attrs = parse_smart_ini(path, is_nvme=True)
        attr_map = {a["id"]: a for a in attrs}
        self.assertEqual(props.get("Date"), "2026/01/02 03:04:05")
        self.assertIn(0x05, attr_map)
        self.assertEqual(attr_map[0x05]["raw_int"], 10)
        self.assertEqual(attr_map[0x0C]["raw_int"], 123)
        self.assertNotIn(0x0D, attr_map)
        self.assertNotIn(0x0E, attr_map)
        self.assertIsNone(attr_map[0x05]["current"])

    def test_missing_cache_values_do_not_invent_defaults(self):
        path = self._write_ini("[TEST SSD 100]\nDate=2026/01/02 03:04:05\n05=100\nA9=100\n")
        props, attrs = parse_smart_ini(path, is_nvme=False)
        attr_map = {a["id"]: a for a in attrs}
        self.assertNotIn("Temperature", props)
        self.assertNotIn("PowerOnHours", props)
        self.assertEqual(attr_map[0xA9]["raw_int"], 0)


if __name__ == "__main__":
    unittest.main()
