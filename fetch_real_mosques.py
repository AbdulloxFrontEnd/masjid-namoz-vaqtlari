import urllib.request
import urllib.parse
import json
import ssl

query = """
[out:json][timeout:30];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](41.15,69.10,41.45,69.45);
  way["amenity"="place_of_worship"]["religion"="muslim"](41.15,69.10,41.45,69.45);
  relation["amenity"="place_of_worship"]["religion"="muslim"](41.15,69.10,41.45,69.45);
);
out center;
"""

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

data = urllib.parse.urlencode({'data': query}).encode('utf-8')

endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
]

for url in endpoints:
    print(f"Trying endpoint with urlencoded data: {url}...")
    try:
        req = urllib.request.Request(url, data=data)
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
        with urllib.request.urlopen(req, timeout=30, context=ctx) as response:
            res = json.loads(response.read().decode('utf-8'))
            elements = res.get('elements', [])
            print(f"SUCCESS! Retrieved {len(elements)} mosques!")
            with open('osm_raw_mosques.json', 'w', encoding='utf-8') as f:
                json.dump(elements, f, ensure_ascii=False, indent=2)
            break
    except Exception as e:
        print(f"Failed {url}: {e}")
