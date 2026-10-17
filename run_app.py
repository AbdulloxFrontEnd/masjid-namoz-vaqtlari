#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Masjidlar & Namoz Vaqtlari - 1-Click Ishga Tushiruvchi
"""

import sys
import subprocess
import webbrowser
import time
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent

def check_adb_devices():
    adb_paths = [
        r"D:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe",
        "adb"
    ]
    for p in adb_paths:
        try:
            res = subprocess.run([p, "devices"], capture_output=True, text=True, timeout=2)
            lines = [l.strip() for l in res.stdout.splitlines() if l.strip() and not l.startswith("*") and not l.startswith("List of")]
            if lines:
                print(f"[ANDROID] Ulangan Android qurilmalar: {lines}")
                return p
        except Exception:
            continue
    return None

def main():
    print("=" * 65)
    print("       [MASJID] MASJIDLAR VA NAMOZ VAQTLARI ILOVASI")
    print("=" * 65)
    print("[1] Server ishga tushirilmoqda...")

    from server import run_server
    run_server(port=8080, open_browser=True)

if __name__ == '__main__':
    main()
