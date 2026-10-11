CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("user_id");

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz,
  "scope" text,
  "password" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

CREATE TABLE IF NOT EXISTS "conversation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" varchar(160) DEFAULT 'New conversation' NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "conversation_owner_updated_idx" ON "conversation" ("user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "message" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversation"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" varchar(16) NOT NULL,
  "content" text NOT NULL,
  "status" varchar(24) DEFAULT 'complete' NOT NULL,
  "request_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "message_conversation_order_idx" ON "message" ("conversation_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "message_user_request_unique" ON "message" ("user_id", "request_id");

CREATE TABLE IF NOT EXISTS "usage_record" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "conversation_id" uuid REFERENCES "conversation"("id") ON DELETE SET NULL,
  "provider" varchar(48) NOT NULL,
  "model" varchar(120) NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "status" varchar(24) NOT NULL,
  "estimated_cost_microusd" integer,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "usage_user_created_idx" ON "usage_record" ("user_id", "created_at");
