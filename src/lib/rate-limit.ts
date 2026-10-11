type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

/**
 * Small single-instance safety net. For multi-instance production, replace with
 * a shared atomic store (e.g. Redis/Upstash) before public launch.
 */
export function checkRateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
