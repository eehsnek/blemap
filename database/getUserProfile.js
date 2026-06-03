import { supabase } from "./supabase.js";

export async function getCurrentUserProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, role_id, roles(name)")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  return profile ? { ...profile, email: user.email } : { id: user.id, email: user.email };
}
