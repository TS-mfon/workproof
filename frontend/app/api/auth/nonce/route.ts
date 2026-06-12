import { NextResponse } from "next/server";
import { issueWalletNonce } from "@/lib/wallet-session";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json(await issueWalletNonce());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}
