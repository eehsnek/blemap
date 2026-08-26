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

function cleanEnv(value) {
  if (isPlaceholder(value)) return null;
  return value.trim();
}

/**
 * Resolve browser/public Supabase config from environment only.
 * No hardcoded project URL or anon key — missing values → configured: false.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ url: string|null, anonKey: string|null, configured: boolean }}
 */
export function resolvePublicSupabaseConfig(env = process.env) {
  const url = cleanEnv(
    env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim()
  );
  const anonKey = cleanEnv(
    env.SUPABASE_ANON_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim()
  );

  if (!url || !anonKey) {
    return { url: null, anonKey: null, configured: false };
  }

  return { url, anonKey, configured: true };
}
