import { formatEther } from "viem";

export function shortAddress(address?: string | null) {
  if (!address) return "None";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function eth(wei?: string | bigint | null) {
  if (!wei) return "0 ETH";
  try {
    return `${Number(formatEther(BigInt(wei))).toFixed(4)} ETH`;
  } catch {
    return "0 ETH";
  }
}

export function timeLeft(deadline: string) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

export function timeAgo(date: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
