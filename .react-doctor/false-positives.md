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

## react-doctor/async-await-in-loop · `components/pay-flow/use-pay-flow.ts`

Across `approvalTxns` must run **in order**: each approval changes wallet nonce and
token allowance that the next tx depends on. `Promise.all` would race and break payment.
Sequential `await` here is required correctness, not a missed optimization.

## react-doctor/async-await-in-loop · `components/send-form.tsx`

USDG batch transfers must run **in order**: each `writeContractAsync` consumes the
wallet nonce and the next popup/receipt depends on the previous hash confirming.
`Promise.all` would race nonces and ask the wallet to sign overlapping transfers.

## react-doctor/async-await-in-loop · `convex/outboundActions.ts`

`reconcile` walks submitted sends one at a time on purpose. Each row hits Robinhood
RPC for receipts, then writes a Convex mutation. Parallelizing the loop would stampede
the RPC and race mark-result writes without a concurrency budget. Sequential `await`
is a resource cap, not a missed optimization.
