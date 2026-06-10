import Link from "next/link";
import { WalletButton } from "@/components/shared/WalletButton";
import { ProtocolNotifications } from "@/components/shared/ProtocolNotifications";
import { NotificationBell } from "@/components/shared/NotificationBell";

const links = [
  ["/jobs", "Jobs"],
  ["/dashboard/freelancer", "Dashboard"],
  ["/activity", "Activity"],
  ["/leaderboard", "Leaderboard"],
  ["/claim", "Claim"]
];

export function Navbar() {
  return (
    <header className="nav-shell">
      <div className="shell flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-3 text-xl font-bold" style={{ color: "var(--foreground)" }}>
          <span className="logo-mark">W</span>
          <span>WorkProof</span>
        </Link>
        <nav className="hidden md:flex flex-wrap gap-6 text-sm font-semibold" style={{ color: "var(--muted-strong)" }}>
          {links.map(([href, label]) => (
            <Link key={href} href={href} style={{ transition: "color 140ms ease" }}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2"><NotificationBell /><ProtocolNotifications /><WalletButton /></div>
      </div>
    </header>
  );
}
