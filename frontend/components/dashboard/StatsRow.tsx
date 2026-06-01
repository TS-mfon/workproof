export function StatsRow({ stats }: { stats: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid-auto">
      {stats.map((stat) => (
        <div className="metric-card" key={stat.label}>
          <p className="text-sm text-slate-600">{stat.label}</p>
          <p className="mt-1 text-2xl font-black text-blue-950">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
