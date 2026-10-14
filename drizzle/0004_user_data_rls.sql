-- Enforce database-level tenant isolation for SAMURA user-owned data.
-- Create the restricted role in the schema migration; provision its password
-- through a secure database operation and configure SAMURA_DATABASE_URL separately.
-- Deploy with SAMURA_RLS_ENABLED=true only after the role and policies exist.
-- All queries touching these tables must use withUserTransaction() with a
-- user ID taken from a verified Better Auth session.

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'samura_runtime') THEN
    CREATE ROLE samura_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$;
ALTER ROLE samura_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO samura_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public."user",
  public.session,
  public.account,
  public.verification,
  public.conversation,
  public.message,
  public.usage_record,
  public.api_rate_limit
TO samura_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO samura_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO samura_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO samura_runtime;

ALTER TABLE public.conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation FORCE ROW LEVEL SECURITY;
ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message FORCE ROW LEVEL SECURITY;
ALTER TABLE public.usage_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_record FORCE ROW LEVEL SECURITY;

CREATE POLICY samura_runtime_conversation_isolation ON public.conversation
  FOR ALL TO samura_runtime
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY samura_runtime_message_isolation ON public.message
  FOR ALL TO samura_runtime
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.conversation c
      WHERE c.id = message.conversation_id
        AND c.user_id = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.conversation c
      WHERE c.id = message.conversation_id
        AND c.user_id = NULLIF(current_setting('app.user_id', true), '')
    )
  );
CREATE POLICY samura_runtime_usage_record_isolation ON public.usage_record
  FOR ALL TO samura_runtime
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')
    AND (
      conversation_id IS NULL OR EXISTS (
        SELECT 1 FROM public.conversation c
        WHERE c.id = usage_record.conversation_id
          AND c.user_id = NULLIF(current_setting('app.user_id', true), '')
      )
    )
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')
    AND (
      conversation_id IS NULL OR EXISTS (
        SELECT 1 FROM public.conversation c
        WHERE c.id = usage_record.conversation_id
          AND c.user_id = NULLIF(current_setting('app.user_id', true), '')
      )
    )
  );
