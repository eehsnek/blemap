# BleMap

> *Find the fires nobody is putting out.*

Problem intelligence platform: validate and structure real-world problems, plot them on a pain-vs-solutions matrix, and let **Prospectors** claim high-gap work.

![BleMap logo](frontend/assets/logo.jpeg)

---

## Primary application (Main SPA)

**This repo’s supported product is the Main SPA** at the repository root:

| Piece | Path |
|-------|------|
| Server | `backend/server.js` |
| UI | `frontend/app.html` (+ hash router views) |
| Run | `npm run dev` → **http://localhost:4000** |

## How to run the application

BleMap is **one app**: a single **Node/Express backend** serves the UI and the REST API. You do **not** start a separate frontend dev server.

| What runs | Command | URL |
|-----------|---------|-----|
| Backend + frontend | `npm run dev` | **http://localhost:4000** |

Do **not** open HTML files from Finder (`file://`). Do **not** use `localhost` without port **4000** unless something else is proxying to 4000.

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- Optional embeddings: Python 3.10+ (MiniLM service on `:8000`)

### 1. Install

```bash
git clone https://github.com/ghkenshee/blemap.git
cd blemap
npm install
cp .env.example .env    # optional — see Environment below
```

### 2. Start the server (keep this terminal open)

```bash
npm run dev
```

You should see:

```text
BleMap server http://localhost:4000
  App:         http://localhost:4000/frontend/app.html
```

- `npm run dev` — frees port **4000** if needed, then runs `backend/server.js` with auto-reload.
- `npm start` — same server, no file watching.

**Only run one** `npm run dev` at a time. Closing the terminal or pressing Ctrl+C stops the app.

### 3. Open in the browser

Use the **full URL**:

**http://localhost:4000**

That redirects to the SPA entry:

**http://localhost:4000/frontend/app.html**

**Flow:** Sign in / Register → **Home** (sidebar: Submit, Matrix, Prospector).

| Section | How to open |
|---------|-------------|
| Sign in / Register | Shown when logged out |
| Home | Sidebar → Home |
| Submit a case | Sidebar → Submit |
| Case matrix | Sidebar → Matrix |
| Prospector | Sidebar → Prospector |
| Case detail | Click a case card or matrix bubble |

Old bookmarks (`home.html`, `caseMatrix.html`, `input.html`, etc.) redirect into the app with the right hash route.

### 4. Verify the server is running

```bash
curl http://localhost:4000/health
```

Expected: `{"ok":true,"store":"memory"}` (or `"supabase"` if you configured the database).

If Safari says **“Can’t Connect to the Server”**, the dev server is not running — go back to step 2.

### Troubleshooting

**Port 4000 already in use**

```bash
npm run predev
npm run dev
```

If you see `Failed running 'backend/server.js'. Waiting for file changes…`, stop other Node processes (Ctrl+C in other terminals), then run `predev` and `dev` again.

**Blank page, stuck on “Loading…”, or buttons do nothing**

1. Confirm the URL is **http://localhost:4000** (with `:4000`).
2. Confirm `npm run dev` is still running.
3. Hard refresh: **Cmd+Shift+R** (Safari: enable **Develop** menu → **Empty Caches**, then refresh).
4. Check the browser console for red errors.

**Sign-up / login errors**

