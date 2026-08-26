const SCRAPE_SOURCES = new Set(["hackernews", "reddit", "ingest", "scrape"]);
const SENSITIVE = new Set(["law", "medicine"]);

export function summarizeCases(cases = []) {
  const summary = {
    total: cases.length,
    pending: 0,
    published: 0,
    archived: 0,
    claimed: 0,
    scrapePending: 0,
    sensitive: 0,
    flagged: 0,
  };
  for (const c of cases) {
    if (c.status === "pending") summary.pending += 1;
    if (c.status === "published") summary.published += 1;
    if (c.status === "archived") summary.archived += 1;
    if (c.claimed_by) summary.claimed += 1;
    if (c.flagged) summary.flagged += 1;
    if (
      c.status === "pending" &&
      SCRAPE_SOURCES.has(String(c.source || "").toLowerCase())
    ) {
      summary.scrapePending += 1;
    }
    if (SENSITIVE.has(String(c.domain || "").toLowerCase())) {
      summary.sensitive += 1;
    }
  }
  return summary;
}

export function filterCases(cases, filter) {
  switch (filter) {
    case "pending":
      return cases.filter((c) => c.status === "pending");
    case "scrape":
      return cases.filter(
        (c) =>
          c.status === "pending" &&
          SCRAPE_SOURCES.has(String(c.source || "").toLowerCase())
      );
    case "sensitive":
      return cases.filter((c) =>
        SENSITIVE.has(String(c.domain || "").toLowerCase())
      );
    case "claimed":
      return cases.filter((c) => Boolean(c.claimed_by));
    case "hidden":
    case "archived":
      return cases.filter((c) => c.status === "archived");
    case "published":
      return cases.filter((c) => c.status === "published");
    case "flagged":
      return cases.filter((c) => Boolean(c.flagged));
    default:
      return cases;
  }
}

export function casePriority(caseItem = {}) {
  const pending = caseItem.status === "pending";
  const archived = caseItem.status === "archived";
  const flagged = Boolean(caseItem.flagged);
  const claimed = Boolean(caseItem.claimed_by);
  const sensitive = SENSITIVE.has(String(caseItem.domain || "").toLowerCase());
  const scrape = SCRAPE_SOURCES.has(String(caseItem.source || "").toLowerCase());
  const confirmationsRequired = Number(caseItem.confirmations_required) || 5;
  const confirmationCount = Number(caseItem.confirmation_count) || 0;
  const confirmationGap = Math.max(0, confirmationsRequired - confirmationCount);

  let score = 0;
  if (flagged) score += 1000;
  if (pending) score += 700;
  if (scrape && pending) score += 120;
  if (sensitive) score += 80;
  if (claimed) score += 40;
  score += Math.min(confirmationGap, confirmationsRequired) * 8;
  if (archived) score -= 400;

  let label = "Routine";
  if (flagged) label = "Flagged";
  else if (pending && scrape) label = "Scrape triage";
  else if (pending && sensitive) label = "Sensitive review";
  else if (pending) label = "Needs publish";
  else if (claimed) label = "Claimed follow-up";
  else if (archived) label = "Hidden";

  return { score, label };
}

export function sortCases(cases = [], sort = "priority") {
  const rows = [...cases];
  switch (String(sort || "priority").toLowerCase()) {
    case "newest":
      return rows.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    case "oldest":
      return rows.sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );
    case "gap":
      return rows.sort(
        (a, b) =>
          Number(b.gap_score || 0) - Number(a.gap_score || 0) ||
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    case "priority":
    default:
      return rows.sort((a, b) => {
        const pa = casePriority(a);
        const pb = casePriority(b);
        return (
          pb.score - pa.score ||
          Number(b.gap_score || 0) - Number(a.gap_score || 0) ||
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      });
  }
}

/** Case-insensitive topic/summary/id search for Steward desk. */
export function searchCases(cases, q) {
  const term = String(q || "")
    .trim()
    .toLowerCase();
  if (!term) return cases;
  return cases.filter((c) => {
    const hay = [
      c.id,
      c.topic,
      c.summary,
      c.domain,
      c.source,
      c.category,
    ]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");
    return hay.includes(term);
  });
}

export function normalizeAdminReason(reason, { max = 500 } = {}) {
  const text = String(reason || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return null;
  return text.slice(0, max);
}

const EDITABLE = new Set([
  "topic",
  "summary",
  "domain",
  "category",
  "cta_text",
]);

/** Pick allowed steward edit fields from a body. */
export function pickAdminEdits(body = {}) {
  const patch = {};
  for (const key of EDITABLE) {
    if (body[key] === undefined) continue;
    const val = String(body[key] ?? "").trim();
    if (key === "topic" && !val) {
      return { error: "topic cannot be empty", status: 400 };
    }
    if (key === "domain" && val) {
      patch.domain = val.toLowerCase();
      continue;
    }
    patch[key] = val;
  }
  if (!Object.keys(patch).length) {
    return { error: "No editable fields provided", status: 400 };
  }
  return { patch };
}
