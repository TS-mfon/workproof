import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { getOnchainActivities } from "@/lib/onchain";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ activity: [] });
  const wallet = request.nextUrl.searchParams.get("wallet")?.toLowerCase();
  let query = supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(500);
  if (wallet && /^0x[0-9a-f]{40}$/.test(wallet)) {
    query = query.or(`actor_wallet.ilike.${wallet},target_wallet.ilike.${wallet}`);
  }
  const [{ data, error }, chainActivity] = await Promise.all([
    query,
    wallet ? getOnchainActivities(200).catch(() => []) : Promise.resolve([])
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const walletChainActivity = wallet
    ? chainActivity.filter((activity) =>
        activity.actor_wallet?.toLowerCase() === wallet ||
        activity.target_wallet?.toLowerCase() === wallet
      )
    : [];
  const merged = [...(data ?? []), ...walletChainActivity]
    .filter((activity, index, all) => {
      const key = `${activity.tx_hash ?? activity.id}:${activity.event_type}:${activity.job_id ?? ""}`;
      return all.findIndex((candidate) =>
        `${candidate.tx_hash ?? candidate.id}:${candidate.event_type}:${candidate.job_id ?? ""}` === key
      ) === index;
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (request.nextUrl.searchParams.get("format") === "csv") {
    const csv = ["event_type,job_id,actor_wallet,target_wallet,tx_hash,created_at", ...merged.map((row) => [row.event_type, row.job_id, row.actor_wallet, row.target_wallet, row.tx_hash, row.created_at].map((v) => JSON.stringify(v ?? "")).join(","))].join("\n");
    return new NextResponse(csv, { headers: { "content-type": "text/csv" } });
  }
  return NextResponse.json({ activities: merged });
}

export async function POST(request: NextRequest) {
  void request;
  return NextResponse.json({ error: "activity writes are server-owned" }, { status: 405 });
}
