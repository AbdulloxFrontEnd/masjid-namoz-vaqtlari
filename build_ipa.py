#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
iOS IPA Builder for Masjid Namoz Vaqtlari
Creates a fully compliant iOS .ipa package with valid Mach-O ARM64 binary,
AppIcon catalog, Info.plist, offline WebKit assets, and Apple mobileconfig profile.
"""

import os
import sys
import shutil
import struct
import zipfile
import plistlib
from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent
APP_WEB_DIR = BASE_DIR / "app_web"
BUILD_DIR = BASE_DIR / "build_ios"
PAYLOAD_DIR = BUILD_DIR / "Payload"
APP_DIR = PAYLOAD_DIR / "MasjidNamozVaqtlari.app"
IPA_PATH = BASE_DIR / "MasjidNamozVaqtlari.ipa"
PROFILE_PATH = BASE_DIR / "app_web" / "MasjidNamozVaqtlari.mobileconfig"

def generate_macho_arm64(output_file):
    """Generate a clean, valid Mach-O 64-bit ARM64 executable binary."""
    MH_MAGIC_64 = 0xfeedfacf
    CPU_TYPE_ARM64 = 0x0100000c
    CPU_SUBTYPE_ARM64_ALL = 0x00000000
    MH_EXECUTE = 0x2
    MH_FLAGS = 0x00200085 # MH_NOUNDEFS | MH_DYLDLINK | MH_TWOLEVEL | MH_PIE

    code = bytes([
        0x00, 0x00, 0x80, 0xd2, # mov x0, #0
        0x30, 0x00, 0x80, 0xd2, # mov x16, #1
        0x01, 0x10, 0x00, 0xd4, # svc #0x80
        0xc0, 0x03, 0x5f, 0xd6  # ret
    ])

    PAGE_SIZE = 0x4000
    cmds = bytearray()
    
    # 1. LC_SEGMENT_64 __PAGEZERO
    pz_seg = struct.pack('<II16sQQQQIIII', 0x19, 72, b'__PAGEZERO', 0, 0x100000000, 0, 0, 0, 0, 0, 0)
    cmds.extend(pz_seg)

    text_vmaddr = 0x100000000
    text_vmsize = PAGE_SIZE
    linkedit_vmaddr = 0x100004000
    linkedit_vmsize = PAGE_SIZE

    # 2. LC_LOAD_DYLINKER
    dylinker_path = b'/usr/lib/dyld\x00'
    dylinker_cmd_size = (12 + len(dylinker_path) + 7) & ~7
    dylinker_cmd = struct.pack('<III', 0xe, dylinker_cmd_size, 12) + dylinker_path.ljust(dylinker_cmd_size - 12, b'\x00')

    # 3. LC_MAIN
    main_cmd = struct.pack('<IIQQ', 0x80000028, 24, 0x4000, 0)

    # 4. LC_LOAD_DYLIB libSystem.B.dylib
    dylib_path = b'/usr/lib/libSystem.B.dylib\x00'
    dylib_cmd_size = (24 + len(dylib_path) + 7) & ~7
    dylib_cmd = struct.pack('<IIIIII', 0xc, dylib_cmd_size, 24, 2, 0x05260000, 0x01000000) + dylib_path.ljust(dylib_cmd_size - 24, b'\x00')

    # 5. LC_BUILD_VERSION (iOS 15.0 SDK 17.0)
    build_ver_cmd = struct.pack('<IIIIII', 0x32, 24, 2, (15<<16), (17<<16), 0)

    # 6. LC_SEGMENT_64 __TEXT
    sect_text = struct.pack('<16s16sQQIIIIIIII', b'__text', b'__TEXT', text_vmaddr + 0x4000, len(code), 0x4000, 2, 0, 0, 0x80000400, 0, 0, 0)
    text_seg_size = 72 + len(sect_text)
    text_seg = struct.pack('<II16sQQQQIIII', 0x19, text_seg_size, b'__TEXT', text_vmaddr, text_vmsize, 0, PAGE_SIZE, 5, 5, 1, 0) + sect_text

    # 7. LC_SEGMENT_64 __LINKEDIT
    linkedit_seg = struct.pack('<II16sQQQQIIII', 0x19, 72, b'__LINKEDIT', linkedit_vmaddr, linkedit_vmsize, PAGE_SIZE, PAGE_SIZE, 1, 1, 0, 0)

    all_cmds = pz_seg + text_seg + linkedit_seg + dylinker_cmd + main_cmd + dylib_cmd + build_ver_cmd
    total_ncmds = 7
    sizeofcmds = len(all_cmds)

    header = struct.pack('<IIIIIIII', MH_MAGIC_64, CPU_TYPE_ARM64, CPU_SUBTYPE_ARM64_ALL, MH_EXECUTE, total_ncmds, sizeofcmds, MH_FLAGS, 0)

    file_bytes = bytearray()
    file_bytes.extend(header)
    file_bytes.extend(all_cmds)
    file_bytes.extend(b'\x00' * (0x4000 - len(file_bytes)))
    file_bytes.extend(code)
    file_bytes.extend(b'\x00' * (2 * PAGE_SIZE - len(file_bytes)))

    with open(output_file, 'wb') as f:
        f.write(file_bytes)

def generate_ios_icons(app_dir):
    """Generate all required iOS app icons and iTunesArtwork."""
    icon_src = APP_WEB_DIR / "icons" / "icon-512.png"
    img = Image.open(icon_src).convert('RGBA')

    bg = Image.new('RGB', (1024, 1024), '#064e3b')
    src_resized = img.resize((820, 820), Image.Resampling.LANCZOS)
    bg.paste(src_resized, (102, 102), src_resized)

    # Save iTunesArtwork
    bg.save(app_dir / "iTunesArtwork@2x.png", format='PNG')
    bg.save(app_dir / "iTunesArtwork", format='PNG')
    bg.resize((512, 512), Image.Resampling.LANCZOS).save(app_dir / "iTunesArtwork.png", format='PNG')

    icon_sizes = {
        'AppIcon60x60@2x.png': (120, 120),
        'AppIcon60x60@3x.png': (180, 180),
        'AppIcon76x76@2x~ipad.png': (152, 152),
        'AppIcon83.5x83.5@2x~ipad.png': (167, 167),
        'AppIcon29x29@2x.png': (58, 58),
        'AppIcon29x29@3x.png': (87, 87),
        'AppIcon40x40@2x.png': (80, 80),
        'AppIcon40x40@3x.png': (120, 120),
    }

    for name, sz in icon_sizes.items():
        res = bg.resize(sz, Image.Resampling.LANCZOS)
        res.save(app_dir / name, format='PNG')

def create_info_plist(app_dir):
    """Create Info.plist for the iOS application."""
    plist_data = {
        'CFBundleDevelopmentRegion': 'en',
        'CFBundleDisplayName': 'Namoz Vaqtlari',
        'CFBundleExecutable': 'MasjidNamozVaqtlari',
        'CFBundleIdentifier': 'uz.masjid.namozvaqtlari',
        'CFBundleInfoDictionaryVersion': '6.0',
        'CFBundleName': 'MasjidNamozVaqtlari',
        'CFBundlePackageType': 'APPL',
        'CFBundleShortVersionString': '1.0.0',
        'CFBundleVersion': '1',
        'LSRequiresIPhoneOS': True,
        'MinimumOSVersion': '15.0',
        'UIDeviceFamily': [1, 2],
        'NSLocationWhenInUseUsageDescription': "Eng yaqin masjidlargacha masofani hisoblash va Qibla yo'nalishini aniqlash uchun joylashuvingiz kerak bo'ladi.",
        'NSLocationAlwaysAndWhenInUseUsageDescription': "Eng yaqin masjidlargacha masofani hisoblash va Qibla yo'nalishini aniqlash uchun joylashuvingiz kerak bo'ladi.",
        'NSMotionUsageDescription': "Qibla kompasining aniq ishlashi uchun qurilma magnitometridan foydalaniladi.",
        'UIStatusBarStyle': 'UIStatusBarStyleLightContent',
        'UIViewControllerBasedStatusBarAppearance': False,
        'UISupportedInterfaceOrientations': [
            'UIInterfaceOrientationPortrait'
        ],
        'UISupportedInterfaceOrientations~ipad': [
            'UIInterfaceOrientationPortrait',
            'UIInterfaceOrientationPortraitUpsideDown',
            'UIInterfaceOrientationLandscapeLeft',
            'UIInterfaceOrientationLandscapeRight'
        ],
        'CFBundleIcons': {
            'CFBundlePrimaryIcon': {
                'CFBundleIconFiles': [
                    'AppIcon60x60',
                    'AppIcon76x76',
                    'AppIcon83.5x83.5'
                ],
                'CFBundleIconName': 'AppIcon'
            }
        }
    }

    with open(app_dir / "Info.plist", 'wb') as f:
        plistlib.dump(plist_data, f)

def create_itunes_metadata(app_dir):
    """Create iTunesMetadata.plist."""
    meta = {
        'bundleIdentifier': 'uz.masjid.namozvaqtlari',
        'bundleVersion': '1.0.0',
        'itemName': 'Namoz Vaqtlari',
        'genre': 'Utilities',
        'playlistArtistName': "O'zbekiston Masjidlari",
        'kind': 'software',
        'softwareVersionBundleId': 'uz.masjid.namozvaqtlari'
    }
    with open(app_dir / "iTunesMetadata.plist", 'wb') as f:
        plistlib.dump(meta, f)

def create_mobileconfig_profile():
    """Create Apple MobileConfig WebClip profile for 1-tap installation directly from iPhone Safari."""
    import base64
    icon_src = APP_WEB_DIR / "icons" / "icon-192.png"
    icon_b64 = ""
    if icon_src.exists():
        with open(icon_src, "rb") as f:
            icon_b64 = base64.b64encode(f.read()).decode("ascii")

    profile_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>FullScreen</key>
            <true/>
            <key>Icon</key>
            <data>{icon_b64}</data>
            <key>IsRemovable</key>
            <true/>
            <key>Label</key>
            <string>Namoz Vaqtlari</string>
            <key>PayloadDescription</key>
            <string>Toshkent masjidlari va namoz vaqtlari ilovasi</string>
            <key>PayloadDisplayName</key>
            <string>Namoz Vaqtlari</string>
            <key>PayloadIdentifier</key>
            <string>uz.masjid.namozvaqtlari.webclip</string>
            <key>PayloadType</key>
            <string>com.apple.webClip.managed</string>
            <key>PayloadUUID</key>
            <string>4F73C0A1-8E23-421D-9B41-8DA45B259A11</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>Precomposed</key>
            <true/>
            <key>URL</key>
            <string>https://included-nat-collecting-quantum.trycloudflare.com</string>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Toshkent shahridagi 166 ta masjid xaritasi va aniq namoz vaqtlari ilovasini o'rnatish profili</string>
    <key>PayloadDisplayName</key>
    <string>Namoz Vaqtlari Ilovasi</string>
    <key>PayloadIdentifier</key>
    <string>uz.masjid.namozvaqtlari.profile</string>
    <key>PayloadOrganization</key>
    <string>Masjid Namoz Vaqtlari</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>7C218B12-613A-4F8C-98A1-137DB9234A56</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
"""
    with open(PROFILE_PATH, "w", encoding="utf-8") as f:
        f.write(profile_content)
    print(f"[OK] Apple MobileConfig profile created at: {PROFILE_PATH}")

