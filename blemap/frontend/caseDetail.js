import { supabase } from '../database/supabase.js'

const { data: { user } } = await supabase.auth.getUser();

const params = new URLSearchParams(window.location.search);
let caseId = params.get("id");

if (!caseId || caseId === "null") {
  document.getElementById("case-details").innerHTML =
    "<p>No valid case ID provided.</p>";
  throw new Error("Invalid caseId");
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("case-details");

  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("id");

  if (!caseId) {
    container.innerHTML = `<p>No valid case ID provided.</p>`;
    return;
  }

  loadCaseDetails(caseId);
});

async function loadCaseDetails(caseId) {
  try {
    const response = await fetch(`http://localhost:4000/api/cases/${caseId}`);
    const c = await response.json();

    console.log("Case details response:", c);
    console.log("Solutions from backend:", c.solves);

    const container = document.getElementById("case-details");
    container.innerHTML = `
      <div class="bg-white shadow-md rounded p-6">
        <div class="mb-6 border-b pb-4">
          <h1 class="text-3xl font-bold text-gray-900">${c.topic}</h1>
          <p class="text-gray-700 mt-2">${c.summary}</p>
          <p class="mt-1 text-sm font-semibold text-indigo-600">Mode: ${c.mode || ""}</p>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-gray-50 p-4 rounded shadow">
            <p class="font-semibold">Pain</p>
            <span class="text-lg font-bold text-pink-600">${c.pain_count}</span>
          </div>
          <div class="bg-gray-50 p-4 rounded shadow">
            <p class="font-semibold">Solves</p>
            <span class="text-lg font-bold text-green-600">${c.solve_count}</span>
          </div>
          <div class="bg-gray-50 p-4 rounded shadow">
            <p class="font-semibold">Claimed By</p>
            <span class="text-lg font-bold text-orange-600">${c.claimed_by || "None"}</span>
          </div>
          <div class="bg-gray-50 p-4 rounded shadow">
            <p class="font-semibold">Status</p>
            <span class="text-lg font-bold text-gray-600">${c.lifecycle_state}</span>
          </div>
        </div>

        <div class="mb-6">
          <h2 class="text-xl font-semibold mb-2">Posts</h2>
          <ul class="list-disc ml-6 text-blue-600">
            ${(c.permalinks || [])
              .map(link => `<li><a href="${link}" target="_blank">${link}</a></li>`)
              .join("")}
          </ul>
        </div>

        <div class="flex gap-3 mb-6">
          <button class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">Claim</button>
          <button class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Unclaim</button>
          <button class="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600">Pain</button>
        </div>

        <div class="mb-6">
          <h2 class="text-xl font-semibold mb-2">Solutions</h2>
          <ul class="space-y-2">
            ${(c.solves || [])
              .map(s => `
                <li class="border rounded p-2">
                  <p>${s.solve_text}</p>
                  <p class="text-sm text-gray-500">By ${s.user_id}</p>
                </li>
              `)
              .join("")}
          </ul>
          <textarea id="solution-text" class="w-full border rounded p-2 mt-2" placeholder="Propose a solution..."></textarea>
          <button id="submit-solution" class="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            Submit Solution
          </button>
        </div>
      </div>
    `;
    document.getElementById("submit-solution").addEventListener("click", () => {
      submitSolution(caseId);
    });
  } catch (err) {
    console.error("Error loading case details:", err);
  }
}

loadCaseDetails(caseId);

async function submitSolution(caseId) {
  const textarea = document.getElementById("solution-text");
  const solveText = textarea.value.trim();

  if (!solveText) {
    alert("Please enter a solution first.");
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("You must be logged in to submit a solution.");
    return;
  }

  const res = await fetch(`http://localhost:4000/api/cases/${caseId}/solve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: user.id,
      solve_text: solveText
    })
  });

  const data = await res.json();
  console.log("Submit solution response:", data);

  textarea.value = "";
  await loadCaseDetails(caseId);
}

