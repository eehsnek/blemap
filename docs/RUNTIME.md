# Runtime note — Main SPA only

BleMap’s supported product is the **Main SPA** at the repository root:

- `npm run dev` → http://localhost:4000
- Server: `backend/server.js`
- UI: `frontend/app.html`

There is **no nested summer `blemap/` tree** in this checkout. Historical “summer”
schema work lives in `database/migrations/006_main_compat_on_summer.sql` and
`database/MIGRATE_SUMMER_SUPABASE.md` (Supabase project migration), not a second app.

Do not start a second process on port 4000. Archive any future experimental trees
under `/legacy` or a separate branch — never beside the Main SPA as a peer runtime.
