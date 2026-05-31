const input = document.getElementById("post-input");
const button = document.getElementById("submit-post");
const output = document.getElementById("case-details");

button.addEventListener("click", submitCase);

async function submitCase() {
  const text = input.value.trim();

  // 1. Validate input early
  if (!text) {
    output.innerHTML = `
      <p class="text-red-500 font-semibold">
        Please enter a case description.
      </p>
    `;
    return;
  }

  // 2. UI loading state
  button.disabled = true;
  button.innerText = "Submitting...";

  output.innerHTML = `
    <p class="text-gray-500">Processing case...</p>
  `;

  try {
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

    console.log("Response:", data);

    // 3. Render result clearly
    output.innerHTML = `
      <div class="bg-white shadow rounded p-4">
        <h2 class="font-bold text-lg mb-2">
          ${data.matched ? "Matched Case" : "New Case Created"}
        </h2>

        <p class="text-gray-700">
          ${data.case?.summary || "No summary available"}
        </p>

        <p class="text-sm text-gray-500 mt-2">
          Status: ${data.case?.lifecycle_state || "N/A"}
        </p>
      </div>
    `;

    // 4. Reset input
    input.value = "";

  } catch (err) {
    console.error("Submit error:", err);

    output.innerHTML = `
      <p class="text-red-500 font-semibold">
        Failed to submit case. Try again.
      </p>
    `;
  } finally {
    // 5. Always restore button state
    button.disabled = false;
    button.innerText = "Submit";
  }
}