# Release gates checked 6 Nov 2026

These checks ran from this workspace against public endpoints. They are not a completed mainnet payment.

## Verified

### Stellar account and fee flow (testnet)

A script ran the real flow end to end on Stellar testnet, with a test-issued asset standing in for USDC:

- Account setup with sponsored reserves succeeded for a new key holding 0 XLM: `beginSponsoringFutureReserves`, `createAccount` with a 0 starting balance, `changeTrust`, `endSponsoringFutureReserves`. The new key signed the raw transaction hash, the way Privy does. The account shows `num_sponsored: 3`, which is 1.5 XLM locked on the sponsor.
- A two-payment batch from that 0 XLM account succeeded when the sponsor fee-bumped it. The network charged 300 stroops.
- Without a fee-bump, the same account fails with `tx_insufficient_balance`.
- A payment to an account without a trustline fails with `tx_fee_bump_inner_failed`, `tx_failed`, and `op_no_trust`.
- Horizon finds the transaction by both its fee-bump hash and its inner hash.
- Muxed payments report `to` (the `G…` account) and `to_muxed` (the `M…` address).

### USDC on Stellar (mainnet)

Horizon reports `USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` with contract `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`. The asset is `auth_revocable`, so Circle can freeze a trustline. Clawback is off.

### NEAR Intents 1Click (mainnet)

`/v0/tokens` lists Stellar USDC by that issuer. Quotes for exactly 100 USDC to a real Stellar account with a trustline:

| Origin      | Input                       | Estimate |
| ----------- | --------------------------- | -------- |
| Base USDC   | 101.05 USDC, minimum 100.04 | 50 s     |
| Solana USDC | 101.05 USDC, minimum 100.04 | 35 s     |
| Base ETH    | 0.0453 ETH, minimum 0.0449  | 50 s     |

These include the 0.25% fee 1Click adds without a partner key. Input above what the route needs is refunded to `refundTo`. A quote to an account that doesn't exist returned an error, so recipients need to finish account setup first.

## Not verified

These need credentials or real funds, so they haven't run:

- **Privy raw signing with a Stellar wallet.** `useCreateWallet` and `useSignRawHash` follow Privy's docs, and the signature format is tested with local keys. Sign in once and confirm a wallet is created and signs.
- **A sponsored transaction on mainnet.** It needs a funded `STELLAR_SPONSOR_SECRET`.
- **A cross-chain payment settling.** Quotes are live, but no deposit has been sent.
- **Stellar Wallets Kit in a browser, with a real wallet.**

## Setup before launch

- **Privy:** in the Dashboard, enable Stellar for embedded wallets. Privy may require TEE execution under **Wallets → Advanced**. Privy's gas sponsorship doesn't cover Stellar, so Sandia pays fees itself.
- **Sponsor account:** create a Stellar account, fund it with XLM, and set `STELLAR_SPONSOR_SECRET` on Convex only. Each user locks 1.5 XLM in reserves. Keep the balance small and refill it, because a hot key can always be stolen.
- **NEAR Intents:** get a partner key from the [Partner Dashboard](https://partners.near-intents.org/home) and set `NEAR_INTENTS_API_KEY`, or 1Click adds 0.25% to every route.
- **Horizon:** set `NEXT_PUBLIC_STELLAR_HORIZON_URL` to an endpoint you control. The default is a public service with no guarantees.
