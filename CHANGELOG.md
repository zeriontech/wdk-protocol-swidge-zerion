# Changelog

## Unreleased

### Changed

- Errors follow the WDK taxonomy (`@tetherto/wdk-wallet` 1.0.0-beta.19): `ZerionApiError` extends `ProviderError`, `ZerionQuoteError` extends `SwidgeError` and carries a standard `reason`; invalid options throw `ValueError`, unknown tokens `InvalidTokenError`, fee-cap violations `MaximumFeeExceededError`. `ZerionError`, `ZerionCapabilityError` and `ZerionAllowanceError` were removed.
- Standard (EOA) accounts: `swidge()` sends a required approval itself and waits for it to confirm before sending the swap, instead of throwing `ZerionAllowanceError`. New `approvalPollIntervalMs` / `approvalTimeoutMs` configuration.
- Same-chain swidge ids are the transaction hash; cross-chain ids keep the `fromChain:toChain:hash` form. `getSwidgeStatus` throws `NoSuchElementError` when no transaction exists for the id.
- The legacy `swap` / `quoteSwap` / `bridge` / `quoteBridge` methods are inherited from `SwidgeProtocol` instead of being overridden.
- `getSupportedChains` resolves native token symbols through the API for chains without a built-in symbol.
- Added the `ZerionProtocol` named export and the `ISwidgeProtocol` re-export; WDK wallet modules are pinned under `dependencies`.

## 0.1.0

Initial release.

- `ZerionProtocol` implementing the WDK Swidge interface on the Zerion API (`GET /v1/swap/quotes/`): same-chain swaps and cross-chain bridges with best-route aggregation.
- `quoteSwidge` / `swidge` with EOA and ERC-4337 account support (atomic approval bundling for ERC-4337).
- `getSupportedChains` / `getSupportedTokens` driven by the Zerion chains and swap-fungibles endpoints.
- `getSwidgeStatus` via source-transaction receipts.
- Fee mapping (network / protocol / bridge) with `maxNetworkFeeBps` and `maxProtocolFeeBps` enforcement.
- Token references: ERC-20 addresses, Zerion fungible ids, and native sentinels (`'native'`, `0xeeee...eeee`).
