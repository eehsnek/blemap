import { DISCLAIMER } from "../lib/caseMetrics.js";
import {
  MIN_SUBMIT_WORDS,
  normalizeSubmitText,
} from "../lib/normalizeSubmitText.js";
import { classifyMatches } from "../services/caseSimilarity.js";

const LAW_KEYWORDS = /\b(court|lawyer|legal|sue|tenant|landlord|contract)\b/i;
const MED_KEYWORDS = /\b(doctor|hospital|diagnosis|medicine|symptom|prescription)\b/i;

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildRejectionCoach(text) {
  const lower = text.toLowerCase();
  const suggestions = [
    "Who is affected?",
    "What goes wrong in practice?",
    "Why does it matter now?",
  ];

  let expandPrompt = text;
  let rejectionReason = "too_short";

  if (/\b(unemploy\w*|jobless|hiring|layoff|workforce|youth)\b/i.test(lower)) {
    const region = /\bphilippines\b/i.test(lower)
      ? "the Philippines"
      : /\b(youth|young|teen|graduate)\b/i.test(lower)
        ? "young job seekers"
        : "people in this region";
    expandPrompt = `${region.charAt(0).toUpperCase() + region.slice(1)} struggle to find stable employment because `;
    suggestions.splice(0, 3, "Add scale (how many affected)", "Add root cause", "Add location or timeframe");
    rejectionReason = "too_short_topic";
  } else if (/\b(landlord|tenant|rent|deposit|lease)\b/i.test(lower)) {
    expandPrompt = "Tenants and renters are harmed because ";
    suggestions.splice(0, 3, "What did the landlord or agency do?", "Who is affected?", "What outcome do you want?");
    rejectionReason = "too_short_topic";
  } else if (/\b(bank|fee|loan|credit|charge)\b/i.test(lower)) {
    expandPrompt = "Consumers face unfair financial harm because ";
    suggestions.splice(0, 3, "Which institution or product?", "What fee or policy changed?", "Who is impacted?");
    rejectionReason = "too_short_topic";
  } else if (!/[.!?]$/.test(text.trim())) {
    expandPrompt = `${text.trim()}. Those affected face problems because `;
  }

  return { suggestions, expandPrompt, rejectionReason };
}

function detectDomain(text) {
  if (LAW_KEYWORDS.test(text)) return "law";
  if (MED_KEYWORDS.test(text)) return "medicine";
  if (/\b(app|software|api|code|server)\b/i.test(text)) return "tech";
  if (/\b(bank|fee|loan|credit)\b/i.test(text)) return "finance";
  return "general";
}

function heuristicAnalyze(text, existingCases = []) {
  const trimmed = normalizeSubmitText(text);
  const count = wordCount(trimmed);

  if (count < MIN_SUBMIT_WORDS) {
    const coach = buildRejectionCoach(trimmed);
    return {
      isValid: false,
      rejectionMessage:
        "This reads a bit short to be a clear problem. Add who is affected and what goes wrong — or use the suggested starter below.",
      rejectionReason: coach.rejectionReason,
      suggestions: coach.suggestions,
      expandPrompt: coach.expandPrompt,
      wordCount: count,
      wordsRequired: MIN_SUBMIT_WORDS,
    };
  }

  if (/^(hi|hello|test|asdf)/i.test(trimmed) && count < 15) {
    return {
      isValid: false,
      rejectionMessage:
        "We couldn't detect a real-world problem yet. Try describing the frustration in a full sentence.",
      rejectionReason: "not_a_problem",
      suggestions: [
        "Describe a specific situation, not a greeting",
        "Name who is affected",
        "Explain what fails or feels unfair",
      ],
      wordCount: count,
      wordsRequired: 15,
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

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
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

function enrichRejection(result, originalText) {
  if (result.isValid !== false) return result;
  if (result.suggestions?.length) return result;
  const trimmed = normalizeSubmitText(originalText);
  const coach = buildRejectionCoach(trimmed);
  return {
    ...result,
    suggestions: coach.suggestions,
    expandPrompt: coach.expandPrompt,
    rejectionReason: result.rejectionReason ?? coach.rejectionReason,
    wordCount: wordCount(trimmed),
    wordsRequired: result.wordsRequired ?? MIN_SUBMIT_WORDS,
  };
}

function applyEmbeddingMatches(result, embeddingMatches = [], existingCases = []) {
  if (!result) return result;
  const classified = classifyMatches(embeddingMatches, existingCases);

  if (result.isValid === false) {
    return { ...result, related: classified.related };
  }

  // Embedding merge wins over weak Gemini/heuristic duplicate guesses
  if (classified.isDuplicate) {
    return {
      ...result,
      isDuplicate: true,
      duplicateCaseId: classified.duplicateCaseId,
      duplicateCase: classified.duplicateCase,
      embeddingSimilarity: classified.similarity,
      related: classified.related,
      matchSource: "embedding",
    };
  }

  // Keep Gemini/heuristic duplicate if present; still surface related suggestions
  if (result.isDuplicate && result.duplicateCaseId) {
    const fromRelated = classified.related.find(
      (r) => String(r.id) === String(result.duplicateCaseId)
    );
    return {
      ...result,
      embeddingSimilarity: fromRelated?.similarity ?? classified.similarity ?? 0,
      related: classified.related.length ? classified.related : result.related,
      matchSource: result.matchSource || "model",
    };
  }

  return {
    ...result,
    related: classified.related,
    embeddingSimilarity: classified.similarity || 0,
    matchSource: classified.matchSource,
  };
}

/**
 * @param {string} text
 * @param {object[]} [existingCases]
 * @param {{ embeddingMatches?: object[] }} [opts]
 */
export async function analyzeSubmission(text, existingCases = [], opts = {}) {
  const normalized = normalizeSubmitText(text);
  const embeddingMatches = opts.embeddingMatches || [];
  try {
    const gemini = await geminiAnalyze(normalized, existingCases);
    if (gemini?.isValid === false || gemini?.structured) {
      return applyEmbeddingMatches(
        enrichRejection(gemini, normalized),
        embeddingMatches,
        existingCases
      );
    }
  } catch (err) {
    console.warn("AI analyze fallback:", err.message);
  }
  return applyEmbeddingMatches(
    heuristicAnalyze(normalized, existingCases),
    embeddingMatches,
    existingCases
  );
}

export { MIN_SUBMIT_WORDS };
