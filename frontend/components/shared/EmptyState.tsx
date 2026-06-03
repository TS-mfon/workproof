import Link from "next/link";

export function EmptyState({
  title,
  message,
  ctaLabel,
  ctaHref
}: {
  title: string;
  message?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="empty-state">
      <div style={{ color: "var(--foreground)", fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {message && <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>{message}</div>}
      {ctaLabel && ctaHref && (
        <Link className="btn ghost tiny" href={ctaHref}>{ctaLabel}</Link>
      )}
    </div>
  );
}
