import express from "express";
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
    const result = await processSubmission(text);

    return res.json(result);
  } catch (error) {
    console.error("Submit error:", error);

    return res.status(500).json({
      error: error.message
    });
  }
});

export default router;