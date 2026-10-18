"""
server.py
Desktop Server mandiri berkecepatan tinggi untuk DiagnoseMyDisk.
Mendukung multi-threading, background pre-warming, dan penanganan koneksi tanpa crash.
"""

import os
import sys

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

from collector import collect_all_disks_data

PORT = 5550
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Cache data disk
cached_disks_data = None
cache_lock = threading.Lock()
prewarm_event = threading.Event()


def prewarm_cache():
    """Memuat data disk pertama kali di latar belakang agar respon instan saat UI dibuka."""
    global cached_disks_data
    try:
        data = collect_all_disks_data()
        with cache_lock:
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

    def do_GET(self):
        global cached_disks_data
        parsed_path = urllib.parse.urlparse(self.path)

        if parsed_path.path == "/api/disks":
            try:
                # Tunggu pre-warming latar belakang hingga 10 detik agar tidak menjalankan query ganda
                if cached_disks_data is None:
                    prewarm_event.wait(timeout=10.0)
                
                with cache_lock:
                    if cached_disks_data is None:
                        cached_disks_data = collect_all_disks_data()
                    data_to_send = cached_disks_data

                resp = {
                    "success": True,
                    "disks": data_to_send
                }
                body = json.dumps(resp, ensure_ascii=False).encode("utf-8")

                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                try:
                    err_body = json.dumps({"success": False, "error": str(e), "disks": []}).encode("utf-8")
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(err_body)))
                    self.end_headers()
                    self.wfile.write(err_body)
                except Exception:
                    pass
            return

        elif parsed_path.path == "/api/refresh":
            try:
                new_data = collect_all_disks_data()
                with cache_lock:
                    cached_disks_data = new_data
                
                resp = {
                    "success": True,
                    "refreshed": True,
                    "disks": new_data
                }
                body = json.dumps(resp, ensure_ascii=False).encode("utf-8")

                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                try:
                    err_body = json.dumps({"success": False, "error": str(e), "disks": []}).encode("utf-8")
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(err_body)))
                    self.end_headers()
                    self.wfile.write(err_body)
                except Exception:
                    pass
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
                    "--window-size=1200,850",
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
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            return resp.status == 200
    except Exception:
        return False


def run_server():
    # 1. Cek apakah server sudah aktif di port 5550
    if is_server_already_running(PORT):
        launch_app_window(f"http://localhost:{PORT}")
        return

    # 2. Mulai pre-warming cache di thread latar belakang
    threading.Thread(target=prewarm_cache, daemon=True).start()

    server_address = ("127.0.0.1", PORT)
    try:
        httpd = ThreadingHTTPServer(server_address, DiagnoseDiskHandler)
    except OSError:
        httpd = ThreadingHTTPServer(("127.0.0.1", 5551), DiagnoseDiskHandler)

    active_port = httpd.server_port
    url = f"http://localhost:{active_port}"

    # Buka jendela aplikasi desktop
    threading.Timer(0.3, launch_app_window, args=[url]).start()

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
