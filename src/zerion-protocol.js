// Copyright 2026 Zerion
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { SwidgeProtocol } from '@tetherto/wdk-wallet/protocols'

import { ZerionApiClient } from './zerion-api-client.js'
import { toBaseUnits, fromBaseUnits } from './amounts.js'
import { ZerionError, ZerionQuoteError, ZerionCapabilityError, ZerionAllowanceError } from './errors.js'

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeProtocolConfig} SwidgeProtocolConfig */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeOptions} SwidgeOptions */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeQuote} SwidgeQuote */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeResult} SwidgeResult */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeFee} SwidgeFee */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeStatusOptions} SwidgeStatusOptions */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeStatusResult} SwidgeStatusResult */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedChain} SwidgeSupportedChain */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedToken} SwidgeSupportedToken */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedTokensOptions} SwidgeSupportedTokensOptions */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwapOptions} SwapOptions */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwapResult} SwapResult */
/** @typedef {import('@tetherto/wdk-wallet/protocols').BridgeOptions} BridgeOptions */
/** @typedef {import('@tetherto/wdk-wallet/protocols').BridgeResult} BridgeResult */

/**
 * @typedef {Object} ZerionProtocolSpecificConfig
 * @property {string} [apiKey] - The Zerion API key (from https://dashboard.zerion.io). Required unless a custom client is provided.
 * @property {string} [baseUrl] - The Zerion API base url. Defaults to 'https://api.zerion.io'.
 * @property {number} [slippagePercent] - Default maximum acceptable slippage in percent (e.g. 1 for 1%).
 *   When omitted, Zerion picks an auto-slippage value based on the pair's volatility and liquidity.
 * @property {string} [currency] - Currency for fiat values in quotes. Defaults to 'usd'.
 * @property {number} [timeoutMs] - Per-request timeout in milliseconds.
 * @property {number} [maxRetries] - Maximum number of retries for retryable API failures.
 * @property {number} [retryDelayMs] - Base delay between retries in milliseconds.
 * @property {typeof fetch} [fetch] - Custom fetch implementation.
 * @property {ZerionApiClient} [client] - Custom pre-configured Zerion API client.
 */

/**
 * @typedef {SwidgeProtocolConfig & ZerionProtocolSpecificConfig} ZerionProtocolConfig
 */

/**
 * @typedef {Object} ZerionSwidgeOptionsExtension
 * @property {number | bigint} [minAmountOut] - Abort execution when the quoted minimum output is below this base-unit amount.
 */

/**
 * @typedef {SwidgeOptions & ZerionSwidgeOptionsExtension} ZerionSwidgeOptions
 */

/** @typedef {SwidgeStatusOptions} ZerionSwidgeStatusOptions */
/** @typedef {SwidgeStatusResult} ZerionSwidgeStatusResult */
/** @typedef {SwidgeSupportedChain} ZerionSwidgeSupportedChain */
/** @typedef {SwidgeSupportedToken} ZerionSwidgeSupportedToken */
/** @typedef {SwidgeSupportedTokensOptions} ZerionSwidgeSupportedTokensOptions */

/**
 * @typedef {Object} ZerionChain
 * @property {string} id - The Zerion chain id (e.g. 'ethereum', 'base').
 * @property {string | undefined} externalId - The EIP-155 chain id in hex (e.g. '0x1'), when applicable.
 * @property {string} name - The human-readable chain name.
 * @property {Object} flags - Chain capability flags (e.g. supports_trading, supports_bridge).
 */

/**
 * @typedef {Object} ZerionToken
 * @property {string} fungibleId - The Zerion fungible id to use in swap requests.
 * @property {string} symbol - The token symbol.
 * @property {number} decimals - The token's number of decimal places on the resolved chain.
 * @property {string | null} address - The token contract address, or null for native assets.
 */

const NATIVE_TOKEN_SENTINELS = new Set([
  'native',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
])

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const EVM_DATA_PATTERN = /^0x(?:[0-9a-fA-F]{2})*$/
const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/
const ERC20_APPROVE_SELECTOR = '095ea7b3'

// Display-only metadata for getSupportedChains; not used in swap execution.
const NATIVE_TOKEN_SYMBOLS = Object.freeze({
  arbitrum: 'ETH',
  aurora: 'ETH',
  avalanche: 'AVAX',
  base: 'ETH',
  'binance-smart-chain': 'BNB',
  blast: 'ETH',
  celo: 'CELO',
  ethereum: 'ETH',
  fantom: 'FTM',
  linea: 'ETH',
  mantle: 'MNT',
  optimism: 'ETH',
  polygon: 'POL',
  scroll: 'ETH',
  solana: 'SOL',
  xdai: 'XDAI',
  'zksync-era': 'ETH',
  zora: 'ETH'
})

function toEvmTransaction (evm) {
  return {
    to: evm.to,
    value: BigInt(evm.value ?? 0),
    data: evm.data
  }
}

function toBaseUnitAmount (value, optionName) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
    throw new ZerionError('invalid_options', `The '${optionName}' option must be a non-negative safe integer or bigint.`)
  }

  if (typeof value !== 'number' && typeof value !== 'bigint') {
    throw new ZerionError('invalid_options', `The '${optionName}' option must be a non-negative safe integer or bigint.`)
  }

  return BigInt(value)
}

