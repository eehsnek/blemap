import { apiFetch } from "../api.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util.js";
import { emitDataChanged, onDataChanged, debounce } from "../lib/events.js";

/** @typedef {'all'|'pending'|'scrape'|'sensitive'|'claimed'|'hidden'|'flagged'} StewardFilter */
/** @typedef {'priority'|'newest'|'oldest'|'gap'} StewardSort */

/** @type {StewardFilter} */
let currentFilter = "all";
/** @type {StewardSort} */
let currentSort = "priority";
let searchQuery = "";
let actionReason = "";
/** @type {Set<string>} */
let selectedIds = new Set();
/** @type {Map<string, object>} */
let caseById = new Map();
let unsubData = null;
/** @type {string[]} */
let roleOptions = ["user", "admin"];
let queueUsers = [];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Needs publish" },
  { id: "flagged", label: "Flagged" },
  { id: "scrape", label: "Scrape pending" },
  { id: "sensitive", label: "Sensitive" },
  { id: "claimed", label: "Claimed" },
  { id: "hidden", label: "Hidden" },
];

const DOMAINS = ["general", "law", "medicine", "tech", "finance"];
const SORTS = [
  { id: "priority", label: "Priority first" },
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "gap", label: "Highest gap" },
];

/**
 * @param {HTMLElement} container
 * @param {{ section?: string }} [opts]
 */
export async function mount(container, opts = {}) {
  selectedIds = new Set();
  caseById = new Map();
  const section = opts.section || "queue";

  container.innerHTML = `
    <div class="steward">
      <header class="steward-hero onboarding-card mb-8">
        <p class="text-sm uppercase tracking-wide text-[#43e2d2] mb-1">Living Archive · Ops</p>
        <h1 class="text-2xl md:text-3xl font-bold text-[#ffb779] mb-2">Archive Steward</h1>
        <p class="text-[#e5e2e1]/70 text-sm max-w-2xl">
          Ops desk for curators — not the community matrix. Flag cases, manage users,
          run scraping, and repair intelligence before it reaches prospectors.
        </p>
      </header>
      <div id="admin-msg" class="steward-msg mb-4 text-sm hidden" role="status"></div>
      <div id="steward-section"></div>
    </div>
  `;

  const panel = container.querySelector("#steward-section");
  if (section === "users") {
    await mountUsers(panel);
  } else if (section === "scrape") {
    await mountScrape(panel);
  } else {
    await mountQueue(panel);
  }

  return () => {
    unsubData?.();
    unsubData = null;
  };
}

function showMsg(text, tone = "info") {
  const el = document.getElementById("admin-msg");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("hidden", !text);
  el.classList.toggle("steward-msg--warn", tone === "warn");
  el.classList.toggle("steward-msg--ok", tone === "ok");
}

