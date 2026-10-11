-- SAMURA AI conversation, message, and usage tables.
-- Additive migration: safe to apply when tables are not present.
-- Keep aligned with src/db/schema.ts.

CREATE TABLE IF NOT EXISTS public.conversation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL DEFAULT 'New conversation',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversation_owner_updated_idx ON public.conversation (user_id, updated_at);

CREATE TABLE IF NOT EXISTS public.message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversation(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL,
  content text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'complete',
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_conversation_order_idx ON public.message (conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS message_user_request_unique ON public.message (user_id, request_id);

CREATE TABLE IF NOT EXISTS public.usage_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversation(id) ON DELETE SET NULL,
  provider varchar(48) NOT NULL,
  model varchar(120) NOT NULL,
  input_tokens integer,
  output_tokens integer,
  status varchar(24) NOT NULL,
  estimated_cost_microusd integer,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_user_created_idx ON public.usage_record (user_id, created_at);
