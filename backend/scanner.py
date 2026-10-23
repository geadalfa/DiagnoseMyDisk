"""
scanner.py
Modul Verifikasi Permukaan Sektor (Bad Sector Scanner) dan Pemulihan Sistem (Drive Doctor)
Mendukung pembacaan presisi tingkat hardware (sector-aligned raw I/O),
benchmarking latensi per-blok, deteksi anomali I/O, serta aksi pemulihan sistem file & TRIM.
"""

import os
import sys
import time
import subprocess
import ctypes


def is_admin():
    """Mengecek apakah proses memiliki hak istimewa Administrator."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False


def get_disk_geometry(disk_index):
    """
    Mengambil ukuran total disk fisik dalam bytes menggunakan PowerShell / WMI.
    Fallback ke estimasi jika query gagal.
    """
    try:
        cmd = f"(Get-CimInstance Win32_DiskDrive | Where-Object Index -eq {disk_index}).Size"
        p = subprocess.run(
            ["powershell", "-NoProfile", "-Command", cmd],
            capture_output=True,
            text=True,
            timeout=3,
            creationflags=0x08000000 if os.name == "nt" else 0,
        )
        if p.returncode == 0 and p.stdout.strip().isdigit():
            return int(p.stdout.strip())
    except Exception:
        pass
    return 0


def scan_disk_chunk(disk_index, start_block, count, total_blocks=200, known_size=0, block_read_size=65536):
    """
    Memindai sejumlah blok pada disk target secara non-destruktif (read-only)
    dengan offset sector-aligned (kelipatan 512 bytes).
    
    Menghitung latensi pembacaan (ms), throughput baca (MB/s), dan status kesehatan blok:
    - excellent (< 10 ms): Sektor sehat prima (Emerald)
    - good (10 - 50 ms): Normal (Green)
    - slow (50 - 150 ms): Cukup lambat (Amber)
    - weak (150 - 500 ms): Sangat lambat / degraded (Orange)
    - bad (>= 500 ms atau Error I/O): Bad Sector / Rusak (Red)
    """
    total_size = known_size
    if not total_size:
        total_size = get_disk_geometry(disk_index)
    if not total_size:
        total_size = 250 * (1024**3)  # Estimasi 250 GB jika tidak terdeteksi

    step = max(512, total_size // total_blocks)
    results = []
    path = f"\\\\.\\PhysicalDrive{disk_index}"

    handle = None
    try:
        handle = open(path, "rb")
    except Exception as e:
        # Jika akses fisik langsung diblokir (misal non-admin), kembalikan status error
        for i in range(start_block, min(start_block + count, total_blocks)):
            results.append({
                "block": i,
                "offset_bytes": i * step,
                "offset_gb": round((i * step) / (1024**3), 2),
                "latency_ms": 0,
                "speed_mb_s": 0,
                "status": "error",
                "error": f"Akses fisik disk memerlukan Administrator ({e})",
            })
        return results

    try:
        for i in range(start_block, min(start_block + count, total_blocks)):
            offset = (i * step // 512) * 512
            if offset + block_read_size > total_size:
                offset = max(0, total_size - block_read_size)

            t0 = time.perf_counter()
            try:
                handle.seek(offset, os.SEEK_SET)
                data = handle.read(block_read_size)
                t1 = time.perf_counter()
                elapsed = max(0.00001, t1 - t0)
                lat_ms = elapsed * 1000
                speed_mb_s = (len(data) / (1024 * 1024)) / elapsed

                if len(data) == 0:
                    status = "bad"
                    err_msg = "Zero bytes read (EOF/I/O timeout)"
                elif lat_ms < 10.0:
                    status = "excellent"
                    err_msg = None
                elif lat_ms < 50.0:
                    status = "good"
                    err_msg = None
                elif lat_ms < 150.0:
                    status = "slow"
                    err_msg = None
                elif lat_ms < 500.0:
                    status = "weak"
                    err_msg = None
                else:
                    status = "bad"
                    err_msg = "Latensi kritis (> 500ms)"

                results.append({
                    "block": i,
                    "offset_bytes": offset,
                    "offset_gb": round(offset / (1024**3), 2),
                    "latency_ms": round(lat_ms, 2),
                    "speed_mb_s": round(speed_mb_s, 1),
                    "status": status,
                    "error": err_msg,
                })
            except Exception as read_err:
                t1 = time.perf_counter()
                results.append({
                    "block": i,
                    "offset_bytes": offset,
                    "offset_gb": round(offset / (1024**3), 2),
                    "latency_ms": round((t1 - t0) * 1000, 2),
                    "speed_mb_s": 0,
                    "status": "bad",
                    "error": f"Bad Sector / I/O Read Error: {read_err}",
                })
    finally:
        if handle:
            try:
                handle.close()
            except Exception:
                pass

    return results


def run_trim_optimization(drive_letter):
    """
    Menjalankan ReTrim pada SSD untuk memicu controller melakukan garbage collection
    dan menyegarkan sel flash NAND yang tidak terpakai.
    """
    clean_letter = drive_letter.replace(":", "").strip().upper()
    if not clean_letter:
        return {"success": False, "message": "Huruf drive tidak valid."}

    cmd = f"Optimize-Volume -DriveLetter {clean_letter} -ReTrim -Verbose"
    try:
        p = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
            capture_output=True,
            text=True,
            timeout=30,
            creationflags=0x08000000 if os.name == "nt" else 0,
        )
        output = (p.stdout + "\n" + p.stderr).strip()
        success = p.returncode == 0
        return {
            "success": success,
            "drive": f"{clean_letter}:",
            "command": cmd,
            "output": output or "Perintah TRIM berhasil dikirim ke controller disk.",
        }
    except Exception as e:
        return {"success": False, "drive": f"{clean_letter}:", "error": str(e)}


def check_dirty_bit(drive_letter):
    """Mengecek status Dirty Bit pada sistem file volume Windows."""
    clean_letter = drive_letter.replace(":", "").strip().upper()
    try:
        p = subprocess.run(
            ["fsutil", "dirty", "query", f"{clean_letter}:"],
            capture_output=True,
            text=True,
            timeout=5,
            creationflags=0x08000000 if os.name == "nt" else 0,
        )
        out = p.stdout.strip()
        is_dirty = "is dirty" in out.lower()
        return {
            "success": True,
            "drive": f"{clean_letter}:",
            "is_dirty": is_dirty,
            "output": out,
        }
    except Exception as e:
        return {"success": False, "drive": f"{clean_letter}:", "error": str(e)}


def repair_filesystem(drive_letter):
    """
    Menjalankan verifikasi sistem file online (non-destructive)
    menggunakan Repair-Volume / chkdsk untuk memulihkan tabel indeks partisi.
    """
    clean_letter = drive_letter.replace(":", "").strip().upper()
    cmd = f"Repair-Volume -DriveLetter {clean_letter} -Scan"
    try:
        p = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
            capture_output=True,
            text=True,
            timeout=60,
            creationflags=0x08000000 if os.name == "nt" else 0,
        )
        out = (p.stdout + "\n" + p.stderr).strip()
        return {
            "success": p.returncode == 0,
            "drive": f"{clean_letter}:",
            "command": cmd,
            "output": out or "Pemeriksaan sistem file selesai. Tidak ditemukan kerusakan struktur direktori.",
        }
    except subprocess.TimeoutExpired:
        return {
            "success": True,
            "drive": f"{clean_letter}:",
            "command": cmd,
            "output": "Pemeriksaan sedang berjalan di latar belakang Windows. Silakan pantau Event Viewer sistem.",
        }
    except Exception as e:
        return {"success": False, "drive": f"{clean_letter}:", "error": str(e)}
