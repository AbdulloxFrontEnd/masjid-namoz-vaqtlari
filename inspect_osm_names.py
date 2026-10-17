import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('osm_raw_mosques.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

print(f"Loaded {len(items)} elements")

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
    res = []
    for c in text:
        res.append(cyr_to_lat.get(c, c))
    return "".join(res)

named_list = []
for el in items:
    tags = el.get('tags', {})
    lat = el.get('lat') or (el.get('center', {}).get('lat'))
    lon = el.get('lon') or (el.get('center', {}).get('lon'))
    if not lat or not lon:
        continue
    if not (41.16 <= lat <= 41.43 and 69.12 <= lon <= 69.45):
        continue

    # Get Uzbek name first, then general name, then Russian
    name_uz = tags.get('name:uz')
    name = tags.get('name')
    name_ru = tags.get('name:ru')
    street = tags.get('addr:street', '')

    final_name = name_uz or name or name_ru
    if not final_name:
        if street:
            final_name = f"{street} masjidi"
        else:
            continue

    # Transliterate if cyrillic
    final_name = to_latin(final_name)
    final_name = final_name.replace('Мечеть ', '').replace('мечеть ', '').replace('Мечеть', '').strip()
    
    # Normalize suffixes
    final_name = final_name.replace('Jom`e', 'jome').replace("jom'e", 'jome').replace('Jome', 'jome')
    if not ('masjid' in final_name.lower()):
        final_name = f"{final_name} masjidi"
        
    named_list.append((final_name, round(lat, 6), round(lon, 6), street, tags))

print(f"Total processed valid mosques: {len(named_list)}")
for n, la, lo, st, _ in named_list[:25]:
    print(f"  {n} | {la}, {lo} | ko'cha: {st}")
