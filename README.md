# 🕌 Masjidlar & Namoz Vaqtlari (Toshkent)

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20App-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://masjidvaqtlariapp.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/AbdulloxFrontEnd/masjid-namoz-vaqtlari)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20PWA%20%7C%20Android%20%7C%20iOS-047857?style=for-the-badge)](https://masjidvaqtlariapp.vercel.app)
[![Dark Mode](https://img.shields.io/badge/Dark%20Mode-144%20FPS%20GPU-0f172a?style=for-the-badge)](https://masjidvaqtlariapp.vercel.app)

> **Toshkent shahridagi 166+ masjidning aniq geolokatsiyasi va 5 vaqt namoz vaqtlari (Bomdod, Peshin, Asr, Shom, Hufton va Juma namozi) ilovasi.**

---

## 🌐 Jonli Havolalar (Live Links)

* 🚀 **Vercel Web Ilova (24/7 Online)**: [https://masjidvaqtlariapp.vercel.app](https://masjidvaqtlariapp.vercel.app)
* ⚙️ **Masjid Mas'ullari Admin Portali**: [https://masjidvaqtlariapp.vercel.app/admin](https://masjidvaqtlariapp.vercel.app/admin)
* 🍏 **iPhone / iPad uchun .IPA fayli**: [MasjidNamozVaqtlari.ipa yuklab olish](https://masjidvaqtlariapp.vercel.app/MasjidNamozVaqtlari.ipa)
* 📲 **Apple 1-Klikli WebClip Profili**: [MasjidNamozVaqtlari.mobileconfig](https://masjidvaqtlariapp.vercel.app/MasjidNamozVaqtlari.mobileconfig)

---

## ✨ Asosiy Imkoniyatlar

1. **🗺️ Interaktiv Xarita va 144 FPS Klasterlash**:
   - Google Maps Roadmap & Satellite qatlamlari.
   - Toshkent bo'yicha 166 ta masjid xaritada masofaga qarab avtomatik birlashadi va ajraladi (`35px` - `280px` adaptiv radius).
   - Tungi rejim (Dark Mode): GPU-tezlatgichli kontrastli qorong'u xarita — 0 ms kechikish, nol tarmoq sarfi.

2. **⏰ 5 Vaqt Namoz Vaqtlari (Aniq va Jonli)**:
   - Bomdod, Peshin, Asr, Shom, Hufton va Juma namozi vaqtlari.
   - Hozirgi paytdagi eng yaqin namozgacha qolgan vaqt sanagichi.
   - Namoz vaqti kirganda masjid nishoni 5 daqiqa davomida miltillab nur taratadi.

3. **🧭 Qibla Kompasi**:
   - Geodezik Great-Circle azimuti (Toshkent uchun `240.28°`).
   - Mobil datchiklar (Gyroskop & Magnitometr) orqali jonli 3D kompas.

4. **📿 Raqamli Tasbeh**:
   - Subhanalloh (33), Alhamdulillah (33), Allohu Akbar (34).
   - Haptik tebranish va ovozli fikr-mulohaza.

5. **📅 Oylik Namoz Taqvimi**:
   - Har bir masjid uchun to'liq oylik jadval.

6. **🚕 Navigatsiya va Ulashish**:
   - Yandex Go, Yandex Maps va Google Maps orqali 1-klikda yo'nalish olish.
   - Telegram va WhatsApp orqali namoz vaqtlarini ulashish.

7. **📱 PWA & Oflayn Rejim**:
   - Internetsiz ham to'liq ishlaydigan Service Worker kesh tizimi (`CacheFirst`).

---

## 🛠️ Loyihani Ishga Tushirish

### Mahalliy kompyuterda:
```powershell
python server.py 8080
```
Brauzerda `http://localhost:8080` yoki uy Wi-Fi tarmog'idagi telefoningizdan `http://192.168.1.11:8080` manzilida ochiladi.

### Vercel orqali yangilash:
```powershell
git add .
git commit -m "update"
git push origin master
```
*GitHub va Vercel ulangani sababli, har bir `git push` avtomatik ravishda Vercel'da yangilanadi.*

---

## 📄 Litsenziya
MIT License © 2026 AbdulloxFrontEnd
