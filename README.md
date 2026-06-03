# BleMap

> *Find the fires nobody is putting out.*

Problem intelligence platform: validate and structure real-world problems, plot them on a pain-vs-solutions matrix, and let **Prospectors** claim high-gap work.

![BleMap logo](frontend/assets/logo.jpeg)

---

## How to run the application

BleMap is **one app**: a single **Node/Express backend** serves the UI and the REST API. You do **not** start a separate frontend dev server.

| What runs | Command | URL |
|-----------|---------|-----|
| Backend + frontend | `npm run dev` | **http://localhost:4000** |

Do **not** open HTML files from Finder (`file://`). Do **not** use `localhost` without port **4000** unless something else is proxying to 4000.

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm

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
| `GEMINI_API_KEY` | Real AI on submit (else heuristic) |
| `CONFIRMATIONS_REQUIRED` | Default `5` |

### Sign-up & auth

Auth runs in the browser against **Supabase** (defaults in `shared/supabasePublic.js`, overridable via `.env` and `/config.js`). Case data uses the **Express API** on the same origin.

1. Use **http://localhost:4000** (not `file://`).
2. Use a **real email** (avoid `@example.com`).
3. For local dev, in Supabase Dashboard → **Authentication** → **Providers** → **Email**, turn off **Confirm email** so you can sign in immediately after register.
4. Run `database/migrations/003_auth_profile_trigger.sql` in the Supabase SQL editor if profiles fail to create.

**“Email rate limit exceeded”** — Supabase temporarily blocked more auth emails (too many sign-ups or resends). Wait 15–60 minutes, use a different email (e.g. `you+test2@gmail.com`), or disable confirm-email for dev.

---

## Features

| Feature | Status |
|---------|--------|
| Express API + in-memory / Supabase | ✅ |
| AI submit + confirm-before-post | ✅ |
| Community validation → matrix | ✅ |
| Gap score + matrix | ✅ |
| Reddit scrape | ✅ |
| Prospector view | ✅ |

Docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/ERD.md`](docs/ERD.md) · [`docs/DEMO.md`](docs/DEMO.md)

---

## Team

| Name | Role |
|------|------|
| Dicdican | CEO |
| Sheikh | CTO |
| Merin | CFO |