function escapeAttr(s) {
  return escapeHtml(String(s ?? "")).replace(/"/g, "&quot;");
}

function formatWhen(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function casePriorityLabel(c) {
  if (c.flagged) return "Flagged";
  if (
    c.status === "pending" &&
    ["hackernews", "reddit", "ingest", "scrape"].includes(
      String(c.source || "").toLowerCase()
    )
  ) {
    return "Scrape triage";
  }
  if (
    c.status === "pending" &&
    ["law", "medicine"].includes(String(c.domain || "").toLowerCase())
  ) {
    return "Sensitive review";
  }
  if (c.status === "pending") return "Needs publish";
  if (c.claimed_by) return "Claimed follow-up";
  if (c.status === "archived") return "Hidden";
  return "Routine";
}

/* ─── Queue ─────────────────────────────────────────────── */

async function mountQueue(panel) {
  panel.innerHTML = `
    <section id="steward-pulse" class="metrics-row mb-6" aria-live="polite"></section>
    <section id="steward-context" class="steward-context mb-6 hidden"></section>

    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 class="text-xl font-semibold text-[#ffb779]">Moderation queue</h2>
      <button type="button" id="steward-refresh" class="btn-ghost text-sm">Refresh</button>
    </div>

    <div class="steward-toolbar mb-4">
      <div>
        <label class="steward-search-label" for="steward-search">Search archive</label>
        <input id="steward-search" type="search" class="steward-search" placeholder="Topic, summary, domain, id…" value="${escapeAttr(searchQuery)}" />
      </div>
      <div>
        <label class="steward-search-label" for="steward-sort">Queue order</label>
        <select id="steward-sort" class="steward-field">
          ${SORTS.map((s) => `<option value="${s.id}"${s.id === currentSort ? " selected" : ""}>${escapeHtml(s.label)}</option>`).join("")}
        </select>
      </div>
    </div>

    <div id="steward-filters" class="steward-filters mb-3" role="tablist"></div>
    <div id="steward-opsbar" class="steward-opsbar mb-4">
      <div class="steward-opsbar__row">
        <div>
          <label class="steward-search-label" for="steward-action-reason">Audit reason</label>
          <input id="steward-action-reason" type="text" class="steward-field" maxlength="500" placeholder="Optional reason applied to steward actions…" value="${escapeAttr(actionReason)}" />
        </div>
        <div id="steward-results-meta" class="steward-results-meta text-xs"></div>
      </div>
    </div>
    <div id="steward-bulk" class="steward-bulk mb-4 hidden"></div>
    <div id="admin-list" class="steward-list space-y-3">Loading archive…</div>
  `;

  renderFilterBar();
  document.getElementById("steward-refresh")?.addEventListener("click", () =>
    refreshQueue()
  );
  const searchEl = document.getElementById("steward-search");
  const sortEl = document.getElementById("steward-sort");
  const reasonEl = document.getElementById("steward-action-reason");
  const onSearch = debounce(() => {
    searchQuery = searchEl?.value?.trim() || "";
    loadQueue();
  }, 250);
  searchEl?.addEventListener("input", onSearch);
  sortEl?.addEventListener("change", () => {
    currentSort = /** @type {StewardSort} */ (sortEl.value || "priority");
    loadQueue();
  });
  reasonEl?.addEventListener("input", () => {
    actionReason = reasonEl.value.trim();
  });

  unsubData?.();
  unsubData = onDataChanged(debounce(() => refreshQueue(), 300));
  await refreshQueue();
}

function renderFilterBar() {
  const el = document.getElementById("steward-filters");
  if (!el) return;
  el.innerHTML = FILTERS.map(
    (f) => `
    <button type="button" role="tab" data-filter="${f.id}"
      class="steward-filter${f.id === currentFilter ? " is-active" : ""}"
      aria-selected="${f.id === currentFilter}">
      ${escapeHtml(f.label)}
    </button>`
  ).join("");
  el.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = /** @type {StewardFilter} */ (btn.dataset.filter || "all");
      selectedIds.clear();
      renderFilterBar();
      renderBulkBar();
      loadQueue();
    });
  });
}

function renderBulkBar() {
  const el = document.getElementById("steward-bulk");
  if (!el) return;
  if (!selectedIds.size) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.classList.remove("hidden");
  el.innerHTML = `
    <span class="steward-bulk__count">${selectedIds.size} selected</span>
    <button type="button" data-bulk="publish" class="btn-primary text-sm">Bulk publish</button>
    <button type="button" data-bulk="hide" class="btn-ghost text-sm">Bulk hide</button>
    <button type="button" data-bulk="restore" class="btn-secondary text-sm">Bulk restore</button>
    <button type="button" data-bulk="clear" class="btn-ghost text-sm">Clear</button>
  `;
  el.querySelectorAll("[data-bulk]").forEach((btn) => {
    btn.addEventListener("click", () => onBulk(btn.dataset.bulk));
  });
}

async function refreshQueue() {
  await Promise.all([loadPulseContext(), loadQueue()]);
}

