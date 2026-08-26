import { resolvePublicSupabaseConfig } from "../config/supabasePublic.js";
import { getStore } from "../store/index.js";
import { geminiModelId, pingGemini } from "./geminiPing.js";

export { geminiModelId, pingGemini };

/**
 * @param {{ deep?: boolean }} [opts]
 */
export async function buildHealthReport({ deep = false } = {}) {
  const store = getStore();
  const supabase = resolvePublicSupabaseConfig();
  const model = geminiModelId();
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());

  let gemini = {
    configured: geminiConfigured,
    model,
    status: geminiConfigured ? "unknown" : "missing",
  };

  if (deep) {
    gemini = await pingGemini();
  }

  const production = process.env.NODE_ENV === "production";
  let ok = true;
  if (production && store.mode === "memory") ok = false;
  if (production && !supabase.configured) ok = false;
  if (deep && gemini.configured && gemini.status === "fail") ok = false;

  return {
    ok,
    store: store.mode,
    supabase: {
      configured: supabase.configured,
    },
    gemini,
  };
}

/** Boot-time Gemini guard — logs loudly on model/key failure. */
export async function logGeminiStartupGuard() {
  const report = await pingGemini();
  if (report.status === "missing") {
    console.warn(
      `[gemini] GEMINI_API_KEY unset — submit uses heuristic; production scrape will 503.`
    );
    return report;
  }
  if (report.status === "fail") {
    console.error(
      `[gemini] FAIL model=${report.model} — ${report.error || "unknown error"}`
    );
    return report;
  }
  console.log(
    `[gemini] ok model=${report.model} (${report.latencyMs ?? "?"}ms)`
  );
  return report;
}
