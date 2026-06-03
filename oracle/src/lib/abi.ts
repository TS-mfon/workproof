export const workProofAbi = [
  {
    type: "event",
    name: "WorkSubmitted",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "freelancer", type: "address", indexed: true },
      { name: "deliverableUrl", type: "string", indexed: false }
    ]
  },
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "freelancer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false }
    ]
  },
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
  {
    type: "event",
    name: "JobAccepted",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "freelancer", type: "address", indexed: true }
    ]
  },
  {
    type: "event",
    name: "JobDeleted",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "by", type: "address", indexed: true },
      { name: "refunded", type: "uint256", indexed: false },
      { name: "reason", type: "string", indexed: false }
    ]
  },
  {
    type: "event",
    name: "WalletBanned",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "by", type: "address", indexed: true },
      { name: "reason", type: "string", indexed: false }
    ]
  },
  {
    type: "event",
    name: "WalletUnbanned",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "by", type: "address", indexed: true }
    ]
  },
  {
    type: "event",
    name: "VerdictReceived",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "passed", type: "bool", indexed: false },
      { name: "paymentPct", type: "uint8", indexed: false },
      { name: "reasoning", type: "string", indexed: false }
    ]
  },
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "bytes32" }],
    outputs: [
      {
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
          { name: "genLayerJobId", type: "bytes32" },
          { name: "verdictAt", type: "uint256" }
        ]
      }
    ]
  },
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
  {
    type: "function",
    name: "autoRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "bytes32" }],
    outputs: []
  }
] as const;
