export function Skeleton({ height = 14, width = "100%", className = "" }: { height?: number; width?: number | string; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ height, width }} />;
}

export function SkeletonGrid({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={18} />
      ))}
    </div>
  );
}
