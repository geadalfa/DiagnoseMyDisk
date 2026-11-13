"""
server.py
Desktop Server mandiri berkecepatan tinggi untuk DiagnoseMyDisk.
Mendukung multi-threading, background pre-warming, Bad Sector Surface Scanner,
dan alat perbaikan sistem file & TRIM (Drive Doctor).
"""

import os
import sys
import ctypes

# Proteksi crash sys.stdout/stderr pada mode windowed (--noconsole)
if sys.stdout is None:
    try:
        sys.stdout = open(os.devnull, "w")
    except Exception:
        pass
if sys.stderr is None:
    try:
        sys.stderr = open(os.devnull, "w")
    except Exception:
        pass

import json
import time
import threading
import subprocess
import webbrowser
import hmac
import re
import secrets
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import urllib.parse
import urllib.request
from urllib.parse import urlsplit

# Deteksi root directory (apakah PyInstaller frozen bundle atau Python script biasa)
if getattr(sys, "frozen", False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Tambahkan backend ke sys.path
backend_path = os.path.join(BASE_DIR, "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)

from collector import collect_all_disks_data, is_admin
from hardware_profile import get_flash_technology_glossary
import scanner
import storage_manager
try:
    from backend import app_logger
except ImportError:
    import app_logger
try:
    from backend import updater
except ImportError:
    import updater

PORT = 5550
STATIC_DIR = os.path.join(BASE_DIR, "static")
APP_VERSION = "3.3.0"
APP_TOKEN = secrets.token_urlsafe(32)
MAX_BODY_BYTES = 1024 * 1024
LOCAL_HOSTNAMES = {"127.0.0.1", "localhost"}
DRIVE_TARGET_RE = re.compile(r"^[A-Za-z](?::[\\/]?|[\\/])?$")

updater_instance = updater.UpdateManager(app_name="DiagnoseMyDisk", current_version=APP_VERSION)


def normalize_drive_target(value):
    """Return a canonical drive target (letter, C:, or all) or None when invalid."""
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if cleaned.lower() == "all":
        return "all"
    if not DRIVE_TARGET_RE.match(cleaned):
        return None
    letter = cleaned[0].upper()
    return f"{letter}:"

# Persistent User Preferences Path (v3.1.0)
PREFERENCES_FILE = os.path.join(
    os.environ.get("LOCALAPPDATA", BASE_DIR),
    "DiagnoseMyDisk_Profile",
    "user_preferences.json"
)

def get_user_preferences():
    """Membaca pengaturan preferensi pengguna (default bahasa Inggris & auto-update aktif)."""
    default_prefs = {"language": "en", "auto_update": True}
    try:
        if os.path.exists(PREFERENCES_FILE):
            with open(PREFERENCES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    default_prefs.update(data)
                    return default_prefs
    except Exception:
        pass
    return default_prefs

def save_user_preferences(prefs):
    """Menyimpan preferensi pengguna (seperti bahasa & auto-update) ke file lokal."""
    try:
        os.makedirs(os.path.dirname(PREFERENCES_FILE), exist_ok=True)
        current = get_user_preferences()
        if isinstance(prefs, dict):
            current.update(prefs)
        with open(PREFERENCES_FILE, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2)
        return True
    except Exception as e:
        app_logger.log_error("Server", f"Gagal menyimpan preferensi: {e}")
        return False

# Cache data disk
cached_disks_data = None
cache_lock = threading.Lock()
prewarm_event = threading.Event()
last_heartbeat = time.time()
has_received_heartbeat = False


def prewarm_cache():
    """Memuat data disk pertama kali di latar belakang agar respon instan saat UI dibuka."""
    global cached_disks_data
    try:
        data = collect_all_disks_data()
        with cache_lock:
            if data:
                cached_disks_data = data
    except Exception as e:
        print(f"Prewarm error: {e}")
    finally:
        prewarm_event.set()


class DiagnoseDiskHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def guess_type(self, path):
        if path.endswith(".json"):
            return "application/json"
        if path.endswith(".ico"):
            return "image/x-icon"
        if path.endswith(".png"):
            return "image/png"
        return super().guess_type(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("X-App-Id", "DiagnoseMyDisk")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
            "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )
        super().end_headers()

    def _send_json(self, data, status=200):
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception:
            pass

    def _is_local_request(self):
        host = (self.headers.get("Host") or "").strip()
        hostname = host.rsplit(":", 1)[0].strip("[]").lower() if host else ""
        if hostname not in LOCAL_HOSTNAMES:
            return False, "Host header tidak diizinkan."

        origin = (self.headers.get("Origin") or "").strip()
        if origin and origin.lower() != "null":
            parsed = urlsplit(origin)
            if parsed.netloc.lower() != host.lower():
                return False, "Origin lintas situs ditolak."
        return True, ""

    def _is_authorized_api(self, qs):
        ok, reason = self._is_local_request()
        if not ok:
            self._send_json({"success": False, "error": reason}, status=403)
            return False

        supplied = (self.headers.get("X-App-Token") or "").strip()
        if not supplied:
            supplied = (qs.get("token", [""])[0] or "").strip()
        if not hmac.compare_digest(supplied, APP_TOKEN):
            self._send_json({"success": False, "error": "Sesi API tidak valid. Muat ulang aplikasi."}, status=401)
            return False

        if self.command == "POST":
            length_header = self.headers.get("Content-Length")
            try:
                content_length = int(length_header or 0)
            except ValueError:
                content_length = -1
            if content_length < 0 or content_length > MAX_BODY_BYTES:
                # Drain a bounded amount so the client receives the 413 cleanly.
                try:
                    remaining = min(content_length, MAX_BODY_BYTES * 2)
                    while remaining > 0:
                        chunk = self.rfile.read(min(65536, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                except Exception:
                    pass
                self.close_connection = True
                self._send_json({"success": False, "error": "Ukuran permintaan melebihi batas."}, status=413)
                return False
        return True

    def _read_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0) or 0)
        except ValueError:
            content_length = 0
        if content_length <= 0:
            return {}
        raw = self.rfile.read(min(content_length, MAX_BODY_BYTES))
        try:
            parsed = json.loads(raw.decode("utf-8"))
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    def _serve_index(self):
        try:
            index_path = os.path.join(STATIC_DIR, "index.html")
            with open(index_path, "r", encoding="utf-8") as f:
                html = f.read()
            html = html.replace("__APP_TOKEN__", APP_TOKEN).replace("__APP_VERSION__", APP_VERSION)
            body = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self._send_json({"success": False, "error": str(e)}, status=500)

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed_path.query)

        if not parsed_path.path.startswith("/api/"):
            self.send_response(404)
            self.end_headers()
            return

        if not self._is_authorized_api(qs):
            return

        body_data = self._read_json_body()

        if parsed_path.path == "/api/shutdown":
            self._send_json({"status": "shutting_down"})
            threading.Thread(target=lambda: (time.sleep(0.3), os._exit(0))).start()
            return

        elif parsed_path.path == "/api/relaunch_admin":
            try:
                if getattr(sys, "frozen", False):
                    exe_path = sys.executable
                    params = ""
                else:
                    exe_path = sys.executable
                    params = f'"{os.path.abspath(__file__)}"'
                ctypes.windll.shell32.ShellExecuteW(None, "runas", exe_path, params, None, 1)
                self._send_json({"success": True, "message": "Aplikasi sedang dimulai ulang dengan Administrator."})
                threading.Thread(target=lambda: (time.sleep(0.6), os._exit(0))).start()
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path in ("/api/repair_trim", "/api/repair_chkdsk"):
            drive_raw = body_data.get("drive") or (qs.get("drive", [""])[0])
            drive = normalize_drive_target(drive_raw)
            if not drive or drive == "all":
                self._send_json({"success": False, "error": "Huruf drive tidak valid."}, status=400)
                return
            if parsed_path.path == "/api/repair_trim":
                result = scanner.run_trim_optimization(drive)
            else:
                result = scanner.repair_filesystem(drive)
            self._send_json(result)
            return

        elif parsed_path.path == "/api/storage/start_scan":
            try:
                drive_input = body_data.get("drives") or body_data.get("drive") or "all"
                raw_items = [drive_input] if isinstance(drive_input, str) else list(drive_input)
                drive_letters = []
                for item in raw_items:
                    normalized = normalize_drive_target(item)
                    if normalized is None:
                        self._send_json(
                            {"success": False, "error": "Target pemindaian hanya boleh berupa huruf drive atau 'all'."},
                            status=400,
                        )
                        return
                    drive_letters.append(normalized)

                scan_duplicates = bool(body_data.get("scan_duplicates", True))
                try:
                    min_large_mb = max(0, min(102400, int(body_data.get("min_large_mb", 50))))
                except (TypeError, ValueError):
                    min_large_mb = 50

                sm = storage_manager.get_storage_manager()
                ok, msg = sm.start_scan(drive_letters, scan_duplicates, min_large_mb)
                self._send_json({"success": ok, "message": msg})
            except Exception as e:
                app_logger.log_error("Server", f"Failed to start storage scan: {e}")
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/open_log_file":
            try:
                log_path = app_logger.get_log_file_path()
                if os.path.exists(log_path):
                    os.startfile(log_path)
                    self._send_json({"success": True, "message": "Log file opened in system editor."})
                else:
                    self._send_json({"success": False, "error": "Log file not created yet."})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/preferences":
            try:
                ok = save_user_preferences(body_data)
                self._send_json({"success": ok, "preferences": get_user_preferences()})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/update/check":
            try:
                force = body_data.get("force", True) if isinstance(body_data, dict) else True
                self._send_json(updater_instance.check_for_updates(force=force))
            except Exception as e:
                self._send_json({"status": "error", "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/update/download":
            try:
                url = body_data.get("download_url") if isinstance(body_data, dict) else None
                self._send_json(updater_instance.start_download(url))
            except Exception as e:
                self._send_json({"status": "error", "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/update/apply":
            try:
                silent = bool(body_data.get("silent", False)) if isinstance(body_data, dict) else False
                def _shutdown():
                    time.sleep(0.5)
                    os._exit(0)
                self._send_json(updater_instance.apply_update(silent=silent, on_shutdown=_shutdown))
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/clear_logs":
            try:
                app_logger.clear_logs()
                self._send_json({"success": True, "message": "Logs cleared."})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/storage/inspect_folder":
            try:
                target_path = body_data.get("path", "")
                if not target_path or not isinstance(target_path, str):
                    self._send_json({"success": False, "error": "Field path harus disertakan."}, status=400)
                    return
                try:
                    limit = max(1, min(500, int(body_data.get("limit", 100))))
                except (TypeError, ValueError):
                    limit = 100
                sm = storage_manager.get_storage_manager()
                res = sm.inspect_directory(target_path, limit=limit, enforce_allowlist=True)
                self._send_json(res)
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/storage/cancel_scan":
            try:
                sm = storage_manager.get_storage_manager()
                ok = sm.cancel_scan()
                self._send_json({"success": ok})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/storage/clean":
            try:
                paths = body_data.get("paths", [])
                if not isinstance(paths, list) or not all(isinstance(p, str) for p in paths):
                    self._send_json({"success": False, "error": "Daftar paths tidak valid."}, status=400)
                    return
                sm = storage_manager.get_storage_manager()
                res = sm.clean_paths(paths)
                self._send_json(res)
            except Exception as e:
                app_logger.log_error("Server", f"Cleanup failure: {e}")
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/storage/open_explorer":
            try:
                target_path = body_data.get("path", "")
                if not isinstance(target_path, str):
                    self._send_json({"success": False, "error": "Path tidak valid."}, status=400)
                    return
                sm = storage_manager.get_storage_manager()
                ok, msg = sm.open_in_explorer(target_path)
                self._send_json({"success": ok, "message": msg})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        self._send_json({"success": False, "error": "Endpoint tidak ditemukan."}, status=404)

    def do_GET(self):
        global cached_disks_data, last_heartbeat, has_received_heartbeat
        parsed_path = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed_path.query)

        if parsed_path.path in ("/", "/index.html"):
            ok, _ = self._is_local_request()
            if not ok:
                self._send_json({"success": False, "error": "Host header tidak diizinkan."}, status=403)
                return
            self._serve_index()
            return

        if parsed_path.path.startswith("/api/"):
            if not self._is_authorized_api(qs):
                return

        if parsed_path.path == "/api/heartbeat":
            last_heartbeat = time.time()
            has_received_heartbeat = True
            self._send_json({"status": "ok"})
            return

        elif parsed_path.path == "/api/shutdown":
            self._send_json({"success": False, "error": "Gunakan POST untuk mematikan aplikasi."}, status=405)
            return

        elif parsed_path.path == "/api/glossary":
            self._send_json({"success": True, "glossary": get_flash_technology_glossary()})
            return

        elif parsed_path.path == "/api/disks":
            try:
                if cached_disks_data is None:
                    prewarm_event.wait(timeout=10.0)

                with cache_lock:
                    if not cached_disks_data:
                        cached_disks_data = collect_all_disks_data()
                    data_to_send = cached_disks_data

                resp = {
                    "success": True,
                    "version": APP_VERSION,
                    "is_admin": is_admin(),
                    "disks": data_to_send,
                    "glossary": get_flash_technology_glossary(),
                }
                self._send_json(resp)
            except Exception as e:
                self._send_json({"success": False, "error": str(e), "disks": []}, status=500)
            return

        elif parsed_path.path == "/api/refresh":
            try:
                new_data = collect_all_disks_data()
                with cache_lock:
                    if new_data:
                        cached_disks_data = new_data

                resp = {
                    "success": True,
                    "version": APP_VERSION,
                    "refreshed": True,
                    "is_admin": is_admin(),
                    "disks": cached_disks_data or new_data,
                    "glossary": get_flash_technology_glossary(),
                }
                self._send_json(resp)
            except Exception as e:
                self._send_json({"success": False, "error": str(e), "disks": []}, status=500)
            return

        elif parsed_path.path == "/api/scan_chunk":
            try:
                raw_idx = qs.get("disk_index", ["0"])[0]
                idx_digits = re.findall(r"\d+", raw_idx)
                disk_index = int(idx_digits[0]) if idx_digits else 0
                disk_index = max(0, min(63, disk_index))

                def safe_int(val, default=0):
                    try:
                        return int(float(val))
                    except Exception:
                        return default

                start_block = max(0, safe_int(qs.get("start_block", [0])[0], 0))
                count = max(1, min(64, safe_int(qs.get("count", [10])[0], 10)))
                total_blocks = max(20, min(1000, safe_int(qs.get("total_blocks", [200])[0], 200)))
                known_size = max(0, min(64 * 1024**4, safe_int(qs.get("disk_size", [0])[0], 0)))
                start_block = min(start_block, total_blocks - 1)

                blocks = scanner.scan_disk_chunk(
                    disk_index=disk_index,
                    start_block=start_block,
                    count=count,
                    total_blocks=total_blocks,
                    known_size=known_size,
                )
                self._send_json({"success": True, "disk_index": disk_index, "blocks": blocks})
            except Exception as e:
                self._send_json({"success": False, "error": str(e), "blocks": []}, status=500)
            return

        elif parsed_path.path == "/api/dirty_check":
            try:
                drive = normalize_drive_target(qs.get("drive", [""])[0])
                if not drive or drive == "all":
                    self._send_json({"success": False, "error": "Huruf drive tidak valid."}, status=400)
                    return
                res = scanner.check_dirty_bit(drive)
                self._send_json(res)
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/storage/drives":
            try:
                drives = storage_manager.get_available_drives()
                self._send_json({"success": True, "drives": drives})
            except Exception as e:
                self._send_json({"success": False, "error": str(e), "drives": []}, status=500)
            return

        elif parsed_path.path == "/api/storage/scan_status":
            try:
                sm = storage_manager.get_storage_manager()
                self._send_json(sm.get_status())
            except Exception as e:
                self._send_json({"is_scanning": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/storage/results":
            try:
                sm = storage_manager.get_storage_manager()
                res = dict(sm.results)
                res["success"] = True
                self._send_json(res)
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/storage/inspect_folder":
            try:
                target_path = qs.get("path", [""])[0]
                if not target_path:
                    self._send_json({"success": False, "error": "Parameter path harus disertakan."}, status=400)
                    return
                try:
                    limit = max(1, min(500, int(qs.get("limit", [100])[0])))
                except (TypeError, ValueError):
                    limit = 100
                sm = storage_manager.get_storage_manager()
                res = sm.inspect_directory(target_path, limit=limit, enforce_allowlist=True)
                self._send_json(res)
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        elif parsed_path.path == "/api/preferences":
            try:
                prefs = get_user_preferences()
                self._send_json({"success": True, "preferences": prefs})
            except Exception as e:
                self._send_json({"success": False, "error": str(e), "preferences": {"language": "en"}}, status=500)
            return

        elif parsed_path.path == "/api/update/status":
            self._send_json(updater_instance.get_status())
            return

        elif parsed_path.path == "/api/update/check":
            force = qs.get("force", ["0"])[0] in ("1", "true", "True")
            self._send_json(updater_instance.check_for_updates(force=force))
            return

        elif parsed_path.path == "/api/logs":
            try:
                recent = app_logger.get_recent_logs(300)
                log_path = app_logger.get_log_file_path()
                self._send_json({"success": True, "logs": recent, "log_file": log_path})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)
            return

        # Fallback ke file statis HTML/CSS/JS/Icons
        super().do_GET()

    def log_message(self, format, *args):
        # Silent logger agar tidak memicu I/O error pada noconsole
        pass


def launch_app_window(url):
    """
    Membuka aplikasi dalam mode jendela mandiri (Native App Window)
    menggunakan Edge Webview / Chrome App mode dengan profil terisolasi.
    """
    user_data_dir = os.path.join(os.environ.get("LOCALAPPDATA", os.environ.get("TEMP", ".")), "DiagnoseMyDisk_Profile")
    os.makedirs(user_data_dir, exist_ok=True)

    candidate_browsers = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for b_path in candidate_browsers:
        if os.path.exists(b_path):
            try:
                cmd = [
                    b_path,
                    f"--app={url}",
                    f"--user-data-dir={user_data_dir}",
                    "--window-size=1260,880",
                    "--disable-extensions",
                    "--disable-plugins",
                    "--disable-http-cache",
                    "--disk-cache-size=0",
                ]
                subprocess.Popen(cmd)
                return
            except Exception:
                pass

    # Fallback ke default browser
    webbrowser.open(url)


def ensure_admin_rights():
    """Memastikan aplikasi berjalan dengan hak Administrator penuh.
    Jika belum admin, luncurkan ulang dengan ShellExecute 'runas' untuk memicu pop-up UAC.
    """
    if os.name == "nt" and "--no-elevate" not in sys.argv and not os.environ.get("DMD_NO_ELEVATE"):
        if not is_admin():
            try:
                if getattr(sys, "frozen", False):
                    exe_path = sys.executable
                    params = " ".join([f'"{arg}"' for arg in sys.argv[1:]])
                else:
                    exe_path = sys.executable
                    params = f'"{os.path.abspath(__file__)}"'
                    if len(sys.argv) > 1:
                        params += " " + " ".join([f'"{arg}"' for arg in sys.argv[1:]])
                ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", exe_path, params.strip(), None, 1)
                if ret > 32:
                    os._exit(0)
            except Exception:
                pass


def is_server_already_running(port):
    """Cek apakah instans DiagnoseMyDisk lain sudah melayani port ini (tanpa mematikannya)."""
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.status == 200 and resp.headers.get("X-App-Id") == "DiagnoseMyDisk"
    except Exception:
        return False


def run_server():
    # 0. Pastikan aplikasi berjalan sebagai Administrator (memicu pop-up UAC)
    ensure_admin_rights()

    # 1. Cek apakah server sudah aktif di port 5550
    if is_server_already_running(PORT):
        launch_app_window(f"http://127.0.0.1:{PORT}")
        return

    # 2. Mulai pre-warming cache di thread latar belakang
    threading.Thread(target=prewarm_cache, daemon=True).start()

    # 3. Mulai auto-update background check (default ON di preferensi)
    updater_instance.start_background_auto_update(get_user_preferences, delay=3.5, on_shutdown=lambda: os._exit(0))

    server_address = ("127.0.0.1", PORT)
    try:
        httpd = ThreadingHTTPServer(server_address, DiagnoseDiskHandler)
    except OSError:
        httpd = ThreadingHTTPServer(("127.0.0.1", 5551), DiagnoseDiskHandler)

    active_port = httpd.server_port
    url = f"http://127.0.0.1:{active_port}"

    # Buka jendela aplikasi desktop
    threading.Timer(0.3, launch_app_window, args=[url]).start()

    # Watchdog thread: hentikan server jika jendela browser ditutup (heartbeat berhenti)
    def watchdog_loop():
        global last_heartbeat, has_received_heartbeat
        time.sleep(15)  # Beri waktu startup 15 detik pertama
        while True:
            time.sleep(3)
            if has_received_heartbeat:
                if time.time() - last_heartbeat > 10:
                    # Jendela ditutup pengguna -> hentikan proses latar belakang
                    os._exit(0)

    threading.Thread(target=watchdog_loop, daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.server_close()


if __name__ == "__main__":
    try:
        run_server()
    except Exception:
        try:
            log_path = os.path.join(os.environ.get("TEMP", "."), "diagnose_crash.log")
            with open(log_path, "w") as f:
                import traceback
                traceback.print_exc(file=f)
        except Exception:
            pass