async function loadPulseContext() {
  const pulse = document.getElementById("steward-pulse");
  const ctx = document.getElementById("steward-context");
  if (!pulse) return;
  try {
    const [{ summary }, ingestion, health] = await Promise.all([
      apiFetch(`/admin/cases?filter=all`),
      apiFetch("/ingestion/status").catch(() => ({ lastRun: null })),
      fetch("/health").then((r) => r.json()).catch(() => null),
    ]);
    const s = summary || {};
    pulse.innerHTML = `
      <div class="metrics-row__inner">
        <span class="metrics-pill">${s.pending ?? 0} pending</span>
        <span class="metrics-pill">${s.flagged ?? 0} flagged</span>
        <span class="metrics-pill metrics-pill--domain">${s.scrapePending ?? 0} scrape awaiting</span>
        <span class="metrics-pill">${s.claimed ?? 0} claimed</span>
        <span class="metrics-pill">${s.archived ?? 0} hidden</span>
        <span class="metrics-pill">${s.published ?? 0} published</span>
      </div>`;
    if (ctx) {
      const run = ingestion?.lastRun;
      const when = run?.finished_at || run?.started_at;
      ctx.classList.remove("hidden");
      ctx.innerHTML = `
        <p class="text-sm text-[#e5e2e1]/60">
          Store <strong class="text-[#43e2d2]">${escapeHtml(health?.store || "—")}</strong>
          · Gemini <strong class="text-[#43e2d2]">${escapeHtml(String(health?.gemini?.status || "—"))}</strong>
          · Last ingest ${when ? escapeHtml(new Date(when).toLocaleString()) : "—"}
        </p>`;
    }
  } catch (err) {
    pulse.innerHTML = `<p class="text-sm text-[#ffb779]">${escapeHtml(err.message)}</p>`;
  }
}

async function loadQueue() {
  const list = document.getElementById("admin-list");
  const meta = document.getElementById("steward-results-meta");
  if (!list) return;
  try {
    const qs = new URLSearchParams({
      filter: currentFilter,
      sort: currentSort,
    });
    if (searchQuery) qs.set("q", searchQuery);
    const { cases, summary } = await apiFetch(`/admin/cases?${qs}`);
    caseById = new Map((cases || []).map((c) => [c.id, c]));
    selectedIds = new Set([...selectedIds].filter((id) => caseById.has(id)));
    renderBulkBar();
    if (meta) {
      meta.innerHTML = `
        <span>${cases?.length ?? 0} shown</span>
        <span> · ${summary?.total ?? 0} total</span>
        <span> · ${selectedIds.size} selected</span>
      `;
    }
    if (!cases?.length) {
      list.innerHTML = `
        <div class="onboarding-card max-w-xl">
          <h3 class="text-lg font-semibold text-[#ffb779] mb-2">Queue clear</h3>
          <p class="text-sm text-[#e5e2e1]/70">${summary?.total ?? 0} cases in moderation scope</p>
        </div>`;
      return;
    }
    list.innerHTML = cases.map(renderCard).join("");
    wireCards(list);
  } catch (err) {
    list.innerHTML = `<p class="text-[#ffb779]">${escapeHtml(err.message)}</p>`;
  }
}

