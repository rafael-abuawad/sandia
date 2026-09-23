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
2. Create a request: USD amount, optional description and expiry. The recipient is the creator's confirmed wallet, or their Sandia Kernel once that account is linked. The destination token is USDG on Robinhood Chain.
3. Share the public `/pay/{id}` URL.
4. Payer signs in, selects an Across-supported source chain/token, reviews quote (input, fees, min received, ETA), approves if needed, and pays.
5. The request is marked **completed** only after a deposit receipt matches the request and Across `/deposit` reports `filled` with destination chain 4663, the request token, the snapshotted recipient, an output amount at least as large as the request, and a fill transaction. `/deposit/status` is not used as proof. A minute cron keeps checking if the payer closes the tab.

## Notes

- Monetary values are stored as integer base units / USD micros — no floating-point arithmetic.
- Destination tokens are discovered live from `GET /swap/tokens?chainId=4663` filtered to `USDC|USDT|USDG`.
- The payer's browser also polls every 10 seconds. The server calls Across `GET /deposit` (or `/deposits`) with `ACROSS_API_KEY` on Convex, not a public env var.
- Register an Across integrator id and set Convex `ACROSS_INTEGRATOR_ID`.
- `/otc` redirects to `/requests/new`.
- `NEXT_PUBLIC_SANDIA_AUTH=zerodev` switches the app to one wagmi config with a ZeroDev Kernel (`mode: 4337`) and ConnectKit. Leave it unset to keep Privy. Do not remove Privy in that same release.
- ConnectKit 1.9.2 does not peer React 19. Guest pay through its modal stays off until a smoke test opens the modal, connects an injected wallet, switches chain, and disconnects.
- Stock trading stays unavailable until a 0x quote for a real RHJ token returns `liquidityAvailable: true`. Vault deposits stay unavailable while `maxDeposit` is 0. See `docs/gates.md`.
