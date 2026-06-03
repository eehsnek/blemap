# BleMap

> *Find the fires nobody is putting out.*

BleMap is a problem intelligence platform where real-world problems are scraped from the internet, validated and converged by AI, and displayed on a two-axis matrix — so that Prospectors can discover, claim, and solve them.

---

## Current status (Iteration 1)

| Area | Status |
|------|--------|
| Express API (`/api/*`) | ✅ In repo — runs with in-memory demo data by default |
| Frontend (auth, home, matrix, case detail, submit) | ✅ Wired to same-origin API |
| Supabase persistence | Optional — set `SUPABASE_SERVICE_ROLE_KEY` + run migrations |
| Gemini AI / Reddit scraper | 🔜 Planned (Iterations 2–3) |

---

## Quick start

```bash
git clone https://github.com/ghkenshee/blemap.git
cd blemap
npm install
cp .env.example .env   # optional — only needed for Supabase-backed storage
npm run dev
```

Open **http://localhost:4000** — login, home feed, case matrix, and submission all use the local API.

```bash
npm test
```

---

## Project structure

```
blemap/
├── backend/
│   ├── server.js          # Express app + static frontend
│   ├── routes/api.js      # REST endpoints
│   └── store/             # Memory (default) or Supabase adapter
├── frontend/              # HTML + ES modules
├── database/
│   ├── migrations/        # SQL for Supabase
│   └── supabase.js        # Browser auth client
├── tests/
├── documentation.md       # Full product spec
└── .env.example
```

---

## API (implemented)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server + store mode |
| GET | `/api/cases` | List cases (`?user_id=` for pain state) |
| GET | `/api/cases/:id` | Case detail + solutions |
| POST | `/api/submit` | Submit freeform text `{ text }` |
| POST | `/api/cases/:id/pain` | Toggle pain vote |
| POST | `/api/cases/:id/toggle-claim` | Claim / unclaim |
| POST | `/api/cases/:id/solve` | Propose solution |
| POST | `/api/solves/:id/accept` | Accept solution (claimant) |
| POST | `/api/solves/:id/unaccept` | Unaccept solution |
| GET | `/api/test` | Pre-case / Reddit feed stub |

---

## Supabase setup (optional)

1. Create a Supabase project.
2. Run SQL from `database/migrations/001_cases.sql` (and existing `profiles.sql`, `roles.sql`, `precase.sql`).
3. Add keys to `.env`:

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

4. Restart `npm run dev` — logs will show `Data store: supabase`.

Frontend auth still uses the anon key (served via `/config.js` when env vars are set).

---

## Development roadmap

| Iteration | Focus |
|-----------|--------|
| 1 | ✅ API + clone-and-run + in-memory cases |
| 2 | Gemini validation on submit |
| 3 | Reddit scraping pipeline |
| 4 | Community validation + RLS hardening |
| 5 | Realtime matrix |
| 6 | Vercel deploy + PWA |

See `documentation.md` for full requirements.

---

## Team

| Name | Role |
|------|------|
| Dicdican | CEO |
| Sheikh | CTO |
| Merin | CFO |
