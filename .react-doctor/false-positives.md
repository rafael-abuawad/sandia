# React Doctor — verified false positives

Patterns below were reviewed against each rule’s validation prompt.
Do not delete Convex modules or parallelize on-chain approval txs based on these hits.

## deslop/unused-file · `convex/**`

Convex registers `convex/*.ts` (and generated `_generated/*`) as backend entrypoints.
deslop only traces the Next.js import graph, so every Convex function file looks orphaned.
Keep the modules; ignore dead-code rules under `convex/` via `doctor.config.json`.

## deslop/unused-export · `convex/_generated/api.js` (`components`)

Generated Convex client surface. The `components` export is unused until a Convex
component is added; editing `_generated` is incorrect.

## react-doctor/async-await-in-loop · `convex/sendsActions.ts`, `convex/nearIntents.ts`

`reconcile` walks submitted rows one at a time on purpose. Each row hits Horizon or 1Click,
then writes a Convex mutation. Parallelizing the loop would stampede those APIs and race
mark-result writes without a concurrency budget. Sequential `await` is a resource cap, not a
missed optimization.

## react-doctor/async-await-in-loop · `lib/send/execute.ts`

Recipient preflight runs in chunks of 10, one chunk at a time, so a 100-recipient batch doesn't
trip Horizon's rate limit.

## react-doctor/async-await-in-loop · `components/ensure-convex-user.tsx`

Account activation retries in sequence. A sequence-number clash needs a fresh transaction built
from the last attempt's outcome, so the tries can't run in parallel.
