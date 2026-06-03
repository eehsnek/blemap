import { createClient } from "@supabase/supabase-js";
import { createMemoryStore } from "./memoryStore.js";

function createSupabaseStore() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);

  return {
    mode: "supabase",

    async listCases(userId) {
      const { data: cases, error } = await supabase.from("cases").select("*");
      if (error) throw error;

      let painedIds = new Set();
      if (userId) {
        const { data: votes } = await supabase
          .from("case_pain_votes")
          .select("case_id")
          .eq("user_id", userId);
        painedIds = new Set((votes ?? []).map((v) => v.case_id));
      }

      return (cases ?? []).map((c) => ({
        ...c,
        user_pained: painedIds.has(c.id),
      }));
    },

    async getCase(id) {
      const { data: c, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", id)
        .single();
      if (error) return null;

      const { data: solves } = await supabase
        .from("solves")
        .select("*")
        .eq("case_id", id)
        .order("created_at", { ascending: false });

      return { ...c, solves: solves ?? [] };
    },

    async submitCase({ text }) {
      const topic =
        text.split(/\s+/).slice(0, 5).join(" ").slice(0, 80) || "New case";
      const { data, error } = await supabase
        .from("cases")
        .insert({
          topic,
          summary: text.slice(0, 500),
          pain_count: 1,
          lifecycle_state: "grey",
          mode: "ai-assisted",
        })
        .select()
        .single();
      if (error) throw error;
      return { matched: false, case: data };
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

      if (c.claimed_by === userId) {
        await supabase
          .from("cases")
          .update({ claimed_by: null, lifecycle_state: "grey" })
          .eq("id", caseId);
        return { state: "unclaimed" };
      }

      if (c.claimed_by) {
        return { error: "Case already claimed", status: 409 };
      }

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
      if (c) {
        await supabase
          .from("cases")
          .update({ solve_count: (c.solve_count ?? 0) + 1 })
          .eq("id", caseId);
      }
      return { solve };
    },

    async acceptSolve(solveId, userId) {
      const { data: solve } = await supabase
        .from("solves")
        .select("*, cases(claimed_by)")
        .eq("id", solveId)
        .single();
      if (!solve) return { error: "Solution not found", status: 404 };
      if (solve.cases?.claimed_by !== userId) {
        return { error: "Only the claimant can accept solutions", status: 403 };
      }

      await supabase
        .from("solves")
        .update({ accepted: false })
        .eq("case_id", solve.case_id);
      await supabase
        .from("solves")
        .update({ accepted: true })
        .eq("id", solveId);
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
        return { error: "Only the claimant can unaccept solutions", status: 403 };
      }

      await supabase
        .from("solves")
        .update({ accepted: false })
        .eq("id", solveId);
      await supabase
        .from("cases")
        .update({ lifecycle_state: "orange" })
        .eq("id", solve.case_id);
      return { solve };
    },

    async getPrecaseFeed() {
      const { data } = await supabase
        .from("precase")
        .select("title, permalink")
        .order("created_at", { ascending: false })
        .limit(10);
      return { inserted: data ?? [] };
    },
  };
}

let store;

export function getStore() {
  if (!store) {
    store = createSupabaseStore() ?? createMemoryStore();
    console.log(`📦 Data store: ${store.mode}`);
  }
  return store;
}
