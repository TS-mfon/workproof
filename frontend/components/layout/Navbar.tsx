import Link from "next/link";
import { WalletButton } from "@/components/shared/WalletButton";

const links = [
  ["/jobs", "Jobs"],
  ["/dashboard", "Dashboard"],
  ["/activity", "Activity"],
  ["/leaderboard", "Leaderboard"],
  ["/claim", "Claim"]
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-cyan-300/10 bg-[#0d1516]/82 backdrop-blur-xl">
      <div className="shell flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-3 text-xl font-black text-white">
          <span className="logo-mark">W</span>
          <span className="tracking-[0.14em]">WORKPROOF</span>
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
          {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
