#!/usr/bin/env python3
"""
release.py
Local project shortcut runner for DiagnoseMyDisk GitHub Release Pipeline.
Cukup jalankan:
  python release.py
atau:
  python release.py 1.4.2
"""

import os
import sys
from pathlib import Path

GLOBAL_RELEASE_SCRIPT = r"C:\Users\Alfa\.gemini\scripts\github_app_release.py"

def main():
    if sys.platform == "darwin":
        import subprocess
        project_root = Path(__file__).parent.resolve()
        macos_dir = project_root / "macos"
        build_script = macos_dir / "scripts" / "build-dmg.sh"
        if build_script.exists():
            print("==> Launching macOS DMG Release Build Pipeline...")
            subprocess.run(["bash", str(build_script), str(macos_dir), "DiagnoseMyDisk"], check=True)
            # Copy to releases folder
            releases_dir = project_root / "releases"
            releases_dir.mkdir(exist_ok=True)
            dmg_src = macos_dir / "build" / "DiagnoseMyDisk.dmg"
            if dmg_src.exists():
                import shutil
                shutil.copy2(dmg_src, releases_dir / "DiagnoseMyDisk.dmg")
                print(f"✅ DMG mirrored to: {releases_dir / 'DiagnoseMyDisk.dmg'}")
            return
        else:
            print(f"Error: macos build script not found at {build_script}")
            sys.exit(1)

    if not os.path.exists(GLOBAL_RELEASE_SCRIPT):
        print(f"Error: Pipeline script tidak ditemukan di {GLOBAL_RELEASE_SCRIPT}")
        sys.exit(1)

    version_arg = f"--version {sys.argv[1]}" if len(sys.argv) > 1 else ""
    cmd = f'python "{GLOBAL_RELEASE_SCRIPT}" --dir "{Path(__file__).parent.resolve()}" {version_arg}'
    os.system(cmd)

if __name__ == '__main__':
    main()
