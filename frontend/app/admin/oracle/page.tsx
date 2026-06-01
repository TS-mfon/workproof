import { OracleControls } from "@/components/admin/OracleControls";

export default function AdminOraclePage() {
  const oracleUrl = process.env.NEXT_PUBLIC_ORACLE_URL;
  return (
    <section className="shell grid gap-6 py-10">
      <h1 className="text-3xl font-black">Oracle Monitor</h1>
      <div className="panel p-5"><h2 className="text-2xl font-bold">Heartbeat</h2><p className="mt-2 text-slate-600">{oracleUrl ? `${oracleUrl}/health` : "NEXT_PUBLIC_ORACLE_URL not configured"}</p></div>
      <div className="panel p-5"><h2 className="mb-3 text-2xl font-bold">Manual Triggers</h2><OracleControls /></div>
      <div className="panel p-5"><h2 className="text-2xl font-bold">Oracle Balance</h2><p className="mt-2 text-slate-600">Read this from the configured oracle wallet on Arbitrum Sepolia before production demo. Alert threshold: 0.05 ETH.</p></div>
    </section>
  );
}
