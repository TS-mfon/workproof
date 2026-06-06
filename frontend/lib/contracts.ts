export const workProofAddress = process.env.NEXT_PUBLIC_WORKPROOF_CONTRACT as `0x${string}` | undefined;

const freelancerProfileComponents = [
  { name: "wallet", type: "address" },
  { name: "reputationPoints", type: "uint256" },
  { name: "jobsCompleted", type: "uint256" },
  { name: "jobsFailed", type: "uint256" },
  { name: "totalEarned", type: "uint256" },
  { name: "domain", type: "string" }
] as const;

const jobTupleComponents = [
  { name: "jobId", type: "bytes32" },
  { name: "client", type: "address" },
  { name: "assignedFreelancer", type: "address" },
  { name: "escrowAmount", type: "uint256" },
  { name: "rewardAmount", type: "uint256" },
  { name: "title", type: "string" },
  { name: "specIpfsHash", type: "string" },
  { name: "acceptanceCriteria", type: "string" },
  { name: "domain", type: "string" },
  { name: "deliverableUrl", type: "string" },
  { name: "status", type: "uint8" },
  { name: "createdAt", type: "uint256" },
  { name: "deadline", type: "uint256" },
  { name: "retryCount", type: "uint256" },
  { name: "genLayerJobId", type: "bytes32" },
  { name: "verdictAt", type: "uint256" },
  { name: "mode", type: "uint8" },
  { name: "approvedSubmissionId", type: "bytes32" }
] as const;

const submissionTupleComponents = [
  { name: "submissionId", type: "bytes32" },
  { name: "jobId", type: "bytes32" },
  { name: "freelancer", type: "address" },
  { name: "deliverableUrl", type: "string" },
  { name: "attempt", type: "uint256" },
  { name: "status", type: "uint8" },
  { name: "submittedAt", type: "uint256" },
  { name: "qualityScore", type: "uint256" },
  { name: "reasoning", type: "string" }
] as const;

