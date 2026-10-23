import { supabase } from "./supabase.js";

const input = document.getElementById("post-input");
const button = document.getElementById("submit-post");
const output = document.getElementById("case-details");

button.addEventListener("click", submitCase);

async function submitCase() {
  console.log("========== SUBMIT CASE ==========");
  console.log("Input text:", input.value.trim());
  
  const text = input.value.trim();

  // 1. Validate input
  if (!text) {
    output.innerHTML = `
      <p class="text-red-500 font-semibold">
        Please enter a case description.
      </p>
    `;
    return;
  }

  // 2. Get the logged-in session
  const { data: { session }, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !session) {
    output.innerHTML = `
      <p class="text-red-500 font-semibold">
        You must be logged in to submit a case.
      </p>
    `;
    return;
  }

  // 3. Processing state
  button.disabled = true;
  button.innerText = "Processing...";

  output.innerHTML = `
    <div class="p-4">
      <p class="font-semibold">
        Analyzing your submission...
      </p>

      <p class="text-sm text-gray-500 mt-1">
        Generating an embedding and checking for related cases.
      </p>
    </div>
  `;

  try {
    const res = await fetch(
      "http://localhost:4000/api/submit",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ text })
      }
    );

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const data = await res.json();

    console.log("Submission response:", data);

    // Match the backend's actual response contract.
    const { submission, matched, similarity } = data;

    if (!submission || submission.id == null) {
      throw new Error("Backend response is missing submission data.");
    }

    console.log("Submission ID:", submission.id);
    console.log("Matched existing case:", matched);
    console.log("Similarity:", similarity);

    // 5. Show the appropriate result without claiming a case was created
    output.innerHTML = `
      <div class="bg-white shadow rounded p-5">
        <p class="text-sm font-semibold text-[#43e2d2]">
          SUBMISSION RECEIVED
        </p>

        <h2 class="font-bold text-xl mt-2">
          Your submission has been saved for review.
        </h2>

        <p class="text-gray-700 mt-2">
          BleMap has processed your submission and recorded its analysis.
          An administrator will review it before any case is created or updated.
        </p>

        ${
          typeof similarity === "number"
            ? `
              <p class="text-sm text-gray-500 mt-3">
                Similarity score: ${similarity.toFixed(3)}
              </p>
            `
            : ""
        }

        <p class="text-sm text-gray-500 mt-2">
          Submission ID: ${submission.id}
        </p>
      </div>
    `;

    input.value = "";

  } catch (err) {
    console.error("Submit error:", err);

    output.innerHTML = `
      <p class="text-red-500 font-semibold">
        Failed to process submission.
      </p>

      <p class="text-sm text-gray-500 mt-1">
        Please try again.
      </p>
    `;

  } finally {
    button.disabled = false;
    button.innerText = "Submit";
  }
}