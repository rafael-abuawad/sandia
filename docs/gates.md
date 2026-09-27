# Release gates checked 23 Sep 2026

These calls were made from this workspace against public endpoints. They are not a completed mainnet payment.

## Steakhouse USDG vault

Address `0xBeEff033F34C046626B8D0A041844C5d1A5409dd` on chain 4663.

- Bytecode was present (21808 bytes).
- `asset()` returned `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (USDG).
- `totalAssets()` returned `493859497664019` base units.
- `maxDeposit` for `0x0000000000000000000000000000000000000001` returned `0`.

Morpho Vault V2 always returns 0 from `maxDeposit`, `maxWithdraw`, and `maxRedeem`. That is not a closed vault. Earn submits `deposit`, `withdraw`, and `redeem`, then checks the receipt for a `Deposit` or `Withdraw` log. The lending screen reads APY, deposits, and liquidity from the vault snapshot.

## 0x stock quote

`GET https://api.0x.org/swap/allowance-holder/price` for chain 4663, selling 1 USDG for RHJ token CRM (`0xd95B44124e475743a7589e68F3D74008A5536D44`), without an API key, returned HTTP 401 `No API key found in request`.

No firm quote was returned, so buy and sell stay unavailable. A configured `ZEROX_API_KEY` still has to return `liquidityAvailable: true` before a stock ticket can submit. `XSTOCKS_NOT_AUTHORIZED` or `TOKEN_NOT_SUPPORTED` stops the feature.

## Payer wallet

Payers connect an external wallet on `/pay/[publicId]` through Privy’s `connectWallet`. That uses the same `@privy-io/wagmi` provider as the app. Sandia accounts sign in with email and use the Privy embedded wallet. Paying does not run the Convex wallet claim.

Opening the connect modal, connecting an injected wallet, switching chain, and paying still needs a browser with a wallet extension and a live Convex request.

## Privy outbound send

Outbound USDG sends use Privy's sponsored embedded-wallet transactions on Robinhood Chain. Privy uses a paymaster for gas, so the signed-in wallet does not need ETH. Both steps of a batch send (USDG approval and Sandia Send) request sponsorship. Live sending still requires fee sponsorship and Robinhood Chain to be enabled in the Privy Dashboard, billing configured, client-initiated sponsored transactions allowed, and TEE wallet execution. A live sponsored send and receipt have not been verified from this workspace.
