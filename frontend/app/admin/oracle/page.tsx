import { OracleVerifications } from "@/components/admin/OracleVerifications";
import { OracleAdminPanel } from "@/components/admin/OracleAdminPanel";

export const dynamic = "force-dynamic";

export default function AdminOraclePage() {
  return (
    <div className="grid gap-6">
      <div className="panel p-6 grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-bold">GenLayer verifications</h2>
          <p className="text-sm text-muted">
            Every time a freelancer submits work, the oracle wallet signs a <code className="mono" style={{ fontSize: 11 }}>verify_submission</code> call
            on the GenLayer studionet contract. There is no backend service — submissions are signed by the Next.js API route and the GitHub Actions cron.
            The most recent verifications are listed below, newest first.
          </p>
        </div>
        <OracleVerifications />
      </div>

      <OracleAdminPanel />
    </div>
  );
}
