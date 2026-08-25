import "dotenv/config";
import { supabaseAdmin } from "../../database/supabaseAdmin.js";
import { generateEmbedding } from "../services/embeddingService.js";

async function generateCaseEmbeddings() {
  const { data: cases, error } = await supabaseAdmin
    .from("cases")
    .select("id, topic, summary")
    .is("embedding", null);

  if (error) {
    throw error;
  }

  console.log(`Found ${cases.length} cases without embeddings.`);

  for (const c of cases) {
    const text = `${c.topic || ""}\n${c.summary || ""}`.trim();

    if (!text) {
      console.log(`Skipping case ${c.id}: no text available.`);
      continue;
    }

    try {
      console.log(`Embedding case ${c.id}: ${c.topic}`);

      const embedding = await generateEmbedding(text);

      if (!Array.isArray(embedding) || embedding.length !== 384) {
        throw new Error(
          `Invalid embedding length: ${embedding?.length}`
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("cases")
        .update({ embedding })
        .eq("id", c.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`✓ Case ${c.id} embedded successfully.`);
    } catch (err) {
      console.error(`✗ Failed case ${c.id}:`, err);
    }
  }

  console.log("Case embedding backfill complete.");
}

generateCaseEmbeddings()
  .catch(err => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });