-- ZELPX chat access policies (additive; preserves existing Contractor policies)
-- Run in Supabase SQL Editor after reviewing the project backup.
-- Customer identity is derived from service_requests.user_id via lead_id.
-- Admin access is read-only for chat records.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_conversations' AND policyname='Customers can view their conversations') THEN
    CREATE POLICY "Customers can view their conversations"
      ON public.lead_conversations FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.service_requests sr
        WHERE sr.lead_id = lead_conversations.lead_id
          AND sr.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_conversations' AND policyname='Admins can view all conversations') THEN
    CREATE POLICY "Admins can view all conversations"
      ON public.lead_conversations FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_messages' AND policyname='Customers can view their conversation messages') THEN
    CREATE POLICY "Customers can view their conversation messages"
      ON public.lead_messages FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1
        FROM public.lead_conversations lc
        JOIN public.service_requests sr ON sr.lead_id = lc.lead_id
        WHERE lc.id = lead_messages.conversation_id
          AND sr.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_messages' AND policyname='Customers can send their conversation messages') THEN
    CREATE POLICY "Customers can send their conversation messages"
      ON public.lead_messages FOR INSERT TO authenticated
      WITH CHECK (
        sender_type = 'customer'
        AND sender_user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.lead_conversations lc
          JOIN public.service_requests sr ON sr.lead_id = lc.lead_id
          WHERE lc.id = lead_messages.conversation_id
            AND sr.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_messages' AND policyname='Admins can view all conversation messages') THEN
    CREATE POLICY "Admins can view all conversation messages"
      ON public.lead_messages FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      ));
  END IF;
END $$;
