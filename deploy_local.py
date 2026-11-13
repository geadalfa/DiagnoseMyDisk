#!/usr/bin/env python3
"""Test, build, and reinstall DiagnoseMyDisk into the local user profile."""

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SPEC_FILE = ROOT / "DiagnoseMyDisk.spec"
INSTALLER_SCRIPT = ROOT / "installer.iss"
DIST_APP = ROOT / "dist" / "DiagnoseMyDisk"
SETUP_EXE = ROOT / "installer_output" / "DiagnoseMyDisk_Setup.exe"
INSTALL_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "Programs" / "DiagnoseMyDisk"
INSTALLED_EXE = INSTALL_DIR / "DiagnoseMyDisk.exe"
LOG_FILE = ROOT / "deploy_local.log"


def log(message):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    print(line, flush=True)
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def run(command, timeout=900):
    log("$ " + subprocess.list2cmdline([str(part) for part in command]))
    result = subprocess.run([str(part) for part in command], cwd=str(ROOT), timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {result.returncode}")
    return result


def find_iscc():
    candidates = [shutil.which("iscc"), shutil.which("ISCC")]
    for base in (
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Inno Setup 6",
        Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Inno Setup 6",
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Inno Setup 6",
    ):
        candidates.append(base / "ISCC.exe")
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    return None


def stop_running_app():
    result = subprocess.run(
        ["tasklist", "/FI", "IMAGENAME eq DiagnoseMyDisk.exe", "/NH"],
        capture_output=True,
        text=True,
    )
    if "DiagnoseMyDisk.exe" not in (result.stdout or ""):
        return
    log("Stopping running DiagnoseMyDisk instance...")
    subprocess.run(["taskkill", "/IM", "DiagnoseMyDisk.exe", "/T"], capture_output=True)
    for _ in range(10):
        time.sleep(1)
        check = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq DiagnoseMyDisk.exe", "/NH"],
            capture_output=True,
            text=True,
        )
        if "DiagnoseMyDisk.exe" not in (check.stdout or ""):
            return
    subprocess.run(["taskkill", "/F", "/IM", "DiagnoseMyDisk.exe", "/T"], capture_output=True)


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def install_with_setup():
    stop_running_app()
    install_log = ROOT / "installer_output" / "install.log"
    run(
        [
            SETUP_EXE,
            "/VERYSILENT",
            "/SUPPRESSMSGBOXES",
            "/NORESTART",
            "/CLOSEAPPLICATIONS",
            "/SP-",
            f"/DIR={INSTALL_DIR}",
            f"/LOG={install_log}",
        ],
        timeout=300,
    )


def install_by_copy():
    stop_running_app()
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    ignore = shutil.ignore_patterns("*.log", "*.pyc", "__pycache__")
    for item in DIST_APP.iterdir():
        destination = INSTALL_DIR / item.name
        if item.is_dir():
            shutil.copytree(item, destination, dirs_exist_ok=True, ignore=ignore)
        else:
            shutil.copy2(item, destination)


def verify_install():
    if not INSTALLED_EXE.is_file():
        raise RuntimeError(f"Installed executable missing: {INSTALLED_EXE}")
    built_hash = sha256(DIST_APP / "DiagnoseMyDisk.exe")
    installed_hash = sha256(INSTALLED_EXE)
    if built_hash != installed_hash:
        raise RuntimeError("Installed executable does not match the fresh build hash")
    log(f"Verified installed build: {INSTALLED_EXE}")


def main():
    parser = argparse.ArgumentParser(description="Rebuild and reinstall DiagnoseMyDisk locally.")
    parser.add_argument("--skip-tests", action="store_true", help="Skip the unittest suite before building.")
    parser.add_argument("--skip-install", action="store_true", help="Build without touching the installed app.")
    parser.add_argument("--launch", action="store_true", help="Launch the installed app after deployment.")
    args = parser.parse_args()

    log("Local deploy started.")
    if not args.skip_tests:
        run([sys.executable, "-m", "unittest", "discover", "-s", "tests"], timeout=600)

    run([sys.executable, "-m", "PyInstaller", "--noconfirm", SPEC_FILE], timeout=900)
    if not (DIST_APP / "DiagnoseMyDisk.exe").is_file():
        raise RuntimeError("PyInstaller did not produce dist/DiagnoseMyDisk/DiagnoseMyDisk.exe")

    if not args.skip_install:
        iscc = find_iscc()
        if iscc:
            run([iscc, INSTALLER_SCRIPT], timeout=300)
            install_with_setup()
        else:
            log("Inno Setup not found; falling back to a direct file copy.")
            install_by_copy()
        verify_install()

    if args.launch and not args.skip_install:
        subprocess.Popen([str(INSTALLED_EXE)], cwd=str(INSTALL_DIR))
        log("Launched installed app.")

    log("Local deploy finished.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        log(f"Deploy failed: {error}")
        raise SystemExit(1)
