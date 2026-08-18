import { supabase } from "../../database/supabase.js";

export async function createSubmission(description) {

    const { data, error } = await supabase
        .from("submissions")
        .insert({
            raw_text: description,
            processing_status: "pending"
        })
        .select()
        .single();

    if (error) throw error;

    return data;
}

export async function updateSubmissionEmbedding(id, embedding) {

    const { data, error } = await supabase
        .from("submissions")
        .update({
            embedding: embedding,
            processing_status: "embedded"
        })
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;

    return data;
}