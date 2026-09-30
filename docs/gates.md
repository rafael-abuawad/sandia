# Release gates checked 23 Sep 2026

These calls were made from this workspace against public endpoints. They are not a completed mainnet payment.

## Steakhouse USDG vault

Address `0xBeEff033F34C046626B8D0A041844C5d1A5409dd` on chain 4663.

- Bytecode was present (21808 bytes).
- `asset()` returned `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (USDG).
- `totalAssets()` returned `493859497664019` base units.
- `maxDeposit` for `0x0000000000000000000000000000000000000001` returned `0`.

Morpho Vault V2 always returns 0 from `maxDeposit`, `maxWithdraw`, and `maxRedeem`. That is not a closed vault. Earn submits `deposit`, `withdraw`, and `redeem`, then checks the receipt for a `Deposit` or `Withdraw` log. The lending screen reads APY, deposits, and liquidity from the vault snapshot.

## Stock trading

Buy and sell on the stock ticket quote the selected asset against USDG on Robinhood Chain (4663). The app checks Uniswap v3 fee tiers 500 and 3000 and the v2 pair reserves, keeps the best amount, and protects it by 1%. Swap calldata is built in the app and submitted only to SwapRouter02 (`0xCaf681a66D020601342297493863E78C959E5cb2`). The sell token is approved to that router for the quoted amount when the allowance is short. Stock tickets do not call 0x.

ETH on this screen is wrapped ETH (`0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`). A buy delivers WETH. HOOD is the Robinhood Markets token at `0x274C8C4665c0343730C78B184e560F902A8Bf200`. The ETH → USDG payment path still uses 0x and is separate from these tickets.

## Payer wallet

Payers connect an external wallet on `/pay/[publicId]` through Privy’s `connectWallet`. That uses the same `@privy-io/wagmi` provider as the app. Sandia accounts sign in with email and use the Privy embedded wallet. Paying does not run the Convex wallet claim.

Opening the connect modal, connecting an injected wallet, switching chain, and paying still needs a browser with a wallet extension and a live Convex request.

## Privy outbound send

Outbound USDG sends use Privy's sponsored embedded-wallet transactions on Robinhood Chain (chain id 4663). Privy uses a paymaster for gas, so the signed-in wallet does not need ETH. Both steps of a batch send (USDG approval and Sandia Send) request sponsorship through the React SDK (`sponsor: true`), which authenticates with the signed-in Privy session. The app secret is not sent to the browser.

Live sending still requires, in the Privy Dashboard for the same app as `NEXT_PUBLIC_PRIVY_APP_ID`:

- An app secret under **Configuration → App settings → Basics**. Store it only as Convex `PRIVY_APP_SECRET`. Never as `NEXT_PUBLIC_`. The app does not read it yet. Regenerating it invalidates the previous secret.
- TEE wallet execution under **Wallets → Advanced**. Leave automatic migration enabled.
- **Fee sponsorship → Sponsor gas fees** (App pays). User pays does not include Robinhood Chain.
- Robinhood Chain in supported chains, client-initiated sponsored transactions allowed, and a spend cap.
- Credits and a payment method under **Billing → Fee sponsorship**.

A live sponsored send and receipt have not been verified from this workspace.
