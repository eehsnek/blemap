import { API_BASE } from "./config.js";
import { supabase } from "./supabaseClient.js";

export async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}/api${path.startsWith("/") ? path : `/${path}`}`;

  const auth = await getAuthHeaders();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}
