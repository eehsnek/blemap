import { supabaseAdmin } from "../../database/supabaseAdmin.js";

export async function getAllPrecases() {

    const { data, error } = await supabaseAdmin
        .from("precase")
        .select("*");

    console.log("Error:", error);
    console.log("Rows:", data?.length);
    console.log(data);

    if (error) throw error;

    return data;
}