import { createClient } from "@supabase/supabase-js";
import { cosineSimilarity, parseEmbedding } from "../lib/similarity.js";
import { embeddingThreshold } from "./embeddingService.js";

function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Find nearest cases by embedding.
 * Prefers Postgres `match_cases` RPC; falls back to in-memory cosine over `candidates`.
 *
 * @param {number[]} queryEmbedding
 * @param {{ matchCount?: number, threshold?: number, filterStatus?: string|null, candidates?: object[] }} [opts]
 */
export async function findSimilarCases(queryEmbedding, opts = {}) {
  const threshold = opts.threshold ?? embeddingThreshold();
  const matchCount = opts.matchCount ?? 5;
  const filterStatus = opts.filterStatus ?? null;
  const emb = parseEmbedding(queryEmbedding);
  if (!emb) return [];

  const admin = getAdmin();
  if (admin) {
    try {
      const { data, error } = await admin.rpc("match_cases", {
        query_embedding: emb,
        match_threshold: threshold,
        match_count: matchCount,
        filter_status: filterStatus,
      });
      if (!error && Array.isArray(data)) {
        return data.map((row) => ({
          id: row.id,
          topic: row.topic,
          summary: row.summary,
          status: row.status,
          similarity: Number(row.similarity),
        }));
      }
      if (error) console.warn("match_cases RPC:", error.message);
    } catch (err) {
      console.warn("match_cases failed:", err.message || err);
    }
  }

  const candidates = opts.candidates || [];
  const scored = [];
  for (const c of candidates) {
    if (filterStatus && c.status !== filterStatus) continue;
    const other = parseEmbedding(c.embedding);
    if (!other) continue;
    const similarity = cosineSimilarity(emb, other);
    if (similarity >= threshold) {
      scored.push({
        id: c.id,
        topic: c.topic,
        summary: c.summary,
        status: c.status,
        similarity,
      });
    }
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, matchCount);
}

/**
 * @returns {{ isDuplicate: boolean, duplicateCaseId: string|null, duplicateCase: object|null, similarity: number, related: object[] }}
 */
export function duplicateFromMatches(matches, existingCases = []) {
  const top = matches[0];
  if (!top) {
    return {
      isDuplicate: false,
      duplicateCaseId: null,
      duplicateCase: null,
      similarity: 0,
      related: [],
    };
  }
  const full =
    existingCases.find((c) => String(c.id) === String(top.id)) || top;
  return {
    isDuplicate: true,
    duplicateCaseId: top.id,
    duplicateCase: full,
    similarity: top.similarity,
    related: matches,
  };
}
