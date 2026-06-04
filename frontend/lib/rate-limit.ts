type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const DEFAULT_MAX = 30;

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}, 60_000).unref?.();

export function rateLimit(key: string, max = DEFAULT_MAX) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: max - 1 };
  }
  if (b.count >= max) return { ok: false, retryAfterMs: b.resetAt - now };
  b.count += 1;
  return { ok: true, remaining: max - b.count };
}

export function ipFromRequest(headers: Headers) {
  const xfwd = headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
