import { NextRequest, NextResponse } from "next/server";
import { createWalletSession } from "@/lib/wallet-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!/^0x[0-9a-fA-F]{40}$/.test(body.wallet ?? "") || !/^0x[0-9a-fA-F]+$/.test(body.signature ?? "")) {
    return NextResponse.json({ error: "Invalid wallet or signature" }, { status: 400 });
  }
  try {
    return NextResponse.json(await createWalletSession(body.wallet, body.signature));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
