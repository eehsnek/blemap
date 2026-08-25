import { supabase } from "../supabaseClient.js";
import { apiFetch } from "../api.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util.js";
import { emitDataChanged, onDataChanged, debounce } from "../lib/events.js";
import { mountCaseFilters, filtersToQuery } from "../components/caseFilters.js";

async function getUserWithTimeout(ms = 3000) {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("getUser timeout")), ms)
      ),
    ]);
    return result.data?.user ?? null;
  } catch {
    return null;
  }
}

let currentUser = null;
let currentFilters = {};
let viewMode = "cards";

export async function mount(container) {
  const user = await getUserWithTimeout();
  currentUser = user;
  const firstName = user?.email?.split("@")[0] || "there";

  container.innerHTML = `
    <div>
      <div id="welcome-banner" class="onboarding-card mb-8">
        <p class="text-sm uppercase tracking-wide text-[#43e2d2] mb-1">Living Archive</p>
        <h1 class="text-2xl md:text-3xl font-bold text-[#ffb779] mb-2">Welcome back, ${escapeHtml(firstName)}</h1>
        <p class="text-[#e5e2e1]/70 text-sm max-w-2xl">
          Start on Home to review cases, submit new problems, then explore the Matrix once cases are published.
        </p>
      </div>
      <section id="activity-strip" class="activity-strip mb-6 hidden"></section>
      <section id="metrics-row" class="metrics-row mb-8 hidden"></section>
      <section class="mb-10">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 class="text-xl font-semibold text-[#ffb779]">Your cases</h2>
          <div class="flex gap-2">
            <button type="button" id="view-cards" class="btn-ghost text-sm view-toggle view-toggle--active">Cards</button>
            <button type="button" id="view-table" class="btn-ghost text-sm view-toggle">Table</button>
          </div>
        </div>
        <div id="home-filters" class="mb-4"></div>
        <div id="cases" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"></div>
      </section>
      <section>
        <h2 class="text-xl font-semibold mb-4 text-[#43e2d2]">Pre-Case feed</h2>
        <ul id="reddit-feed" class="space-y-3 text-[#e5e2e1]/80"></ul>
      </section>
    </div>
  `;

  if (!user) return () => {};

  document.getElementById("view-cards")?.addEventListener("click", () => {
    viewMode = "cards";
    document.getElementById("view-cards")?.classList.add("view-toggle--active");
    document.getElementById("view-table")?.classList.remove("view-toggle--active");
    loadCases(user);
  });
  document.getElementById("view-table")?.addEventListener("click", () => {
    viewMode = "table";
    document.getElementById("view-table")?.classList.add("view-toggle--active");
    document.getElementById("view-cards")?.classList.remove("view-toggle--active");
    loadCases(user);
  });

  const filterCleanup = mountCaseFilters(document.getElementById("home-filters"), {
    onChange: (filters) => {
      currentFilters = filters;
      loadCases(user);
    },
  });

  const refresh = debounce(() => {
    loadPreCases();
    loadCases(user);
    loadActivity();
    loadMetrics();
  }, 300);

  await loadPreCases();
  await loadCases(user);
  await loadActivity();
  await loadMetrics();

  const unsubData = onDataChanged(refresh);

  return () => {
    unsubData();
    filterCleanup?.();
  };
}

function activityLabel(item) {
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
    claimed: "Case claimed",
    solve_added: "Solution proposed",
    solve_accepted: "Solution accepted",
    marked_solved: "Marked solved",
    merged_signal: "Signal merged",
  };
  const label = labels[item.event_type] ?? item.event_type;
  const topic = item.topic ?? item.metadata?.topic;
  return topic ? `${label}: ${topic}` : label;
}

