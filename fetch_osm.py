import urllib.request
import urllib.parse
import json

query = """
[out:json][timeout:30];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](41.15,69.10,41.45,69.45);
  way["amenity"="place_of_worship"]["religion"="muslim"](41.15,69.10,41.45,69.45);
);
out center;
"""

endpoints = [
    'https://overpass.openstreetmap.ru/cgi/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter'
]

for ep in endpoints:
    try:
        data = urllib.parse.urlencode({'data': query}).encode('utf-8')
        req = urllib.request.Request(ep, data=data, headers={'User-Agent': 'TashkentMasjidFinder/1.0'})
        with urllib.request.urlopen(req, timeout=20) as r:
            res = json.loads(r.read().decode('utf-8'))
            elements = res.get('elements', [])
            print(f"{ep} -> SUCCESS! Found {len(elements)} mosques")
            if elements:
                with open('osm_tashkent_raw.json', 'w', encoding='utf-8') as f:
                    json.dump(elements, f, ensure_ascii=False, indent=2)
                break
    except Exception as e:
        print(f"{ep} failed: {e}")
