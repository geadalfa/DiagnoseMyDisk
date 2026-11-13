# -*- coding: utf-8 -*-
"""Regression tests for ATA SMART temperature decoding."""

import os
import sys
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.collector import _extract_sata_temperature_c, _sanitize_temperature_c


class TestSataTemperatureDecoding(unittest.TestCase):
    def test_sandisk_48bit_raw_uses_current_byte(self):
        # 0x004300000033 = current 0x33 (51 C), max 0x43 (67 C).
        self.assertEqual(_extract_sata_temperature_c(0x004300000033), 51)

    def test_plain_byte_raw_values(self):
        self.assertEqual(_extract_sata_temperature_c(0x3A), 58)
        self.assertEqual(_extract_sata_temperature_c(0x29), 41)

    def test_zero_or_implausible_current_byte_is_rejected(self):
        self.assertIsNone(_extract_sata_temperature_c(0x004300000000))
        self.assertIsNone(_extract_sata_temperature_c(0x64 + 1))

    def test_sanitize_rejects_raw_smart_integer(self):
        self.assertIsNone(_sanitize_temperature_c(287762808883))
        self.assertIsNone(_sanitize_temperature_c(0))
        self.assertIsNone(_sanitize_temperature_c(121))
        self.assertEqual(_sanitize_temperature_c(51), 51)
        self.assertIsNone(_sanitize_temperature_c(None))


if __name__ == "__main__":
    unittest.main()