export const workProofAbi = [
  { type: "event", name: "JobPosted", inputs: [
    { name: "jobId", type: "bytes32", indexed: true },
    { name: "client", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "domain", type: "string", indexed: false },
    { name: "assignedTo", type: "address", indexed: false }
  ] },
  { type: "event", name: "ApplicationSubmitted", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }] },
  { type: "event", name: "JobAccepted", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }] },
  { type: "event", name: "WorkSubmitted", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }, { name: "deliverableUrl", type: "string", indexed: false }] },
  { type: "event", name: "SubmissionRecorded", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "submissionId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }, { name: "attempt", type: "uint256", indexed: false }, { name: "deliverableUrl", type: "string", indexed: false }] },
  { type: "event", name: "SubmissionRejected", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "submissionId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }, { name: "reasoning", type: "string", indexed: false }] },
  { type: "event", name: "ClientApproved", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "submissionId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }, { name: "qualityScore", type: "uint256", indexed: false }, { name: "reasoning", type: "string", indexed: false }] },
  { type: "event", name: "VerdictReceived", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "passed", type: "bool", indexed: false }, { name: "paymentPct", type: "uint8", indexed: false }, { name: "reasoning", type: "string", indexed: false }] },
  { type: "event", name: "VerdictOverridden", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "passed", type: "bool", indexed: false }, { name: "paymentPct", type: "uint8", indexed: false }, { name: "by", type: "address", indexed: true }, { name: "reasoning", type: "string", indexed: false }] },
  { type: "event", name: "RewardClaimed", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { type: "event", name: "JobRefunded", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "client", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "reason", type: "string", indexed: false }] },
  { type: "event", name: "JobDeleted", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "by", type: "address", indexed: true }, { name: "refunded", type: "uint256", indexed: false }, { name: "reason", type: "string", indexed: false }] },
  { type: "event", name: "EscrowToppedUp", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "by", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { type: "event", name: "ReputationAdded", inputs: [{ name: "freelancer", type: "address", indexed: true }, { name: "points", type: "uint256", indexed: false }, { name: "jobId", type: "bytes32", indexed: false }] },
  { type: "event", name: "ReputationAdjusted", inputs: [{ name: "wallet", type: "address", indexed: true }, { name: "oldPts", type: "uint256", indexed: false }, { name: "newPts", type: "uint256", indexed: false }, { name: "by", type: "address", indexed: true }, { name: "reason", type: "string", indexed: false }] },
  { type: "event", name: "JobFailureRecorded", inputs: [{ name: "freelancer", type: "address", indexed: true }, { name: "jobId", type: "bytes32", indexed: true }] },
  { type: "event", name: "JobPaused", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "paused", type: "bool", indexed: false }] },
  { type: "event", name: "GlobalPaused", inputs: [{ name: "paused", type: "bool", indexed: false }] },
  { type: "event", name: "WalletBanned", inputs: [{ name: "wallet", type: "address", indexed: true }, { name: "by", type: "address", indexed: true }, { name: "reason", type: "string", indexed: false }] },
  { type: "event", name: "WalletUnbanned", inputs: [{ name: "wallet", type: "address", indexed: true }, { name: "by", type: "address", indexed: true }] },
  { type: "event", name: "OracleAdded", inputs: [{ name: "oracle", type: "address", indexed: true }] },
  { type: "event", name: "OracleRemoved", inputs: [{ name: "oracle", type: "address", indexed: true }] },
  { type: "event", name: "DisputeWindowChanged", inputs: [{ name: "secondsValue", type: "uint256", indexed: false }] },
  { type: "event", name: "StuckEthSwept", inputs: [{ name: "to", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },

  { type: "function", name: "postJob", stateMutability: "payable", inputs: [
    { name: "title", type: "string" },
    { name: "specHash", type: "string" },
    { name: "criteria", type: "string" },
    { name: "domain", type: "string" },
    { name: "deadline", type: "uint256" },
    { name: "assignedFreelancer", type: "address" }
  ], outputs: [{ name: "jobId", type: "bytes32" }] },
  { type: "function", name: "postJobV3", stateMutability: "payable", inputs: [
    { name: "title", type: "string" },
    { name: "specHash", type: "string" },
    { name: "criteria", type: "string" },
    { name: "domain", type: "string" },
    { name: "deadline", type: "uint256" },
    { name: "assignedFreelancer", type: "address" },
    { name: "mode", type: "uint8" }
  ], outputs: [{ name: "jobId", type: "bytes32" }] },
  { type: "function", name: "applyForJob", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "acceptApplication", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "freelancer", type: "address" }], outputs: [] },
  { type: "function", name: "submitWork", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "deliverableUrl", type: "string" }], outputs: [] },
  { type: "function", name: "approveSubmission", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "submissionId", type: "bytes32" }, { name: "qualityScore", type: "uint8" }, { name: "reasoning", type: "string" }], outputs: [] },
  { type: "function", name: "rejectSubmission", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "submissionId", type: "bytes32" }, { name: "reasoning", type: "string" }], outputs: [] },
  { type: "function", name: "claimReward", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "cancelJob", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "topUpEscrow", stateMutability: "payable", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "receiveVerdict", stateMutability: "nonpayable", inputs: [
    { name: "jobId", type: "bytes32" },
    { name: "passed", type: "bool" },
    { name: "paymentPct", type: "uint8" },
    { name: "reasoning", type: "string" }
  ], outputs: [] },
  { type: "function", name: "autoRefund", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [] },

  { type: "function", name: "pauseJob", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "paused", type: "bool" }], outputs: [] },
  { type: "function", name: "adminForceRefund", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "reason", type: "string" }], outputs: [] },
  { type: "function", name: "deleteJob", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "reason", type: "string" }], outputs: [] },
  { type: "function", name: "overrideVerdict", stateMutability: "nonpayable", inputs: [
    { name: "jobId", type: "bytes32" },
    { name: "passed", type: "bool" },
    { name: "paymentPct", type: "uint8" },
    { name: "reasoning", type: "string" }
  ], outputs: [] },
  { type: "function", name: "banUser", stateMutability: "nonpayable", inputs: [{ name: "wallet", type: "address" }, { name: "reason", type: "string" }], outputs: [] },
  { type: "function", name: "unbanUser", stateMutability: "nonpayable", inputs: [{ name: "wallet", type: "address" }], outputs: [] },
  { type: "function", name: "setReputation", stateMutability: "nonpayable", inputs: [{ name: "wallet", type: "address" }, { name: "newPoints", type: "uint256" }, { name: "reason", type: "string" }], outputs: [] },
  { type: "function", name: "addOracle", stateMutability: "nonpayable", inputs: [{ name: "newOracle", type: "address" }], outputs: [] },
  { type: "function", name: "removeOracle", stateMutability: "nonpayable", inputs: [{ name: "oldOracle", type: "address" }], outputs: [] },
  { type: "function", name: "setDisputeWindow", stateMutability: "nonpayable", inputs: [{ name: "secondsValue", type: "uint256" }], outputs: [] },
  { type: "function", name: "setGlobalPaused", stateMutability: "nonpayable", inputs: [{ name: "paused", type: "bool" }], outputs: [] },
  { type: "function", name: "sweepStuckEth", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }], outputs: [] },

  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "isOracle", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "bannedWallets", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "globalPaused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "totalEscrowed", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "disputeWindow", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "jobPaused", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "rewardClaimed", stateMutability: "view", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "verdictQualityScore", stateMutability: "view", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "hasApplied", stateMutability: "view", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "submissionAttempts", stateMutability: "view", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getJobSubmissions", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "bytes32[]" }] },
  { type: "function", name: "getSubmission", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "tuple", components: submissionTupleComponents }] },
  { type: "function", name: "getJobIds", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32[]" }] },
  { type: "function", name: "getJob", stateMutability: "view", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [{ type: "tuple", components: jobTupleComponents }] },
  { type: "function", name: "getApplicants", stateMutability: "view", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [{ type: "address[]" }] },
  { type: "function", name: "getTopFreelancers", stateMutability: "view", inputs: [{ name: "limit", type: "uint256" }], outputs: [{ type: "tuple[]", components: freelancerProfileComponents }] },
  { type: "function", name: "getProfile", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "tuple", components: freelancerProfileComponents }] },
  { type: "function", name: "getWalletCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }
] as const;

export const ARBISCAN_BASE = "https://sepolia.arbiscan.io";
export const explorerTxUrl = (hash: string) => `${ARBISCAN_BASE}/tx/${hash}`;
export const explorerAddressUrl = (addr: string) => `${ARBISCAN_BASE}/address/${addr}`;
