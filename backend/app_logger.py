# -*- coding: utf-8 -*-
"""
DiagnoseMyDisk Application Logger (v2.0.0)
Author: Gemi (Pair-programmed with Alfa)
Standard: Deterministic In-Memory & Persistent Diagnostics for AI & Human Troubleshooting
"""

import os
import sys
import time
from datetime import datetime
import threading
from collections import deque

# Determine persistent log file location
if getattr(sys, "frozen", False):
    # Running as compiled binary
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # Running from source
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LOG_FILE_PATH = os.path.join(BASE_DIR, "diagnose_my_disk.log")

# Thread-safe in-memory ring buffer for live UI and API inspection
MAX_BUFFER_LINES = 1000
_log_lock = threading.Lock()
_in_memory_logs = deque(maxlen=MAX_BUFFER_LINES)


def _write_log(level: str, component: str, message: str):
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    entry = {
        "timestamp": timestamp_str,
        "level": level.upper(),
        "component": component,
        "message": str(message)
    }

    formatted_line = f"[{timestamp_str}] [{level.upper():5s}] [{component}] {message}\n"

    with _log_lock:
        _in_memory_logs.append(entry)
        try:
            with open(LOG_FILE_PATH, "a", encoding="utf-8", errors="replace") as f:
                f.write(formatted_line)
        except Exception:
            pass


def log_info(component: str, message: str):
    _write_log("INFO", component, message)


def log_warn(component: str, message: str):
    _write_log("WARN", component, message)


def log_error(component: str, message: str):
    _write_log("ERROR", component, message)


def get_recent_logs(limit: int = 300):
    with _log_lock:
        logs_list = list(_in_memory_logs)
    if limit and limit < len(logs_list):
        return logs_list[-limit:]
    return logs_list


def get_log_file_path() -> str:
    return os.path.abspath(LOG_FILE_PATH)


def clear_logs():
    with _log_lock:
        _in_memory_logs.clear()
        try:
            with open(LOG_FILE_PATH, "w", encoding="utf-8") as f:
                f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [INFO] [System] Log file reset.\n")
        except Exception:
            pass


# Log startup event
log_info("System", f"DiagnoseMyDisk Logger initialized. Log file: {LOG_FILE_PATH}")
