import { serviceSupabase } from "./supabase";

export async function readCursor(name: string, fallback: bigint): Promise<bigint> {
  const { data, error } = await serviceSupabase()
    .from("ingest_cursors")
    .select("last_block")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  if (!data) return fallback;
  return BigInt(data.last_block);
}

export async function writeCursor(name: string, lastBlock: bigint) {
  const { error } = await serviceSupabase()
    .from("ingest_cursors")
    .upsert({ name, last_block: lastBlock.toString(), updated_at: new Date().toISOString() });
  if (error) throw error;
}
