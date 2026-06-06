import { randomUUID } from "node:crypto";

/**
 * @param {{
 *   cases: object[],
 *   precase: object[],
 *   seenPermalinks: Set<string>,
 *   scrapeRuns: object[],
 * }} ctx
 */
export function createMemoryIngestionAdapter(ctx) {
  return {
    async getCasesForAnalysis() {
      return [...ctx.cases];
    },

    async hasSeenPermalink(permalink) {
      return ctx.seenPermalinks.has(permalink);
    },

    async insertPrecase(row) {
      ctx.seenPermalinks.add(row.permalink);
      ctx.precase.push({
        ...row,
        created_at: new Date().toISOString(),
      });
    },

    async updatePrecase(permalink, patch) {
      const row = ctx.precase.find((p) => p.permalink === permalink);
      if (row) Object.assign(row, patch);
    },

    async mergeCase(caseId, { permalink, subreddit, pain_delta = 1 }) {
      const c = ctx.cases.find((x) => x.id === caseId);
      if (!c) return;
      c.pain_count = (c.pain_count ?? 0) + pain_delta;
      if (permalink) {
        c.permalinks = c.permalinks ?? [];
        if (!c.permalinks.includes(permalink)) c.permalinks.push(permalink);
      }
      if (subreddit) {
        c.subreddits = c.subreddits ?? [];
        if (!c.subreddits.includes(subreddit)) c.subreddits.push(subreddit);
      }
    },

    async createCase(row) {
      const created = {
        id: randomUUID(),
        created_at: new Date().toISOString(),
        ...row,
      };
      ctx.cases.push(created);
      return created;
    },

    async recordScrapeRun(stats) {
      ctx.scrapeRuns.push({ id: randomUUID(), ...stats });
      if (ctx.scrapeRuns.length > 50) ctx.scrapeRuns.shift();
    },

    async getLastScrapeRun() {
      return ctx.scrapeRuns.at(-1) ?? null;
    },

    async listPrecaseFeed(limit = 10) {
      return ctx.precase.slice(-limit).reverse();
    },
  };
}
