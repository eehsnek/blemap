import express from "express";
import { generateEmbedding } from "../services/embeddingService.js";
import { findNearestCase } from "../services/caseService.js";
import { authenticate } from "../middleware/authMiddleware.js";

import {
  createSubmission,
  updateSubmissionAnalysis
} from "../repositories/submissionRepository.js";

// import { processSubmission } from "../services/submissionService.js";

const router = express.Router();


router.post(
  "/submit",
  authenticate,
  async (req, res) => {
    const { text } = req.body;

    if (typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({
        error: "Input required"
      });
    }

    const authorization = req.headers.authorization;
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      return res.status(401).json({
        error: "Missing or invalid authorization token"
      });
    }

    try {
      // 1. Persist the original submission.
      const submission = await createSubmission(
        text.trim(),
        token,
        req.user.id
      );

      // 2. Generate its embedding.
      const embedding = await generateEmbedding(text.trim());

      // 3. Find the closest existing case.
      const nearestCase = await findNearestCase(embedding);

      // 4. Persist the analysis using the same authenticated token.
      const updatedSubmission = await updateSubmissionAnalysis(
        submission.id,
        embedding,
        nearestCase.case?.id ?? null,
        nearestCase.similarity ?? 0,
        token
      );

      // 5. Return the analyzed submission for admin review.
      return res.status(200).json({
        submission: updatedSubmission,
        matched: nearestCase.case !== null,
        similarity: nearestCase.similarity
      });

    } catch (err) {
      console.error("Submit error:", err);

      return res.status(500).json({
        error: err.message
      });
    }
  }
);


export default router;