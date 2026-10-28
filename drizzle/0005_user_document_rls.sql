-- Extend the existing restricted runtime-role model to user-owned documents.
-- This migration is intentionally not applied to any database by this change.
-- Review the deployed schema, grants and current SAMURA_RLS_ENABLED setting
-- before applying through the approved database migration process.
--
-- user_document operations already execute through withUserTransaction().
-- When SAMURA_RLS_ENABLED=true, that helper switches to samura_runtime.
-- Without an explicit grant and row policy, document operations can fail or
-- lack database-enforced tenant isolation.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_document TO samura_runtime;

ALTER TABLE public.user_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_document FORCE ROW LEVEL SECURITY;

CREATE POLICY samura_runtime_user_document_isolation
  ON public.user_document
  FOR ALL
  TO samura_runtime
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), ''));
