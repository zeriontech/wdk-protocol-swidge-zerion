import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import { WalletAccountEvm, WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'

import { WalletAccountEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'

import {
  AccountRequiredError,
  BridgeError,
  InvalidTokenError,
  MaximumFeeExceededError,
  NoSuchElementError,
  ProviderError,
  ProviderRequiredError,
  ReadOnlyAccountRequiredError,
  SwapError,
  SwidgeError,
  SwidgeErrorReason,
  ValueError
} from '@tetherto/wdk-wallet/protocols'

import ZerionProtocol, { ZerionApiError, ZerionQuoteError } from '../index.js'

const DUMMY_SEED = 'cook voyage document eight skate token alien guide drink uncle term abuse'
const DUMMY_RPC_URL = 'https://mock-rpc-url.com'

const DUMMY_USER_ADDRESS = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'

const DUMMY_TOKEN_IN = '0x9e6b38E072f624fdC4Fbaf7bB12a7D9e657435ce'
const DUMMY_TOKEN_OUT = '0x73091d62F1F11DCb172530126E9630e327770e05'
const DUMMY_TOKEN_OUT_BASE_ADDRESS = '0x' + '44'.repeat(20)
const DUMMY_BRIDGE_TOKEN_SOURCE = '0x' + '11'.repeat(20)
const DUMMY_BRIDGE_TOKEN_DESTINATION = '0x' + '22'.repeat(20)
const DUMMY_UNKNOWN_TOKEN = '0x' + '33'.repeat(20)
const DUMMY_ROUTER = '0xf90e98F3D8Dce44632E5020ABF2E122E0f99DFAb'

const DUMMY_SWAP_HASH = '0x' + 'ab'.repeat(32)
const DUMMY_APPROVE_HASH = '0x' + 'cd'.repeat(32)

const encodeApprove = (spender, allowance) =>
  `0x095ea7b3${spender.slice(2).toLowerCase().padStart(64, '0')}${allowance.toString(16).padStart(64, '0')}`

const DUMMY_APPROVE_DATA = encodeApprove(DUMMY_ROUTER, 10n ** 18n)

// Production shape of a waived protocol fee: no denomination, no fiat value.
const DUMMY_ZERO_PROTOCOL_FEE = { amount: { quantity: '0' }, base_percentage: 0.2, percentage: 0, included_in_rate: false }

// Wallet modules can ship their own copy of @tetherto/wdk-wallet. These classes
// mimic typed errors thrown by such a copy: same names, different identity.
class WdkError extends Error {
  constructor (message) {
    super(message)
    this.name = 'WdkError'
  }
}

class DummyNestedNoSuchElementError extends WdkError {
  constructor (message) {
    super(message)
    this.name = 'NoSuchElementError'
  }
}

class DummyNestedProviderRequiredError extends WdkError {
  constructor (message) {
    super(message)
    this.name = 'ProviderRequiredError'
  }
}

const DUMMY_QUOTE_ERROR = { code: 'not_enough_input_asset_balance', hint: 'topup', message: 'Not enough balance' }

const DUMMY_CHAINS = [
  { type: 'chains', id: 'ethereum', attributes: { external_id: '0x1', name: 'Ethereum', flags: { supports_trading: true, supports_bridge: true } } },
  { type: 'chains', id: 'base', attributes: { external_id: '0x2105', name: 'Base', flags: { supports_trading: true, supports_bridge: true } } },
  { type: 'chains', id: 'solana', attributes: { external_id: 'solana', name: 'Solana', flags: { supports_trading: true, supports_bridge: true } } },
  { type: 'chains', id: 'aurora', attributes: { external_id: '0x4e454152', name: 'Aurora', flags: { supports_trading: false, supports_bridge: false } } }
]

// Trading chains without a hard-coded native symbol: the first one has a native
// asset known to the (mocked) api, the second one does not.
const DUMMY_UNMAPPED_CHAIN = { type: 'chains', id: 'dummychain', attributes: { external_id: '0x539', name: 'Dummy Chain', flags: { supports_trading: true, supports_bridge: false } } }
const DUMMY_GHOST_CHAIN = { type: 'chains', id: 'ghostchain', attributes: { external_id: '0x53a', name: 'Ghost Chain', flags: { supports_trading: true, supports_bridge: false } } }

const DUMMY_ETH_FUNGIBLE = {
  type: 'fungibles',
  id: 'eth',
  attributes: {
    symbol: 'ETH',
    name: 'Ethereum',
    implementations: [
      { chain_id: 'ethereum', address: null, decimals: 18 },
      { chain_id: 'base', address: null, decimals: 18 }
    ]
  }
}

const DUMMY_NATIVE_FUNGIBLE = {
  type: 'fungibles',
  id: 'dummy-native',
  attributes: {
    symbol: 'DMY',
    name: 'Dummy Native',
    implementations: [{ chain_id: 'dummychain', address: null, decimals: 18 }]
  }
}

const DUMMY_TOKEN_IN_FUNGIBLE = {
  type: 'fungibles',
  id: 'token-in-id',
  attributes: {
    symbol: 'TIN',
    name: 'Token In',
    implementations: [{ chain_id: 'ethereum', address: DUMMY_TOKEN_IN.toLowerCase(), decimals: 18 }]
  }
}

const DUMMY_TOKEN_OUT_FUNGIBLE = {
  type: 'fungibles',
  id: 'token-out-id',
  attributes: {
    symbol: 'TOUT',
    name: 'Token Out',
    implementations: [
      { chain_id: 'ethereum', address: DUMMY_TOKEN_OUT.toLowerCase(), decimals: 6 },
      { chain_id: 'base', address: DUMMY_TOKEN_OUT_BASE_ADDRESS, decimals: 6 }
    ]
  }
}

const DUMMY_BRIDGE_TOKEN_FUNGIBLE = {
  type: 'fungibles',
  id: 'asset-uuid',
  attributes: {
    symbol: 'BRG',
    name: 'Bridge Token',
    implementations: [
      { chain_id: 'ethereum', address: DUMMY_BRIDGE_TOKEN_SOURCE, decimals: 18 },
      { chain_id: 'base', address: DUMMY_BRIDGE_TOKEN_DESTINATION, decimals: 18 }
    ]
  }
}

const DUMMY_BY_IMPLEMENTATION = {
  ethereum: DUMMY_ETH_FUNGIBLE,
  dummychain: DUMMY_NATIVE_FUNGIBLE,
  [`ethereum:${DUMMY_TOKEN_IN.toLowerCase()}`]: DUMMY_TOKEN_IN_FUNGIBLE,
  [`ethereum:${DUMMY_TOKEN_OUT.toLowerCase()}`]: DUMMY_TOKEN_OUT_FUNGIBLE,
  [`ethereum:${DUMMY_BRIDGE_TOKEN_SOURCE}`]: DUMMY_BRIDGE_TOKEN_FUNGIBLE
}

const DUMMY_FUNGIBLES_BY_ID = {
  eth: DUMMY_ETH_FUNGIBLE,
  'asset-uuid': DUMMY_BRIDGE_TOKEN_FUNGIBLE,
  'token-in-id': DUMMY_TOKEN_IN_FUNGIBLE,
  'token-out-id': DUMMY_TOKEN_OUT_FUNGIBLE,
  [DUMMY_TOKEN_OUT.toLowerCase()]: DUMMY_TOKEN_OUT_FUNGIBLE
}

const DUMMY_FUNGIBLES_LIST = {
  data: [DUMMY_ETH_FUNGIBLE, DUMMY_TOKEN_OUT_FUNGIBLE]
}

const DUMMY_SWAP_TRANSACTION = { to: DUMMY_ROUTER, value: 1_000n, data: '0x1234' }
const DUMMY_APPROVE_TRANSACTION = { to: DUMMY_TOKEN_IN.toLowerCase(), value: 0n, data: DUMMY_APPROVE_DATA }

const DUMMY_NETWORK_FEE = { type: 'network', amount: 10n ** 15n, token: 'eth', chain: 'ethereum', included: false, description: 'Network (gas) fee' }
const DUMMY_PROTOCOL_FEE = { type: 'protocol', amount: 20_000_000n, token: 'token-out-id', chain: 'ethereum', included: true, description: 'Zerion protocol fee (0.8%)' }

function makeQuote ({ approve = false, bridgeFee = false, error = null, executable = true, outputChain = 'ethereum' } = {}) {
  return {
    type: 'swap-quotes',
    id: 'quote-1',
    attributes: {
      liquidity_source: { id: 'aggregator-x', name: 'Aggregator X' },
      input_amount: { quantity: '1', value: 100, usd_value: 100, currency: 'USD' },
      output_amount: { quantity: '2500', value: 99.5, usd_value: 99.5, currency: 'USD' },
      minimum_output_amount: { quantity: '2475', value: 98.5, usd_value: 98.5, currency: 'USD' },
      output_amount_after_fees: { quantity: '2480', value: 98.7, usd_value: 98.7, currency: 'USD' },
      slippage_percent: 1,
      protocol_fee: {
        amount: { quantity: '20', value: 0.8, usd_value: 0.8, currency: 'USD' },
        base_percentage: 0.8,
        percentage: 0.8,
        included_in_rate: true,
        fungible: { type: 'fungibles', id: 'token-out-id' }
      },
      network_fee: {
        amount: { quantity: '0.001', value: 2.5, usd_value: 2.5, currency: 'USD' },
        free: false,
        fungible: { type: 'fungibles', id: 'eth' }
      },
      ...(bridgeFee
        ? {
            bridge_fee: {
              amount: { quantity: '0.002', value: 5, usd_value: 5, currency: 'USD' },
              included_in_rate: false,
              fungible: { type: 'fungibles', id: 'eth' }
            }
          }
        : {}),
      estimated_time_seconds: 30,
      ...(error ? { error } : {}),
      ...(executable
        ? {
            transaction_swap: {
              evm: {
                type: '0x2',
                from: DUMMY_USER_ADDRESS,
                to: DUMMY_ROUTER,
                nonce: '5',
                chain_id: '0x1',
                gas: '210000',
                value: '1000',
                data: '0x1234'
              }
            }
          }
        : {}),
      ...(approve
        ? {
            transaction_approve: {
              evm: {
                type: '0x2',
                from: DUMMY_USER_ADDRESS,
                to: DUMMY_TOKEN_IN.toLowerCase(),
                nonce: '5',
                chain_id: '0x1',
                gas: '60000',
                value: '0',
                data: DUMMY_APPROVE_DATA
              }
            }
          }
        : {})
    },
    relationships: {
      input_chain: { data: { type: 'chains', id: 'ethereum' } },
      output_chain: { data: { type: 'chains', id: outputChain } }
    }
  }
}

function jsonResponse (payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => payload
  }
}

async function rejectionOf (promise) {
  try {
    await promise
  } catch (err) {
    return err
  }

  throw new Error('Expected the promise to reject.')
}

describe('ZerionProtocol', () => {
  let account,
      protocol,
      fetchMock,
      chainsResponse,
      quotesResponse,
      quotesRequests

  const getNetworkMock = jest.fn()
  const getTransactionReceiptMock = jest.fn()
  const getTransactionMock = jest.fn()

  const createProtocol = (acc, config = {}) => new ZerionProtocol(acc, { apiKey: 'zk_test_key', fetch: fetchMock, ...config })

  const sameChainOptions = { fromToken: DUMMY_TOKEN_IN, toToken: DUMMY_TOKEN_OUT, fromTokenAmount: 10n ** 18n }

  beforeEach(() => {
    getNetworkMock.mockReset().mockResolvedValue({ chainId: 1n })
    getTransactionReceiptMock.mockReset()
    getTransactionMock.mockReset().mockResolvedValue({ hash: DUMMY_SWAP_HASH })

    chainsResponse = { data: DUMMY_CHAINS }
    quotesResponse = { data: [makeQuote()] }
    quotesRequests = []

    fetchMock = jest.fn(async (url) => {
      const parsed = new URL(url)

      if (parsed.pathname === '/v1/chains/') return jsonResponse(chainsResponse)

      if (parsed.pathname === '/v1/swap/quotes/') {
        quotesRequests.push(parsed)
        return jsonResponse(quotesResponse)
      }

      if (parsed.pathname === '/v1/swap/fungibles/') return jsonResponse(DUMMY_FUNGIBLES_LIST)

      if (parsed.pathname === '/v1/fungibles/by-implementation') {
        const implementation = parsed.searchParams.get('implementation')
        const fungible = DUMMY_BY_IMPLEMENTATION[implementation]

        if (!fungible) return jsonResponse({ errors: [{ title: 'not_found', detail: 'Fungible not found' }] }, 404)

        return jsonResponse({ data: fungible })
      }

      if (parsed.pathname === '/v1/fungibles/') return jsonResponse(DUMMY_FUNGIBLES_LIST)

      if (parsed.pathname.startsWith('/v1/fungibles/')) {
        const id = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop())
        const fungible = DUMMY_FUNGIBLES_BY_ID[id]

        if (!fungible) return jsonResponse({ errors: [{ title: 'not_found', detail: 'Fungible not found' }] }, 404)

        return jsonResponse({ data: fungible })
      }

      throw new Error(`Unexpected url: ${url}`)
    })
  })

  describe('with WalletAccountEvm', () => {
    beforeEach(() => {
      account = new WalletAccountEvm(DUMMY_SEED, "0'/0/0", { provider: DUMMY_RPC_URL })

      account._provider = { getNetwork: getNetworkMock }
      account.getAddress = jest.fn().mockResolvedValue(DUMMY_USER_ADDRESS)
      account.getTransactionReceipt = getTransactionReceiptMock
      account.getTransaction = getTransactionMock
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 10n ** 15n })
      account.sendTransaction = jest.fn().mockResolvedValue({ hash: DUMMY_SWAP_HASH, fee: 12_345n })

      protocol = createProtocol(account)
    })

    describe('quoteSwidge', () => {
      test('should quote a same-chain swap', async () => {
        const quote = await protocol.quoteSwidge(sameChainOptions)

        expect(quote).toEqual({
          fromTokenAmount: 10n ** 18n,
          toTokenAmount: 2_500_000_000n,
          toTokenAmountMin: 2_475_000_000n,
          fees: [DUMMY_NETWORK_FEE, DUMMY_PROTOCOL_FEE],
          estimatedDuration: 30
        })

        const request = quotesRequests[0]

        expect(request.searchParams.get('from')).toBe(DUMMY_USER_ADDRESS)
        expect(request.searchParams.get('to')).toBe(DUMMY_USER_ADDRESS)
        expect(request.searchParams.get('input[chain_id]')).toBe('ethereum')
        expect(request.searchParams.get('input[fungible_id]')).toBe('token-in-id')
        expect(request.searchParams.get('input[amount]')).toBe('1')
        expect(request.searchParams.get('output[chain_id]')).toBe('ethereum')
        expect(request.searchParams.get('output[fungible_id]')).toBe('token-out-id')
        expect(request.searchParams.get('slippage_percent')).toBeNull()
        expect(account.quoteSendTransaction).toHaveBeenCalledWith(DUMMY_SWAP_TRANSACTION, undefined)
      })

      test('should quote the approval through the wallet when the input token is not approved', async () => {
        quotesResponse = { data: [makeQuote({ approve: true })] }

        const quote = await protocol.quoteSwidge(sameChainOptions)

        expect(account.quoteSendTransaction).toHaveBeenCalledTimes(1)
        expect(account.quoteSendTransaction).toHaveBeenCalledWith(DUMMY_APPROVE_TRANSACTION, undefined)
        expect(quote.fees[0]).toEqual({ ...DUMMY_NETWORK_FEE, amount: 2n * 10n ** 15n })
      })

      test('should omit a waived protocol fee reported without a denomination', async () => {
        const quote = makeQuote()
        quote.attributes.protocol_fee = DUMMY_ZERO_PROTOCOL_FEE
        quotesResponse = { data: [quote] }
        protocol = createProtocol(account, { maxProtocolFeeBps: 1 })

        const result = await protocol.quoteSwidge(sameChainOptions)

        expect(result.fees).toEqual([DUMMY_NETWORK_FEE])
      })

      test('should keep a zero fee that carries a denomination', async () => {
        const quote = makeQuote()
        quote.attributes.protocol_fee.amount = { quantity: '0', usd_value: 0 }
        quotesResponse = { data: [quote] }

        const result = await protocol.quoteSwidge(sameChainOptions)

        expect(result.fees[1]).toEqual({ ...DUMMY_PROTOCOL_FEE, amount: 0n })
      })

      test('should select the first executable quote', async () => {
        quotesResponse = { data: [makeQuote({ executable: false, error: DUMMY_QUOTE_ERROR }), makeQuote()] }

        const quote = await protocol.quoteSwidge(sameChainOptions)

        expect(quote.toTokenAmount).toBe(2_500_000_000n)
      })

      test.each(['output_amount', 'minimum_output_amount'])('should reject executable quotes missing %s', async (field) => {
        const quote = makeQuote()
        delete quote.attributes[field]
        quotesResponse = { data: [quote] }

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(ZerionApiError)
        expect(error).toBeInstanceOf(ProviderError)
        expect(error.code).toBe('invalid_response')
        expect(error.reason).toBe('invalid_response')
      })

      test('should reject invalid executable output amounts', async () => {
        const quote = makeQuote()
        quote.attributes.minimum_output_amount.quantity = 'not-a-number'
        quotesResponse = { data: [quote] }

        await expect(protocol.quoteSwidge(sameChainOptions)).rejects.toThrow('invalid output amount')
      })

      test('should reject inconsistent executable output amounts', async () => {
        const quote = makeQuote()
        quote.attributes.minimum_output_amount.quantity = '9999'
        quotesResponse = { data: [quote] }

        await expect(protocol.quoteSwidge(sameChainOptions)).rejects.toThrow('inconsistent output amounts')
      })

      test.each([429, 503])('should propagate fee-token lookup failures with status %s', async (status) => {
        const quote = makeQuote()
        quote.attributes.network_fee.fungible.id = 'fee-token'
        quotesResponse = { data: [quote] }

        jest.spyOn(protocol._client, 'getFungible').mockRejectedValue(new ZerionApiError('api_error', 'Try again', status))

        await expect(protocol.quoteSwidge(sameChainOptions)).rejects.toMatchObject({ status })
      })

      test.each([
        ['from', DUMMY_ROUTER, 'different sender'],
        ['chain_id', '0x2105', 'different chain'],
        ['to', 'invalid-target', 'invalid swap transaction target'],
        ['data', 'not-hex', 'invalid swap transaction data']
      ])('should reject an executable transaction with invalid %s', async (field, value, message) => {
        const quote = makeQuote()
        quote.attributes.transaction_swap.evm[field] = value
        quotesResponse = { data: [quote] }

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(ZerionApiError)
        expect(error.message).toContain(message)
      })

      test('should reject a reported fee after deterministic lookup misses', async () => {
        const quote = makeQuote()
        quote.attributes.network_fee.fungible.id = 'fee-token'
        quotesResponse = { data: [quote] }

        jest.spyOn(protocol._client, 'getFungible').mockRejectedValue(new ZerionApiError('not_found', 'Missing', 404))

        await expect(protocol.quoteSwidge(sameChainOptions)).rejects.toThrow('fee token')
      })

      test('should reject a reported fee without a fungible denomination', async () => {
        const quote = makeQuote()
        delete quote.attributes.protocol_fee.fungible
        quotesResponse = { data: [quote] }

        await expect(protocol.quoteSwidge(sameChainOptions)).rejects.toThrow('missing its fungible denomination')
      })

      test('should send the api key as basic auth', async () => {
        await protocol.quoteSwidge(sameChainOptions)

        const [, init] = fetchMock.mock.calls[0]

        expect(init.headers.authorization).toBe(`Basic ${Buffer.from('zk_test_key:').toString('base64')}`)
      })

      test('should resolve native sentinels to the chain base asset', async () => {
        await protocol.quoteSwidge({ ...sameChainOptions, fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' })

        expect(quotesRequests[0].searchParams.get('input[fungible_id]')).toBe('eth')
      })

      test('should forward the slippage option in percent', async () => {
        await protocol.quoteSwidge({ ...sameChainOptions, slippage: 0.005 })

        expect(quotesRequests[0].searchParams.get('slippage_percent')).toBe('0.5')
      })

      test('should fall back to the configured default slippage', async () => {
        protocol = createProtocol(account, { slippagePercent: 2 })

        await protocol.quoteSwidge(sameChainOptions)

        expect(quotesRequests[0].searchParams.get('slippage_percent')).toBe('2')
      })

      test.each([1, -0.1, Number.NaN, '0.01'])('should reject the invalid slippage option %s', async (slippage) => {
        await expect(protocol.quoteSwidge({ ...sameChainOptions, slippage })).rejects.toThrow(ValueError)
      })

      test('should reject exact-output operations', async () => {
        const error = await rejectionOf(protocol.quoteSwidge({ fromToken: DUMMY_TOKEN_IN, toToken: DUMMY_TOKEN_OUT, toTokenAmount: 1_000_000n }))

        expect(error).toBeInstanceOf(ValueError)
        expect(error.message).toContain('exact-input')
      })

      test.each([Number.MAX_SAFE_INTEGER + 1, 1.5, '1'])('should reject the invalid input amount %s', async (amount) => {
        const error = await rejectionOf(protocol.quoteSwidge({ ...sameChainOptions, fromTokenAmount: amount }))

        expect(error).toBeInstanceOf(ValueError)
        expect(error.message).toContain('safe integer')
      })

      test('should require a positive input amount', async () => {
        await expect(protocol.quoteSwidge({ ...sameChainOptions, fromTokenAmount: 0n })).rejects.toThrow('must be positive')
        await expect(protocol.quoteSwidge({ fromToken: DUMMY_TOKEN_IN, toToken: DUMMY_TOKEN_OUT })).rejects.toThrow("'fromTokenAmount' option is required")
      })

      test('should reject unknown tokens', async () => {
        const error = await rejectionOf(protocol.quoteSwidge({ ...sameChainOptions, fromToken: DUMMY_UNKNOWN_TOKEN }))

        expect(error).toBeInstanceOf(InvalidTokenError)
        expect(error.message).toContain('not known to Zerion')
      })

      test('should reject tokens without an implementation on the destination chain', async () => {
        const error = await rejectionOf(protocol.quoteSwidge({ ...sameChainOptions, toToken: 'token-in-id', toChain: 'base' }))

        expect(error).toBeInstanceOf(InvalidTokenError)
        expect(error.message).toContain("no implementation on chain ('base')")
      })

      test.each(['unknownchain', 999_999, '0xdead'])('should reject the unknown destination chain %s', async (toChain) => {
        await expect(protocol.quoteSwidge({ ...sameChainOptions, toChain })).rejects.toThrow(ValueError)
      })

      test('should throw when the api rejects the request', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ errors: [{ title: 'unauthenticated', detail: 'Invalid api key' }] }, 401))

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(ZerionApiError)
        expect(error).toBeInstanceOf(ProviderError)
        expect(error.reason).toBe('unauthenticated')
        expect(error.status).toBe(401)
      })

      test('should throw when no routes are available', async () => {
        quotesResponse = { data: [] }

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(ZerionQuoteError)
        expect(error).toBeInstanceOf(SwidgeError)
        expect(error.reason).toBe(SwidgeErrorReason.ROUTE_NOT_SUPPORTED)
      })

      test('should map the api quote error to a swidge error reason', async () => {
        quotesResponse = { data: [makeQuote({ executable: false, error: DUMMY_QUOTE_ERROR })] }

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(ZerionQuoteError)
        expect(error.message).toBe('Not enough balance')
        expect(error.reason).toBe(SwidgeErrorReason.INSUFFICIENT_TOKEN_BALANCE)
        expect(error.code).toBe('not_enough_input_asset_balance')
        expect(error.hint).toBe('topup')
      })

      test('should reuse the account provider for failover configurations', async () => {
        const initializedProvider = { getNetwork: jest.fn().mockResolvedValue({ chainId: 1n }) }

        account._config.provider = ['https://rpc-one.example', 'https://rpc-two.example']
        account._provider = initializedProvider
        protocol = createProtocol(account)

        await protocol.quoteSwidge(sameChainOptions)

        expect(initializedProvider.getNetwork).toHaveBeenCalledTimes(1)
      })

      test('should wrap chain detection failures as provider errors and retry on the next call', async () => {
        getNetworkMock.mockRejectedValueOnce(new Error('rpc down'))

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(ProviderError)
        expect(error.reason).toBe('NETWORK_DETECTION_FAILED')
        expect(error.message).toContain('rpc down')

        const quote = await protocol.quoteSwidge(sameChainOptions)

        expect(quote.toTokenAmount).toBe(2_500_000_000n)
        expect(getNetworkMock).toHaveBeenCalledTimes(2)
      })

      test('should wrap wallet estimation failures as provider errors', async () => {
        account.quoteSendTransaction.mockRejectedValue(new Error('execution reverted'))

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(ProviderError)
        expect(error.reason).toBe('ESTIMATION_FAILED')
        expect(error.message).toContain('execution reverted')
      })
    })

    describe('swidge', () => {
      test('should execute a same-chain swap', async () => {
        const result = await protocol.swidge(sameChainOptions)

        expect(account.quoteSendTransaction).toHaveBeenCalledWith(DUMMY_SWAP_TRANSACTION, {})
        expect(account.sendTransaction).toHaveBeenCalledTimes(1)
        expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_SWAP_TRANSACTION)

        expect(result).toEqual({
          id: DUMMY_SWAP_HASH,
          hash: DUMMY_SWAP_HASH,
          fees: [{ ...DUMMY_NETWORK_FEE, amount: 12_345n }, DUMMY_PROTOCOL_FEE],
          transactions: [{ hash: DUMMY_SWAP_HASH, chain: 'ethereum', type: 'source' }],
          fromTokenAmount: 10n ** 18n,
          toTokenAmount: 2_500_000_000n,
          toTokenAmountMin: 2_475_000_000n
        })
      })

      test('should keep the quoted network fee when the wallet does not report the paid fee', async () => {
        account.sendTransaction.mockResolvedValue({ hash: DUMMY_SWAP_HASH })

        const result = await protocol.swidge(sameChainOptions)

        expect(result.fees).toEqual([DUMMY_NETWORK_FEE, DUMMY_PROTOCOL_FEE])
      })

      test('should send the approval first and wait for it to confirm', async () => {
        quotesResponse = { data: [makeQuote({ approve: true })] }
        account.sendTransaction
          .mockResolvedValueOnce({ hash: DUMMY_APPROVE_HASH, fee: 1_000n })
          .mockResolvedValueOnce({ hash: DUMMY_SWAP_HASH, fee: 12_345n })
        getTransactionReceiptMock
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ status: 1 })
        protocol = createProtocol(account, { approvalPollIntervalMs: 1 })

        const result = await protocol.swidge(sameChainOptions)

        expect(account.sendTransaction.mock.calls).toEqual([[DUMMY_APPROVE_TRANSACTION], [DUMMY_SWAP_TRANSACTION]])
        expect(getTransactionReceiptMock).toHaveBeenCalledTimes(2)
        expect(getTransactionReceiptMock).toHaveBeenCalledWith(DUMMY_APPROVE_HASH)

        expect(result.transactions).toEqual([
          { hash: DUMMY_APPROVE_HASH, chain: 'ethereum', type: 'approval' },
          { hash: DUMMY_SWAP_HASH, chain: 'ethereum', type: 'source' }
        ])
        expect(result.fees[0]).toEqual({ ...DUMMY_NETWORK_FEE, amount: 13_345n })
      })

      test('should fail when the approval reverts', async () => {
        quotesResponse = { data: [makeQuote({ approve: true })] }
        account.sendTransaction.mockResolvedValue({ hash: DUMMY_APPROVE_HASH, fee: 1_000n })
        getTransactionReceiptMock.mockResolvedValue({ status: 0 })

        const error = await rejectionOf(protocol.swidge(sameChainOptions))

        expect(error).toBeInstanceOf(ProviderError)
        expect(error.reason).toBe('APPROVAL_REVERTED')
        expect(account.sendTransaction).toHaveBeenCalledTimes(1)
      })

      test('should fail when the approval is not confirmed in time', async () => {
        quotesResponse = { data: [makeQuote({ approve: true })] }
        account.sendTransaction.mockResolvedValue({ hash: DUMMY_APPROVE_HASH, fee: 1_000n })
        getTransactionReceiptMock.mockResolvedValue(null)
        protocol = createProtocol(account, { approvalTimeoutMs: 0 })

        const error = await rejectionOf(protocol.swidge(sameChainOptions))

        expect(error).toBeInstanceOf(ProviderError)
        expect(error.reason).toBe('APPROVAL_TIMEOUT')
        expect(account.sendTransaction).toHaveBeenCalledTimes(1)
      })

      test('should surface the quote error when no executable quote exists', async () => {
        quotesResponse = { data: [makeQuote({ executable: false, error: DUMMY_QUOTE_ERROR })] }

        await expect(protocol.swidge(sameChainOptions)).rejects.toThrow('Not enough balance')
        expect(account.sendTransaction).not.toHaveBeenCalled()
      })

      test('should enforce minAmountOut', async () => {
        const error = await rejectionOf(protocol.swidge({ ...sameChainOptions, minAmountOut: 3_000_000_000n }))

        expect(error).toBeInstanceOf(ZerionQuoteError)
        expect(error.reason).toBe(SwidgeErrorReason.COULD_NOT_MET_THRESHOLD)
        expect(account.sendTransaction).not.toHaveBeenCalled()
      })

      test('should accept a satisfied minAmountOut', async () => {
        const result = await protocol.swidge({ ...sameChainOptions, minAmountOut: 2_475_000_000n })

        expect(result.hash).toBe(DUMMY_SWAP_HASH)
      })

      test('should enforce the protocol fee cap', async () => {
        const protocol = createProtocol(account, { maxProtocolFeeBps: 10 })

        const error = await rejectionOf(protocol.swidge(sameChainOptions))

        expect(error).toBeInstanceOf(MaximumFeeExceededError)
        expect(error.message).toContain('maxProtocolFeeBps')
        expect(account.sendTransaction).not.toHaveBeenCalled()
      })

      test('should enforce the network fee cap', async () => {
        const protocol = createProtocol(account, { maxNetworkFeeBps: 10 })

        const error = await rejectionOf(protocol.swidge(sameChainOptions))

        expect(error).toBeInstanceOf(MaximumFeeExceededError)
        expect(error.message).toContain('maxNetworkFeeBps')
      })

      test('should accept fees within the configured caps', async () => {
        const protocol = createProtocol(account, { maxNetworkFeeBps: 300n, maxProtocolFeeBps: 100 })

        const result = await protocol.swidge(sameChainOptions)

        expect(result.hash).toBe(DUMMY_SWAP_HASH)
      })

      test('should apply fee caps passed as execution config', async () => {
        await expect(protocol.swidge(sameChainOptions, { maxProtocolFeeBps: 10 })).rejects.toThrow(MaximumFeeExceededError)
      })

      test.each([
        ['maxNetworkFeeBps', 1, (quote) => delete quote.attributes.network_fee.amount.usd_value],
        ['maxNetworkFeeBps', 1, (quote) => delete quote.attributes.input_amount.usd_value],
        ['maxNetworkFeeBps', 1, (quote) => delete quote.attributes.network_fee.amount.quantity],
        ['maxProtocolFeeBps', 1, (quote) => delete quote.attributes.protocol_fee.amount.usd_value]
      ])('should fail closed when %s cannot be verified', async (name, cap, mutate) => {
        const quote = makeQuote()
        mutate(quote)
        quotesResponse = { data: [quote] }
        const protocol = createProtocol(account, { [name]: cap })

        const error = await rejectionOf(protocol.swidge(sameChainOptions))

        expect(error).toBeInstanceOf(MaximumFeeExceededError)
        expect(error.message).toContain('cannot be verified')
      })

      test.each([
        ['maxNetworkFeeBps', Number.NaN],
        ['maxNetworkFeeBps', -1],
        ['maxNetworkFeeBps', -1n],
        ['maxProtocolFeeBps', Number.POSITIVE_INFINITY],
        ['maxProtocolFeeBps', '10']
      ])('should reject the invalid %s value %s', async (name, value) => {
        const protocol = createProtocol(account, { [name]: value })

        await expect(protocol.swidge(sameChainOptions)).rejects.toThrow(ValueError)
      })

      test.each([
        ['authorizes an unexpected spender', (evm) => { evm.data = encodeApprove(DUMMY_USER_ADDRESS, 10n ** 18n) }, 'unexpected spender'],
        ['is below the quoted amount', (evm) => { evm.data = encodeApprove(DUMMY_ROUTER, 1n) }, 'below the quoted input amount'],
        ['targets another token', (evm) => { evm.to = DUMMY_TOKEN_OUT.toLowerCase() }, 'expected input token'],
        ['transfers native value', (evm) => { evm.value = '1' }, 'must not transfer native value'],
        ['is not an approve call', (evm) => { evm.data = '0xa9059cbb' }, 'valid ERC-20 approve call']
      ])('should reject an approval that %s', async (_, mutate, message) => {
        const quote = makeQuote({ approve: true })
        mutate(quote.attributes.transaction_approve.evm)
        quotesResponse = { data: [quote] }

        const error = await rejectionOf(protocol.swidge(sameChainOptions))

        expect(error).toBeInstanceOf(ZerionApiError)
        expect(error.message).toContain(message)
        expect(account.sendTransaction).not.toHaveBeenCalled()
      })

      test('should wrap wallet broadcast failures as provider errors', async () => {
        account.sendTransaction.mockRejectedValue(new Error('nonce too low'))

        const error = await rejectionOf(protocol.swidge(sameChainOptions))

        expect(error).toBeInstanceOf(ProviderError)
        expect(error.reason).toBe('SEND_FAILED')
        expect(error.message).toContain('nonce too low')
      })

      test('should pass through typed wallet errors when broadcasting', async () => {
        const nested = new DummyNestedProviderRequiredError('The wallet must be connected to a provider.')
        account.sendTransaction.mockRejectedValue(nested)

        await expect(protocol.swidge(sameChainOptions)).rejects.toBe(nested)
      })

      test('should keep polling the approval receipt through transient lookup failures', async () => {
        quotesResponse = { data: [makeQuote({ approve: true })] }
        account.sendTransaction
          .mockResolvedValueOnce({ hash: DUMMY_APPROVE_HASH, fee: 1_000n })
          .mockResolvedValueOnce({ hash: DUMMY_SWAP_HASH, fee: 12_345n })
        getTransactionReceiptMock
          .mockRejectedValueOnce(new Error('Archive requests require a personal token'))
          .mockResolvedValueOnce({ status: 1 })
        protocol = createProtocol(account, { approvalPollIntervalMs: 1 })

        const result = await protocol.swidge(sameChainOptions)

        expect(result.hash).toBe(DUMMY_SWAP_HASH)
        expect(getTransactionReceiptMock).toHaveBeenCalledTimes(2)
        expect(account.sendTransaction).toHaveBeenCalledTimes(2)
      })

      test('should time out with the last lookup failure when the approval receipt never loads', async () => {
        quotesResponse = { data: [makeQuote({ approve: true })] }
        account.sendTransaction.mockResolvedValue({ hash: DUMMY_APPROVE_HASH, fee: 1_000n })
        getTransactionReceiptMock.mockRejectedValue(new Error('rpc down'))
        protocol = createProtocol(account, { approvalPollIntervalMs: 1, approvalTimeoutMs: 20 })

        const error = await rejectionOf(protocol.swidge(sameChainOptions))

        expect(error).toBeInstanceOf(ProviderError)
        expect(error.reason).toBe('APPROVAL_TIMEOUT')
        expect(error.message).toContain('rpc down')
        expect(error.cause.message).toBe('rpc down')
        expect(account.sendTransaction).toHaveBeenCalledTimes(1)
      })

      test('should abort approval polling on typed wallet errors', async () => {
        quotesResponse = { data: [makeQuote({ approve: true })] }
        account.sendTransaction.mockResolvedValue({ hash: DUMMY_APPROVE_HASH, fee: 1_000n })
        const nested = new DummyNestedProviderRequiredError('The wallet must be connected to a provider.')
        getTransactionReceiptMock.mockRejectedValue(nested)

        await expect(protocol.swidge(sameChainOptions)).rejects.toBe(nested)
        expect(getTransactionReceiptMock).toHaveBeenCalledTimes(1)
      })

      test('should throw if the account is read-only', async () => {
        const readOnly = new WalletAccountReadOnlyEvm(DUMMY_USER_ADDRESS, { provider: DUMMY_RPC_URL })

        const protocol = createProtocol(readOnly)

        const error = await rejectionOf(protocol.swidge(sameChainOptions))

        expect(error).toBeInstanceOf(AccountRequiredError)
        expect(error.message).toContain('non read-only')
      })
    })

    describe('cross-chain', () => {
      test('should quote a bridge using a numeric destination chain id', async () => {
        quotesResponse = { data: [makeQuote({ outputChain: 'base' })] }

        await protocol.quoteSwidge({ ...sameChainOptions, toToken: 'token-out-id', toChain: 8453 })

        const request = quotesRequests[0]

        expect(request.searchParams.get('output[chain_id]')).toBe('base')
        expect(request.searchParams.get('output[fungible_id]')).toBe('token-out-id')
      })

      test('should fall back to fungible-id resolution for address-shaped canonical ids', async () => {
        quotesResponse = { data: [makeQuote({ outputChain: 'base' })] }

        // DUMMY_TOKEN_OUT has no by-implementation entry on base, but its
        // address doubles as a fungible id with a base implementation.
        await protocol.quoteSwidge({ ...sameChainOptions, toChain: 'base' })

        expect(quotesRequests[0].searchParams.get('output[fungible_id]')).toBe('token-out-id')
      })

      test('should build a cross-chain swidge id from the source and destination chains', async () => {
        quotesResponse = { data: [makeQuote({ outputChain: 'base' })] }

        const result = await protocol.swidge({ ...sameChainOptions, toToken: 'token-out-id', toChain: 'base' })

        expect(result.id).toBe(`ethereum:base:${DUMMY_SWAP_HASH}`)
        expect(result.hash).toBe(DUMMY_SWAP_HASH)
      })

      test('should reject quotes whose chain metadata does not match the request', async () => {
        quotesResponse = { data: [makeQuote({ outputChain: 'base' })] }

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(ZerionApiError)
        expect(error.message).toContain('mismatched')
      })

      test('should require a recipient for solana destinations', async () => {
        const error = await rejectionOf(protocol.quoteSwidge({ ...sameChainOptions, toToken: 'eth', toChain: 'solana' }))

        expect(error).toBeInstanceOf(ValueError)
        expect(error.message).toContain("The 'recipient' option is required")
      })

      test('should reject an unrelated refund address', async () => {
        const error = await rejectionOf(protocol.quoteSwidge({ ...sameChainOptions, refundAddress: '0x' + '99'.repeat(20) }))

        expect(error).toBeInstanceOf(ValueError)
        expect(error.message).toContain('refundAddress')
      })

      test('should accept a refund address equal to the sender', async () => {
        const quote = await protocol.quoteSwidge({ ...sameChainOptions, refundAddress: DUMMY_USER_ADDRESS.toLowerCase() })

        expect(quote.toTokenAmount).toBe(2_500_000_000n)
      })
    })

    describe('getSwidgeStatus', () => {
      test('should report completed for a successful same-chain swap', async () => {
        getTransactionReceiptMock.mockResolvedValue({ status: 1 })

        const result = await protocol.getSwidgeStatus(DUMMY_SWAP_HASH)

        expect(result).toEqual({
          status: 'completed',
          transactions: [{ hash: DUMMY_SWAP_HASH, chain: 'ethereum', type: 'source' }]
        })
      })

      test('should report completed for an explicit same-chain id', async () => {
        getTransactionReceiptMock.mockResolvedValue({ status: 1 })

        const result = await protocol.getSwidgeStatus(`ethereum:ethereum:${DUMMY_SWAP_HASH}`)

        expect(result.status).toBe('completed')
      })

      test('should report pending for a successful cross-chain source transaction', async () => {
        getTransactionReceiptMock.mockResolvedValue({ status: 1 })

        const result = await protocol.getSwidgeStatus(`ethereum:base:${DUMMY_SWAP_HASH}`)

        expect(result.status).toBe('pending')
      })

      test('should honour chain hints for plain-hash ids', async () => {
        getTransactionReceiptMock.mockResolvedValue({ status: 1 })

        const result = await protocol.getSwidgeStatus(DUMMY_SWAP_HASH, { fromChain: 1, toChain: 'base' })

        expect(result.status).toBe('pending')
      })

      test('should report failed when the source transaction reverted', async () => {
        getTransactionReceiptMock.mockResolvedValue({ status: 0 })

        const result = await protocol.getSwidgeStatus(DUMMY_SWAP_HASH)

        expect(result.status).toBe('failed')
      })

      test('should report pending when the source transaction is not yet mined', async () => {
        getTransactionReceiptMock.mockResolvedValue(null)

        const result = await protocol.getSwidgeStatus(DUMMY_SWAP_HASH)

        expect(result.status).toBe('pending')
        expect(getTransactionMock).toHaveBeenCalledWith(DUMMY_SWAP_HASH)
      })

      test('should throw when no transaction exists for the id', async () => {
        getTransactionReceiptMock.mockResolvedValue(null)
        getTransactionMock.mockResolvedValue(null)

        await expect(protocol.getSwidgeStatus(DUMMY_SWAP_HASH)).rejects.toThrow(NoSuchElementError)
      })

      test('should normalise the wallet not-found error', async () => {
        getTransactionReceiptMock.mockResolvedValue(null)
        getTransactionMock.mockRejectedValue(new DummyNestedNoSuchElementError(`No transaction found for '${DUMMY_SWAP_HASH}'.`))

        const error = await rejectionOf(protocol.getSwidgeStatus(DUMMY_SWAP_HASH))

        expect(error).toBeInstanceOf(NoSuchElementError)
        expect(error.message).toContain('No swidge found')
        expect(error.cause).toBeInstanceOf(DummyNestedNoSuchElementError)
      })

      test('should wrap receipt lookup failures as provider errors', async () => {
        getTransactionReceiptMock.mockRejectedValue(new Error('server response 403 Forbidden'))

        const error = await rejectionOf(protocol.getSwidgeStatus(DUMMY_SWAP_HASH))

        expect(error).toBeInstanceOf(ProviderError)
        expect(error.reason).toBe('RECEIPT_LOOKUP_FAILED')
        expect(error.message).toContain('403 Forbidden')
      })

      test('should wrap transaction lookup failures as provider errors', async () => {
        getTransactionReceiptMock.mockResolvedValue(null)
        getTransactionMock.mockRejectedValue(new Error('rpc down'))

        const error = await rejectionOf(protocol.getSwidgeStatus(DUMMY_SWAP_HASH))

        expect(error).toBeInstanceOf(ProviderError)
        expect(error.reason).toBe('RECEIPT_LOOKUP_FAILED')
      })

      test('should pass through typed wallet errors from a duplicated wdk-wallet copy', async () => {
        const nested = new DummyNestedProviderRequiredError('The wallet must be connected to a provider.')
        getTransactionReceiptMock.mockRejectedValue(nested)

        await expect(protocol.getSwidgeStatus(DUMMY_SWAP_HASH)).rejects.toBe(nested)
      })

      test.each(['', 'not-a-hash', `ethereum:base:${DUMMY_SWAP_HASH}:extra`])('should reject the malformed id %s', async (id) => {
        await expect(protocol.getSwidgeStatus(id)).rejects.toThrow(ValueError)
      })

      test('should throw when the account is not on the source chain', async () => {
        const error = await rejectionOf(protocol.getSwidgeStatus(`base:ethereum:${DUMMY_SWAP_HASH}`))

        expect(error).toBeInstanceOf(ValueError)
        expect(error.message).toContain("source chain ('base')")
      })
    })

    describe('swap and bridge delegation', () => {
      test('should support the swap interface', async () => {
        const result = await protocol.swap({ tokenIn: DUMMY_TOKEN_IN, tokenOut: DUMMY_TOKEN_OUT, tokenInAmount: 10n ** 18n })

        expect(result).toEqual({
          hash: DUMMY_SWAP_HASH,
          fee: 12_345n + 20_000_000n,
          tokenInAmount: 10n ** 18n,
          tokenOutAmount: 2_500_000_000n
        })
        expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_SWAP_TRANSACTION)
      })

      test('should reject exact-out swaps', async () => {
        await expect(protocol.swap({ tokenIn: DUMMY_TOKEN_IN, tokenOut: DUMMY_TOKEN_OUT, tokenOutAmount: 1_000_000n }))
          .rejects.toThrow(ValueError)
      })

      test('should forward minAmountOut through the swap interface', async () => {
        const error = await rejectionOf(protocol.swap({
          tokenIn: DUMMY_TOKEN_IN,
          tokenOut: DUMMY_TOKEN_OUT,
          tokenInAmount: 10n ** 18n,
          minAmountOut: 3_000_000_000n
        }))

        expect(error).toBeInstanceOf(SwapError)
        expect(error.reason).toBe(SwidgeErrorReason.COULD_NOT_MET_THRESHOLD)
        expect(error.cause).toBeInstanceOf(ZerionQuoteError)
        expect(account.sendTransaction).not.toHaveBeenCalled()
      })

      test('should report the total fee through the swap quote interface', async () => {
        const result = await protocol.quoteSwap({ tokenIn: DUMMY_TOKEN_IN, tokenOut: DUMMY_TOKEN_OUT, tokenInAmount: 10n ** 18n })

        expect(result).toEqual({
          fee: 10n ** 15n + 20_000_000n,
          tokenInAmount: 10n ** 18n,
          tokenOutAmount: 2_500_000_000n
        })
      })

      test('should split bridge quotes into network and protocol fees', async () => {
        quotesResponse = { data: [makeQuote({ bridgeFee: true, outputChain: 'base' })] }

        const result = await protocol.quoteBridge({
          token: DUMMY_TOKEN_OUT,
          targetChain: 'base',
          recipient: DUMMY_USER_ADDRESS,
          amount: 10n ** 6n
        })

        expect(result).toEqual({ fee: 10n ** 15n, bridgeFee: 20_000_000n + 2n * 10n ** 15n })
      })

      test('should bridge by canonical fungible id when chain addresses differ', async () => {
        quotesResponse = { data: [makeQuote({ outputChain: 'base' })] }

        await protocol.quoteBridge({
          token: DUMMY_BRIDGE_TOKEN_SOURCE,
          targetChain: 'base',
          recipient: DUMMY_USER_ADDRESS,
          amount: 10n ** 18n
        })

        expect(quotesRequests[0].searchParams.get('input[fungible_id]')).toBe('asset-uuid')
        expect(quotesRequests[0].searchParams.get('output[fungible_id]')).toBe('asset-uuid')
        expect(quotesRequests[0].searchParams.get('output[chain_id]')).toBe('base')
      })

      test('should execute a bridge through the legacy interface', async () => {
        quotesResponse = { data: [makeQuote({ outputChain: 'base' })] }

        const result = await protocol.bridge({
          token: DUMMY_BRIDGE_TOKEN_SOURCE,
          targetChain: 'base',
          recipient: DUMMY_USER_ADDRESS,
          amount: 10n ** 18n
        })

        expect(result).toEqual({ hash: `ethereum:base:${DUMMY_SWAP_HASH}`, fee: 12_345n, bridgeFee: 20_000_000n })
        expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_SWAP_TRANSACTION)
      })

      test('should wrap swidge errors as bridge errors', async () => {
        quotesResponse = { data: [] }

        const error = await rejectionOf(protocol.bridge({ token: DUMMY_BRIDGE_TOKEN_SOURCE, targetChain: 'base', amount: 10n ** 18n }))

        expect(error).toBeInstanceOf(BridgeError)
        expect(error.reason).toBe(SwidgeErrorReason.ROUTE_NOT_SUPPORTED)
        expect(error.cause).toBeInstanceOf(ZerionQuoteError)
      })
    })

    describe('hardening', () => {
      test.each(['0xzz', 1.5])('should reject the invalid chain reference %s', async (toChain) => {
        const error = await rejectionOf(protocol.quoteSwidge({ ...sameChainOptions, toChain }))

        expect(error).toBeInstanceOf(ValueError)
        expect(error.message).toContain('Invalid chain reference')
      })

      test('should denominate the network fee in the native token when the api omits it', async () => {
        const quote = makeQuote()
        delete quote.attributes.network_fee.fungible
        quotesResponse = { data: [quote] }

        const result = await protocol.quoteSwidge(sameChainOptions)

        expect(result.fees[0]).toEqual(DUMMY_NETWORK_FEE)
      })

      test('should reject an invalid wallet fee quote', async () => {
        account.quoteSendTransaction.mockResolvedValue({ fee: 'abc' })

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(ProviderError)
        expect(error.reason).toBe('ESTIMATION_FAILED')
        expect(error.message).toContain('invalid network-fee quote')
      })

      test('should fail closed when the network fee conversion overflows', async () => {
        account.quoteSendTransaction.mockResolvedValue({ fee: 2n ** 1100n })
        protocol = createProtocol(account, { maxNetworkFeeBps: 1 })

        await expect(protocol.quoteSwidge(sameChainOptions)).rejects.toThrow('provider fee conversion data')
      })

      test('should treat oversized bigint fee caps as unlimited', async () => {
        protocol = createProtocol(account, { maxNetworkFeeBps: 2n ** 64n, maxProtocolFeeBps: 2n ** 64n })

        const result = await protocol.swidge(sameChainOptions)

        expect(result.hash).toBe(DUMMY_SWAP_HASH)
      })

      test('should reject non-string token references', async () => {
        const error = await rejectionOf(protocol.quoteSwidge({ ...sameChainOptions, fromToken: 123 }))

        expect(error).toBeInstanceOf(ValueError)
        expect(error.message).toContain('Invalid token reference')
      })

      test.each([
        ['abc', 'invalid swap transaction value'],
        ['-1', 'negative swap transaction value']
      ])('should reject an executable transaction whose value is %s', async (value, message) => {
        const quote = makeQuote()
        quote.attributes.transaction_swap.evm.value = value
        quotesResponse = { data: [quote] }

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(ZerionApiError)
        expect(error.message).toContain(message)
      })

      test('should reject an approval when the input token is native', async () => {
        quotesResponse = { data: [makeQuote({ approve: true })] }

        const error = await rejectionOf(protocol.swidge({ ...sameChainOptions, fromToken: 'eth' }))

        expect(error).toBeInstanceOf(ZerionApiError)
        expect(error.message).toContain('expected input token')
        expect(account.sendTransaction).not.toHaveBeenCalled()
      })

      test('should fail closed when the provider reports a zero network fee for a non-zero wallet estimate', async () => {
        const quote = makeQuote()
        quote.attributes.network_fee.amount.quantity = '0'
        quotesResponse = { data: [quote] }
        protocol = createProtocol(account, { maxNetworkFeeBps: 1 })

        await expect(protocol.quoteSwidge(sameChainOptions)).rejects.toThrow('zero provider network-fee estimate')
      })

      test('should accept a zero network fee when the wallet estimate is also zero', async () => {
        const quote = makeQuote()
        quote.attributes.network_fee.amount.quantity = '0'
        quotesResponse = { data: [quote] }
        account.quoteSendTransaction.mockResolvedValue({ fee: 0n })
        protocol = createProtocol(account, { maxNetworkFeeBps: 1 })

        const result = await protocol.quoteSwidge(sameChainOptions)

        expect(result.fees[0].amount).toBe(0n)
      })

      test('should fail closed when the reported network fee amount is invalid', async () => {
        const quote = makeQuote()
        quote.attributes.network_fee.amount.quantity = 'abc'
        quotesResponse = { data: [quote] }
        protocol = createProtocol(account, { maxNetworkFeeBps: 1 })

        const error = await rejectionOf(protocol.quoteSwidge(sameChainOptions))

        expect(error).toBeInstanceOf(MaximumFeeExceededError)
        expect(error.message).toContain('network-fee amount is invalid')
        expect(error.cause).toBeInstanceOf(ValueError)
      })

      test('should include bridge fees in the protocol fee cap', async () => {
        quotesResponse = { data: [makeQuote({ bridgeFee: true, outputChain: 'base' })] }
        protocol = createProtocol(account, { maxProtocolFeeBps: 100 })

        const error = await rejectionOf(protocol.quoteSwidge({ ...sameChainOptions, toToken: 'token-out-id', toChain: 'base' }))

        expect(error).toBeInstanceOf(MaximumFeeExceededError)
        expect(error.message).toContain('protocol and bridge fees')
      })

      test('should fail closed when a bridge fee has no fiat value', async () => {
        const quote = makeQuote({ bridgeFee: true, outputChain: 'base' })
        delete quote.attributes.bridge_fee.amount.usd_value
        quotesResponse = { data: [quote] }
        protocol = createProtocol(account, { maxProtocolFeeBps: 10_000 })

        await expect(protocol.quoteSwidge({ ...sameChainOptions, toToken: 'token-out-id', toChain: 'base' }))
          .rejects.toThrow('bridge fee has no valid USD value')
      })
    })

    describe('getSupportedTokens', () => {
      test('should default to the account chain when no filter is given', async () => {
        const tokens = await protocol.getSupportedTokens()

        expect(tokens.map(token => token.chain)).toEqual(['ethereum', 'ethereum'])

        const url = new URL(fetchMock.mock.calls.find(([u]) => new URL(u).pathname === '/v1/fungibles/')[0])

        expect(url.searchParams.get('filter[implementation_chain_id]')).toBe('ethereum')
      })
    })
  })

  describe('with WalletAccountEvmErc4337', () => {
    beforeEach(() => {
      account = new WalletAccountEvmErc4337(DUMMY_SEED, "0'/0/0", {
        chainId: 1,
        provider: DUMMY_RPC_URL,
        safeModulesVersion: '0.3.0'
      })

      account.getAddress = jest.fn().mockResolvedValue(DUMMY_USER_ADDRESS)
      account.getTransactionReceipt = getTransactionReceiptMock
      account.getTransaction = getTransactionMock
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 10n ** 15n })
      account.sendTransaction = jest.fn().mockResolvedValue({ hash: DUMMY_SWAP_HASH, fee: 12_345n })

      protocol = createProtocol(account)
    })

    test('should bundle the approval with the swap', async () => {
      quotesResponse = { data: [makeQuote({ approve: true })] }

      const result = await protocol.swidge(sameChainOptions, { paymasterToken: 'USDT' })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith([DUMMY_APPROVE_TRANSACTION, DUMMY_SWAP_TRANSACTION], { paymasterToken: 'USDT' })
      expect(account.sendTransaction).toHaveBeenCalledTimes(1)
      expect(account.sendTransaction).toHaveBeenCalledWith([DUMMY_APPROVE_TRANSACTION, DUMMY_SWAP_TRANSACTION], { paymasterToken: 'USDT' })
      expect(getTransactionReceiptMock).not.toHaveBeenCalled()

      expect(result.id).toBe(DUMMY_SWAP_HASH)
      expect(result.hash).toBe(DUMMY_SWAP_HASH)
      expect(result.transactions).toEqual([
        { hash: DUMMY_SWAP_HASH, chain: 'ethereum', type: 'approval' },
        { hash: DUMMY_SWAP_HASH, chain: 'ethereum', type: 'source' }
      ])
      expect(result.fees).toEqual([{ ...DUMMY_NETWORK_FEE, amount: 12_345n }, DUMMY_PROTOCOL_FEE])
    })

    test('should send a single transaction when no approval is needed', async () => {
      const result = await protocol.swidge(sameChainOptions)

      expect(account.sendTransaction).toHaveBeenCalledWith([DUMMY_SWAP_TRANSACTION], {})
      expect(result.transactions).toEqual([{ hash: DUMMY_SWAP_HASH, chain: 'ethereum', type: 'source' }])
    })

    test('should quote the bundled user operation as a whole', async () => {
      quotesResponse = { data: [makeQuote({ approve: true })] }

      const quote = await protocol.quoteSwidge(sameChainOptions)

      expect(account.quoteSendTransaction).toHaveBeenCalledWith([DUMMY_APPROVE_TRANSACTION, DUMMY_SWAP_TRANSACTION], undefined)
      expect(quote.fees[0]).toEqual(DUMMY_NETWORK_FEE)
    })

    test('should default token discovery to the configured chain', async () => {
      const tokens = await protocol.getSupportedTokens()

      expect(tokens.map(token => token.chain)).toEqual(['ethereum', 'ethereum'])
    })

    test('should resolve status through the erc-4337 account', async () => {
      getTransactionReceiptMock.mockResolvedValue({ status: 1 })

      const result = await protocol.getSwidgeStatus(`ethereum:ethereum:${DUMMY_SWAP_HASH}`)

      expect(account.getTransactionReceipt).toHaveBeenCalledWith(DUMMY_SWAP_HASH)
      expect(result.status).toBe('completed')
    })
  })

  describe('without an account', () => {
    beforeEach(() => {
      protocol = createProtocol(undefined)
    })

    test('should list chains that support trading', async () => {
      const chains = await protocol.getSupportedChains()

      expect(chains).toEqual([
        { id: 'ethereum', name: 'Ethereum', type: 'evm', nativeToken: 'ETH' },
        { id: 'base', name: 'Base', type: 'evm', nativeToken: 'ETH' },
        { id: 'solana', name: 'Solana', type: 'svm', nativeToken: 'SOL' }
      ])
    })

    test('should resolve native tokens through the api for chains without a known symbol', async () => {
      chainsResponse = { data: [...DUMMY_CHAINS, DUMMY_UNMAPPED_CHAIN] }

      const chains = await protocol.getSupportedChains()

      expect(chains[3]).toEqual({ id: 'dummychain', name: 'Dummy Chain', type: 'evm', nativeToken: 'DMY' })

      const lookups = fetchMock.mock.calls
        .map(([u]) => new URL(u))
        .filter(u => u.pathname === '/v1/fungibles/by-implementation')
        .map(u => u.searchParams.get('implementation'))

      expect(lookups).toEqual(['dummychain'])
    })

    test('should fail when a native asset cannot be resolved', async () => {
      chainsResponse = { data: [...DUMMY_CHAINS, DUMMY_GHOST_CHAIN] }

      const error = await rejectionOf(protocol.getSupportedChains())

      expect(error).toBeInstanceOf(ProviderError)
      expect(error.reason).toBe('NATIVE_ASSET_UNRESOLVED')
      expect(error.cause).toBeInstanceOf(InvalidTokenError)
    })

    test('should propagate api failures while resolving native assets', async () => {
      chainsResponse = { data: [...DUMMY_CHAINS, DUMMY_UNMAPPED_CHAIN] }

      jest.spyOn(protocol._client, 'getFungibleByImplementation').mockRejectedValue(new ZerionApiError('api_error', 'Try again', 503))

      const error = await rejectionOf(protocol.getSupportedChains())

      expect(error).toBeInstanceOf(ZerionApiError)
      expect(error.status).toBe(503)
    })

    test('should list top tokens on a single chain by market cap', async () => {
      const tokens = await protocol.getSupportedTokens({ fromChain: 'ethereum' })

      expect(tokens).toEqual([
        { token: 'eth', chain: 'ethereum', symbol: 'ETH', decimals: 18, name: 'Ethereum' },
        { token: 'token-out-id', chain: 'ethereum', symbol: 'TOUT', decimals: 6, address: DUMMY_TOKEN_OUT.toLowerCase(), name: 'Token Out' }
      ])

      const url = new URL(fetchMock.mock.calls.find(([u]) => new URL(u).pathname === '/v1/fungibles/')[0])

      expect(url.searchParams.get('filter[implementation_chain_id]')).toBe('ethereum')
      expect(url.searchParams.get('sort')).toBe('-market_data.market_cap')
    })

    test('should default to ethereum when neither a chain filter nor an account is available', async () => {
      const tokens = await protocol.getSupportedTokens()

      expect(tokens.map(token => token.chain)).toEqual(['ethereum', 'ethereum'])
    })

    test('should list tokens on the destination chain only', async () => {
      const tokens = await protocol.getSupportedTokens({ toChain: 8453 })

      expect(tokens).toEqual([
        { token: 'eth', chain: 'base', symbol: 'ETH', decimals: 18, name: 'Ethereum' },
        { token: 'token-out-id', chain: 'base', symbol: 'TOUT', decimals: 6, address: DUMMY_TOKEN_OUT_BASE_ADDRESS, name: 'Token Out' }
      ])
    })

    test('should list route tokens for a cross-chain pair', async () => {
      const tokens = await protocol.getSupportedTokens({ fromChain: 'ethereum', toChain: 'base' })

      expect(tokens).toEqual([
        { token: 'eth', chain: 'ethereum', symbol: 'ETH', decimals: 18, name: 'Ethereum' },
        { token: 'token-out-id', chain: 'ethereum', symbol: 'TOUT', decimals: 6, address: DUMMY_TOKEN_OUT.toLowerCase(), name: 'Token Out' },
        { token: 'eth', chain: 'base', symbol: 'ETH', decimals: 18, name: 'Ethereum' },
        { token: 'token-out-id', chain: 'base', symbol: 'TOUT', decimals: 6, address: DUMMY_TOKEN_OUT_BASE_ADDRESS, name: 'Token Out' }
      ])

      const routeCalls = fetchMock.mock.calls
        .map(([u]) => new URL(u))
        .filter(u => u.pathname === '/v1/swap/fungibles/')

      expect(routeCalls.map(u => u.searchParams.get('direction')).sort()).toEqual(['input', 'output'])

      for (const url of routeCalls) {
        expect(url.searchParams.get('input[chain_id]')).toBe('ethereum')
        expect(url.searchParams.get('output[chain_id]')).toBe('base')
      }
    })

    test('should reject unknown chain filters', async () => {
      await expect(protocol.getSupportedTokens({ fromChain: 'unknownchain' })).rejects.toThrow(ValueError)
    })

    test('should retry chain discovery after an api failure', async () => {
      protocol = createProtocol(undefined, { maxRetries: 0 })
      fetchMock.mockResolvedValueOnce(jsonResponse({ errors: [{ title: 'internal', detail: 'boom' }] }, 500))

      await expect(protocol.getSupportedChains()).rejects.toThrow(ZerionApiError)

      const chains = await protocol.getSupportedChains()

      expect(chains).toHaveLength(3)
    })

    test('should propagate api failures while listing chains', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ errors: [{ title: 'unauthenticated', detail: 'Invalid api key' }] }, 401))

      await expect(protocol.getSupportedChains()).rejects.toThrow(ZerionApiError)
    })

    test('should throw when quoting without an account', async () => {
      await expect(protocol.quoteSwidge(sameChainOptions)).rejects.toThrow(ReadOnlyAccountRequiredError)
    })

    test('should throw when executing without an account', async () => {
      await expect(protocol.swidge(sameChainOptions)).rejects.toThrow(AccountRequiredError)
    })

    test('should require a provider to track swidge status', async () => {
      await expect(protocol.getSwidgeStatus(DUMMY_SWAP_HASH)).rejects.toThrow(ProviderRequiredError)
    })
  })
})
