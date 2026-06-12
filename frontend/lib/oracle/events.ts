import type { SupabaseClient } from "@supabase/supabase-js";

export function eventKey(...parts: Array<string | number | null | undefined>) {
  return parts.map((part) => String(part ?? "").toLowerCase()).join(":");
}

export async function upsertEvents(
  supabase: SupabaseClient,
  table: "activity_log" | "notifications",
  rows: Record<string, unknown>[]
) {
  if (rows.length === 0) return 0;
  const { error } = await supabase.from(table).upsert(rows, {
    onConflict: "event_key",
    ignoreDuplicates: true
  });
  if (error) throw error;
  return rows.length;
}
