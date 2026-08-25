import { supabaseAdmin } from "../../database/supabaseAdmin.js";

export async function getAllPrecases() {
  const { data, error } = await supabaseAdmin
    .from("precase")
    .select("*");

  if (error) throw error;

  return data;
}

export async function updatePrecaseEmbedding(id, embedding) {
  const { data, error } = await supabaseAdmin
    .from("precase")
    .update({ embedding })
    .eq("id", id)
    .select();

  if (error) throw error;

  return data;
}