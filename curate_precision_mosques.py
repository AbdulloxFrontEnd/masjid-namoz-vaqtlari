import json
import math
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('osm_raw_mosques.json', 'r', encoding='utf-8') as f:
    raw_items = json.load(f)

# Priority known landmark coordinates (verified from Yandex / Wikipedia / official data)
LANDMARK_COORDS = {
    "Minor": {"lat": 41.335278, "lng": 69.275000, "tuman": "Yunusobod tumani", "nomi": "Minor (Oq masjid) jome masjidi", "manzil": "Kichik halqa yo'li, Anhor bo'yi"},
    "Hazrati Imom": {"lat": 41.337467, "lng": 69.241261, "tuman": "Olmazor tumani", "nomi": "Hazrati Imom (Xasti Imom) jome masjidi", "manzil": "Qorasaroy ko'chasi, Zarqaynar berk"},
    "Shayx Zayniddin": {"lat": 41.322864, "lng": 69.204661, "tuman": "Shayxontohur tumani", "nomi": "Shayx Zayniddin (Ko'kcha) jome masjidi", "manzil": "Mannon Uyg'ur ko'chasi, 376"},
    "Xo'ja Ahror Valiy": {"lat": 41.323728, "lng": 69.237144, "tuman": "Shayxontohur tumani", "nomi": "Xo'ja Ahror Valiy (Juma) jome masjidi", "manzil": "Chorsu maydoni, Samarqand darvoza"},
    "Islom Ota": {"lat": 41.276703, "lng": 69.308625, "tuman": "Yashnobod tumani", "nomi": "Islom Ota jome masjidi", "manzil": "Farg'ona yo'li ko'chasi, 51-uy"},
    "Shayx Muhammad Sodiq": {"lat": 41.259283, "lng": 69.186444, "tuman": "Chilonzor tumani", "nomi": "Shayx Muhammad Sodiq Muhammad Yusuf jome masjidi", "manzil": "So'galli ota ko'chasi"},
    "Novza": {"lat": 41.293961, "lng": 69.226893, "tuman": "Chilonzor tumani", "nomi": "Novza jome masjidi", "manzil": "Muqimiy ko'chasi, Novza metro yaqinida"},
    "Suzuk Ota": {"lat": 41.317918, "lng": 69.224337, "tuman": "Shayxontohur tumani", "nomi": "Suzuk Ota jome masjidi", "manzil": "Suzuk ota mahallasi, Ustozlar ko'chasi"},
    "Mirzo Yusuf": {"lat": 41.339758, "lng": 69.292245, "tuman": "Yunusobod tumani", "nomi": "Mirzo Yusuf (Sobir Rahimov) jome masjidi", "manzil": "Bog'ishamol ko'chasi"},
    "Imom at-Termiziy": {"lat": 41.337589, "lng": 69.252092, "tuman": "Olmazor tumani", "nomi": "Imom at-Termiziy jome masjidi", "manzil": "Sebzor dahasi, Qahramon ko'chasi"},
    "Rakat": {"lat": 41.289993, "lng": 69.245794, "tuman": "Yakkasaroy tumani", "nomi": "Rakat jome masjidi", "manzil": "Rakatboshi ko'chasi"},
    "Al-Badr": {"lat": 41.269265, "lng": 69.291978, "tuman": "Mirobod tumani", "nomi": "Al-Badr jome masjidi", "manzil": "Mirobod ko'chasi"},
    "Beshqayrag'och": {"lat": 41.308168, "lng": 69.166036, "tuman": "Uchtepa tumani", "nomi": "Beshqayrag'och jome masjidi", "manzil": "Quruvchi 7-o'tish ko'chasi"},
    "Tinchlik": {"lat": 41.264723, "lng": 69.173877, "tuman": "Chilonzor tumani", "nomi": "Tinchlik jome masjidi", "manzil": "Tinchlik mahallasi"}
}

cyr_to_lat = {
    'А': 'A', 'а': 'a', 'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v', 'Г': 'G', 'г': 'g',
    'Д': 'D', 'д': 'd', 'Е': 'E', 'е': 'e', 'Ё': 'Yo', 'ё': 'yo', 'Ж': 'J', 'ж': 'j',
    'З': 'Z', 'з': 'z', 'И': 'I', 'и': 'i', 'Й': 'Y', 'й': 'y', 'К': 'K', 'к': 'k',
    'Л': 'L', 'л': 'l', 'М': 'M', 'м': 'm', 'Н': 'N', 'н': 'n', 'О': 'O', 'о': 'o',
    'П': 'P', 'п': 'p', 'Р': 'R', 'р': 'r', 'С': 'S', 'с': 's', 'Т': 'T', 'т': 't',
    'У': 'U', 'у': 'u', 'Ф': 'F', 'ф': 'f', 'Х': 'X', 'х': 'x', 'Ц': 'Ts', 'ц': 'ts',
    'Ч': 'Ch', 'ч': 'ch', 'Ш': 'Sh', 'ш': 'sh', 'Щ': 'Sh', 'щ': 'sh', 'Ъ': "'", 'ъ': "'",
    'Ы': 'I', 'ы': 'i', 'Ь': "", 'ь': "", 'Э': 'E', 'э': 'e', 'Ю': 'Yu', 'ю': 'yu',
    'Я': 'Ya', 'я': 'ya', 'Ў': "O'", 'ў': "o'", 'Қ': 'Q', 'қ': 'q', 'Ғ': "G'", 'ғ': "g'",
    'Ҳ': 'H', 'ҳ': 'h'
}

def to_latin(text):
    if not text:
        return ""
    res = []
    for c in text:
        res.append(cyr_to_lat.get(c, c))
    return "".join(res)

