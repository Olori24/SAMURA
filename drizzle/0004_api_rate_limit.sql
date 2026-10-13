-- Shared atomic rate-limit buckets required by src/lib/distributed-rate-limit.ts.
-- This additive migration restores the table missing from the current production schema.
CREATE TABLE IF NOT EXISTS public.api_rate_limit (
  bucket_key varchar(64) PRIMARY KEY CHECK (length(bucket_key) = 64),
  request_count integer NOT NULL CHECK (request_count > 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS api_rate_limit_expires_idx
  ON public.api_rate_limit (expires_at);
