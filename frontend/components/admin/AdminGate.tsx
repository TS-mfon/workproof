"use client";

import { ReactNode } from "react";
import { useAccount } from "wagmi";

export function AdminGate({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const admins = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!isConnected) return <section className="shell py-10"><div className="panel p-6">Connect an admin wallet to access this page.</div></section>;
  if (!address || !admins.includes(address.toLowerCase())) return <section className="shell py-10"><div className="panel p-6"><h1 className="text-3xl font-black">403</h1><p className="mt-2">This wallet is not in the admin list.</p></div></section>;
  return <>{children}</>;
}
