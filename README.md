# Payrequest

USD-denominated payment requests settled as stablecoins on **Robinhood Chain** via [Across Protocol](https://docs.across.to/).

## Stack

- Next.js App Router + React 19
- Convex (database + backend functions)
- Privy for Sandia accounts (email OTP and an embedded wallet) and for payer wallet connection, wagmi/viem for chain reads and sends
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

4. Set Privy and wallet-claim secrets in `.env.local`:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=<privy-app-id>
SANDIA_NONCE_SECRET=<secret>
```

Create a Privy app with email OTP and wallets enabled. Allow `http://localhost:3000`. On Convex:

```bash
npx convex env set PRIVY_APP_ID <same-as-NEXT_PUBLIC_PRIVY_APP_ID>
npx convex env set SANDIA_NONCE_SECRET <secret>
```

5. In another terminal:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product flow

1. Creator signs in with email+OTP. Privy creates an embedded wallet, and that wallet is claimed automatically so they can create requests and send.
2. Create a request: USD amount, optional description and expiry. The recipient is that wallet. The destination token is USDG on Robinhood Chain.
3. Share the public `/pay/{id}` URL.
4. Payer connects an external wallet through Privy, selects an Across-supported source chain/token, reviews quote (input, fees, min received, ETA), approves if needed, and pays. Paying does not create a Sandia account.
5. The request is marked **completed** only after a deposit receipt matches the request and Across `/deposit` reports `filled` with destination chain 4663, the request token, the snapshotted recipient, an output amount at least as large as the request, and a fill transaction. `/deposit/status` is not used as proof. A minute cron keeps checking if the payer closes the tab.

## Notes

- Monetary values are stored as integer base units / USD micros — no floating-point arithmetic.
- Destination tokens are discovered live from `GET /swap/tokens?chainId=4663` filtered to `USDC|USDT|USDG`.
- The payer's browser also polls every 10 seconds. The server calls Across `GET /deposit` (or `/deposits`) with `ACROSS_API_KEY` on Convex, not a public env var.
- Register an Across integrator id and set Convex `ACROSS_INTEGRATOR_ID`.
- `/otc` redirects to `/requests/new`.
- App accounts use the Privy embedded wallet on Robinhood Chain. The public pay page uses the same Privy wagmi provider and connects an external wallet for payment, so paying does not claim a Sandia account. WalletConnect for payers is the connector enabled in the Privy dashboard.
- Outbound USDG sends are ordinary ERC-20 transfers. The wallet needs ETH on Robinhood Chain for gas.
- Stock trading stays unavailable until a 0x quote for a real RHJ token returns `liquidityAvailable: true`. Vault deposits stay unavailable while `maxDeposit` is 0. See `docs/gates.md`.