function renderCard(c) {
  const pending = c.status === "pending";
  const archived = c.status === "archived";
  const claimed = Boolean(c.claimed_by);
  const flagged = Boolean(c.flagged);
  const sensitive = ["law", "medicine"].includes(String(c.domain || "").toLowerCase());
  const scrape = ["hackernews", "reddit", "ingest", "scrape"].includes(
    String(c.source || "").toLowerCase()
  );
  const toneClass = archived
    ? "steward-card--archived"
    : flagged
      ? "steward-card--flagged"
      : pending
        ? "steward-card--pending"
        : claimed
          ? "steward-card--claimed"
          : "steward-card--published";
  const checked = selectedIds.has(c.id) ? "checked" : "";
  const accepted = (c.solves || []).filter((s) => s.accepted);
  const priority = casePriorityLabel(c);
  const createdAt = formatWhen(c.created_at);
  const domainOpts = DOMAINS.map(
    (d) =>
      `<option value="${d}"${c.domain === d ? " selected" : ""}>${d}</option>`
  ).join("");

  return `
    <article class="steward-card ${toneClass}" data-id="${escapeHtml(c.id)}" data-topic="${escapeHtml(c.topic || "")}">
      <div class="flex flex-wrap justify-between gap-2 mb-2">
        <label class="steward-select">
          <input type="checkbox" data-select ${checked} aria-label="Select case" />
          <div>
            <p class="steward-priority text-xs">${escapeHtml(priority)}</p>
            <h3 class="font-semibold text-[#ffb779] text-lg">${escapeHtml(c.topic)}</h3>
          </div>
        </label>
        <div class="flex flex-wrap gap-2 text-xs items-center">
          <span class="steward-chip steward-chip--status">${escapeHtml(c.status)}</span>
          ${flagged ? `<span class="steward-chip steward-chip--flag">flagged</span>` : ""}
          ${scrape ? `<span class="steward-chip">scrape</span>` : ""}
          ${sensitive ? `<span class="steward-chip steward-chip--sensitive">sensitive</span>` : ""}
          ${claimed ? `<span class="steward-chip steward-chip--claim">claimed</span>` : ""}
        </div>
      </div>
      <p class="text-sm text-[#e5e2e1]/75 mb-3">${escapeHtml(c.summary || "")}</p>
      ${
        flagged && c.flag_reason
          ? `<p class="steward-flag-reason text-xs mb-3">Flag · ${escapeHtml(c.flag_reason)}</p>`
          : ""
      }
      <div class="steward-meta text-xs text-[#e5e2e1]/50 mb-3">
        <span>Source · ${escapeHtml(c.source || "user")}</span>
        <span>Domain · ${escapeHtml(c.domain || "general")}</span>
        <span>Gap · ${c.gap_score ?? "—"}</span>
        <span>Created · ${escapeHtml(createdAt)}</span>
        ${
          pending
            ? `<span>Confirms · ${c.confirmation_count ?? 0}/${c.confirmations_required ?? 5}</span>`
            : ""
        }
      </div>
      ${
        accepted.length
          ? `<div class="steward-solves mb-3">
              ${accepted
                .map(
                  (s) => `
                <div class="steward-solve" data-solve-id="${escapeHtml(s.id)}">
                  <p class="text-xs text-[#e5e2e1]/55 mb-1">Accepted solution</p>
                  <p class="text-sm text-[#e5e2e1]/85 mb-2">${escapeHtml(s.solve_text || "")}</p>
                  <button type="button" data-act="unaccept-solve" class="btn-ghost text-sm">Reopen (unaccept)</button>
                </div>`
                )
                .join("")}
            </div>`
          : ""
      }
      <div class="flex flex-wrap gap-2 admin-actions mb-2">
        ${pending ? `<button type="button" data-act="publish" class="btn-primary text-sm">Publish</button>` : ""}
        ${!flagged ? `<button type="button" data-act="flag" class="btn-ghost text-sm">Flag</button>` : `<button type="button" data-act="unflag" class="btn-secondary text-sm">Clear flag</button>`}
        ${!archived ? `<button type="button" data-act="hide" class="btn-ghost text-sm">Hide</button>` : ""}
        ${archived ? `<button type="button" data-act="restore" class="btn-secondary text-sm">Restore</button>` : ""}
        ${claimed ? `<button type="button" data-act="unclaim" class="btn-ghost text-sm">Force unclaim</button>` : ""}
        <button type="button" data-act="toggle-repair" class="btn-ghost text-sm">Repair</button>
        <button type="button" data-act="toggle-audit" class="btn-ghost text-sm">Audit</button>
        <button type="button" data-act="open" class="btn-ghost text-sm">Inspect</button>
      </div>
      <div class="steward-repair hidden" data-panel="repair">
        <label class="steward-field-label">Reason (audit)</label>
        <input type="text" data-field="reason" class="steward-field" placeholder="Why this action…" maxlength="500" />
        <label class="steward-field-label">Topic</label>
        <input type="text" data-field="topic" class="steward-field" value="${escapeAttr(c.topic || "")}" />
        <label class="steward-field-label">Summary</label>
        <textarea data-field="summary" class="steward-field steward-field--area" rows="3">${escapeHtml(c.summary || "")}</textarea>
        <div class="steward-repair-row">
          <div>
            <label class="steward-field-label">Domain</label>
            <select data-field="domain" class="steward-field">${domainOpts}</select>
          </div>
          <div>
            <label class="steward-field-label">Category</label>
            <input type="text" data-field="category" class="steward-field" value="${escapeAttr(c.category || "")}" />
          </div>
        </div>
        <label class="steward-field-label">CTA text</label>
        <input type="text" data-field="cta_text" class="steward-field" value="${escapeAttr(c.cta_text || "")}" />
        <div class="flex flex-wrap gap-2 mt-3">
          <button type="button" data-act="save-edit" class="btn-primary text-sm">Save edits</button>
        </div>
        <div class="steward-merge mt-4">
          <label class="steward-field-label">Merge into (keep target id)</label>
          <div class="steward-repair-row">
            <input type="text" data-field="intoCaseId" class="steward-field" placeholder="Target case UUID" list="steward-merge-opts-${escapeAttr(c.id)}" />
            <button type="button" data-act="merge" class="btn-ghost text-sm">Merge &amp; archive</button>
          </div>
          <datalist id="steward-merge-opts-${escapeAttr(c.id)}">
            ${[...caseById.values()]
              .filter((o) => o.id !== c.id && o.status !== "archived")
              .slice(0, 40)
              .map(
                (o) =>
                  `<option value="${escapeAttr(o.id)}">${escapeHtml(o.topic || o.id)}</option>`
              )
              .join("")}
          </datalist>
        </div>
      </div>
      <div class="steward-audit hidden" data-panel="audit"><p class="text-xs text-[#e5e2e1]/45">Loading audit…</p></div>
    </article>`;
}

