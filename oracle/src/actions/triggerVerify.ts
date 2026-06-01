import { env } from "../config.js";

export async function triggerVerify(input: {
  jobId: string;
  deliverableUrl: string;
  acceptanceCriteria: string;
  retryCount: number;
}) {
  const response = await fetch(env.GENLAYER_STUDIO_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "gen_callContractMethod",
      params: {
        contract: env.GENLAYER_CONTRACT,
        method: "verify_work",
        args: [input.jobId, input.deliverableUrl, input.acceptanceCriteria, input.retryCount]
      }
    })
  });
  if (!response.ok) {
    throw new Error(`GenLayer verify_work failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}
