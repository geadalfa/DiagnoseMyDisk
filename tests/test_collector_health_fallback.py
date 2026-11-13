# -*- coding: utf-8 -*-
"""Regression tests for NVMe detection and the Windows health fallback."""

import os
import sys
import unittest
from unittest import mock

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend import collector


def telemetry_with_scsi_labelled_nvme():
    return {
        "Disks": [
            {
                "DeviceId": "0",
                "FriendlyName": "Micron MTFDKCD512QFM-1BD1AABLA",
                "MediaType": "SSD",
                "BusType": "SCSI",
                "Size": 512110190592,
                "HealthStatus": "OK",
                "OperationalStatus": "OK",
                "SerialNumber": "00A0_7501_4820_E4DC",
                "FirmwareVersion": "",
            }
        ],
        "DiskSource": "Win32_DiskDrive",
        "WmiDisks": [
            {
                "Index": "0",
                "PNPDeviceID": r"SCSI\DISK&VEN_NVME&PROD_MTFDKCD512QFM\5&2A3B4C5D&0&000000",
                "InterfaceType": "SCSI",
                "Status": "OK",
            }
        ],
        "Partitions": [],
        "Volumes": [],
        "DiskVolMap": [],
        "Smart": [],
        "SmartThresh": [],
        "Reliability": [],
        "IsAdmin": False,
    }


class TestWindowsHealthFallback(unittest.TestCase):
    def test_scsi_labelled_nvme_is_reclassified(self):
        with mock.patch.object(collector, "query_system_telemetry", return_value=telemetry_with_scsi_labelled_nvme()), \
                mock.patch.object(collector, "is_admin", return_value=False), \
                mock.patch.object(collector, "get_disk_hardware_cache", return_value={}):
            disks = collector.collect_all_disks_data()

        self.assertEqual(len(disks), 1)
        disk = disks[0]
        self.assertEqual(disk["bus_type"], "NVMe")
        self.assertIsNone(disk["health_analysis"]["true_health"])
        self.assertEqual(disk["data_source"], "windows-health")
        self.assertEqual(disk["windows_health"]["status"], "healthy")
        self.assertEqual(disk["telemetry_reason"], "not-elevated")
        self.assertIn("Healthy", disk["health_analysis"]["status_label_en"])

    def test_unhealthy_windows_status_is_reported_as_unhealthy(self):
        payload = telemetry_with_scsi_labelled_nvme()
        payload["Disks"][0]["HealthStatus"] = "Unhealthy"
        with mock.patch.object(collector, "query_system_telemetry", return_value=payload), \
                mock.patch.object(collector, "is_admin", return_value=True), \
                mock.patch.object(collector, "get_disk_hardware_cache", return_value={}):
            disks = collector.collect_all_disks_data()

        disk = disks[0]
        self.assertEqual(disk["windows_health"]["status"], "unhealthy")
        self.assertEqual(disk["telemetry_reason"], "nvme-smart-not-exposed")
        self.assertIn("Unhealthy", disk["health_analysis"]["status_label_en"])


if __name__ == "__main__":
    unittest.main()
