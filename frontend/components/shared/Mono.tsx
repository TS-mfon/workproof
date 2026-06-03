export function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`mono ${className}`} style={{ color: "var(--muted-strong)", fontSize: "13px" }}>{children}</span>;
}
