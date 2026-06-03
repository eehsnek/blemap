import { apiFetch } from "./api.js";
import { caseDetailUrl } from "./config.js";
import { mountNav } from "./nav.js";

mountNav("app-nav", "prospector.html");

async function loadProspectorFeed() {
  const list = document.getElementById("prospector-list");
  try {
    const cases = await apiFetch("/cases?view=prospector");
    if (!cases.length) {
      list.innerHTML = `<p class="text-[#e5e2e1]/60">No unclaimed high-gap cases right now.</p>`;
      return;
    }

    list.innerHTML = cases
      .map(
        (c) => `
      <article class="bg-[#201a16] rounded-lg p-4 border border-[#534438]/30 cursor-pointer hover:border-[#ffb779]/40 transition"
               data-id="${c.id}">
        <div class="flex justify-between gap-2 mb-2">
          <h2 class="font-bold text-[#ffb779]">${c.topic}</h2>
          <span class="text-[#43e2d2] font-mono text-sm shrink-0">Gap ${c.gap_score}</span>
        </div>
        <p class="text-[#e5e2e1]/75 text-sm line-clamp-2">${c.summary}</p>
        <p class="text-xs text-[#e5e2e1]/45 mt-2">${c.matrix_quadrant?.replace(/_/g, " ") || ""} · Pain ${c.pain_count}</p>
        ${c.disclaimer ? `<p class="text-xs text-[#43e2d2]/80 mt-2">${c.disclaimer}</p>` : ""}
      </article>`
      )
      .join("");

    list.querySelectorAll("article").forEach((card) => {
      card.addEventListener("click", () => {
        window.location.href = caseDetailUrl(card.dataset.id);
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="text-[#ffb779]">${err.message}</p>`;
  }
}

document.getElementById("run-scrape")?.addEventListener("click", async () => {
  const btn = document.getElementById("run-scrape");
  btn.disabled = true;
  try {
    const r = await apiFetch("/scrape/run", { method: "POST" });
    alert(`Scraped ${r.scraped} posts, promoted ${r.promoted} cases.`);
    loadProspectorFeed();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

loadProspectorFeed();
