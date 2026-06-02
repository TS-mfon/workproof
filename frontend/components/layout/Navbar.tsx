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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="shell flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-3 text-xl font-black text-slate-950">
          <span className="logo-mark">W</span>
          <span>WorkProof</span>
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm font-bold text-slate-600">
          {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
