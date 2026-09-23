# Payrequest

USD-denominated payment requests settled as stablecoins on **Robinhood Chain** via [Across Protocol](https://docs.across.to/).

## Stack

- Next.js App Router + React 19
- Convex (database + backend functions)
- ZeroDev Kernel passkeys for Sandia accounts, ConnectKit for payer wallets, wagmi/viem for chain reads and sends
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

4. Set ZeroDev and Sandia auth in `.env.local`:

```bash
NEXT_PUBLIC_ZERODEV_PROJECT_ID=<zerodev-project-id>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<walletconnect-project-id>
SANDIA_JWT_PRIVATE_KEY=<pem>
SANDIA_JWT_PUBLIC_KEY=<pem>
SANDIA_JWT_ISS=http://localhost:3000
SANDIA_JWT_AUD=sandia
SANDIA_NONCE_SECRET=<secret>
```

Allow `http://localhost:3000` on the ZeroDev project. On Convex:

```bash
npx convex env set SANDIA_JWT_ISS http://localhost:3000
npx convex env set SANDIA_JWKS_URL http://localhost:3000/api/auth/sandia/jwks
npx convex env set SANDIA_JWT_AUD sandia
npx convex env set SANDIA_NONCE_SECRET <secret>
```

5. In another terminal:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product flow

1. Creator creates or signs in to a Sandia account with a passkey. The account is a ZeroDev Kernel on Robinhood Chain.
2. Create a request: USD amount, optional description and expiry. The recipient is that Kernel. The destination token is USDG on Robinhood Chain.
3. Share the public `/pay/{id}` URL.
4. Payer connects an injected wallet or WalletConnect through ConnectKit, selects an Across-supported source chain/token, reviews quote (input, fees, min received, ETA), approves if needed, and pays. Paying does not create a Sandia account.
5. The request is marked **completed** only after a deposit receipt matches the request and Across `/deposit` reports `filled` with destination chain 4663, the request token, the snapshotted recipient, an output amount at least as large as the request, and a fill transaction. `/deposit/status` is not used as proof. A minute cron keeps checking if the payer closes the tab.

## Notes

- Monetary values are stored as integer base units / USD micros — no floating-point arithmetic.
- Destination tokens are discovered live from `GET /swap/tokens?chainId=4663` filtered to `USDC|USDT|USDG`.
- The payer's browser also polls every 10 seconds. The server calls Across `GET /deposit` (or `/deposits`) with `ACROSS_API_KEY` on Convex, not a public env var.
- Register an Across integrator id and set Convex `ACROSS_INTEGRATOR_ID`.
- `/otc` redirects to `/requests/new`.
- App accounts use a ZeroDev Kernel (`mode: 4337`) on Robinhood Chain. The public pay page uses a separate wagmi config and ConnectKit, so a signed-in Kernel is not the payer.
- ConnectKit 1.9.2 does not peer React 19. `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` enables the QR path; an injected wallet can connect without it.
- Stock trading stays unavailable until a 0x quote for a real RHJ token returns `liquidityAvailable: true`. Vault deposits stay unavailable while `maxDeposit` is 0. See `docs/gates.md`.
