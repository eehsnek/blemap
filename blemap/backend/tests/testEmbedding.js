import { generateEmbedding } from "../services/embeddingService.js";

const embedding =
    await generateEmbedding(
        "I can't use Docker because my laptop storage is too small and I need to run multiple containers for my project."
    );

console.log(embedding.length);