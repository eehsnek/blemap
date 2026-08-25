import { supabaseAdmin } from "../../database/supabaseAdmin.js";
 
/** Fetch every row from the `cases` table. */
export async function getAllCases() {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .select("*")
    .order("id", { ascending: true });
 
  if (error) throw error;
  return data;
}
 
/** Fetch a single case by its primary key. */
export async function getCaseById(id) {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .select("*")
    .eq("id", id)
    .single();
 
  if (error) throw error;
  return data;
}
 
/** Insert a new case row and return it. */
export async function createCase(fields) {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .insert({
      topic: fields.topic ?? "Untitled Case",
      summary: fields.summary ?? "",
      permalinks: fields.permalinks ?? [],
      subreddits: fields.subreddits ?? [],
      ai_status: fields.ai_status ?? "user_submitted",
      lifecycle_state: fields.lifecycle_state ?? "grey",
      aggregated_at: fields.aggregated_at ?? new Date(),
      claim_count: fields.claim_count ?? 0,
      pain_count: fields.pain_count ?? 0,
      solve_count: fields.solve_count ?? 0,
    })
    .select()
    .single();
 
  if (error) throw error;
  return data;
}
 
/** Update specific columns on an existing case. */
export async function updateCase(id, updates) {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
 
  if (error) throw error;
  return data;
}