function wireCards(list) {
  list.querySelectorAll("article").forEach((article) => {
    article.querySelector("[data-select]")?.addEventListener("change", (e) => {
      const id = article.dataset.id;
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      renderBulkBar();
    });
    article.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.act;
        const id = article.dataset.id;
        const topic = article.dataset.topic;
        if (act === "toggle-repair") {
          article.querySelector('[data-panel="repair"]')?.classList.toggle("hidden");
          return;
        }
        if (act === "toggle-audit") {
          const panel = article.querySelector('[data-panel="audit"]');
          panel?.classList.toggle("hidden");
          if (panel && !panel.dataset.loaded) void loadAudit(id, panel);
          return;
        }
        if (act === "unaccept-solve") {
          const solveId = btn.closest("[data-solve-id]")?.dataset.solveId;
          void onAction(id, act, topic, article, { solveId });
          return;
        }
        void onAction(id, act, topic, article);
      });
    });
  });
}

function readRepair(article) {
  const get = (name) =>
    article.querySelector(`[data-field="${name}"]`)?.value?.trim() || "";
  return {
    reason: get("reason"),
    topic: get("topic"),
    summary: get("summary"),
    domain: get("domain"),
    category: get("category"),
    cta_text: get("cta_text"),
    intoCaseId: get("intoCaseId"),
  };
}

async function loadAudit(id, panel) {
  try {
    const events = await apiFetch(`/admin/cases/${id}/events?limit=15`);
    panel.dataset.loaded = "1";
    if (!events?.length) {
      panel.innerHTML = `<p class="text-xs text-[#e5e2e1]/45">No audit events yet.</p>`;
      return;
    }
    panel.innerHTML = `
      <ul class="steward-audit-list">
        ${events
          .map((e) => {
            const when = e.created_at ? new Date(e.created_at).toLocaleString() : "";
            const reason = e.metadata?.reason
              ? ` — ${escapeHtml(e.metadata.reason)}`
              : "";
            return `<li><strong>${escapeHtml(e.event_type || "event")}</strong>
              <span class="steward-audit-when">${escapeHtml(when)}</span>${reason}</li>`;
          })
          .join("")}
      </ul>`;
  } catch (err) {
    panel.innerHTML = `<p class="text-xs text-[#ffb779]">${escapeHtml(err.message)}</p>`;
  }
}

