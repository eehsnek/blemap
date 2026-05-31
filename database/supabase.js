import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

// ✅ Use your project API URL (not the dashboard link)
const supabaseUrl = "https://kktedcwrxsrkbyzxchjt.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdGVkY3dyeHNya2J5enhjaGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMwNjQsImV4cCI6MjA5MzYzOTA2NH0.kMlmUDeAmpOnYlrUXqsuNFlJHoIFqYyrmFG8ewPHTK8"

// ✅ Export the client so other files can import it
export const supabase = createClient(supabaseUrl, supabaseKey)

console.log("✅ Supabase client initialized")
