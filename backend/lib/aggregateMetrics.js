const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

function countBy(rows, key) {
  const out = {};
  for (const r of rows) {
    const k = r[key] ?? "unknown";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function avgGap(rows) {
  if (!rows.length) return 0;
  const sum = rows.reduce((a, c) => a + (c.gap_score ?? 0), 0);
  return Math.round(sum / rows.length);
}

/**
 * @param {object[]} enrichedCases
 * @param {object} [opts]
 * @param {object|null} [opts.lastScrapeRun]
 * @param {object} [opts.precaseByStatus]
 * @param {number} [opts.confirmationsLast7d]
 * @param {number} [opts.solvesLast7d]
 */
export function buildMetricsSummary(enrichedCases, opts = {}) {
  const now = Date.now();
  const published = enrichedCases.filter((c) => c.status === "published");
  const prospectorPool = published.filter(
    (c) => !c.claimed_by && c.lifecycle_state !== "green"
  );
  const newToday = enrichedCases.filter((c) => {
    const t = c.created_at ? new Date(c.created_at).getTime() : 0;
    return t > now - MS_DAY;
  });

  const lastRun = opts.lastScrapeRun ?? null;

  return {
    totals: {
      cases: enrichedCases.length,
      published: published.length,
      pending: enrichedCases.filter((c) => c.status === "pending").length,
      newToday: newToday.length,
    },
    byLifecycle: countBy(published, "lifecycle_state"),
    byDomain: countBy(enrichedCases, "domain"),
    bySource: countBy(enrichedCases, "source"),
    byQuadrant: countBy(published, "matrix_quadrant"),
    ingestFunnel: {
      lastRun: lastRun
        ? {
            scraped: lastRun.scraped_count ?? lastRun.scraped ?? 0,
            promoted: lastRun.promoted_count ?? lastRun.promoted ?? 0,
            merged: lastRun.merged_count ?? lastRun.merged ?? 0,
            rejected: lastRun.rejected_count ?? lastRun.rejected ?? 0,
            skipped: lastRun.skipped_count ?? lastRun.skipped ?? 0,
            finished_at: lastRun.finished_at ?? lastRun.started_at ?? null,
          }
        : null,
      precaseByStatus: opts.precaseByStatus ?? {},
    },
    velocity: {
      casesLast24h: newToday.length,
      confirmationsLast7d: opts.confirmationsLast7d ?? 0,
      solvesLast7d: opts.solvesLast7d ?? 0,
    },
    prospector: {
      unclaimed: prospectorPool.length,
      avgGap: avgGap(prospectorPool),
      highGap: prospectorPool.filter((c) => (c.gap_score ?? 0) >= 70).length,
    },
  };
}

/**
 * Build activity feed items from events, scrape runs, and recent cases.
 * @param {object} opts
 */
export function buildActivityFeed(opts = {}) {
  const {
    caseEvents = [],
    scrapeRuns = [],
    recentCases = [],
    limit = 20,
  } = opts;

  const items = [];

  for (const ev of caseEvents) {
    items.push({
      type: "event",
      event_type: ev.event_type,
      case_id: ev.case_id,
      topic: ev.topic ?? ev.metadata?.topic,
      source: ev.source ?? "user",
      created_at: ev.created_at,
      metadata: ev.metadata ?? {},
    });
  }

  for (const run of scrapeRuns) {
    const when = run.finished_at ?? run.started_at;
    items.push({
      type: "scrape",
      promoted: run.promoted_count ?? run.promoted ?? 0,
      scraped: run.scraped_count ?? run.scraped ?? 0,
      merged: run.merged_count ?? run.merged ?? 0,
      created_at: when,
    });
  }

  for (const c of recentCases) {
    items.push({
      type: "case",
      case_id: c.id,
      topic: c.topic,
      source: c.source ?? "user",
      status: c.status,
      created_at: c.created_at,
    });
  }

  items.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  return items.slice(0, limit);
}

export function formatActivityLabel(item) {
  if (item.type === "scrape") {
    return `Ingest: ${item.promoted ?? 0} promoted of ${item.scraped ?? 0} fetched`;
  }
  if (item.type === "case") {
    return `New case: ${item.topic}`;
  }
  const labels = {
    submitted: "Submitted",
    confirmed: "Validated",
    published: "Published to matrix",
    pain_added: "Pain vote added",
    pain_removed: "Pain vote removed",
    claimed: "Case claimed",
    unclaimed: "Case unclaimed",
    solve_added: "Solution proposed",
    solve_accepted: "Solution accepted",
    solve_unaccepted: "Solution un-accepted",
    marked_solved: "Marked solved",
    merged_signal: "Signal merged",
  };
  const label = labels[item.event_type] ?? item.event_type;
  const topic = item.topic ?? item.metadata?.topic;
  return topic ? `${label}: ${topic}` : label;
}

export { MS_DAY, MS_WEEK };
