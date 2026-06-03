const defaults = {
  apiBase: typeof window !== "undefined" ? window.location.origin : "http://localhost:4000",
  supabaseUrl: "https://kktedcwrxsrkbyzxchjt.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdGVkY3dyeHNya2J5enhjaGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMwNjQsImV4cCI6MjA5MzYzOTA2NH0.kMlmUDeAmpOnYlrUXqsuNFlJHoIFqYyrmFG8ewPHTK8",
};

const runtime =
  (typeof window !== "undefined" && window.__BLEMAP_CONFIG) || defaults;

export const API_BASE = runtime.apiBase ?? defaults.apiBase;
export const SUPABASE_URL = runtime.supabaseUrl || defaults.supabaseUrl;
export const SUPABASE_ANON_KEY =
  runtime.supabaseAnonKey || defaults.supabaseAnonKey;

export function caseDetailUrl(caseId) {
  return `${API_BASE}/frontend/caseDetail.html?id=${caseId}`;
}
