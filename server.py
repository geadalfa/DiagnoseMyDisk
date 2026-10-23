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
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import urllib.parse
import urllib.request

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
import scanner

PORT = 5550
STATIC_DIR = os.path.join(BASE_DIR, "static")

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

    def _send_json(self, data, status=200):
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
        except Exception:
            pass

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed_path.query)

        # Baca body JSON jika ada
        body_data = {}
        try:
            content_len = int(self.headers.get("Content-Length", 0))
            if content_len > 0:
                raw_bytes = self.rfile.read(content_len)
                body_data = json.loads(raw_bytes.decode("utf-8"))
        except Exception:
            pass

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

        elif parsed_path.path == "/api/repair_trim":
            drive = body_data.get("drive") or (qs.get("drive", ["C"])[0])
            result = scanner.run_trim_optimization(drive)
            self._send_json(result)
            return

        elif parsed_path.path == "/api/repair_chkdsk":
            drive = body_data.get("drive") or (qs.get("drive", ["C"])[0])
            result = scanner.repair_filesystem(drive)
            self._send_json(result)
            return

        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        global cached_disks_data, last_heartbeat, has_received_heartbeat
        parsed_path = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed_path.query)

        if parsed_path.path == "/api/heartbeat":
            last_heartbeat = time.time()
            has_received_heartbeat = True
            self._send_json({"status": "ok"})
            return

        elif parsed_path.path == "/api/shutdown":
            self._send_json({"status": "shutting_down"})
            threading.Thread(target=lambda: (time.sleep(0.3), os._exit(0))).start()
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
                    "is_admin": is_admin(),
                    "disks": data_to_send,
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
                    "refreshed": True,
                    "is_admin": is_admin(),
                    "disks": cached_disks_data or new_data,
                }
                self._send_json(resp)
            except Exception as e:
                self._send_json({"success": False, "error": str(e), "disks": []}, status=500)
            return

        elif parsed_path.path == "/api/scan_chunk":
            try:
                raw_idx = qs.get("disk_index", ["0"])[0]
                import re
                idx_digits = re.findall(r"\d+", raw_idx)
                disk_index = int(idx_digits[0]) if idx_digits else 0

                def safe_int(val, default=0):
                    try:
                        return int(float(val))
                    except Exception:
                        return default

                start_block = safe_int(qs.get("start_block", [0])[0], 0)
                count = safe_int(qs.get("count", [10])[0], 10)
                total_blocks = safe_int(qs.get("total_blocks", [200])[0], 200)
                known_size = safe_int(qs.get("disk_size", [0])[0], 0)

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
                drive = qs.get("drive", ["C"])[0]
                res = scanner.check_dirty_bit(drive)
                self._send_json(res)
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
                ]
                subprocess.Popen(cmd)
                return
            except Exception:
                pass

    # Fallback ke default browser
    webbrowser.open(url)


def is_server_already_running(port):
    """Cek apakah instansi DiagnoseMyDisk lain sudah berjalan di port ini."""
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/api/disks", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False


def run_server():
    # 1. Cek apakah server sudah aktif di port 5550
    if is_server_already_running(PORT):
        launch_app_window(f"http://127.0.0.1:{PORT}")
        return

    # 2. Mulai pre-warming cache di thread latar belakang
    threading.Thread(target=prewarm_cache, daemon=True).start()

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
