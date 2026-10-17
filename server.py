#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Masjidlar & Namoz Vaqtlari - Mahalliy Server va API
Ushbu server ilovani brauzerda hamda Android qurilmalarda ishga tushirish uchun xizmat qiladi.
"""

import os
import sys
import json
import webbrowser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# Windows console encoding fix
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "app_web"
DATA_FILE = BASE_DIR / "masjidlar_data.json"
DEFAULT_DATA_FILE = WEB_DIR / "data" / "masjidlar.json"

def init_data():
    if not DATA_FILE.exists():
        if DEFAULT_DATA_FILE.exists():
            with open(DEFAULT_DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"[INFO] Boshlang'ich ma'lumotlar {DATA_FILE.name} ga nusxalandi.")
        else:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump([], f)

def get_mosques():
    init_data()
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[XATO] Ma'lumotlarni o'qishda xatolik: {e}")
        return []

def save_mosques(data):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        # app_web ichidagi data/masjidlar.json ga ham saqlash
        with open(DEFAULT_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[XATO] Ma'lumotlarni saqlashda xatolik: {e}")
        return False

class MasjidRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def end_headers(self):
        # Brauzer va telefonlarda keshda eski fayl qolib ketmasligi uchun no-cache yuborish
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self):
        if self.path.startswith('/api/masjidlar'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            data = get_mosques()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
            return

        # iOS .ipa faylini yuklab olish
        if self.path == '/MasjidNamozVaqtlari.ipa' or self.path.endswith('.ipa'):
            ipa_file = BASE_DIR / "MasjidNamozVaqtlari.ipa"
            if ipa_file.exists():
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', 'attachment; filename="MasjidNamozVaqtlari.ipa"')
                self.send_header('Content-Length', str(ipa_file.stat().st_size))
                self.end_headers()
                import shutil
                with open(ipa_file, 'rb') as f:
                    shutil.copyfileobj(f, self.wfile)
                return

        # iOS Apple MobileConfig profilini yuklab olish
        if self.path.endswith('.mobileconfig'):
            cfg_file = WEB_DIR / "MasjidNamozVaqtlari.mobileconfig"
            if cfg_file.exists():
                self.send_response(200)
                self.send_header('Content-Type', 'application/x-apple-aspen-config')
                self.send_header('Content-Disposition', 'attachment; filename="MasjidNamozVaqtlari.mobileconfig"')
                self.send_header('Content-Length', str(cfg_file.stat().st_size))
                self.end_headers()
                import shutil
                with open(cfg_file, 'rb') as f:
                    shutil.copyfileobj(f, self.wfile)
                return

        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/masjidlar':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                payload = json.loads(body)
                if isinstance(payload, list):
                    save_mosques(payload)
                elif isinstance(payload, dict):
                    mosques = get_mosques()
                    mosques.append(payload)
                    save_mosques(mosques)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": "Saqlandi"}).encode('utf-8'))
                return
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
                return
        self.send_response(404)
        self.end_headers()

    def do_PUT(self):
        if self.path.startswith('/api/masjidlar/') and self.path.endswith('/vaqtlar'):
            parts = self.path.split('/')
            mosque_id = parts[3]
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                update_data = json.loads(body)
                mosques = get_mosques()
                found = False
                for m in mosques:
                    if m.get('id') == mosque_id:
                        if 'vaqtlar' in update_data:
                            m['vaqtlar'] = update_data['vaqtlar']
                        if 'sana' in update_data:
                            m['sana'] = update_data['sana']
                        if 'juma' in update_data:
                            m['juma'] = update_data['juma']
                        if 'izoh' in update_data:
                            m['izoh'] = update_data['izoh']
                        found = True
                        break

                if found:
                    save_mosques(mosques)
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "success", "message": "Namoz vaqtlari yangilandi"}).encode('utf-8'))
                else:
                    self.send_response(404)
                    self.end_headers()
                return
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
                return

        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run_server(port=8080, open_browser=True):
    init_data()
    server_address = ('', port)
    
    try:
        httpd = ThreadingHTTPServer(server_address, MasjidRequestHandler)
    except OSError:
        port = 8081
        server_address = ('', port)
        httpd = ThreadingHTTPServer(server_address, MasjidRequestHandler)

    url = f"http://localhost:{port}"
    print("=" * 60)
    print("  [MASJID] MASJIDLAR VA NAMOZ VAQTLARI ILOVASI ISHGA TUSHDI")
    print(f"  [WEB] URL manzili: {url}")
    print(f"  [ANDROID] Android brauzerida yoki emulyatorda ochishingiz mumkin")
    print("=" * 60)

    if open_browser:
        webbrowser.open(url)

    while True:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[INFO] Server to'xtatildi.")
            httpd.server_close()
            break
        except Exception as e:
            print(f"[OGOHLANTIRISH] So'rov xatosi, server davom etmoqda: {e}")

if __name__ == '__main__':
    port = 8080
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port=port, open_browser=True)
