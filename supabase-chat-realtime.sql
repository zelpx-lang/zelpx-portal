-- ZELPX live chat updates: additive only; keeps all existing publication members and data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lead_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_messages;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
