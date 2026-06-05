import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyAdminAction } from "@/lib/auth";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";

function checkAdminWallet(request: NextRequest): string | null {
  const adminWallet = request.headers.get("x-admin-wallet")?.toLowerCase();
  const allowed = (process.env.ADMIN_WALLETS || process.env.NEXT_PUBLIC_ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  if (adminWallet && allowed.includes(adminWallet)) return adminWallet;
  return null;
}

async function checkAuth(request: NextRequest, action: string): Promise<{ wallet: string } | NextResponse> {
  const eip = await verifyAdminAction(request.headers.get("authorization"), action);
  if (!("error" in eip)) return { wallet: eip.wallet };
  const simple = checkAdminWallet(request);
  if (simple) return { wallet: simple };
  return NextResponse.json({ error: "unauthorized" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`admin:${ipFromRequest(request.headers)}`, 30);
  if (!limit.ok) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, note: "Supabase not configured" });

  const auth = await checkAuth(request, "admin_action");
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { data, error } = await supabase.from("admin_actions").insert({
    admin_wallet: auth.wallet,
    action_type: body.action_type,
    target_id: body.target_id,
    reason: body.reason,
    tx_hash: body.tx_hash
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ action: data });
}
