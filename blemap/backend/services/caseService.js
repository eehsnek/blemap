import { cosineSimilarity } from "../utils/similarity.js";
import { getCaseById, createCase, updateCase } from "../repositories/caseRepository.js";
import { getAllPrecases } from "../repositories/precaseRepository.js";
 
const SIMILARITY_THRESHOLD = 0.75;
 
function parseEmbedding(raw) {
  if (!raw) return null;
  const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  return Array.isArray(arr) ? arr : null;
}

export async function findNearestCase(queryEmbedding) {
  try {
    const precases = await getAllPrecases();

    if (!precases || precases.length === 0) {
      return { case: null, precase: null, similarity: 0 };
    }

    let bestPrecase = null;
    let bestSimilarity = -1;

    for (const precase of precases) {
        console.log("==========");
        console.log("Precase ID:", precase.id);

        console.log("Embedding:");
        console.log(precase.embedding);

        console.log("Type:");
        console.log(typeof precase.embedding);

        console.log("Is Array:");
        console.log(Array.isArray(precase.embedding));

      const emb = parseEmbedding(precase.embedding);
        console.log("Parsed:");
        console.log(emb);

        console.log("Type:");
        console.log(typeof emb);

        console.log("Is Array:");
        console.log(Array.isArray(emb));

      if (!emb) continue;
 
      const similarity = cosineSimilarity(queryEmbedding, emb);

        console.log("Similarity:", similarity);

      if (similarity > bestSimilarity) {

        console.log("Best Similarity:", similarity);
        console.log("Best Precase ID:", precase.id);

        bestSimilarity = similarity;
        bestPrecase = precase;
      }
    }

    if (!bestPrecase || bestSimilarity < SIMILARITY_THRESHOLD) {
      return { case: null, precase: null, similarity: bestSimilarity };
    }
    
    const linkedCase = bestPrecase?.case_id
      ? await getCaseById(bestPrecase.case_id)
      : null;
    
    return {
      case: linkedCase,
      precase: bestPrecase,
      similarity: bestSimilarity,
    };
  }
  catch (err) {
    console.error("Finding the nearest case failed:", err);
    return { case: null, precase: null, similarity: 0 };
  }
}

export async function attachToExistingCase(caseId, submissionText) {
  console.log("========== ATTACH ==========");
  console.log("Case ID:", caseId);
  console.log("Submission:", submissionText);
  
  const existing = await getCaseById(caseId);

  return updateCase(caseId, {
    summary: (existing.summary || "") + " | " + submissionText,
    aggregated_at: new Date(),
  });
}
 
/** Create a brand-new case from the user's raw text. */
export async function createNewCase(rawText) {
  const topic =
    rawText.length > 100 ? rawText.substring(0, 100) + "\u2026" : rawText;
 
  return createCase({
    topic,
    summary: rawText,
    permalinks: [],
    subreddits: [],
    ai_status: "user_submitted",
  });
}