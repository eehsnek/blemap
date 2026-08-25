import { processSubmission } from "../services/submissionService.js";
import { generateEmbedding } from "../services/embeddingService.js";

console.log("========== Layer 5 CREATE TEST ==========");

const description = `
A small business was sued because a supplier contract was unpaid.
`;

const queryEmbedding = await generateEmbedding(description);

const result = await processSubmission(
    description,
    queryEmbedding
);

console.log(result);