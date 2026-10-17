import urllib.request
import urllib.parse
import json
import time

mosques = [
    ('Minor masjidi', 'Minor masjidi, Tashkent'),
    ('Hazrati Imom', 'Hazrati Imom, Tashkent'),
    ('Shayx Zayniddin', 'Koʻkcha masjidi, Tashkent'),
    ('Novza masjidi', 'Novza masjidi, Tashkent'),
    ('Islom ota', 'Islom ota masjidi, Tashkent'),
    ('Shayx Muhammad Sodiq', 'Muhammad Sodiq Muhammad Yusuf, Tashkent'),
    ('Suzuk ota', 'Suzuk ota, Tashkent'),
    ('Xoʻja Ahror Valiy', 'Xoʻja Ahror Valiy, Tashkent'),
    ('Bodomzor', 'Bodomzor masjidi, Tashkent'),
    ('Mirza Yusuf', 'Mirza Yusuf masjidi, Tashkent'),
    ('Rakat masjidi', 'Rakat masjidi, Tashkent'),
    ('Oltintepa', 'Oltintepa masjidi, Tashkent'),
    ('Toʻxtaboy', 'Toʻxtaboy masjidi, Tashkent'),
    ('Choʻpon ota', 'Choʻpon ota masjidi, Tashkent'),
    ('Beshqayragʻoch', 'Beshqayragʻoch masjidi, Tashkent'),
    ('Abu Saxiy', 'Abu Saxiy masjidi, Tashkent'),
    ('Qoʻylik ota', 'Qoʻylik ota masjidi, Tashkent')
]

results = {}
for short_name, query in mosques:
    try:
        url = 'https://nominatim.openstreetmap.org/search?q=' + urllib.parse.quote(query) + '&format=json&limit=1'
        req = urllib.request.Request(url, headers={'User-Agent': 'TashkentMasjidPrecise/1.0'})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data:
                lat = float(data[0]['lat'])
                lon = float(data[0]['lon'])
                results[short_name] = (lat, lon)
                print(f"[FOUND] {short_name}: {lat:.6f}, {lon:.6f}")
            else:
                print(f"[NOT FOUND] {short_name}")
        time.sleep(1)
    except Exception as e:
        print(f"[ERROR] {short_name}: {e}")

with open('exact_osm_coords.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)
