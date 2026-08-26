import { createClient } from "@supabase/supabase-js";

let admin;
let anon;

/** Service-role (or secret) client — server only. */
export function getSupabaseAdmin() {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return admin;
}

/** Anon client for password grant / OTP verify — server only, no session persist. */
export function getSupabaseAnon() {
  if (anon) return anon;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  anon = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return anon;
}
