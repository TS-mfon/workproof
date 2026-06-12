import { NextResponse } from "next/server";
import { clearWalletSession, requireWalletSession } from "@/lib/wallet-session";

export async function GET() {
  const session = await requireWalletSession();
  return session ? NextResponse.json(session) : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function DELETE() {
  await clearWalletSession();
  return NextResponse.json({ ok: true });
}
