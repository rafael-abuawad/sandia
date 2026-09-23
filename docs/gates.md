# Release gates checked 23 Sep 2026

These calls were made from this workspace against public endpoints. They are not a completed mainnet payment.

## Steakhouse USDG vault

Address `0xBeEff033F34C046626B8D0A041844C5d1A5409dd` on chain 4663.

- Bytecode was present (21808 bytes).
- `asset()` returned `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (USDG).
- `totalAssets()` returned `493859497664019` base units.
- `maxDeposit` for `0x0000000000000000000000000000000000000001` returned `0`.

Deposit stays disabled. Withdraw and redeem are not submitted until a Sandia account receipt can be checked. The lending screen reads these values instead of a fixed APY or TVL.

## 0x stock quote

`GET https://api.0x.org/swap/allowance-holder/price` for chain 4663, selling 1 USDG for RHJ token CRM (`0xd95B44124e475743a7589e68F3D74008A5536D44`), without an API key, returned HTTP 401 `No API key found in request`.

No firm quote was returned, so buy and sell stay unavailable. A configured `ZEROX_API_KEY` still has to return `liquidityAvailable: true` before a stock ticket can submit. `XSTOCKS_NOT_AUTHORIZED` or `TOKEN_NOT_SUPPORTED` stops the feature.

## ConnectKit

`connectkit@1.9.2` is installed with a pnpm peer override for React 19 and wagmi 3. It is mounted only when `NEXT_PUBLIC_SANDIA_AUTH=zerodev`. The React 19 smoke test (open modal, connect an injected wallet, switch chain, disconnect) has not been run, so guest pay through that modal is not treated as accepted.

## ZeroDev sponsorship

No UserOperation was submitted. Gas sponsorship on Robinhood Chain is unverified. The send review says the account needs ETH unless a policy sponsors the batch.