async function loadActivity() {
  const strip = document.getElementById("activity-strip");
  if (!strip) return;
  try {
    const { items } = await apiFetch("/activity/recent?limit=5");
    if (!items?.length) {
      strip.classList.add("hidden");
      return;
    }
    strip.classList.remove("hidden");
    strip.innerHTML = `
      <p class="activity-strip__title">Living Archive activity</p>
      <ul class="activity-strip__list">
        ${items
          .map(
            (item) => `
          <li class="activity-strip__item">
            <span class="activity-strip__dot"></span>
            ${escapeHtml(activityLabel(item))}
            ${item.case_id ? `<button type="button" class="activity-strip__link" data-case="${escapeHtml(item.case_id)}">View</button>` : ""}
          </li>`
          )
          .join("")}
      </ul>`;
    strip.querySelectorAll("[data-case]").forEach((btn) => {
      btn.addEventListener("click", () => navigate("case", { id: btn.dataset.case }));
    });
  } catch {
    strip.classList.add("hidden");
  }
}

async function loadMetrics() {
  const row = document.getElementById("metrics-row");
  if (!row) return;
  try {
    const m = await apiFetch("/metrics/summary");
    const domains = m.byDomain ?? {};
    row.classList.remove("hidden");
    row.innerHTML = `
      <div class="metrics-row__inner">
        <span class="metrics-pill">${m.totals?.published ?? 0} published</span>
        <span class="metrics-pill">${m.totals?.pending ?? 0} pending</span>
        <span class="metrics-pill">${m.totals?.newToday ?? 0} new today</span>
        ${Object.entries(domains)
          .slice(0, 4)
          .map(([d, n]) => `<span class="metrics-pill metrics-pill--domain">${escapeHtml(d)}: ${n}</span>`)
          .join("")}
      </div>`;
  } catch {
    row.classList.add("hidden");
  }
}

function precaseStatusLabel(status) {
  const labels = {
    pending: "Awaiting AI",
    promoted: "On matrix",
    rejected: "Rejected",
    duplicate: "Merged",
    skipped: "Skipped",
  };
  return labels[status] || status || "Signal";
}

async function loadPreCases() {
  const feed = document.getElementById("reddit-feed");
  if (!feed) return;
  try {
    const json = await apiFetch("/test");
    const rows = json.inserted ?? [];
    if (!rows.length) {
      feed.innerHTML = `<li class="text-[#e5e2e1]/50">No ingested signals yet. Run a scrape from Prospector.</li>`;
      return;
    }
    feed.innerHTML = rows
      .map((post) => {
        const path = post.permalink || "";
        const href = path.startsWith("http")
          ? path
          : `https://reddit.com${path}`;
        const status = precaseStatusLabel(post.ai_status);
        const reason = post.rejection_reason
          ? ` — ${escapeHtml(post.rejection_reason)}`
          : "";
        return `<li class="flex flex-wrap gap-2 items-baseline">
          <span class="text-xs uppercase tracking-wide text-[#43e2d2]/80">${escapeHtml(status)}</span>
          <a class="text-[#43e2d2] hover:underline" href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(post.title)}</a>
          ${reason ? `<span class="text-[#e5e2e1]/45 text-xs">${reason}</span>` : ""}
        </li>`;
      })
      .join("");
  } catch {
    feed.innerHTML = `<li class="text-[#e5e2e1]/50">Pre-case feed unavailable.</li>`;
  }
}

