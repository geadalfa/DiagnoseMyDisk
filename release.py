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
    if not os.path.exists(GLOBAL_RELEASE_SCRIPT):
        print(f"Error: Pipeline script tidak ditemukan di {GLOBAL_RELEASE_SCRIPT}")
        sys.exit(1)

    version_arg = f"--version {sys.argv[1]}" if len(sys.argv) > 1 else ""
    cmd = f'python "{GLOBAL_RELEASE_SCRIPT}" --dir "{Path(__file__).parent.resolve()}" {version_arg}'
    os.system(cmd)

if __name__ == '__main__':
    main()
