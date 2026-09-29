# Sandia

USD-denominated payment requests settled as stablecoins on **Robinhood Chain** via [Across Protocol](https://docs.across.to/).

## Stack

- Next.js App Router + React 19
- Convex (database + backend functions)
- Privy for Sandia accounts (email OTP and an embedded wallet) and for payer wallet connection, wagmi/viem for chain reads and sends
- Across Swap API for quotes, approvals, bridging, and deposit tracking

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

Batch sends also need the deployed Sandia Send address in `.env.local`:

```bash
NEXT_PUBLIC_SANDIA_SEND_ADDRESS=<sandia-send-address>
```

A single recipient still transfers USDG directly. Two or more recipients approve that contract, then call `sandia_send`.

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
- Outbound USDG sends use Privy's embedded-wallet gas sponsorship on Robinhood Chain, so the sender does not need ETH. In the Privy Dashboard, enable **Fee sponsorship → Sponsor gas fees**, add Robinhood Chain to supported chains, fund billing, and allow client-initiated sponsored transactions. Privy requires TEE wallet execution for native sponsorship. Set spending caps before enabling this in production. Batch sends sponsor both the USDG approval and the Sandia Send call.
- Stock trading stays unavailable until a 0x quote for a real RHJ token returns `liquidityAvailable: true`. Vault deposits stay unavailable while `maxDeposit` is 0. See `docs/gates.md`.
