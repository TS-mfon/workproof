import { NextRequest } from "next/server";

export function authorizeCron(request: NextRequest): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET not configured" };
  const header = request.headers.get("authorization") ?? "";
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  if (header !== `Bearer ${secret}`) return { ok: false, reason: "unauthorized" };
  return { ok: true };
}

export function logJson(component: string, level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) {
  const payload = { ts: new Date().toISOString(), component, level, msg, ...extra };
  const out = JSON.stringify(payload);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}
