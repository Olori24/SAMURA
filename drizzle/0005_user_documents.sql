-- Persistent, account-owned documents for the SAMURA workspace.
-- Additive migration: does not alter existing auth or chat tables.
CREATE TABLE IF NOT EXISTS public.user_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  title varchar(120) NOT NULL DEFAULT 'Untitled document',
  format varchar(16) NOT NULL DEFAULT 'markdown',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_document_format_check CHECK (format IN ('markdown', 'text')),
  CONSTRAINT user_document_title_check CHECK (length(trim(title)) BETWEEN 1 AND 120)
);
CREATE INDEX IF NOT EXISTS user_document_owner_updated_idx
  ON public.user_document (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_document TO samura_runtime;
ALTER TABLE public.user_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_document FORCE ROW LEVEL SECURITY;
CREATE POLICY samura_runtime_user_document_isolation ON public.user_document
  FOR ALL TO samura_runtime
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), ''));
