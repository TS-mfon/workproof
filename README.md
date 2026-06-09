# WorkProof

Autonomous freelance escrow on Arbitrum Sepolia. Clients post jobs with locked ETH; freelancers submit a public deliverable URL; a GenLayer intelligent contract reviews the work and scores it; the oracle relays the verdict back on-chain so passing freelancers can claim payment.

The dApp runs on **Vercel only** (Next.js + cron via GitHub Actions). There is no standalone backend.

## Architecture

```
 Browser (wagmi)               Vercel (Next.js)                  Supabase
 ──────────────                ────────────────                  ────────
 user wallet  ──Arbitrum sig──▶ /api/genlayer-trigger ──sign───▶  audit row
                                signs verify_submission           genlayer_submissions
                                with ORACLE_PRIVATE_KEY            (unique submission_id+attempt)
                                       │
                                       ▼
                                 GenLayer studionet
                                 WorkVerifier.py

  GitHub Actions cron ────▶ /api/cron/ingest-submissions
                            /api/cron/poll-genlayer
                            /api/cron/check-deadlines
                                       │
                                       ▼
                                 Arbitrum Sepolia
                                 WorkProof.sol  ────▶ receiveVerdict / autoRefund
```

### Signing roles

| Wallet | Signs |
|---|---|
| **User wallet** (browser) | Arbitrum `submitWork` only (one signature, period) |
| **Oracle wallet** (`ORACLE_PRIVATE_KEY` on Vercel) | GenLayer `verify_submission` AND Arbitrum `receiveVerdict` / `autoRefund` |
| **Deployer wallet** | Contract deploys, seed jobs, oracle wallet funding |

`DEPLOYER_PRIVATE_KEY` is **never** used for runtime signing. The `/api/genlayer-trigger` route refuses to sign unless the derived signer equals the configured `ORACLE_WALLET` and the target contract equals `NEXT_PUBLIC_GENLAYER_CONTRACT`.

## Submit flow (user POV)

1. Freelancer pastes a public URL in the modal.
2. Clicks **Submit & verify**.
3. Wallet pops up **once** for the Arbitrum `submitWork` tx.
4. Status text walks through: `Recording on Arbitrum…` → `Sending to AI reviewer…` → `Submitted ✓`.
5. The oracle wallet handles the GenLayer signature server-side. The freelancer never sees a GenLayer prompt.

Re-clicking is impossible:
- A synchronous `useRef` lock blocks double-clicks before any await.
- A `beforeunload` listener blocks accidental tab reloads mid-flight.
- The server returns `alreadySigned: true` if `(submissionId, attempt)` is already in `genlayer_submissions`.
- The "Complete GenLayer review" retry button on the ranking panel hides itself if the lookup shows the oracle already signed.

## Repo layout

```
contracts/arbitrum/        Solidity WorkProof.sol + Hardhat deploy
contracts/genlayer/        Python WorkVerifier.py (intelligent contract)
frontend/                  Next.js App Router dApp
  app/api/genlayer-trigger     Oracle signs verify_submission
  app/api/genlayer-submissions/lookup  Idempotency lookup
  app/api/cron/ingest-submissions      Cron: poll SubmissionRecorded logs
  app/api/cron/poll-genlayer            Cron: poll GenLayer verdicts
  app/api/cron/check-deadlines          Cron: refund expired jobs
  lib/oracle/                Single source of GenLayer signing
oracle/                   Legacy standalone Node service (NOT deployed; see oracle/README.md)
scripts/
  generate-oracle-wallet.ts  Mint a fresh oracle wallet
  inspect-genlayer-tx.ts     Decode any GenLayer tx hash
  reset-and-seed-30.ts       One-shot reset + redeploy + seed 30 jobs
  e2e-oracle-submit.ts       Six-archetype e2e against deployed contracts
  check-no-non-oracle-genlayer.ts  CI gate: any verify_submission write outside the approved file fails the build
supabase/migrations/      DB schema; 004 + 005 are oracle-related
.github/workflows/cron-pings.yml   GitHub Actions schedules the cron routes
```

## Env vars

