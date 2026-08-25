import { randomUUID } from "node:crypto";
import { logSupabaseCaseEvent } from "../../lib/caseEvents.js";

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {() => Promise<object[]>} fetchCasesQuery
 */
export function createSupabaseIngestionAdapter(supabase, fetchCasesQuery) {
  return {
    async getCasesForAnalysis() {
      return fetchCasesQuery();
    },

    async hasSeenPermalink(permalink) {
      const { data } = await supabase
        .from("precase")
        .select("id")
        .eq("permalink", permalink)
        .maybeSingle();
      return Boolean(data);
    },

    async insertPrecase(row) {
      const { error } = await supabase.from("precase").insert({
        title: row.title,
        permalink: row.permalink,
        subreddit: row.subreddit,
        ai_status: row.ai_status ?? "pending",
      });
      if (error && !error.message?.includes("duplicate")) throw error;
    },

    async updatePrecase(permalink, patch) {
      const { error } = await supabase
        .from("precase")
        .update(patch)
        .eq("permalink", permalink);
      if (error) throw error;
    },

    async mergeCase(caseId, { permalink, subreddit, pain_delta = 1, source = "scrape" }) {
      const { data: c } = await supabase
        .from("cases")
        .select("pain_count, permalinks, subreddits, topic")
        .eq("id", caseId)
        .single();
      if (!c) return;

      const permalinks = [...(c.permalinks ?? [])];
      if (permalink && !permalinks.includes(permalink)) permalinks.push(permalink);
      const subreddits = [...(c.subreddits ?? [])];
      if (subreddit && !subreddits.includes(subreddit)) subreddits.push(subreddit);

      await supabase
        .from("cases")
        .update({
          pain_count: (c.pain_count ?? 0) + pain_delta,
          permalinks,
          subreddits,
        })
        .eq("id", caseId);

      await logSupabaseCaseEvent(supabase, {
        caseId,
        eventType: "merged_signal",
        source,
        metadata: { permalink, pain_delta, topic: c.topic },
      }).catch((err) => console.warn("case_events:", err.message));
    },

    async createCase(row) {
      const id = randomUUID();
      const { error } = await supabase.from("cases").insert({
        id,
        topic: row.topic,
        summary: row.summary,
        pain_count: row.pain_count,
        solve_count: row.solve_count ?? 0,
        lifecycle_state: row.lifecycle_state ?? "grey",
        mode: row.mode,
        subreddits: row.subreddits ?? [],
        permalinks: row.permalinks ?? [],
        status: row.status,
        confirmation_count: row.confirmation_count,
        domain: row.domain,
        category: row.category,
        raw_input: row.raw_input,
        source: row.source,
        cta_text: row.cta_text,
        created_at: new Date().toISOString(),
        ...(row.embedding ? { embedding: row.embedding } : {}),
      });
      if (error) throw error;

      await logSupabaseCaseEvent(supabase, {
        caseId: id,
        eventType: "submitted",
        source: row.source ?? "scrape",
        metadata: { topic: row.topic, status: row.status },
      }).catch((err) => console.warn("case_events:", err.message));

      if (row.status === "published") {
        await logSupabaseCaseEvent(supabase, {
          caseId: id,
          eventType: "published",
          source: "scrape",
        }).catch((err) => console.warn("case_events:", err.message));
      }

      return { id };
    },

    async recordScrapeRun(stats) {
      const { error } = await supabase.from("scrape_runs").insert({
        scraped_count: stats.scraped,
        promoted_count: stats.promoted,
        rejected_count: stats.rejected,
        merged_count: stats.merged,
        skipped_count: stats.skipped,
        errors: stats.errors,
        started_at: stats.started_at,
        finished_at: stats.finished_at,
      });
      if (error) console.warn("scrape_runs insert:", error.message);
    },

    async getLastScrapeRun() {
      const { data } = await supabase
        .from("scrape_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },

    async listPrecaseFeed(limit = 10) {
      const { data } = await supabase
        .from("precase")
        .select(
          "title, permalink, subreddit, ai_status, rejection_reason, case_id, processed_at, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(limit);
      return data ?? [];
    },
  };
}