async function onBulk(action) {
  if (action === "clear") {
    selectedIds.clear();
    renderBulkBar();
    await loadQueue();
    return;
  }
  try {
    const result = await apiFetch("/admin/cases/bulk", {
      method: "POST",
      body: JSON.stringify({
        action,
        ids: [...selectedIds],
        reason: actionReason || undefined,
      }),
    });
    selectedIds.clear();
    emitDataChanged("admin");
    showMsg(
      `Bulk ${action}: ${result.ok} ok${result.failed ? `, ${result.failed} failed` : ""}`,
      result.failed ? "warn" : "ok"
    );
    await refreshQueue();
  } catch (err) {
    showMsg(err.message, "warn");
  }
}

async function onAction(id, act, topic, article, extra = {}) {
  showMsg("");
  const repair = article ? readRepair(article) : {};
  try {
    if (act === "open") {
      navigate("case", { id });
      return;
    }
    if (act === "hide") {
      if (!window.confirm(`Hide “${topic || "this case"}”?`)) return;
    }
    if (act === "flag") {
      await apiFetch(`/admin/cases/${id}/flag`, {
        method: "POST",
        body: JSON.stringify({
          reason: repair.reason || actionReason || undefined,
        }),
      });
      emitDataChanged("admin");
      showMsg("Case flagged — hidden from community matrix", "ok");
      await refreshQueue();
      return;
    }
    if (act === "unflag") {
      await apiFetch(`/admin/cases/${id}/unflag`, {
        method: "POST",
        body: JSON.stringify({
          reason: repair.reason || actionReason || undefined,
        }),
      });
      emitDataChanged("admin");
      showMsg("Flag cleared", "ok");
      await refreshQueue();
      return;
    }
    if (act === "merge") {
      if (!repair.intoCaseId) {
        showMsg("Enter the target case id to merge into.", "warn");
        return;
      }
      if (!window.confirm(`Merge into ${repair.intoCaseId}?`)) return;
      await apiFetch(`/admin/cases/${id}/merge`, {
        method: "POST",
        body: JSON.stringify({
          intoCaseId: repair.intoCaseId,
          reason: repair.reason || actionReason || undefined,
        }),
      });
      emitDataChanged("admin");
      showMsg("Merged into target case", "ok");
      await refreshQueue();
      return;
    }
    if (act === "save-edit") {
      await apiFetch(`/admin/cases/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          topic: repair.topic,
          summary: repair.summary,
          domain: repair.domain,
          category: repair.category,
          cta_text: repair.cta_text,
          reason: repair.reason || actionReason || undefined,
        }),
      });
      emitDataChanged("admin");
      showMsg("Case fields updated", "ok");
      await refreshQueue();
      return;
    }
    if (act === "unaccept-solve") {
      await apiFetch(`/admin/solves/${extra.solveId}/unaccept`, {
        method: "POST",
        body: JSON.stringify({
          reason: repair.reason || actionReason || undefined,
        }),
      });
      emitDataChanged("admin");
      showMsg("Solution unaccepted", "ok");
      await refreshQueue();
      return;
    }

    const path =
      act === "publish"
        ? `/admin/cases/${id}/publish`
        : act === "hide"
          ? `/admin/cases/${id}/hide`
          : act === "restore"
            ? `/admin/cases/${id}/restore`
            : act === "unclaim"
              ? `/admin/cases/${id}/unclaim`
              : null;
    if (!path) return;
    await apiFetch(path, {
      method: "POST",
      body: JSON.stringify({
        reason: repair.reason || actionReason || undefined,
      }),
    });
    emitDataChanged("admin");
    showMsg(
      ({
        publish: "Published",
        hide: "Hidden",
        restore: "Restored",
        unclaim: "Claim cleared",
      })[act] || act,
      "ok"
    );
    await refreshQueue();
  } catch (err) {
    showMsg(err.message, "warn");
  }
}

/* ─── Users ─────────────────────────────────────────────── */

async function mountUsers(panel) {
  panel.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 class="text-xl font-semibold text-[#ffb779]">Users</h2>
      <button type="button" id="users-refresh" class="btn-ghost text-sm">Refresh</button>
    </div>
    <p class="text-sm text-[#e5e2e1]/60 mb-4 max-w-2xl">
      Promote Archive Stewards, demote to community roles, or disable accounts.
      Disabled users cannot call authenticated APIs.
    </p>
    <div class="steward-toolbar mb-4">
      <div>
        <label class="steward-search-label" for="users-search">Search users</label>
        <input id="users-search" type="search" class="steward-search" placeholder="Email, username, id…" />
      </div>
    </div>
    <div id="users-list" class="steward-users">Loading users…</div>
  `;
  document.getElementById("users-refresh")?.addEventListener("click", () =>
    loadUsers()
  );
  document.getElementById("users-search")?.addEventListener(
    "input",
    debounce(() => renderUsers(), 150)
  );
  await loadUsers();
}

async function loadUsers() {
  const list = document.getElementById("users-list");
  if (!list) return;
  try {
    const { users, roles } = await apiFetch("/admin/users");
    roleOptions = roles?.length ? roles : ["user", "admin"];
    queueUsers = users || [];
    renderUsers();
  } catch (err) {
    list.innerHTML = `<p class="text-[#ffb779]">${escapeHtml(err.message)}</p>`;
  }
}

function renderUsers() {
  const list = document.getElementById("users-list");
  if (!list) return;
  const term =
    document.getElementById("users-search")?.value?.trim().toLowerCase() || "";
  const users = !term
    ? queueUsers
    : queueUsers.filter((u) =>
        [u.email, u.username, u.id, u.role]
          .map((v) => String(v || "").toLowerCase())
          .join(" ")
          .includes(term)
      );
  if (!users.length) {
    list.innerHTML = `<p class="text-sm text-[#e5e2e1]/55">No matching profiles found.</p>`;
    return;
  }
  list.innerHTML = `
      <div class="steward-user-table">
        ${users
          .map((u) => {
            const roleSelect = roleOptions
              .map(
                (r) =>
                  `<option value="${escapeAttr(r)}"${u.role === r ? " selected" : ""}>${escapeHtml(r)}</option>`
              )
              .join("");
            return `
          <article class="steward-user-row" data-user-id="${escapeAttr(u.id)}">
            <div>
              <p class="steward-user-email">${escapeHtml(u.email || u.username || u.id)}</p>
              <p class="steward-user-meta text-xs">
                ${u.disabled ? "<span class='steward-chip steward-chip--flag'>disabled</span> " : ""}
                ${escapeHtml(u.username || "—")} · ${escapeHtml(u.id.slice(0, 8))}…
              </p>
            </div>
            <div class="steward-user-actions">
              <select data-role class="steward-field steward-field--compact">${roleSelect}</select>
              <button type="button" data-act="save-role" class="btn-primary text-sm">Set role</button>
              <button type="button" data-act="toggle-disable" class="btn-ghost text-sm">
                ${u.disabled ? "Enable" : "Disable"}
              </button>
            </div>
          </article>`;
          })
          .join("")}
      </div>`;

  list.querySelectorAll(".steward-user-row").forEach((row) => {
    const id = row.dataset.userId;
    row.querySelector('[data-act="save-role"]')?.addEventListener("click", async () => {
      const role = row.querySelector("[data-role]")?.value;
      try {
        await apiFetch(`/admin/users/${id}/role`, {
          method: "POST",
          body: JSON.stringify({ role }),
        });
        showMsg(`Role set to ${role}`, "ok");
        await loadUsers();
      } catch (err) {
        showMsg(err.message, "warn");
      }
    });
    row
      .querySelector('[data-act="toggle-disable"]')
      ?.addEventListener("click", async () => {
        const enable = row.querySelector('[data-act="toggle-disable"]')
          ?.textContent === "Enable";
        try {
          await apiFetch(`/admin/users/${id}/disable`, {
            method: "POST",
            body: JSON.stringify({ disabled: !enable }),
          });
          showMsg(enable ? "User enabled" : "User disabled", "ok");
          await loadUsers();
        } catch (err) {
          showMsg(err.message, "warn");
        }
      });
  });
}

/* ─── Scraping ──────────────────────────────────────────── */

async function mountScrape(panel) {
  panel.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 class="text-xl font-semibold text-[#ffb779]">Case scraping</h2>
      <div class="flex gap-2">
        <button type="button" id="scrape-refresh" class="btn-ghost text-sm">Refresh</button>
        <button type="button" id="scrape-run" class="btn-primary text-sm">Run ingest scrape</button>
      </div>
    </div>
    <div id="scrape-status" class="steward-context mb-4">Loading…</div>
    <h3 class="text-sm font-semibold text-[#ffb779] mb-2">Recent ingest signals</h3>
    <div id="scrape-precase" class="steward-precase">Loading…</div>
  `;

  document.getElementById("scrape-refresh")?.addEventListener("click", () =>
    loadScrape()
  );
  document.getElementById("scrape-run")?.addEventListener("click", async () => {
    const btn = document.getElementById("scrape-run");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Running…";
    }
    try {
      const result = await apiFetch("/admin/scrape/run", {
        method: "POST",
        body: "{}",
      });
      showMsg(
        `Scrape done · promoted ${result.promoted ?? 0} · merged ${result.merged ?? 0} · rejected ${result.rejected ?? 0}`,
        "ok"
      );
      emitDataChanged("admin");
      await loadScrape();
    } catch (err) {
      showMsg(err.message, "warn");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Run ingest scrape";
      }
    }
  });

  await loadScrape();
}

async function loadScrape() {
  const status = document.getElementById("scrape-status");
  const precase = document.getElementById("scrape-precase");
  try {
    const data = await apiFetch("/admin/scrape");
    const run = data.lastRun;
    const when = run?.finished_at || run?.started_at;
    if (status) {
      status.innerHTML = `
        <p class="text-sm text-[#e5e2e1]/70">
          Publish mode <strong class="text-[#43e2d2]">${escapeHtml(data.publishMode || "pending")}</strong>
          · Last run ${when ? escapeHtml(new Date(when).toLocaleString()) : "—"}
          ${
            run
              ? `· scraped ${run.scraped_count ?? 0}, promoted ${run.promoted_count ?? 0}, merged ${run.merged_count ?? 0}, rejected ${run.rejected_count ?? 0}, skipped ${run.skipped_count ?? 0}`
              : ""
          }
        </p>
        <p class="text-xs text-[#e5e2e1]/45 mt-2">
          Mode is controlled by <code>SCRAPE_PUBLISH_MODE</code> (pending = community confirm; auto = immediate matrix).
        </p>`;
    }
    const rows = (data.precase || []).slice(0, 20);
    if (precase) {
      if (!rows.length) {
        precase.innerHTML = `<p class="text-sm text-[#e5e2e1]/55">No precase signals yet.</p>`;
      } else {
        precase.innerHTML = `
          <ul class="steward-precase-list">
            ${rows
              .map((p) => {
                const reason = p.rejection_reason
                  ? ` — ${escapeHtml(p.rejection_reason)}`
                  : "";
                return `<li><span class="steward-chip">${escapeHtml(p.ai_status || "pending")}</span> ${escapeHtml(p.title || "Untitled")}${reason}</li>`;
              })
              .join("")}
          </ul>`;
      }
    }
  } catch (err) {
    if (status) status.innerHTML = `<p class="text-[#ffb779]">${escapeHtml(err.message)}</p>`;
  }
}
