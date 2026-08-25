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

  console.log("Submission matching result:", {
    matchedCase,
    precase,
    similarity
  });

  // Only attach to an existing case if:
  // 1. A case was actually found
  // 2. Similarity passes the threshold
  if (
    matchedCase &&
    similarity != null &&
    similarity >= SIMILARITY_THRESHOLD
  ) {
    const updatedCase = await attachToExistingCase(
      matchedCase.id,
      description
    );

    return {
      matched: true,
      case: updatedCase,
      precase,
      similarity
    };
  }

  const newCase = await createNewCase(
    description,
    embedding
  );

  return {
    matched: false,
    case: newCase,
    precase,
    similarity
  };
}