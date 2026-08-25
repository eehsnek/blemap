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

/** Auto-merge when similarity >= this (default 0.65). */
export function mergeThreshold() {
  const n = Number(process.env.EMBEDDING_MERGE_THRESHOLD ?? embeddingThreshold());
  // Prefer merge threshold env; fall back to EMBEDDING_THRESHOLD; then 0.65
  if (process.env.EMBEDDING_MERGE_THRESHOLD != null && Number.isFinite(n)) return n;
  const legacy = Number(process.env.EMBEDDING_THRESHOLD);
  if (Number.isFinite(legacy)) return legacy;
  return 0.65;
}

/** Surface as “possible match” suggestions (default 0.5). */
export function suggestThreshold() {
  const n = Number(process.env.EMBEDDING_SUGGEST_THRESHOLD ?? 0.5);
  return Number.isFinite(n) ? n : 0.5;
}

function scoreCandidates(emb, candidates, filterStatus, threshold, matchCount) {
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
 * Find nearest cases by embedding.
 * Prefer scoring `candidates` (reliable with PostgREST string vectors);
 * also try `match_cases` RPC and merge results.
 */
export async function findSimilarCases(queryEmbedding, opts = {}) {
  const threshold = opts.threshold ?? suggestThreshold();
  const matchCount = opts.matchCount ?? 5;
  const filterStatus = opts.filterStatus ?? null;
  const emb = parseEmbedding(queryEmbedding);
  if (!emb) return [];

  const byId = new Map();

  const candidates = opts.candidates || [];
  if (candidates.length) {
    for (const row of scoreCandidates(
      emb,
      candidates,
      filterStatus,
      threshold,
      matchCount * 2
    )) {
      byId.set(String(row.id), row);
    }
  }

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
        for (const row of data) {
          const id = String(row.id);
          const sim = Number(row.similarity);
          const prev = byId.get(id);
          if (!prev || sim > prev.similarity) {
            byId.set(id, {
              id: row.id,
              topic: row.topic,
              summary: row.summary,
              status: row.status,
              similarity: sim,
            });
          }
        }
      } else if (error) {
        console.warn("match_cases RPC:", error.message);
      }
    } catch (err) {
      console.warn("match_cases failed:", err.message || err);
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}

/**
 * Decide auto-merge vs suggestions from ranked matches.
 */
export function classifyMatches(matches, existingCases = []) {
  const mergeAt = mergeThreshold();
  const related = matches.map((m) => ({
    id: m.id,
    topic: m.topic,
    summary: m.summary,
    status: m.status,
    similarity: m.similarity,
  }));
  const top = matches[0];
  if (!top) {
    return {
      isDuplicate: false,
      duplicateCaseId: null,
      duplicateCase: null,
      similarity: 0,
      related: [],
      matchSource: null,
    };
  }

  const full =
    existingCases.find((c) => String(c.id) === String(top.id)) || top;

  if (top.similarity >= mergeAt) {
    return {
      isDuplicate: true,
      duplicateCaseId: top.id,
      duplicateCase: full,
      similarity: top.similarity,
      embeddingSimilarity: top.similarity,
      related,
      matchSource: "embedding",
    };
  }

  return {
    isDuplicate: false,
    duplicateCaseId: null,
    duplicateCase: null,
    similarity: top.similarity,
    embeddingSimilarity: top.similarity,
    related,
    matchSource: "embedding_suggest",
  };
}

/** @deprecated use classifyMatches */
export function duplicateFromMatches(matches, existingCases = []) {
  return classifyMatches(matches, existingCases);
}
