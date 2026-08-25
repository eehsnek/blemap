-- Enable Realtime for Main live updates (SPA frontend/lib/realtime.js)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'case_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.case_events;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scrape_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scrape_runs;
  END IF;
END $$;
