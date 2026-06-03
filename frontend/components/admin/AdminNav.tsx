"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Overview", href: "/admin" },
  { label: "Jobs", href: "/admin/jobs" },
  { label: "Users", href: "/admin/users" },
  { label: "Disputes", href: "/admin/disputes" },
  { label: "Oracle", href: "/admin/oracle" },
  { label: "Treasury", href: "/admin/treasury" },
  { label: "Protocol", href: "/admin/protocol" },
  { label: "Announcements", href: "/admin/announcements" },
  { label: "Activity", href: "/admin/activity" },
  { label: "Audit", href: "/admin/actions" }
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="panel" style={{ padding: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
      {items.map((item) => {
        const active = path === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              color: active ? "var(--accent)" : "var(--muted-strong)",
              background: active ? "var(--accent-soft)" : "transparent",
              transition: "all 140ms ease"
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
