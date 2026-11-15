# -*- coding: utf-8 -*-
"""
history_manager.py
Durable, atomic local health history and trend tracking for DiagnoseMyDisk.
Persists up to 30 snapshots per disk in %LOCALAPPDATA% with atomic file writes,
automatic corruption recovery, and measured delta analysis without life-span speculation.
"""

import os
import sys
import json
import time
import shutil
import tempfile
import threading
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_SNAPSHOTS_PER_DISK = 30
DEDUPLICATION_WINDOW_SECONDS = 60


def get_default_history_path() -> str:
    app_data = os.environ.get("LOCALAPPDATA") or BASE_DIR
    return os.path.join(app_data, "DiagnoseMyDisk_Profile", "health_history.json")


class HistoryManager:
    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path or get_default_history_path()
        self._lock = threading.Lock()

    def _load(self) -> Dict[str, Any]:
        """Loads health history from disk with corruption recovery."""
        if not os.path.exists(self.storage_path):
            return {"disks": {}}

        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "disks" in data and isinstance(data["disks"], dict):
                    return data
                return {"disks": {}}
        except Exception as exc:
            # Safe recovery from corrupted file: preserve corrupted file and reset
            backup_path = f"{self.storage_path}.corrupt.{int(time.time())}"
            try:
                shutil.copy2(self.storage_path, backup_path)
            except Exception:
                pass
            return {"disks": {}}

    def _save(self, data: Dict[str, Any]) -> bool:
        """Atomically saves health history to disk."""
        target_dir = os.path.dirname(self.storage_path)
        os.makedirs(target_dir, exist_ok=True)

        temp_fd, temp_path = tempfile.mkstemp(
            prefix="health_history_",
            suffix=".tmp",
            dir=target_dir,
        )
        try:
            with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())

            # Atomic file replacement
            os.replace(temp_path, self.storage_path)
            return True
        except Exception as exc:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
            return False

    def record_snapshot(
        self,
        disk_id: str,
        disk_name: str,
        health: Optional[int],
        temperature: Optional[int],
        data_source: str = "unknown",
        status_label_en: str = "Unknown",
        status_label_id: str = "Tidak Diketahui",
    ) -> Dict[str, Any]:
        """
        Records a valid telemetry snapshot for a disk.
        Health value 'N/A' is stored as None (never coerced to 0).
        """
        if not disk_id:
            return {"recorded": False, "reason": "Missing disk identifier"}

        # Coerce health to int if valid number, otherwise None
        sanitized_health = None
        if health is not None:
            try:
                sanitized_health = int(health)
            except (ValueError, TypeError):
                sanitized_health = None

        sanitized_temp = None
        if temperature is not None:
            try:
                sanitized_temp = int(temperature)
            except (ValueError, TypeError):
                sanitized_temp = None

        now = datetime.now(timezone.utc)
        iso_now = now.isoformat()

        with self._lock:
            data = self._load()
            disks = data.setdefault("disks", {})
            disk_entry = disks.setdefault(disk_id, {
                "name": disk_name,
                "snapshots": [],
            })
            disk_entry["name"] = disk_name
            snapshots: List[Dict[str, Any]] = disk_entry.setdefault("snapshots", [])

            # Check deduplication window to prevent snapshot spamming on repeated manual refresh
            if snapshots:
                last_snap = snapshots[-1]
                try:
                    last_time = datetime.fromisoformat(last_snap.get("timestamp", ""))
                    elapsed = (now - last_time).total_seconds()
                except Exception:
                    elapsed = 9999

                if (
                    elapsed < DEDUPLICATION_WINDOW_SECONDS
                    and last_snap.get("health") == sanitized_health
                    and last_snap.get("temperature") == sanitized_temp
                ):
                    return {
                        "recorded": False,
                        "reason": "Deduplicated within threshold window",
                        "snapshot": last_snap,
                    }

            new_snapshot = {
                "timestamp": iso_now,
                "health": sanitized_health,
                "temperature": sanitized_temp,
                "data_source": str(data_source or "unknown"),
                "status_label_en": str(status_label_en or "Unknown"),
                "status_label_id": str(status_label_id or "Tidak Diketahui"),
            }

            snapshots.append(new_snapshot)
            # Bound history to maximum 30 snapshots
            if len(snapshots) > MAX_SNAPSHOTS_PER_DISK:
                disk_entry["snapshots"] = snapshots[-MAX_SNAPSHOTS_PER_DISK:]

            saved = self._save(data)
            return {"recorded": saved, "snapshot": new_snapshot}

    def get_history(self, disk_id: Optional[str] = None) -> Dict[str, Any]:
        """Retrieves history for one or all disks."""
        with self._lock:
            data = self._load()
            disks = data.get("disks", {})
            if disk_id:
                return disks.get(disk_id, {"name": "", "snapshots": []})
            return disks

    def get_disk_trend(self, disk_id: str) -> Dict[str, Any]:
        """
        Calculates health trend and change points from the previous reading.
        Never predicts or speculates drive lifespan.
        """
        history = self.get_history(disk_id)
        snapshots = history.get("snapshots", [])

        if not snapshots:
            return {
                "has_history": False,
                "snapshots_count": 0,
                "change_pts": None,
                "diff_text_id": "Belum ada riwayat tercatat",
                "diff_text_en": "No history recorded yet",
                "trend_status": "none",
                "snapshots": [],
            }

        latest = snapshots[-1]
        current_health = latest.get("health")

        if len(snapshots) == 1:
            date_str = _format_date(latest.get("timestamp"))
            return {
                "has_history": True,
                "snapshots_count": 1,
                "change_pts": 0,
                "diff_text_id": f"Pembacaan pertama ({date_str})",
                "diff_text_en": f"First reading recorded ({date_str})",
                "trend_status": "first",
                "snapshots": snapshots,
            }

        # Compare with previous reading with health data
        previous = snapshots[-2]
        prev_health = previous.get("health")
        prev_date = _format_date(previous.get("timestamp"))

        if current_health is None or prev_health is None:
            return {
                "has_history": True,
                "snapshots_count": len(snapshots),
                "change_pts": None,
                "diff_text_id": f"Telemetri sektor tidak tersedia (sejak {prev_date})",
                "diff_text_en": f"Sector telemetry unavailable (since {prev_date})",
                "trend_status": "unavailable",
                "snapshots": snapshots,
            }

        diff = current_health - prev_health
        if diff < 0:
            diff_text_id = f"Turun {abs(diff)} poin sejak {prev_date}"
            diff_text_en = f"Down {abs(diff)} points since {prev_date}"
            trend_status = "degraded"
        elif diff > 0:
            diff_text_id = f"Naik {diff} poin sejak {prev_date}"
            diff_text_en = f"Up {diff} points since {prev_date}"
            trend_status = "improved"
        else:
            diff_text_id = f"Stabil sejak {prev_date}"
            diff_text_en = f"Stable since {prev_date}"
            trend_status = "stable"

        return {
            "has_history": True,
            "snapshots_count": len(snapshots),
            "change_pts": diff,
            "diff_text_id": diff_text_id,
            "diff_text_en": diff_text_en,
            "trend_status": trend_status,
            "snapshots": snapshots,
        }

    def clear_history(self, disk_id: Optional[str] = None) -> bool:
        """Clears health history for a specific disk or all disks."""
        with self._lock:
            data = self._load()
            disks = data.setdefault("disks", {})
            if disk_id:
                if disk_id in disks:
                    disks[disk_id]["snapshots"] = []
            else:
                data["disks"] = {}
            return self._save(data)


def _format_date(iso_str: Optional[str]) -> str:
    if not iso_str:
        return "pembacaan sebelumnya"
    try:
        dt = datetime.fromisoformat(iso_str)
        return dt.strftime("%d %b")
    except Exception:
        return "pembacaan sebelumnya"


# Global singleton instance
_history_manager_instance = None
_history_lock = threading.Lock()


def get_history_manager() -> HistoryManager:
    global _history_manager_instance
    with _history_lock:
        if _history_manager_instance is None:
            _history_manager_instance = HistoryManager()
        return _history_manager_instance
