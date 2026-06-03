import { apiFetch } from "../api.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util.js";

export function mount(container) {
  container.innerHTML = `
    <div class="max-w-3xl">
      <p class="text-sm uppercase tracking-wide text-[#43e2d2] mb-1">Prospector</p>
      <h1 class="text-3xl font-bold mb-2">High-gap opportunities</h1>
      <p class="text-[#e5e2e1]/70 mb-4">Unclaimed published cases sorted by gap score.</p>
      <button type="button" id="run-scrape" class="mb-6 text-sm bg-[#2a2a2a] text-[#43e2d2] px-4 py-2 rounded hover:bg-[#333] transition">
        Run Reddit scrape
      </button>
      <div id="prospector-list" class="space-y-4"></div>
    </div>
  `;

  document.getElementById("run-scrape").addEventListener("click", runScrape);
  loadProspectorFeed();

  return () => {};
}

async function runScrape() {
  const btn = document.getElementById("run-scrape");
  btn.disabled = true;
  btn.textContent = "Scraping…";
  try {
    const r = await apiFetch("/scrape/run", { method: "POST" });
    alert(`Scraped ${r.scraped} posts, promoted ${r.promoted ?? 0} cases.`);
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
