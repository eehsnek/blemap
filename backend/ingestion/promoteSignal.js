import { analyzeSubmission } from "../ai/analyzeSubmission.js";
import { CONFIRMATIONS_REQUIRED } from "../lib/caseMetrics.js";
import { scrapePublishMode } from "./config.js";

/**
 * @typedef {object} IngestSignal
 * @property {string} title
 * @property {string} [body]
 * @property {string} permalink
 * @property {string} [subreddit]
 * @property {string} [source]
 */

/**
 * @typedef {object} PromoteResult
 * @property {'promoted'|'rejected'|'merged'|'skipped'} status
 * @property {string} [caseId]
 * @property {string} [reason]
 */

function signalUrl(permalink) {
  if (!permalink) return "";
  return permalink.startsWith("http")
    ? permalink
    : `https://reddit.com${permalink}`;
}

/**
 * @param {IngestSignal} signal
 * @param {import('./adapters/types.js').IngestionAdapter} adapter
 * @returns {Promise<PromoteResult>}
 */
export async function promoteSignal(signal, adapter) {
  const { title, body = "", permalink, subreddit, source = "reddit" } = signal;
  if (!permalink) {
    return { status: "skipped", reason: "missing_permalink" };
  }

  if (await adapter.hasSeenPermalink(permalink)) {
    return { status: "skipped", reason: "duplicate_permalink" };
  }

  await adapter.insertPrecase({
    title,
    permalink,
    subreddit: subreddit ?? null,
    ai_status: "pending",
  });

  const text = `${title}. ${body}`.trim();
  const existingCases = await adapter.getCasesForAnalysis();

  const { generateEmbedding } = await import("../services/embeddingService.js");
  const { findSimilarCases } = await import("../services/caseSimilarity.js");
  const embedding = await generateEmbedding(text);
  const embeddingMatches = embedding
    ? await findSimilarCases(embedding, {
        candidates: existingCases,
        matchCount: 5,
      })
    : [];

  const analysis = await analyzeSubmission(text, existingCases, {
    embeddingMatches,
  });

  if (!analysis.isValid) {
    await adapter.updatePrecase(permalink, {
      ai_status: "rejected",
      rejection_reason: analysis.rejectionMessage ?? "Invalid",
      processed_at: new Date().toISOString(),
    });
    return {
      status: "rejected",
      reason: analysis.rejectionMessage ?? "Invalid",
    };
  }

  const url = signalUrl(permalink);
  const publishMode = scrapePublishMode();

  if (analysis.isDuplicate && analysis.duplicateCaseId) {
    await adapter.mergeCase(analysis.duplicateCaseId, {
      permalink: url,
      subreddit,
      pain_delta: 1,
    });
    await adapter.updatePrecase(permalink, {
      ai_status: "duplicate",
      case_id: analysis.duplicateCaseId,
      processed_at: new Date().toISOString(),
    });
    return { status: "merged", caseId: analysis.duplicateCaseId };
  }

  const topicKey = analysis.structured?.topic?.toLowerCase().slice(0, 40);
  const topicMatch = topicKey
    ? existingCases.find(
        (c) => c.topic?.toLowerCase().slice(0, 40) === topicKey
      )
    : null;

  if (topicMatch) {
    await adapter.mergeCase(topicMatch.id, {
      permalink: url,
      subreddit,
      pain_delta: 1,
    });
    await adapter.updatePrecase(permalink, {
      ai_status: "duplicate",
      case_id: topicMatch.id,
      processed_at: new Date().toISOString(),
    });
    return { status: "merged", caseId: topicMatch.id };
  }

  const s = analysis.structured;
  const status =
    publishMode === "pending" ? "pending" : "published";
  const confirmation_count =
    status === "published" ? CONFIRMATIONS_REQUIRED : 0;

  const row = {
    topic: s.topic,
    summary: s.summary,
    pain_count: Math.max(2, Math.round((s.pain_level ?? 0.5) * 10)),
    solve_count: 0,
    lifecycle_state: "grey",
    claimed_by: null,
    mode: source === "reddit" || source === "hackernews" ? source : "ingest",
    subreddits: subreddit ? [subreddit] : [],
    permalinks: url ? [url] : [],
    status,
    confirmation_count,
    domain: s.domain || "general",
    category: s.category || "community",
    raw_input: text,
    source,
    cta_text: s.cta_text,
    ...(embedding ? { embedding } : {}),
  };

  const created = await adapter.createCase(row);
  await adapter.updatePrecase(permalink, {
    ai_status: "promoted",
    case_id: created.id,
    processed_at: new Date().toISOString(),
  });

  return { status: "promoted", caseId: created.id };
}
