export const workProofAddress = process.env.NEXT_PUBLIC_WORKPROOF_CONTRACT as `0x${string}` | undefined;

const freelancerProfileComponents = [
  { name: "wallet", type: "address" },
  { name: "reputationPoints", type: "uint256" },
  { name: "jobsCompleted", type: "uint256" },
  { name: "jobsFailed", type: "uint256" },
  { name: "totalEarned", type: "uint256" },
  { name: "domain", type: "string" }
] as const;

export const workProofAbi = [
  {
    type: "event",
    name: "JobPosted",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "domain", type: "string", indexed: false },
      { name: "assignedTo", type: "address", indexed: false }
    ]
  },
  { type: "event", name: "ApplicationSubmitted", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }] },
  { type: "event", name: "JobAccepted", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }] },
  { type: "event", name: "WorkSubmitted", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }, { name: "deliverableUrl", type: "string", indexed: false }] },
  { type: "event", name: "VerdictReceived", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "passed", type: "bool", indexed: false }, { name: "paymentPct", type: "uint8", indexed: false }, { name: "reasoning", type: "string", indexed: false }] },
  { type: "event", name: "RewardClaimed", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { type: "event", name: "JobRefunded", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "client", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "reason", type: "string", indexed: false }] },
  { type: "event", name: "ReputationAdded", inputs: [{ name: "freelancer", type: "address", indexed: true }, { name: "points", type: "uint256", indexed: false }, { name: "jobId", type: "bytes32", indexed: false }] },
  {
    type: "function",
    name: "postJob",
    stateMutability: "payable",
    inputs: [
      { name: "title", type: "string" },
      { name: "specHash", type: "string" },
      { name: "criteria", type: "string" },
      { name: "domain", type: "string" },
      { name: "deadline", type: "uint256" },
      { name: "assignedFreelancer", type: "address" }
    ],
    outputs: [{ name: "jobId", type: "bytes32" }]
  },
  { type: "function", name: "applyForJob", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "acceptApplication", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "freelancer", type: "address" }], outputs: [] },
  { type: "function", name: "submitWork", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "deliverableUrl", type: "string" }], outputs: [] },
  { type: "function", name: "claimReward", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "cancelJob", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "pauseJob", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "paused", type: "bool" }], outputs: [] },
  { type: "function", name: "adminForceRefund", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "reason", type: "string" }], outputs: [] },
  {
    type: "function",
    name: "receiveVerdict",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "bytes32" },
      { name: "passed", type: "bool" },
      { name: "paymentPct", type: "uint8" },
      { name: "reasoning", type: "string" }
    ],
    outputs: []
  },
  { type: "function", name: "oracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "getJobIds", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32[]" }] },
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "bytes32" }],
    outputs: [{
      type: "tuple",
      components: [
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
        { name: "genLayerJobId", type: "bytes32" }
      ]
    }]
  },
  {
    type: "function",
    name: "getTopFreelancers",
    stateMutability: "view",
    inputs: [{ name: "limit", type: "uint256" }],
    outputs: [{ type: "tuple[]", components: freelancerProfileComponents }]
  },
  {
    type: "function",
    name: "getProfile",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "tuple", components: freelancerProfileComponents }]
  }
] as const;
