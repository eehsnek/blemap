import { getAllPrecases } from "../repositories/precaseRepository.js";
import { findNearestCase } from "../services/caseService.js";

try {

    // Get one existing precase
    const precases = await getAllPrecases();

    if (precases.length === 0) {
        console.log("No precases found.");
        process.exit(0);
    }

    const queryEmbedding =
    JSON.parse(precases[0].embedding);

    const result = await findNearestCase(queryEmbedding);

    console.log("========== Layer 4 ==========");

    console.log("Similarity:");
    console.log(result.similarity);

    console.log();

    console.log("Matched Precase:");

    console.log({
        id: result.precase?.id,
        title: result.precase?.title,
        subreddit: result.precase?.subreddit
    });

}
catch (err) {

    console.error(err);

}