def dist_m(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def assign_district(lat, lon, tags):
    sub = tags.get('addr:suburb', '') or tags.get('addr:district', '')
    if 'Olmazor' in sub or 'Алмазар' in sub: return 'Olmazor tumani'
    if 'Yunusobod' in sub or 'Юнусабад' in sub: return 'Yunusobod tumani'
    if 'Shayxontohur' in sub or 'Шайхантахур' in sub: return 'Shayxontohur tumani'
    if 'Chilonzor' in sub or 'Чиланзар' in sub: return 'Chilonzor tumani'
    if 'Uchtepa' in sub or 'Учтепа' in sub: return 'Uchtepa tumani'
    if 'Mirzo' in sub or 'Мирзо' in sub: return "Mirzo Ulug'bek tumani"
    if 'Yashnobod' in sub or 'Яшнабад' in sub: return 'Yashnobod tumani'
    if 'Yakkasaroy' in sub or 'Яккасарай' in sub: return 'Yakkasaroy tumani'
    if 'Mirobod' in sub or 'Мирабад' in sub: return 'Mirobod tumani'
    if 'Sergeli' in sub or 'Сергели' in sub: return 'Sergeli tumani'
    if 'Yangihayot' in sub or 'Янгихаёт' in sub: return 'Yangihayot tumani'
    if 'Bektemir' in sub or 'Бектемир' in sub: return 'Bektemir tumani'

    # Geographic boundary coordinates in Tashkent
    if lat >= 41.336 and lon <= 69.248: return 'Olmazor tumani'
    if lat >= 41.332 and lon > 69.255: return 'Yunusobod tumani'
    if 41.310 <= lat < 41.336 and 69.200 <= lon <= 69.255: return 'Shayxontohur tumani'
    if 41.245 <= lat < 41.295 and 69.170 <= lon <= 69.245: return 'Chilonzor tumani'
    if 41.280 <= lat < 41.336 and lon < 69.200: return 'Uchtepa tumani'
    if 41.315 <= lat and lon >= 69.300: return "Mirzo Ulug'bek tumani"
    if 41.265 <= lat < 41.315 and lon >= 69.290: return 'Yashnobod tumani'
    if 41.265 <= lat < 41.305 and 69.240 < lon <= 69.275: return 'Yakkasaroy tumani'
    if 41.260 <= lat < 41.310 and 69.270 < lon <= 69.310: return 'Mirobod tumani'
    if 41.210 <= lat < 41.255 and lon <= 69.260: return 'Sergeli tumani'
    if lat < 41.210 and lon <= 69.260: return 'Yangihayot tumani'
    if lat <= 41.245 and lon > 69.300: return 'Bektemir tumani'
    return 'Shayxontohur tumani'

mosques_curated = []

# First, add the landmark mosques with exact verified GPS
for key, l in LANDMARK_COORDS.items():
    mosques_curated.append({
        "nomi": l["nomi"],
        "tuman": l["tuman"],
        "manzil": l["manzil"],
        "lat": l["lat"],
        "lng": l["lng"]
    })

# Process raw OSM elements
for el in raw_items:
    tags = el.get('tags', {})
    lat = el.get('lat') or (el.get('center', {}).get('lat'))
    lon = el.get('lon') or (el.get('center', {}).get('lon'))
    if not lat or not lon:
        continue
    # Tashkent boundary
    if not (41.17 <= lat <= 41.42 and 69.12 <= lon <= 69.44):
        continue

    # Get best name
    name_uz = tags.get('name:uz')
    name = tags.get('name')
    name_ru = tags.get('name:ru')
    street = tags.get('addr:street', '')

    raw_name = name_uz or name or name_ru
    if not raw_name:
        if street:
            raw_name = f"{street} masjidi"
        else:
            continue

    # Cleanup name
    clean = to_latin(raw_name).strip()
    clean = clean.replace('Мечеть ', '').replace('мечеть ', '').replace('Мечеть', '').strip()
    clean = clean.replace('Jom`e', 'jome').replace("jom'e", 'jome').replace('Jome', 'jome')
    clean = clean.replace('Masjidi', 'masjidi').replace('Masjid', 'masjidi')
    clean = clean.replace('“', '').replace('”', '').replace('"', '').strip()
    
    # Capitalize first letter of each word properly if needed
    if clean.isupper():
        clean = clean.title()

    if not ('masjid' in clean.lower()):
        clean = f"{clean} jome masjidi"

    # Avoid duplicate with landmarks or existing
    is_duplicate = False
    for existing in mosques_curated:
        d = dist_m(lat, lon, existing["lat"], existing["lng"])
        if d < 120:  # within 120 meters is same mosque
            is_duplicate = True
            break
        # Also check name similarity
        if clean.lower() == existing["nomi"].lower():
            is_duplicate = True
            break

    if is_duplicate:
        continue

    district = assign_district(lat, lon, tags)
    manzil_parts = []
    if street:
        hn = tags.get('addr:housenumber', '')
        manzil_parts.append(to_latin(street) + (f", {hn}-uy" if hn else ""))
    manzil_parts.append(district)
    
    mosques_curated.append({
        "nomi": clean,
        "tuman": district,
        "manzil": ", ".join(manzil_parts),
        "lat": round(lat, 6),
        "lng": round(lon, 6)
    })

print(f"Total high-precision Tashkent mosques curated: {len(mosques_curated)}")

# Check district breakdown
districts = {}
for m in mosques_curated:
    t = m["tuman"]
    districts[t] = districts.get(t, 0) + 1

for t, c in sorted(districts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {t}: {c} ta")
