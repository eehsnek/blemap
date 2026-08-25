import { validateInput } from "../utils/validation.js";
import { generateEmbedding } from "../services/embeddingService.js";

export async function submitCase(req, res) {
  try {
    // 1. Validate request
    const description = validateInput(req.body.text);

    // 2. Store submission
    const submission = await createSubmission(description);

    // 3. Generate embedding
    const embedding = await generateEmbedding(description);
    /*
    // javascript
    async function generateEmbedding(text) {
        const response = await fetch("http://localhost:8000/embed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
    
        if (!response.ok) {
            throw new Error("Embedding service failed");
        }
    
        const { embedding } = await response.json();
        return embedding;
    }
    */

    // 4. Find closest existing case
    const nearestCase = await findNearestCase(embedding);

    // 5. Decide what to do
    const result = await processSubmission({
      submission,
      embedding,
      nearestCase
    });

    // 6. Respond
    return res.status(200).json(result);

  } catch (err) {

    console.error(err);

    const status =
      err.message.includes("Description") 
        ? 400 
        : 500;

    return res.status(status).json({
      success: false,
      message: err.message
    });
  }
}