function normalizeFeeCap (value, name) {
  const valid = typeof value === 'bigint'
    ? value >= 0n
    : typeof value === 'number' && Number.isFinite(value) && value >= 0

  if (!valid) {
    throw new ZerionError('invalid_config', `'${name}' must be a finite, non-negative number or bigint.`)
  }

  return typeof value === 'bigint' && value > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.POSITIVE_INFINITY
    : Number(value)
}

export default class ZerionProtocol extends SwidgeProtocol {
  /**
   * Creates a discovery-only interface to the Zerion swap and bridge API.
   *
   * @overload
   * @param {undefined} [account] - The wallet account to use to interact with the protocol.
   * @param {ZerionProtocolConfig} [config] - The protocol configuration.
   */

  /**
   * Creates a new read-only interface to the Zerion swap and bridge API.
   *
   * @overload
   * @param {IWalletAccountReadOnly} account - The wallet account to use to interact with the protocol.
   * @param {ZerionProtocolConfig} [config] - The protocol configuration.
   */

  /**
   * Creates a new interface to the Zerion swap and bridge API.
   *
   * @overload
   * @param {IWalletAccount} account - The wallet account to use to interact with the protocol.
   * @param {ZerionProtocolConfig} [config] - The protocol configuration.
   */
  constructor (account, config = /** @type {ZerionProtocolConfig} */ ({})) {
    super(account, config)

    /** @private */
    this._client = config.client ?? new ZerionApiClient(/** @type {*} */ (config))

    // Reuse the provider abstraction already initialized by the WDK account. In
    // particular, this preserves its failover behavior when configured with an
    // array of RPC URLs or EIP-1193 providers.
    /** @private */
    this._provider = account?._provider

    /** @private @type {Promise<ZerionChain[]> | undefined} */
    this._chainsPromise = undefined

    /** @private @type {Promise<ZerionChain> | undefined} */
    this._accountChainPromise = undefined

    /** @private @type {Map<string, ZerionToken>} */
    this._tokenCache = new Map()
  }

  /**
   * Quotes the estimated costs and output of a same-chain swap or cross-chain bridge.
   * Quotes are non-binding; the best route across Zerion's aggregated liquidity
   * sources is selected automatically.
   *
   * @param {ZerionSwidgeOptions} options - The swidge options.
   * @returns {Promise<SwidgeQuote>} The quoted swidge details.
   */
  async quoteSwidge (options) {
    const { request, context } = await this._buildQuoteRequest(options)

    const response = await this._client.getSwapQuotes(request)

    const quote = this._selectQuote(response?.data ?? [])

    const prepared = await this._prepareQuote(quote, context)

    this._enforceFeeCaps(quote.attributes, this._config, prepared.networkFee)

    return prepared.mapped
  }

  /**
   * Executes a same-chain swap or cross-chain bridge through the Zerion API.
   *
   * With standard (non erc-4337) accounts, the input token must already be approved:
   * if an approval is missing, a {@link ZerionAllowanceError} is thrown carrying the
   * ready-to-send approve transaction. Erc-4337 accounts bundle the approval with the
   * swap automatically, so no prior approval is needed.
   *
   * @param {ZerionSwidgeOptions} options - The swidge options.
   * @param {SwidgeProtocolConfig & Record<string, unknown>} [config] - Overrides for the fee caps, plus erc-4337
   *   execution options (e.g. paymaster configuration) forwarded to the account.
   * @returns {Promise<SwidgeResult>} The swidge execution result.
   */
  async swidge (options, config = {}) {
    this._assertWritableAccount()

    const mergedConfig = { ...this._config, ...config }

    const { request, context } = await this._buildQuoteRequest(options)

    const response = await this._client.getSwapQuotes(request)

    const quote = this._selectQuote(response?.data ?? [])

    const attributes = quote.attributes
    const prepared = await this._prepareQuote(quote, context, config)
    const { mapped, swapTx, approveTx } = prepared

    this._enforceFeeCaps(attributes, mergedConfig, prepared.networkFee)

    if (options.minAmountOut !== undefined && mapped.toTokenAmountMin < toBaseUnitAmount(options.minAmountOut, 'minAmountOut')) {
      throw new ZerionError('min_amount_out_not_met', `The quoted minimum output (${mapped.toTokenAmountMin}) is below the requested minAmountOut (${options.minAmountOut}).`)
    }

    let hash, actualNetworkFee

    // Erc-4337 accounts execute call batches atomically, so any required
    // approval is bundled with the swap in a single user operation. They are
    // detected by their user-operation surface (a capability check) so the
    // wallet packages stay out of the module's runtime dependency tree.
    const isErc4337Account = typeof /** @type {*} */ (this._account).getUserOperationReceipt === 'function'

    if (isErc4337Account) {
      const transactions = approveTx ? [approveTx, swapTx] : [swapTx]

      ;({ hash, fee: actualNetworkFee } = await /** @type {*} */ (this._account).sendTransaction(transactions, config))
    } else {
      if (approveTx) {
        throw new ZerionAllowanceError(
          `The input token ('${approveTx.to}') must be approved before swapping. Approve it via the account's approve method, or send the transaction in 'details.transaction'.`,
          { token: approveTx.to, transaction: approveTx }
        )
      }

      ;({ hash, fee: actualNetworkFee } = await /** @type {IWalletAccount} */ (this._account).sendTransaction(swapTx))
    }

    const fees = actualNetworkFee === undefined
      ? mapped.fees
      : mapped.fees.map(fee => fee.type === 'network' ? { ...fee, amount: BigInt(actualNetworkFee) } : fee)

    return {
      id: `${context.inputChain.id}:${context.outputChain.id}:${hash}`,
      hash,
      fees,
      transactions: [{ hash, chain: context.inputChain.id, type: 'source' }],
      fromTokenAmount: mapped.fromTokenAmount,
      toTokenAmount: mapped.toTokenAmount,
      toTokenAmountMin: mapped.toTokenAmountMin
    }
  }

