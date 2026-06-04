import { PostWizard } from "@/components/post/PostWizard";

export const dynamic = "force-dynamic";

export default function PostJobPage() {
  return (
    <section className="shell py-12" style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 28 }}>
        <p className="text-xs font-bold uppercase tracking-widest text-accent-strong">New escrow</p>
        <h1 className="text-3xl font-bold" style={{ marginTop: 6 }}>Post a job</h1>
        <p className="text-sm text-muted" style={{ marginTop: 8 }}>
          Lock ETH, describe the deliverable, and the protocol does the rest. The AI verifier reads your acceptance criteria and decides whether the freelancer gets paid.
        </p>
      </div>
      <PostWizard />
    </section>
  );
}
