import {
    findNearestCase,
    attachToExistingCase,
    createNewCase
} from "./caseService.js";

// I need to find a way to make this threshold configurable, but for now, let's just hardcode it.
const SIMILARITY_THRESHOLD = 0.75;

export async function processSubmission(description, embedding) {
    const {
        case: matchedCase,
        precase,
        similarity
    } = await findNearestCase(embedding);

    if (similarity >= SIMILARITY_THRESHOLD) {

        if (matchedCase) {
            return attachToExisting(
                matchedCase,
                description
            );
        }
        
        return createNewCase(description, precase);
    }

    return createNewCase(description);
}

// This is for testing purposes only
/*
export async function processSubmission(description, embedding) {
    const {
        case: matchedCase,
        precase,
        similarity
    } = await findNearestCase(embedding);

    if (similarity >= SIMILARITY_THRESHOLD) {

    console.log("Decision: ATTACH");

        return {
            decision: "attach",
            similarity,
            precase
        };
    }

    console.log("Decision: CREATE");

    return {
        decision: "create",
        similarity
    };
}
*/