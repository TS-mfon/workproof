import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer-shell">
      <div className="shell" style={{ paddingTop: 56, paddingBottom: 40 }}>
        <div style={{ display: "grid", gap: 36, gridTemplateColumns: "1.4fr 1fr 1fr 1fr" }} className="footer-grid">
          <div>
            <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
              <span className="logo-mark">W</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--foreground)" }}>WorkProof</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 320 }}>
              WorkProof — autonomous, AI-verified freelance escrow on Arbitrum. Built end-to-end during a sprint; no fake state, no manual approvals.
            </p>
          </div>
          <FooterColumn title="Product" items={[
            ["Jobs", "/jobs"],
            ["Post a job", "/jobs/post"],
            ["Leaderboard", "/leaderboard"],
            ["Activity", "/activity"]
          ]} />
          <FooterColumn title="Protocol" items={[
            ["Contract", "https://sepolia.arbiscan.io/address/0xA6E94A8e04fbE69aE485E494012a7f2b615979ea", true],
            ["GenLayer verifier", "https://genlayer-explorer.vercel.app/address/0x3660ef8bC70Cb6Ff8F548Ad2924ED0B71d43D86e", true],
            ["Admin", "/admin"]
          ]} />
          <FooterColumn title="Resources" items={[
            ["GitHub", "https://github.com/TS-mfon/workproof", true],
            ["Arbiscan", "https://sepolia.arbiscan.io", true]
          ]} />
        </div>
        <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
          <span>© {new Date().getFullYear()} WorkProof Protocol</span>
          <span className="mono" style={{ fontSize: 11 }}>v2.1 · Arbitrum Sepolia</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: Array<[string, string] | [string, string, boolean]> }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
        {title}
      </div>
      <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none", margin: 0 }}>
        {items.map(([label, href, external]) => (
          <li key={href}>
            {external ? (
              <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--foreground-soft)" }}>
                {label}
              </a>
            ) : (
              <Link href={href} style={{ fontSize: 13, color: "var(--foreground-soft)" }}>
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
