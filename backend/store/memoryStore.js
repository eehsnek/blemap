import { randomUUID } from "node:crypto";
import { analyzeSubmission } from "../ai/analyzeSubmission.js";
import { analyzeSolve, solveAiEnforced } from "../ai/analyzeSolve.js";
import {
  buildActivityFeed,
  buildMetricsSummary,
  MS_WEEK,
} from "../lib/aggregateMetrics.js";
import { applyCaseFilters } from "../lib/caseFilters.js";
import { logMemoryCaseEvent } from "../lib/caseEvents.js";
import { CONFIRMATIONS_REQUIRED, enrichCase } from "../lib/caseMetrics.js";
import { createMemoryIngestionAdapter } from "../ingestion/adapters/memoryAdapter.js";
import { runScrapeJob } from "../ingestion/runScrapeJob.js";

function seedCases() {
  const base = [
    {
      topic: "Housing dispute",
      summary:
        "Landlord withholding deposit after move-out without itemized damages.",
      pain_count: 12,
      solve_count: 5,
      lifecycle_state: "orange",
      domain: "law",
      category: "law",
      subreddits: ["r/legaladvice"],
    },
    {
      topic: "Workplace complaint",
      summary:
        "Manager schedules meetings outside contracted hours with no compensation.",
      pain_count: 8,
      solve_count: 3,
      lifecycle_state: "grey",
      domain: "general",
      category: "community",
      subreddits: ["r/mildlyinfuriating"],
    },
    {
      topic: "Consumer fees issue",
      summary:
        "Bank adds recurring service fees not disclosed at account opening.",
      pain_count: 2,
      solve_count: 10,
      lifecycle_state: "green",
      domain: "finance",
      category: "finance",
      subreddits: ["r/personalfinance"],
    },
    {
      topic: "Neighbor conflict",
      summary:
        "Shared wall noise after quiet hours with no building enforcement.",
      pain_count: 1,
      solve_count: 0,
      lifecycle_state: "grey",
      domain: "general",
      category: "community",
      subreddits: [],
    },
  ];

  return base.map((c, i) => ({
    id: `c1111111-1111-4111-8111-11111111110${i + 1}`,
    ...c,
    claimed_by: null,
    mode: "community",
    permalinks: [],
    status: "published",
    confirmation_count: CONFIRMATIONS_REQUIRED,
    source: "seed",
    raw_input: c.summary,
    cta_text: "Claim and propose a solution path.",
    created_at: new Date().toISOString(),
  }));
}

