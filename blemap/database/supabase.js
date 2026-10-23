import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kktedcwrxsrkbyzxchjt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdGVkY3dyeHNya2J5enhjaGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMwNjQsImV4cCI6MjA5MzYzOTA2NH0.kMlmUDeAmpOnYlrUXqsuNFlJHoIFqYyrmFG8ewPHTK8";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

export function createUserClient(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}