export function geminiModelId() {
  return process.env.GEMINI_MODEL || "gemini-3.6-flash";
}

/**
 * Lightweight Gemini generateContent ping.
 * @returns {Promise<{ configured: boolean, model: string, status: string, error?: string, latencyMs?: number }>}
 */
export async function pingGemini() {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = geminiModelId();
  if (!key) {
    return { configured: false, model, status: "missing" };
  }

  const started = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const body = await res.text();
      const snippet = body.slice(0, 180);
      return {
        configured: true,
        model,
        status: "fail",
        error: `HTTP ${res.status}: ${snippet}`,
        latencyMs,
      };
    }
    return { configured: true, model, status: "ok", latencyMs };
  } catch (err) {
    return {
      configured: true,
      model,
      status: "fail",
      error: err.message || String(err),
      latencyMs: Date.now() - started,
    };
  }
}
