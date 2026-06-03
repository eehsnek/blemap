import { createClient } from "@supabase/supabase-js";

let supabaseAuth;

function getAuthClient() {
  if (!supabaseAuth) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    supabaseAuth = createClient(url, key);
  }
  return supabaseAuth;
}

export async function optionalAuth(req, _res, next) {
  req.user = null;
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  const token = header.slice(7);
  const client = getAuthClient();
  if (!client) {
    req.user = { id: req.body?.user_id || req.query?.user_id || null };
    return next();
  }

  const { data, error } = await client.auth.getUser(token);
  if (!error && data?.user) req.user = data.user;
  next();
}

export function requireAuth(req, res, next) {
  if (req.user?.id) return next();
  if (!getAuthClient() && process.env.NODE_ENV !== "production") {
    req.user = { id: "dev-local-user" };
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
}

export function getUserId(req) {
  return req.user?.id ?? req.body?.user_id ?? null;
}
