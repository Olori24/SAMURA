-- Shared, atomic rate-limit buckets for serverless deployments.
-- Bucket keys are SHA-256 hashes; no user identifiers are stored.
CREATE TABLE IF NOT EXISTS public.api_rate_limit (
  bucket_key varchar(64) PRIMARY KEY CHECK (length(bucket_key) = 64),
  request_count integer NOT NULL CHECK (request_count > 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS api_rate_limit_expires_idx
  ON public.api_rate_limit (expires_at);
