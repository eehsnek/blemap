import { createClient } from "@supabase/supabase-js";
import { createMemoryStore } from "./memoryStore.js";
import { analyzeSubmission } from "../ai/analyzeSubmission.js";
import { analyzeSolve, solveAiEnforced } from "../ai/analyzeSolve.js";
import {
  buildActivityFeed,
  buildMetricsSummary,
  MS_WEEK,
} from "../lib/aggregateMetrics.js";
import { applyCaseFilters } from "../lib/caseFilters.js";
import { logSupabaseCaseEvent } from "../lib/caseEvents.js";
import {
  CONFIRMATIONS_REQUIRED,
  enrichCase,
} from "../lib/caseMetrics.js";
import { randomUUID } from "node:crypto";
import { createSupabaseIngestionAdapter } from "../ingestion/adapters/supabaseAdapter.js";
import { runScrapeJob } from "../ingestion/runScrapeJob.js";

function createSupabaseStore() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);
  const drafts = new Map();

  function ingestionAdapter() {
    return createSupabaseIngestionAdapter(supabase, fetchCasesQuery);
  }

  async function fetchCasesQuery(filters = {}) {
    let q = supabase.from("cases").select("*");
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.publishedOnly) q = q.eq("status", "published");
    if (filters.domain) q = q.eq("domain", filters.domain);
    if (filters.lifecycle_state) q = q.eq("lifecycle_state", filters.lifecycle_state);
    if (filters.source) q = q.eq("source", filters.source);
    if (filters.q) {
      const term = `%${filters.q}%`;
      q = q.or(`topic.ilike.${term},summary.ilike.${term}`);
    }
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async function maxPain() {
    const { data } = await supabase.from("cases").select("pain_count");
    return Math.max(...(data ?? []).map((c) => c.pain_count ?? 0), 1);
  }

  async function logEvent(params) {
    const c = await store.getCase(params.caseId);
    const metadata = {
      ...params.metadata,
      topic: c?.topic,
      gap_score: c?.gap_score,
    };
    return logSupabaseCaseEvent(supabase, { ...params, metadata }).catch((err) => {
      console.warn("case_events:", err.message);
      return null;
    });
  }

  async function enrichRow(c, userId, maxPainVal) {
    const { data: solves } = await supabase
      .from("solves")
      .select("*")
      .eq("case_id", c.id);

    let user_pained = false;
    let user_confirmed = false;
    if (userId) {
      const { data: pv } = await supabase
        .from("case_pain_votes")
        .select("case_id")
        .eq("case_id", c.id)
        .eq("user_id", userId)
        .maybeSingle();
      user_pained = Boolean(pv);

      const { data: cv } = await supabase
        .from("case_confirmations")
        .select("case_id")
        .eq("case_id", c.id)
        .eq("user_id", userId)
        .maybeSingle();
      user_confirmed = Boolean(cv);
    }

    return enrichCase(
      { ...c, user_pained, user_confirmed, solves: solves ?? [] },
      { solves: solves ?? [], maxPain: maxPainVal }
    );
  }

  async function enrichAll(rows, userId) {
    const mp = await maxPain();
    return Promise.all(rows.map((c) => enrichRow(c, userId, mp)));
  }

  const store = {
    mode: "supabase",

    async listCases(userId, opts = {}) {
      const rows = await fetchCasesQuery(opts.filters ?? {});
      const enriched = await enrichAll(rows, userId);
      return applyCaseFilters(enriched, opts.filters ?? {});
    },

    async listMatrixCases(userId, filters = {}) {
      const rows = await fetchCasesQuery({ publishedOnly: true, ...filters });
      const enriched = await enrichAll(rows, userId);
      return applyCaseFilters(enriched, filters);
    },

    async listProspectorCases(userId, filters = {}) {
      const all = await this.listMatrixCases(userId, filters);
      return all
        .filter((c) => !c.claimed_by && c.lifecycle_state !== "green")
        .sort((a, b) => b.gap_score - a.gap_score);
    },

    async getCase(id) {
      const { data: c, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !c) return null;
      return enrichRow(c, null, await maxPain());
    },

    async getRelatedCases(id, { limit = 5 } = {}) {
      const { data: c } = await supabase
        .from("cases")
        .select("id, embedding")
        .eq("id", id)
        .maybeSingle();
      if (!c?.embedding) return [];
      const { findSimilarCases } = await import("../services/caseSimilarity.js");
      const matches = await findSimilarCases(c.embedding, {
        matchCount: limit + 1,
        threshold: 0.5,
      });
      return matches.filter((m) => String(m.id) !== String(id)).slice(0, limit);
    },

    async analyzeSubmit({ text, userId }) {
      const { generateEmbedding } = await import("../services/embeddingService.js");
      const { findSimilarCases } = await import("../services/caseSimilarity.js");
      const rows = await fetchCasesQuery();
      const embedding = await generateEmbedding(text);
      const embeddingMatches = embedding
        ? await findSimilarCases(embedding, {
            candidates: rows,
            matchCount: 5,
            // suggest floor; classifyMatches applies merge threshold
            threshold: Number(process.env.EMBEDDING_SUGGEST_THRESHOLD ?? 0.5),
          })
        : [];
      const analysis = await analyzeSubmission(text, rows, { embeddingMatches });
      const draftId = randomUUID();
      drafts.set(draftId, {
        id: draftId,
        raw_input: text,
        user_id: userId,
        analysis,
        embedding,
      });
      return {
        draftId,
        ...analysis,
        embeddingAvailable: Boolean(embedding),
      };
    },

    async confirmSubmit({ draftId, userId, mergeIntoCaseId, forceNew = false }) {
      const draft = drafts.get(draftId);
      if (!draft) return { error: "Draft not found", status: 404 };
      const { analysis } = draft;
      if (!analysis.isValid) {
        return { error: analysis.rejectionMessage, status: 400 };
      }

      const shouldMerge =
        !forceNew && Boolean(mergeIntoCaseId || analysis.isDuplicate);

      if (shouldMerge) {
        const id = mergeIntoCaseId || analysis.duplicateCaseId;
        const c = await this.getCase(id);
        if (!c) return { error: "Case not found", status: 404 };
        await supabase
          .from("cases")
          .update({ pain_count: c.pain_count + 1 })
          .eq("id", id);
        drafts.delete(draftId);
        await logEvent({
          caseId: id,
          eventType: "merged_signal",
          actorId: userId,
          source: "user",
          metadata: {
            via: "embedding",
            similarity: analysis.embeddingSimilarity ?? null,
          },
        }).catch(() => {});
        return {
          matched: true,
          case: await this.getCase(id),
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
      const { data, error } = await supabase
        .from("cases")
        .insert({
          topic: s.topic,
          summary: s.summary,
          pain_count: Math.max(1, Math.round((s.pain_level ?? 0.5) * 10)),
          lifecycle_state: "grey",
          status: "pending",
          confirmation_count: 0,
          domain: s.domain,
          category: s.category,
          mode: "ai-assisted",
          raw_input: draft.raw_input,
          source: "user",
          cta_text: s.cta_text,
          submitted_by: userId,
          ...(embedding ? { embedding } : {}),
        })
        .select()
        .single();
      if (error) throw error;
      drafts.delete(draftId);
      await logEvent({
        caseId: data.id,
        eventType: "submitted",
        actorId: userId,
        source: "user",
      });
      return {
        matched: false,
        pending: true,
        case: await enrichRow(data, userId, await maxPain()),
        message: `Needs ${CONFIRMATIONS_REQUIRED} confirmations to publish.`,
      };
    },

    async confirmCase(caseId, userId) {
      const { error: insErr } = await supabase
        .from("case_confirmations")
        .insert({ case_id: caseId, user_id: userId });
      if (insErr?.code === "23505") {
        return { error: "Already confirmed", status: 409 };
      }
      if (insErr) throw insErr;

      const { data: c } = await supabase
        .from("cases")
        .select("confirmation_count, status")
        .eq("id", caseId)
        .single();
      const next = (c?.confirmation_count ?? 0) + 1;
      const wasPending = c?.status === "pending";
      const status =
        c?.status === "pending" && next >= CONFIRMATIONS_REQUIRED
          ? "published"
          : c?.status;
      await supabase
        .from("cases")
        .update({ confirmation_count: next, status })
        .eq("id", caseId);
      await logEvent({
        caseId,
        eventType: "confirmed",
        actorId: userId,
        metadata: { confirmation_count: next },
      });
      if (wasPending && status === "published") {
        await logEvent({
          caseId,
          eventType: "published",
          actorId: userId,
          source: "system",
        });
      }
      return {
        confirmation_count: next,
        status,
        published: status === "published",
        case: await this.getCase(caseId),
      };
    },

    async togglePain(caseId, userId) {
      const { data: existing } = await supabase
        .from("case_pain_votes")
        .select("case_id")
        .eq("case_id", caseId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("case_pain_votes")
          .delete()
          .eq("case_id", caseId)
          .eq("user_id", userId);
        const { data: c } = await supabase
          .from("cases")
          .select("pain_count")
          .eq("id", caseId)
          .single();
        const next = Math.max(0, (c?.pain_count ?? 0) - 1);
        await supabase.from("cases").update({ pain_count: next }).eq("id", caseId);
        await logEvent({
          caseId,
          eventType: "pain_removed",
          actorId: userId,
          metadata: { pain_count: next },
        });
        return { state: "unpained", pain_count: next };
      }

      await supabase.from("case_pain_votes").insert({
        case_id: caseId,
        user_id: userId,
      });
      const { data: c } = await supabase
        .from("cases")
        .select("pain_count")
        .eq("id", caseId)
        .single();
      const next = (c?.pain_count ?? 0) + 1;
      await supabase.from("cases").update({ pain_count: next }).eq("id", caseId);
      await logEvent({
        caseId,
        eventType: "pain_added",
        actorId: userId,
        metadata: { pain_count: next },
      });
      return { state: "pained", pain_count: next };
    },

    async toggleClaim(caseId, userId) {
      const c = await this.getCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };
      if (c.status !== "published") {
        return { error: "Only published cases can be claimed", status: 400 };
      }
      if (c.claimed_by === userId) {
        await supabase
          .from("cases")
          .update({ claimed_by: null, lifecycle_state: "grey" })
          .eq("id", caseId);
        await logEvent({ caseId, eventType: "unclaimed", actorId: userId });
        return { state: "unclaimed" };
      }
      if (c.claimed_by) return { error: "Already claimed", status: 409 };
      await supabase
        .from("cases")
        .update({ claimed_by: userId, lifecycle_state: "orange" })
        .eq("id", caseId);
      await logEvent({ caseId, eventType: "claimed", actorId: userId });
      return { state: "claimed" };
    },

    async addSolve(caseId, userId, solveText) {
      const c = await this.getCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };
      const analysis = await analyzeSolve(solveText, c);
      if (solveAiEnforced() && !analysis.isRelevant) {
        return {
          error: analysis.rejectionMessage || "Solution not relevant to this case",
          status: 422,
          analysis,
        };
      }
      const { data: solve, error } = await supabase
        .from("solves")
        .insert({ case_id: caseId, user_id: userId, solve_text: solveText })
        .select()
        .single();
      if (error) throw error;
      await supabase
        .from("cases")
        .update({ solve_count: (c?.solve_count ?? 0) + 1 })
        .eq("id", caseId);
      await logEvent({
        caseId,
        eventType: "solve_added",
        actorId: userId,
        metadata: { solve_id: solve.id },
      });
      return { solve, analysis };
    },

    async analyzeSolveProposal(caseId, solveText) {
      const c = await this.getCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };
      return { analysis: await analyzeSolve(solveText, c) };
    },

    async acceptSolve(solveId, userId) {
      const { data: solve } = await supabase
        .from("solves")
        .select("*, cases(claimed_by, id)")
        .eq("id", solveId)
        .single();
      if (!solve) return { error: "Solution not found", status: 404 };
      if (solve.cases?.claimed_by !== userId) {
        return { error: "Only claimant can accept", status: 403 };
      }
      await supabase
        .from("solves")
        .update({ accepted: false })
        .eq("case_id", solve.case_id);
      await supabase.from("solves").update({ accepted: true }).eq("id", solveId);
      await supabase
        .from("cases")
        .update({ lifecycle_state: "green" })
        .eq("id", solve.case_id);
      await logEvent({
        caseId: solve.case_id,
        eventType: "solve_accepted",
        actorId: userId,
        metadata: { solve_id: solveId },
      });
      return { solve };
    },

    async unacceptSolve(solveId, userId) {
      const { data: solve } = await supabase
        .from("solves")
        .select("*, cases(claimed_by, id)")
        .eq("id", solveId)
        .single();
      if (!solve) return { error: "Solution not found", status: 404 };
      if (solve.cases?.claimed_by !== userId) {
        return { error: "Only claimant can unaccept", status: 403 };
      }
      await supabase.from("solves").update({ accepted: false }).eq("id", solveId);
      await supabase
        .from("cases")
        .update({ lifecycle_state: "orange" })
        .eq("id", solve.case_id);
      await logEvent({
        caseId: solve.case_id,
        eventType: "solve_unaccepted",
        actorId: userId,
        metadata: { solve_id: solveId },
      });
      return { solve };
    },

    async markSolved(caseId, userId, outcomeUrl, outcomeNote) {
      const c = await this.getCase(caseId);
      if (!c || c.claimed_by !== userId) {
        return { error: "Only claimant can mark solved", status: 403 };
      }
      await supabase
        .from("cases")
        .update({
          lifecycle_state: "green",
          outcome_url: outcomeUrl,
          outcome_note: outcomeNote,
        })
        .eq("id", caseId);
      await logEvent({
        caseId,
        eventType: "marked_solved",
        actorId: userId,
        metadata: { outcome_url: outcomeUrl, outcome_note: outcomeNote },
      });
      return { case: await this.getCase(caseId) };
    },

    async getCaseEvents(caseId, limit = 50) {
      const { data, error } = await supabase
        .from("case_events")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        console.warn("case_events fetch:", error.message);
        return [];
      }
      return data ?? [];
    },

    async getMetricsSummary() {
      const enriched = await enrichAll(await fetchCasesQuery(), null);
      const lastRun = await ingestionAdapter().getLastScrapeRun();
      const { data: precaseRows } = await supabase.from("precase").select("ai_status");
      const precaseByStatus = {};
      for (const p of precaseRows ?? []) {
        const s = p.ai_status || "pending";
        precaseByStatus[s] = (precaseByStatus[s] ?? 0) + 1;
      }
      const weekAgo = new Date(Date.now() - MS_WEEK).toISOString();
      const { count: confCount } = await supabase
        .from("case_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "confirmed")
        .gte("created_at", weekAgo);
      const { count: solveCount } = await supabase
        .from("case_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "solve_added")
        .gte("created_at", weekAgo);
      return buildMetricsSummary(enriched, {
        lastScrapeRun: lastRun,
        precaseByStatus,
        confirmationsLast7d: confCount ?? 0,
        solvesLast7d: solveCount ?? 0,
      });
    },

    async getRecentActivity({ limit = 20 } = {}) {
      const { data: events } = await supabase
        .from("case_events")
        .select("*, cases(topic)")
        .order("created_at", { ascending: false })
        .limit(limit);
      const eventsWithTopic = (events ?? []).map((e) => ({
        ...e,
        topic: e.cases?.topic,
      }));
      const { data: runs } = await supabase
        .from("scrape_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5);
      const { data: recentCases } = await supabase
        .from("cases")
        .select("id, topic, source, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return {
        items: buildActivityFeed({
          caseEvents: eventsWithTopic,
          scrapeRuns: runs ?? [],
          recentCases: recentCases ?? [],
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

    async submitCase({ text }) {
      return store.confirmSubmit({
        draftId: (await store.analyzeSubmit({ text })).draftId,
        userId: null,
      });
    },
  };

  return store;
}

let store;

export function getStore() {
  if (!store) {
    store = createSupabaseStore() ?? createMemoryStore();
    console.log(`📦 Data store: ${store.mode}`);
  }
  return store;
}
