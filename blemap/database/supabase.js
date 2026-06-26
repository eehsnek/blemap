import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

const supabaseUrl = "https://kktedcwrxsrkbyzxchjt.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdGVkY3dyeHNya2J5enhjaGp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MzA2NCwiZXhwIjoyMDkzNjM5MDY0fQ.3WyBDdmTqBWn5FXrGWy0IZuO-mhEmhWY68v_Oe4PKOY"

// ✅ Export the client so other files can import it
export const supabase = createClient(supabaseUrl, supabaseKey)

console.log("✅ Supabase client initialized")
