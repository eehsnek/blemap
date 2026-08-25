import { supabaseAdmin } from "../../database/supabaseAdmin.js";
import { cosineSimilarity } from "../utils/similarity.js";
import { generateCaseTitle } from "./geminiService.js";

export async function rebuildCases() {
  // 1. Get all precases
  const { data: precases, error } = await supabaseAdmin
    .from("precase")
    .select("*");

  if (error) {
    throw error;
  }

  // 2. Normalize embeddings
  const valid = precases
    .map((p) => ({
      ...p,
      embedding:
        typeof p.embedding === "string"
          ? JSON.parse(p.embedding)
          : p.embedding
    }))
    .filter((p) => Array.isArray(p.embedding));

  valid.sort((a, b) => a.id - b.id);

  // 3. Cluster precases
  const clusters = [];
  const used = new Set();

  for (let i = 0; i < valid.length; i++) {
    if (used.has(valid[i].id)) continue;

    const cluster = [valid[i]];
    used.add(valid[i].id);

    for (let j = i + 1; j < valid.length; j++) {
      if (used.has(valid[j].id)) continue;

      const similarity = cosineSimilarity(
        valid[i].embedding,
        valid[j].embedding
      );

      if (similarity > 0.80) {
        cluster.push(valid[j]);
        used.add(valid[j].id);
      }
    }

    clusters.push(cluster);
  }

  // 4. Delete old cases
  const { error: deleteError } = await supabaseAdmin
    .from("cases")
    .delete()
    .neq("id", 0);

  if (deleteError) {
    throw deleteError;
  }

  // 5. Recreate cases from clusters
  let caseIndex = 1;

  for (const cluster of clusters) {
    let topic;
    let summary;

    // Skip AI for single-post clusters
    if (cluster.length === 1) {
      topic = cluster[0].title;
      summary = cluster[0].title;
    } else {
      try {
        const titles = cluster.map((c) => c.title);

        const aiOutput = await generateCaseTitle(titles);
        const parsed = JSON.parse(aiOutput);

        topic = parsed.title;
        summary = parsed.summary;
      } catch (err) {
        console.error("Gemini failed:", err);

        topic = `Case ${caseIndex}`;
        summary = cluster[0].title;
      }
    }

    const { error: insertError } = await supabaseAdmin
      .from("cases")
      .insert({
        topic,
        summary,
        permalinks: cluster.map((c) => c.permalink),
        subreddits: [
          ...new Set(cluster.map((c) => c.subreddit))
        ],
        ai_status: "bulk-generated",
        lifecycle_state: "grey",
        aggregated_at: new Date(),
        claim_count: 0,
        pain_count: 0,
        solve_count: 0
      });

    if (insertError) {
      console.error(insertError);
    }

    caseIndex++;
  }

  console.log("TOTAL PRECASES:", precases.length);
  console.log("WITH EMBEDDINGS:", valid.length);

  return {
    clustersCreated: clusters.length,
    precasesProcessed: precases.length,
    precasesWithEmbeddings: valid.length
  };
}