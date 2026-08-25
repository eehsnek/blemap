import { supabaseAdmin } from "../../database/supabaseAdmin.js";

export async function getAllCases() {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .select("*")
    .not("embedding", "is", null);

  if (error) throw error;
  
  return data;
}

export async function getUserPainForCase(caseId, userId) {
  const { data, error } = await supabaseAdmin
    .from("case_pains")
    .select("*")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}
 
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
      embedding: fields.embedding ?? null,
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
    .eq("id", id) //id or caseId?
    .select()
    .single();
 
  if (error) throw error;

  return data;
}

export async function getPrecaseById(precaseId) {
  const { data, error } = await supabaseAdmin
    .from("precase")
    .select("*")
    .eq("id", precaseId)
    .single();

  if (error) throw error;

  return data;
}

export async function findSimilarCase(
  embedding,
  matchThreshold,
  matchCount
) {
  const { data, error } = await supabaseAdmin.rpc(
    "match_cases",
    {
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount
    }
  );

  if (error) throw error;

  return data || [];
}

export async function getCaseClaimState(caseId) {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .select("claimed_by")
    .eq("id", caseId)
    .single();

  if (error) throw error;

  return data;
}

export async function hasAcceptedSolution(caseId) {
  const { data, error } = await supabaseAdmin
    .from("case_solves")
    .select("id")
    .eq("case_id", caseId)
    .eq("accepted", true);

  if (error) throw error;

  return data.length > 0;
}

export async function updateCaseClaim(caseId, updates) {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .update(updates)
    .eq("id", caseId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getCasePain(caseId, userId) {
  const { data, error } = await supabaseAdmin
    .from("case_pains")
    .select("*")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function addCasePain(caseId, userId) {
  const { data, error } = await supabaseAdmin
    .from("case_pains")
    .insert({
      case_id: caseId,
      user_id: userId,
      pained_at: new Date()
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function removeCasePain(caseId, userId) {
  const { error } = await supabaseAdmin
    .from("case_pains")
    .delete()
    .eq("case_id", caseId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getCasePainCount(caseId) {
  const { count, error } = await supabaseAdmin
    .from("case_pains")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq("case_id", caseId);

  if (error) throw error;

  return count ?? 0;
}

export async function updateCasePainCount(caseId, count) {
  const { error } = await supabaseAdmin
    .from("cases")
    .update({
      pain_count: count
    })
    .eq("id", caseId);

  if (error) throw error;
}

export async function createCaseSolve(caseId, userId, solveText) {
  const { data, error } = await supabaseAdmin
    .from("case_solves")
    .insert({
      case_id: caseId,
      user_id: userId,
      solve_text: solveText,
      created_at: new Date()
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getCaseSolveCount(caseId) {
  const { count, error } = await supabaseAdmin
    .from("case_solves")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq("case_id", caseId);

  if (error) throw error;

  return count ?? 0;
}

export async function updateCaseSolveCount(caseId, count) {
  const { error } = await supabaseAdmin
    .from("cases")
    .update({
      solve_count: count
    })
    .eq("id", caseId);

  if (error) throw error;
}

export async function getSolveForAcceptance(solveId) {
  const { data, error } = await supabaseAdmin
    .from("case_solves")
    .select("id, case_id")
    .eq("id", solveId)
    .single();

  if (error) throw error;

  return data;
}

export async function getCaseClaimedBy(caseId) {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .select("claimed_by")
    .eq("id", caseId)
    .single();

  if (error) throw error;

  return data;
}

export async function acceptSolve(solveId) {
  const { data, error } = await supabaseAdmin
    .from("case_solves")
    .update({
      accepted: true
    })
    .eq("id", solveId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function resolveCase(caseId, userId) {
  const { error } = await supabaseAdmin
    .from("cases")
    .update({
      resolved: true,
      resolved_by: userId,
      resolved_at: new Date(),
      lifecycle_state: "green"
    })
    .eq("id", caseId);

  if (error) throw error;
}

export async function unacceptSolve(solveId) {
  const { data, error } = await supabaseAdmin
    .from("case_solves")
    .update({
      accepted: false
    })
    .eq("id", solveId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getAcceptedSolves(caseId) {
  const { data, error } = await supabaseAdmin
    .from("case_solves")
    .select("id")
    .eq("case_id", caseId)
    .eq("accepted", true);

  if (error) throw error;

  return data;
}

export async function updateCaseResolution(
  caseId,
  resolved,
  userId,
  lifecycleState
) {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .update({
      resolved,
      resolved_at: resolved ? new Date() : null,
      resolved_by: resolved ? userId : null,
      lifecycle_state: lifecycleState
    })
    .eq("id", caseId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getCasesClaimedByUser(userId) {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .select("id, topic")
    .eq("claimed_by", userId);

  if (error) throw error;

  return data ?? [];
}

export async function getUserTakes(userId) {
  const { data, error } = await supabaseAdmin
    .from("case_solves")
    .select("id, case_id, solve_text, accepted")
    .eq("user_id", userId);

  if (error) throw error;

  return data ?? [];
}

export async function getUserPains(userId) {
  const { data, error } = await supabaseAdmin
    .from("case_pains")
    .select("case_id")
    .eq("user_id", userId);

  if (error) throw error;

  return data ?? [];
}

export async function getAllCaseTopics() {
  const { data, error } = await supabaseAdmin
    .from("cases")
    .select("id, topic");

  if (error) throw error;

  return data ?? [];
}

export async function getUserProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, username")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data;
}