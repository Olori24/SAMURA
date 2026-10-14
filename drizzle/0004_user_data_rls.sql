-- Enforce database-level tenant isolation for SAMURA user-owned data.
-- Deploy the application with the restricted samura_app role, never neondb_owner.
-- Every query touching these tables must run inside a transaction that sets
-- app.user_id from the verified Better Auth session using set_config(..., true).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'samura_app') THEN
    CREATE ROLE samura_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  ELSE
    ALTER ROLE samura_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO samura_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public."user",
  public.session,
  public.account,
  public.verification,
  public.conversation,
  public.message,
  public.usage_record,
  public.api_rate_limit
TO samura_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO samura_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO samura_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO samura_app;

ALTER TABLE public.conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation FORCE ROW LEVEL SECURITY;
ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message FORCE ROW LEVEL SECURITY;
ALTER TABLE public.usage_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_record FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation' AND policyname = 'samura_conversation_isolation') THEN
    CREATE POLICY samura_conversation_isolation ON public.conversation
      FOR ALL TO samura_app
      USING (user_id = NULLIF(current_setting('app.user_id', true), ''))
      WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), ''));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message' AND policyname = 'samura_message_isolation') THEN
    CREATE POLICY samura_message_isolation ON public.message
      FOR ALL TO samura_app
      USING (user_id = NULLIF(current_setting('app.user_id', true), ''))
      WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), ''));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'usage_record' AND policyname = 'samura_usage_record_isolation') THEN
    CREATE POLICY samura_usage_record_isolation ON public.usage_record
      FOR ALL TO samura_app
      USING (user_id = NULLIF(current_setting('app.user_id', true), ''))
      WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), ''));
  END IF;
END
$$;
