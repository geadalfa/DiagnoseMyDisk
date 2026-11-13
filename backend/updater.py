"""
updater.py
Engine pembaruan otomatis dan manual untuk DiagnoseMyDisk dari GitHub Releases.
Mendukung verifikasi versi semver, query GitHub API dengan fallback scraping redirect,
unduhan background streaming dengan pelacakan progress, dan instalasi non-elevated Inno Setup.
"""

import os
import re
import sys
import json
import time
import tempfile
import threading
import subprocess
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple

GITHUB_REPO = "geadalfa/DiagnoseMyDisk"
CACHE_TTL_SECONDS = 900  # 15 menit cache pengecekan update


def parse_version(v_str: str) -> Tuple[int, ...]:
    """
    Mengurai string versi semver (misal 'v3.2.0', '3.2.1', 'v1.4.2-beta')
    menjadi tuple integer untuk perbandingan deterministik.
    """
    if not v_str:
        return (0, 0, 0)
    # Bersihkan prefix 'v' atau whitespace
    cleaned = v_str.strip().lstrip("vV")
    # Ambil bagian angka numerik utama
    parts = re.findall(r"\d+", cleaned)
    if not parts:
        return (0, 0, 0)
    return tuple(int(p) for p in parts[:3])


def compare_versions(v1_str: str, v2_str: str) -> int:
    """
    Membandingkan dua versi semver.
    Mengembalikan 1 jika v1 > v2, 0 jika sama, -1 jika v1 < v2.
    """
    t1 = parse_version(v1_str)
    t2 = parse_version(v2_str)
    # Samakan panjang tuple menjadi 3 elemen
    while len(t1) < 3:
        t1 = t1 + (0,)
    while len(t2) < 3:
        t2 = t2 + (0,)
    if t1 > t2:
        return 1
    elif t1 < t2:
        return -1
    return 0


def is_newer_version(remote_v: str, local_v: str) -> bool:
    """Mengembalikan True jika remote_v lebih baru daripada local_v."""
    return compare_versions(remote_v, local_v) > 0


