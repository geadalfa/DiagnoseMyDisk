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
import hashlib
import tempfile
import threading
import subprocess
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple

GITHUB_REPO = "geadalfa/DiagnoseMyDisk"
CACHE_TTL_SECONDS = 900  # 15 menit cache pengecekan update
MAX_INSTALLER_BYTES = 150 * 1024 * 1024  # Batas maksimum 150 MB demi keamanan


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
        self.hash_verified: bool = False
        self.expected_hash: Optional[str] = None
        self.downloaded_hash: Optional[str] = None

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
                "hash_verified": self.hash_verified,
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
            
            # Cari file installer EXE dan checksum
            setup_asset = None
            portable_asset = None
            checksum_asset = None
            for asset in release_data.get("assets", []):
                aname = asset.get("name", "").lower()
                if aname.endswith(".exe"):
                    if "setup" in aname or not setup_asset:
                        setup_asset = asset
                elif aname.endswith(".zip"):
                    if "portable" in aname or not portable_asset:
                        portable_asset = asset
                elif "sha256" in aname or aname.endswith(".txt"):
                    checksum_asset = asset

            parsed_info = {
                "tag_name": tag_name,
                "version": remote_ver,
                "name": release_data.get("name") or tag_name,
                "body": release_data.get("body") or "",
                "html_url": release_data.get("html_url") or f"https://github.com/{self.repo}/releases",
                "published_at": release_data.get("published_at") or "",
                "download_url": setup_asset.get("browser_download_url") if setup_asset else "",
                "download_size": setup_asset.get("size", 0) if setup_asset else 0,
                "setup_filename": setup_asset.get("name") if setup_asset else "",
                "portable_url": portable_asset.get("browser_download_url") if portable_asset else "",
                "checksum_url": checksum_asset.get("browser_download_url") if checksum_asset else "",
            }
            self.latest_release_info = parsed_info

            if is_newer_version(remote_ver, self.current_version):
                self.status = "available"
            else:
                self.status = "up_to_date"

            return self.get_status()

    def start_download(self, custom_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Memulai pengunduhan file installer di thread terpisah.
        Demi keamanan integritas, URL kiriman eksternal diabaikan dan wajib
        menggunakan URL aset rilis resmi GitHub via HTTPS dengan verifikasi SHA-256.
        """
        with self._lock:
            if self.status == "downloading":
                return self.get_status()
            
            # Wajib memakai download_url aset resmi dari release info
            url = self.latest_release_info.get("download_url")
            if not url:
                self.status = "error"
                self.error_message = "URL unduhan installer resmi tidak ditemukan."
                return self.get_status()

            if not url.startswith("https://"):
                self.status = "error"
                self.error_message = "URL unduhan installer wajib menggunakan HTTPS demi keamanan."
                return self.get_status()

            download_size = self.latest_release_info.get("download_size", 0)
            if download_size > MAX_INSTALLER_BYTES:
                self.status = "error"
                self.error_message = f"Ukuran installer ({download_size:,} byte) melebihi batas aman 150 MB."
                return self.get_status()

            self.status = "downloading"
            self.progress = 0
            self.downloaded_bytes = 0
            self.total_bytes = download_size
            self.error_message = None
            self.hash_verified = False
            self.expected_hash = None
            self.downloaded_hash = None

            dest_dir = os.path.join(tempfile.gettempdir(), f"{self.app_name}_Update")
            os.makedirs(dest_dir, exist_ok=True)
            self.installer_path = os.path.join(dest_dir, f"{self.app_name}_Setup_Update.exe")

        def _worker():
            try:
                # 1. Ambil berkas SHA256SUMS.txt jika tersedia
                checksum_url = self.latest_release_info.get("checksum_url")
                expected_sha256 = None
                setup_filename = self.latest_release_info.get("setup_filename", "")

                if checksum_url and checksum_url.startswith("https://"):
                    try:
                        chk_req = urllib.request.Request(
                            checksum_url,
                            headers={"User-Agent": f"{self.app_name}-Updater/{self.current_version} (Windows NT)"}
                        )
                        with urllib.request.urlopen(chk_req, timeout=15) as chk_resp:
                            sums_content = chk_resp.read().decode("utf-8", errors="ignore")
                            for line in sums_content.splitlines():
                                parts = line.strip().split()
                                if len(parts) >= 2:
                                    h, fn = parts[0], parts[1].lstrip("*")
                                    if setup_filename and fn.lower() == setup_filename.lower():
                                        expected_sha256 = h.lower()
                                        break
                                    elif fn.lower().endswith(".exe") and "setup" in fn.lower():
                                        expected_sha256 = h.lower()
                    except Exception as chk_err:
                        print(f"[Updater] Gagal mengunduh SHA256SUMS.txt: {chk_err}")

                if not expected_sha256:
                    with self._lock:
                        self.status = "error"
                        self.hash_verified = False
                        self.error_message = "Metadata rilis tidak lengkap: berkas SHA256SUMS.txt atau entri hash installer tidak ditemukan."
                    return

                # 2. Unduh biner installer dengan stream hashing
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": f"{self.app_name}-Updater/{self.current_version} (Windows NT)"}
                )
                hasher = hashlib.sha256()
                with urllib.request.urlopen(req, timeout=30) as resp:
                    content_length = resp.headers.get("Content-Length")
                    if content_length:
                        try:
                            clen = int(content_length)
                            if clen > MAX_INSTALLER_BYTES:
                                raise ValueError(f"Ukuran konten ({clen:,} byte) melebihi batas 150 MB.")
                            self.total_bytes = clen
                        except Exception as e:
                            if "150 MB" in str(e):
                                raise

                    downloaded = 0
                    chunk_size = 64 * 1024  # 64 KB per chunk
                    with open(self.installer_path, "wb") as f:
                        while True:
                            chunk = resp.read(chunk_size)
                            if not chunk:
                                break
                            downloaded += len(chunk)
                            if downloaded > MAX_INSTALLER_BYTES:
                                raise ValueError("Ukuran unduhan melebihi batas maksimum 150 MB.")
                            hasher.update(chunk)
                            f.write(chunk)
                            with self._lock:
                                self.downloaded_bytes = downloaded
                                if self.total_bytes > 0:
                                    self.progress = min(100, int((downloaded / self.total_bytes) * 100))

                computed_hash = hasher.hexdigest().lower()

                # 3. Verifikasi SHA-256
                if computed_hash != expected_sha256.lower():
                    if os.path.exists(self.installer_path):
                        try:
                            os.remove(self.installer_path)
                        except Exception:
                            pass
                    with self._lock:
                        self.status = "error"
                        self.hash_verified = False
                        self.error_message = f"Integritas installer gagal: hash SHA-256 tidak cocok (diharapkan {expected_sha256}, didapat {computed_hash})."
                    return

                with self._lock:
                    self.hash_verified = True
                    self.expected_hash = expected_sha256
                    self.downloaded_hash = computed_hash
                    self.status = "ready_to_install"
                    self.progress = 100

            except Exception as e:
                if self.installer_path and os.path.exists(self.installer_path):
                    try:
                        os.remove(self.installer_path)
                    except Exception:
                        pass
                with self._lock:
                    self.status = "error"
                    self.hash_verified = False
                    self.error_message = f"Gagal mengunduh installer: {e}"

        self._download_thread = threading.Thread(target=_worker, daemon=True)
        self._download_thread.start()
        return self.get_status()

    def apply_update(self, silent: bool = False, on_shutdown=None) -> Dict[str, Any]:
        """
        Menjalankan file installer hasil unduhan setelah verifikasi hash selesai.
        Jika silent=True, Inno Setup dijalankan tanpa interaksi (/VERYSILENT /SUPPRESSMSGBOXES).
        """
        with self._lock:
            if not self.installer_path or not os.path.exists(self.installer_path):
                return {
                    "success": False,
                    "error": "Installer belum diunduh atau file tidak ditemukan."
                }
            if not self.hash_verified:
                return {
                    "success": False,
                    "error": "Installer belum diverifikasi integritas SHA-256-nya."
                }

            # Re-verifikasi hash sebelum eksekusi (anti-tamper)
            try:
                hasher = hashlib.sha256()
                with open(self.installer_path, "rb") as f:
                    for chunk in iter(lambda: f.read(1024 * 1024), b""):
                        hasher.update(chunk)
                current_hash = hasher.hexdigest().lower()
                if self.downloaded_hash and current_hash != self.downloaded_hash.lower():
                    return {
                        "success": False,
                        "error": "File installer di disk telah dimodifikasi atau rusak."
                    }
            except Exception as exc:
                return {
                    "success": False,
                    "error": f"Gagal memverifikasi file installer di disk: {exc}"
                }

            self.status = "installing"

        target_exe = self.installer_path
        cmd = [target_exe]
        if silent:
            cmd.extend(["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CLOSEAPPLICATIONS"])

        try:
            creationflags = 0
            if sys.platform == "win32":
                creationflags = 0x00000008  # DETACHED_PROCESS
            subprocess.Popen(cmd, creationflags=creationflags, close_fds=True)

            if on_shutdown:
                def _delay_shutdown():
                    time.sleep(1.0)
                    try:
                        on_shutdown()
                    except Exception:
                        pass
                threading.Thread(target=_delay_shutdown, daemon=True).start()

            return {
                "success": True,
                "message": "Installer berhasil diluncurkan. Aplikasi akan diperbarui dan dimulai ulang."
            }
        except Exception as exc:
            with self._lock:
                self.status = "error"
                self.error_message = f"Gagal meluncurkan installer: {exc}"
            return {
                "success": False,
                "error": f"Gagal meluncurkan installer: {exc}"
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
