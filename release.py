#!/usr/bin/env python3
"""
release.py
Local project shortcut runner for DiagnoseMyDisk GitHub Release Pipeline (Windows & macOS).
Cukup jalankan:
  python release.py
atau:
  python release.py 0.3.5.0
"""

import os
import sys
import json
import subprocess
from pathlib import Path

GLOBAL_RELEASE_SCRIPT = r"C:\Users\Alfa\.gemini\scripts\github_app_release.py"

def upload_to_github_release(dmg_path):
    import urllib.request
    import urllib.parse
    
    cfg_paths = [
        Path.home() / ".gemini" / "config" / "mcp_config.json",
        Path.home() / "config" / "mcp_config.json"
    ]
    token = None
    for cp in cfg_paths:
        if cp.exists():
            try:
                with open(cp, "r", encoding="utf-8") as f:
                    data = json.load(f)
                token = data.get("mcpServers", {}).get("github", {}).get("env", {}).get("GITHUB_PERSONAL_ACCESS_TOKEN")
                if token:
                    break
            except Exception:
                pass
                
    if not token:
        print("ℹ️ Note: No GitHub token found in mcp_config.json, skipping auto-upload.")
        return

    repo = "geadalfa/DiagnoseMyDisk"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "DiagnoseMyDisk-Pipeline"
    }

    try:
        print(f"==> Uploading {dmg_path.name} to GitHub Releases ({repo})...")
        req = urllib.request.Request(f"https://api.github.com/repos/{repo}/releases/latest", headers=headers)
        with urllib.request.urlopen(req) as resp:
            rel = json.loads(resp.read().decode("utf-8"))
        
        upload_base = rel["upload_url"].split("{")[0]
        existing = {a["name"]: a["id"] for a in rel.get("assets", [])}
        
        if dmg_path.name in existing:
            del_req = urllib.request.Request(f"https://api.github.com/repos/{repo}/releases/assets/{existing[dmg_path.name]}", headers=headers, method="DELETE")
            try:
                with urllib.request.urlopen(del_req):
                    pass
            except Exception:
                pass
                
        size = dmg_path.stat().st_size
        u_url = f"{upload_base}?name={urllib.parse.quote(dmg_path.name)}"
        u_headers = {
            "Authorization": f"token {token}",
            "Content-Type": "application/x-apple-diskimage",
            "Content-Length": str(size),
            "User-Agent": "DiagnoseMyDisk-Pipeline"
        }
        with open(dmg_path, "rb") as f:
            u_req = urllib.request.Request(u_url, data=f.read(), headers=u_headers, method="POST")
            with urllib.request.urlopen(u_req) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                print(f"🎉 DMG successfully live on GitHub Release: {res.get('browser_download_url')}")
    except Exception as e:
        print(f"⚠️ Notice: GitHub release upload encountered: {e}")

def main():
    if sys.platform == "darwin":
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
                dest = releases_dir / "DiagnoseMyDisk.dmg"
                shutil.copy2(dmg_src, dest)
                print(f"✅ DMG mirrored to: {dest}")
                upload_to_github_release(dest)
            return
        else:
            print(f"Error: macos build script not found at {build_script}")
            sys.exit(1)

    # Windows release path
    if not os.path.exists(GLOBAL_RELEASE_SCRIPT):
        print(f"Error: Pipeline script tidak ditemukan di {GLOBAL_RELEASE_SCRIPT}")
        sys.exit(1)

    version_arg = f"--version {sys.argv[1]}" if len(sys.argv) > 1 else ""
    cmd = f'python "{GLOBAL_RELEASE_SCRIPT}" --dir "{Path(__file__).parent.resolve()}" {version_arg}'
    os.system(cmd)

if __name__ == '__main__':
    main()
