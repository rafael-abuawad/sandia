# Payrequest

USD-denominated payment requests settled as stablecoins on **Robinhood Chain** via [Across Protocol](https://docs.across.to/).

## Stack

- Next.js App Router + React 19
- Convex (database + backend functions)
- Privy (wallet, Google, and email login) + wagmi/viem for on-chain reads and sends
- Across Swap API for quotes, approvals, bridging, and deposit tracking

## Setup

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

4. Add your [Privy App ID](https://dashboard.privy.io) to `.env.local` as `NEXT_PUBLIC_PRIVY_APP_ID`, and the same value on Convex:

```bash
npx convex env set PRIVY_APP_ID <your-privy-app-id>
```

In the Privy dashboard, enable Wallet, Email, and Google login, allow `http://localhost:3000` (and your production origin), and enable embedded Ethereum wallets.

5. In another terminal:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product flow

1. Creator signs in with a wallet (MetaMask, Rabby, etc.), Google, or email. Email/Google users get an embedded wallet automatically.
2. Create a request: USD amount, recipient, destination stablecoin (API-driven from Across on Robinhood Chain — currently **USDG**), optional description/expiry.
3. Share the public `/pay/{id}` URL.
4. Payer signs in, selects an Across-supported source chain/token, reviews quote (input, fees, min received, ETA), approves if needed, and pays.
5. The request is marked **completed** only after Across reports `filled` and server-side checks pass (destination chain, token, recipient, amount).

## Notes

- Monetary values are stored as integer base units / USD micros — no floating-point arithmetic.
- Destination tokens are discovered live from `GET /swap/tokens?chainId=4663` filtered to `USDC|USDT|USDG`.
- Deposit status is polled every 10 seconds via Across `GET /deposit/status`.
- Register an Across integrator id before production and set `NEXT_PUBLIC_ACROSS_INTEGRATOR_ID`.
