import { supabase, createUserClient } from "../../database/supabase.js";

export async function createSubmission(
    description,
    accessToken,
    userId
) {
    const client = accessToken
        ? createUserClient(accessToken)
        : supabase;

    console.log("createSubmission was called");
    console.log(
        "SUBMISSION TOKEN PARTS:",
        accessToken?.split(".").length
    );

    const { data: authContext, error: authContextError } =
        await client.rpc("debug_auth_context");

    console.log("DATABASE AUTH CONTEXT:", authContext);
    console.log(
        "DATABASE AUTH CONTEXT ERROR:",
        authContextError
    );

    const { data: authData, error: authError } =
        await client.auth.getUser(accessToken);

    console.log("SUPABASE SEES USER:", authData?.user?.id);
    console.log("SUPABASE AUTH ERROR:", authError);

    console.log("SUBMISSION USER ID:", userId);
    const { data, error } = await client
        .from("submissions")
        .insert({
            user_id: userId,
            raw_text: description,
            processing_status: "pending"
        })
        .select()
        .single();

    console.log("INSERT DATA:", data);
    console.log("INSERT ERROR:", error);

    if (error) throw error;

    return data;
}


export async function updateSubmissionAnalysis(
    id,
    embedding,
    matchedCaseId,
    similarityScore,
    accessToken
) {
    const client = accessToken
        ? createUserClient(accessToken)
        : supabase;

    console.log("UPDATING SUBMISSION ID:", id);

    const { data, error } = await client
        .from("submissions")
        .update({
            embedding,
            matched_case_id: matchedCaseId,
            similarity_score: similarityScore,
            processing_status: "embedded",
            review_status: "pending"
        })
        .eq("id", id)
        .select()
        .single();

    console.log("ANALYSIS UPDATE DATA:", data);
    console.log("ANALYSIS UPDATE ERROR:", error);

    if (error) throw error;

    return data;
}
