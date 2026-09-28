# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `ZerionProtocol` named export, `ISwidgeProtocol` re-export and the `toSwidgeErrorReason` helper.
- `approvalPollIntervalMs` / `approvalTimeoutMs` configuration for standard-account approvals.
- `.env.example`, a runnable read-only example in `examples/quote.js`, and coverage reporting (`npm run test:coverage`).
- README sections documenting the WDK status and fee mappings, configuration defaults, the supported interface version, and the module's data flow.

### Changed

- Built against `@tetherto/wdk-wallet` 1.0.0-beta.20; the README badge follows the reader's colour scheme.
- Errors follow the WDK taxonomy: `ZerionApiError` extends `ProviderError`, `ZerionQuoteError` extends `SwidgeError` and carries a standard `reason`; invalid options throw `ValueError`, unknown tokens `InvalidTokenError`, fee-cap violations `MaximumFeeExceededError`.
- Standard (EOA) accounts: `swidge()` sends a required approval itself and waits for it to confirm before sending the swap, instead of throwing `ZerionAllowanceError`.
- Same-chain swidge ids are the transaction hash; cross-chain ids keep the `fromChain:toChain:hash` form. `getSwidgeStatus` throws `NoSuchElementError` when no transaction exists for the id.
- The legacy `swap` / `quoteSwap` / `bridge` / `quoteBridge` methods are inherited from `SwidgeProtocol` instead of being overridden.
- `getSupportedChains` resolves native token symbols through the API for chains without a built-in symbol.
- The WDK wallet modules are pinned under `dependencies`.

### Removed

- `ZerionError`, `ZerionCapabilityError` and `ZerionAllowanceError`.

### Fixed

- Waived protocol fees, which the API reports without a denomination or fiat value, no longer reject quotes or fail fee-cap checks.
- Receipt and transaction lookups, approval polling and broadcasting surface provider failures as `ProviderError`; unknown swidge ids throw the module's `NoSuchElementError` even when the wallet packages carry their own copy of `@tetherto/wdk-wallet`.

### Security

- Refreshed the development dependency tree (`npm audit fix`) so a fresh install reports no known vulnerabilities.

## [0.1.0] - 2026-07-21

### Added

- `ZerionProtocol` implementing the WDK Swidge interface on the Zerion API (`GET /v1/swap/quotes/`): same-chain swaps and cross-chain bridges with best-route aggregation.
- `quoteSwidge` / `swidge` with EOA and ERC-4337 account support (atomic approval bundling for ERC-4337).
- `getSupportedChains` / `getSupportedTokens` driven by the Zerion chains and swap-fungibles endpoints.
- `getSwidgeStatus` via source-transaction receipts.
- Fee mapping (network / protocol / bridge) with `maxNetworkFeeBps` and `maxProtocolFeeBps` enforcement.
- Token references: ERC-20 addresses, Zerion fungible ids, and native sentinels (`'native'`, `0xeeee...eeee`).
