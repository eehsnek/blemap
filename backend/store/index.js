import { createClient } from "@supabase/supabase-js";
import { createMemoryStore } from "./memoryStore.js";
import { analyzeSubmission } from "../ai/analyzeSubmission.js";
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
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async function enrichRow(c, userId) {
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
      { solves: solves ?? [] }
    );
  }

  const store = {
    mode: "supabase",

    async listCases(userId) {
      const rows = await fetchCasesQuery();
      return Promise.all(rows.map((c) => enrichRow(c, userId)));
    },

    async listMatrixCases(userId) {
      const rows = await fetchCasesQuery({ publishedOnly: true });
      return Promise.all(rows.map((c) => enrichRow(c, userId)));
    },

    async listProspectorCases(userId) {
      const all = await this.listMatrixCases(userId);
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
      return enrichRow(c, null);
    },

    async analyzeSubmit({ text, userId }) {
      const rows = await fetchCasesQuery();
      const analysis = await analyzeSubmission(text, rows);
      const draftId = randomUUID();
      drafts.set(draftId, { id: draftId, raw_input: text, user_id: userId, analysis });
      return { draftId, ...analysis };
    },

    async confirmSubmit({ draftId, userId, mergeIntoCaseId }) {
      const draft = drafts.get(draftId);
      if (!draft) return { error: "Draft not found", status: 404 };
      const { analysis } = draft;
      if (!analysis.isValid) {
        return { error: analysis.rejectionMessage, status: 400 };
      }

      if (mergeIntoCaseId || analysis.isDuplicate) {
        const id = mergeIntoCaseId || analysis.duplicateCaseId;
        const c = await this.getCase(id);
        if (!c) return { error: "Case not found", status: 404 };
        await supabase
          .from("cases")
          .update({ pain_count: c.pain_count + 1 })
          .eq("id", id);
        drafts.delete(draftId);
        return { matched: true, case: await this.getCase(id) };
      }

      const s = analysis.structured;
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
        })
        .select()
        .single();
      if (error) throw error;
      drafts.delete(draftId);
      return {
        matched: false,
        pending: true,
        case: await enrichRow(data, userId),
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
      const status =
        c?.status === "pending" && next >= CONFIRMATIONS_REQUIRED
          ? "published"
          : c?.status;
      await supabase
        .from("cases")
        .update({ confirmation_count: next, status })
        .eq("id", caseId);
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
        return { state: "unclaimed" };
      }
      if (c.claimed_by) return { error: "Already claimed", status: 409 };
      await supabase
        .from("cases")
        .update({ claimed_by: userId, lifecycle_state: "orange" })
        .eq("id", caseId);
      return { state: "claimed" };
    },

    async addSolve(caseId, userId, solveText) {
      const { data: solve, error } = await supabase
        .from("solves")
        .insert({ case_id: caseId, user_id: userId, solve_text: solveText })
        .select()
        .single();
      if (error) throw error;
      const c = await this.getCase(caseId);
      await supabase
        .from("cases")
        .update({ solve_count: (c?.solve_count ?? 0) + 1 })
        .eq("id", caseId);
      return { solve };
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
      return { case: await this.getCase(caseId) };
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
