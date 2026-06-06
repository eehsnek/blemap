import { apiFetch } from "../api.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util.js";

export function mount(container) {
  container.innerHTML = `
    <div class="max-w-3xl">
      <p class="text-sm uppercase tracking-wide text-[#43e2d2] mb-1">Prospector</p>
      <h1 class="text-3xl font-bold mb-2">High-gap opportunities</h1>
      <p class="text-[#e5e2e1]/70 mb-4">Unclaimed published cases sorted by gap score. Scrape pulls <strong class="text-[#43e2d2]">Hacker News</strong> for free (Ask + New); Reddit is used too if API creds are in <code class="text-xs">.env</code>.</p>
      <div id="ingestion-status" class="mb-4 text-sm text-[#e5e2e1]/60 hidden"></div>
      <div id="scrape-summary" class="mb-4 hidden rounded-lg border border-[#534438]/30 bg-[#201a16] p-3 text-sm text-[#e5e2e1]/80"></div>
      <button type="button" id="run-scrape" class="mb-6 text-sm bg-[#2a2a2a] text-[#43e2d2] px-4 py-2 rounded hover:bg-[#333] transition">
        Run ingest scrape
      </button>
      <div id="prospector-list" class="space-y-4"></div>
    </div>
  `;

  document.getElementById("run-scrape").addEventListener("click", runScrape);
  loadIngestionStatus();
  loadProspectorFeed();

  return () => {};
}

function renderScrapeSummary(r) {
  const el = document.getElementById("scrape-summary");
  if (!el) return;
  el.classList.remove("hidden");
  el.innerHTML = `
    <p class="font-semibold text-[#ffb779] mb-1">Last scrape run</p>
    <p>Sources: ${escapeHtml((r.sources || ["hackernews"]).join(", "))}</p>
    <p>Fetched <strong>${r.scraped ?? 0}</strong> · Promoted <strong>${r.promoted ?? 0}</strong> · Merged <strong>${r.merged ?? 0}</strong> · Rejected <strong>${r.rejected ?? 0}</strong> · Skipped <strong>${r.skipped ?? 0}</strong></p>
    ${(r.errors?.length ?? 0) > 0 ? `<p class="text-[#ffb779] mt-1">${r.errors.length} error(s) — see server logs</p>` : ""}
  `;
}

async function loadIngestionStatus() {
  const el = document.getElementById("ingestion-status");
  if (!el) return;
  try {
    const { lastRun } = await apiFetch("/ingestion/status");
    if (!lastRun) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    const when = lastRun.finished_at || lastRun.started_at;
    el.textContent = `Automation: last run ${when ? new Date(when).toLocaleString() : "—"} — ${lastRun.promoted_count ?? lastRun.promoted ?? 0} promoted of ${lastRun.scraped_count ?? lastRun.scraped ?? 0} fetched`;
  } catch {
    el.classList.add("hidden");
  }
}

async function runScrape() {
  const btn = document.getElementById("run-scrape");
  btn.disabled = true;
  btn.textContent = "Scraping…";
  try {
    const r = await apiFetch("/scrape/run", { method: "POST" });
    renderScrapeSummary(r);
    await loadIngestionStatus();
    await loadProspectorFeed();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Reddit scrape";
  }
}

async function loadProspectorFeed() {
  const list = document.getElementById("prospector-list");
  if (!list) return;

  try {
    const cases = await apiFetch("/cases?view=prospector");
    if (!cases.length) {
      list.innerHTML = `<p class="text-[#e5e2e1]/60">No unclaimed high-gap cases. Try running the scraper.</p>`;
      return;
    }

    list.innerHTML = cases
      .map(
        (c) => `
      <article class="prospector-card bg-[#201a16] rounded-lg p-4 border border-[#534438]/30 cursor-pointer hover:border-[#ffb779]/40 transition" data-id="${escapeHtml(c.id)}">
        <div class="flex justify-between gap-2 mb-2">
          <h2 class="font-bold text-[#ffb779]">${escapeHtml(c.topic)}</h2>
          <span class="text-[#43e2d2] font-mono text-sm">Gap ${c.gap_score}</span>
        </div>
        <p class="text-[#e5e2e1]/75 text-sm">${escapeHtml(c.summary)}</p>
      </article>`
      )
      .join("");

    list.querySelectorAll(".prospector-card").forEach((card) => {
      card.addEventListener("click", () => navigate("case", { id: card.dataset.id }));
    });
  } catch (err) {
    list.innerHTML = `<p class="text-[#ffb779]">${escapeHtml(err.message)}</p>`;
  }
}
