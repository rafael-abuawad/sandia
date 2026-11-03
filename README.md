# Sandia

A mobile-first app on **Hyperliquid Core**: trade crypto and stock perpetuals, send USDC, and get paid from any chain through [Across Protocol](https://docs.across.to/).

## Stack

- Next.js App Router + React 19
- Convex (database + backend functions)
- Privy for Sandia accounts (email OTP and an embedded wallet) and for payer wallet connection, wagmi/viem for payer chain sends
- [`@nktkas/hyperliquid`](https://github.com/nktkas/hyperliquid) for Hyperliquid exchange actions; reads go to the public `/info` API
- Across Swap API for quotes, approvals, bridging to HyperCore, and deposit tracking

## Setup

After step 3 initializes Convex, configure Jev through OpenRouter. Keep this key in Convex only:

    npx convex env set OPENROUTER_API_KEY <openrouter-api-key>

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Install dependencies:

```bash
pnpm install
```

3. Start Convex (creates a deployment and writes `NEXT_PUBLIC_CONVEX_URL`):

```bash
npx convex dev
```

4. Set the Privy app id in `.env.local`:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=<privy-app-id>
```

Create a Privy app with email OTP and wallets enabled. Allow `http://localhost:3000`. On Convex, set the same app id and the wallet-claim secret:

```bash
npx convex env set PRIVY_APP_ID <same-as-NEXT_PUBLIC_PRIVY_APP_ID>
npx convex env set SANDIA_NONCE_SECRET <secret>
```

The Privy app secret stays on Convex only. Copy it from **Configuration → App settings → Basics** in the [Privy Dashboard](https://dashboard.privy.io). Privy shows it once; regenerating it invalidates the previous secret. Do not put it in `.env.local` or any `NEXT_PUBLIC_` variable. The Next.js client does not read it. Client sends authenticate with the signed-in Privy session.

```bash
npx convex env set PRIVY_APP_SECRET <app-secret>
```

Hyperliquid settings (defaults shown). The referral code is applied to new accounts. A builder fee is charged only when a builder address is set:

```bash
NEXT_PUBLIC_HL_REFERRAL_CODE=BOLIVIA
NEXT_PUBLIC_HL_BUILDER_ADDRESS=            # empty = no builder fee
NEXT_PUBLIC_HL_BUILDER_FEE_TENTHS_BPS=50   # 0.05% per trade when a builder is set, max 100 (0.1%)
```

5. In another terminal:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product flow

1. Sign in with email and OTP. Privy creates an embedded wallet. Its address is the user's Hyperliquid account.
2. **Get paid.** Create a USD request and share `/pay/{id}`. The payer connects their own wallet, picks a chain and token (Base, Arbitrum, Ethereum, HyperEVM, and more), and Across delivers USDC to the creator's HyperCore perps balance (Across chain `1337`, token `0x2100…0000`). Paying does not create a Sandia account.
3. **Trade.** `/trade` lists validator perps (Crypto) and the `xyz` HIP-3 dex (Stocks, plus Macro for commodities, indices and FX). A market page shows a touch chart, the open position, and Long/Short buttons that open a bottom-sheet ticket: amount, leverage, size, liquidation estimate, and fees.
4. **Send.** USDC goes to any Hyperliquid address, one person or a batch. Each recipient is one signed, instant, gasless transfer.

### Trading setup

The first trade asks the account wallet for two signatures:

- `approveAgent` registers a trading key that is generated and stored only in this browser (`localStorage`). Hyperliquid API wallets can place and cancel orders but cannot withdraw or transfer funds. Later orders need no wallet prompt.
- `approveBuilderFee` approves Sandia's builder fee. It runs only when `NEXT_PUBLIC_HL_BUILDER_ADDRESS` is set, and orders then include `builder: { b, f }`.

The trading key then calls `setReferrer({ code: "BOLIVIA" })` if the account has no referrer yet, and `agentSetAbstraction("u")` to switch the account to unified mode, so stocks and crypto share one USDC balance. Balances follow Hyperliquid's rules: unified accounts read USDC from the spot clearinghouse, and standard accounts add each dex's account value. Sends use `spotSend` for unified accounts and `usdSend` otherwise.

Market orders are IOC limits 1% through the mark. Position size is margin × leverage ÷ mark, truncated to the lot size.

### Payment verification

A request is marked **completed** only when its deposit receipt matches the request (destination chain 1337, HyperCore USDC, recipient, and amount) and Across `/deposit` reports `filled` with the same fields and a fill reference. HyperCore has no EVM receipt to read, so the Across record is the fill proof. A cron runs every minute in case the payer closes the tab.

## Notes

- Monetary values are stored as integer base units / USD micros — no floating-point arithmetic. Trade sizing uses Hyperliquid's decimal strings.
- The Across integrator id comes from Convex `ACROSS_INTEGRATOR_ID`. Set both `ACROSS_APP_FEE` and `ACROSS_APP_FEE_RECIPIENT` to charge an app fee on payment quotes. As of Nov 2026 Across rejects app fees on routes into HyperCore. The quote then retries without the fee, so payments keep working and the fee starts once Across supports it.
- Referral rewards follow Hyperliquid's program. Hyperliquid can refuse a referrer once an account already has one or has traded too much; setup ignores that and trading continues. A builder address, if you add one, must hold 100 USDC in perps before Hyperliquid pays builder fees.
- `/stocks`, `/earn` and `/lending` redirect to `/trade`. Earn and the Robinhood Chain stock tokens were removed. Legacy Convex tables (`outboundTransfers`, `swapFills`, `vaultActivities`) stay in the schema so existing deployments validate. Nothing writes to them.
