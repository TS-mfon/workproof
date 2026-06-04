const REVERT_COPY: Record<string, string> = {
  BANNED: "Your wallet is restricted by an admin and cannot use the protocol.",
  ASSIGNEE_BANNED: "The wallet you tried to assign is banned.",
  FREELANCER_BANNED: "That freelancer's wallet is banned.",
  CANNOT_BAN_OWNER: "You can't ban the protocol owner.",
  CLIENT_CANNOT_APPLY: "Clients can't apply to their own jobs.",
  NOT_OPEN: "This job is no longer open.",
  NOT_ACTIVE: "This job isn't active.",
  NOT_ASSIGNED: "You're not the assigned freelancer for this job.",
  NOT_UNDER_REVIEW: "This job isn't currently under AI review.",
  NOT_SUBMITTABLE: "Work can only be submitted when the job is Active or Failed.",
  NOT_PASSED: "The AI hasn't approved this job yet.",
  NOT_REFUNDABLE: "This job can't be refunded.",
  NOT_OVERRIDABLE: "This job's verdict can't be overridden anymore.",
  ALREADY_APPLIED: "You've already applied to this job.",
  ALREADY_CLAIMED: "This reward has already been claimed.",
  ALREADY_ORACLE: "That wallet is already an oracle.",
  NO_APPLICATION: "That freelancer hasn't applied to this job.",
  ONLY_CLIENT: "Only the client who posted this job can do that.",
  ONLY_FREELANCER: "Only the assigned freelancer can do that.",
  ONLY_OWNER: "Only the protocol owner can do that.",
  ONLY_ORACLE: "Only an authorised oracle can do that.",
  ESCROW_REQUIRED: "You need to lock some ETH as escrow.",
  ZERO_TOPUP: "Top-up amount can't be zero.",
  ZERO_ORACLE: "Oracle address can't be zero.",
  ZERO_WALLET: "Wallet address can't be zero.",
  ZERO_FREELANCER: "Freelancer address can't be zero.",
  ZERO_TO: "Destination address can't be zero.",
  DEADLINE_IN_PAST: "The deadline must be in the future.",
  DEADLINE_PASSED: "The deadline for this job has passed.",
  URL_REQUIRED: "A deliverable URL is required.",
  TITLE_REQUIRED: "Job title is required.",
  CRITERIA_REQUIRED: "Acceptance criteria are required.",
  BAD_PAYMENT_PCT: "Payment percentage must be between 0 and 100.",
  DISPUTE_WINDOW: "The dispute window hasn't closed yet — try again later.",
  GLOBAL_PAUSED: "The protocol is currently paused by the admin.",
  JOB_PAUSED: "This job has been paused by the admin.",
  JOB_NOT_FOUND: "Job not found.",
  TOPUP_NOT_ALLOWED: "You can't top up this job in its current state.",
  TERMINAL: "This job is already in a final state.",
  WINDOW_TOO_LONG: "Dispute window can't exceed 7 days.",
  NOT_ORACLE: "That wallet isn't an oracle.",
  NO_STUCK_ETH: "There's no stuck ETH to sweep.",
  REENTRANT: "Re-entrant call rejected.",
  REFUND_NOT_DUE: "This refund isn't due yet.",
  REWARD_TRANSFER_FAILED: "The reward transfer failed — try again.",
  REMAINDER_REFUND_FAILED: "The leftover refund transfer failed.",
  REFUND_TRANSFER_FAILED: "Refund transfer failed.",
  SWEEP_FAILED: "Sweep transfer failed."
};

export function friendlyTxError(err: unknown): string {
  const raw = errorString(err);
  if (!raw) return "Transaction failed. Please try again.";

  if (/user rejected|denied|UserRejected/i.test(raw)) return "You declined the signature.";
  if (/insufficient funds/i.test(raw)) return "Not enough ETH to cover the transaction.";
  if (/network|nonce|underpriced|replacement/i.test(raw)) return "Network issue — try the transaction again.";

  for (const code of Object.keys(REVERT_COPY)) {
    const pattern = new RegExp(`\\b${code}\\b`);
    if (pattern.test(raw)) return REVERT_COPY[code];
  }

  const reasonMatch = raw.match(/reverted with reason string ['"]([^'"]+)['"]/i)
    || raw.match(/reason:\s*([A-Z_]+)/);
  if (reasonMatch) {
    const code = reasonMatch[1];
    if (REVERT_COPY[code]) return REVERT_COPY[code];
    return `Transaction reverted: ${code}`;
  }

  // Fall back to the short message
  const short = raw.split("\n")[0].slice(0, 160);
  return short || "Transaction failed.";
}

function errorString(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const anyErr = err as any;
    return [anyErr.shortMessage, anyErr.metaMessages?.join(" "), anyErr.details, err.message].filter(Boolean).join(" | ");
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