| Var | Where | Purpose |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | Local | Contract deploys + seeds + oracle funding only |
| `ORACLE_PRIVATE_KEY` | Vercel + local | Sole runtime signer (GenLayer + Arbitrum verdict relay) |
| `ORACLE_WALLET` | Vercel + local | Address derived from the key, used for guard checks |
| `CRON_SECRET` | Vercel + GitHub Secrets | Bearer token on cron endpoints |
| `WORKPROOF_CONTRACT` / `NEXT_PUBLIC_WORKPROOF_CONTRACT` | Vercel + local | Arbitrum contract address |
| `GENLAYER_CONTRACT` / `NEXT_PUBLIC_GENLAYER_CONTRACT` | Vercel + local | GenLayer studionet verifier |
| `GENLAYER_STUDIO_RPC` | Vercel + local | `https://studio.genlayer.com/api` |
| `ARBITRUM_SEPOLIA_RPC` | Vercel + local | `https://sepolia-rollup.arbitrum.io/rpc` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Vercel + local | Service-role Supabase |
| `SUPABASE_ACCESS_TOKEN` | Local | Supabase Management API for migrations + truncates |
| `VERCEL_TOKEN` | Local | Vercel REST API for env rotation |
| `GITHUB_TOKEN` | Local | Repo push + GH Actions secret rotation |
| `NEXT_PUBLIC_BUILD_SHA` | Vercel | Build commit; shown as a corner chip on every page |

## Local dev

```sh
npm install
npm --workspace frontend run dev
```

Open `http://localhost:3000`. The cron routes require `CRON_SECRET` to be set in `.env.local`; otherwise they return 401.

## Reset + seed for a clean test run

This refunds every open job on the old contract, sweeps stuck ETH to the deployer, redeploys `WorkProof` with the current oracle wallet as `initialOracle`, calls `addOracle` for redundancy, funds the oracle with 0.005 ETH, rotates `WORKPROOF_CONTRACT` everywhere, truncates Supabase tables, and posts 30 new content-writing jobs.

```sh
npx tsx scripts/reset-and-seed-30.ts --dry-run   # print plan, no changes
npx tsx scripts/reset-and-seed-30.ts --apply     # do everything
```

After it finishes, `git push origin main` and Vercel auto-redeploys with the new contract address.

## Cron schedule

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/ingest-submissions` | `*/5 * * * *` | Read `SubmissionRecorded` logs since cursor; sign GenLayer `verify_submission` for each via the oracle |
| `/api/cron/poll-genlayer` | `*/5 * * * *` | Read `get_verdict` for `UnderReview` jobs; relay passing/failing verdicts to Arbitrum |
| `/api/cron/check-deadlines` | `*/15 * * * *` | Auto-refund jobs whose deadlines have passed |

GitHub Actions (`.github/workflows/cron-pings.yml`) curls each endpoint with the `CRON_SECRET` bearer.

## Idempotency

The `genlayer_submissions` table has `unique (submission_id, attempt)`. Every signing path (public route + cron) does a pre-flight `SELECT` and returns the prior `glTxId` if a row exists. A race between two concurrent requests is caught by the DB constraint.

## Deploys

Vercel auto-deploys on every push to `main` (`createDeployments: enabled`, `productionBranch: main`). No manual `vercel deploy` is needed unless you want to redeploy without a code change.

## Where the GenLayer signing happens

Exactly one file: `frontend/lib/oracle/genlayer.ts`. The `scripts/check-no-non-oracle-genlayer.ts` gate enforces this — any other source file containing a `verify_submission`/`verify_work` write pattern fails `npm run check`.

## Investigating a stuck GenLayer tx

```sh
npx tsx scripts/inspect-genlayer-tx.ts 0xabc...
```

Prints `from_address`, `to_address`, `result_name`, `consensus_history`, and the leader output. Common failures:

- `result_name: NO_MAJORITY` — validators couldn't agree. Usually because the deliverable URL host is not in the GenLayer accessible-domain list (`frontend/lib/genlayer-reachability.ts`).
- `from_address` ≠ the configured oracle — a non-oracle path slipped through (impossible now thanks to the runtime guard, but a stale tx from before the fix can still show up).

## License

MIT
