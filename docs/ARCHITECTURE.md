# BleMap Architecture

## System layers

```mermaid
flowchart LR
  subgraph client [Browser]
    UI[HTML / ES modules]
    Auth[Supabase Auth]
  end
  subgraph server [Node Express]
    API[REST /api]
    AI[Gemini or heuristic]
    SCR[Reddit scraper]
    MET[Gap score / matrix]
  end
  subgraph data [Storage]
    DB[(Supabase Postgres)]
    MEM[(In-memory dev)]
  end
  UI --> Auth
  UI --> API
  API --> AI
  API --> SCR
  API --> MET
  API --> DB
  API --> MEM
  SCR --> AI
```

## Request flows

### Submit (confirm-before-post)

1. `POST /api/submit/analyze` — AI validates and structures text; returns `draftId`.
2. User reviews topic, summary, domain, disclaimer.
3. `POST /api/submit/confirm` — persists case as **pending** (or merges duplicate).
4. Community `POST /api/cases/:id/confirm` — after 5 confirmations → **published** on matrix.

### Prospector

1. `GET /api/cases?view=prospector` — unclaimed published cases sorted by **gap score**.
2. Claim → propose solutions → accept → mark solved.

### Scrape (automation)

1. Cron or manual `POST /api/scrape/run` (secured with `CRON_SECRET` or signed-in user).
2. [`backend/ingestion/runScrapeJob.js`](../backend/ingestion/runScrapeJob.js) → **Hacker News** (default, free) and optional Reddit → [`promoteSignal`](../backend/ingestion/promoteSignal.js) → Gemini/heuristic → precase row + **published** case (`SCRAPE_PUBLISH_MODE=auto`).
3. `GET /api/ingestion/status` — last `scrape_runs` summary.

## Security

- Mutations require `Authorization: Bearer <supabase_jwt>`.
- Service role key only on server.
- RLS on Supabase per `database/migrations/002_intelligence.sql`.

## Deployment

- **Local:** `npm run dev` (memory store default).
- **Vercel:** `api/index.js` exports Express app; cron hits `/api/scrape/run`.
