# wdk-protocol-swidge-zerion

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.

A WDK Swidge protocol module that lets EVM wallet accounts swap and bridge tokens through the [Zerion API](https://developers.zerion.io). One integration covers same-chain swaps **and** cross-chain bridges: Zerion aggregates quotes from multiple DEX aggregators and bridge providers and returns the best executable route with ready-to-sign transactions.

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
- **TypeScript definitions** and Bare runtime compatibility

## ⬇️ Installation

```bash
npm install wdk-protocol-swidge-zerion
```

You will need a Zerion API key: create one at https://dashboard.zerion.io.

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
  - `apiKey` (string, required): your Zerion API key
  - `slippagePercent` (number, optional): default slippage in percent (e.g. `1` for 1%); when omitted, Zerion auto-selects
  - `maxNetworkFeeBps` (number | bigint, optional): maximum network fee, in basis points of the input amount
  - `maxProtocolFeeBps` (number | bigint, optional): maximum protocol + bridge fees, in basis points of the input amount
  - `currency` (string, optional): currency for fiat values in quotes (default `usd`)
  - `baseUrl`, `timeoutMs`, `maxRetries`, `fetch`, `client` (optional): transport overrides

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

#### Status semantics

`swidge()` returns `id` in the form `fromChain:toChain:hash`. `getSwidgeStatus(id)`:

- reads the source transaction receipt through the account's provider
- same-chain swaps: `pending` → `completed` / `failed`
- cross-chain bridges: reports `pending` after the source transaction succeeds — destination settlement is executed by the routed bridge provider (typically within the quote's `estimatedDuration`) and is not yet tracked by the Zerion API

#### Approvals

- **ERC-4337 accounts**: when the API returns an approval transaction, it is bundled atomically with the swap in a single user operation — no prior approval needed.
- **Standard accounts**: the input token must be approved beforehand. If an approval is missing, `swidge()` throws a `ZerionAllowanceError` whose `details.transaction` contains the ready-to-send approve transaction; send it (or use the account's `approve` method), then retry.

### Errors

All errors extend `ZerionError` (`code`, `message`, `details`):

- `ZerionApiError` — HTTP failure from the Zerion API (includes `status`)
- `ZerionQuoteError` — no executable route for the requested pair
- `ZerionCapabilityError` — unsupported operation (exact-out, unknown chain, distinct refund address, ...)
- `ZerionAllowanceError` — missing ERC-20 approval (standard accounts only)

## 🌐 Supported Networks

All EVM chains where Zerion supports trading (Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Avalanche, and more — see `getSupportedChains()`), with bridging between them. Solana is currently supported as a bridge **destination**; Solana-native accounts are not yet supported as a source.

## 🔒 Security Considerations

- **Seed phrase security**: keep your seed phrase safe and never share it
- **API key**: treat your Zerion API key as a secret; do not ship it in client-side code you don't control
- **Quote first**: call `quoteSwidge` before `swidge` and inspect amounts and fees
- **Slippage**: set an explicit `slippage` or rely on Zerion's auto-slippage; `minAmountOut` adds a hard floor
- **Fee caps**: use `maxNetworkFeeBps` / `maxProtocolFeeBps` to bound costs programmatically

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
```

### Interactive demo

Put `ZERION_API_KEY=...` in a `.env` file in the repo root (gitignored), then:

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