function renderCard(c, user) {
  const card = document.createElement("div");
  const isPending = c.status === "pending";
  const claimed = user?.id && c.claimed_by === user.id;
  const mergeCount = Array.isArray(c.permalinks) ? c.permalinks.length : 0;
  const canValidate = Boolean(user?.id) && isPending && !c.user_confirmed;

  card.className = `rounded p-4 text-white cursor-pointer transition ${
    c.lifecycle_state === "green"
      ? "bg-[#123832] border border-[#43e2d2]/50"
      : c.lifecycle_state === "orange"
        ? "bg-[#4a2f1f] border border-[#ffb779]/50"
        : "bg-[#201a16] border border-[#534438]/40"
  }`;

  card.innerHTML = `
    <div class="flex justify-between gap-2">
      <h2 class="text-lg font-bold">${escapeHtml(c.topic)}</h2>
      <span class="text-[#43e2d2] font-mono text-sm shrink-0">Gap ${c.gap_score ?? "—"}</span>
    </div>
    <p class="text-[#e5e2e1]/75 text-sm mt-1">${escapeHtml(c.summary)}</p>
    ${c.disclaimer ? `<p class="text-xs text-[#43e2d2]/70 mt-2">${escapeHtml(c.disclaimer)}</p>` : ""}
    ${isPending ? `
      <div class="mt-3">
        <div class="progress-bar"><div class="progress-bar__fill" style="width:${c.publish_progress ?? 0}%"></div></div>
        <p class="text-xs text-[#e5e2e1]/45 mt-1">Pending · ${c.confirmation_count}/${c.confirmations_required}</p>
      </div>` : `<p class="text-xs text-[#e5e2e1]/45 mt-2">${(c.matrix_quadrant || "").replace(/_/g, " ")}</p>`}
    ${mergeCount > 1 ? `<p class="text-xs text-[#43e2d2]/60 mt-1">+${mergeCount - 1} signals merged</p>` : ""}
    <div class="flex flex-wrap gap-2 mt-3 action-buttons">
      ${canValidate ? `<button type="button" class="btn-validate bg-[#43e2d2] text-[#13100d] font-semibold px-3 py-1 rounded text-sm">Validate</button>` : ""}
      ${isPending && c.user_confirmed ? `<span class="text-xs text-[#43e2d2] py-1">You validated</span>` : ""}
      ${isPending && !user?.id ? `<span class="text-xs text-[#e5e2e1]/50 py-1">Sign in to validate</span>` : ""}
      ${c.status === "published" ? `
        <button type="button" class="btn-claim bg-[#cd7f32] text-[#13100d] font-semibold px-3 py-1 rounded text-sm">${claimed ? "Unclaim" : "Claim"}</button>
        <button type="button" class="btn-pain bg-[#2a2a2a] text-[#ffb779] px-3 py-1 rounded text-sm">${c.user_pained ? "Unpain" : "Pain"}</button>
        <button type="button" class="btn-solve bg-[#43e2d2]/20 text-[#43e2d2] px-3 py-1 rounded text-sm">Solve</button>
      ` : ""}
    </div>
  `;

  card.addEventListener("click", (e) => {
    if (e.target.closest(".action-buttons")) return;
    navigate("case", { id: c.id });
  });

  const actions = card.querySelector(".action-buttons");
  if (actions) {
    actions.addEventListener("click", (e) => e.stopPropagation());
    wireCardActions(card, c, user);
  }

  return card;
}

function wireCardActions(card, c, user) {
  card.querySelector(".btn-validate")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!user?.id) {
      alert("Please sign in to validate.");
      return;
    }
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Validating…";
    try {
      const r = await apiFetch(`/cases/${c.id}/confirm`, { method: "POST", body: "{}" });
      emitDataChanged("validate");
      if (r.published) alert("Published to matrix!");
      await loadCases(user);
      loadActivity();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Validate";
      alert(err.message);
    }
  });

  card.querySelector(".btn-claim")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await apiFetch(`/cases/${c.id}/toggle-claim`, { method: "POST", body: "{}" });
      emitDataChanged("claim");
      await loadCases(user);
    } catch (err) {
      alert(err.message);
    }
  });

  card.querySelector(".btn-pain")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await apiFetch(`/cases/${c.id}/pain`, { method: "POST", body: "{}" });
      emitDataChanged("pain");
      await loadCases(user);
    } catch (err) {
      alert(err.message);
    }
  });

  card.querySelector(".btn-solve")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const text = prompt("Propose a solution:");
    if (!text) return;
    try {
      await apiFetch(`/cases/${c.id}/solve`, {
        method: "POST",
        body: JSON.stringify({ solve_text: text }),
      });
      emitDataChanged("solve");
      await loadCases(user);
    } catch (err) {
      alert(err.message);
    }
  });
}

