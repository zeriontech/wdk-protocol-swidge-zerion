# wdk-protocol-swidge-zerion

[![Built with WDK](https://raw.githubusercontent.com/tetherto/wdk-docs/refs/heads/main/public/assets/branding/wdk-badge-color-dark.svg)](https://docs.wdk.tether.io)

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.

A WDK Swidge protocol module that lets EVM wallet accounts swap and bridge tokens through the [Zerion API](https://developers.zerion.io). One integration covers same-chain swaps **and** cross-chain bridges: Zerion aggregates quotes from multiple DEX aggregators and bridge providers and returns the best executable route with ready-to-sign transactions.

| | |
|---|---|
| WDK interface | `SwidgeProtocol` / `ISwidgeProtocol` from `@tetherto/wdk-wallet/protocols` (also exposes the legacy `SwapProtocol` and `BridgeProtocol` methods) |
| WDK version | `@tetherto/wdk-wallet` `1.0.0-beta.19`, `@tetherto/wdk-wallet-evm` `1.0.0-beta.19`, `@tetherto/wdk-wallet-evm-erc-4337` `1.0.0-beta.20` |
| Runtimes | Node.js ≥ 20, Bare (`bare.js` entry) |
| Provider | [Zerion API](https://developers.zerion.io) — `GET /v1/swap/quotes/`, `/v1/chains/`, `/v1/fungibles/`, `/v1/swap/fungibles/` |
| Maintainer | [Zerion](https://zerion.io) — security reports: see [SECURITY.md](SECURITY.md) |

This module can be managed by the [`@tetherto/wdk`](https://github.com/tetherto/wdk) suite, which provides a unified interface for managing multiple WDK wallet and protocol modules across different blockchains.

## 🔍 About WDK

This module is part of the **WDK (Wallet Development Kit)** project, which enables developers to build secure, non-custodial wallets with unified blockchain access and complete user control.

For documentation on the complete WDK ecosystem, see https://docs.wdk.tether.io.

## 🌟 Features

- **Swap + Bridge in one module**: implements the WDK Swidge interface, so `swap`, `quoteSwap`, `bridge`, and `quoteBridge` all work out of the box
- **Best-route aggregation**: Zerion compares quotes across DEX aggregators and bridge providers and returns them best-first (by output after fees)
- **Ready-to-sign transactions**: no on-chain calldata construction in the client — the API returns the exact transaction, including approvals
- **Account Abstraction**: works with standard EVM wallets and ERC-4337 smart accounts; approvals are bundled atomically for ERC-4337 accounts
- **Auto-slippage**: when no slippage is configured, Zerion picks a value based on the pair's volatility and liquidity
- **Fee transparency and caps**: itemised network / protocol / bridge fees, with `maxNetworkFeeBps` and `maxProtocolFeeBps` enforcement
- **Data-driven token and chain discovery**: `getSupportedChains` and `getSupportedTokens` come straight from the Zerion API — no hardcoded lists
- **WDK-native errors**: every failure is a typed WDK error (`ValueError`, `InvalidTokenError`, `ProviderError`, `SwidgeError`, `MaximumFeeExceededError`, ...) so wallet apps handle it like any other WDK module
- **TypeScript definitions** and Bare runtime compatibility

## ⬇️ Installation

```bash
npm install wdk-protocol-swidge-zerion
```

The WDK wallet modules (`@tetherto/wdk-wallet`, `@tetherto/wdk-wallet-evm`, `@tetherto/wdk-wallet-evm-erc-4337`) are installed as pinned dependencies.

You will need a Zerion API key: create one at https://dashboard.zerion.io. Copy [`.env.example`](.env.example) to `.env` to run the demo and the examples locally.

## 🚀 Quick Start

### Same-chain swap

```javascript
import ZerionProtocol from 'wdk-protocol-swidge-zerion'
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm'

const seed = 'test only example nut use this real life secret phrase must random'

// Create EVM account (m/44'/60'/0'/0/0)
const account = new WalletAccountEvm(seed, "0'/0/0", {
  provider: 'https://ethereum-rpc.publicnode.com'
})

const zerion = new ZerionProtocol(account, {
  apiKey: 'YOUR_ZERION_API_KEY'
})

// Quote: 1 WETH -> USDC on the account's chain
const quote = await zerion.quoteSwidge({
  fromToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  toToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  fromTokenAmount: 10n ** 18n // 1 WETH (base units)
})

console.log(quote.toTokenAmount, quote.toTokenAmountMin, quote.fees)

// Execute
const result = await zerion.swidge({
  fromToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  toToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  fromTokenAmount: 10n ** 18n,
  slippage: 0.01 // 1%
})

console.log(result.hash)
```

### Cross-chain bridge

```javascript
// Bridge native ETH on Ethereum to USDC on Base
const result = await zerion.swidge({
  fromToken: 'native', // or 0xeeee...eeee, or the Zerion fungible id 'eth'
  toToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC address on the destination chain (or its Zerion fungible id)
  toChain: 'base', // Zerion chain id or EIP-155 chain id (8453)
  fromTokenAmount: 10n ** 17n // 0.1 ETH
})

// Track it: same-chain swaps report 'completed' once mined; bridges report
// 'pending' after the source transaction succeeds (see Status semantics below)
const status = await zerion.getSwidgeStatus(result.id)
```

### ERC-4337 smart account

```javascript
import ZerionProtocol from 'wdk-protocol-swidge-zerion'
import { WalletAccountEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'

const smart = new WalletAccountEvmErc4337(seed, "0'/0/0", {
  chainId: 8453,
  provider: 'https://mainnet.base.org',
  bundlerUrl: 'YOUR_BUNDLER_URL',
  paymasterUrl: 'YOUR_PAYMASTER_URL'
})

const zerion4337 = new ZerionProtocol(smart, {
  apiKey: 'YOUR_ZERION_API_KEY'
})

// Approvals are bundled with the swap in a single user operation
const result = await zerion4337.swidge({
  fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC on Base
  toToken: 'native',
  fromTokenAmount: 25_000_000n // 25 USDC
}, {
  paymasterToken: 'USDT' // optional: pay gas with a token
})
```

### Discovery (no account needed)

```javascript
const zerion = new ZerionProtocol(undefined, { apiKey: 'YOUR_ZERION_API_KEY' })

const chains = await zerion.getSupportedChains()
const tokens = await zerion.getSupportedTokens({ fromChain: 'ethereum', toChain: 'base' })
```

### Classic swap / bridge interfaces

Because this module implements the WDK Swidge interface, the standalone interfaces also work:

```javascript
// SwapProtocol interface
const swapResult = await zerion.swap({
  tokenIn: '0xTokenIn',
  tokenOut: '0xTokenOut',
  tokenInAmount: 1_000_000n
})

// BridgeProtocol interface
const bridgeResult = await zerion.bridge({
  token: 'eth',
  targetChain: 'base',
  amount: 10n ** 17n
})
```

## 📚 API Reference

### ZerionProtocol

Main class implementing the WDK Swidge protocol on the Zerion API.

#### Constructor

```javascript
new ZerionProtocol(account, config)
```

Parameters:

- `account` (`WalletAccountEvm | WalletAccountEvmErc4337 | WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337 | undefined`): the wallet account, or `undefined` for a discovery-only instance
- `config` (object):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — (required) | Your Zerion API key, sent as HTTP Basic auth |
| `slippagePercent` | `number` | Zerion auto-slippage | Default slippage in percent (e.g. `1` for 1%) when a request does not set `slippage` |
| `maxNetworkFeeBps` | `number \| bigint` | unlimited | Maximum network fee, in basis points of the input amount |
| `maxProtocolFeeBps` | `number \| bigint` | unlimited | Maximum protocol + bridge fees, in basis points of the input amount |
| `currency` | `string` | `'usd'` | Currency for fiat values in quotes |
| `approvalPollIntervalMs` | `number` | `3000` | How often a standard account polls for its approval transaction receipt |
| `approvalTimeoutMs` | `number` | `180000` | How long a standard account waits for its approval transaction before failing |
| `baseUrl` | `string` | `'https://api.zerion.io'` | Zerion API base url |
| `timeoutMs` | `number` | `30000` | Per-request timeout |
| `maxRetries` | `number` | `2` | Retries for `408`, `429`, `5xx` and network failures (exponential backoff, honours `Retry-After`) |
| `retryDelayMs` | `number` | `400` | Base retry delay |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |
| `client` | `ZerionApiClient` | — | Pre-configured API client (overrides the transport options above) |

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `quoteSwidge(options)` | Quotes a swap or bridge | `Promise<SwidgeQuote>` |
| `swidge(options, config?)` | Executes a swap or bridge | `Promise<SwidgeResult>` |
| `getSwidgeStatus(id, options?)` | Tracks an executed swidge | `Promise<SwidgeStatusResult>` |
| `getSupportedChains()` | Chains with Zerion trading support | `Promise<SwidgeSupportedChain[]>` |
| `getSupportedTokens(options?)` | Tokens available for a route | `Promise<SwidgeSupportedToken[]>` |
| `swap(options)` / `quoteSwap(options)` | SwapProtocol interface (delegates to swidge) | `Promise<SwapResult>` |
| `bridge(options)` / `quoteBridge(options)` | BridgeProtocol interface (delegates to swidge) | `Promise<BridgeResult>` |

#### Swidge options

- `fromToken` (string): ERC-20 address, Zerion fungible id (a short alphanumeric id like `'eth'` or a uuid — discover them via `getSupportedTokens`), or a native sentinel (`'native'` / `0xeeee...eeee`)
- `toToken` (string): same formats as `fromToken`, resolved on the destination chain
- `toChain` (string | number, optional): Zerion chain id (`'base'`) or EIP-155 id (`8453`); defaults to the source chain
- `fromTokenAmount` (bigint | number): exact input amount in base units (**exact-input only** — `toTokenAmount` is not supported by the Zerion API)
- `recipient` (string, optional): output receiver; defaults to the account address (required for Solana destinations)
- `slippage` (number, optional): decimal slippage (e.g. `0.01` for 1%)
- `minAmountOut` (bigint | number, optional): abort if the quoted minimum output is below this value
- `refundAddress` (string, optional): Zerion routes always refund the sending wallet, so only the account's own address is accepted; any other value throws `ValueError`
- `toTokenAmount`: **not supported** — the Zerion API is exact-input only, exact-output requests throw `ValueError`

#### Status mapping

`swidge()` returns `id` as the source transaction hash for same-chain swaps, and as `fromChain:toChain:hash` for cross-chain bridges. `getSwidgeStatus(id)` reads the source transaction through the account's provider (the account must be on the source chain) and maps it to the WDK `SwidgeStatus` values:

| WDK status | Emitted when | Notes |
|------------|--------------|-------|
| `pending` | The source transaction is known but not yet mined, **or** a cross-chain source transaction succeeded | Destination settlement is executed by the routed bridge provider (typically within the quote's `estimatedDuration`) and is not yet tracked by the Zerion API |
| `completed` | A same-chain swap's transaction succeeded | |
| `failed` | The source transaction reverted | |
| `action-required` | never | Approvals are executed by the module, no user action is pending |
| `refund-pending`, `refunded` | never | Bridge refunds go to the sending wallet and are not exposed by the Zerion API yet |
| `cancelled`, `expired` | never | Quotes are executed immediately; there is no order book |
| `partial` | never | Routes fill atomically |

Unknown or malformed ids throw `ValueError`; an id whose transaction does not exist throws `NoSuchElementError`.

#### Fee mapping

Quotes and results carry an itemised `fees` array. Each Zerion fee block maps to a WDK `SwidgeFee` type, and the legacy `swap` / `bridge` methods aggregate them as follows:

| Zerion field | `SwidgeFee.type` | `SwidgeFee.token` | `included` | Legacy `swap`/`quoteSwap` | Legacy `bridge`/`quoteBridge` |
|--------------|------------------|-------------------|------------|---------------------------|-------------------------------|
| Wallet estimate (`account.quoteSendTransaction`); after execution, the wallet's fee quote for each transaction sent | `network` | Source-chain native token | `false` | summed into `fee` | `fee` |
| `protocol_fee` (Zerion) | `protocol` | The fee's `fungible` | `included_in_rate` | summed into `fee` | `bridgeFee` |
| `bridge_fee` (routed bridge provider) | `protocol` | The fee's `fungible` | `included_in_rate` | summed into `fee` | `bridgeFee` |
| — | `affiliate`, `other` | | | not emitted | not emitted |

Fee amounts are in base units of `SwidgeFee.token`. Zero fees reported by the API without a denomination (e.g. a waived protocol fee) are omitted. `maxNetworkFeeBps` applies to the `network` fee, `maxProtocolFeeBps` to the sum of `protocol` fees, both expressed in basis points of the input amount's fiat value; a cap fails closed (`MaximumFeeExceededError`) when the quote lacks the fiat data needed to verify it.

#### Approvals

When the input token is not yet approved, the approval transaction returned by the API is executed as part of `swidge()`:

- **ERC-4337 accounts**: the approval is bundled atomically with the swap in a single user operation.
- **Standard accounts**: the approval is sent first and awaited (`approvalPollIntervalMs` / `approvalTimeoutMs`), then the swap is sent. Both transactions are listed in the result's `transactions` array (`type: 'approval'` and `type: 'source'`), and the reported network fee is the sum of the wallet's fee quotes for the transactions that were sent (WDK's `sendTransaction` reports its pre-broadcast estimate).
- API-provided swap and approval transactions are checked for the expected sender, source chain, token, spender, and amount before they are quoted or signed.

### Errors

The module throws the standard WDK error types exported by `@tetherto/wdk-wallet/protocols`, plus two Zerion-specific subclasses:

| Error | Extends | When |
|-------|---------|------|
| `ValueError` | `WdkError` | Invalid options: exact-output requests, non-positive or unsafe amounts, invalid slippage, unknown chains, a distinct `refundAddress`, malformed swidge ids |
| `InvalidTokenError` | `WdkError` | A token is unknown to Zerion or has no implementation on the requested chain |
| `ReadOnlyAccountRequiredError` / `AccountRequiredError` | `WdkError` | Quoting without an account / executing with a read-only account |
| `ProviderRequiredError` | `WdkError` | The account is not connected to a provider |
| `ZerionApiError` | `ProviderError` | The Zerion API cannot be reached, rejects the request, or returns an invalid payload (`code`, `status`, `details`) |
| `ProviderError` | `WdkError` | The account's provider cannot report its network, a receipt or transaction lookup fails, wallet estimation or broadcasting fails, or a standard-account approval reverted or timed out (`reason`) |
| `ZerionQuoteError` | `SwidgeError` | No executable route, or the quoted minimum output is below `minAmountOut` (`reason`, `code`, `hint`) |
| `MaximumFeeExceededError` | `WdkError` | A configured fee cap is exceeded, or cannot be verified from the quote |
| `NoSuchElementError` | `WdkError` | `getSwidgeStatus` finds no transaction for the id |

Through the legacy `swap()` / `bridge()` interfaces, a `ZerionQuoteError` surfaces as `SwapError` / `BridgeError` with the same `reason`.

## 🌐 Supported Networks

All EVM chains where Zerion supports trading (Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Avalanche, and more — see `getSupportedChains()`), with bridging between them. Solana is currently supported as a bridge **destination**; Solana-native accounts are not yet supported as a source.

**Testnets**: the Zerion swap API serves mainnets only and has no testnet mode. For integration testing, quote freely (quotes are read-only and never move funds) and execute small amounts on a low-fee chain such as Base.

## 🔒 Security Considerations

Vulnerabilities: please follow the process in [SECURITY.md](SECURITY.md) (private report to security@zerion.io).

### Data flow and telemetry

- **What leaves the device**: quote requests to `api.zerion.io` contain the wallet address, the recipient, the token identifiers, the input amount and the slippage, authenticated with your API key. Chain and token discovery requests contain only chain ids and token identifiers.
- **What never leaves the device**: seed phrases, private keys and signatures. Transactions returned by the API are validated, then signed and broadcast by the WDK wallet account through the RPC provider you configured — the module never talks to a node itself.
- **Telemetry**: the module collects no analytics and sends no data anywhere other than the Zerion API. API usage is visible to Zerion under your API key, as with any Zerion API integration.

### Recommendations

- **Seed phrase security**: keep your seed phrase safe and never share it
- **API key**: treat your Zerion API key as a secret; do not ship it in client-side code you don't control
- **Quote first**: call `quoteSwidge` before `swidge` and inspect amounts and fees
- **Slippage**: set an explicit `slippage` or rely on Zerion's auto-slippage; `minAmountOut` adds a hard floor
- **Fee caps**: use `maxNetworkFeeBps` / `maxProtocolFeeBps` to bound costs programmatically. Network fees come from `account.quoteSendTransaction()` for the exact wallet transaction; a configured cap fails closed if the provider omits the fiat data needed to verify it.

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint

# Build TypeScript definitions
npm run build:types

# Coverage report
npm run test:coverage
```

### Example

[`examples/quote.js`](examples/quote.js) quotes a same-chain swap and a cross-chain bridge as a read-only wallet:

```bash
ZERION_API_KEY=... node examples/quote.js
```

### Interactive demo

Copy `.env.example` to `.env` and fill in `ZERION_API_KEY` (the file is gitignored), then:

```bash
# Read-only quote as any wallet — no keys, nothing signed.
# --sell/--buy accept symbols (eth, weth, usdc, usdt, usdt0, dai, wbtc),
# token addresses, or Zerion fungible ids; --wallet accepts ENS names.
npm run demo -- quote --wallet vitalik.eth --sell eth --buy usdc --amount 0.1 --chain ethereum

# Cross-chain bridge quote
npm run demo -- quote --sell eth --buy usdc --amount 0.1 --chain ethereum --to-chain base

# Execute for real from a TEST wallet: add SEED=<bip39 phrase> to .env.
# Shows the quote first and asks you to type 'swap' before broadcasting.
npm run demo -- execute --sell native --buy usdc --amount 0.01 --chain base

# Track an executed swidge
npm run demo -- status <swidge-id> --chain base

# Discover supported chains and route tokens
npm run demo -- chains
npm run demo -- tokens --chain ethereum --to-chain base
```

## 📜 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🆘 Support

For support, please open an issue on the GitHub repository. For Zerion API questions, contact api@zerion.io.
