import { eth } from "@/lib/format";

export function EthAmount({ wei }: { wei?: string | bigint | null }) {
  return <span>{eth(wei)}</span>;
}
