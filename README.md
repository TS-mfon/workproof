# WorkProof

WorkProof is an autonomous hiring escrow protocol for Arbitrum Sepolia and GenLayer Studio. Clients post jobs and lock ETH, freelancers submit deliverables, GenLayer verifies work against acceptance criteria, and the oracle relays verdicts back to the escrow contract for claimable payment or refund.

## Stack

- Solidity 0.8.24 with Hardhat
- GenLayer intelligent contract in Python
- Oracle service in Node.js, TypeScript, viem, Supabase
- Next.js 14+ App Router frontend with wagmi, viem, RainbowKit, Tailwind
- Supabase Postgres and RLS

## Repository Layout

```text
contracts/arbitrum     WorkProof.sol, interfaces, deploy script
contracts/genlayer     WorkVerifier.py
oracle                 Autonomous bridge/listener service
frontend               Next.js dapp and API routes
supabase/migrations    Postgres schema and RLS
test                   Hardhat contract tests
```

## Setup

```bash
npm install
cp .env.example .env
cp oracle/.env.example oracle/.env
cp frontend/.env.example frontend/.env.local
```

Required deployment values:

- `DEPLOYER_PRIVATE_KEY`
- `ORACLE_WALLET`
- `ARBITRUM_SEPOLIA_RPC`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_WORKPROOF_CONTRACT`
- `GENLAYER_STUDIO_RPC`
- `GENLAYER_CONTRACT`
- `ORACLE_PRIVATE_KEY`
- `NEXT_PUBLIC_ADMIN_WALLETS`

## Contracts

```bash
npm run compile
npm run test
npm run deploy:arbitrum-sepolia
```

After deployment, copy the printed `WorkProof` address into the oracle and frontend env files.

Current Arbitrum Sepolia deployment:

- `WorkProof`: `0x6f20e728a36c710ba7ECe9b3378Cb14A69eE0b1B`
- Initial oracle/admin deployer: `0xEd9EDd8586b20524CafA4F568413C504C9B03172`
- Deployment metadata: `deployments/arbitrum-sepolia.json`

## GenLayer

```bash
genvm-lint check contracts/genlayer/WorkVerifier.py
genlayer network set studionet
genlayer deploy --contract contracts/genlayer/WorkVerifier.py
```

Current GenLayer Studionet deployment:

- `WorkVerifier`: `0x3C2AA0450B01aEc02e172DF560aD383f7D14BD74`
- Empty read check: `get_verdict("stress-dry-run") -> {"ready": false}`

Copy the deployed GenLayer contract address into `GENLAYER_CONTRACT`.

## Supabase

Apply `supabase/migrations/001_workproof_schema.sql` to a fresh Supabase project. The service key is required by the oracle and Next.js API routes for append-only activity and automated job updates.

## Oracle

```bash
npm --workspace oracle run dev
curl http://localhost:8787/health
```

The oracle watches `WorkSubmitted`, triggers GenLayer verification, polls verdicts every 30 seconds, calls `receiveVerdict`, and runs deadline refunds every 60 seconds.

## Frontend

```bash
npm --workspace frontend run dev
npm --workspace frontend run typecheck
npm --workspace frontend run build
```

The frontend renders only real Supabase/onchain state. Empty production state is shown as empty state UI instead of seeded fake cards.

Production deployment:

- GitHub: `https://github.com/TS-mfon/workproof`
- Vercel: `https://workproof-gen-daves-projects.vercel.app`
- Vercel project: `gen-daves-projects/workproof`

## Current Verification Status

- `npm run compile` passes.
- `npm --workspace oracle run typecheck` passes.
- `npm --workspace frontend run typecheck` passes.
- `npm --workspace frontend run build` passes.
- `genvm-lint check contracts/genlayer/WorkVerifier.py` passes AST lint but SDK validation currently fails while loading the remote SDK with `HTTP Error 404: Not Found`.
- `genlayer call 0x3C2AA0450B01aEc02e172DF560aD383f7D14BD74 get_verdict --args stress-dry-run` passes.
- `npm run test` currently fails in this environment with `Bus error (core dumped)` while starting the Hardhat test process.
- Production Vercel URL returns `HTTP 200`.
- Generated stress wallets were funded on Arbitrum Sepolia for the low-budget stress run.
- Live UI-backed stress data creation is pending real `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and an oracle runtime env.
- The protocol no longer deploys `JuryRegistry`; GenLayer validators are the only work review layer.

## Final Verification Checklist

- Flow A: post job, accept application, submit work, GenLayer passes, claim reward
- Flow B: submit work, GenLayer fails, retry, pass, claim reward
- Flow C: deadline expires, oracle refunds client
- Admin: wallet gate, pause job, force refund, oracle monitor
- Leaderboard: reputation updates after completed jobs

## Stress Test

```bash
npm run stress:wallets
npm run stress:fund
npm run stress:post30
npm run stress:submit10
npm run stress:post70
```

The stress scripts generate ignored local test wallets, fund them from the deployer, create escrow-backed jobs, submit public deliverables, and rely on the oracle plus GenLayer Studionet to resolve submitted jobs.

For production stress runs, set:

- `WORKPROOF_CONTRACT=0x6f20e728a36c710ba7ECe9b3378Cb14A69eE0b1B`
- `GENLAYER_CONTRACT=0x3C2AA0450B01aEc02e172DF560aD383f7D14BD74`
- `WORKPROOF_APP_URL=https://workproof-gen-daves-projects.vercel.app`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ORACLE_PRIVATE_KEY`
