import { supabase } from "./supabase.js";

export async function getCurrentUserProfile() {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profileError) throw profileError;

  return profile;
}