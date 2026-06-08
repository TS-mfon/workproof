// Disabled — production signing happens in frontend/app/api/genlayer-trigger
// via the oracle wallet. This module is retained only so oracle/ keeps
// typechecking for local development.
export async function triggerVerify(input: {
  jobId: string;
  deliverableUrl: string;
  acceptanceCriteria: string;
  retryCount: number;
}) {
  console.warn(
    JSON.stringify({
      ts: new Date().toISOString(),
      component: "oracle/triggerVerify",
      level: "warn",
      msg: "non_oracle_path_disabled",
      jobId: input.jobId
    })
  );
  return { ok: false as const, reason: "non_oracle_path_disabled" };
}
