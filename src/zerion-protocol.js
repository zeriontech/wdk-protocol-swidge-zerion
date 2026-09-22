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

import {
  SwidgeProtocol,
  SwidgeErrorReason,
  AccountRequiredError,
  InvalidTokenError,
  MaximumFeeExceededError,
  NoSuchElementError,
  ProviderError,
  ProviderRequiredError,
  ReadOnlyAccountRequiredError,
  ValueError
} from '@tetherto/wdk-wallet/protocols'

import { ZerionApiClient } from './zerion-api-client.js'
import { toBaseUnits, fromBaseUnits } from './amounts.js'
import { ZerionApiError, ZerionQuoteError, toSwidgeErrorReason } from './errors.js'

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeProtocolConfig} SwidgeProtocolConfig */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeOptions} SwidgeOptions */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeQuote} SwidgeQuote */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeResult} SwidgeResult */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeFee} SwidgeFee */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeTransaction} SwidgeTransaction */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeStatusOptions} SwidgeStatusOptions */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeStatusResult} SwidgeStatusResult */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedChain} SwidgeSupportedChain */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedToken} SwidgeSupportedToken */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedTokensOptions} SwidgeSupportedTokensOptions */

/**
 * @typedef {Object} ZerionProtocolSpecificConfig
 * @property {string} [apiKey] - The Zerion API key (from https://dashboard.zerion.io). Required unless a custom client is provided.
 * @property {string} [baseUrl] - The Zerion API base url. Defaults to 'https://api.zerion.io'.
 * @property {number} [slippagePercent] - Default maximum acceptable slippage in percent (e.g. 1 for 1%).
 *   When omitted, Zerion picks an auto-slippage value based on the pair's volatility and liquidity.
 * @property {string} [currency] - Currency for fiat values in quotes. Defaults to 'usd'.
 * @property {number} [approvalPollIntervalMs] - Interval between approval-confirmation polls for standard accounts. Defaults to 3000.
 * @property {number} [approvalTimeoutMs] - Maximum time to wait for an approval to confirm for standard accounts. Defaults to 180000.
 * @property {number} [timeoutMs] - Per-request timeout in milliseconds. Defaults to 30000.
 * @property {number} [maxRetries] - Maximum number of retries for retryable API failures. Defaults to 2.
 * @property {number} [retryDelayMs] - Base delay between retries in milliseconds. Defaults to 400.
 * @property {typeof fetch} [fetch] - Custom fetch implementation.
 * @property {ZerionApiClient} [client] - Custom pre-configured Zerion API client.
 */

/**
 * @typedef {SwidgeProtocolConfig & ZerionProtocolSpecificConfig} ZerionProtocolConfig
 */

/** @typedef {SwidgeOptions} ZerionSwidgeOptions */
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
 * @property {Record<string, boolean>} flags - Chain capability flags (e.g. supports_trading, supports_bridge).
 */

/**
 * @typedef {Object} ZerionToken
 * @property {string} fungibleId - The Zerion fungible id to use in swap requests.
 * @property {string} symbol - The token symbol.
 * @property {number} decimals - The token's number of decimal places on the resolved chain.
 * @property {string | null} address - The token contract address, or null for native assets.
 */

/**
 * @typedef {Object} ZerionEvmTransaction
 * @property {string} to - The transaction target.
 * @property {bigint} value - The native value attached to the transaction, in wei.
 * @property {string} data - The transaction calldata.
 */

const NATIVE_TOKEN_SENTINELS = new Set([
  'native',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
])

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const EVM_DATA_PATTERN = /^0x(?:[0-9a-fA-F]{2})*$/
const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/
const ERC20_APPROVE_SELECTOR = '095ea7b3'

const DEFAULT_APPROVAL_POLL_INTERVAL_MS = 3_000
const DEFAULT_APPROVAL_TIMEOUT_MS = 180_000
const NATIVE_SYMBOL_CONCURRENCY = 4

// Fast path for getSupportedChains; chains missing here are resolved through the API.
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

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function toEvmTransaction (evm) {
  return {
    to: evm.to,
    value: BigInt(evm.value ?? 0),
    data: evm.data
  }
}

