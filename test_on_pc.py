#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Masjidlar & Namoz Vaqtlari - Kompyuterda Test Qilish Dasturi (PC Test Runner)
Ushbu skript ilovani kompyuter ekranida xuddi Android smartfon kabi oynada ishga tushiradi!
"""

import os
import sys
import time
import subprocess
import threading
from pathlib import Path

# Windows konsol kodirovkasi xatosini oldini olish
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent

def find_browser():
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    ]
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    for p in chrome_paths:
        if os.path.exists(p):
            return p, "chrome"
    for p in edge_paths:
        if os.path.exists(p):
            return p, "edge"
    return None, None

def launch_mobile_window(url, browser_path, browser_type):
    time.sleep(1.2)
    # Smartfon o'lchami: 420x860 piksel, alohida mustaqil ilova oynasi sifatida ochiladi
    temp_profile = os.path.expandvars(r"%TEMP%\masjid_phone_preview")
    cmd = [
        browser_path,
        f"--app={url}",
        "--window-size=420,860",
        f"--user-data-dir={temp_profile}",
        "--new-window"
    ]
    try:
        subprocess.Popen(cmd)
        print(f"[TEST] Ilova smartfon o'lchamidagi oynada muvaffaqiyatli ochildi ({browser_type})!")
    except Exception as e:
        print(f"[OGOHLANTIRISH] Smartfon rejimida ochilmadi, oddiy brauzerda ochilmoqda: {e}")
        import webbrowser
        webbrowser.open(url)

def main():
    print("=" * 65)
    print("   [MASJID] TEST QILISH: ANDROID SMARTFON KO'RINISHI")
    print("=" * 65)

    from server import run_server, init_data
    init_data()

    browser_path, browser_type = find_browser()
    url = "http://localhost:8080"

    if browser_path:
        print(f"[1] Smartfon oynasi tayyorlanmoqda ({browser_type})...")
        t = threading.Thread(target=launch_mobile_window, args=(url, browser_path, browser_type), daemon=True)
        t.start()
        # Serverni ishga tushirish (open_browser=False, chunki o'zimiz ochamiz)
        run_server(port=8080, open_browser=False)
    else:
        print("[1] Standart brauzerda ochilmoqda...")
        run_server(port=8080, open_browser=True)

if __name__ == '__main__':
    main()