function renderTable(cases, user) {
  const wrap = document.createElement("div");
  wrap.className = "col-span-full overflow-x-auto";
  wrap.innerHTML = `
    <table class="case-table w-full text-sm">
      <thead>
        <tr>
          <th class="text-left p-2 text-[#ffb779]">Topic</th>
          <th class="text-left p-2">Gap</th>
          <th class="text-left p-2">Pain</th>
          <th class="text-left p-2">Domain</th>
          <th class="text-left p-2">State</th>
          <th class="text-left p-2">Source</th>
        </tr>
      </thead>
      <tbody>
        ${cases
          .map(
            (c) => `
          <tr class="case-table__row cursor-pointer hover:bg-[#2a221c]" data-id="${escapeHtml(c.id)}">
            <td class="p-2 text-[#e5e2e1]">${escapeHtml(c.topic)}</td>
            <td class="p-2 text-[#43e2d2]">${c.gap_score ?? "—"}</td>
            <td class="p-2">${c.pain_count ?? 0}</td>
            <td class="p-2">${escapeHtml(c.domain ?? "—")}</td>
            <td class="p-2">${escapeHtml(c.lifecycle_state ?? c.status)}</td>
            <td class="p-2">${escapeHtml(c.source ?? "—")}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
  wrap.querySelectorAll(".case-table__row").forEach((row) => {
    row.addEventListener("click", () => navigate("case", { id: row.dataset.id }));
  });
  return wrap;
}

async function loadCases(user) {
  const container = document.getElementById("cases");
  if (!container) return;

  let cases = [];
  try {
    const qs = filtersToQuery(currentFilters);
    cases = await apiFetch(`/cases${qs}`);
  } catch (err) {
    container.innerHTML = `<p class="text-[#ffb779]">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (!cases.length) {
    container.innerHTML = `
      <div class="onboarding-card col-span-full max-w-xl">
        <h3 class="text-lg font-semibold text-[#ffb779] mb-2">Get started</h3>
        <ol class="text-sm text-[#e5e2e1]/75 space-y-2 mb-4 list-decimal list-inside">
          <li>Submit a problem (AI validates your wording)</li>
          <li>Community validates — then it publishes to the Matrix</li>
          <li>Prospectors claim high-gap cases and propose solutions</li>
        </ol>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-primary" data-goto-submit>Submit a case</button>
          <button type="button" class="btn-secondary" data-goto-prospector>Run ingest</button>
          <button type="button" class="btn-ghost" data-goto-matrix>View matrix</button>
        </div>
      </div>`;
    container.querySelector("[data-goto-submit]")?.addEventListener("click", () => navigate("submit"));
    container.querySelector("[data-goto-prospector]")?.addEventListener("click", () => navigate("prospector"));
    container.querySelector("[data-goto-matrix]")?.addEventListener("click", () => navigate("matrix"));
    return;
  }

  container.innerHTML = "";
  container.className =
    viewMode === "table"
      ? "col-span-full"
      : "grid gap-4 md:grid-cols-2 xl:grid-cols-3";

  if (viewMode === "table") {
    container.appendChild(renderTable(cases, user));
    return;
  }

  const pending = cases.filter((c) => c.status === "pending");
  const published = cases.filter((c) => c.status === "published");

  if (pending.length) {
    const h = document.createElement("h3");
    h.className = "text-[#ffb779] font-semibold mb-2 col-span-full";
    h.textContent = "Awaiting validation";
    container.appendChild(h);
    pending.forEach((c) => container.appendChild(renderCard(c, user)));
  }

  if (published.length) {
    const h = document.createElement("h3");
    h.className = "text-[#43e2d2] font-semibold mb-2 mt-4 col-span-full";
    h.textContent = "Published";
    container.appendChild(h);
    published.forEach((c) => container.appendChild(renderCard(c, user)));
  }
}
