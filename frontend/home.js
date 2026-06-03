import { supabase } from "./supabaseClient.js";
import { apiFetch } from "./api.js";
import { caseDetailUrl } from "./config.js";
import { mountNav } from "./nav.js";

mountNav("app-nav", "home.html");

async function showAuthStatus() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const statusBox = document.getElementById("auth-status");
  if (user) {
    statusBox.textContent = `Logged in as ${user.email}`;
  } else {
    statusBox.textContent = "Not logged in";
    window.location.href = "/frontend/index.html";
  }
}

showAuthStatus();

document.getElementById("signout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/frontend/index.html";
});

async function loadPreCases() {
  const feed = document.getElementById("reddit-feed");
  try {
    const json = await apiFetch("/test");
    feed.innerHTML = (json.inserted ?? [])
      .map(
        (post) =>
          `<li><a class="text-[#43e2d2]" href="https://reddit.com${post.permalink}" target="_blank" rel="noopener">${post.title}</a></li>`
      )
      .join("");
  } catch {
    feed.innerHTML = `<li class="text-[#e5e2e1]/50">Pre-case feed unavailable.</li>`;
  }
}

function renderCard(c, user) {
  const card = document.createElement("div");
  const isPending = c.status === "pending";
  card.className = `
    rounded p-4 transition text-white cursor-pointer
    ${
      c.lifecycle_state === "green"
        ? "bg-[#123832] border border-[#43e2d2]/50"
        : c.lifecycle_state === "orange"
          ? "bg-[#4a2f1f] border border-[#ffb779]/50"
          : "bg-[#201a16] border border-[#534438]/40"
    }
  `;

  const subreddits = Array.isArray(c.subreddits) ? c.subreddits.join(", ") : "";

  card.innerHTML = `
    <div class="flex justify-between gap-2">
      <h2 class="text-xl font-bold">${c.topic}</h2>
      <span class="text-[#43e2d2] font-mono text-sm">Gap ${c.gap_score ?? "—"}</span>
    </div>
    <p class="text-[#e5e2e1]/75 text-sm mt-1">${c.summary}</p>
    ${c.disclaimer ? `<p class="text-xs text-[#43e2d2]/70 mt-2">${c.disclaimer}</p>` : ""}
    <p class="text-xs text-[#e5e2e1]/45 mt-2">
      ${isPending ? `Pending · ${c.confirmation_count}/${c.confirmations_required} confirmations` : c.matrix_quadrant?.replace(/_/g, " ")}
      ${subreddits ? ` · ${subreddits}` : ""}
    </p>
    <div class="flex flex-wrap gap-2 mt-3 action-buttons">
      ${
        isPending
          ? `<button type="button" class="validate bg-[#43e2d2] text-[#13100d] font-semibold px-3 py-1 rounded text-sm">
              ${c.user_confirmed ? "Confirmed" : "Validate"}
            </button>`
          : ""
      }
      ${
        c.status === "published"
          ? `
        <button type="button" class="claim bg-[#cd7f32] text-[#13100d] font-semibold px-3 py-1 rounded text-sm">
          ${c.claimed_by === user.id ? "Unclaim" : "Claim"}
        </button>
        <button type="button" class="pain bg-[#2a2a2a] text-[#ffb779] px-3 py-1 rounded text-sm">
          ${c.user_pained ? "Unpain" : "Pain"}
        </button>
        <button type="button" class="solve bg-[#43e2d2]/20 text-[#43e2d2] px-3 py-1 rounded text-sm">Solve</button>`
          : ""
      }
    </div>
  `;

  card.addEventListener("click", (e) => {
    if (e.target.closest(".action-buttons")) return;
    window.location.href = caseDetailUrl(c.id);
  });

  const actions = card.querySelector(".action-buttons");
  if (actions) {
    actions.addEventListener("click", (e) => e.stopPropagation());

    const validateBtn = card.querySelector(".validate");
    if (validateBtn && !c.user_confirmed) {
      validateBtn.addEventListener("click", async () => {
        try {
          await apiFetch(`/cases/${c.id}/confirm`, { method: "POST", body: "{}" });
          loadCases();
        } catch (err) {
          alert(err.message);
        }
      });
    }

    card.querySelector(".claim")?.addEventListener("click", async function () {
      try {
        const data = await apiFetch(`/cases/${c.id}/toggle-claim`, {
          method: "POST",
          body: "{}",
        });
        this.textContent = data.state === "claimed" ? "Unclaim" : "Claim";
        loadCases();
      } catch (err) {
        alert(err.message);
      }
    });

    card.querySelector(".pain")?.addEventListener("click", async function () {
      try {
        const data = await apiFetch(`/cases/${c.id}/pain`, {
          method: "POST",
          body: "{}",
        });
        this.textContent = data.state === "pained" ? "Unpain" : "Pain";
      } catch (err) {
        alert(err.message);
      }
    });

    card.querySelector(".solve")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = prompt("Propose a solution:");
      if (!text) return;
      apiFetch(`/cases/${c.id}/solve`, {
        method: "POST",
        body: JSON.stringify({ solve_text: text }),
      }).then(loadCases).catch((err) => alert(err.message));
    });
  }

  return card;
}

async function loadCases() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const container = document.getElementById("cases");
  let cases = [];
  try {
    cases = await apiFetch("/cases");
  } catch (err) {
    console.error(err);
  }

  if (!cases.length) {
    container.innerHTML = `<p class="text-[#e5e2e1]/60">No cases yet. Submit one or run the scraper.</p>`;
    return;
  }

  container.innerHTML = "";
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
    h.className = "text-[#43e2d2] font-semibold mb-2 mt-6 col-span-full";
    h.textContent = "Published";
    container.appendChild(h);
    published.forEach((c) => container.appendChild(renderCard(c, user)));
  }
}

async function initHome() {
  await loadPreCases();
  await loadCases();
}

initHome();
