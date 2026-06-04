import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = () => process.env.ORACLE_WEBHOOK_SECRET || "";

export function signOracleBody(rawBody: string) {
  const secret = SECRET();
  if (!secret) return "";
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyOracleSignature(rawBody: string, providedHex: string | null): boolean {
  if (!providedHex) return false;
  const secret = SECRET();
  if (!secret) return false;
  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const provided = Buffer.from(providedHex, "hex");
    if (provided.length !== expected.length) return false;
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}
