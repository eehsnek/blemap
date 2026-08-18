import { processSubmission } from "../services/submissionService.js";
import { generateEmbedding } from "../services/embeddingService.js";

console.log("========== Layer 6 ATTACH TEST ==========");

const description =
    "A small business was sued because a supplier contract was unpaid.";

const queryEmbedding = await generateEmbedding(description);

const result = await processSubmission(
    description,
    queryEmbedding
);

console.log("========== RESULT ==========");
console.log("Decision:", result.decision);
console.log("Similarity:", result.similarity);

console.log("========== CASE ==========");
console.log("Case ID:", result.case?.id);
console.log("Case Topic:", result.case?.topic);

console.log("========== PRECASE ==========");
console.log("Precase ID:", result.precase?.id);
console.log("Precase case_id:", result.precase?.case_id);

console.log("========== FULL RESULT ==========");
console.log(result);