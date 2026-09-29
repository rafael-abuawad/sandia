# Sandia Send

Batch ERC-20 pulls. The caller approves this contract, then `sandia_send` pays up to 128 recipients in one transaction.

## Quickstart

1. Deploy to a local network that titanoboa spins up:

```bash
mox run deploy
```

2. Run tests:

```bash
mox test
```

Robinhood Chain (chain id 4663) is configured as `robinhood` in `moccasin.toml`.

## Verify an existing deployment

Verification uses the [Blockscout Pro API](https://dev.blockscout.com). Keys from that site start with `proapi_`. The explorer website at `robinhoodchain.blockscout.com` answers script requests with a Cloudflare challenge, so a key created there is not what this script sends.

Add the Pro key to `core/.env` (that file stays untracked):

```bash
BLOCKSCOUT_API_KEY=<blockscout-pro-api-key>
```

`moccasin.toml` reads it as `explorer_api_key`. Verify the contract already on Robinhood without deploying again:

```bash
mox run verify --network robinhood
```

_For documentation, please run `mox --help` or visit [the Moccasin documentation](https://cyfrin.github.io/moccasin)_