  /**
   * Swaps a pair of tokens through the Swidge implementation.
   *
   * The classic Swap interface exposes a single `fee` field representing gas,
   * so only network fees are included. Protocol fees remain reflected in the
   * quoted output amount and are available through the Swidge interface.
   *
   * @param {SwapOptions} options - The swap options.
   * @returns {Promise<SwapResult>} The swap result.
   */
  async swap (options) {
    const result = await this.swidge(this._toSwidgeOptions(options))

    return {
      hash: result.hash ?? result.id,
      fee: this._sumFees(result.fees, 'network'),
      tokenInAmount: result.fromTokenAmount,
      tokenOutAmount: result.toTokenAmount
    }
  }

  /**
   * Quotes a swap through the Swidge implementation.
   *
   * @param {SwapOptions} options - The swap options.
   * @returns {Promise<Omit<SwapResult, 'hash'>>} The swap quote.
   */
  async quoteSwap (options) {
    const result = await this.quoteSwidge(this._toSwidgeOptions(options))

    return {
      fee: this._sumFees(result.fees, 'network'),
      tokenInAmount: result.fromTokenAmount,
      tokenOutAmount: result.toTokenAmount
    }
  }

  /**
   * Maps classic swap options to swidge options, translating the exact-input
   * constraint into the classic interface's vocabulary.
   *
   * @private
   * @param {SwapOptions} options - The swap options.
   * @returns {ZerionSwidgeOptions} The equivalent swidge options.
   */
  _toSwidgeOptions (options) {
    if (options.tokenOutAmount !== undefined) {
      throw new ZerionCapabilityError('The Zerion swap API supports exact-input operations only. Specify tokenInAmount instead of tokenOutAmount.')
    }

    return /** @type {ZerionSwidgeOptions} */ ({
      fromToken: options.tokenIn,
      toToken: options.tokenOut,
      recipient: options.to,
      fromTokenAmount: options.tokenInAmount,
      minAmountOut: options.minAmountOut
    })
  }

  /**
   * Bridges a token through the Swidge implementation.
   *
   * The classic Bridge interface exposes `fee` as gas and `bridgeFee` as the
   * native fee paid to the bridge provider. Zerion protocol fees are therefore
   * kept out of `bridgeFee` and remain visible through the Swidge interface.
   *
   * @param {BridgeOptions} options - The bridge options.
   * @returns {Promise<BridgeResult>} The bridge result.
   */
  async bridge (options) {
    const result = await this.swidge(await this._toBridgeSwidgeOptions(options))

    return {
      hash: result.hash ?? result.id,
      fee: this._sumFees(result.fees, 'network'),
      bridgeFee: this._sumFees(result.fees, 'other')
    }
  }

  /**
   * Quotes a bridge through the Swidge implementation.
   *
   * @param {BridgeOptions} options - The bridge options.
   * @returns {Promise<Omit<BridgeResult, 'hash'>>} The bridge quote.
   */
  async quoteBridge (options) {
    const result = await this.quoteSwidge(await this._toBridgeSwidgeOptions(options))

    return {
      fee: this._sumFees(result.fees, 'network'),
      bridgeFee: this._sumFees(result.fees, 'other')
    }
  }

  /**
   * Resolves the classic bridge interface's source token address to Zerion's
   * canonical fungible id before looking up its destination implementation.
   *
   * @private
   * @param {BridgeOptions} options - The bridge options.
   * @returns {Promise<ZerionSwidgeOptions>} Equivalent swidge options.
   */
  async _toBridgeSwidgeOptions (options) {
    if (!this._account) {
      throw new ZerionError('missing_account', 'Bridge operations require the protocol to be initialized with a wallet account.')
    }

    const inputChain = await this._getAccountChain()
    const sourceToken = await this._resolveToken(options.token, inputChain)

    return /** @type {ZerionSwidgeOptions} */ ({
      fromToken: sourceToken.fungibleId,
      toToken: sourceToken.fungibleId,
      toChain: options.targetChain,
      recipient: options.recipient,
      fromTokenAmount: options.amount
    })
  }

