# Payrequest

USD-denominated payment requests settled as stablecoins on **Robinhood Chain** via [Across Protocol](https://docs.across.to/).

## Stack

- Next.js App Router + React 19
- Convex (database + backend functions)
- ConnectKit + wagmi/viem (wallet connect)
- SIWE (Sign-In with Ethereum) for creator auth
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

4. Add a [WalletConnect project id](https://cloud.walletconnect.com) to `.env.local` as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

5. In another terminal:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product flow

1. Creator connects a wallet (ConnectKit — no message signature required).
2. Create a request: USD amount, recipient, destination stablecoin (API-driven from Across on Robinhood Chain — currently **USDG**), optional description/expiry.
3. Share the public `/pay/{id}` URL.
4. Payer connects any wallet (no account), selects an Across-supported source chain/token, reviews quote (input, fees, min received, ETA), approves if needed, and pays.
5. The request is marked **completed** only after Across reports `filled` and server-side checks pass (destination chain, token, recipient, amount).

## Notes

- Monetary values are stored as integer base units / USD micros — no floating-point arithmetic.
- Destination tokens are discovered live from `GET /swap/tokens?chainId=4663` filtered to `USDC|USDT|USDG`.
- Deposit status is polled every 10 seconds via Across `GET /deposit/status`.
- Register an Across integrator id before production and set `NEXT_PUBLIC_ACROSS_INTEGRATOR_ID`.
