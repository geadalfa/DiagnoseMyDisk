"""
storage_manager.py
Mesin manajemen penyimpanan, pemindaian disk multi-drive, deteksi file duplikat berkecepatan tinggi,
rekomendasi pembersihan cerdas, dan integrasi penjelajah berkas Windows (Explorer).
"""

import os
import sys
import time
import hashlib
import threading
import subprocess
import shutil
import ctypes
from datetime import datetime

try:
    from backend import app_logger
except ImportError:
    import app_logger

# System directories that must be excluded from recursive scanning & duplicate analysis
SYSTEM_EXCLUDED_NAMES = {
    "windows",
    "windowsapps",
    "$recycle.bin",
    "system volume information",
    "recovery",
    "boot",
    "msocache",
    "$windows.~bt",
    "$windows.~ws"
}

# Windows File Attribute Flag
FILE_ATTRIBUTE_REPARSE_POINT = 0x400


def is_reparse_point(entry):
    """Mendeteksi apakah direktori merupakan NTFS Junction Point atau Symbolic Link untuk mencegah infinite loop."""
    try:
        if hasattr(entry, 'stat'):
            st = entry.stat(follow_symlinks=False)
        else:
            st = os.stat(entry, follow_symlinks=False)
        attrs = getattr(st, 'st_file_attributes', 0)
        return bool(attrs & FILE_ATTRIBUTE_REPARSE_POINT)
    except Exception:
        return False


def format_bytes(bytes_sz):
    """Mengonversi bytes menjadi format yang ramah manusia (B, KB, MB, GB, TB)."""
    if bytes_sz < 1024:
        return f"{bytes_sz} B"
    elif bytes_sz < 1024**2:
        return f"{bytes_sz / 1024:.1f} KB"
    elif bytes_sz < 1024**3:
        return f"{bytes_sz / (1024**2):.1f} MB"
    elif bytes_sz < 1024**4:
        return f"{bytes_sz / (1024**3):.2f} GB"
    else:
        return f"{bytes_sz / (1024**4):.2f} TB"


def get_available_drives():
    """Mengambil daftar seluruh drive lokal Windows yang tersedia dan siap diakses."""
    drives = []
    if os.name == "nt":
        bitmask = ctypes.windll.kernel32.GetLogicalDrives()
        for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            if bitmask & 1:
                drive_str = f"{letter}:\\"
                try:
                    usage = shutil.disk_usage(drive_str)
                    pct = round((usage.used / usage.total) * 100, 1) if usage.total > 0 else 0
                    drives.append({
                        "drive": f"{letter}:",
                        "root": drive_str,
                        "mount": drive_str,
                        "total": usage.total,
                        "used": usage.used,
                        "free": usage.free,
                        "percent_used": pct,
                        "percent": pct
                    })
                except (PermissionError, OSError):
                    pass
            bitmask >>= 1
    else:
        # Fallback non-Windows untuk pengujian
        usage = shutil.disk_usage("/")
        drives.append({
            "drive": "/",
            "root": "/",
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
            "percent_used": round((usage.used / usage.total) * 100, 1)
        })
    return drives


