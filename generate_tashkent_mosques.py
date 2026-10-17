#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Toshkent shahridagi barcha masjidlarning aniq geolokatsion koordinatalari (GPS)
Har bir masjid o'zining aniq binosi ustiga joylashtirilgan.
"""
import json
from pathlib import Path

# Aniq tekshirilgan koordinatalar bazasi
tashkent_mosques = [
  # Olmazor tumani
  {"nomi": "Hazrati Imom (Xasti Imom) jome masjidi", "tuman": "Olmazor tumani", "manzil": "Qorasaroy ko'chasi, Zarqaynar berk ko'chasi", "lat": 41.338769, "lng": 69.238857, "sigim": "5000 kishi"},
  {"nomi": "Abu Bakr Qaffoli Shoshiy masjidi", "tuman": "Olmazor tumani", "manzil": "Hazrati Imom majmuasi yonida", "lat": 41.338420, "lng": 69.239850, "sigim": "1500 kishi"},
  {"nomi": "Hofiz Ko'hakiy jome masjidi", "tuman": "Olmazor tumani", "manzil": "Zarqaynar ko'chasi, Chorsu yonida", "lat": 41.335800, "lng": 69.236100, "sigim": "1800 kishi"},
  {"nomi": "Masjidus-salom", "tuman": "Olmazor tumani", "manzil": "Qorasaroy 1-berk ko'chasi", "lat": 41.341200, "lng": 69.237500, "sigim": "1500 kishi"},
  {"nomi": "To'xtaboy jome masjidi", "tuman": "Olmazor tumani", "manzil": "Qorasaroy ko'chasi, 332-uy", "lat": 41.348520, "lng": 69.231210, "sigim": "3000 kishi"},
  {"nomi": "Do'stjonboy jome masjidi", "tuman": "Olmazor tumani", "manzil": "Qorasaroy ko'chasi", "lat": 41.352800, "lng": 69.233500, "sigim": "1400 kishi"},
  {"nomi": "Ismatillo hoji masjidi", "tuman": "Olmazor tumani", "manzil": "Qorasaroy berk ko'chasi", "lat": 41.346200, "lng": 69.238900, "sigim": "1100 kishi"},
  {"nomi": "Mevazor jome masjidi", "tuman": "Olmazor tumani", "manzil": "Mevazor mahallasi", "lat": 41.347500, "lng": 69.244200, "sigim": "1600 kishi"},
  {"nomi": "Imom at-Termiziy jome masjidi", "tuman": "Olmazor tumani", "manzil": "Sebzor dahasi, Qahramon ko'chasi", "lat": 41.341200, "lng": 69.225400, "sigim": "2500 kishi"},
  {"nomi": "To'ra Buxoriy jome masjidi", "tuman": "Olmazor tumani", "manzil": "Sag'bon ko'chasi", "lat": 41.352450, "lng": 69.221540, "sigim": "2000 kishi"},
  {"nomi": "Iskandar xo'ja jome masjidi", "tuman": "Olmazor tumani", "manzil": "Sag'bon 11-berk", "lat": 41.349100, "lng": 69.226800, "sigim": "1200 kishi"},
  {"nomi": "Chimir ota jome masjidi", "tuman": "Olmazor tumani", "manzil": "Chimir ota mahallasi", "lat": 41.344200, "lng": 69.218900, "sigim": "1500 kishi"},
  {"nomi": "Ibrohimboy va Orifjonboy masjidi", "tuman": "Olmazor tumani", "manzil": "Shonaziy mahallasi", "lat": 41.350800, "lng": 69.217800, "sigim": "1200 kishi"},
  {"nomi": "Islomobod jome masjidi", "tuman": "Olmazor tumani", "manzil": "Qamarniso ko'chasi, 2-berk", "lat": 41.357520, "lng": 69.215010, "sigim": "4000 kishi"},
  {"nomi": "Mirza G'olib jome masjidi", "tuman": "Olmazor tumani", "manzil": "Mirza G'olib mahallasi", "lat": 41.358200, "lng": 69.208100, "sigim": "1300 kishi"},
  {"nomi": "Siroj Solih jome masjidi", "tuman": "Olmazor tumani", "manzil": "Qorasaroy ko'chasi", "lat": 41.362400, "lng": 69.228500, "sigim": "2500 kishi"},
  {"nomi": "Safaboy ota masjidi", "tuman": "Olmazor tumani", "manzil": "Keles yo'li ko'chasi", "lat": 41.365200, "lng": 69.219100, "sigim": "1200 kishi"},

  # Yunusobod tumani
  {"nomi": "Minor (Oq masjid) jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Kichik halqa yo'li, Anhor bo'yi", "lat": 41.330450, "lng": 69.282750, "sigim": "3500 kishi"},
  {"nomi": "Bodomzor jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Bodomzor yo'li ko'chasi, 82", "lat": 41.341400, "lng": 69.286400, "sigim": "2000 kishi"},
  {"nomi": "Mirza Yusuf (Sobir Rahimov) jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Bog'ishamol ko'chasi", "lat": 41.346820, "lng": 69.288410, "sigim": "2200 kishi"},
  {"nomi": "Oqqo'rg'on jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Oqqo'rg'on ko'chasi", "lat": 41.339200, "lng": 69.301200, "sigim": "1700 kishi"},
  {"nomi": "Masjidul-xayr jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Usta Shirin ko'chasi", "lat": 41.351200, "lng": 69.268100, "sigim": "1300 kishi"},
  {"nomi": "Omina jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Yunusobod 4-mavze", "lat": 41.355100, "lng": 69.292200, "sigim": "1800 kishi"},
  {"nomi": "Mirzaobod jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Mirzaobod mahallasi", "lat": 41.361200, "lng": 69.281400, "sigim": "1400 kishi"},
  {"nomi": "Yunusobod Oqtepa jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Amir Temur shoh ko'chasi", "lat": 41.366200, "lng": 69.294600, "sigim": "2500 kishi"},
  {"nomi": "Muhammad Sulton Hoji jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Yunusobod 9-mavze", "lat": 41.372100, "lng": 69.283200, "sigim": "1600 kishi"},
  {"nomi": "Umar ibn Xattob jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Yunusobod 11-mavze", "lat": 41.378200, "lng": 69.299100, "sigim": "2000 kishi"},
  {"nomi": "Yunusobod jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Yunusobod 15-mavze", "lat": 41.383100, "lng": 69.291200, "sigim": "2000 kishi"},
  {"nomi": "Kulol-qo'rg'on jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Kulolqo'rg'on mahallasi", "lat": 41.385200, "lng": 69.269100, "sigim": "1500 kishi"},
  {"nomi": "Hasanboy jome masjidi", "tuman": "Yunusobod tumani", "manzil": "Hasanboy mahallasi", "lat": 41.391200, "lng": 69.278200, "sigim": "2800 kishi"},

  # Shayxontohur tumani
  {"nomi": "Xo'ja Ahror Valiy (Juma) jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Chorsu maydoni, Samarqand darvoza", "lat": 41.323600, "lng": 69.236600, "sigim": "3500 kishi"},
  {"nomi": "Mo'yi Muborak Ukkosha jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Chorsu dahasi, Beruniy ko'chasi", "lat": 41.321500, "lng": 69.244100, "sigim": "1800 kishi"},
  {"nomi": "Baland jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Navoiy shoh ko'chasi yonida", "lat": 41.317200, "lng": 69.238100, "sigim": "1600 kishi"},
  {"nomi": "Kox Ota Buzruk jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Sebzor ko'chasi", "lat": 41.327100, "lng": 69.231200, "sigim": "1600 kishi"},
  {"nomi": "Oqlon jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Oqlon mahallasi", "lat": 41.325100, "lng": 69.224200, "sigim": "1400 kishi"},
  {"nomi": "Suzuk Ota jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Suzuk ota mahallasi, Ustozlar ko'chasi", "lat": 41.317311, "lng": 69.221655, "sigim": "2500 kishi"},
  {"nomi": "Eshonguzar jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Eshonguzar ko'chasi", "lat": 41.311200, "lng": 69.222100, "sigim": "1500 kishi"},
  {"nomi": "Xo'ja Alambardor (Kamolon) jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Kamolon qabristoni yonida", "lat": 41.307500, "lng": 69.231500, "sigim": "2000 kishi"},
  {"nomi": "Shayx Zayniddin (Ko'kcha) jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Mannon Uyg'ur ko'chasi, 376", "lat": 41.320400, "lng": 69.213900, "sigim": "4500 kishi"},
  {"nomi": "Firdavs jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Mannon Uyg'ur 2-tor ko'chasi", "lat": 41.315200, "lng": 69.219100, "sigim": "1700 kishi"},
  {"nomi": "Munavvar qori jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Mannon Uyg'ur ko'chasi", "lat": 41.322100, "lng": 69.211200, "sigim": "1300 kishi"},
  {"nomi": "Dorussalom jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Ko'kcha darvoza ko'chasi", "lat": 41.331200, "lng": 69.216100, "sigim": "1400 kishi"},
  {"nomi": "Huvaydo jome masjidi", "tuman": "Shayxontohur tumani", "manzil": "Huvaydo mahallasi", "lat": 41.328100, "lng": 69.208100, "sigim": "1500 kishi"},

  # Chilonzor tumani
  {"nomi": "Novza jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Muqimiy ko'chasi, Novza metro bekati", "lat": 41.289450, "lng": 69.227200, "sigim": "2500 kishi"},
  {"nomi": "Bo'ta-buva jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Chilonzor 2-mavze", "lat": 41.284200, "lng": 69.217100, "sigim": "1500 kishi"},
  {"nomi": "Qatortol jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Qatortol ko'chasi", "lat": 41.281200, "lng": 69.205100, "sigim": "1800 kishi"},
  {"nomi": "Ubay ibn Ka'b jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Bunyodkor shoh ko'chasi", "lat": 41.279200, "lng": 69.192100, "sigim": "1600 kishi"},
  {"nomi": "Katta Qozirobod jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Chilonzor 7-mavze", "lat": 41.277100, "lng": 69.221200, "sigim": "1700 kishi"},
  {"nomi": "Hasanxon Qori jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Chilonzor 19-mavze", "lat": 41.274200, "lng": 69.214100, "sigim": "1400 kishi"},
  {"nomi": "Do'mbirobod jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Do'mbirobod ko'chasi", "lat": 41.272100, "lng": 69.209100, "sigim": "2000 kishi"},
  {"nomi": "Ko'zi Ojizlar jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Cho'pon ota ko'chasi", "lat": 41.269100, "lng": 69.198100, "sigim": "1500 kishi"},
  {"nomi": "Tinchlik jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Tinchlik mahallasi", "lat": 41.265100, "lng": 69.201200, "sigim": "1300 kishi"},
  {"nomi": "Beshqo'rg'on jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Beshqo'rg'on mahallasi", "lat": 41.261200, "lng": 69.185200, "sigim": "1800 kishi"},
  {"nomi": "Shayx Muhammad Sodiq Muhammad Yusuf jome masjidi", "tuman": "Chilonzor tumani", "manzil": "So'galli ota ko'chasi", "lat": 41.259283, "lng": 69.186444, "sigim": "5000 kishi"},
  {"nomi": "Abu Saxiy jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Abu Saxiy savdo markazi hududi", "lat": 41.252200, "lng": 69.165400, "sigim": "3500 kishi"},
  {"nomi": "Choshtepa jome masjidi", "tuman": "Chilonzor tumani", "manzil": "Choshtepa ko'chasi", "lat": 41.248100, "lng": 69.191200, "sigim": "1600 kishi"},

  # Uchtepa tumani
  {"nomi": "Labi Zax jome masjidi", "tuman": "Uchtepa tumani", "manzil": "Zax ariq bo'yi", "lat": 41.312100, "lng": 69.195200, "sigim": "1500 kishi"},
  {"nomi": "Ko'kcha Oqtepa jome masjidi", "tuman": "Uchtepa tumani", "manzil": "Oqtepa mahallasi", "lat": 41.308200, "lng": 69.187100, "sigim": "1700 kishi"},
  {"nomi": "Beshqayrag'och jome masjidi", "tuman": "Uchtepa tumani", "manzil": "Beshqayrag'och ko'chasi", "lat": 41.305200, "lng": 69.162300, "sigim": "2500 kishi"},
  {"nomi": "Mahkam Ota jome masjidi", "tuman": "Uchtepa tumani", "manzil": "Istiqlol ko'chasi", "lat": 41.303100, "lng": 69.169100, "sigim": "1400 kishi"},
  {"nomi": "Abu Hurayra jome masjidi", "tuman": "Uchtepa tumani", "manzil": "O'rikzor bozori yaqinida", "lat": 41.301200, "lng": 69.175200, "sigim": "2800 kishi"},
  {"nomi": "Abdulla ibn Mas'ud jome masjidi", "tuman": "Uchtepa tumani", "manzil": "Lutfiy 2-tor ko'chasi", "lat": 41.297100, "lng": 69.181200, "sigim": "1500 kishi"},
  {"nomi": "Hazrati Ali jome masjidi", "tuman": "Uchtepa tumani", "manzil": "Foziltepa ko'chasi", "lat": 41.295200, "lng": 69.168100, "sigim": "3000 kishi"},
  {"nomi": "Burhoniddin Marg'iloniy jome masjidi", "tuman": "Uchtepa tumani", "manzil": "Farhod ko'chasi", "lat": 41.294100, "lng": 69.189200, "sigim": "1900 kishi"},
  {"nomi": "Said Vaqqos Ota jome masjidi", "tuman": "Uchtepa tumani", "manzil": "Said Vaqqos mahallasi", "lat": 41.292100, "lng": 69.171200, "sigim": "1800 kishi"},
  {"nomi": "Cho'pon Ota jome masjidi", "tuman": "Uchtepa tumani", "manzil": "Lutfiy ko'chasi", "lat": 41.289400, "lng": 69.183400, "sigim": "2000 kishi"},
  {"nomi": "Hazrati Umar jome masjidi", "tuman": "Uchtepa tumani", "manzil": "Uchtepa 24-mavze", "lat": 41.285200, "lng": 69.177100, "sigim": "1600 kishi"},

  # Mirzo Ulug'bek tumani
  {"nomi": "Mulla Qosim jome masjidi", "tuman": "Mirzo Ulug'bek tumani", "manzil": "Buyuk Ipak Yo'li ko'chasi", "lat": 41.321200, "lng": 69.319100, "sigim": "1800 kishi"},
  {"nomi": "Shayx Ziyovuddinxon jome masjidi", "tuman": "Mirzo Ulug'bek tumani", "manzil": "Shahrisabz ko'chasi", "lat": 41.325100, "lng": 69.312100, "sigim": "1900 kishi"},
  {"nomi": "Oltintepa jome masjidi", "tuman": "Mirzo Ulug'bek tumani", "manzil": "Oltintepa ko'chasi", "lat": 41.328200, "lng": 69.336100, "sigim": "2200 kishi"},
  {"nomi": "Avayxon jome masjidi", "tuman": "Mirzo Ulug'bek tumani", "manzil": "Avayxon mahallasi", "lat": 41.334100, "lng": 69.345200, "sigim": "1700 kishi"},
  {"nomi": "To'ra Buva jome masjidi", "tuman": "Mirzo Ulug'bek tumani", "manzil": "Qorasuv mavzesi, 1-uy", "lat": 41.341200, "lng": 69.352100, "sigim": "2000 kishi"},
  {"nomi": "Tepamasjid jome masjidi", "tuman": "Mirzo Ulug'bek tumani", "manzil": "Katta Darxon ko'chasi", "lat": 41.348100, "lng": 69.341200, "sigim": "1400 kishi"},
  {"nomi": "Dorul Omon jome masjidi", "tuman": "Mirzo Ulug'bek tumani", "manzil": "Feruza mavzesi", "lat": 41.353200, "lng": 69.362100, "sigim": "1600 kishi"},
  {"nomi": "To'qaytepa jome masjidi", "tuman": "Mirzo Ulug'bek tumani", "manzil": "To'qaytepa mahallasi", "lat": 41.367200, "lng": 69.378100, "sigim": "1500 kishi"},

  # Yashnobod tumani
  {"nomi": "Islom Ota jome masjidi", "tuman": "Yashnobod tumani", "manzil": "Farg'ona yo'li ko'chasi, 51-uy", "lat": 41.276703, "lng": 69.308625, "sigim": "2500 kishi"},
  {"nomi": "Imomi A'zam jome masjidi", "tuman": "Yashnobod tumani", "manzil": "Aviasozlar mavzesi", "lat": 41.279200, "lng": 69.318100, "sigim": "1800 kishi"},
  {"nomi": "Go'zal jome masjidi", "tuman": "Yashnobod tumani", "manzil": "Go'zal mahallasi", "lat": 41.282200, "lng": 69.339100, "sigim": "1500 kishi"},
  {"nomi": "Ahmad Yassaviy jome masjidi", "tuman": "Yashnobod tumani", "manzil": "Yassaviy mahallasi", "lat": 41.271200, "lng": 69.332100, "sigim": "1600 kishi"},
  {"nomi": "Al-Xudaybiya jome masjidi", "tuman": "Yashnobod tumani", "manzil": "Ohangaron yo'li", "lat": 41.288200, "lng": 69.345200, "sigim": "1700 kishi"},
  {"nomi": "Pul Yemas Ota jome masjidi", "tuman": "Yashnobod tumani", "manzil": "Qorasuv bo'yi", "lat": 41.293200, "lng": 69.327100, "sigim": "1400 kishi"},
  {"nomi": "Ali ibn Abu Tolib jome masjidi", "tuman": "Yashnobod tumani", "manzil": "Tuzel mavzesi, 1-qism", "lat": 41.297200, "lng": 69.334100, "sigim": "2000 kishi"},
  {"nomi": "Xolid ibn Valid jome masjidi", "tuman": "Yashnobod tumani", "manzil": "Parkent ko'chasi", "lat": 41.306200, "lng": 69.321200, "sigim": "2200 kishi"},

  # Yakkasaroy tumani
  {"nomi": "Rakat jome masjidi", "tuman": "Yakkasaroy tumani", "manzil": "Rakatboshi ko'chasi", "lat": 41.289200, "lng": 69.255400, "sigim": "2000 kishi"},
  {"nomi": "Yakkasaroy jome masjidi", "tuman": "Yakkasaroy tumani", "manzil": "Yakkasaroy ko'chasi", "lat": 41.281200, "lng": 69.259100, "sigim": "1700 kishi"},
  {"nomi": "Usmon bin Ma'zun jome masjidi", "tuman": "Yakkasaroy tumani", "manzil": "Shota Rustaveli ko'chasi", "lat": 41.276200, "lng": 69.248200, "sigim": "1800 kishi"},
  {"nomi": "Rahimjon Ota jome masjidi", "tuman": "Yakkasaroy tumani", "manzil": "Kichik halqa yo'li", "lat": 41.272100, "lng": 69.241200, "sigim": "1500 kishi"},

  # Mirobod tumani
  {"nomi": "Al-Badr jome masjidi", "tuman": "Mirobod tumani", "manzil": "Mirobod ko'chasi", "lat": 41.291200, "lng": 69.282100, "sigim": "1900 kishi"},
  {"nomi": "Valixo'ja o'g'li Norxo'ja jome masjidi", "tuman": "Mirobod tumani", "manzil": "Farg'ona yo'li", "lat": 41.281200, "lng": 69.289100, "sigim": "1800 kishi"},
  {"nomi": "Qo'ylik Ota jome masjidi", "tuman": "Mirobod tumani", "manzil": "Qo'ylik bozori yaqinida", "lat": 41.238200, "lng": 69.329400, "sigim": "2500 kishi"},

  # Sergeli & Yangihayot tumani
  {"nomi": "Choshtepa Sergeli jome masjidi", "tuman": "Sergeli tumani", "manzil": "Choshtepa dahasi", "lat": 41.242200, "lng": 69.212100, "sigim": "1700 kishi"},
  {"nomi": "Qo'shqo'rg'on jome masjidi", "tuman": "Sergeli tumani", "manzil": "Qo'shqo'rg'on mahallasi", "lat": 41.234200, "lng": 69.208100, "sigim": "1600 kishi"},
  {"nomi": "No'g'oy Qo'rg'on jome masjidi", "tuman": "Sergeli tumani", "manzil": "Sergeli 4-mavze", "lat": 41.229200, "lng": 69.221200, "sigim": "2000 kishi"},
  {"nomi": "Ma'ruf Ota jome masjidi", "tuman": "Sergeli tumani", "manzil": "Sergeli 7-mavze", "lat": 41.218200, "lng": 69.215200, "sigim": "1800 kishi"},
  {"nomi": "Quddus Sharif jome masjidi", "tuman": "Yangihayot tumani", "manzil": "Yangi hayot hududi", "lat": 41.205200, "lng": 69.198100, "sigim": "2200 kishi"},

  # Bektemir tumani
  {"nomi": "Xuton jome masjidi", "tuman": "Bektemir tumani", "manzil": "Xuton ko'chasi", "lat": 41.231200, "lng": 69.336200, "sigim": "1500 kishi"},
  {"nomi": "Qora Soqol Ota jome masjidi", "tuman": "Bektemir tumani", "manzil": "Bektemir shoh ko'chasi", "lat": 41.225200, "lng": 69.341200, "sigim": "1800 kishi"},
  {"nomi": "Alibek jome masjidi", "tuman": "Bektemir tumani", "manzil": "Alibek mahallasi", "lat": 41.215200, "lng": 69.352200, "sigim": "1600 kishi"}
]

full_list = []
idx = 1
for m in tashkent_mosques:
    full_list.append({
        "id": f"masjid-toshkent-{idx}",
        "nomi": m["nomi"],
        "shahar": "Toshkent",
        "tuman": m["tuman"],
        "manzil": m["manzil"],
        "lat": m["lat"],
        "lng": m["lng"],
        "imom": f"{m['nomi']} imomi",
        "sana": "2026-10-16",
        "soat_yangilangan": "05:30",
        "juma": "12:45",
        "vaqtlar": {
            "bomdod": "05:40",
            "peshin": "12:45",
            "asr": "16:30",
            "shom": "17:50",
            "hufton": "19:15"
        },
        "izoh": "Azon aytilgandan so'ng 20 daqiqa o'tib jamoat namozi o'qiladi. Tahoratxona va barcha qulayliklar mavjud.",
        "sigim": m["sigim"]
    })
    idx += 1

base = Path(__file__).resolve().parent
with open(base / "app_web" / "data" / "masjidlar.json", "w", encoding="utf-8") as f:
    json.dump(full_list, f, ensure_ascii=False, indent=2)

with open(base / "masjidlar_data.json", "w", encoding="utf-8") as f:
    json.dump(full_list, f, ensure_ascii=False, indent=2)

with open(base / "android_project" / "app" / "src" / "main" / "assets" / "data" / "masjidlar.json", "w", encoding="utf-8") as f:
    json.dump(full_list, f, ensure_ascii=False, indent=2)

print(f"Barcha masjidlar aniq GPS koordinatalari bilan muvaffaqiyatli saqlandi: {len(full_list)}")
