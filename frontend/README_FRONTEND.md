# Smart Start — frontend (sayt + admin panel)

React 19 + TypeScript (strict) + Vite + react-router. Animatsiyalar — `motion`, 3D globus — `three.js`,
ikonkalar — `lucide-react`, shriftlar — `@fontsource` (Lora + Manrope, CDN'siz). Uslub — oddiy CSS fayllar
(dizayn tokenlari `src/styles/tokens.css` da).

Dizayn: tasdiqlangan maket (fil suyagi fon `#FBF8F1`, to‘q ko‘k `#0D1B36`, oltin `#C9962B / #E8B84A`).
Kunduzgi rejim asosiy; tungi rejim header'dagi tugma bilan yoqiladi.

## Ishga tushirish (dev)

Backend `:8000` portida ishlab turishi kerak (`backend/README` ga qarang).

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:5173` ochiladi. Vite `/api`, `/media`, `/sitemap.xml`, `/robots.txt` so‘rovlarini
`http://127.0.0.1:8000` ga proksi qiladi (boshqa manzil uchun: `SS_API=http://host:port npm run dev`).

## Yig‘ish (build)

```bash
npm run build      # tsc --noEmit + vite build
npm run typecheck  # faqat tiplarni tekshirish
```

Natija `../backend/app/static` ga yoziladi (papka har safar tozalanadi). Backend uni o‘zi ochib beradi:
sayt — `http://localhost:8000`, admin — `http://localhost:8000/admin`.

## Tuzilma

```
frontend/
  index.html              ← tema skripti, bosh sahifa uchun tezkor "shell" (LCP), header shell
  public/brand/           ← logotip (webp), favicon
  src/
    main.tsx, App.tsx     ← kirish nuqtasi, router, sahifa o‘tish animatsiyasi
    routes.ts             ← sahifalarni kech yuklash (lazy) va oldindan isitish
    i18n/dict.ts          ← faqat interfeys yozuvlari (uz / ru / en)
    lib/
      api.ts              ← fetch mijozi: credentials:'include', 401 da avtomatik refresh, {code,message} xatolar
      query.ts            ← kichik kesh + useQuery (stale-while-revalidate)
      i18n.tsx            ← til (?lang=), <Em>, AccentTitle, o‘zbekcha tipografiya
      seo.ts, analytics.ts, format.ts, hooks.ts, types.ts
    components/           ← Header, Footer, formalar (+998 maska, UTM), TourBooking, PartnersGlobe,
                            cert/ (CertFan, CertCard, CertModal, PNG eksport), sections.tsx
    pages/                ← Home (+HomeRest), Results, Teachers, Admission, News, Article,
                            Gallery, Contact, Thanks, Privacy, NotFound
    three/globe.ts        ← nuqtali globus + Toshkentdan oltin yoylar (alohida chunk)
    admin/                ← admin panel (alohida chunk): Login (2FA), Dashboard (SVG grafiklar),
                            Admissions (jadval/kanban/drawer), Resource (umumiy CRUD, uz/ru/en tablar),
                            PagesEditor (JSON-aware bloklar), Tours, Messages, Users, Settings, Audit, Profile
    styles/               ← tokens, base, ui, layout, home, pages, cert, admin
```

## Muhim qoidalar

- Kontent faqat API dan olinadi (`?lang=uz|ru|en`); kodda faqat interfeys yozuvlari bor.
- Til URL'da: o‘zbekcha — parametrsiz, ruscha/inglizcha — `?lang=ru` / `?lang=en` (backend sitemap va hreflang bilan bir xil).
  Tanlangan til `localStorage` da eslab qolinadi.
- Sahifalar, admin panel va three.js kech yuklanadi; globus ekrandan chiqqanda to‘xtaydi.
- `prefers-reduced-motion` hurmat qilinadi (parallaks, egilish va kirish animatsiyalari o‘chadi).
- Admin menyusi rolga qarab ko‘rsatiladi: menejer → arizalar va kontent; admin → + dashboard, eksport,
  sozlamalar, audit; super admin → + foydalanuvchilar.

Demo kirish: `admin@smartstart.uz` / `SmartStart2026!`
