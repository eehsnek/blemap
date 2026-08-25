/**
 * MiniLM embeddings (all-MiniLM-L6-v2, 384-dim) — Summer-compatible.
 *
 * Order:
 * 1) Remote FastAPI service if EMBEDDING_URL is reachable (`npm run embed:serve`)
 * 2) In-process @xenova/transformers (default; no Python required)
 * 3) null when EMBEDDING_DISABLED=1 or both fail
 */
const DEFAULT_URL = "http://127.0.0.1:8000";
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const DIMS = 384;

let extractorPromise = null;

export function embeddingServiceConfigured() {
  return process.env.EMBEDDING_DISABLED !== "1";
}

export function embeddingBaseUrl() {
  return (process.env.EMBEDDING_URL || DEFAULT_URL).replace(/\/$/, "");
}

export function embeddingThreshold() {
  // Used as default merge threshold when EMBEDDING_MERGE_THRESHOLD unset
  const n = Number(process.env.EMBEDDING_THRESHOLD ?? 0.65);
  return Number.isFinite(n) ? n : 0.65;
}

async function embedViaHttp(text) {
  const url = `${embeddingBaseUrl()}/embed`;
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(),
    Number(process.env.EMBEDDING_TIMEOUT_MS || 8000)
  );
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    const embedding = body?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== DIMS) return null;
    return embedding.map(Number);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = import("@xenova/transformers")
      .then(({ pipeline }) =>
        pipeline("feature-extraction", MODEL_ID, {
          quantized: true,
        })
      )
      .catch((err) => {
        extractorPromise = null;
        throw err;
      });
  }
  return extractorPromise;
}

async function embedViaXenova(text) {
  if (process.env.EMBEDDING_LOCAL === "0") return null;
  try {
    const extractor = await getExtractor();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    const data = Array.from(output?.data ?? output ?? []);
    if (data.length !== DIMS) {
      console.warn("Local embedding unexpected dims:", data.length);
      return null;
    }
    return data.map(Number);
  } catch (err) {
    console.warn("Local MiniLM embed failed:", err.message || err);
    return null;
  }
}

/**
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
export async function generateEmbedding(text) {
  if (!embeddingServiceConfigured()) return null;
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  // Prefer optional Summer-style FastAPI if running; else local Xenova
  if (process.env.EMBEDDING_PREFER_HTTP === "1") {
    return (await embedViaHttp(trimmed)) || (await embedViaXenova(trimmed));
  }
  const local = await embedViaXenova(trimmed);
  if (local) return local;
  return embedViaHttp(trimmed);
}

export function textForCaseEmbedding({ topic, summary, raw_input } = {}) {
  return [topic, summary || raw_input].filter(Boolean).join("\n").trim();
}

export const EMBEDDING_DIMS = DIMS;
export const EMBEDDING_MODEL = MODEL_ID;
