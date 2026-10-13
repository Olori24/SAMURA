-- Additive hardening migration for SAMURA's shared rate limiter and
-- user-owned conversation data. Apply first to a disposable database and
-- verify the app's scoped transaction helper before production rollout.
--
-- The deployed schema currently lacks api_rate_limit even though the app
-- requires it; production requests fail closed until this table is migrated.
CREATE TABLE IF NOT EXISTS public.api_rate_limit (
  bucket_key varchar(64) PRIMARY KEY CHECK (length(bucket_key) = 64),
  request_count integer NOT NULL CHECK (request_count > 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS api_rate_limit_expires_idx
  ON public.api_rate_limit (expires_at);

-- RLS is intentionally limited to user-owned product data. Better Auth's
-- account/session/user/verification tables require a separate service-role
-- design and are not protected by pretending a shared server credential is a
-- per-user database identity.
ALTER TABLE public.conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS samura_conversation_owner ON public.conversation;
CREATE POLICY samura_conversation_owner ON public.conversation
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), ''));

ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS samura_message_owner ON public.message;
CREATE POLICY samura_message_owner ON public.message
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.conversation c
      WHERE c.id = conversation_id
        AND c.user_id = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.conversation c
      WHERE c.id = conversation_id
        AND c.user_id = NULLIF(current_setting('app.user_id', true), '')
    )
  );

ALTER TABLE public.usage_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_record FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS samura_usage_owner ON public.usage_record;
CREATE POLICY samura_usage_owner ON public.usage_record
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK (
    user_id = NULLIF(current_setting('app.user_id', true), '')
    AND (
      conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversation c
        WHERE c.id = conversation_id
          AND c.user_id = NULLIF(current_setting('app.user_id', true), '')
      )
    )
  );
