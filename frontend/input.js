import { apiFetch } from "./api.js";
import { supabase } from "./supabaseClient.js";

const input = document.getElementById("post-input");
const analyzeBtn = document.getElementById("analyze-btn");
const output = document.getElementById("case-details");

let currentDraft = null;

analyzeBtn.addEventListener("click", runAnalyze);

async function runAnalyze() {
  const text = input.value.trim();
  if (!text) {
    output.innerHTML = `<p class="text-[#ffb779] font-semibold">Please describe your problem first.</p>`;
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing…";
  output.innerHTML = `<p class="text-[#e5e2e1]/60">AI is validating and structuring your submission…</p>`;

  try {
    currentDraft = await apiFetch("/submit/analyze", {
      method: "POST",
      body: JSON.stringify({ text }),
    });

    if (!currentDraft.isValid) {
      output.innerHTML = `
        <div class="bg-[#201a16] rounded p-4 border border-[#534438]/40">
          <h2 class="text-[#ffb779] font-bold mb-2">Needs a bit more detail</h2>
          <p class="text-[#e5e2e1]/80">${currentDraft.rejectionMessage}</p>
          <p class="text-sm text-[#e5e2e1]/50 mt-3">Revise your description above and try again.</p>
        </div>`;
      return;
    }

    const s = currentDraft.structured;
    const dup = currentDraft.isDuplicate;

    output.innerHTML = `
      <div class="bg-[#201a16] rounded p-4 border border-[#534438]/40 space-y-3">
        <h2 class="text-[#ffb779] font-bold text-lg">Review before posting</h2>
        ${s.disclaimer ? `<p class="text-sm text-[#43e2d2] border-l-2 border-[#43e2d2]/40 pl-3">${s.disclaimer}</p>` : ""}
        <p><span class="text-[#e5e2e1]/50">Topic:</span> ${s.topic}</p>
        <p class="text-[#e5e2e1]/85">${s.summary}</p>
        <p class="text-sm text-[#e5e2e1]/50">Domain: ${s.domain} · Category: ${s.category} · Sensitivity: ${s.sensitivity}</p>
        <p class="text-sm text-[#43e2d2]">${s.cta_text}</p>
        ${
          dup
            ? `<p class="text-[#ffb779] text-sm">Similar case exists. Confirming will add your pain to the existing entry.</p>`
            : `<p class="text-sm text-[#e5e2e1]/50">After you confirm, the case stays pending until ${currentDraft.confirmations_required ?? 5} community validations — then it appears on the matrix.</p>`
        }
        <div class="flex gap-2 pt-2">
          <button id="confirm-btn" type="button" class="bg-[#cd7f32] hover:bg-[#ffb779] text-[#13100d] font-semibold px-4 py-2 rounded">
            ${dup ? "Confirm merge" : "Confirm & submit"}
          </button>
          <button id="cancel-btn" type="button" class="text-[#e5e2e1]/60 hover:text-white px-3">Cancel</button>
        </div>
      </div>`;

    document.getElementById("confirm-btn").addEventListener("click", () => confirmDraft(dup));
    document.getElementById("cancel-btn").addEventListener("click", () => {
      currentDraft = null;
      output.innerHTML = "";
    });
  } catch (err) {
    output.innerHTML = `<p class="text-[#ffb779]">${err.message}</p>`;
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze with AI";
  }
}

async function confirmDraft(isDuplicate) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    alert("Please sign in to confirm a submission.");
    window.location.href = "/frontend/index.html";
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
        <h2 class="text-[#43e2d2] font-bold mb-2">${result.matched ? "Merged with existing case" : "Submitted for validation"}</h2>
        <p class="text-[#e5e2e1]/80">${result.message || result.case?.summary || ""}</p>
        <p class="text-sm mt-2 text-[#e5e2e1]/50">Gap score (projected): ${result.case?.gap_score ?? "—"}</p>
        <a href="home.html" class="inline-block mt-4 text-[#ffb779] hover:text-[#ffd1aa]">View on Home →</a>
      </div>`;
    input.value = "";
    currentDraft = null;
  } catch (err) {
    alert(err.message);
  }
}
