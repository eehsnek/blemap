export const DEFAULT_SUPABASE_URL =
  "https://kktedcwrxsrkbyzxchjt.supabase.co";

export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdGVkY3dyeHNya2J5enhjaGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMwNjQsImV4cCI6MjA5MzYzOTA2NH0.kMlmUDeAmpOnYlrUXqsuNFlJHoIFqYyrmFG8ewPHTK8";

const PLACEHOLDER_MARKERS = [
  "your-project",
  "your-anon-key",
  "your-service-role-key",
  "example.com",
  "changeme",
];

function isPlaceholder(value) {
  if (!value || typeof value !== "string") return true;
  const v = value.trim().toLowerCase();
  if (!v) return true;
  return PLACEHOLDER_MARKERS.some((m) => v.includes(m));
}

function pickSupabaseValue(value, fallback) {
  return isPlaceholder(value) ? fallback : value.trim();
}

export function resolvePublicSupabaseConfig(env = process.env) {
  const url = pickSupabaseValue(
    env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim(),
    DEFAULT_SUPABASE_URL
  );

  const anonKey = pickSupabaseValue(
    env.SUPABASE_ANON_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim(),
    DEFAULT_SUPABASE_ANON_KEY
  );

  return { url, anonKey };
}