  /**
   * Retrieves the current status of a swidge by inspecting the source transaction.
   *
   * Same-chain swaps report 'completed' once the source transaction succeeds. For
   * cross-chain bridges, the module reports 'pending' after a successful source
   * transaction: destination settlement is handled by the routed bridge provider
   * (see the quote's estimatedDuration) and is not yet tracked by the Zerion API.
   *
   * @param {string} id - The swidge id returned by {@link swidge} ('fromChain:toChain:hash'), or a plain transaction hash.
   * @param {ZerionSwidgeStatusOptions} [options] - Optional source/destination chain hints (used with plain-hash ids).
   * @returns {Promise<ZerionSwidgeStatusResult>} The current swidge status.
   */
  async getSwidgeStatus (id, options = {}) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new ZerionError('invalid_id', 'A swidge id is required.')
    }

    const parts = id.split(':')
    const hash = parts[parts.length - 1]

    if (!TRANSACTION_HASH_PATTERN.test(hash)) {
      throw new ZerionError('invalid_id', `Invalid swidge id ('${id}'): expected 'fromChain:toChain:hash' or a transaction hash.`)
    }

    if (!this._account || typeof this._account.getTransactionReceipt !== 'function') {
      throw new ZerionCapabilityError('The wallet must be connected to a provider in order to track swidge status.')
    }

    const fromChainRef = options.fromChain ?? (parts.length === 3 ? parts[0] : undefined)
    const toChainRef = options.toChain ?? (parts.length === 3 ? parts[1] : undefined)

    const accountChain = await this._getAccountChain()

    if (fromChainRef !== undefined) {
      const fromChain = await this._normalizeChain(fromChainRef)

      if (fromChain.id !== accountChain.id) {
        throw new ZerionCapabilityError(`Swidge status lookups must be performed with an account on the source chain ('${fromChain.id}').`)
      }
    }

    const toChain = toChainRef !== undefined
      ? await this._normalizeChain(toChainRef)
      : accountChain

    const transactions = [{ hash, chain: accountChain.id, type: /** @type {'source'} */ ('source') }]

    // ERC-4337 accounts translate their user-operation hash to the eventual
    // transaction hash here; standard accounts perform a normal receipt lookup.
    const receipt = /** @type {{ status?: number } | null | undefined} */ (await this._account.getTransactionReceipt(hash))

    if (!receipt) return { status: 'pending', transactions }

    if (receipt.status === 0) return { status: 'failed', transactions }

    return {
      status: toChain.id === accountChain.id ? 'completed' : 'pending',
      transactions
    }
  }

  /**
   * Retrieves the chains on which Zerion supports trading.
   *
   * @returns {Promise<ZerionSwidgeSupportedChain[]>} The supported chains.
   */
  async getSupportedChains () {
    const chains = await this._getChains()

    return chains
      .filter(chain => /** @type {*} */ (chain.flags).supports_trading)
      .map(chain => ({
        id: chain.id,
        name: chain.name,
        type: chain.id === 'solana' ? 'svm' : 'evm',
        nativeToken: NATIVE_TOKEN_SYMBOLS[chain.id] ?? ''
      }))
  }

  /**
   * Retrieves the tokens available for swidge operations, optionally scoped to a route.
   *
   * For cross-chain routes (distinct fromChain and toChain), the Zerion swap
   * token-picker is queried for each side of the route. For single-chain
   * discovery, the top fungibles by market cap deployed on the chain are returned.
   *
   * @param {ZerionSwidgeSupportedTokensOptions} [options] - Optional source/destination chain filters.
   * @returns {Promise<ZerionSwidgeSupportedToken[]>} The supported tokens.
   */
  async getSupportedTokens (options = {}) {
    let fromChain = options.fromChain !== undefined
      ? await this._normalizeChain(options.fromChain)
      : undefined

    const toChain = options.toChain !== undefined
      ? await this._normalizeChain(options.toChain)
      : undefined

    if (!fromChain && !toChain) {
      fromChain = this._provider || /** @type {*} */ (this._account)?._config?.chainId !== undefined
        ? await this._getAccountChain()
        : await this._normalizeChain('ethereum')
    }

    if (fromChain && toChain && fromChain.id !== toChain.id) {
      const [inputSide, outputSide] = await Promise.all([
        this._client.getSwapFungibles({ inputChainId: fromChain.id, outputChainId: toChain.id, direction: 'input' }),
        this._client.getSwapFungibles({ inputChainId: fromChain.id, outputChainId: toChain.id, direction: 'output' })
      ])

      return [
        ...this._mapSupportedTokens(inputSide, fromChain.id),
        ...this._mapSupportedTokens(outputSide, toChain.id)
      ]
    }

    const chain = /** @type {ZerionChain} */ (fromChain ?? toChain)

    const response = await this._client.listFungibles({ implementationChainId: chain.id })

    return this._mapSupportedTokens(response, chain.id)
  }

  /**
   * Maps a Zerion fungibles response to supported-token entries on a chain.
   *
   * @private
   * @returns {SwidgeSupportedToken[]} The mapped tokens.
   */
  _mapSupportedTokens (response, chainId) {
    const tokens = []

    for (const fungible of response?.data ?? []) {
      for (const implementation of fungible.attributes?.implementations ?? []) {
        if (implementation.chain_id !== chainId) continue

        tokens.push({
          token: fungible.id,
          chain: implementation.chain_id,
          symbol: fungible.attributes?.symbol ?? '',
          decimals: implementation.decimals,
          ...(implementation.address ? { address: implementation.address } : {}),
          ...(fungible.attributes?.name ? { name: fungible.attributes.name } : {})
        })
      }
    }

    return tokens
  }

  /**
   * Asserts that the configured account can sign and broadcast transactions.
   * Writable accounts are detected by their `sendTransaction` capability
   * (read-only accounts do not expose it), keeping the wallet packages out
   * of the module's runtime dependency tree.
   *
   * @private
   */
  _assertWritableAccount () {
    if (typeof (/** @type {*} */ (this._account))?.sendTransaction === 'function') return

    throw new ZerionError('read_only_account', "The 'swidge(options)' method requires the protocol to be initialized with a non read-only evm account.")
  }

  /** @private */
  async _getChains () {
    if (!this._chainsPromise) {
      this._chainsPromise = (async () => {
        try {
          const response = await this._client.getChains()

          return (response?.data ?? []).map(chain => ({
            id: chain.id,
            externalId: chain.attributes?.external_id,
            name: chain.attributes?.name ?? chain.id,
            flags: chain.attributes?.flags ?? {}
          }))
        } catch (err) {
          this._chainsPromise = undefined

          throw err
        }
      })()
    }

    return this._chainsPromise
  }

  /** @private */
  async _getAccountChain () {
    const configuredChainId = /** @type {*} */ (this._account)?._config?.chainId

    if (!this._provider && configuredChainId === undefined) {
      throw new ZerionCapabilityError('The wallet must be connected to a provider in order to perform swidge operations.')
    }

    if (!this._accountChainPromise) {
      this._accountChainPromise = (async () => {
        try {
          if (configuredChainId !== undefined) {
            return await this._normalizeChain(configuredChainId)
          }

          const network = await this._provider.getNetwork()

          return await this._normalizeChain(network.chainId)
        } catch (err) {
          this._accountChainPromise = undefined

          throw err
        }
      })()
    }

    return this._accountChainPromise
  }

  /**
   * Resolves a chain reference (Zerion chain id, EIP-155 numeric id, or hex id) to a Zerion chain.
   *
   * @private
   * @param {string | number | bigint} chainRef - The chain reference.
   * @returns {Promise<ZerionChain>} The resolved chain.
   */
  async _normalizeChain (chainRef) {
    const chains = await this._getChains()

    if (typeof chainRef === 'string' && !/^\d+$/.test(chainRef) && !chainRef.startsWith('0x')) {
      const chain = chains.find(c => c.id === chainRef)

      if (chain) return chain

      throw new ZerionCapabilityError(`Unknown chain ('${chainRef}'). Use a Zerion chain id (see getSupportedChains) or an EIP-155 chain id.`)
    }

    const numericId = BigInt(chainRef)

    const chain = chains.find(c => {
      try {
        return c.externalId !== undefined && BigInt(c.externalId) === numericId
      } catch {
        return false
      }
    })

    if (chain) return chain

    throw new ZerionCapabilityError(`Chain with id '${chainRef}' is not supported by Zerion.`)
  }

  /**
   * Resolves a token reference to a Zerion fungible on the given chain.
   * Accepts an ERC-20 contract address, a Zerion fungible id (e.g. 'eth'),
   * or a native-asset sentinel ('native' or 0xeeee...eeee).
   *
   * @private
   * @param {string} token - The token reference.
   * @param {ZerionChain} chain - The chain the token lives on.
   * @returns {Promise<ZerionToken>} The resolved token.
   */
  async _resolveToken (token, chain) {
    if (typeof token !== 'string' || token.length === 0) {
      throw new ZerionError('invalid_options', `Invalid token reference: '${token}'.`)
    }

    const cacheKey = `${chain.id}:${token.toLowerCase()}`

    const cached = this._tokenCache.get(cacheKey)

    if (cached) return cached

    let response

    if (NATIVE_TOKEN_SENTINELS.has(token.toLowerCase())) {
      response = await this._client.getFungibleByImplementation(chain.id)
    } else if (EVM_ADDRESS_PATTERN.test(token)) {
      // Some canonical Zerion fungible ids are address-shaped (e.g. mainnet
      // USDC's id), so when the address has no implementation on this chain,
      // fall back to resolving it as a fungible id.
      try {
        response = await this._client.getFungibleByImplementation(`${chain.id}:${token.toLowerCase()}`)
      } catch (err) {
        if (err?.status !== 404) throw err

        response = await this._client.getFungible(token.toLowerCase())
      }
    } else {
      response = await this._client.getFungible(token)
    }

    const fungible = response?.data

    const implementation = (fungible?.attributes?.implementations ?? [])
      .find(i => i.chain_id === chain.id)

    if (!fungible || !implementation) {
      throw new ZerionCapabilityError(`Token ('${token}') has no implementation on chain ('${chain.id}').`)
    }

    const resolved = {
      fungibleId: fungible.id,
      symbol: fungible.attributes?.symbol ?? '',
      decimals: implementation.decimals,
      address: implementation.address ?? null
    }

    this._tokenCache.set(cacheKey, resolved)
    this._tokenCache.set(`${chain.id}:${resolved.fungibleId.toLowerCase()}`, resolved)

    return resolved
  }

  /** @private */
  async _buildQuoteRequest (options) {
    if (!this._account) {
      throw new ZerionError('missing_account', 'Swidge quotes require the protocol to be initialized with a wallet account.')
    }

    if (options.toTokenAmount !== undefined) {
      throw new ZerionCapabilityError('The Zerion swap API supports exact-input operations only. Specify fromTokenAmount instead of toTokenAmount.')
    }

    if (options.fromTokenAmount === undefined || options.fromTokenAmount === null) {
      throw new ZerionError('invalid_options', "The 'fromTokenAmount' option is required.")
    }

    const amount = toBaseUnitAmount(options.fromTokenAmount, 'fromTokenAmount')

    if (amount <= 0n) {
      throw new ZerionError('invalid_options', "The 'fromTokenAmount' option must be positive.")
    }

    if (options.slippage !== undefined && (typeof options.slippage !== 'number' || !Number.isFinite(options.slippage) || options.slippage < 0 || options.slippage >= 1)) {
      throw new ZerionError('invalid_options', "The 'slippage' option must be a decimal between 0 and 1 (e.g. 0.01 for 1%).")
    }

    const inputChain = await this._getAccountChain()

    const outputChain = options.toChain === undefined || options.toChain === null
      ? inputChain
      : await this._normalizeChain(options.toChain)

    if (outputChain.id === 'solana' && !options.recipient) {
      throw new ZerionCapabilityError("The 'recipient' option is required when the destination chain is 'solana'.")
    }

    const from = await this._account.getAddress()

    if (options.refundAddress !== undefined && options.refundAddress.toLowerCase() !== from.toLowerCase()) {
      throw new ZerionCapabilityError('Zerion routes always refund the sending wallet; a distinct refundAddress is not supported.')
    }

    const input = await this._resolveToken(options.fromToken, inputChain)
    const output = await this._resolveToken(options.toToken, outputChain)

    const slippagePercent = options.slippage !== undefined
      ? options.slippage * 100
      : /** @type {ZerionProtocolConfig} */ (this._config).slippagePercent

    return {
      request: {
        from,
        to: options.recipient ?? from,
        inputChainId: inputChain.id,
        inputFungibleId: input.fungibleId,
        amount: fromBaseUnits(amount, input.decimals),
        outputChainId: outputChain.id,
        outputFungibleId: output.fungibleId,
        slippagePercent,
        currency: /** @type {ZerionProtocolConfig} */ (this._config).currency
      },
      context: { amount, from, input, output, inputChain, outputChain }
    }
  }

  /** @private */
  _selectQuote (quotes) {
    if (quotes.length === 0) {
      throw new ZerionQuoteError('No routes available for the requested pair.')
    }

    const executable = quotes.find(quote => quote.attributes?.transaction_swap?.evm && !quote.attributes?.error)

    if (executable) return executable

    const error = quotes[0].attributes?.error

    throw new ZerionQuoteError(
      error?.message ?? 'No executable quote available for the requested pair.',
      { code: error?.code, hint: error?.hint }
    )
  }

  /** @private */
  _sumFees (fees, type) {
    return fees
      .filter(fee => fee.type === type)
      .reduce((total, fee) => total + fee.amount, 0n)
  }

  /** @private */
  async _prepareQuote (quote, context, executionConfig) {
    const attributes = quote.attributes
    const swapTx = this._validateEvmTransaction(attributes.transaction_swap?.evm, context, 'swap')
    const approveTx = attributes.transaction_approve?.evm
      ? this._validateEvmTransaction(attributes.transaction_approve.evm, context, 'approval')
      : undefined

    if (quote.relationships?.input_chain?.data?.id !== context.inputChain.id ||
        quote.relationships?.output_chain?.data?.id !== context.outputChain.id) {
      throw new ZerionQuoteError('The executable quote returned mismatched source or destination chain metadata.')
    }

    if (approveTx) this._validateApproval(approveTx, swapTx, context)

    const isErc4337Account = typeof /** @type {*} */ (this._account).getUserOperationReceipt === 'function'
    const transactions = isErc4337Account
      ? (approveTx ? [approveTx, swapTx] : [swapTx])
      : swapTx

    let walletQuote

    try {
      walletQuote = await /** @type {*} */ (this._account).quoteSendTransaction(transactions, executionConfig)
    } catch (err) {
      throw new ZerionQuoteError(`The wallet could not quote the executable transaction: ${err?.message ?? err}.`, { cause: err })
    }

    let networkFeeAmount

    try {
      networkFeeAmount = toBaseUnitAmount(walletQuote?.fee, 'walletNetworkFee')
    } catch (err) {
      throw new ZerionQuoteError('The wallet returned an invalid network-fee quote.', { cause: err })
    }

    const networkFeeToken = attributes.network_fee?.fungible?.id
      ? await this._resolveFeeToken(attributes.network_fee.fungible, context)
      : await this._resolveToken('native', context.inputChain)

    const networkFee = {
      amount: networkFeeAmount,
      token: networkFeeToken,
      apiQuantity: attributes.network_fee?.amount?.quantity
    }

    return {
      mapped: await this._mapQuote(quote, context, networkFee),
      swapTx,
      approveTx,
      networkFee
    }
  }

  /** @private */
  _validateEvmTransaction (evm, context, label) {
    if (!evm || typeof evm !== 'object') {
      throw new ZerionQuoteError(`The executable quote is missing its ${label} transaction.`)
    }

    if (!EVM_ADDRESS_PATTERN.test(evm.to ?? '')) {
      throw new ZerionQuoteError(`The executable quote contains an invalid ${label} transaction target.`)
    }

    if (typeof evm.from !== 'string' || evm.from.toLowerCase() !== context.from.toLowerCase()) {
      throw new ZerionQuoteError(`The executable quote contains a ${label} transaction for a different sender.`)
    }

    try {
      if (context.inputChain.externalId === undefined || BigInt(evm.chain_id) !== BigInt(context.inputChain.externalId)) {
        throw new Error('chain mismatch')
      }
    } catch {
      throw new ZerionQuoteError(`The executable quote contains a ${label} transaction for a different chain.`)
    }

    if (!EVM_DATA_PATTERN.test(evm.data ?? '')) {
      throw new ZerionQuoteError(`The executable quote contains invalid ${label} transaction data.`)
    }

    let transaction

    try {
      transaction = toEvmTransaction(evm)
    } catch (err) {
      throw new ZerionQuoteError(`The executable quote contains an invalid ${label} transaction value.`, { cause: err })
    }

    if (transaction.value < 0n) {
      throw new ZerionQuoteError(`The executable quote contains a negative ${label} transaction value.`)
    }

    return transaction
  }

  /** @private */
  _validateApproval (approveTx, swapTx, context) {
    if (!context.input.address || approveTx.to.toLowerCase() !== context.input.address.toLowerCase()) {
      throw new ZerionQuoteError('The approval transaction does not target the expected input token.')
    }

    if (approveTx.value !== 0n) {
      throw new ZerionQuoteError('The approval transaction must not transfer native value.')
    }

    const data = approveTx.data.slice(2)

    if (data.length !== 136 || data.slice(0, 8).toLowerCase() !== ERC20_APPROVE_SELECTOR) {
      throw new ZerionQuoteError('The approval transaction does not contain a valid ERC-20 approve call.')
    }

    const spender = `0x${data.slice(8, 72).slice(-40)}`
    const allowance = BigInt(`0x${data.slice(72, 136)}`)

    if (spender.toLowerCase() !== swapTx.to.toLowerCase()) {
      throw new ZerionQuoteError('The approval transaction authorizes an unexpected spender.')
    }

    if (allowance < context.amount) {
      throw new ZerionQuoteError('The approval transaction amount is below the quoted input amount.')
    }
  }

  /** @private */
  async _mapQuote (quote, context, networkFee) {
    const attributes = quote.attributes

    if (attributes.output_amount?.quantity === undefined || attributes.minimum_output_amount?.quantity === undefined) {
      throw new ZerionQuoteError('The executable quote is missing an output amount or minimum guaranteed output amount.')
    }

    let toTokenAmount, toTokenAmountMin

    try {
      toTokenAmount = toBaseUnits(attributes.output_amount.quantity, context.output.decimals)
      toTokenAmountMin = toBaseUnits(attributes.minimum_output_amount.quantity, context.output.decimals)
    } catch (err) {
      throw new ZerionQuoteError('The executable quote contains an invalid output amount.', { cause: err })
    }

    if (toTokenAmount <= 0n || toTokenAmountMin > toTokenAmount) {
      throw new ZerionQuoteError('The executable quote contains inconsistent output amounts.')
    }

    return {
      fromTokenAmount: context.amount,
      toTokenAmount,
      toTokenAmountMin,
      fees: await this._mapFees(attributes, context, networkFee),
      ...(attributes.estimated_time_seconds !== undefined ? { estimatedDuration: attributes.estimated_time_seconds } : {})
    }
  }

  /**
   * Maps Zerion fee blocks to the swidge fee model. Zerion's network fee is charged
   * on the source chain, Zerion's own fee is 'protocol', and bridge-provider fees
   * are 'other' so classic bridge adapters do not mix denominations.
   *
   * @private
   * @returns {Promise<SwidgeFee[]>} The mapped fees.
   */
  async _mapFees (attributes, context, networkFee) {
    const fees = []

    const append = async (block, type, description) => {
      if (block?.amount?.quantity === undefined) return

      const token = await this._resolveFeeToken(block.fungible, context)

      fees.push({
        type,
        amount: toBaseUnits(block.amount.quantity, token.decimals),
        token: token.fungibleId,
        chain: context.inputChain.id,
        included: block.included_in_rate ?? false,
        description
      })
    }

    fees.push({
      type: 'network',
      amount: networkFee.amount,
      token: networkFee.token.fungibleId,
      chain: context.inputChain.id,
      included: false,
      description: 'Network (gas) fee'
    })

    await append(attributes.protocol_fee, 'protocol', `Zerion protocol fee (${attributes.protocol_fee?.percentage ?? 0}%)`)

    await append(attributes.bridge_fee, 'other', 'Bridge provider fee')

    return fees
  }

  /** @private */
  async _resolveFeeToken (fungibleRef, context) {
    const fungibleId = fungibleRef?.id

    if (!fungibleId) {
      throw new ZerionQuoteError('A reported fee is missing its fungible denomination.')
    }

    if (fungibleId === context.input.fungibleId) return context.input

    if (fungibleId === context.output.fungibleId) return context.output

    const chains = context.inputChain.id === context.outputChain.id
      ? [context.inputChain]
      : [context.inputChain, context.outputChain]

    for (const chain of chains) {
      try {
        return await this._resolveToken(fungibleId, chain)
      } catch (err) {
        if (!(err instanceof ZerionCapabilityError) && err?.status !== 404) throw err
      }
    }

    throw new ZerionQuoteError(`The reported fee token ('${fungibleId}') has no implementation on the quoted route.`)
  }

  /**
   * Enforces configured fee caps using the wallet's exact network-fee quote and the
   * fiat conversion data reported by Zerion. Requested caps fail closed whenever
   * the data needed for a trustworthy comparison is absent.
   *
   * @private
   */
  _enforceFeeCaps (attributes, config, networkFee) {
    const { maxNetworkFeeBps, maxProtocolFeeBps } = config

    if (maxNetworkFeeBps === undefined && maxProtocolFeeBps === undefined) return

    const networkCap = maxNetworkFeeBps === undefined
      ? undefined
      : normalizeFeeCap(maxNetworkFeeBps, 'maxNetworkFeeBps')
    const protocolCap = maxProtocolFeeBps === undefined
      ? undefined
      : normalizeFeeCap(maxProtocolFeeBps, 'maxProtocolFeeBps')
    const inputUsd = attributes.input_amount?.usd_value

    if (typeof inputUsd !== 'number' || !Number.isFinite(inputUsd) || inputUsd <= 0) {
      throw new ZerionError('fee_cap_unverifiable', 'The configured fee cap cannot be verified because the quote has no valid input USD value.')
    }

    if (networkCap !== undefined) {
      const reportedNetworkUsd = attributes.network_fee?.amount?.usd_value
      const apiQuantity = networkFee?.apiQuantity

      if (typeof reportedNetworkUsd !== 'number' || !Number.isFinite(reportedNetworkUsd) || reportedNetworkUsd < 0 || apiQuantity === undefined) {
        throw new ZerionError('fee_cap_unverifiable', 'maxNetworkFeeBps cannot be verified because the quote has no valid network-fee USD value.')
      }

      let apiNetworkAmount

      try {
        apiNetworkAmount = toBaseUnits(apiQuantity, networkFee.token.decimals)
      } catch (err) {
        throw new ZerionError('fee_cap_unverifiable', 'maxNetworkFeeBps cannot be verified because the reported network-fee amount is invalid.', { cause: err })
      }

      if (apiNetworkAmount <= 0n && networkFee.amount > 0n) {
        throw new ZerionError('fee_cap_unverifiable', 'maxNetworkFeeBps cannot be verified from a zero provider network-fee estimate.')
      }

      const networkUsd = apiNetworkAmount === 0n
        ? 0
        : reportedNetworkUsd * Number(networkFee.amount) / Number(apiNetworkAmount)

      if (!Number.isFinite(networkUsd)) {
        throw new ZerionError('fee_cap_unverifiable', 'maxNetworkFeeBps cannot be verified from the provider fee conversion data.')
      }

      const bps = (networkUsd / inputUsd) * 10_000

      if (bps > networkCap) {
        throw new ZerionError('fee_cap_exceeded', `The network fee (${bps.toFixed(1)} bps) exceeds maxNetworkFeeBps (${maxNetworkFeeBps}).`)
      }
    }

    if (protocolCap !== undefined) {
      let feesUsd = 0

      for (const [name, block] of [['protocol', attributes.protocol_fee], ['bridge', attributes.bridge_fee]]) {
        if (block === undefined || block === null) continue

        const usd = block.amount?.usd_value

        if (typeof usd !== 'number' || !Number.isFinite(usd) || usd < 0) {
          throw new ZerionError('fee_cap_unverifiable', `maxProtocolFeeBps cannot be verified because the ${name} fee has no valid USD value.`)
        }

        feesUsd += usd
      }

      const bps = (feesUsd / inputUsd) * 10_000

      if (bps > protocolCap) {
        throw new ZerionError('fee_cap_exceeded', `The protocol and bridge fees (${bps.toFixed(1)} bps) exceed maxProtocolFeeBps (${maxProtocolFeeBps}).`)
      }
    }
  }
}
