const input = document.getElementById("post-input");
const button = document.getElementById("submit-post");
const output = document.getElementById("case-details");

button.addEventListener("click", submitCase);

async function submitCase() {
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

  // 2. Processing state
  button.disabled = true;
  button.innerText = "Processing...";

  output.innerHTML = `
    <div class="p-4">
      <p class="font-semibold">
        Analyzing your submission...
      </p>

      <p class="text-sm text-gray-500 mt-1">
        Searching for related cases.
      </p>
    </div>
  `;

  try {
    // 3. Submit to backend
    const res = await fetch(
      "http://localhost:4000/api/submit",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      }
    );

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const data = await res.json();

    console.log("Submission response:", data);

    // 4. Determine actual match result
    const result = data.case;

    if (!result) {
      throw new Error("Submission returned no result.");
    }

    // 5. Existing case
    if (result.matched === true && result.case) {
      const matchedCase = result.case;

      output.innerHTML = `
        <div class="bg-white shadow rounded p-5">

          <p class="text-sm font-semibold text-[#43e2d2]">
            EXISTING CASE FOUND
          </p>

          <h2 class="font-bold text-xl mt-2">
            ${matchedCase.topic ?? "Related case"}
          </h2>

          <p class="text-gray-700 mt-2">
            ${matchedCase.summary ?? ""}
          </p>

          <button
            id="view-case"
            class="mt-4 bg-[#43e2d2] text-[#13100d]
                   font-semibold px-4 py-2 rounded"
          >
            View Case
          </button>

        </div>
      `;

      document
        .getElementById("view-case")
        .addEventListener("click", () => {
          window.location.href =
            `/frontend/caseDetail.html?id=${matchedCase.id}`;
        });

      return;
    }

    // 6. No existing case
    output.innerHTML = `
      <div class="bg-white shadow rounded p-5">

        <p class="text-sm font-semibold text-[#ffb779]">
          NEW PROBLEM IDENTIFIED
        </p>

        <h2 class="font-bold text-xl mt-2">
          Your submission does not match an existing case.
        </h2>

        <p class="text-gray-700 mt-2">
          BleMap has identified this as a new problem
          that can enter the case pipeline.
        </p>

        ${
          result.similarity !== undefined
            ? `
              <p class="text-sm text-gray-500 mt-3">
                Similarity score:
                ${Number(result.similarity).toFixed(3)}
              </p>
            `
            : ""
        }

      </div>
    `;

    // 7. Clear input
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