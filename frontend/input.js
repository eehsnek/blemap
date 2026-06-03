import { apiFetch } from "./api.js";

const input = document.getElementById("post-input");
const button = document.getElementById("submit-post");
const output = document.getElementById("case-details");

button.addEventListener("click", submitCase);

async function submitCase() {
  const text = input.value.trim();

  if (!text) {
    output.innerHTML = `<p class="text-[#ffb779] font-semibold">Please enter a case description.</p>`;
    return;
  }

  button.disabled = true;
  button.innerText = "Submitting...";
  output.innerHTML = `<p class="text-[#e5e2e1]/60">Processing case...</p>`;

  try {
    const data = await apiFetch("/submit", {
      method: "POST",
      body: JSON.stringify({ text }),
    });

    output.innerHTML = `
      <div class="bg-[#201a16] rounded p-4 border border-[#534438]/40">
        <h2 class="font-bold text-lg mb-2 text-[#ffb779]">
          ${data.matched ? "Matched Case" : "New Case Created"}
        </h2>
        <p class="text-[#e5e2e1]/80">${data.case?.summary || "No summary available"}</p>
        <p class="text-sm text-[#e5e2e1]/50 mt-2">
          Status: ${data.case?.lifecycle_state || "N/A"}
        </p>
      </div>
    `;
    input.value = "";
  } catch (err) {
    console.error("Submit error:", err);
    output.innerHTML = `<p class="text-[#ffb779] font-semibold">Failed to submit case. Try again.</p>`;
  } finally {
    button.disabled = false;
    button.innerText = "Submit";
  }
}
