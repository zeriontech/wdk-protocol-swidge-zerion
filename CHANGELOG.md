# Changelog

## 0.1.0

Initial release.

- `ZerionProtocol` implementing the WDK Swidge interface on the Zerion API (`GET /v1/swap/quotes/`): same-chain swaps and cross-chain bridges with best-route aggregation.
- `quoteSwidge` / `swidge` with EOA and ERC-4337 account support (atomic approval bundling for ERC-4337).
- `getSupportedChains` / `getSupportedTokens` driven by the Zerion chains and swap-fungibles endpoints.
- `getSwidgeStatus` via source-transaction receipts.
- Fee mapping (network / protocol / bridge) with `maxNetworkFeeBps` and `maxProtocolFeeBps` enforcement.
- Token references: ERC-20 addresses, Zerion fungible ids, and native sentinels (`'native'`, `0xeeee...eeee`).
