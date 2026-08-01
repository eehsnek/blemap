import {
    updateSubmissionEmbedding
} from "../repositories/submissionRepository.js";

import {
    generateEmbedding
} from "../services/embeddingService.js";

const embedding = await generateEmbedding(
    "Docker Compose stopped working after updating."
);

const updated = await updateSubmissionEmbedding(
    1,          // replace with an existing submission id
    embedding
);

console.log(updated);