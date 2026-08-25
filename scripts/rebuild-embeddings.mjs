#!/usr/bin/env node
/**
 * Backfill cases.embedding for rows missing vectors.
 * Requires embedding service: npm run embed:serve
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  generateEmbedding,
  textForCaseEmbedding,
} from "../backend/services/embeddingService.js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const probe = await generateEmbedding("health check");
if (!probe) {
  console.error("Embedding service unreachable. Start: npm run embed:serve");
  process.exit(1);
}

const { data: rows, error } = await supabase
  .from("cases")
  .select("id, topic, summary, raw_input, embedding")
  .order("created_at", { ascending: true });
if (error) throw error;

let updated = 0;
let skipped = 0;
for (const row of rows || []) {
  if (row.embedding) {
    skipped += 1;
    continue;
  }
  const text = textForCaseEmbedding(row);
  const embedding = await generateEmbedding(text);
  if (!embedding) {
    console.warn("skip (no embedding):", row.id);
    continue;
  }
  const { error: updErr } = await supabase
    .from("cases")
    .update({ embedding })
    .eq("id", row.id);
  if (updErr) throw updErr;
  updated += 1;
  console.log("embedded", row.id, row.topic?.slice(0, 60));
}

console.log(`Done. updated=${updated} skipped=${skipped}`);
