import express from "express";
import { generateEmbedding } from "../services/embeddingService.js";
import { processSubmission } from "../services/submissionService.js";

const router = express.Router();

router.post("/submit", async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim() === "") {
    return res.status(400).json({
      error: "Input required"
    });
  }

  try {
    const embedding = await generateEmbedding(text);

    const result = await processSubmission(
      text,
      embedding
    );

    return res.json({
      case: result,
      matched: true
    });

  } catch (err) {
    console.error("Submit error:", err);

    return res.status(500).json({
      error: err.message
    });
  }
});

export default router;