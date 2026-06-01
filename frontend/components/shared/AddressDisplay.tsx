import { shortAddress } from "@/lib/format";

export function AddressDisplay({ address }: { address?: string | null }) {
  if (!address) return <span>None</span>;
  return <span title={address}>{shortAddress(address)}</span>;
}
