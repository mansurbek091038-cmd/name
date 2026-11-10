# Smart Start production deployment

Smart Start runs as one web service. FastAPI serves the React build, the
`/api/v1` API, and public media on the same HTTPS origin. Configure your
hosting plan for one long-running Python process or a Docker container with
persistent storage. Unpack the archive into a private application directory
outside any public document root.

## Deploy the included site and data

1. Extract the ZIP. Copy `.env.example` to `.env` and set the following.
   Keep `DATABASE_URL` empty to use the included SQLite database.

   ```dotenv
   APP_ENV=production
   SITE_URL=https://school.example.com
   SECRET_KEY=replace-with-a-unique-generated-value
   AUTO_SEED=false
   CORS_ORIGINS=
   DATABASE_URL=
   ```

   Generate the secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
   Use the same value across restarts. The archive contains a consistent
   `data/smartstart.db` snapshot and matching `media/`. Keep both on writable
   persistent storage. Every bundled staff account starts disabled, and
   previous sessions and 2FA credentials have been cleared.

2. Build the container and set the administrator password before exposing the
   service. Use a new, unique password when prompted.

   ```sh
   docker compose build
   docker compose run --rm app python -m app.cli create-user \
     --email admin@smartstart.uz --role super_admin --update
   docker compose up -d
   ```

   The container runs as UID/GID 1000 by default. If the extracted directories
   belong to a different Linux account, set `APP_UID` and `APP_GID` in `.env` to
   that account's numeric IDs. The account must be able to write both directories.

3. Point the HTTPS reverse proxy at `127.0.0.1:8000`. Preserve the public Host
   and forward the HTTPS scheme. Have the proxy set or correctly append the
   actual client IP. Set `TRUST_PROXY=true` and `FORWARDED_ALLOW_IPS` to the exact
   proxy IP or CIDR as seen inside the app container. For a host-side proxy,
   that is typically the Docker bridge gateway. Set the proxy request-body
   limit above `MAX_UPLOAD_MB` to allow for multipart overhead. For example,
   use 16 MiB with the default 15 MiB application upload limit.

4. Check `https://school.example.com/api/v1/health` and sign in at `/admin`.
   Confirm the school content and existing certificate consent settings before
   publishing. Re-enroll staff 2FA after account recovery if you use it. The
   manager account can be reactivated with the same command using
   `--email manager@smartstart.uz --role manager --update`.

The local Compose port can be changed with `HOST_PORT`. The application reads
`PORT` (default `8000`) and `HOST` (default `0.0.0.0`) from the process environment.
For a platform that runs the Dockerfile directly, mount `/app/data` and
`/app/media` and restore the two included directories there before the first
start. The image contains the application and built frontend. Configure platform
secrets and the health check in the hosting dashboard.

## Deploy on a Python host

The ZIP includes the built frontend. From the extracted project root:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cd backend
../.venv/bin/python -m app.cli create-user \
  --email admin@smartstart.uz --role super_admin --update
HOST=0.0.0.0 PORT=8000 ../.venv/bin/python -m app.serve
```

If the platform injects `PORT`, use `../.venv/bin/python -m app.serve` directly.
For a system service behind a reverse proxy on the same host, bind to
`127.0.0.1`. Set the working directory to `backend/`. Use Python 3.12 and keep one
worker and one replica because the rate limiter and SQLite booking lock are
process-local. Uvicorn handles SIGTERM, allows up to 30 seconds for active
requests to finish, and closes the database pool on shutdown.

To rebuild after editing the frontend, run the following from the project
root using Node.js 24 and npm.

```sh
npm --prefix frontend ci
npm --prefix frontend run build
```

## Database, data and backups

- SQLite uses foreign keys, WAL and a busy timeout. Use a persistent local
  filesystem for the database and keep `media/` with it. For a custom
  persistent path, set `DATA_DIR` and `MEDIA_ROOT`; place the bundled SQLite
  file at `DATA_DIR/smartstart.db`.
- For a separate PostgreSQL database, set `DATABASE_URL` to a
  `postgresql://` connection URL, including the provider's TLS options.
  SQLAlchemy selects the psycopg driver and creates the schema at startup.
  A new PostgreSQL database starts empty. The included snapshot is SQLite.
  Use the SQLite deployment to retain the supplied records unless you migrate
  them separately. Keep the media volume even with PostgreSQL.
- The included snapshot retains the source admissions, bookings, messages,
  audit history, content and uploaded media. The supplied CRM includes demo
  records. To remove the original demo applications, messages and bookings
  while keeping public content, use `python -m app.cli clear-demo` from
  `backend/`, or `docker compose exec app python -m app.cli clear-demo`.
  Review the supplied tour slots, prices and placeholders before going live.
- Run `docker compose exec -T app python -m app.cli backup --with-media`
  periodically from the project root, for example in the host's scheduler at
  02:00 Asia/Tashkent. The native equivalent from `backend/` is
  `../.venv/bin/python -m app.cli backup --with-media`. By default backups land
  in `data/backups/` and the latest 30 of each kind are kept. Use a
  `pg_dump` client at least as new as your PostgreSQL server for PostgreSQL
  backups. Restrict backup access and keep an off-host copy.
- When moving an existing live deployment, stop writes before restoring the
  database and media together. For SQLite restore with the service stopped,
  unpack the database backup to `data/smartstart.db` and remove stale
  `smartstart.db-wal` and `smartstart.db-shm` from the old instance. Restore
  the matching media tree to `media/`.

## Operational checks

| Check | Expected result |
| --- | --- |
| `GET /api/v1/health` | HTTP 200 and `"db":"ok"`. HTTP 503 if the database check fails. |
| `GET /natijalar` | React loads after a direct visit and calls the relative API. |
| `GET /admin` | Staff sign-in over HTTPS with Secure, HttpOnly cookies. |
| Certificate upload | The derived image is served according to consent. Originals require a staff session. |
| Logs | HTTP status and timing in process logs. Application logs also rotate under `data/logs/`. |
| Notifications | Set Telegram, Eskiz or Turnstile credentials if those integrations are used. |

This package is intended for private upload to the hosting environment.
The snapshot and media include records and original files from the supplied
project.
