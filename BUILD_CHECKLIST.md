# WorkProof Build Checklist

This checklist tracks the active WorkProof build after removing the jury system in favor of GenLayer validator review.

## Core Protocol
- [x] Monorepo created with contracts, oracle, frontend, Supabase, and tests
- [x] `WorkProof.sol` implements escrow, applications, direct assignment, retries, refunds, claims, and admin pause/refund
- [x] `WorkProof.sol` stores freelancer reputation directly
- [x] `getTopFreelancers(limit)` is available directly on `WorkProof`
- [x] `JuryRegistry.sol` and juror tests removed
- [x] Arbitrum Sepolia deploy script writes deployment metadata

## GenLayer + Oracle
- [x] `WorkVerifier.py` implements URL fetch, criteria checking, custom validator, verdict read, and emitted marker
- [x] Oracle listens for `WorkSubmitted`
- [x] Oracle triggers GenLayer verification
- [x] Oracle polls verdicts and relays `receiveVerdict`
- [x] Oracle deadline cron calls `autoRefund`
- [x] Oracle config no longer requires `JURY_REGISTRY_CONTRACT`

## Supabase
- [x] Users, jobs, applications, activity, claim queue, admin actions, and reputation history tables exist
- [x] Juror case/vote tables removed from the fresh migration
- [x] RLS policies retained for public reads and service-role writes

## Frontend
- [x] Blue/white visual system added
- [x] Site logo and favicon added
- [x] Landing page redesigned with motion and richer live-state sections
- [x] Job board and job cards restyled
- [x] Leaderboard no longer includes juror tab
- [x] Jury route removed
- [x] Admin route remains wallet-gated but is no longer visible in public navigation
- [x] Public stress deliverable endpoint added for GenLayer E2E testing

## Verification + Deployment
- [x] `npm run compile`
- [ ] `npm run test` (blocked locally by `Bus error (core dumped)` in the Hardhat process)
- [x] `npm --workspace oracle run typecheck`
- [x] `npm --workspace frontend run typecheck`
- [x] `npm --workspace frontend run build`
- [ ] `genvm-lint check contracts/genlayer/WorkVerifier.py` (AST lint passes; remote SDK validation fails with `HTTP Error 404: Not Found`)
- [x] Deploy new `WorkProof` to Arbitrum Sepolia: `0x6f20e728a36c710ba7ECe9b3378Cb14A69eE0b1B`
- [x] Deploy corrected `WorkVerifier.py` to GenLayer Studionet: `0x3660ef8bC70Cb6Ff8F548Ad2924ED0B71d43D86e`
- [x] Verify GenLayer stress read path with ready verdicts for the first 10 submitted jobs
- [ ] Apply Supabase migration (blocked: project has no WorkProof tables, and supplied service key cannot create/drop schema through Supabase Management API)
- [x] Push updated `main` to GitHub
- [x] Vercel project linked/configured: `gen-daves-projects/workproof` (GitHub-connected, root `frontend`, Next.js)
- [x] Create Vercel production deployment: `https://workproof-gen-daves-projects.vercel.app`
- [x] Disable Vercel Authentication for public access
- [x] Verify production URL returns `HTTP 200`
- [x] Fund generated stress wallets with low test budget
- [x] Create 30 escrow-backed Arbitrum Sepolia jobs with the funded stress client wallet
- [x] Submit 10 jobs from 4 freelancer wallets
- [x] Verify 10 submitted jobs through GenLayer Studionet readiness
- [x] Relay verdicts and claim 10 rewards through `WorkProof`
- [x] Create 70 additional escrow-backed Arbitrum Sepolia jobs with varied deadlines after E2E verification
- [ ] Sync stress jobs, activity, claims, and leaderboard rows into Supabase (blocked until fresh schema exists)