See [Sign-up & auth](#sign-up--auth) below.

### Run tests

```bash
npm test
```

---

## Frontend ↔ backend connection

```
Browser
  ├── /config.js          → Supabase URL + anon key (from server env or defaults)
  ├── /frontend/*         → static UI (logo at /frontend/assets/logo.jpeg)
  └── /api/*              → Express routes (cases, submit, scrape, …)
        └── store         → in-memory (default) or Supabase (with .env keys)
```

- **`/config.js`** — injected at runtime so the UI and API share the same origin (`http://localhost:4000`).
- **`frontend/api.js`** — all data calls go to `/api/...` with Supabase JWT when logged in.
- **`frontend/config.js`** — reads `window.__BLEMAP_CONFIG` from the server; falls back to shared defaults in `shared/supabasePublic.js`.

Auth (sign-up / login) uses **Supabase** from the browser; case data uses the **Express API**.

---

## Project layout

```
blemap/
├── frontend/
│   ├── app.html           # SPA entry (use via http://localhost:4000)
│   ├── app.js             # Boot, routing, auth shell
│   ├── auth-init.js       # Wires sign-in UI early
│   ├── api.js             # Calls /api/* with JWT
│   ├── assets/logo.jpeg
│   └── views/             # Home, Submit, Matrix, Prospector, Case
├── backend/
│   ├── server.js          # Express: static + /api + /config.js
│   └── routes/api.js
├── shared/supabasePublic.js
└── database/migrations/
```

---

## Environment (optional)

Copy `.env.example` to `.env`:

| Variable | Purpose |
|----------|---------|
| `PORT` | Default `4000` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Auth + `/config.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | Persist cases in Supabase instead of memory |
| `GEMINI_API_KEY` | AI for submit + **required for production scrape** ([Google AI Studio](https://aistudio.google.com/apikey)) |
| `GEMINI_MODEL` | Default `gemini-3.6-flash` (do not use retired `gemini-2.0-flash`) |
| `CRON_SECRET` | Secures `POST /api/scrape/run` (Vercel cron uses Bearer token when set) |
| `REDDIT_SUBREDDITS` | Comma-separated subreddits for automation |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | **Required for scrape** — [Reddit app prefs](https://www.reddit.com/prefs/apps) |
| `REDDIT_USERNAME` / `REDDIT_PASSWORD` | For **script**-type apps only (your Reddit login) |
| `REDDIT_USER_AGENT` | e.g. `web:BleMap:v1.0.0 (by /u/YourUsername)` |
| `SCRAPE_PUBLISH_MODE` | `auto` (publish valid scrapes) or `pending` (community confirm first) |
| `SOLVE_AI_ENFORCE` | `true` to reject irrelevant solutions on submit; default advisory via `/solve/analyze` |
| `NOTIFY_HIGH_GAP_THRESHOLD` | Prospector high-gap toast threshold (default `70`) |
| `CONFIRMATIONS_REQUIRED` | Default `5` (user submit only) |

### Automation (AI + Reddit)

1. Set `GEMINI_API_KEY` in `.env` (heuristic fallback works locally without it; production scrape returns 503 without it).
2. Optional: set `CRON_SECRET` — then manual runs use `npm run scrape` or Prospector while signed in.
3. **Local:** `npm run dev` in one terminal, `npm run scrape` in another.
4. **Vercel:** set `CRON_SECRET`, `GEMINI_API_KEY`, and Supabase keys. Cron runs every 6h (`vercel.json`). Run [`database/migrations/004_precase_automation.sql`](database/migrations/004_precase_automation.sql) in Supabase for precase status + scrape logs.
5. Check last run: `GET /api/ingestion/status`
6. Run migration [`database/migrations/005_case_events.sql`](database/migrations/005_case_events.sql) for activity audit + Supabase Realtime

### Live updates & metrics API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/metrics/summary` | Aggregate counts by domain, quadrant, ingest funnel |
| `GET /api/activity/recent?limit=20` | Living Archive activity feed |
| `GET /api/cases/:id/events` | Per-case audit trail |
| `GET /api/cases?q=&domain=&status=&lifecycle_state=&limit=&offset=` | Search and filter |
| `POST /api/cases/:id/solve/analyze` | Advisory AI feedback before submitting a solution |

Matrix and Prospector poll every 60s; Supabase Realtime pushes updates when `store=supabase`.

**Scrape without Reddit** — By default, ingest uses **Hacker News** (Ask + New stories, no API key). Prospector → **Run ingest scrape**, or `npm run scrape`.

**Reddit (optional)** — If you add `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`, Reddit is included automatically. For a **script** app, also set `REDDIT_USERNAME` and `REDDIT_PASSWORD`. Override sources with `SCRAPE_SOURCES=hackernews` or `SCRAPE_SOURCES=hackernews,reddit`.

### Sign-up & auth

Auth runs in the browser against **Supabase** (defaults in `shared/supabasePublic.js`, overridable via `.env` and `/config.js`). Case data uses the **Express API** on the same origin.

1. Use **http://localhost:4000** (not `file://`).
2. Use a **real email** (avoid `@example.com`).
3. For local dev, either:
   - Dashboard → **Authentication** → **Providers** → **Email** → turn off **Confirm email**, and set Site URL `http://localhost:4000` under URL configuration, **or**
   - Run `npm run configure:auth` (with optional `SUPABASE_ACCESS_TOKEN` for Dashboard settings; otherwise SPA uses `POST /api/dev/confirm-email` in non-production).
4. Run `database/migrations/003_auth_profile_trigger.sql` in the Supabase SQL editor if profiles fail to create.
5. Enable Realtime on `cases`, `case_events`, `scrape_runs` (or run `database/migrations/007_realtime_publication.sql`).
6. Verify the full path: `npm start` then `SMOKE_SKIP_SCRAPE=1 npm run smoke` (sign-up → confirm → submit → 5 validates → published).

### Embeddings (MiniLM)

Same model as Summer (`all-MiniLM-L6-v2`, 384-dim):

1. Migration [`database/migrations/008_case_embeddings.sql`](database/migrations/008_case_embeddings.sql) adds `cases.embedding` + `match_cases` RPC (already applied on the connected project).
2. Default: **in-process** embeddings via `@xenova/transformers` (no Python).
3. Optional FastAPI service (Python 3.10–3.12): `cd services/embedding && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt` then `npm run embed:serve` and set `EMBEDDING_PREFER_HTTP=1`.
4. Backfill existing cases: `npm run embed:rebuild`.
5. Submit/scrape **merge into an existing case** when similarity ≥ `EMBEDDING_MERGE_THRESHOLD` (default `0.65`); weaker matches (default ≥ `0.5`) appear as suggestions you can pick. Case detail also shows **Related cases**.

**Reusing the Summer Supabase project** — Yes. Point `.env` at that project and run [`database/migrations/006_main_compat_on_summer.sql`](database/migrations/006_main_compat_on_summer.sql). See [`database/MIGRATE_SUMMER_SUPABASE.md`](database/MIGRATE_SUMMER_SUPABASE.md).

**“Email rate limit exceeded”** — Supabase temporarily blocked more auth emails (too many sign-ups or resends). Wait 15–60 minutes, use a different email (e.g. `you+test2@gmail.com`), or disable confirm-email for dev.

---

## Features

| Feature | Status |
|---------|--------|
| Express API + in-memory / Supabase | ✅ |
| AI submit + confirm-before-post | ✅ |
| Community validation → matrix | ✅ |
| Gap score + matrix | ✅ |
| Live matrix refresh + metrics summary | ✅ |
| Activity feed + case_events audit | ✅ |
| Search/filter cases | ✅ |
| AI solve validation (advisory) | ✅ |
| HN + Reddit scrape + scheduled automation | ✅ |
| MiniLM embeddings + related cases / merge | ✅ |
| Prospector view | ✅ |

Docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/ERD.md`](docs/ERD.md) · [`docs/DEMO.md`](docs/DEMO.md)

---

## Team

| Name | Role |
|------|------|
| Dicdican | CEO |
| Sheikh | CTO |
| Merin | CFO |
