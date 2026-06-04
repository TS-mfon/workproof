import Link from "next/link";
import { EthAmount } from "@/components/shared/EthAmount";
import { FlowIcons } from "@/components/landing/FlowIcons";
import { getJobs, getStats } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, jobs] = await Promise.all([getStats(), getJobs(200)]);
  const open = jobs.filter((j) => j.status === "Open").length;

  return (
    <>
      <section className="hero-stage">
        <div className="shell hero-grid">
          <div className="animate-rise">
            <p className="eyebrow"><span className="live-dot" /> Live on Arbitrum Sepolia</p>
            <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 800, lineHeight: 1.02, marginTop: 24, letterSpacing: "-0.025em" }}>
              Work verified <br />before payment.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--muted-strong)", marginTop: 20, maxWidth: 560 }}>
              An autonomous freelance escrow. Clients lock ETH, freelancers submit a deliverable URL, and an AI verifier decides whether the payout releases — no platform middlemen, no manual approvals.
            </p>
            <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link className="btn large" href="/jobs">Browse open jobs</Link>
              <Link className="btn ghost large" href="/jobs/post">Post a job</Link>
            </div>
          </div>

          <div className="protocol-visual">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span className="text-xs uppercase tracking-widest font-bold" style={{ color: "var(--accent-strong)" }}>How it works</span>
              <span className="live-pill"><span className="live-dot" /> Live</span>
            </div>
            <FlowSteps />
          </div>
        </div>
      </section>

      <section className="shell stats-strip" style={{ marginTop: 56 }}>
        <Link href="/jobs" className="metric-card" style={{ textDecoration: "none" }}>
          <p>Open jobs</p>
          <b>{open}</b>
        </Link>
        <Link href="/jobs" className="metric-card" style={{ textDecoration: "none" }}>
          <p>Total escrowed</p>
          <b><EthAmount wei={stats.totalEscrowed} /></b>
        </Link>
        <Link href="/activity" className="metric-card" style={{ textDecoration: "none" }}>
          <p>Completed</p>
          <b>{stats.completed}</b>
        </Link>
      </section>

      <section className="section section-band">
        <div className="shell">
          <div className="section-heading" style={{ margin: "0 auto", textAlign: "center", maxWidth: 720 }}>
            <p>Trust by design</p>
            <h2>No invoice. No approval queue.<br />The contract is the referee.</h2>
            <span>
              Escrow is locked in the WorkProof contract on Arbitrum Sepolia. A GenLayer verifier reads the deliverable URL against the client's acceptance criteria and writes the verdict back on-chain. The freelancer claims directly from the contract — admins can pause, override, or refund, but the default path runs on its own.
            </span>
          </div>
          <div style={{ marginTop: 48, display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <TrustCard
              title="On-chain escrow"
              body="ETH is locked inside the contract the moment a job is posted. No custodial wallets, no exit ramps."
            />
            <TrustCard
              title="AI-verified deliverables"
              body="GenLayer validators independently check the deliverable URL against the criteria the client wrote. Consensus, not a single API call."
            />
            <TrustCard
              title="Autonomous payouts"
              body="No platform manager signs off. The oracle relays the verdict, the freelancer claims, the client gets back any unused escrow."
            />
          </div>
        </div>
      </section>
    </>
  );
}

function FlowSteps() {
  const steps = [
    { label: "Escrow", body: "Client locks ETH in the contract.", Icon: FlowIcons.Lock },
    { label: "Submit", body: "Freelancer attaches a deliverable URL.", Icon: FlowIcons.Upload },
    { label: "Verify", body: "GenLayer reads it against the criteria.", Icon: FlowIcons.Brain },
    { label: "Claim", body: "Approved reward releases automatically.", Icon: FlowIcons.Coin }
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {steps.map((s, i) => (
        <div className="process-row" key={s.label}>
          <span><s.Icon /></span>
          <div>
            <div style={{ fontWeight: 700, color: "var(--foreground)", fontSize: 14 }}>
              {i + 1}. {s.label}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-strong)", marginTop: 2 }}>{s.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrustCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="feature-card">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