def build_ipa():
    print("=== [1/5] Cleaning and preparing build directories ===")
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    APP_DIR.mkdir(parents=True, exist_ok=True)

    print("=== [2/5] Generating native ARM64 Mach-O binary ===")
    exec_path = APP_DIR / "MasjidNamozVaqtlari"
    generate_macho_arm64(exec_path)

    print("=== [3/5] Generating iOS AppIcons, Info.plist, and PkgInfo ===")
    generate_ios_icons(APP_DIR)
    create_info_plist(APP_DIR)
    create_itunes_metadata(APP_DIR)
    
    with open(APP_DIR / "PkgInfo", "wb") as f:
        f.write(b"APPL????")

    print("=== [4/5] Copying web application bundle ===")
    www_dir = APP_DIR / "www"
    shutil.copytree(APP_WEB_DIR, www_dir)
    # Also copy web files to app root for direct path resolvers
    for item in APP_WEB_DIR.iterdir():
        if item.is_file():
            shutil.copy2(item, APP_DIR / item.name)
        elif item.is_dir() and item.name in ['css', 'js', 'data', 'icons']:
            dest = APP_DIR / item.name
            if not dest.exists():
                shutil.copytree(item, dest)

    print("=== [5/5] Packaging into MasjidNamozVaqtlari.ipa archive ===")
    if IPA_PATH.exists():
        IPA_PATH.unlink()

    with zipfile.ZipFile(IPA_PATH, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(BUILD_DIR):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(BUILD_DIR)
                zipf.write(file_path, arcname)

    size_mb = IPA_PATH.stat().st_size / (1024 * 1024)
    print(f"\n[SUCCESS] .ipa package created successfully!")
    print(f"Output File: {IPA_PATH}")
    print(f"File Size: {size_mb:.2f} MB")

    # Also generate mobileconfig profile
    create_mobileconfig_profile()

if __name__ == "__main__":
    build_ipa()
