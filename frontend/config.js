const defaults = {
  apiBase:
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:4000",
  supabaseUrl: null,
  supabaseAnonKey: null,
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

function pickUrl(value, fallback) {
  if (isPlaceholder(value)) return fallback;
  return String(value).trim();
}

export const API_BASE = pickUrl(runtime.apiBase, defaults.apiBase);

const resolvedUrl = isPlaceholder(runtime.supabaseUrl)
  ? null
  : String(runtime.supabaseUrl).trim();
const resolvedAnon = isPlaceholder(runtime.supabaseAnonKey)
  ? null
  : String(runtime.supabaseAnonKey).trim();

export const SUPABASE_URL = resolvedUrl;
export const SUPABASE_ANON_KEY = resolvedAnon;
export const SUPABASE_CONFIGURED = Boolean(resolvedUrl && resolvedAnon);

export function caseDetailUrl(caseId) {
  return `${API_BASE}/frontend/app.html#/case/${caseId}`;
}
