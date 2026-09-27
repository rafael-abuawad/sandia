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

_For documentation, please run `mox --help` or visit [the Moccasin documentation](https://cyfrin.github.io/moccasin)_
