# Smart Start — maktab sayti (backend + admin panel API)

Bu loyiha **Smart Start xususiy maktabi** (Toshkent) sayti uchun server qismi:

- ota-onalar ko'radigan sayt uchun ma'lumotlar (bosh sahifa, natijalar, o'qituvchilar, yangiliklar, narxlar, galereya…);
- **qabul arizalari** va ularni boshqarish (CRM): holatlar, mas'ul xodim, izohlar, Excel'ga eksport;
- **ekskursiya / ochiq eshiklar kuni**ga yozilish (joylar soni nazorat qilinadi);
- yangi ariza kelganda **Telegram guruhga xabar**, xohlasangiz ota-onaga **SMS** (Eskiz.uz);
- xodimlar uchun kirish (parol + ixtiyoriy 2 bosqichli tasdiqlash), rollar, harakatlar jurnali;
- rasmlarni avtomatik siqish (WebP), SEO (Google uchun sarlavhalar, sitemap), har kungi zaxira nusxa.

Sayt ko'rinishi (React) `frontend/` papkasida; u yig'ilgandan keyin shu server orqali ochiladi.
Hammasi **bitta buyruq bilan** ishga tushadi.

---

## 1. Ishga tushirish

Hosting uchun [DEPLOYMENT.md](DEPLOYMENT.md) faylidagi sozlamalardan foydalaning.

### Windows
1. Python 3.10 yoki yangisini o'rnating: <https://www.python.org/downloads/> — o'rnatishda **«Add python.exe to PATH»** belgisini qo'ying.
2. Loyiha papkasidagi **`run.bat`** faylini ikki marta bosing.
3. Birinchi marta 2–5 daqiqa kutasiz (kutubxonalar yuklanadi). Keyin brauzerda oching: **<http://localhost:8000>**

### Linux / macOS
```bash
cd smart-start
./run.sh
```
Brauzerda: **<http://localhost:8000>**. Boshqa port kerak bo'lsa: `PORT=9000 ./run.sh`.

`run.sh` / `run.bat` o'zi: virtual muhit (`.venv`) yaratadi, kutubxonalarni o'rnatadi, `.env` faylini yaratadi
va serverni **8000-portda** ishga tushiradi. Arxivdagi `data/smartstart.db` va `media/` birga ishlatiladi.

## 2. Xodimlar uchun kirish

Admin panel: <http://localhost:8000/admin>. Arxivdagi hisoblar o‘chirilgan.
`backend/` papkasida virtual muhit orqali yangi parol o‘rnating:

```sh
python -m app.cli create-user --email admin@smartstart.uz --role super_admin --update
```

Demo bazani alohida sinov muhitida yaratish uchun `APP_ENV=development` va
`AUTO_SEED=true` ni bo‘sh bazaga qo‘llang. Demo hisoblari haqiqiy sayt uchun ishlatilmaydi.

**Rollar:**
- **Menejer** — arizalar, ekskursiyalar, kontent (yangiliklar, o'qituvchilar, narxlar, FAQ, sertifikatlar, rasmlar).
- **Admin** — menejer qila oladigan hamma narsa + statistika (dashboard), Excel eksport, sozlamalar, jurnal.
- **Super admin** — admin + xodimlarni qo'shish/o'chirish.

---

## 3. API hujjati (Swagger)

**<http://localhost:8000/api/docs>** — barcha endpointlar ro'yxati, ularni shu yerda sinab ko'rish mumkin.
Admin endpointlar uchun avval `POST /api/v1/auth/login` ni bajaring (cookie avtomatik o'rnatiladi)
yoki javobdagi `access_token` ni «Authorize» tugmasiga qo'ying.

---

## 4. Telegram botni ulash

Yangi ariza, ekskursiyaga yozilish va aloqa formasidagi xabarlar menejerlar guruhiga keladi.

1. Telegram'da **@BotFather** ga yozing → `/newbot` → bot nomini kiriting → u **token** beradi
   (`123456789:AA...` ko'rinishida).
2. Menejerlar guruhini oching va botni guruhga **qo'shing**.
3. Guruhga istalgan xabar yozing, so'ng brauzerda oching:
   `https://api.telegram.org/bot<TOKEN>/getUpdates` — javobdagi `"chat":{"id":-100...}` raqami — bu **chat ID**.
4. Admin panel → **Sozlamalar** → Telegram bo'limiga token va chat ID ni kiriting → **«Sinab ko'rish»**.
   (Yoki `.env` faylidagi `TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHAT_ID` ga yozib serverni qayta ishga tushiring.)

Bir nechta guruh/odamga yuborish uchun chat ID larni vergul bilan yozing.
Xabar yuborish ariza saqlangandan keyin fonda bajariladi — Telegram ishlamasa ham ariza yo'qolmaydi.

**SMS (ixtiyoriy):** Eskiz.uz hisobingiz bo'lsa, Sozlamalarda «SMS» ni yoqing va Eskiz email/parolini kiriting.
Eskiz'da SMS matni shabloni tasdiqlangan bo'lishi kerak.

**Spamdan himoya (ixtiyoriy):** Cloudflare Turnstile kalitlarini Sozlamalarga kiritsangiz, formalar botlardan himoyalanadi.
Kiritilmasa ham har bir IP manzildan soatiga 5 tadan ortiq ariza qabul qilinmaydi.

---

## 5. API modullari

Barcha manzillar `/api/v1` bilan boshlanadi. Xatolar doim bir xil ko'rinishda: `{"code": "...", "message": "..."}`.

| Modul | Nima qiladi | Asosiy manzillar |
| --- | --- | --- |
| **auth** | kirish, chiqish, token yangilash, 2FA (Google Authenticator), parol, xodimlar, jurnal | `/auth/*`, `/admin/users`, `/admin/staff`, `/admin/audit-log` |
| **content** | sahifa bloklari, yangilik/tadbirlar, o'qituvchilar, narxlar, FAQ, fikrlar, sertifikatlar, hamkor universitetlar (3 tilda) | `/public/pages/{key}`, `/public/posts`, `/public/teachers`, `/public/certificates`, `/admin/posts` … |
| **media** | rasm yuklash, avtomatik WebP (400 / 960 / 1920 px), albomlar (galereya) | `/admin/media`, `/admin/albums`, `/public/albums` |
| **admissions** | qabul arizalari, holatlar, izohlar, mas'ul xodim, UTM manba, aloqa formasi | `/public/admissions`, `/public/contact`, `/admin/admissions` |
| **events** | ekskursiya va ochiq eshiklar kuni, joylar soni | `/public/tours`, `/public/tours/{id}/book`, `/admin/tours` |
| **notifications** | Telegram, Eskiz SMS, Turnstile, sayt sozlamalari | `/public/settings`, `/admin/settings` |
| **reports** | dashboard statistikasi, Excel eksport | `/admin/reports/dashboard`, `/admin/admissions/export` |

Bundan tashqari: `/sitemap.xml`, `/robots.txt`, `/api/v1/health` (monitoring uchun).

API sxemasi — `/api/openapi.json`.

---

## 6. Loyiha tuzilmasi

```
smart-start/
├── run.sh / run.bat          ← bitta buyruq bilan ishga tushirish
├── requirements.txt          ← Python kutubxonalari
├── .env.example              ← sozlamalar namunasi (izohlar o'zbekcha)
├── Dockerfile, docker-compose.yml, DEPLOYMENT.md
├── backend/
│   ├── app/
│   │   ├── main.py           ← dastur kirish nuqtasi
│   │   ├── cli.py            ← buyruqlar: seed, create-user, backup
│   │   ├── core/             ← sozlamalar, baza, xavfsizlik, xatolar, rate limit
│   │   ├── modules/
│   │   │   ├── auth/  content/  media/  admissions/
│   │   │   └── events/  notifications/  reports/
│   │   ├── web/              ← saytni (SPA) berish, SEO, sitemap
│   │   └── static/           ← yig'ilgan frontend (npm run build shu yerga yozadi)
│   ├── seed/                 ← boshlang'ich ma'lumotlar va rasmlar
│   └── tests/                ← avtomatik testlar (pytest)
├── frontend/                 ← React sayt va admin panel (manba kodi)
├── media/
│   ├── public/               ← saytda ko'rinadigan rasmlar (WebP)
│   └── private/              ← yopiq fayllar: sertifikat asl nusxalari, rozilik xatlari
└── data/                     ← baza (smartstart.db), loglar, zaxira nusxalar
```

---

## 7. Frontendni qayta yig'ish

Sayt ko'rinishi o'zgartirilgandan keyin (Node.js 24 kerak):
```bash
cd frontend && npm ci && npm run build
```
Natija `backend/app/static/` papkasiga yoziladi va server uni darhol ko'rsatadi (qayta ishga tushirish shart emas).
Frontend hali yig'ilmagan bo'lsa, `http://localhost:8000` da Swagger'ga havolali vaqtinchalik sahifa chiqadi.

Docker'da frontend `docker compose up --build` vaqtida avtomatik yig'iladi.

---

## 8. Zaxira nusxa (backup)

Qo'lda:
```bash
cd backend
../.venv/bin/python -m app.cli backup              # faqat baza
../.venv/bin/python -m app.cli backup --with-media # baza + rasmlar
```
Nusxalar `data/backups/` papkasiga tushadi, **oxirgi 30 tasi** saqlanadi (eskilari o'zi o'chadi).
Server ishlab turganda ham xavfsiz.

**Har kuni avtomatik (Linux, cron):** `crontab -e` buyrug'i bilan quyidagi qatorni qo'shing
(yo'lni o'zingiznikiga moslang) — har kecha soat 02:30 da:
```cron
30 2 * * * cd /opt/smart-start/backend && ../.venv/bin/python -m app.cli backup --with-media >> ../data/logs/backup.log 2>&1
```
**Windows:** «Task Scheduler» → yangi vazifa → har kuni 02:30 →
dastur: `C:\smart-start\.venv\Scripts\python.exe`, argument: `-m app.cli backup --with-media`,
papka: `C:\smart-start\backend`.

Docker orqali zaxira olish va tiklash uchun [DEPLOYMENT.md](DEPLOYMENT.md) fayliga qarang.

---

## 9. Foydali buyruqlar

(`backend/` papkasida, virtual muhit faollashtirilgan holda: Linux `source ../.venv/bin/activate`, Windows `..\.venv\Scripts\activate`)

| Buyruq | Vazifasi |
| --- | --- |
| `python -m app.cli seed` | bo'sh bazaga boshlang'ich ma'lumotlarni yuklash |
| `python -m app.cli seed --reset` | **hamma narsani o'chirib**, demo holatga qaytarish |
| `python -m app.cli clear-demo` | demo arizalar va yozilishlarni o'chirish (kontent qoladi) |
| `python -m app.cli create-user --email x@smartstart.uz --name "Ism" --role manager` | xodim qo'shish (parol so'raladi) |
| `python -m app.cli create-user --email x@smartstart.uz --role admin --update` | parol/rolni tiklash |
| `python -m app.cli backup --with-media` | zaxira nusxa |
| `python -m pytest -q` | avtomatik testlar |

---

## 10. Demo ma'lumotlar haqida

Boshlang'ich bazada eski saytdagi **haqiqiy** matnlar bor: 3 tildagi tavsiflar, 4 o'qituvchi, 6 hamkor universitet,
3 ta ta'lim bosqichi, kun tartibi, ota-onalar fikrlari, yangiliklar, 21 ta sertifikat, aloqa (+998 90 994 74 07, Chilonzor).

Quyidagilar **DEMO** — haqiqiy qiymatlar bilan almashtiring:
- **Narxlar** (oyiga 4,5 / 5,2 / 5,9 mln so'm, ovqat 900 ming, transport 500 ming) va **FAQ javoblari**;
- **~40 ta ariza** («Demo Ota-ona 01…», telefonlar +99890000…) va ekskursiyaga yozilganlar («Demo Mehmon…») —
  saytni ishga tushirishdan oldin ularni bitta buyruq bilan o'chiring (kontent saqlanib qoladi):
  `python -m app.cli clear-demo`;
- **O'qituvchi rasmlari** va **universitet logotiplari** — vaqtinchalik (bosh harflar); haqiqiysini yuklang;
- Eski saytda 21 sertifikatdan faqat 5 tasining skani bor edi; qolgan 16 tasi uchun «Natija kartasi» rasmi
  yaratilgan — asl skanlarni admin paneldan yuklang;
- Xarita nuqtasi (Chilonzor, Bunyodkor shoh ko'chasi) taxminiy — admin panel → Sahifalar → Aloqa'da aniq
  koordinatani kiriting. Instagram manzili bo'sh — Sozlamalarda kiriting.
- Hamkor universitetlar reytingi (QS 2025) eski saytdan olingan; ayniqsa «Oxford International College — QS #1»
  ni tekshiring (QS #1 bu kollejga tegishli emas).

**Sertifikatlar va shaxsiy ma'lumotlar:** saytda faqat `parent_consent = true` (ota-ona roziligi bor) sertifikatlar
chiqadi. Asl skan yopiq papkada (`media/private`) saqlanadi; saytga siqilgan nusxa chiqadi, unda hujjat raqami va
pasport seriyasi xiralashtiriladi (`redact_regions`). Sertifikat raqami API'da ham yashiriladi (`24B•••••••••AM`).

---

## 11. Internetga joylash

[DEPLOYMENT.md](DEPLOYMENT.md) faylida HTTPS, muhit o‘zgaruvchilari, bazani saqlash va zaxira nusxalari bo‘yicha ko‘rsatmalar berilgan.
