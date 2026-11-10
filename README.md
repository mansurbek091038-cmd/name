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
va serverni **8000-portda** ishga tushiradi. Ma'lumotlar bazasi (SQLite, `data/smartstart.db`) birinchi
ishga tushishda **o'zi yaratiladi va demo ma'lumotlar bilan to'ldiriladi**.

### Docker (server uchun tavsiya etiladi)
```bash
cp .env.example .env        # kerak bo'lsa tahrirlang (POSTGRES_PASSWORD, SITE_URL…)
docker compose up -d --build
```
Bu uchta xizmatni ishga tushiradi:

| Xizmat | Vazifasi |
| --- | --- |
| `app` | sayt + API (port 8000), frontend ham shu yerda yig'iladi |
| `db` | PostgreSQL 15 ma'lumotlar bazasi |
| `backup` | har kecha **02:00** da baza va rasmlarning zaxira nusxasi → `./backups/` (bazadan oxirgi 30 ta, rasmlardan oxirgi 7 ta) |

---

## 2. Demo kirish ma'lumotlari

Admin panel: **<http://localhost:8000/admin>**

| Rol | Email | Parol |
| --- | --- | --- |
| Super admin | `admin@smartstart.uz` | `SmartStart2026!` |
| Menejer | `manager@smartstart.uz` | `Manager2026!` |

> ⚠️ Saytni internetga chiqarishdan oldin bu parollarni **albatta o'zgartiring** (admin panel → profil,
> yoki `python -m app.cli create-user --email admin@smartstart.uz --role super_admin --update`).

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

To'liq kelishuv (frontend bilan) — `../API_CONTRACT.md`.

---

## 6. Loyiha tuzilmasi

```
smart-start/
├── run.sh / run.bat          ← bitta buyruq bilan ishga tushirish
├── requirements.txt          ← Python kutubxonalari
├── .env.example              ← sozlamalar namunasi (izohlar o'zbekcha)
├── Dockerfile, docker-compose.yml, deploy/backup.sh
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

Sayt ko'rinishi o'zgartirilgandan keyin (Node.js 20+ kerak):
```bash
cd frontend && npm install && npm run build
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

**Docker:** `backup` xizmati buni o'zi qiladi (`./backups/` papkasi).

**Tiklash:** SQLite — `.db.gz` faylni oching (gunzip) va `data/smartstart.db` o'rniga qo'ying (server to'xtatilgan holda).
PostgreSQL — `gunzip -c fayl.sql.gz | docker compose exec -T db psql -U smartstart smartstart`.
Zaxira nusxalarni boshqa joyga (boshqa server yoki bulut) ham ko'chirib turing.

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

## 11. Internetga joylash (deploy) bo'yicha eslatmalar

- Server O'zbekiston hududida bo'lishi kerak (shaxsiy ma'lumotlar qonuni). 2 vCPU / 4 GB RAM yetarli.
- `.env` da: `APP_ENV=production`, `SITE_URL=https://smartstart.uz`, kuchli `POSTGRES_PASSWORD`,
  `CORS_ORIGINS=` (bo'sh — sayt va API bitta domenda bo'lgani uchun).
- HTTPS majburiy: oldiga **Caddy** yoki **Nginx** qo'ying. Eng oddiy yo'l — Caddy:
  ```
  smartstart.uz {
      reverse_proxy 127.0.0.1:8000
  }
  ```
  (Caddy SSL sertifikatini o'zi oladi.) Proxy orqasida `TRUST_PROXY=true` bo'lsin — Docker'da allaqachon yoqilgan.
- Server **bitta jarayon (worker)** bilan ishlaydi — so'rovlar cheklovi xotirada saqlanadi; maktab sayti uchun bu yetarli.
- Demo parollarni o'zgartiring, admin uchun 2FA ni yoqing.
- Monitoring: `https://smartstart.uz/api/v1/health` ni UptimeRobot kabi xizmatga qo'shing. Xatolar uchun
  `SENTRY_DSN` (+ `pip install sentry-sdk`). Loglar: `data/logs/app.log`.
- Google Search Console va Yandex Webmaster'ga `https://smartstart.uz/sitemap.xml` ni yuboring.

---

## Frontend

Sayt va admin panel: React 19 + TypeScript + Vite, `frontend/` papkasida. Batafsil: `frontend/README_FRONTEND.md`.

**Ishlab chiqish (dev):** backend `:8000` da ishlab tursin, keyin:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 — /api, /media, /sitemap.xml → 127.0.0.1:8000 ga proksi
```

**Yig'ish (build):**

```bash
cd frontend
npm run build        # avval tsc --noEmit, so'ng natija backend/app/static ga yoziladi
```

So'ng sayt `http://localhost:8000`, admin panel `http://localhost:8000/admin` da ochiladi.

**Tuzilma:** `src/pages` — sayt sahifalari, `src/components` — umumiy bloklar (sertifikatlar, formalar, globus),
`src/admin` — admin panel (alohida yuklanadi), `src/lib` — API mijozi, i18n, yordamchilar,
`src/i18n/dict.ts` — interfeys yozuvlari (uz/ru/en), `src/three` — three.js globus, `src/styles` — dizayn tokenlari va CSS.
Barcha kontent API dan `?lang=` bilan olinadi; til URL'da `?lang=ru|en` ko'rinishida saqlanadi.
"# name" 
# name