function toBaseUnitAmount (value, optionName) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
    throw new ValueError(`The '${optionName}' option must be a non-negative safe integer or bigint.`)
  }

  if (typeof value !== 'number' && typeof value !== 'bigint') {
    throw new ValueError(`The '${optionName}' option must be a non-negative safe integer or bigint.`)
  }

  return BigInt(value)
}

function normalizeFeeCap (value, name) {
  const valid = typeof value === 'bigint'
    ? value >= 0n
    : typeof value === 'number' && Number.isFinite(value) && value >= 0

  if (!valid) {
    throw new ValueError(`'${name}' must be a finite, non-negative number or bigint.`)
  }

  return typeof value === 'bigint' && value > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.POSITIVE_INFINITY
    : Number(value)
}

// Zero fees are reported by the api without a denomination or fiat value
// (e.g. `protocol_fee: { amount: { quantity: '0' }, percentage: 0 }`).
function isZeroQuantity (quantity) {
  const value = String(quantity ?? '').trim()

  return /^(?:0+\.?0*|\.0+)$/.test(value)
}

function invalidResponse (message, cause) {
  return new ZerionApiError('invalid_response', message, 200, { cause })
}

// Erc-4337 accounts are detected by their user-operation surface (a capability
// check) so no wallet package needs to be imported at runtime.
function isErc4337Account (account) {
  return typeof account?.getUserOperationReceipt === 'function'
}