class UpdateManager:
    """
    Manajer pembaruan thread-safe untuk memeriksa rilis GitHub,
    mengunduh installer Inno Setup di background, dan mengeksekusi pembaruan.
    """

    def __init__(self, app_name: str, current_version: str, repo: str = GITHUB_REPO):
        self.app_name = app_name
        self.current_version = current_version
        self.repo = repo
        self._lock = threading.RLock()
        
        # State mesin update
        self.status: str = "idle"  # idle, checking, available, up_to_date, downloading, ready_to_install, installing, error
        self.progress: int = 0
        self.downloaded_bytes: int = 0
        self.total_bytes: int = 0
        self.error_message: Optional[str] = None
        self.latest_release_info: Dict[str, Any] = {}
        self.installer_path: Optional[str] = None
        self.last_checked_time: float = 0.0
        self._download_thread: Optional[threading.Thread] = None

    def get_status(self) -> Dict[str, Any]:
        """Mengembalikan snapshot status update saat ini."""
        with self._lock:
            return {
                "status": self.status,
                "current_version": self.current_version,
                "latest_version": self.latest_release_info.get("tag_name", "").lstrip("v"),
                "update_available": self.status in ("available", "downloading", "ready_to_install", "installing"),
                "progress": self.progress,
                "downloaded_bytes": self.downloaded_bytes,
                "total_bytes": self.total_bytes,
                "error": self.error_message,
                "release_info": self.latest_release_info,
                "installer_ready": self.status == "ready_to_install" and bool(self.installer_path and os.path.exists(self.installer_path)),
                "last_checked": self.last_checked_time
            }

    def check_for_updates(self, force: bool = False) -> Dict[str, Any]:
        """
        Memeriksa GitHub Releases untuk rilis terbaru.
        Menggunakan cache in-memory kecuali force=True.
        """
        now = time.time()
        with self._lock:
            if not force and (now - self.last_checked_time < CACHE_TTL_SECONDS) and self.latest_release_info:
                return self.get_status()
            if self.status in ("downloading", "installing"):
                return self.get_status()
            self.status = "checking"
            self.error_message = None

        release_data = None
        error_encountered = None

        # 1. Coba REST API resmi GitHub
        api_url = f"https://api.github.com/repos/{self.repo}/releases/latest"
        req = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": f"{self.app_name}-Updater/{self.current_version} (Windows NT)",
                "Accept": "application/vnd.github.v3+json"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    raw = resp.read().decode("utf-8")
                    release_data = json.loads(raw)
        except Exception as e:
            error_encountered = str(e)

        # 2. Fallback: HTTP Redirect Scraping (Zero Rate Limit)
        if not release_data:
            try:
                redirect_url = f"https://github.com/{self.repo}/releases/latest"
                fallback_req = urllib.request.Request(
                    redirect_url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                )
                with urllib.request.urlopen(fallback_req, timeout=8) as resp:
                    final_url = resp.geturl()
                    # Contoh format redirect: https://github.com/geadalfa/DiagnoseMyDisk/releases/tag/v3.2.0
                    m = re.search(r"/tag/([^/?#]+)", final_url)
                    if m:
                        tag = m.group(1)
                        release_data = {
                            "tag_name": tag,
                            "name": f"{self.app_name} {tag}",
                            "html_url": final_url,
                            "body": "Pembaruan rilis terbaru dari GitHub.",
                            "published_at": "",
                            "assets": [
                                {
                                    "name": f"{self.app_name}_Setup.exe",
                                    "browser_download_url": f"https://github.com/{self.repo}/releases/download/{tag}/{self.app_name}_Setup.exe",
                                    "size": 0
                                }
                            ]
                        }
            except Exception as e:
                if not error_encountered:
                    error_encountered = str(e)

        with self._lock:
            self.last_checked_time = now
            if not release_data:
                self.status = "error"
                self.error_message = f"Gagal memeriksa pembaruan: {error_encountered}"
                return self.get_status()

            tag_name = release_data.get("tag_name", "")
            remote_ver = tag_name.lstrip("vV")
            
            # Cari file installer EXE
            setup_asset = None
            portable_asset = None
            for asset in release_data.get("assets", []):
                aname = asset.get("name", "").lower()
                if aname.endswith(".exe"):
                    if "setup" in aname or not setup_asset:
                        setup_asset = asset
                elif aname.endswith(".zip"):
                    if "portable" in aname or not portable_asset:
                        portable_asset = asset

            parsed_info = {
                "tag_name": tag_name,
                "version": remote_ver,
                "name": release_data.get("name") or tag_name,
                "body": release_data.get("body") or "",
                "html_url": release_data.get("html_url") or f"https://github.com/{self.repo}/releases",
                "published_at": release_data.get("published_at") or "",
                "download_url": setup_asset.get("browser_download_url") if setup_asset else "",
                "download_size": setup_asset.get("size", 0) if setup_asset else 0,
                "portable_url": portable_asset.get("browser_download_url") if portable_asset else "",
            }
            self.latest_release_info = parsed_info

            if is_newer_version(remote_ver, self.current_version):
                self.status = "available"
            else:
                self.status = "up_to_date"

            return self.get_status()

    def start_download(self, custom_url: Optional[str] = None) -> Dict[str, Any]:
        """Memulai pengunduhan file installer di thread terpisah."""
        with self._lock:
            if self.status == "downloading":
                return self.get_status()
            url = custom_url or self.latest_release_info.get("download_url")
            if not url:
                self.status = "error"
                self.error_message = "URL unduhan installer tidak ditemukan."
                return self.get_status()

            self.status = "downloading"
            self.progress = 0
            self.downloaded_bytes = 0
            self.total_bytes = self.latest_release_info.get("download_size", 0)
            self.error_message = None

            dest_dir = os.path.join(tempfile.gettempdir(), f"{self.app_name}_Update")
            os.makedirs(dest_dir, exist_ok=True)
            self.installer_path = os.path.join(dest_dir, f"{self.app_name}_Setup_Update.exe")

        def _worker():
            try:
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": f"{self.app_name}-Updater (Windows NT)"}
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    content_length = resp.headers.get("Content-Length")
                    if content_length:
                        try:
                            self.total_bytes = int(content_length)
                        except Exception:
                            pass

                    downloaded = 0
                    chunk_size = 64 * 1024  # 64 KB per chunk
                    with open(self.installer_path, "wb") as f:
                        while True:
                            chunk = resp.read(chunk_size)
                            if not chunk:
                                break
                            f.write(chunk)
                            downloaded += len(chunk)
                            with self._lock:
                                self.downloaded_bytes = downloaded
                                if self.total_bytes > 0:
                                    self.progress = min(100, int((downloaded / self.total_bytes) * 100))

                with self._lock:
                    self.status = "ready_to_install"
                    self.progress = 100
            except Exception as e:
                with self._lock:
                    self.status = "error"
                    self.error_message = f"Gagal mengunduh installer: {e}"

        self._download_thread = threading.Thread(target=_worker, daemon=True)
        self._download_thread.start()
        return self.get_status()

    def apply_update(self, silent: bool = False, on_shutdown=None) -> Dict[str, Any]:
        """
        Menjalankan file installer hasil unduhan dan menjadwalkan penutupan aplikasi.
        Jika silent=True, Inno Setup dijalankan tanpa interaksi (/VERYSILENT /SUPPRESSMSGBOXES).
        """
        with self._lock:
            if not self.installer_path or not os.path.exists(self.installer_path):
                return {
                    "success": False,
                    "error": "Installer belum diunduh atau file tidak ditemukan."
                }
            self.status = "installing"

        target_exe = self.installer_path
        cmd = [target_exe]
        if silent:
            cmd.extend(["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CLOSEAPPLICATIONS"])

        def _launch():
            time.sleep(1.2)  # Beri waktu respon HTTP 200 terkirim ke klien
            try:
                creationflags = 0
                if sys.platform == "win32":
                    creationflags = 0x00000008  # DETACHED_PROCESS
                subprocess.Popen(cmd, creationflags=creationflags, close_fds=True)
            except Exception as exc:
                print(f"[Updater] Gagal meluncurkan installer: {exc}")
            
            # Panggil callback shutdown server
            if on_shutdown:
                try:
                    on_shutdown()
                except Exception:
                    pass

        t = threading.Thread(target=_launch, daemon=True)
        t.start()

        return {
            "success": True,
            "message": "Installer berhasil diluncurkan. Aplikasi akan diperbarui dan dimulai ulang."
        }

    def start_background_auto_update(self, get_preferences_fn, delay: float = 3.5, on_shutdown=None):
        """
        Memeriksa update di background beberapa detik setelah aplikasi start.
        Jika toggle auto_update bernilai True dan ada rilis baru, langsung unduh installer!
        """
        def _bg_loop():
            time.sleep(delay)
            try:
                prefs = get_preferences_fn()
                # Default toggle auto_update adalah True
                if not prefs.get("auto_update", True):
                    return

                res = self.check_for_updates(force=False)
                if res.get("status") == "available" and res.get("release_info", {}).get("download_url"):
                    # Langsung unduh di background
                    self.start_download()
            except Exception as e:
                # Log kegagalan background tanpa mengganggu aplikasi utama
                print(f"[AutoUpdate] Pengecekan background: {e}")

        t = threading.Thread(target=_bg_loop, daemon=True)
        t.start()
