---
name: across-protocol-ai-agent-skill
description: End-to-end Across Protocol integration playbook. Default to Swap API for all crosschain bridging and swapping. Use App SDK (@across-protocol/app-sdk) when you need programmatic quote/route control in TypeScript. Fall back to suggested-fees API only for custom swap routing or niche bridge-only flows. Covers intent lifecycle, Swap API integration, embedded crosschain actions, deposit tracking, fee collection, and security checklists.
user-invocable: true
---

# Across Protocol Development Skill

## What this Skill is for

Use this Skill when the user asks for:

- Crosschain bridge or swap integration (any-to-any token transfers)
- Wallet or dApp integration with Across APIs
- Embedded crosschain actions (bridge + mint/stake/deposit in one tx)
- Deposit tracking and status monitoring
- Fee quoting, transfer limits, or route discovery
- Integrator fee collection setup
- On-chain intent construction (ERC-7683 / SpokePool deposits)
- Relayer operation or configuration
- Security review of crosschain integration code

## Route type abbreviations

The Swap API classifies routes using a shorthand based on whether each token is directly bridgeable (B) or requires a swap to/from a bridgeable token (A = Any):

| Abbreviation | Meaning                 | Example                                                                  |
| ------------ | ----------------------- | ------------------------------------------------------------------------ |
| B2B          | Bridgeable → Bridgeable | USDC on Arbitrum → USDC on Base (no swaps, bridge only)                  |
| A2B          | Any → Bridgeable        | WBTC on Arbitrum → USDC on Base (origin swap + bridge)                   |
| B2A          | Bridgeable → Any        | USDC on Arbitrum → WBTC on Base (bridge + destination swap)              |
| A2A          | Any → Any               | WBTC on Arbitrum → DAI on Base (origin swap + bridge + destination swap) |

These abbreviations appear in `crossSwapType` responses and in refund behavior defaults.

## Default stack decisions (opinionated)

### 1. Swap API first (recommended for most integrators)

- Use `GET /swap/approval` for all crosschain swaps. It returns executable calldata to sign and submit.
- Use `POST /swap/approval` when you need embedded destination actions (mint, stake, deposit).
- The Swap API handles origin swaps, bridging, and destination swaps in a single call.
- Supports `appFee` + `appFeeRecipient` for integrator fee collection.

### 2. Suggested-fees API: legacy only

- Use `/suggested-fees` only when you control your own swap infrastructure and just need bridge fee quotes.
- This path requires you to assemble transactions yourself (construct `depositV3` calls manually).
- It does not handle origin or destination swaps.

### 3. Trade type selection

- `exactInput` (default): user specifies how much to send. Best for "swap X tokens" flows.
- `minOutput`: user specifies minimum to receive. Best for simple swaps without post-bridge actions.
- `exactOutput`: user needs a precise amount on destination. Best for multi-step flows (for example, exact ERC-20 amount for a mint).

### 4. Slippage

- Default to `slippage=auto`.
- Numeric slippage (0 to 1) is split across origin and destination swaps when both swaps exist.
- If only one swap happens, the full slippage is applied to that leg.

### 5. Refund behavior

- B2B or A2B routes (no destination swap): refunds default to origin chain.
- B2A or A2A routes (destination swap involved): refunds default to destination chain.
- Override with `refundOnOrigin=true/false` when needed.
- Refund recipient priority: `refundAddress` > `recipient` > `depositor`.

## Operating procedure (how to execute tasks)

### 1. Classify the task

- UI or wallet integration
- Backend or script
- Embedded actions
- Tracking or monitoring
- On-chain or ERC-7683
- Relayer operation

### 2. Pick the right integration path

| Task                                      | Use                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Crosschain swap (any token to any token)  | Swap API `GET /swap/approval`                                               |
| Bridge + destination action (mint, stake) | Swap API `POST /swap/approval` with `actions` body                          |
| Programmatic TypeScript integration       | App SDK `createAcrossClient()`                                              |
| Bridge-only with custom swap routing      | `/suggested-fees` + manual `depositV3`                                      |
| Direct on-chain intent (ERC-7683)         | `AcrossOriginSettler.open()` on supported chains                            |
| Track a deposit                           | `GET /deposit/status` with `depositTxnRef` or `originChainId` + `depositId` |

### 3. Implement with Across-specific correctness

Always be explicit about:

- Integrator ID (2-byte hex string)
- Token addresses: must match the specific chain (use wrapped addresses for native tokens)
- Amount units: always in smallest unit (wei for ETH, 1e6 for USDC, 1e18 for WETH)
- Chain IDs: use exact numeric chain IDs, not chain names
- Approval transactions: check `approvalTxns` in Swap API responses
- Do not cache `/swap/approval` and `/suggested-fees` responses

### 4. Test on testnet, ship on mainnet

- Testnet base URL: `https://testnet.across.to/api`
- Use small amounts (around $10) on testnet. Testnet fills take about 1 minute (vs around 2 seconds on mainnet).
- Testnet relayers are manually funded. Do not test with large amounts.
- Switch to mainnet (`https://app.across.to/api`) once integration logic is verified.

### 5. Deliverable expectations

When implementing changes, provide:

- Exact files changed with diffs
- Commands to install, build, and test
- A Risk Notes section for anything touching signing, fees, slippage, approvals, refunds, or crosschain messages

## Progressive disclosure (read when needed)

- Swap API deep-dive: [SKILL.md](swap/SKILL.md)
- Legacy bridge-only integration: [SKILL.md](bridge/SKILL.md)
- Embedded crosschain actions: [SKILL.md](embedded-crosschain-actions/SKILL.md)
- Deposit tracking: [SKILL.md](tracking-transactions/SKILL.md)
- Chains and tokens reference: [SKILL.md](fetch-chains-tokens/SKILL.md)
- Security checklist: [SKILL.md](security/SKILL.md)
- Resources and links: [SKILL.md](resources/SKILL.md)
