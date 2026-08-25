import { cosineSimilarity } from "../utils/similarity.js";
import {
  getPrecaseById,
  findSimilarCase,
  getCaseById as getCaseByIdRepository,
  updateCase,
  createCase,
  getAllCases,
  getUserPainForCase,
  getCaseClaimState,
  hasAcceptedSolution,
  updateCaseClaim,
  getCasePain,
  addCasePain,
  removeCasePain,
  getCasePainCount,
  updateCasePainCount,
  createCaseSolve,
  getCaseSolveCount,
  updateCaseSolveCount,
  getSolveForAcceptance,
  getCaseClaimedBy,
  acceptSolve,
  resolveCase,
  unacceptSolve,
  getAcceptedSolves,
  updateCaseResolution,
  getCasesClaimedByUser,
  getUserTakes,
  getUserPains,
  getAllCaseTopics,
  getUserProfile
} from "../repositories/caseRepository.js";
 
const SIMILARITY_THRESHOLD = 0.75;
 
function parseEmbedding(raw) {
  if (!raw) return null;
  const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  return Array.isArray(arr) ? arr : null;
}

export async function findNearestCase(queryEmbedding) {
  try {
    const cases = await getAllCases();

    if (!cases || cases.length === 0) {
      return {
        case: null,
        precase: null,
        similarity: 0
      };
    }

    let bestCase = null;
    let bestSimilarity = -1;

    for (const existingCase of cases) {
      const emb = parseEmbedding(existingCase.embedding);

      if (!emb) continue;

      const similarity = cosineSimilarity(
        queryEmbedding,
        emb
      );

      console.log(
        `Case ${existingCase.id} | ${existingCase.topic} | Similarity: ${similarity}`
      );

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCase = existingCase;
      }
    }

    if (
      !bestCase ||
      bestSimilarity < SIMILARITY_THRESHOLD
    ) {
      return {
        case: null,
        precase: null,
        similarity: bestSimilarity
      };
    }

    return {
      case: bestCase,
      precase: null,
      similarity: bestSimilarity
    };

  } catch (err) {
    console.error(
      "Finding the nearest case failed:",
      err
    );

    return {
      case: null,
      precase: null,
      similarity: 0
    };
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

export async function createNewCase(rawText, embedding) {
  const topic =
    rawText.length > 100
      ? rawText.substring(0, 100) + "…"
      : rawText;

  return createCase({
    topic,
    summary: rawText,
    embedding,
    permalinks: [],
    subreddits: [],
    ai_status: "user_submitted",
  });
}

export async function getCaseById(caseId) {
  const caseData = await getCaseByIdRepository(caseId);

  return {
    ...caseData
  };
}

export async function assignPrecaseToCase(precaseId) {
  const precase = await getPrecaseById(precaseId);

  if (!precase) {
    const error = new Error("Precase not found");
    error.code = "PRECASE_NOT_FOUND";
    throw error;
  }

  if (!precase.embedding) {
    const error = new Error("No embedding found");
    error.code = "NO_EMBEDDING";
    throw error;
  }

  const similarCases = await findSimilarCase(
    precase.embedding,
    0.75,
    1
  );

  if (similarCases.length > 0) {
    const targetCase = similarCases[0];

    const existingCase = await getCaseByIdRepository(targetCase.id);

    const updatedCase = await updateCase(targetCase.id, {
      permalinks: [
        ...(existingCase.permalinks || []),
        precase.permalink
      ],
      subreddits: [
        ...(existingCase.subreddits || []),
        precase.subreddit
      ],
      aggregated_at: new Date()
    });

    return {
      action: "attached_to_existing_case",
      case: updatedCase
    };
  }

  const newCase = await createCase({
    topic: precase.title,
    summary: precase.title,
    permalinks: [precase.permalink],
    subreddits: [precase.subreddit],
    ai_status: "auto-created",
    lifecycle_state: "grey",
    aggregated_at: new Date(),
    claim_count: 0,
    pain_count: 0,
    solve_count: 0
  });

  return {
    action: "created_new_case",
    case: newCase
  };
}

export async function getCases(userId) {
  const cases = await getAllCases();

  const enriched = await Promise.all(
    cases.map(async (caseData) => {
      const painRow = await getUserPainForCase(
        caseData.id,
        userId
      );

      return {
        ...caseData,
        user_pained: !!painRow
      };
    })
  );

  return enriched;
}

export async function toggleCaseClaim(caseId, userId) {
  const caseData = await getCaseClaimState(caseId);

  const isClaimed = caseData.claimed_by !== null;

  const hasSolution = await hasAcceptedSolution(caseId);

  if (!isClaimed) {
    await updateCaseClaim(caseId, {
      claimed_by: userId,
      claimed_at: new Date(),
      lifecycle_state: hasSolution ? "green" : "orange"
    });

    return {
      message: "Case claimed",
      state: "claimed"
    };
  }

  await updateCaseClaim(caseId, {
    claimed_by: null,
    claimed_at: null,
    lifecycle_state: hasSolution ? "green" : "grey"
  });

  return {
    message: "Case unclaimed",
    state: "unclaimed"
  };
}

export async function toggleCasePain(caseId, userId) {
  const existing = await getCasePain(caseId, userId);

  let state;

  if (existing) {
    await removeCasePain(caseId, userId);
    state = "unpained";
  } else {
    await addCasePain(caseId, userId);
    state = "pained";
  }

  const count = await getCasePainCount(caseId);

  await updateCasePainCount(caseId, count);

  return {
    state
  };
}

export async function submitCaseSolve(caseId, userId, solveText) {
  await createCaseSolve(
    caseId,
    userId,
    solveText
  );

  const solveCount = await getCaseSolveCount(caseId);

  await updateCaseSolveCount(
    caseId,
    solveCount
  );

  return {
    message: "Take submitted successfully",
    solve_count: solveCount
  };
}

export async function acceptCaseSolve(solveId, userId) {
  const solve = await getSolveForAcceptance(solveId);

  const caseData = await getCaseClaimedBy(solve.case_id);

  if (caseData.claimed_by !== userId) {
    const error = new Error(
      "Only the user who claimed this case can accept solutions"
    );

    error.code = "FORBIDDEN";

    throw error;
  }

  const acceptedSolve = await acceptSolve(solveId);

  await resolveCase(
    acceptedSolve.case_id,
    userId
  );

  return {
    message: "Solve accepted and case resolved"
  };
}

export async function unacceptCaseSolve(solveId, userId) {
  const solve = await getSolveForAcceptance(solveId);

  const caseData = await getCaseClaimedBy(solve.case_id);

  if (caseData.claimed_by !== userId) {
    const error = new Error(
      "Only the user who claimed this case can unaccept solutions"
    );

    error.code = "FORBIDDEN";
    throw error;
  }

  await unacceptSolve(solveId);

  const acceptedSolves = await getAcceptedSolves(solve.case_id);

  const hasAcceptedSolution = acceptedSolves.length > 0;

  const nextState = hasAcceptedSolution
    ? "green"
    : caseData.claimed_by
      ? "orange"
      : "grey";

  await updateCaseResolution(
    solve.case_id,
    hasAcceptedSolution,
    userId,
    nextState
  );

  return {
    message: "Solution unaccepted",
    lifecycle_state: nextState
  };
}

export async function generateUserProfileReport(userId) {
  const user = await getUserProfile(userId);

  if (!user) {
    const error = new Error("User not found");
    error.code = "NOT_FOUND";
    throw error;
  }

  const claimedCases = await getCasesClaimedByUser(userId);
  const takes = await getUserTakes(userId);
  const pains = await getUserPains(userId);
  const allCases = await getAllCaseTopics();

  const summary = {
    cases_claimed: claimedCases.length,
    takes_submitted: takes.length,
    pain_interactions: pains.length,
    cases_helped_resolved:
      takes.filter(t => t.accepted === true).length
  };

  const caseMap = Object.fromEntries(
    allCases.map(c => [c.id, c.topic])
  );

  const takesByCase = {};

  for (const take of takes) {
    takesByCase[take.case_id] =
      (takesByCase[take.case_id] || 0) + 1;
  }

  const takesByCaseReport = Object.entries(takesByCase)
    .map(([caseId, count]) => ({
      case_id: Number(caseId),
      topic: caseMap[caseId],
      count
    }))
    .sort((a, b) => b.count - a.count);

  const resolvedCases = takes
    .filter(t => t.accepted)
    .map(t => ({
      case_id: t.case_id,
      solve_text: t.solve_text,
      topic: caseMap[t.case_id]
    }));

  const painCases = pains.map(p => ({
    case_id: p.case_id,
    topic: caseMap[p.case_id]
  }));

  return {
    user: {
      id: user.id,
      username: user.username
    },
    summary,
    reports: {
      claimed_cases: claimedCases,
      takes_by_case: takesByCaseReport,
      resolved_cases: resolvedCases,
      pain_cases: painCases
    }
  };
}