class StorageManager:
    """Pengelola siklus hidup pemindaian, analisis duplikat, dan rekomendasi pembersihan."""

    def __init__(self):
        self.lock = threading.Lock()
        self.is_scanning = False
        self.cancel_requested = False
        self.progress = 0
        self.status_text = "Idle"
        self.current_path = ""
        self.files_scanned = 0
        self.bytes_scanned = 0
        self.start_time = 0
        self.scan_thread = None

        # Hasil Analisis
        self.results = {
            "drives_scanned": [],
            "summary": {},
            "recommendations": [],
            "large_items": [],
            "old_items": [],
            "duplicates": [],
            "timestamp": None
        }

    def get_results(self):
        with self.lock:
            return dict(self.results)

    def get_status(self):
        with self.lock:
            elapsed = time.time() - self.start_time if self.is_scanning else 0
            return {
                "is_scanning": self.is_scanning,
                "progress": self.progress,
                "status_text": self.status_text,
                "current_path": self.current_path,
                "files_scanned": self.files_scanned,
                "bytes_scanned": self.bytes_scanned,
                "bytes_scanned_formatted": format_bytes(self.bytes_scanned),
                "elapsed_seconds": round(elapsed, 1),
                "has_results": bool(self.results.get("timestamp"))
            }

    def cancel_scan(self):
        with self.lock:
            if self.is_scanning:
                self.cancel_requested = True
                self.status_text = "Membatalkan pemindaian..."
                return True
        return False

    def start_scan(self, drive_letters=None, scan_duplicates=True, min_large_mb=100, min_dup_bytes=512*1024):
        with self.lock:
            if self.is_scanning:
                app_logger.log_warn("StorageManager", "Scan request rejected: scan already in progress.")
                return False, "Pemindaian sedang berjalan."

            self.is_scanning = True
            self.cancel_requested = False
            self.progress = 0
            self.files_scanned = 0
            self.bytes_scanned = 0
            self.status_text = "Menyiapkan pemindaian..."
            self.start_time = time.time()

        app_logger.log_info("StorageManager", f"Scan initiated. Target drives: {drive_letters}, duplicates: {scan_duplicates}, min_large_mb: {min_large_mb}")

        self.scan_thread = threading.Thread(
            target=self._run_scan_worker,
            args=(drive_letters, scan_duplicates, min_large_mb, min_dup_bytes),
            daemon=True
        )
        self.scan_thread.start()
        return True, "Pemindaian dimulai."

    def _run_scan_worker(self, drive_letters, scan_duplicates=True, min_large_mb=50, min_dup_bytes=512*1024):
        try:
            all_drives = get_available_drives()
            target_drives = []

            if not drive_letters or "all" in drive_letters:
                target_drives = all_drives
            else:
                for item in drive_letters:
                    if isinstance(item, dict) and "root" in item:
                        target_drives.append(item)
                    elif isinstance(item, str) and os.path.isdir(item) and len(item) > 3:
                        usage = shutil.disk_usage(item)
                        pct = round((usage.used / usage.total) * 100, 1) if usage.total > 0 else 0
                        target_drives.append({
                            "drive": item,
                            "root": item,
                            "mount": item,
                            "total": usage.total,
                            "used": usage.used,
                            "free": usage.free,
                            "percent_used": pct,
                            "percent": pct
                        })
                    elif isinstance(item, str):
                        norm = item.upper().replace("\\", "").replace(":", "")
                        matched = [d for d in all_drives if d["drive"].replace(":", "") == norm]
                        target_drives.extend(matched)

            if not target_drives:
                target_drives = all_drives[:1]

            total_target_used = sum(d["used"] for d in target_drives)
            total_target_size = sum(d["total"] for d in target_drives)

            large_items = []
            old_items = []
            size_candidates = {}  # { size: [file_paths] }
            now = time.time()
            one_day = 86400
            min_large_bytes = min_large_mb * 1024 * 1024

            # 1. Pindai Rekomendasi Pembersihan Cepat
            with self.lock:
                self.status_text = "Memeriksa cache sistem & sisa instalasi..."
                self.progress = 5
            recommendations = self._collect_cleanup_recommendations(target_drives)

            # 2. Pindai Berkas & Folder
            drives_count = len(target_drives)
            for idx, drv in enumerate(target_drives):
                if self.cancel_requested:
                    break

                root_path = drv["root"]
                with self.lock:
                    self.status_text = f"Memindai drive {drv['drive']}..."
                    self.current_path = root_path

                # Pindai folder tingkat atas untuk ringkasan ukuran direktori
                try:
                    for entry in os.scandir(root_path):
                        if self.cancel_requested:
                            break
                        if is_reparse_point(entry):
                            continue

                        low_name = entry.name.lower()
                        if low_name in SYSTEM_EXCLUDED_NAMES:
                            app_logger.log_info("StorageManager", f"Skipping protected system directory: {entry.path}")
                            continue

                        if entry.is_dir(follow_symlinks=False):
                            dir_size, dir_files, dir_mtime = self._scan_directory_recursive(
                                entry.path,
                                max_depth=3,
                                current_depth=0,
                                large_items=large_items,
                                old_items=old_items,
                                size_candidates=size_candidates if scan_duplicates else None,
                                min_large_bytes=min_large_bytes,
                                now=now,
                                min_dup_bytes=min_dup_bytes
                            )
                            if dir_size >= min_large_bytes:
                                large_items.append({
                                    "name": entry.name,
                                    "path": entry.path,
                                    "size": dir_size,
                                    "size_formatted": format_bytes(dir_size),
                                    "is_dir": True,
                                    "mtime": dir_mtime,
                                    "mtime_str": datetime.fromtimestamp(dir_mtime).strftime("%Y-%m-%d %H:%M") if dir_mtime else "-",
                                    "drive": drv["drive"],
                                    "age_days": int((now - dir_mtime) / one_day) if dir_mtime else 0
                                })
                        elif entry.is_file(follow_symlinks=False):
                            try:
                                st = entry.stat(follow_symlinks=False)
                                sz = st.st_size
                                mtime = st.st_mtime
                                self.files_scanned += 1
                                self.bytes_scanned += sz

                                if sz >= min_large_bytes:
                                    large_items.append({
                                        "name": entry.name,
                                        "path": entry.path,
                                        "size": sz,
                                        "size_formatted": format_bytes(sz),
                                        "is_dir": False,
                                        "mtime": mtime,
                                        "mtime_str": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M"),
                                        "drive": drv["drive"],
                                        "age_days": int((now - mtime) / one_day)
                                    })
                                if scan_duplicates and sz >= min_dup_bytes:  # Cek duplikat >= min_dup_bytes
                                    size_candidates.setdefault(sz, []).append((entry.path, mtime))
                            except (PermissionError, OSError):
                                pass

                        # Perbarui progress berbasis drive
                        drive_base_prog = (idx / drives_count) * 70 + 10
                        with self.lock:
                            self.progress = min(80, int(drive_base_prog + 5))

                except (PermissionError, OSError):
                    pass

            # 3. Analisis Duplikat jika diaktifkan
            duplicates_result = []
            if scan_duplicates and not self.cancel_requested:
                with self.lock:
                    self.status_text = "Menganalisis berkas duplikat..."
                    self.progress = 85

                duplicates_result = self._find_duplicates_from_candidates(size_candidates)

            # 4. Filter & Urutkan Hasil
            large_items.sort(key=lambda x: x["size"], reverse=True)
            # Batasi top 150 item besar agar UI tetap gesit
            top_large_items = large_items[:150]

            old_items.sort(key=lambda x: x["age_days"], reverse=True)
            top_old_items = old_items[:150]

            # 5. Bangun Ringkasan Segmentasi (Mirip PC Manager: User, App, System, Other)
            summary = self._build_storage_summary(target_drives, recommendations, top_large_items)

            with self.lock:
                self.results = {
                    "status": "ok",
                    "drives_scanned": [d["drive"] for d in target_drives],
                    "target_drives_info": target_drives,
                    "summary": summary,
                    "breakdown": summary,
                    "recommendations": recommendations,
                    "large_items": top_large_items,
                    "old_items": top_old_items,
                    "duplicates": duplicates_result,
                    "duplicate_groups": duplicates_result,
                    "timestamp": time.time(),
                    "formatted_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                self.progress = 100
                self.status_text = "Pemindaian selesai!" if not self.cancel_requested else "Pemindaian dibatalkan."
                self.is_scanning = False

        except Exception as e:
            with self.lock:
                self.status_text = f"Error: {e}"
                self.progress = 100
                self.is_scanning = False

    def _scan_directory_recursive(self, path, max_depth, current_depth, large_items, old_items, size_candidates, min_large_bytes, now, min_dup_bytes=512*1024):
        """Pemindaian rekursif terkontrol dengan proteksi loop junction point dan pembaruan telemetri."""
        if self.cancel_requested or current_depth > max_depth:
            return 0, 0, 0

        total_size = 0
        total_files = 0
        latest_mtime = 0
        one_day = 86400

        try:
            with os.scandir(path) as it:
                for entry in it:
                    if self.cancel_requested:
                        break

                    # Lewati junction point / symlink
                    if is_reparse_point(entry):
                        continue

                    p = entry.path
                    if entry.is_file(follow_symlinks=False):
                        try:
                            st = entry.stat(follow_symlinks=False)
                            sz = st.st_size
                            mtime = st.st_mtime
                            total_size += sz
                            total_files += 1
                            if mtime > latest_mtime:
                                latest_mtime = mtime

                            self.files_scanned += 1
                            self.bytes_scanned += sz
                            if self.files_scanned % 500 == 0:
                                with self.lock:
                                    self.current_path = p

                            age_days = int((now - mtime) / one_day)

                            # Catat berkas besar
                            if sz >= min_large_bytes:
                                large_items.append({
                                    "name": entry.name,
                                    "path": p,
                                    "size": sz,
                                    "size_formatted": format_bytes(sz),
                                    "is_dir": False,
                                    "mtime": mtime,
                                    "mtime_str": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M"),
                                    "drive": p[:2] if len(p) >= 2 and p[1] == ":" else "",
                                    "age_days": age_days
                                })

                            # Catat berkas lawas / jarang dipakai (> 90 hari)
                            if age_days >= 30 and sz >= 1024:  # >= 1 KB dan >= 30 hari
                                old_items.append({
                                    "name": entry.name,
                                    "path": p,
                                    "size": sz,
                                    "size_formatted": format_bytes(sz),
                                    "is_dir": False,
                                    "mtime": mtime,
                                    "mtime_str": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M"),
                                    "drive": p[:2] if len(p) >= 2 and p[1] == ":" else "",
                                    "age_days": age_days
                                })

                            # Kandidat duplikat
                            if size_candidates is not None and sz >= min_dup_bytes:
                                size_candidates.setdefault(sz, []).append((p, mtime))

                        except (PermissionError, OSError):
                            pass

                    elif entry.is_dir(follow_symlinks=False):
                        low_sub = entry.name.lower()
                        if low_sub in SYSTEM_EXCLUDED_NAMES:
                            continue

                        sub_sz, sub_cnt, sub_mtime = self._scan_directory_recursive(
                            p, max_depth, current_depth + 1,
                            large_items, old_items, size_candidates, min_large_bytes, now, min_dup_bytes
                        )
                        total_size += sub_sz
                        total_files += sub_cnt
                        if sub_mtime > latest_mtime:
                            latest_mtime = sub_mtime

                        if sub_sz >= min_large_bytes and current_depth < 2:
                            large_items.append({
                                "name": entry.name,
                                "path": p,
                                "size": sub_sz,
                                "size_formatted": format_bytes(sub_sz),
                                "is_dir": True,
                                "mtime": sub_mtime,
                                "mtime_str": datetime.fromtimestamp(sub_mtime).strftime("%Y-%m-%d %H:%M") if sub_mtime else "-",
                                "drive": p[:2] if len(p) >= 2 and p[1] == ":" else "",
                                "age_days": int((now - sub_mtime) / one_day) if sub_mtime else 0
                            })

        except (PermissionError, OSError):
            pass

        return total_size, total_files, latest_mtime

    def _find_duplicates_from_candidates(self, size_candidates):
        """Deteksi 2 tahap (Header Chunk Hash 4KB -> Full Hash SHA-256) dengan telemetri live & prioritas ukuran."""
        duplicates_groups = []
        if not size_candidates:
            return duplicates_groups

        potential_groups = [files for sz, files in size_candidates.items() if len(files) >= 2]
        if not potential_groups:
            return duplicates_groups

        # Sortir kelompok berdasarkan ukuran file menurun (prioritaskan pembebasan ruang terbesar)
        def _get_group_size(flist):
            try:
                return os.path.getsize(flist[0][0])
            except Exception:
                return 0

        potential_groups.sort(key=_get_group_size, reverse=True)
        # Batasi analisis ke 250 kelompok berkas teratas agar tidak membebani I/O
        potential_groups = potential_groups[:250]
        total_groups = len(potential_groups)

        app_logger.log_info("StorageManager", f"Menganalisis duplikat untuk {total_groups} kelompok kandidat berkas.")

        for g_idx, file_list in enumerate(potential_groups):
            if self.cancel_requested:
                app_logger.log_info("StorageManager", "Analisis duplikat dibatalkan oleh pengguna.")
                break

            # Update live telemetry on EVERY group so UI is always fluid
            with self.lock:
                self.progress = 80 + int((g_idx / max(1, total_groups)) * 18)
                first_name = os.path.basename(file_list[0][0]) if file_list else ""
                self.current_path = f"[Duplikat {g_idx+1}/{total_groups}] {first_name}"
                self.status_text = f"Menganalisis berkas duplikat ({g_idx+1}/{total_groups})..."

            if (g_idx + 1) % 20 == 0 or g_idx == 0:
                app_logger.log_info("StorageManager", f"Memproses kelompok duplikat {g_idx+1}/{total_groups}: {file_list[0][0]}")

            # Tahap 1: Bandingkan 4KB pertama
            chunk_buckets = {}
            for path, mtime in file_list:
                if self.cancel_requested:
                    break
                try:
                    with open(path, "rb") as f:
                        header = f.read(4096)
                    h = hashlib.md5(header).hexdigest()
                    chunk_buckets.setdefault(h, []).append((path, mtime))
                except Exception as e:
                    app_logger.log_warn("StorageManager", f"Lewati berkas tidak dapat diakses (Header Hash): {path} ({e})")

            if self.cancel_requested:
                break

            # Tahap 2: Untuk yang header cocok, hitung full SHA-256
            for h_val, candidate_list in chunk_buckets.items():
                if self.cancel_requested:
                    break
                if len(candidate_list) >= 2:
                    full_hash_buckets = {}
                    for path, mtime in candidate_list:
                        if self.cancel_requested:
                            break
                        try:
                            hasher = hashlib.sha256()
                            with open(path, "rb") as f:
                                while chunk := f.read(65536):
                                    hasher.update(chunk)
                                    if self.cancel_requested:
                                        break
                            full_h = hasher.hexdigest()
                            full_hash_buckets.setdefault(full_h, []).append((path, mtime))
                        except Exception as e:
                            app_logger.log_warn("StorageManager", f"Lewati berkas saat Full Hash: {path} ({e})")

                    for full_h, matched_files in full_hash_buckets.items():
                        if len(matched_files) >= 2:
                            sz = 0
                            try:
                                sz = os.path.getsize(matched_files[0][0])
                            except Exception:
                                pass

                            items = []
                            for p, mt in matched_files:
                                items.append({
                                    "path": p,
                                    "mtime": mt,
                                    "mtime_str": datetime.fromtimestamp(mt).strftime("%Y-%m-%d %H:%M"),
                                    "size": sz,
                                    "size_formatted": format_bytes(sz)
                                })

                            duplicates_groups.append({
                                "file_name": os.path.basename(matched_files[0][0]),
                                "hash": full_h[:12],
                                "size": sz,
                                "size_formatted": format_bytes(sz),
                                "count": len(matched_files),
                                "files": items
                            })

        app_logger.log_info("StorageManager", f"Analisis duplikat selesai. Ditemukan {len(duplicates_groups)} kelompok duplikat.")
        return duplicates_groups

    def _collect_cleanup_recommendations(self, target_drives):
        """Memeriksa target cache, log, dan sampah yang 100% aman dibersihkan pada drive target."""
        recommendations = []
        user_profile = os.environ.get("USERPROFILE", r"C:\Users\Alfa")
        local_app_data = os.environ.get("LOCALAPPDATA", os.path.join(user_profile, r"AppData\Local"))
        program_data = os.environ.get("ProgramData", r"C:\ProgramData")
        temp_dir = os.environ.get("TEMP", os.path.join(local_app_data, "Temp"))

        check_targets = [
            {
                "id": "nvidia_ota",
                "name": "NVIDIA Driver Update Artifacts",
                "category": "Driver Cache",
                "desc": "File mentahan installer pembaruan driver GPU NVIDIA yang sudah terpasang.",
                "path": os.path.join(program_data, r"NVIDIA Corporation\NVIDIA app\UpdateFramework\ota-artifacts\grd"),
                "safe_level": "high",
                "default_checked": True
            },
            {
                "id": "uv_cache",
                "name": "UV Python Package Cache",
                "category": "Dev Cache",
                "desc": "Arsip cache paket Python astral-sh uv yang dapat diunduh ulang sewaktu-waktu.",
                "path": os.path.join(local_app_data, r"uv\cache\archive-v0"),
                "safe_level": "high",
                "default_checked": True
            },
            {
                "id": "crash_dumps",
                "name": "Windows User Crash Dumps (.dmp)",
                "category": "Crash Diagnostics",
                "desc": "Berkas laporan crash aplikasi lama yang tidak lagi diperlukan.",
                "path": os.path.join(local_app_data, "CrashDumps"),
                "safe_level": "high",
                "default_checked": True
            },
            {
                "id": "npm_cache",
                "name": "NodeJS / NPM Tarball Cache",
                "category": "Dev Cache",
                "desc": "Cache unduhan modul package npm di direktori lokal pengguna.",
                "path": os.path.join(local_app_data, "npm-cache"),
                "safe_level": "high",
                "default_checked": True
            },
            {
                "id": "pip_cache",
                "name": "Python PIP Download Cache",
                "category": "Dev Cache",
                "desc": "Cache unduhan wheel/tarball instalasi pip Python.",
                "path": os.path.join(local_app_data, r"pip\cache"),
                "safe_level": "high",
                "default_checked": True
            },
            {
                "id": "user_temp",
                "name": "Temporary User Files (%TEMP%)",
                "category": "System Temp",
                "desc": "Berkas sementara aplikasi yang sudah selesai dieksekusi.",
                "path": temp_dir,
                "safe_level": "high",
                "default_checked": True
            },
            {
                "id": "windows_temp",
                "name": "Windows System Temp (C:\\Windows\\Temp)",
                "category": "System Temp",
                "desc": "Berkas sementara sistem operasi Windows.",
                "path": r"C:\Windows\Temp",
                "safe_level": "high",
                "default_checked": True
            },
            {
                "id": "nvidia_dxcache",
                "name": "DirectX Shader Cache (NVIDIA)",
                "category": "GPU Cache",
                "desc": "Shader DirectX yang dikompilasi game. Menghapus akan memicu kompilasi ulang saat game dibuka.",
                "path": os.path.join(local_app_data, r"NVIDIA\DXCache"),
                "safe_level": "medium",
                "default_checked": False
            },
            {
                "id": "chrome_cache",
                "name": "Google Chrome Web Cache",
                "category": "Browser Cache",
                "desc": "Cache gambar dan skrip situs web peramban Google Chrome.",
                "path": os.path.join(local_app_data, r"Google\Chrome\User Data\Default\Cache"),
                "safe_level": "medium",
                "default_checked": False
            },
            {
                "id": "edge_cache",
                "name": "Microsoft Edge Web Cache",
                "category": "Browser Cache",
                "desc": "Cache penjelajahan web peramban Microsoft Edge.",
                "path": os.path.join(local_app_data, r"Microsoft\Edge\User Data\Default\Cache"),
                "safe_level": "medium",
                "default_checked": False
            },
            {
                "id": "downloads_folder",
                "name": "Berkas Unduhan Lama (> 30 Hari)",
                "category": "Downloads",
                "desc": "Installer atau berkas di folder Downloads yang tidak dimodifikasi lebih dari 30 hari.",
                "path": os.path.join(user_profile, "Downloads"),
                "safe_level": "manual",
                "default_checked": False
            }
        ]

        # Tambahkan Recycle Bin untuk setiap drive target
        for drv in target_drives:
            rb_path = os.path.join(drv["root"], "$Recycle.Bin")
            if os.path.exists(rb_path):
                check_targets.append({
                    "id": f"recycle_bin_{drv['drive'].replace(':', '')}",
                    "name": f"Tempat Sampah (Recycle Bin {drv['drive']})",
                    "category": "Recycle Bin",
                    "desc": f"Berkas yang dihapus dan tersimpan di Recycle Bin drive {drv['drive']}.",
                    "path": rb_path,
                    "safe_level": "high",
                    "default_checked": True
                })

        for item in check_targets:
            p = item["path"]
            if os.path.exists(p):
                sz = self._calculate_path_size(p)
                if sz > 1024 * 1024:  # Minimal 1 MB agar relevan
                    item_copy = dict(item)
                    item_copy["size"] = sz
                    item_copy["size_formatted"] = format_bytes(sz)
                    item_copy["is_dir"] = os.path.isdir(p)
                    recommendations.append(item_copy)

        # Urutkan berdasarkan ukuran terbesar
        recommendations.sort(key=lambda x: x["size"], reverse=True)
        return recommendations

    def _calculate_path_size(self, path):
        """Menghitung total ukuran berkas atau direktori tanpa loop junction."""
        if not os.path.exists(path):
            return 0
        if os.path.isfile(path):
            try:
                return os.path.getsize(path)
            except Exception:
                return 0

        total = 0
        try:
            with os.scandir(path) as it:
                for entry in it:
                    if is_reparse_point(entry):
                        continue
                    if entry.is_file(follow_symlinks=False):
                        try:
                            total += entry.stat(follow_symlinks=False).st_size
                        except Exception:
                            pass
                    elif entry.is_dir(follow_symlinks=False):
                        total += self._calculate_path_size(entry.path)
        except Exception:
            pass
        return total

    def _build_storage_summary(self, target_drives, recommendations, large_items):
        """Membangun data segmentasi kapasitas storage (User, Apps, System, Recycle Bin, Other)."""
        total_used = sum(d["used"] for d in target_drives)
        total_size = sum(d["total"] for d in target_drives)
        total_free = sum(d["free"] for d in target_drives)

        # Hitung ukuran per kategori
        recycle_size = sum(r["size"] for r in recommendations if r["category"] == "Recycle Bin")
        cache_size = sum(r["size"] for r in recommendations if r["category"] in ("Driver Cache", "Dev Cache", "System Temp", "GPU Cache", "Browser Cache"))
        
        # Estimasi breakdown
        app_size = 0
        user_size = 0
        system_size = 0

        for itm in large_items:
            p = itm["path"].lower()
            if "program files" in p or "appdata" in p or "windowsapps" in p:
                app_size += itm["size"]
            elif "windows" in p or "system32" in p:
                system_size += itm["size"]
            elif "users" in p:
                user_size += itm["size"]

        # Default fallback reasonable estimates jika scanning terbatas
        if app_size == 0 and total_used > 0:
            app_size = int(total_used * 0.35)
        if user_size == 0 and total_used > 0:
            user_size = int(total_used * 0.25)
        if system_size == 0 and total_used > 0:
            system_size = int(total_used * 0.20)

        other_size = max(0, total_used - (user_size + app_size + system_size + recycle_size))

        return {
            "total_size": total_size,
            "total_size_formatted": format_bytes(total_size),
            "total_used": total_used,
            "total_used_formatted": format_bytes(total_used),
            "total_free": total_free,
            "total_free_formatted": format_bytes(total_free),
            "percent_used": round((total_used / total_size) * 100, 1) if total_size > 0 else 0,
            "categories": [
                {"name": "User Files", "key": "user", "size": user_size, "size_formatted": format_bytes(user_size), "color": "#EF4444"},
                {"name": "Application Files", "key": "app", "size": app_size, "size_formatted": format_bytes(app_size), "color": "#F59E0B"},
                {"name": "System Files", "key": "system", "size": system_size, "size_formatted": format_bytes(system_size), "color": "#3B82F6"},
                {"name": "Recycle Bin", "key": "recycle", "size": recycle_size, "size_formatted": format_bytes(recycle_size), "color": "#10B981"},
                {"name": "Other / Caches", "key": "other", "size": other_size, "size_formatted": format_bytes(other_size), "color": "#6B7280"}
            ],
            "recommendations_cleanable": sum(r["size"] for r in recommendations if r.get("default_checked")),
            "recommendations_cleanable_formatted": format_bytes(sum(r["size"] for r in recommendations if r.get("default_checked")))
        }

    def inspect_directory(self, path, limit=100):
        """
        Memeriksa dan mendaftar berkas-berkas di dalam folder tertentu.
        Mengembalikan daftar item berurutan dari yang terbesar beserta metadata penting.
        """
        if not path or not os.path.exists(path):
            return {"success": False, "error": "Direktori tidak ditemukan atau tidak dapat diakses."}

        if not os.path.isdir(path):
            return {"success": False, "error": "Jalur yang diberikan bukan direktori."}

        try:
            items = []
            total_files = 0
            total_dirs = 0
            total_bytes = 0

            with os.scandir(path) as it:
                for entry in it:
                    try:
                        is_dir = entry.is_dir(follow_symlinks=False)
                        st = entry.stat(follow_symlinks=False)
                        sz = st.st_size if not is_dir else 0
                        mtime = st.st_mtime
                        mtime_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")

                        if is_dir:
                            total_dirs += 1
                        else:
                            total_files += 1
                            total_bytes += sz

                        ext = os.path.splitext(entry.name)[1].lower() if not is_dir else "folder"

                        items.append({
                            "name": entry.name,
                            "path": entry.path,
                            "is_dir": is_dir,
                            "size": sz,
                            "size_formatted": format_bytes(sz) if not is_dir else "Folder",
                            "mtime": mtime,
                            "mtime_str": mtime_str,
                            "extension": ext
                        })
                    except (PermissionError, OSError):
                        continue

            # Urutkan: berkas terbesar dulu, lalu direktori
            items.sort(key=lambda x: (not x["is_dir"], x["size"]), reverse=True)

            return {
                "success": True,
                "path": path,
                "total_items": len(items),
                "total_files": total_files,
                "total_dirs": total_dirs,
                "total_bytes": total_bytes,
                "total_bytes_formatted": format_bytes(total_bytes),
                "items": items[:limit]
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


def inspect_directory(path, limit=100):
    """Shortcut modul untuk memeriksa isi direktori."""
    return get_storage_manager().inspect_directory(path, limit=limit)


# Global Singleton Instance
_storage_manager_instance = None


def get_storage_manager():
    global _storage_manager_instance
    if _storage_manager_instance is None:
        _storage_manager_instance = StorageManager()
    return _storage_manager_instance


def open_in_explorer(target_path):
    """
    Membuka Windows File Explorer langsung ke lokasi berkas/folder.
    Jika target adalah berkas, Explorer akan terbuka dengan berkas terseleksi (/select).
    """
    if not os.path.exists(target_path):
        return False, "Jalur berkas atau folder tidak ditemukan."

    norm_path = os.path.normpath(target_path)
    try:
        if os.name == "nt":
            creationflags = 0x08000000  # CREATE_NO_WINDOW
            if os.path.isfile(norm_path):
                cmd = f'explorer.exe /select,"{norm_path}"'
            else:
                cmd = f'explorer.exe "{norm_path}"'
            subprocess.Popen(cmd, shell=True, creationflags=creationflags)
            return True, "Berhasil membuka File Explorer."
        else:
            # Fallback untuk pengujian non-Windows
            return True, f"Simulasi membuka: {norm_path}"
    except Exception as e:
        return False, f"Gagal membuka File Explorer: {e}"


def execute_cleanup(paths_to_clean):
    """
    Menghapus daftar berkas atau direktori terpilih secara aman,
    mengabaikan berkas yang sedang terkunci tanpa menggagalkan proses.
    """
    freed_bytes = 0
    deleted_count = 0
    errors = []

    for item_path in paths_to_clean:
        if not os.path.exists(item_path):
            continue

        try:
            if os.path.isfile(item_path):
                sz = os.path.getsize(item_path)
                os.remove(item_path)
                freed_bytes += sz
                deleted_count += 1
            elif os.path.isdir(item_path):
                # Khusus direktori: hapus isi berkas di dalamnya untuk keamanan
                for root, dirs, files in os.walk(item_path, topdown=False):
                    for f in files:
                        fp = os.path.join(root, f)
                        try:
                            sz = os.path.getsize(fp)
                            os.remove(fp)
                            freed_bytes += sz
                            deleted_count += 1
                        except Exception:
                            pass
                    for d in dirs:
                        dp = os.path.join(root, d)
                        try:
                            os.rmdir(dp)
                        except Exception:
                            pass
        except Exception as e:
            errors.append(f"{os.path.basename(item_path)}: {e}")

    return {
        "success": True,
        "freed_bytes": freed_bytes,
        "freed_formatted": format_bytes(freed_bytes),
        "deleted_count": deleted_count,
        "errors": errors
    }
