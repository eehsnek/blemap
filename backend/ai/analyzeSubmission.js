import { DISCLAIMER } from "../lib/caseMetrics.js";

const LAW_KEYWORDS = /\b(court|lawyer|legal|sue|tenant|landlord|contract)\b/i;
const MED_KEYWORDS = /\b(doctor|hospital|diagnosis|medicine|symptom|prescription)\b/i;

function detectDomain(text) {
  if (LAW_KEYWORDS.test(text)) return "law";
  if (MED_KEYWORDS.test(text)) return "medicine";
  if (/\b(app|software|api|code|server)\b/i.test(text)) return "tech";
  if (/\b(bank|fee|loan|credit)\b/i.test(text)) return "finance";
  return "general";
}

function heuristicAnalyze(text, existingCases = []) {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).length;

  if (wordCount < 8) {
    return {
      isValid: false,
      rejectionMessage:
        "This reads a bit short to be a clear problem. Can you add more context about who is affected and what goes wrong?",
    };
  }

  if (/^(hi|hello|test|asdf)/i.test(trimmed) && wordCount < 15) {
    return {
      isValid: false,
      rejectionMessage:
        "We couldn't detect a real-world problem yet. Try describing the frustration in a full sentence.",
    };
  }

  const domain = detectDomain(trimmed);
  const words = trimmed.split(/\s+/).filter((w) => w.length > 3);
  const topic = words.slice(0, 6).join(" ").slice(0, 80) || "Untitled problem";
  const summary =
    trimmed.length > 400 ? `${trimmed.slice(0, 397)}...` : trimmed;

  let duplicateCase = null;
  const firstToken = words[0]?.toLowerCase();
  if (firstToken) {
    duplicateCase =
      existingCases.find(
        (c) =>
          c.status === "published" &&
          (c.topic?.toLowerCase().includes(firstToken) ||
            c.summary?.toLowerCase().includes(firstToken))
      ) ?? null;
  }

  const pain_level =
    domain === "law" || domain === "medicine"
      ? 0.75
      : Math.min(0.35 + wordCount / 80, 0.95);

  return {
    isValid: true,
    isDuplicate: Boolean(duplicateCase),
    duplicateCaseId: duplicateCase?.id ?? null,
    duplicateCase: duplicateCase,
    structured: {
      topic,
      summary,
      category: domain === "general" ? "community" : domain,
      domain,
      pain_level,
      cta_text:
        "A prospector can claim this case and propose a structured path to resolution.",
      disclaimer: ["law", "medicine"].includes(domain) ? DISCLAIMER : null,
      sensitivity: ["law", "medicine"].includes(domain) ? "high" : "low",
    },
  };
}

async function geminiAnalyze(text, existingCases) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const caseList = existingCases
    .filter((c) => c.status === "published")
    .slice(0, 15)
    .map((c) => ({ id: c.id, topic: c.topic, summary: c.summary }));

  const prompt = `You validate problem submissions for BleMap.
Return ONLY valid JSON with keys:
isValid (boolean), rejectionMessage (string|null), isDuplicate (boolean), duplicateCaseId (string|null),
structured: { topic, summary, category, domain (general|law|medicine|tech|finance), pain_level (0-1), cta_text, disclaimer (string|null), sensitivity (low|high) }.

Existing cases: ${JSON.stringify(caseList)}
User submission: ${JSON.stringify(text)}`;

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
    console.warn("Gemini error", await res.text());
    return null;
  }

  const json = await res.json();
  const raw =
    json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "{}";
  const parsed = JSON.parse(raw);
  if (parsed.isDuplicate && parsed.duplicateCaseId) {
    const match = existingCases.find((c) => c.id === parsed.duplicateCaseId);
    parsed.duplicateCase = match ?? null;
  }
  return parsed;
}

export async function analyzeSubmission(text, existingCases = []) {
  try {
    const gemini = await geminiAnalyze(text, existingCases);
    if (gemini?.isValid === false || gemini?.structured) return gemini;
  } catch (err) {
    console.warn("AI analyze fallback:", err.message);
  }
  return heuristicAnalyze(text, existingCases);
}
