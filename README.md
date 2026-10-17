# 🕌 Masjidlar & Namoz Vaqtlari - Android Ilovasi

O'zbekiston masjidlari xaritasi va masjid xodimlari / boshqaruvchilari tomonidan belgilanadigan aniq namoz vaqtlari ilovasi.

---

## 📌 Asosiy Xususiyatlari

1. **🗺️ Interaktiv Xarita va Masjid Belgilari (Ikonkalari):**
   - Barcha masjidlar xaritada maxsus yashil-oltin gumbaz va minorali masjid nishonlari (ikonkalari) bilan joylashtirilgan.
   - Toshkent, Samarqand, Buxoro, Namangan, Andijon, Farg'ona va boshqa shaharlarning asosiy jome masjidlari koordinatalari va dastlabki namoz vaqtlari bilan oldindan kiritilgan.

2. **📱 Masjid Bosilganda Chiqadigan Oyna (Modal):**
   - Masjid belgisiga bosilganda chiroyli oyna (Bottom Sheet) ochiladi.
   - **Vaqt va Sana:** Bugungi sana (masalan: `16-Oktyabr, 2026-yil`) va soniyalarigacha ko'rsatuvchi jonli soat.
   - **5 ta Farz Namozi Vaqtlari:**
     - 🌅 **Bomdod**
     - ☀️ **Peshin**
     - 🌤️ **Asr**
     - 🌇 **Shom**
     - 🌙 **Hufton**
   - Shuningdek **Juma namozi** vaqti va masjid xodimi e'lonlari / izohlari.
   - Hozirgi paytga qarab keyingi namoz qaysi biri ekanligini avtomatik hisoblab, ajratib ko'rsatish.

3. **⏱️ Vaqtni Kiritish va O'zgartirish (Masjid boshqaruvchilari uchun):**
   - Har bir masjid oynasida **"⏱️ Vaqtlarni kiritish / o'zgartirish"** tugmasi mavjud.
   - Foydalanuvchi yoki masjid imom-xatibi / noibi kiritilgan sanadagi Bomdod, Peshin, Asr, Shom va Hufton vaqtlarini o'zgartirishi yoki yangi vaqt kiritishi mumkin.
   - Kiritilgan vaqtlar bir zumda xotirada saqlanadi va xaritada aks etadi.

4. **➕ Yangi Masjid Qo'shish:**
   - Xaritaga yangi masjid qo'shish imkoniyati (xaritani bosish yoki maxsus forma orqali).

5. **🇺🇿 To'liq O'zbek Tili:**
   - Barcha tugmalar, sarlavhalar, vaqtlar va bildirishnomalar o'zbek tilida tayyorlangan.

---

## 🚀 Ilovani Ishga Tushirish

### 1-usul: Bir bosish bilan ishga tushirish (Windows)
Fayl menejerida `Ishga_tushirish.bat` fayliga 2 marta bosing yoki terminalda:
```powershell
python run_app.py
```
Bu buyruq serverni ishga tushiradi va ilovani brauzerda `http://localhost:8080` manzilida avtomatik ochadi.

### 2-usul: Android Telefonda PWA sifatida o'rnatish
1. Telefoningizda brauzer (Chrome / Samsung Internet) orqali ushbu manzilga kiring (kompyuter va telefon bir xil Wi-Fi tarmog'ida bo'lsa, kompyuterning IP manzili: `http://192.168.x.x:8080`).
2. Brauzer menyusidan **"Bosh ekranga qo'shish"** yoki **"Ilovani o'rnatish"** (Install App) tugmasini bosing.
3. Ilova telefoningizga to'laqonli Android ilovasi sifatida o'rnatiladi va internet yo'q paytda ham ishlaydi.

### 3-usul: Android Studio orqali APK yig'ish (Native Android loyihasi)
Loyiha ichidagi `android_project` papkasi to'liq tayyor Android Studio loyihasidir:
1. Android Studio dasturini oching.
2. `Open` tugmasini bosib, `android_project` papkasini tanlang.
3. Android Studio Gradle kutubxonalarini avtomatik yuklaydi.
4. **Build -> Build Bundle(s) / APK(s) -> Build APK(s)** menyusini bosing.
5. Tayyor bo'lgan `app-debug.apk` faylini telefoningizga o'rnatib foydalanishingiz mumkin.
