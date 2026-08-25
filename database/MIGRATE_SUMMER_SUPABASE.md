# Migrate Summer Supabase → Main SPA

Yes — you can reuse the Summer Supabase project for Main. It is live at:

`https://kktedcwrxsrkbyzxchjt.supabase.co`

## Schema gap (why a migration is needed)

| Summer has | Main expects |
|---|---|
| `cases.id` **bigint** | originally designed as **uuid** (Main JS works with either) |
| `case_solves` | `solves` |
| `case_pains` | `case_pain_votes` |
| `users` | `profiles` + `roles` |
| (missing) | `case_confirmations`, `case_events`, `scrape_runs` |
| fewer `cases` columns | `status`, `domain`, `confirmation_count`, … |

## Steps

### 1. Env (already pointed at Summer)

Root `.env` should include:

```bash
SUPABASE_URL=https://kktedcwrxsrkbyzxchjt.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 2. Run compatibility SQL

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/kktedcwrxsrkbyzxchjt/sql)
2. Paste and run: [`database/migrations/006_main_compat_on_summer.sql`](./migrations/006_main_compat_on_summer.sql)
3. Confirm no errors

This keeps existing Summer rows, adds Main columns/tables, and creates views:

- `solves` → `case_solves`
- `case_pain_votes` → `case_pains`

### 3. Auth settings (dev)

Dashboard → **Authentication** → **Providers** → **Email** → turn **Confirm email** OFF for local testing.

### 4. Restart Main

```bash
cd /Users/rahsheikh/Development/Projects/blemap
npm run dev
curl -s http://localhost:4000/health
```

Expect `"store":"supabase"` (not `"memory"`).

### 5. Verify

- Open http://localhost:4000 and register/sign in
- Matrix should show existing Summer published cases
- Submit a new case → should land as `pending` until confirmations

## Notes

- Existing Summer data is preserved (same `cases` table).
- Case IDs stay numeric (199, …), not UUIDs — Main’s API accepts that.
- Do not commit real keys to git; `.env` is gitignored.
