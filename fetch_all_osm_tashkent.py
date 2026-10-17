import urllib.request
import json
import sys

# Avoid cp1251 print crash
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

query = """[out:json][timeout:60];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](41.16,69.12,41.44,69.42);
  way["amenity"="place_of_worship"]["religion"="muslim"](41.16,69.12,41.44,69.42);
  relation["amenity"="place_of_worship"]["religion"="muslim"](41.16,69.12,41.44,69.42);
);
out center tags;
"""

endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
]

found = False
for ep in endpoints:
    try:
        print(f"Trying endpoint: {ep}")
        req = urllib.request.Request(
            ep,
            data=query.encode('utf-8'),
            headers={'User-Agent': 'TashkentMasjidFinder/3.0 (https://masjid.uz)'}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            elements = data.get('elements', [])
            print(f"SUCCESS with {ep}! Found {len(elements)} mosques!")
            if len(elements) > 0:
                with open('osm_tashkent_all.json', 'w', encoding='utf-8') as f:
                    json.dump(elements, f, ensure_ascii=False, indent=2)
                found = True
                break
    except Exception as e:
        print(f"Failed {ep}: {e}")

if not found:
    print("Could not fetch from endpoints.")
