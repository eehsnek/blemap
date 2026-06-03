/**
 * @deprecated Browser code should import from `/frontend/supabaseClient.js`.
 * This file is kept for reference; it is not served by the dev server.
 */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../frontend/config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
