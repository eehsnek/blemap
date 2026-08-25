function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
}

function heuristicAnalyzeSolve(solveText, caseRow) {
  const trimmed = solveText.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (wordCount < 12) {
    return {
      isRelevant: false,
      qualityScore: 0.2,
      rejectionMessage:
        "This solution is too brief. Add concrete steps or resources that address the problem.",
      suggestion: "Describe who should act, what to do first, and expected outcome.",
    };
  }

  const caseTokens = new Set([
    ...tokenize(caseRow.topic),
    ...tokenize(caseRow.summary),
  ]);
  const solveTokens = tokenize(trimmed);
  const overlap = solveTokens.filter((t) => caseTokens.has(t)).length;
  const overlapRatio = solveTokens.length ? overlap / solveTokens.length : 0;

  if (overlapRatio < 0.05 && wordCount < 30) {
    return {
      isRelevant: false,
      qualityScore: 0.3,
      rejectionMessage:
        "This doesn't appear to address the case topic. Tie your solution to the specific problem.",
      suggestion: `Reference the problem: "${(caseRow.topic || "").slice(0, 60)}"`,
    };
  }

  const qualityScore = Math.min(0.5 + overlapRatio * 0.3 + wordCount / 120, 0.95);

  return {
    isRelevant: true,
    qualityScore: Math.round(qualityScore * 100) / 100,
    rejectionMessage: null,
    suggestion:
      qualityScore < 0.6
        ? "Consider adding links, timelines, or who can help implement this."
        : null,
  };
}

async function geminiAnalyzeSolve(solveText, caseRow) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const prompt = `You validate proposed solutions for BleMap cases.
Return ONLY valid JSON with keys:
isRelevant (boolean), qualityScore (0-1 float), rejectionMessage (string|null), suggestion (string|null).

Case topic: ${JSON.stringify(caseRow.topic)}
Case summary: ${JSON.stringify(caseRow.summary)}
Case domain: ${JSON.stringify(caseRow.domain)}
Proposed solution: ${JSON.stringify(solveText)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    console.warn("Gemini solve error", await res.text());
    return null;
  }

  const json = await res.json();
  const raw =
    json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "{}";
  return JSON.parse(raw);
}

export async function analyzeSolve(solveText, caseRow) {
  try {
    const gemini = await geminiAnalyzeSolve(solveText, caseRow);
    if (gemini && typeof gemini.isRelevant === "boolean") return gemini;
  } catch (err) {
    console.warn("AI solve analyze fallback:", err.message);
  }
  return heuristicAnalyzeSolve(solveText, caseRow);
}

export function solveAiEnforced() {
  return (process.env.SOLVE_AI_ENFORCE || "false").toLowerCase() === "true";
}
