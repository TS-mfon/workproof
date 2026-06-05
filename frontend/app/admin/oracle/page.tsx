import { OracleControls } from "@/components/admin/OracleControls";
import { OracleAdminPanel } from "@/components/admin/OracleAdminPanel";

export const dynamic = "force-dynamic";

export default function AdminOraclePage() {
  return (
    <div className="grid gap-6">
      <div className="panel p-6 grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-bold">Heartbeat</h2>
          <p className="text-sm text-muted">
            The oracle service runs the GenLayer poller and deadline checker. These buttons send manual trigger signals to it.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="status-badge" data-state="under-review">
            <span className="dot" /> Oracle status
          </span>
          <span className="text-xs text-muted">
            Oracle URL not configured. Set <code className="mono p-1 rounded" style={{ background: "var(--accent-soft)", fontSize: 11 }}>NEXT_PUBLIC_ORACLE_URL</code> in your hosting env to enable remote triggers. Without it, the oracle runs autonomously on its own schedule.
          </span>
        </div>
      </div>

      <div className="panel p-6 grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-bold">Manual triggers</h2>
          <p className="text-sm text-muted">These are active only when the oracle URL is configured.</p>
        </div>
        <OracleControls />
      </div>

      <OracleAdminPanel />
    </div>
  );
}
