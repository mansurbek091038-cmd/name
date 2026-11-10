# Smart Start audit and verification

## Application inventory

| Layer | Implementation |
| --- | --- |
| Browser | React 19.3.1 with TypeScript 5.9.3, React Router 7.18.5, Motion and Three.js. Entry points are `frontend/index.html`, `frontend/src/main.tsx` and `frontend/src/App.tsx`. Public and staff pages use BrowserRouter with lazy route modules. |
| Build | npm lockfile, Node.js 24, Vite 8.3.6 and React plugin 6.2.1. `npm run build` type-checks and writes the browser bundle, fonts and static brand assets to `backend/app/static/`. |
| API | Python 3.12, FastAPI 0.162.0, Starlette 1.7.0 and Uvicorn 0.54.0. `backend/app/main.py` mounts `/api/v1`, built assets and public media before the HTML fallback. `python -m app.serve` starts the production server from `backend/`. |
| Client contract | `frontend/src/lib/api.ts` uses same-origin `/api/v1`, JSON bodies, multipart uploads, raw downloads and a shared in-flight refresh. Its development-only Vite proxy uses `SS_API`. Production URLs for SEO and notifications come from `SITE_URL`. Swagger and OpenAPI are available at `/api/docs` and `/api/openapi.json`. |
| Authentication | Staff accounts are provisioned by CLI or a super admin. Access JWT and rotating refresh token use HttpOnly cookies with Secure enabled in production. API clients can supply a bearer access token. Staff roles are manager, admin and super admin. TOTP is optional. |
| Middleware | Structured API errors, CORS, gzip, security headers, cache controls and request timing. Rate limiting runs in process. Cookie-authenticated writes check Origin or Referer when supplied. |
| Storage | SQLAlchemy 2.1.8, SQLite by default and psycopg 3.3.8 for PostgreSQL. Config lives in `backend/app/core/config.py` and sessions, initial DDL and schema versioning in `backend/app/core/db.py`. |
| Media and jobs | Pillow generates WebP variants. Admin APIs accept image uploads and private PDFs; original files use staff-authorized routes. Telegram and SMS notifications are FastAPI background tasks after the request record is committed. There is no separate queue worker. |

## Routes and data model

| Module | Routes under `/api/v1` | Tables and relationships |
| --- | --- | --- |
| Staff | `/auth/*`, `/admin/users`, `/admin/staff`, `/admin/audit-log` | `users`, `refresh_tokens`, `audit_log`. Tokens reference users with cascade delete. Audit actor references may be null. |
| Public content and admin CMS | `/public/pages/{key}`, `/public/posts`, `/public/certificates`, `/admin/certificates`, and other content routes | `posts`, `pages`, `teachers`, `prices`, `faqs`, `testimonials`, `certificates`, `partners`. Content and certificate images reference media. Certificates also reference original images and consent files. |
| Admissions | `/public/admissions`, `/public/contact`, `/admin/admissions`, `/admin/messages` | `admissions`, `admission_notes`, `contact_messages`. Admissions optionally reference a staff assignee. Notes cascade with their application. |
| Tours | `/public/tours`, `/public/tours/{id}/book`, `/admin/tours` | `tours`, `tour_bookings`. Bookings reference tours with cascade delete. PostgreSQL uses row locks for capacity updates, and SQLite uses a process lock. |
| Media | `/public/albums`, `/admin/media`, `/admin/albums` | `media`, `albums`. Media can reference an album and uploader. Albums can reference cover media. |
| Notifications and exports | `/public/settings`, `/admin/settings`, `/admin/reports/dashboard`, `/admin/admissions/export` | `site_settings`, `notification_log`. Reports query existing admissions, tours and contact data. |
| Schema | Startup | `schema_version` is at version 1. Models use integer primary keys except for the setting key. The uploaded schema has 21 tables and 31 indexes, including unique staff email, token JTI, media key, post slug, page key and admission number. There are no pending versioned migrations. |

## Changes for hosting

- Rebuilt the frontend from the npm lockfile. FastAPI continues to serve React, the API and the original route structure under one domain.
- Replaced the default deployment's empty PostgreSQL database with the supplied SQLite snapshot and matching media mounted as persistent directories. PostgreSQL remains configurable through `DATABASE_URL`. The Docker build excludes runtime data, media and environment secrets.
- Consolidated production launch settings, restricted forwarded header trust to configured proxies, and made database readiness return HTTP 503 on failure. Production requires an HTTPS origin, a signing secret and Secure cookies.
- Removed the supplied signing key, stored staff password hashes, refresh sessions and 2FA seeds from the release. Production blocks demo seeding. Provisioning an administrator restores access to the existing account and records.
- Protected certificate image variants when consent is absent or withdrawn, including previously known direct URLs. Admin certificate previews still use authenticated media access.
- Documented hosted and native deployments, persistent data, PostgreSQL connectivity, password provisioning, backups and restoration in `DEPLOYMENT.md`. Backups can be scheduled via the host. PostgreSQL backup preserves connection options such as `sslmode`.

## Verification performed

- Clean `npm ci`, TypeScript type check and Vite production build on Node.js 24.22.1.
- All 53 backend tests passed against SQLite and all 53 passed against PostgreSQL 16.2, including backup tests and direct certificate-image consent regression.
- SQLite integrity and foreign key checks passed. All paths recorded in the 59 media rows resolved to files.
- Production-mode HTTPS request tests passed for deep links, referenced frontend assets, certificate search and consent, staff login, Secure and HttpOnly cookies, refresh, logout, private upload/download and XLSX export.
- The Uvicorn launcher started on a custom port, returned a healthy database status and shut down cleanly.
- Docker and browser execution could not be verified in this environment. Docker was unavailable, and Chromium was blocked by the runtime's socket restrictions. Telegram, Eskiz and Turnstile were not tested with live provider credentials. The backend test runner reports a Starlette TestClient deprecation warning.
