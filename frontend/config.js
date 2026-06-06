import {
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
} from "../shared/supabasePublic.js";

const defaults = {
  apiBase:
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:4000",
  supabaseUrl: DEFAULT_SUPABASE_URL,
  supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
};

const runtime =
  (typeof window !== "undefined" && window.__BLEMAP_CONFIG) || defaults;

function isPlaceholder(value) {
  if (!value) return true;
  const v = String(value).trim().toLowerCase();
  return (
    !v ||
    v.includes("your-project") ||
    v.includes("your-anon-key") ||
    v.includes("example.com")
  );
}

function pick(value, fallback) {
  if (isPlaceholder(value)) return fallback;
  return String(value).trim();
}

export const API_BASE = pick(runtime.apiBase, defaults.apiBase);
export const SUPABASE_URL = pick(runtime.supabaseUrl, defaults.supabaseUrl);
export const SUPABASE_ANON_KEY = pick(
  runtime.supabaseAnonKey,
  defaults.supabaseAnonKey
);

export function caseDetailUrl(caseId) {
  return `${API_BASE}/frontend/app.html#/case/${caseId}`;
}
