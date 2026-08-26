# BleMap — 2-minute demo script

## Setup

```bash
npm install && npm run dev
```

For demos/prod durability: set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` so `/health` shows `store: "supabase"`. Memory store is for unit tests / ephemeral local only — cases wipe on restart.

### Archive Steward (admin) login

1. Open **http://localhost:4000/steward**
2. Sign in with an admin account (promote via SQL after `009_admin_role.sql`)
3. You land on the Archive Steward desk

Open http://localhost:4000

## Script

1. **Matrix** — Show published cases positioned by pain level (Y) and solution existence (X). Hover for gap score and quadrant.

2. **Submit** — Log in → Submit → paste a landlord deposit problem → **Analyze with AI** → review structured output and law disclaimer → **Confirm**.

3. **Validation** — Home → pending case → **Validate** (repeat concept: 5 validations publish to matrix).

4. **Prospector** — Prospector view → pick highest gap case → **Claim** → add solution → **Accept** as claimant.

5. **Scrape** — Prospector → **Run ingest scrape** → new cases from Hacker News land as **pending** (default) until community validation; set `SCRAPE_PUBLISH_MODE=auto` only for demos that need immediate matrix publish.

## Talking points

- "Problem intelligence" = validate, dedupe, score urgency (gap), not just a forum.
- Community trust = confirm-before-visible + domain disclaimers (scrapes included by default).
- Builder workflow = prospector queue sorted by gap.
