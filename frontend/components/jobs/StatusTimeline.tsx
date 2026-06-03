import type { JobStatus } from "@/lib/types";

const steps: { key: JobStatus; label: string }[] = [
  { key: "Open", label: "Posted" },
  { key: "Active", label: "In Progress" },
  { key: "UnderReview", label: "AI Review" },
  { key: "Passed", label: "Approved" },
  { key: "Complete", label: "Paid Out" }
];

const terminalStyles: Partial<Record<JobStatus, string>> = {
  Failed: "var(--danger)",
  Refunded: "var(--muted)",
  Deleted: "var(--danger)"
};

export function StatusTimeline({ status }: { status: JobStatus }) {
  const activeIdx = steps.findIndex((s) => s.key === status);
  const terminalColor = terminalStyles[status];
  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
        {steps.map((step, index) => {
          const reached = index <= activeIdx && activeIdx >= 0;
          return (
            <div
              key={step.key}
              style={{
                borderRadius: 10,
                border: `1px solid ${reached ? "var(--accent)" : "var(--line)"}`,
                background: reached ? "var(--accent-soft)" : "var(--surface-soft)",
                color: reached ? "var(--accent)" : "var(--muted)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.04em",
                padding: "10px 8px",
                textAlign: "center",
                textTransform: "uppercase"
              }}
            >
              {step.label}
            </div>
          );
        })}
      </div>
      {terminalColor && (
        <div
          style={{
            marginTop: 12,
            border: `1px solid ${terminalColor}`,
            borderRadius: 10,
            padding: "10px 14px",
            color: terminalColor,
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: "0.06em",
            textTransform: "uppercase"
          }}
        >
          {status === "Refunded" ? "Refunded to client" : status === "Deleted" ? "Removed by admin" : "AI verifier failed this attempt"}
        </div>
      )}
    </div>
  );
}
