import { supabase } from "../supabaseClient.js";
import { apiFetch } from "../api.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util.js";

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

export async function mount(container) {
  const user = await getUserWithTimeout();
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
      <section class="mb-10">
        <h2 class="text-xl font-semibold mb-4 text-[#ffb779]">Your cases</h2>
        <div id="cases" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"></div>
      </section>
      <section>
        <h2 class="text-xl font-semibold mb-4 text-[#43e2d2]">Pre-Case feed</h2>
        <ul id="reddit-feed" class="space-y-3 text-[#e5e2e1]/80"></ul>
      </section>
    </div>
  `;

  if (!user) return () => {};

  await loadPreCases();
  await loadCases(user);

  return () => {};
}

async function loadPreCases() {
  const feed = document.getElementById("reddit-feed");
  if (!feed) return;
  try {
    const json = await apiFetch("/test");
    feed.innerHTML = (json.inserted ?? [])
      .map(
        (post) =>
          `<li><a class="text-[#43e2d2] hover:underline" href="https://reddit.com${escapeHtml(post.permalink)}" target="_blank" rel="noopener">${escapeHtml(post.title)}</a></li>`
      )
      .join("");
  } catch {
    feed.innerHTML = `<li class="text-[#e5e2e1]/50">Pre-case feed unavailable.</li>`;
  }
}

function renderCard(c, user) {
  const card = document.createElement("div");
  const isPending = c.status === "pending";
  const claimed = c.claimed_by === user.id;

  card.className = `rounded p-4 text-white cursor-pointer transition ${
    c.lifecycle_state === "green"
      ? "bg-[#123832] border border-[#43e2d2]/50"
      : c.lifecycle_state === "orange"
        ? "bg-[#4a2f1f] border border-[#ffb779]/50"
        : "bg-[#201a16] border border-[#534438]/40"
  }`;

  const subreddits = Array.isArray(c.subreddits) ? c.subreddits.join(", ") : "";

  card.innerHTML = `
    <div class="flex justify-between gap-2">
      <h2 class="text-lg font-bold">${escapeHtml(c.topic)}</h2>
      <span class="text-[#43e2d2] font-mono text-sm shrink-0">Gap ${c.gap_score ?? "—"}</span>
    </div>
    <p class="text-[#e5e2e1]/75 text-sm mt-1">${escapeHtml(c.summary)}</p>
    ${c.disclaimer ? `<p class="text-xs text-[#43e2d2]/70 mt-2">${escapeHtml(c.disclaimer)}</p>` : ""}
    <p class="text-xs text-[#e5e2e1]/45 mt-2">
      ${isPending ? `Pending · ${c.confirmation_count}/${c.confirmations_required}` : (c.matrix_quadrant || "").replace(/_/g, " ")}
    </p>
    <div class="flex flex-wrap gap-2 mt-3 action-buttons">
      ${isPending && !c.user_confirmed ? `<button type="button" class="btn-validate bg-[#43e2d2] text-[#13100d] font-semibold px-3 py-1 rounded text-sm">Validate</button>` : ""}
      ${isPending && c.user_confirmed ? `<span class="text-xs text-[#43e2d2] py-1">You validated</span>` : ""}
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

    card.querySelector(".btn-validate")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await apiFetch(`/cases/${c.id}/confirm`, { method: "POST", body: "{}" });
        await loadCases(user);
      } catch (err) {
        alert(err.message);
      }
    });

    card.querySelector(".btn-claim")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await apiFetch(`/cases/${c.id}/toggle-claim`, { method: "POST", body: "{}" });
        await loadCases(user);
      } catch (err) {
        alert(err.message);
      }
    });

    card.querySelector(".btn-pain")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await apiFetch(`/cases/${c.id}/pain`, { method: "POST", body: "{}" });
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
        await loadCases(user);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  return card;
}

async function loadCases(user) {
  const container = document.getElementById("cases");
  if (!container) return;

  let cases = [];
  try {
    cases = await apiFetch("/cases");
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
          <button type="button" class="btn-secondary" data-goto-prospector>Load Reddit data</button>
          <button type="button" class="btn-ghost" data-goto-matrix>View matrix</button>
        </div>
      </div>`;
    container.querySelector("[data-goto-submit]")?.addEventListener("click", () => navigate("submit"));
    container.querySelector("[data-goto-prospector]")?.addEventListener("click", () => navigate("prospector"));
    container.querySelector("[data-goto-matrix]")?.addEventListener("click", () => navigate("matrix"));
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
    h.className = "text-[#43e2d2] font-semibold mb-2 mt-4 col-span-full";
    h.textContent = "Published";
    container.appendChild(h);
    published.forEach((c) => container.appendChild(renderCard(c, user)));
  }
}