export function createMemoryStore() {
  const cases = seedCases();
  const painVotes = new Map();
  const confirmations = new Map();
  const solves = [];
  const drafts = new Map();
  const precase = [];
  const scrapeRuns = [];
  const caseEvents = [];
  const seenPermalinks = new Set();
  const eventCtx = { caseEvents };

  function ingestionAdapter() {
    return createMemoryIngestionAdapter({
      cases,
      precase,
      seenPermalinks,
      scrapeRuns,
      caseEvents,
      eventCtx,
    });
  }

  function logEvent(params) {
    const c = findCase(params.caseId);
    const enriched = c
      ? enrichCase(c, {
          solves: solves.filter((s) => s.case_id === c.id),
          maxPain: maxPain(),
        })
      : null;
    const metadata = {
      ...params.metadata,
      topic: c?.topic,
      gap_score: enriched?.gap_score,
    };
    return logMemoryCaseEvent(eventCtx, { ...params, metadata });
  }

  function findCase(id) {
    return cases.find((c) => c.id === id) ?? null;
  }

  function publishedCases() {
    return cases.filter((c) => c.status === "published");
  }

  function maxPain() {
    return Math.max(...cases.map((c) => c.pain_count), 1);
  }

  function listEnriched(userId, { publishedOnly = false, prospector = false, filters = {} } = {}) {
    let rows = publishedOnly ? publishedCases() : [...cases];
    if (prospector) {
      rows = rows.filter(
        (c) =>
          c.status === "published" &&
          !c.claimed_by &&
          c.lifecycle_state !== "green"
      );
    }

    const enriched = rows.map((c) => {
      const caseSolves = solves.filter((s) => s.case_id === c.id);
      return enrichCase(
        {
          ...c,
          user_pained: userId ? painVotes.has(`${c.id}:${userId}`) : false,
          user_confirmed: userId
            ? confirmations.has(`${c.id}:${userId}`)
            : false,
        },
        { solves: caseSolves, maxPain: maxPain() }
      );
    });

    let result = enriched;
    if (prospector) {
      result = enriched.sort((a, b) => b.gap_score - a.gap_score);
    }
    return applyCaseFilters(result, filters);
  }

  return {
    mode: "memory",

    async listCases(userId, opts = {}) {
      return listEnriched(userId, opts);
    },

    async listMatrixCases(userId, filters = {}) {
      return listEnriched(userId, { publishedOnly: true, filters });
    },

    async listProspectorCases(userId, filters = {}) {
      return listEnriched(userId, { prospector: true, filters });
    },

    async getCase(id, userId = null) {
      const c = findCase(id);
      if (!c) return null;
      const caseSolves = solves.filter((s) => s.case_id === id);
      return enrichCase(
        {
          ...c,
          user_confirmed: userId
            ? confirmations.has(`${id}:${userId}`)
            : false,
          user_pained: userId ? painVotes.has(`${id}:${userId}`) : false,
        },
        { solves: caseSolves, maxPain: maxPain() }
      );
    },

    async getRelatedCases(id, { limit = 5 } = {}) {
      const c = findCase(id);
      if (!c?.embedding) return [];
      const { findSimilarCases } = await import("../services/caseSimilarity.js");
      const matches = await findSimilarCases(c.embedding, {
        candidates: cases,
        matchCount: limit + 1,
        threshold: 0.5,
      });
      return matches.filter((m) => String(m.id) !== String(id)).slice(0, limit);
    },

    async analyzeSubmit({ text, userId }) {
      const { generateEmbedding } = await import("../services/embeddingService.js");
      const { findSimilarCases } = await import("../services/caseSimilarity.js");
      const embedding = await generateEmbedding(text);
      const embeddingMatches = embedding
        ? await findSimilarCases(embedding, {
            candidates: cases,
            matchCount: 5,
            threshold: Number(process.env.EMBEDDING_SUGGEST_THRESHOLD ?? 0.5),
          })
        : [];
      const analysis = await analyzeSubmission(text, cases, { embeddingMatches });
      const draftId = randomUUID();
      drafts.set(draftId, {
        id: draftId,
        raw_input: text,
        user_id: userId,
        analysis,
        embedding,
        created_at: Date.now(),
      });
      return { draftId, ...analysis, embeddingAvailable: Boolean(embedding) };
    },

    async confirmSubmit({ draftId, userId, mergeIntoCaseId, forceNew = false }) {
      const draft = drafts.get(draftId);
      if (!draft) return { error: "Draft not found or expired", status: 404 };
      if (draft.user_id && userId && draft.user_id !== userId) {
        return { error: "Not authorized for this draft", status: 403 };
      }

      const { analysis } = draft;
      if (!analysis.isValid) {
        return { error: analysis.rejectionMessage || "Invalid submission", status: 400 };
      }

      const shouldMerge =
        !forceNew && Boolean(mergeIntoCaseId || analysis.isDuplicate);

      if (shouldMerge) {
        const targetId = mergeIntoCaseId || analysis.duplicateCaseId;
        const existing = findCase(targetId);
        if (!existing) return { error: "Duplicate case not found", status: 404 };
        existing.pain_count += 1;
        drafts.delete(draftId);
        return {
          matched: true,
          case: enrichCase(existing, { maxPain: maxPain() }),
          message:
            "Matched an existing case — your report was added as +1 pain. Opening that case.",
        };
      }

      const s = analysis.structured;
      let embedding = draft.embedding;
      if (!embedding) {
        const { generateEmbedding, textForCaseEmbedding } = await import(
          "../services/embeddingService.js"
        );
        embedding = await generateEmbedding(
          textForCaseEmbedding({
            topic: s.topic,
            summary: s.summary,
            raw_input: draft.raw_input,
          })
        );
      }
      const created = {
        id: randomUUID(),
        topic: s.topic,
        summary: s.summary,
        pain_count: Math.max(1, Math.round((s.pain_level ?? 0.5) * 10)),
        solve_count: 0,
        lifecycle_state: "grey",
        claimed_by: null,
        mode: "ai-assisted",
        subreddits: [],
        permalinks: [],
        status: "pending",
        confirmation_count: 0,
        domain: s.domain || "general",
        category: s.category || "community",
        raw_input: draft.raw_input,
        source: "user",
        cta_text: s.cta_text,
        submitted_by: userId,
        embedding: embedding || null,
        created_at: new Date().toISOString(),
      };
      cases.push(created);
      drafts.delete(draftId);
      logEvent({
        caseId: created.id,
        eventType: "submitted",
        actorId: userId,
        source: "user",
        metadata: { domain: created.domain },
      });
      return {
        matched: false,
        pending: true,
        case: enrichCase(created, { maxPain: maxPain() }),
        message: `Case submitted. Needs ${CONFIRMATIONS_REQUIRED} community confirmations to appear on the matrix.`,
      };
    },

    async confirmCase(caseId, userId) {
      const c = findCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };
      const key = `${caseId}:${userId}`;
      if (confirmations.has(key)) {
        return { error: "You already confirmed this case", status: 409 };
      }
      confirmations.set(key, true);
      c.confirmation_count = (c.confirmation_count ?? 0) + 1;
      const wasPending = c.status === "pending";
      if (
        c.status === "pending" &&
        c.confirmation_count >= CONFIRMATIONS_REQUIRED
      ) {
        c.status = "published";
      }
      logEvent({
        caseId: caseId,
        eventType: "confirmed",
        actorId: userId,
        metadata: { confirmation_count: c.confirmation_count },
      });
      if (wasPending && c.status === "published") {
        logEvent({
          caseId: caseId,
          eventType: "published",
          actorId: userId,
          source: "system",
        });
      }
      return {
        confirmation_count: c.confirmation_count,
        status: c.status,
        published: c.status === "published",
        case: await this.getCase(caseId, userId),
      };
    },

    async togglePain(caseId, userId) {
      const c = findCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };
      const key = `${caseId}:${userId}`;
      if (painVotes.has(key)) {
        painVotes.delete(key);
        c.pain_count = Math.max(0, c.pain_count - 1);
        logEvent({
          caseId: caseId,
          eventType: "pain_removed",
          actorId: userId,
          metadata: { pain_count: c.pain_count },
        });
        return { state: "unpained", pain_count: c.pain_count };
      }
      painVotes.set(key, true);
      c.pain_count += 1;
      logEvent({
        caseId: caseId,
        eventType: "pain_added",
        actorId: userId,
        metadata: { pain_count: c.pain_count },
      });
      return { state: "pained", pain_count: c.pain_count };
    },

    async toggleClaim(caseId, userId) {
      const c = findCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };
      if (c.status !== "published") {
        return { error: "Only published cases can be claimed", status: 400 };
      }
      if (c.claimed_by === userId) {
        c.claimed_by = null;
        c.lifecycle_state = "grey";
        logEvent({
          caseId: caseId,
          eventType: "unclaimed",
          actorId: userId,
        });
        return { state: "unclaimed", case: enrichCase(c, { maxPain: maxPain() }) };
      }
      if (c.claimed_by) {
        return { error: "Case already claimed by another user", status: 409 };
      }
      c.claimed_by = userId;
      c.lifecycle_state = "orange";
      logEvent({
        caseId: caseId,
        eventType: "claimed",
        actorId: userId,
      });
      return { state: "claimed", case: enrichCase(c, { maxPain: maxPain() }) };
    },

    async addSolve(caseId, userId, solveText) {
      const c = findCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };
      const enriched = enrichCase(c, {
        solves: solves.filter((s) => s.case_id === caseId),
        maxPain: maxPain(),
      });
      const analysis = await analyzeSolve(solveText, enriched);
      if (solveAiEnforced() && !analysis.isRelevant) {
        return {
          error: analysis.rejectionMessage || "Solution not relevant to this case",
          status: 422,
          analysis,
        };
      }
      const solve = {
        id: randomUUID(),
        case_id: caseId,
        user_id: userId,
        solve_text: solveText,
        accepted: false,
      };
      solves.push(solve);
      c.solve_count += 1;
      logEvent({
        caseId: caseId,
        eventType: "solve_added",
        actorId: userId,
        metadata: { solve_id: solve.id },
      });
      return {
        solve,
        analysis,
        case: enrichCase(c, { solves, maxPain: maxPain() }),
      };
    },

    async analyzeSolveProposal(caseId, solveText) {
      const c = findCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };
      const enriched = enrichCase(c, {
        solves: solves.filter((s) => s.case_id === caseId),
        maxPain: maxPain(),
      });
      return { analysis: await analyzeSolve(solveText, enriched) };
    },

    async acceptSolve(solveId, userId) {
      const solve = solves.find((s) => s.id === solveId);
      if (!solve) return { error: "Solution not found", status: 404 };
      const c = findCase(solve.case_id);
      if (!c || c.claimed_by !== userId) {
        return { error: "Only the claimant can accept solutions", status: 403 };
      }
      solves.forEach((s) => {
        if (s.case_id === c.id) s.accepted = s.id === solveId;
      });
      c.lifecycle_state = "green";
      logEvent({
        caseId: c.id,
        eventType: "solve_accepted",
        actorId: userId,
        metadata: { solve_id: solveId },
      });
      return { solve, case: enrichCase(c, { solves, maxPain: maxPain() }) };
    },

    async unacceptSolve(solveId, userId) {
      const solve = solves.find((s) => s.id === solveId);
      if (!solve) return { error: "Solution not found", status: 404 };
      const c = findCase(solve.case_id);
      if (!c || c.claimed_by !== userId) {
        return { error: "Only the claimant can unaccept solutions", status: 403 };
      }
      solve.accepted = false;
      c.lifecycle_state = c.claimed_by ? "orange" : "grey";
      logEvent({
        caseId: c.id,
        eventType: "solve_unaccepted",
        actorId: userId,
        metadata: { solve_id: solveId },
      });
      return { solve, case: enrichCase(c, { solves, maxPain: maxPain() }) };
    },

    async markSolved(caseId, userId, outcomeUrl, outcomeNote) {
      const c = findCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };
      if (c.claimed_by !== userId) {
        return { error: "Only claimant can mark solved", status: 403 };
      }
      c.lifecycle_state = "green";
      c.outcome_url = outcomeUrl || null;
      c.outcome_note = outcomeNote || null;
      logEvent({
        caseId: caseId,
        eventType: "marked_solved",
        actorId: userId,
        metadata: { outcome_url: outcomeUrl, outcome_note: outcomeNote },
      });
      return { case: enrichCase(c, { maxPain: maxPain() }) };
    },

    async getCaseEvents(caseId, limit = 50) {
      return caseEvents
        .filter((e) => e.case_id === caseId)
        .slice(-limit)
        .reverse();
    },

    async getMetricsSummary() {
      const enriched = listEnriched(null);
      const adapter = ingestionAdapter();
      const lastRun = await adapter.getLastScrapeRun();
      const precaseRows = precase;
      const precaseByStatus = {};
      for (const p of precaseRows) {
        const s = p.ai_status || "pending";
        precaseByStatus[s] = (precaseByStatus[s] ?? 0) + 1;
      }
      const weekAgo = Date.now() - MS_WEEK;
      const confirmationsLast7d = caseEvents.filter(
        (e) =>
          e.event_type === "confirmed" &&
          new Date(e.created_at).getTime() > weekAgo
      ).length;
      const solvesLast7d = caseEvents.filter(
        (e) =>
          e.event_type === "solve_added" &&
          new Date(e.created_at).getTime() > weekAgo
      ).length;
      return buildMetricsSummary(enriched, {
        lastScrapeRun: lastRun,
        precaseByStatus,
        confirmationsLast7d,
        solvesLast7d,
      });
    },

    async getRecentActivity({ limit = 20 } = {}) {
      const enriched = listEnriched(null);
      const recentCases = [...cases]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 10);
      const eventsWithTopic = [...caseEvents]
        .slice(-limit)
        .reverse()
        .map((e) => {
          const c = findCase(e.case_id);
          return { ...e, topic: c?.topic };
        });
      return {
        items: buildActivityFeed({
          caseEvents: eventsWithTopic,
          scrapeRuns: [...scrapeRuns].slice(-5).reverse(),
          recentCases,
          limit,
        }),
      };
    },

    async getPrecaseFeed() {
      const inserted = await ingestionAdapter().listPrecaseFeed(10);
      return { inserted };
    },

    async getIngestionStatus() {
      const lastRun = await ingestionAdapter().getLastScrapeRun();
      return { lastRun };
    },

    async runScrapePipeline() {
      return runScrapeJob(ingestionAdapter());
    },

    /** @deprecated direct submit — use analyze + confirm */
    async submitCase({ text }) {
      const analysis = await analyzeSubmission(text, cases);
      if (!analysis.isValid) {
        return { error: analysis.rejectionMessage, status: 400 };
      }
      if (analysis.isDuplicate && analysis.duplicateCase) {
        analysis.duplicateCase.pain_count += 1;
        return { matched: true, case: analysis.duplicateCase };
      }
      const s = analysis.structured;
      const created = {
        id: randomUUID(),
        topic: s.topic,
        summary: s.summary,
        pain_count: 1,
        solve_count: 0,
        lifecycle_state: "grey",
        claimed_by: null,
        mode: "ai-assisted",
        subreddits: [],
        permalinks: [],
        status: "pending",
        confirmation_count: 0,
        domain: s.domain,
        category: s.category,
        raw_input: text,
        source: "user",
        cta_text: s.cta_text,
        created_at: new Date().toISOString(),
      };
      cases.push(created);
      return { matched: false, case: enrichCase(created, { maxPain: maxPain() }) };
    },
  };
}