async function mapWithConcurrency (items, limit, fn) {
  const results = new Array(items.length)
  let next = 0

  const worker = async () => {
    while (next < items.length) {
      const index = next++

      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))

  return results
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
   * @throws {ReadOnlyAccountRequiredError} If the protocol was created without an account.
   * @throws {ValueError} If the swidge options are not valid, including exact-output requests.
   * @throws {InvalidTokenError} If a token cannot be resolved on its chain.
   * @throws {ProviderRequiredError} If the account is not connected to a provider.
   * @throws {ProviderError} If the Zerion API or the account's provider fails.
   * @throws {ZerionQuoteError} If no executable route is available.
   * @throws {MaximumFeeExceededError} If a configured fee cap is exceeded or cannot be verified.
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
   * When the input token is not yet approved, the approval returned by the API is
   * executed as part of the operation: erc-4337 accounts bundle it with the swap in a
   * single user operation, standard accounts send it first and wait for it to confirm.
   * Every transaction produced is listed in the result's `transactions` array.
   *
   * @param {ZerionSwidgeOptions} options - The swidge options.
   * @param {SwidgeProtocolConfig & Record<string, unknown>} [config] - Overrides for the fee caps, plus erc-4337
   *   execution options (e.g. paymaster configuration) forwarded to the account.
   * @returns {Promise<SwidgeResult>} The swidge execution result.
   * @throws {AccountRequiredError} If the protocol was created without a full account.
   * @throws {ValueError} If the swidge options are not valid, including exact-output requests.
   * @throws {InvalidTokenError} If a token cannot be resolved on its chain.
   * @throws {ProviderRequiredError} If the account is not connected to a provider.
   * @throws {ProviderError} If the Zerion API, the account's provider, or the approval transaction fails.
   * @throws {ZerionQuoteError} If no executable route is available or the minimum output is not met.
   * @throws {MaximumFeeExceededError} If a configured fee cap is exceeded or cannot be verified.
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
      throw new ZerionQuoteError(
        `The quoted minimum output (${mapped.toTokenAmountMin}) is below the requested minAmountOut (${options.minAmountOut}).`,
        { reason: SwidgeErrorReason.COULD_NOT_MET_THRESHOLD }
      )
    }

    const account = /** @type {*} */ (this._account)
    const chain = context.inputChain.id

    /** @type {SwidgeTransaction[]} */
    const transactions = []

    let hash
    let networkFeePaid = 0n
    let networkFeeKnown = true

    const recordFee = (fee) => {
      if (fee === undefined || fee === null) networkFeeKnown = false
      else networkFeePaid += BigInt(fee)
    }

    if (isErc4337Account(account)) {
      const calls = approveTx ? [approveTx, swapTx] : [swapTx]
      const sent = await account.sendTransaction(calls, config)

      hash = sent.hash
      recordFee(sent.fee)

      if (approveTx) transactions.push({ hash, chain, type: 'approval' })
    } else {
      if (approveTx) {
        const approval = await account.sendTransaction(approveTx)

        transactions.push({ hash: approval.hash, chain, type: 'approval' })
        recordFee(approval.fee)

        await this._waitForTransaction(approval.hash, mergedConfig)
      }

      const sent = await account.sendTransaction(swapTx)

      hash = sent.hash
      recordFee(sent.fee)
    }

    transactions.push({ hash, chain, type: 'source' })

    const fees = networkFeeKnown
      ? mapped.fees.map(fee => fee.type === 'network' ? { ...fee, amount: networkFeePaid } : fee)
      : mapped.fees

    const id = context.inputChain.id === context.outputChain.id
      ? hash
      : `${context.inputChain.id}:${context.outputChain.id}:${hash}`

    return {
      id,
      hash,
      fees,
      transactions,
      fromTokenAmount: mapped.fromTokenAmount,
      toTokenAmount: mapped.toTokenAmount,
      toTokenAmountMin: mapped.toTokenAmountMin
    }
  }

  /**
   * Retrieves the current status of a swidge by inspecting the source transaction.
   *
   * Same-chain swaps report 'completed' once the source transaction succeeds. For
   * cross-chain bridges, the module reports 'pending' after a successful source
   * transaction: destination settlement is handled by the routed bridge provider
   * (see the quote's estimatedDuration) and is not yet tracked by the Zerion API.
   *
   * @param {string} id - The swidge id returned by {@link swidge}: a transaction hash for same-chain swaps, or
   *   'fromChain:toChain:hash' for cross-chain bridges.
   * @param {ZerionSwidgeStatusOptions} [options] - Optional source/destination chain hints (used with plain-hash ids).
   * @returns {Promise<ZerionSwidgeStatusResult>} The current swidge status.
   * @throws {ValueError} If the id is malformed, or the account is not on the id's source chain.
   * @throws {NoSuchElementError} If no transaction exists for the id.
   * @throws {ProviderRequiredError} If the account is not connected to a provider.
   * @throws {ProviderError} If the provider fails to fetch the transaction.
   */
  async getSwidgeStatus (id, options = {}) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new ValueError('A swidge id is required.')
    }

    const parts = id.split(':')
    const hash = parts[parts.length - 1]

    if (!TRANSACTION_HASH_PATTERN.test(hash)) {
      throw new ValueError(`Invalid swidge id ('${id}'): expected a transaction hash or 'fromChain:toChain:hash'.`)
    }

    const account = /** @type {*} */ (this._account)

    if (!account || typeof account.getTransactionReceipt !== 'function') {
      throw new ProviderRequiredError('The wallet must be connected to a provider in order to track swidge status.')
    }

    const fromChainRef = options.fromChain ?? (parts.length === 3 ? parts[0] : undefined)
    const toChainRef = options.toChain ?? (parts.length === 3 ? parts[1] : undefined)

    const accountChain = await this._getAccountChain()

    if (fromChainRef !== undefined) {
      const fromChain = await this._normalizeChain(fromChainRef)

      if (fromChain.id !== accountChain.id) {
        throw new ValueError(`Swidge status lookups must be performed with an account on the source chain ('${fromChain.id}').`)
      }
    }

    const toChain = toChainRef !== undefined
      ? await this._normalizeChain(toChainRef)
      : accountChain

    /** @type {SwidgeTransaction[]} */
    const transactions = [{ hash, chain: accountChain.id, type: 'source' }]

    // Erc-4337 accounts translate their user-operation hash to the eventual
    // transaction hash here; standard accounts perform a normal receipt lookup.
    const receipt = /** @type {{ status?: number } | null | undefined} */ (await account.getTransactionReceipt(hash))

    if (!receipt) {
      if (typeof account.getTransaction === 'function' && !(await account.getTransaction(hash))) {
        throw new NoSuchElementError(`No swidge found for id ('${id}').`)
      }

      return { status: 'pending', transactions }
    }

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
   * @throws {ProviderError} If the Zerion API fails to return the chains or their native assets.
   */
  async getSupportedChains () {
    const chains = (await this._getChains()).filter(chain => chain.flags.supports_trading)

    const nativeTokens = await mapWithConcurrency(chains, NATIVE_SYMBOL_CONCURRENCY, async (chain) => {
      if (NATIVE_TOKEN_SYMBOLS[chain.id]) return NATIVE_TOKEN_SYMBOLS[chain.id]

      try {
        return (await this._resolveToken('native', chain)).symbol
      } catch (err) {
        if (err instanceof ZerionApiError) throw err

        throw new ProviderError(`Could not resolve the native asset of chain ('${chain.id}').`, { reason: 'NATIVE_ASSET_UNRESOLVED', cause: err })
      }
    })

    return chains.map((chain, index) => ({
      id: chain.id,
      name: chain.name,
      type: chain.id === 'solana' ? 'svm' : 'evm',
      nativeToken: nativeTokens[index]
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
   * @throws {ValueError} If a chain filter cannot be resolved.
   * @throws {ProviderRequiredError} If no chain filter is given and the account is not connected to a provider.
   * @throws {ProviderError} If the Zerion API fails to return the tokens.
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

  /** @private */
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

  /** @private */
  _assertWritableAccount () {
    if (typeof (/** @type {*} */ (this._account))?.sendTransaction === 'function') return

    throw new AccountRequiredError("The 'swidge(options)' method requires the protocol to be initialized with a non read-only evm account.")
  }

  /** @private */
  async _waitForTransaction (hash, config) {
    const interval = config.approvalPollIntervalMs ?? DEFAULT_APPROVAL_POLL_INTERVAL_MS
    const timeout = config.approvalTimeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS
    const deadline = Date.now() + timeout
    const account = /** @type {*} */ (this._account)

    while (true) {
      const receipt = await account.getTransactionReceipt(hash)

      if (receipt) {
        if (receipt.status === 0) {
          throw new ProviderError(`The approval transaction ('${hash}') reverted.`, { reason: 'APPROVAL_REVERTED' })
        }

        return receipt
      }

      if (Date.now() >= deadline) {
        throw new ProviderError(`The approval transaction ('${hash}') was not confirmed within ${timeout}ms.`, { reason: 'APPROVAL_TIMEOUT' })
      }

      await sleep(interval)
    }
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
      throw new ProviderRequiredError('The wallet must be connected to a provider in order to perform swidge operations.')
    }

    if (!this._accountChainPromise) {
      this._accountChainPromise = (async () => {
        try {
          if (configuredChainId !== undefined) {
            return await this._normalizeChain(configuredChainId)
          }

          let network

          try {
            network = await this._provider.getNetwork()
          } catch (err) {
            throw new ProviderError(`The account provider could not report its network: ${err?.message ?? err}.`, { reason: 'NETWORK_DETECTION_FAILED', cause: err })
          }

          return await this._normalizeChain(network.chainId)
        } catch (err) {
          this._accountChainPromise = undefined

          throw err
        }
      })()
    }

    return this._accountChainPromise
  }

  /** @private */
  async _normalizeChain (chainRef) {
    const chains = await this._getChains()

    if (typeof chainRef === 'string' && !/^\d+$/.test(chainRef) && !chainRef.startsWith('0x')) {
      const chain = chains.find(c => c.id === chainRef)

      if (chain) return chain

      throw new ValueError(`Unknown chain ('${chainRef}'). Use a Zerion chain id (see getSupportedChains) or an EIP-155 chain id.`)
    }

    let numericId

    try {
      numericId = BigInt(chainRef)
    } catch {
      throw new ValueError(`Invalid chain reference ('${chainRef}').`)
    }

    const chain = chains.find(c => {
      try {
        return c.externalId !== undefined && BigInt(c.externalId) === numericId
      } catch {
        return false
      }
    })

    if (chain) return chain

    throw new ValueError(`Chain with id '${chainRef}' is not supported by Zerion.`)
  }

  /** @private */
  async _resolveToken (token, chain) {
    if (typeof token !== 'string' || token.length === 0) {
      throw new ValueError(`Invalid token reference: '${token}'.`)
    }

    const cacheKey = `${chain.id}:${token.toLowerCase()}`

    const cached = this._tokenCache.get(cacheKey)

    if (cached) return cached

    let response

    try {
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
    } catch (err) {
      if (err?.status === 404) {
        throw new InvalidTokenError(`Token ('${token}') is not known to Zerion.`, { cause: err })
      }

      throw err
    }

    const fungible = response?.data

    const implementation = (fungible?.attributes?.implementations ?? [])
      .find(i => i.chain_id === chain.id)

    if (!fungible || !implementation) {
      throw new InvalidTokenError(`Token ('${token}') has no implementation on chain ('${chain.id}').`)
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
      throw new ReadOnlyAccountRequiredError('Swidge quotes require the protocol to be initialized with a wallet account.')
    }

    if (options.toTokenAmount !== undefined) {
      throw new ValueError('The Zerion swap API supports exact-input operations only. Specify fromTokenAmount instead of toTokenAmount.')
    }

    if (options.fromTokenAmount === undefined || options.fromTokenAmount === null) {
      throw new ValueError("The 'fromTokenAmount' option is required.")
    }

    const amount = toBaseUnitAmount(options.fromTokenAmount, 'fromTokenAmount')

    if (amount <= 0n) {
      throw new ValueError("The 'fromTokenAmount' option must be positive.")
    }

    if (options.slippage !== undefined && (typeof options.slippage !== 'number' || !Number.isFinite(options.slippage) || options.slippage < 0 || options.slippage >= 1)) {
      throw new ValueError("The 'slippage' option must be a decimal between 0 and 1 (e.g. 0.01 for 1%).")
    }

    const inputChain = await this._getAccountChain()

    const outputChain = options.toChain === undefined || options.toChain === null
      ? inputChain
      : await this._normalizeChain(options.toChain)

    if (outputChain.id === 'solana' && !options.recipient) {
      throw new ValueError("The 'recipient' option is required when the destination chain is 'solana'.")
    }

    const from = await this._account.getAddress()

    if (options.refundAddress !== undefined && options.refundAddress.toLowerCase() !== from.toLowerCase()) {
      throw new ValueError('Zerion routes always refund the sending wallet; a distinct refundAddress is not supported.')
    }

    const input = await this._resolveToken(options.fromToken, inputChain)

    // Identical identifiers on both sides mean "the same asset" (a bridge), so the
    // destination side is resolved through the canonical fungible id: token
    // addresses differ across chains, fungible ids do not.
    const output = options.toToken === options.fromToken && outputChain.id !== inputChain.id
      ? await this._resolveToken(input.fungibleId, outputChain)
      : await this._resolveToken(options.toToken, outputChain)

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
      { reason: toSwidgeErrorReason(error?.code), code: error?.code, hint: error?.hint }
    )
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
      throw invalidResponse('The executable quote returned mismatched source or destination chain metadata.')
    }

    if (approveTx) this._validateApproval(approveTx, swapTx, context)

    const networkFeeToken = attributes.network_fee?.fungible?.id
      ? await this._resolveFeeToken(attributes.network_fee.fungible, context)
      : await this._resolveToken('native', context.inputChain)

    const apiQuantity = attributes.network_fee?.amount?.quantity

    const account = /** @type {*} */ (this._account)
    const erc4337 = isErc4337Account(account)

    let networkFeeAmount

    if (!erc4337 && approveTx) {
      // The swap cannot be simulated before the approval is on-chain, so the
      // wallet quotes the approval and Zerion's own estimate covers the swap.
      const approvalFee = await this._quoteWithWallet(approveTx, executionConfig)

      networkFeeAmount = approvalFee + (apiQuantity !== undefined ? toBaseUnits(apiQuantity, networkFeeToken.decimals) : 0n)
    } else {
      const transactions = erc4337 ? (approveTx ? [approveTx, swapTx] : [swapTx]) : swapTx

      networkFeeAmount = await this._quoteWithWallet(transactions, executionConfig)
    }

    const networkFee = {
      amount: networkFeeAmount,
      token: networkFeeToken,
      apiQuantity
    }

    return {
      mapped: await this._mapQuote(quote, context, networkFee),
      swapTx,
      approveTx,
      networkFee
    }
  }

  /** @private */
  async _quoteWithWallet (transactions, executionConfig) {
    let walletQuote

    try {
      walletQuote = await /** @type {*} */ (this._account).quoteSendTransaction(transactions, executionConfig)
    } catch (err) {
      throw new ProviderError(`The wallet could not quote the executable transaction: ${err?.message ?? err}.`, { reason: 'ESTIMATION_FAILED', cause: err })
    }

    try {
      return toBaseUnitAmount(walletQuote?.fee, 'walletNetworkFee')
    } catch (err) {
      throw new ProviderError('The wallet returned an invalid network-fee quote.', { reason: 'ESTIMATION_FAILED', cause: err })
    }
  }

  /** @private */
  _validateEvmTransaction (evm, context, label) {
    if (!evm || typeof evm !== 'object') {
      throw invalidResponse(`The executable quote is missing its ${label} transaction.`)
    }

    if (!EVM_ADDRESS_PATTERN.test(evm.to ?? '')) {
      throw invalidResponse(`The executable quote contains an invalid ${label} transaction target.`)
    }

    if (typeof evm.from !== 'string' || evm.from.toLowerCase() !== context.from.toLowerCase()) {
      throw invalidResponse(`The executable quote contains a ${label} transaction for a different sender.`)
    }

    let sameChain = false

    try {
      sameChain = context.inputChain.externalId !== undefined && BigInt(evm.chain_id) === BigInt(context.inputChain.externalId)
    } catch {}

    if (!sameChain) {
      throw invalidResponse(`The executable quote contains a ${label} transaction for a different chain.`)
    }

    if (!EVM_DATA_PATTERN.test(evm.data ?? '')) {
      throw invalidResponse(`The executable quote contains invalid ${label} transaction data.`)
    }

    let transaction

    try {
      transaction = toEvmTransaction(evm)
    } catch (err) {
      throw invalidResponse(`The executable quote contains an invalid ${label} transaction value.`, err)
    }

    if (transaction.value < 0n) {
      throw invalidResponse(`The executable quote contains a negative ${label} transaction value.`)
    }

    return transaction
  }

  /** @private */
  _validateApproval (approveTx, swapTx, context) {
    if (!context.input.address || approveTx.to.toLowerCase() !== context.input.address.toLowerCase()) {
      throw invalidResponse('The approval transaction does not target the expected input token.')
    }

    if (approveTx.value !== 0n) {
      throw invalidResponse('The approval transaction must not transfer native value.')
    }

    const data = approveTx.data.slice(2)

    if (data.length !== 136 || data.slice(0, 8).toLowerCase() !== ERC20_APPROVE_SELECTOR) {
      throw invalidResponse('The approval transaction does not contain a valid ERC-20 approve call.')
    }

    const spender = `0x${data.slice(8, 72).slice(-40)}`
    const allowance = BigInt(`0x${data.slice(72, 136)}`)

    if (spender.toLowerCase() !== swapTx.to.toLowerCase()) {
      throw invalidResponse('The approval transaction authorizes an unexpected spender.')
    }

    if (allowance < context.amount) {
      throw invalidResponse('The approval transaction amount is below the quoted input amount.')
    }
  }

  /** @private */
  async _mapQuote (quote, context, networkFee) {
    const attributes = quote.attributes

    if (attributes.output_amount?.quantity === undefined || attributes.minimum_output_amount?.quantity === undefined) {
      throw invalidResponse('The executable quote is missing an output amount or minimum guaranteed output amount.')
    }

    let toTokenAmount, toTokenAmountMin

    try {
      toTokenAmount = toBaseUnits(attributes.output_amount.quantity, context.output.decimals)
      toTokenAmountMin = toBaseUnits(attributes.minimum_output_amount.quantity, context.output.decimals)
    } catch (err) {
      throw invalidResponse('The executable quote contains an invalid output amount.', err)
    }

    if (toTokenAmount <= 0n || toTokenAmountMin > toTokenAmount) {
      throw invalidResponse('The executable quote contains inconsistent output amounts.')
    }

    return {
      fromTokenAmount: context.amount,
      toTokenAmount,
      toTokenAmountMin,
      fees: await this._mapFees(attributes, context, networkFee),
      ...(attributes.estimated_time_seconds !== undefined ? { estimatedDuration: attributes.estimated_time_seconds } : {})
    }
  }

  /** @private */
  async _mapFees (attributes, context, networkFee) {
    /** @type {SwidgeFee[]} */
    const fees = [{
      type: 'network',
      amount: networkFee.amount,
      token: networkFee.token.fungibleId,
      chain: context.inputChain.id,
      included: false,
      description: 'Network (gas) fee'
    }]

    const append = async (block, description) => {
      const quantity = block?.amount?.quantity

      if (quantity === undefined) return

      if (!block.fungible?.id && isZeroQuantity(quantity)) return

      const token = await this._resolveFeeToken(block.fungible, context)

      fees.push({
        type: 'protocol',
        amount: toBaseUnits(block.amount.quantity, token.decimals),
        token: token.fungibleId,
        chain: context.inputChain.id,
        included: block.included_in_rate ?? false,
        description
      })
    }

    await append(attributes.protocol_fee, `Zerion protocol fee (${attributes.protocol_fee?.percentage ?? 0}%)`)

    await append(attributes.bridge_fee, 'Bridge provider fee')

    return fees
  }

  /** @private */
  async _resolveFeeToken (fungibleRef, context) {
    const fungibleId = fungibleRef?.id

    if (!fungibleId) {
      throw invalidResponse('A reported fee is missing its fungible denomination.')
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
        if (!(err instanceof InvalidTokenError)) throw err
      }
    }

    throw invalidResponse(`The reported fee token ('${fungibleId}') has no implementation on the quoted route.`)
  }

  /** @private */
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
      throw new MaximumFeeExceededError('The configured fee cap cannot be verified because the quote has no valid input USD value.')
    }

    if (networkCap !== undefined) {
      const reportedNetworkUsd = attributes.network_fee?.amount?.usd_value
      const apiQuantity = networkFee?.apiQuantity

      if (typeof reportedNetworkUsd !== 'number' || !Number.isFinite(reportedNetworkUsd) || reportedNetworkUsd < 0 || apiQuantity === undefined) {
        throw new MaximumFeeExceededError('maxNetworkFeeBps cannot be verified because the quote has no valid network-fee USD value.')
      }

      let apiNetworkAmount

      try {
        apiNetworkAmount = toBaseUnits(apiQuantity, networkFee.token.decimals)
      } catch (err) {
        throw new MaximumFeeExceededError('maxNetworkFeeBps cannot be verified because the reported network-fee amount is invalid.', { cause: err })
      }

      if (apiNetworkAmount <= 0n && networkFee.amount > 0n) {
        throw new MaximumFeeExceededError('maxNetworkFeeBps cannot be verified from a zero provider network-fee estimate.')
      }

      const networkUsd = apiNetworkAmount === 0n
        ? 0
        : reportedNetworkUsd * Number(networkFee.amount) / Number(apiNetworkAmount)

      if (!Number.isFinite(networkUsd)) {
        throw new MaximumFeeExceededError('maxNetworkFeeBps cannot be verified from the provider fee conversion data.')
      }

      const bps = (networkUsd / inputUsd) * 10_000

      if (bps > networkCap) {
        throw new MaximumFeeExceededError(`The network fee (${bps.toFixed(1)} bps) exceeds maxNetworkFeeBps (${maxNetworkFeeBps}).`)
      }
    }

    if (protocolCap !== undefined) {
      let feesUsd = 0

      for (const [name, block] of [['protocol', attributes.protocol_fee], ['bridge', attributes.bridge_fee]]) {
        if (block === undefined || block === null) continue

        const usd = block.amount?.usd_value

        if (usd === undefined && isZeroQuantity(block.amount?.quantity)) continue

        if (typeof usd !== 'number' || !Number.isFinite(usd) || usd < 0) {
          throw new MaximumFeeExceededError(`maxProtocolFeeBps cannot be verified because the ${name} fee has no valid USD value.`)
        }

        feesUsd += usd
      }

      const bps = (feesUsd / inputUsd) * 10_000

      if (bps > protocolCap) {
        throw new MaximumFeeExceededError(`The protocol and bridge fees (${bps.toFixed(1)} bps) exceed maxProtocolFeeBps (${maxProtocolFeeBps}).`)
      }
    }
  }
}
