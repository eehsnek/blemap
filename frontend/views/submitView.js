import { apiFetch } from "../api.js";
import { supabase } from "../supabaseClient.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util.js";

let currentDraft = null;

export function mount(container) {
  container.innerHTML = `
    <div class="max-w-2xl">
      <p class="text-sm uppercase tracking-wide text-[#43e2d2] mb-1">Submit</p>
      <h1 class="text-3xl font-bold mb-2">Describe your problem</h1>
      <p class="text-[#e5e2e1]/70 mb-6">AI validates your words — you confirm before anything is saved.</p>
      <textarea id="post-input" rows="6"
        class="w-full min-h-[140px] bg-[#13100d] text-white px-4 py-3 rounded border border-[#534438]/40 focus:outline-none focus:border-[#ffb779] mb-4"
        placeholder="Describe your problem in your own words..."></textarea>
      <button type="button" id="analyze-btn"
        class="bg-[#cd7f32] hover:bg-[#ffb779] text-[#13100d] font-semibold px-4 py-2 rounded transition">
        Analyze with AI
      </button>
      <div id="case-details" class="mt-8"></div>
    </div>
  `;

  document.getElementById("analyze-btn").addEventListener("click", runAnalyze);
  currentDraft = null;

  return () => {
    currentDraft = null;
  };
}

async function runAnalyze() {
  const input = document.getElementById("post-input");
  const analyzeBtn = document.getElementById("analyze-btn");
  const output = document.getElementById("case-details");
  const text = input.value.trim();

  if (!text) {
    output.innerHTML = `<p class="text-[#ffb779]">Please describe your problem first.</p>`;
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing…";
  output.innerHTML = `<p class="text-[#e5e2e1]/60">AI is validating…</p>`;

  try {
    currentDraft = await apiFetch("/submit/analyze", {
      method: "POST",
      body: JSON.stringify({ text }),
    });

    if (!currentDraft.isValid) {
      output.innerHTML = `
        <div class="bg-[#201a16] rounded p-4 border border-[#534438]/40">
          <h2 class="text-[#ffb779] font-bold mb-2">Needs more detail</h2>
          <p>${escapeHtml(currentDraft.rejectionMessage)}</p>
        </div>`;
      return;
    }

    const s = currentDraft.structured;
    const dup = currentDraft.isDuplicate;

    output.innerHTML = `
      <div class="bg-[#201a16] rounded p-4 border border-[#534438]/40 space-y-3">
        <h2 class="text-[#ffb779] font-bold text-lg">Review before posting</h2>
        ${s.disclaimer ? `<p class="text-sm text-[#43e2d2]">${escapeHtml(s.disclaimer)}</p>` : ""}
        <p><strong>Topic:</strong> ${escapeHtml(s.topic)}</p>
        <p>${escapeHtml(s.summary)}</p>
        <p class="text-sm text-[#e5e2e1]/50">${escapeHtml(s.domain)} · ${escapeHtml(s.category)}</p>
        <div class="flex gap-2 pt-2">
          <button type="button" id="confirm-btn" class="bg-[#cd7f32] text-[#13100d] font-semibold px-4 py-2 rounded">${dup ? "Confirm merge" : "Confirm & submit"}</button>
          <button type="button" id="cancel-btn" class="text-[#e5e2e1]/60 px-3">Cancel</button>
        </div>
      </div>`;

    document.getElementById("confirm-btn").addEventListener("click", () => confirmDraft(dup, input, output));
    document.getElementById("cancel-btn").addEventListener("click", () => {
      currentDraft = null;
      output.innerHTML = "";
    });
  } catch (err) {
    output.innerHTML = `<p class="text-[#ffb779]">${escapeHtml(err.message)}</p>`;
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze with AI";
  }
}

async function confirmDraft(isDuplicate, input, output) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert("Please sign in first.");
    return;
  }

  try {
    const result = await apiFetch("/submit/confirm", {
      method: "POST",
      body: JSON.stringify({
        draftId: currentDraft.draftId,
        mergeIntoCaseId: isDuplicate ? currentDraft.duplicateCaseId : undefined,
      }),
    });

    output.innerHTML = `
      <div class="bg-[#123832]/40 rounded p-4 border border-[#43e2d2]/30">
        <h2 class="text-[#43e2d2] font-bold mb-2">Submitted</h2>
        <p class="text-[#e5e2e1]/80">${escapeHtml(result.message || result.case?.summary || "")}</p>
        <button type="button" id="goto-home" class="mt-4 text-[#ffb779] underline">View on Home →</button>
      </div>`;
    input.value = "";
    currentDraft = null;
    document.getElementById("goto-home").addEventListener("click", () => navigate("home"));
  } catch (err) {
    alert(err.message);
  }
}
