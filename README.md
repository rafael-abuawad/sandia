# Sandia

USD-denominated payment requests settled as **USDC on [Stellar](https://stellar.org)**. Payers on other networks reach Stellar through [NEAR Intents](https://docs.near-intents.org/).

## Stack

- Next.js App Router + React 19
- Convex (database + backend functions)
- Privy for Sandia accounts (email OTP and an embedded Stellar wallet)
- `@stellar/stellar-sdk` and Horizon for transactions and reads, with Stellar Wallets Kit for payer wallets
- NEAR Intents 1Click for cross-chain deposits

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

Create a Privy app with email OTP and Stellar embedded wallets enabled. Allow `http://localhost:3000`. On Convex, set the same app id and the wallet-claim secret:

```bash
npx convex env set PRIVY_APP_ID <same-as-NEXT_PUBLIC_PRIVY_APP_ID>
npx convex env set SANDIA_NONCE_SECRET <secret>
```

The Privy app secret stays on Convex only. Copy it from **Configuration → App settings → Basics** in the [Privy Dashboard](https://dashboard.privy.io). Privy shows it once; regenerating it invalidates the previous secret. Do not put it in `.env.local` or any `NEXT_PUBLIC_` variable. The Next.js client does not read it. Client sends authenticate with the signed-in Privy session.

```bash
npx convex env set PRIVY_APP_SECRET <app-secret>
```

Sandia pays Stellar fees and account reserves from its own account. Fund a Stellar account with XLM and set its secret on Convex only:

```bash
npx convex env set STELLAR_SPONSOR_SECRET <S...>
```

Set a NEAR Intents partner key too. Without one, 1Click adds 0.25% to every route:

```bash
npx convex env set NEAR_INTENTS_API_KEY <key>
```

5. In another terminal:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product flow

1. A creator signs in with email and OTP. Privy creates an embedded Stellar wallet, and Sandia links it with one signature. Sandia's sponsor then pays the reserves for the account and its USDC trustline, so the user holds no XLM.
2. They create a request: USD amount, optional description and expiry. The recipient is that wallet, and the destination is always USDC on Stellar.
3. They share the public `/pay/{id}` URL.
4. A payer picks one of two ways to pay. Neither creates a Sandia account.
   - **Stellar wallet:** connect through Stellar Wallets Kit and send USDC directly. The payer's wallet pays a small XLM fee.
   - **Another network:** choose a network and token and give a refund address. Sandia returns a 1Click deposit address and the amount to send. Any excess is refunded.
5. The request is marked **completed** only after Sandia reads the payment back from Stellar. A direct payment must carry the request's memo (`sandia:{id}`), be newer than the request, and pay at least the requested amount. A cross-chain payment needs 1Click `SUCCESS` plus a matching Stellar transaction, and `SUCCESS` alone settles nothing. A cron checks each minute in case the payer closes the tab.

## Notes

- Monetary values are stored as integer base units and USD micros. Stellar USDC has 7 decimals, so one USD micro is 10 stroops.
- Stellar addresses are case-sensitive. Never lowercase them.
- Sandia signs only what `lib/stellar/policy.ts` allows, and the sponsor pays only for the same set: USDC payments. The browser and Convex both check this. Sponsored transactions are limited to 60 per user per hour.
- A batch is one transaction of up to 100 payments, all succeeding or failing together. It needs no contract or approval.
- A recipient needs a Stellar account and a USDC trustline. Send checks this before signing, and also checks for accounts that require a memo (SEP-29).
- `/otc` redirects to `/requests/new`. `/stocks`, `/earn`, and `/lending` redirect to `/`.
- See `docs/gates.md` for what has been verified and what's needed before launch.

### Moving from Robinhood Chain

The cutover is clean: nothing migrates on-chain. Signing in again creates a Stellar wallet and replaces the user's stored address. Old requests show as unavailable and old contacts are hidden. `npx convex run migrations:clearLegacyData` deletes them. Tables dropped from the schema (`paymentAttempts`, `outboundTransfers`, `swapFills`, `vaultActivities`) stay in the database unread until you clear them in the Convex dashboard.
