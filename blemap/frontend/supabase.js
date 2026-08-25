import { createClient } from
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://kktedcwrxsrkbyzxchjt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdGVkY3dyeHNya2J5enhjaGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMwNjQsImV4cCI6MjA5MzYzOTA2NH0.kMlmUDeAmpOnYlrUXqsuNFlJHoIFqYyrmFG8ewPHTK8';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);