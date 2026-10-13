import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { checkRateLimit } from "@/lib/rate-limit";

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  unavailable?: boolean;
};

let cleanupCounter = 0;

function localFallback(key: string, limit: number, windowMs: number): RateLimitResult {
  if (process.env.NODE_ENV === "production") {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)), unavailable: true };
  }
  return checkRateLimit(key, limit, windowMs);
}

/**
 * A database-backed fixed-window limiter. PostgreSQL's unique-key upsert makes
 * increments atomic across Vercel instances. Production fails closed if the
 * shared store is unavailable; it never silently falls back to per-instance
 * memory in production.
 */
export async function checkDistributedRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) {
    return { allowed: false, retryAfterSeconds: 60, unavailable: true };
  }
  if (!isDatabaseConfigured()) return localFallback(key, limit, windowMs);

  try {
    const db = getDb();
    const bucketKey = createHash("sha256").update(key, "utf8").digest("hex");
    const result = await db.execute(sql`
      INSERT INTO public.api_rate_limit
        (bucket_key, request_count, window_started_at, expires_at)
      VALUES
        (${bucketKey}, 1, now(), now() + (${windowMs} * interval '1 millisecond'))
      ON CONFLICT (bucket_key) DO UPDATE SET
        request_count = CASE
          WHEN public.api_rate_limit.expires_at <= now() THEN 1
          ELSE LEAST(public.api_rate_limit.request_count + 1, ${limit + 1})
        END,
        window_started_at = CASE
          WHEN public.api_rate_limit.expires_at <= now() THEN now()
          ELSE public.api_rate_limit.window_started_at
        END,
        expires_at = CASE
          WHEN public.api_rate_limit.expires_at <= now()
            THEN now() + (${windowMs} * interval '1 millisecond')
          ELSE public.api_rate_limit.expires_at
        END
      RETURNING
        request_count AS "requestCount",
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - now()))))::integer AS "retryAfterSeconds"
    `);

    const rows = (result as unknown as { rows?: Array<Record<string, unknown>> }).rows;
    const row = rows?.[0];
    if (!row) throw new Error("Rate-limit store returned no result.");

    const count = Number(row.requestCount ?? row.request_count);
    const retryAfterSeconds = Number(row.retryAfterSeconds ?? row.retry_after_seconds);
    if (!Number.isSafeInteger(count) || count < 1) throw new Error("Rate-limit store returned an invalid count.");

    cleanupCounter += 1;
    if (cleanupCounter % 100 === 0) {
      try {
        await db.execute(sql`
          DELETE FROM public.api_rate_limit
          WHERE bucket_key IN (
            SELECT bucket_key
            FROM public.api_rate_limit
            WHERE expires_at <= now()
            ORDER BY expires_at
            LIMIT 100
          )
        `);
      } catch {
        // Cleanup is best-effort; it must not weaken the active rate-limit decision.
      }
    }

    return {
      allowed: count <= limit,
      retryAfterSeconds: count <= limit ? 0 : Math.max(1, retryAfterSeconds || Math.ceil(windowMs / 1000)),
    };
  } catch {
    return localFallback(key, limit, windowMs);
  }
}
