import urllib.request
import urllib.parse
import json

bbox = "41.15,69.10,41.45,69.45"
query = f"""
[out:json][timeout:30];
(
  node["amenity"="place_of_worship"]["religion"="muslim"]({bbox});
  way["amenity"="place_of_worship"]["religion"="muslim"]({bbox});
  relation["amenity"="place_of_worship"]["religion"="muslim"]({bbox});
);
out center;
"""

url = "https://overpass.kumi.systems/api/interpreter"
data = urllib.parse.urlencode({'data': query}).encode('utf-8')

try:
    req = urllib.request.Request(url, data=data, headers={'User-Agent': 'MasjidProject/1.0'})
    with urllib.request.urlopen(req, timeout=25) as response:
        res = json.loads(response.read().decode('utf-8'))
        elements = res.get('elements', [])
        print(f"Successfully retrieved {len(elements)} mosques from OSM!")
        with open('tashkent_osm.json', 'w', encoding='utf-8') as f:
            json.dump(elements, f, ensure_ascii=False, indent=2)
except Exception as e:
    print(f"Error fetching from {url}: {e}")
