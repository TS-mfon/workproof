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
  // Try EIP-712 first
  const eip = await verifyAdminAction(request.headers.get("authorization"), action);
  if (!("error" in eip)) return { wallet: eip.wallet };

  // Fallback to simple header for UX
  const simple = checkAdminWallet(request);
  if (simple) return { wallet: simple };

  return NextResponse.json({ error: "unauthorized — sign with an admin wallet or provide x-admin-wallet header" }, { status: 403 });
}

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ announcements: [] });
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return NextResponse.json({ announcements: [], note: error.message });
  return NextResponse.json({ announcements: data ?? [] });
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`announce:${ipFromRequest(request.headers)}`, 30);
  if (!limit.ok) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const auth = await checkAuth(request, "announcement_create");
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { data, error } = await supabase.from("announcements").insert({
    message: body.message,
    kind: body.kind ?? "info",
    active: body.active ?? true,
    created_by: auth.wallet
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fan out one notification per known user so the in-app bell lights up.
  try {
    const { data: users } = await supabase.from("users").select("wallet_address");
    const rows = (users ?? [])
      .map((u: { wallet_address: string }) => u.wallet_address?.toLowerCase())
      .filter(Boolean)
      .map((wallet: string) => ({
        recipient_wallet: wallet,
        kind: "announcement",
        payload: { message: body.message, announcement_id: data.id, kind: body.kind ?? "info" }
      }));
    if (rows.length > 0) {
      await supabase.from("notifications").insert(rows);
    }
  } catch {
    // Non-fatal — the announcement is already saved.
  }
  return NextResponse.json({ announcement: data });
}

export async function PATCH(request: NextRequest) {
  const limit = rateLimit(`announce:${ipFromRequest(request.headers)}`, 30);
  if (!limit.ok) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const auth = await checkAuth(request, "announcement_update");
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { id, active } = body;
  const { error } = await supabase.from("announcements").update({ active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
