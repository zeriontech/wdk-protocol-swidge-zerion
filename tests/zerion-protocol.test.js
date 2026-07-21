import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import { WalletAccountEvm, WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'

import { WalletAccountEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'

const SEED = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const USER_ADDRESS = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'

const TOKEN_IN = '0x9e6b38E072f624fdC4Fbaf7bB12a7D9e657435ce'
const TOKEN_OUT = '0x73091d62F1F11DCb172530126E9630e327770e05'
const BRIDGE_TOKEN_SOURCE = '0x' + '11'.repeat(20)
const BRIDGE_TOKEN_DESTINATION = '0x' + '22'.repeat(20)
const ROUTER = '0xf90e98F3D8Dce44632E5020ABF2E122E0f99DFAb'

const SWAP_HASH = '0x' + 'ab'.repeat(32)
const APPROVE_DATA = `0x095ea7b3${ROUTER.slice(2).toLowerCase().padStart(64, '0')}${(10n ** 18n).toString(16).padStart(64, '0')}`

const getNetworkMock = jest.fn()
const getTransactionReceiptMock = jest.fn()

const { default: ZerionProtocol, ZerionApiError, ZerionAllowanceError, ZerionCapabilityError, ZerionQuoteError } = await import('../index.js')

const CHAINS_RESPONSE = {
  data: [
    { type: 'chains', id: 'ethereum', attributes: { external_id: '0x1', name: 'Ethereum', flags: { supports_trading: true, supports_bridge: true } } },
    { type: 'chains', id: 'base', attributes: { external_id: '0x2105', name: 'Base', flags: { supports_trading: true, supports_bridge: true } } },
    { type: 'chains', id: 'solana', attributes: { external_id: 'solana', name: 'Solana', flags: { supports_trading: true, supports_bridge: true } } },
    { type: 'chains', id: 'aurora', attributes: { external_id: '0x4e454152', name: 'Aurora', flags: { supports_trading: false, supports_bridge: false } } }
  ]
}

const ETH_FUNGIBLE = {
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

const TOKEN_IN_FUNGIBLE = {
  type: 'fungibles',
  id: 'token-in-id',
  attributes: {
    symbol: 'TIN',
    name: 'Token In',
    implementations: [{ chain_id: 'ethereum', address: TOKEN_IN.toLowerCase(), decimals: 18 }]
  }
}

const TOKEN_OUT_FUNGIBLE = {
  type: 'fungibles',
  id: 'token-out-id',
  attributes: {
    symbol: 'TOUT',
    name: 'Token Out',
    implementations: [
      { chain_id: 'ethereum', address: TOKEN_OUT.toLowerCase(), decimals: 6 },
      { chain_id: 'base', address: '0x' + '11'.repeat(20), decimals: 6 }
    ]
  }
}

const BRIDGE_TOKEN_FUNGIBLE = {
  type: 'fungibles',
  id: 'asset-uuid',
  attributes: {
    symbol: 'BRG',
    name: 'Bridge Token',
    implementations: [
      { chain_id: 'ethereum', address: BRIDGE_TOKEN_SOURCE, decimals: 18 },
      { chain_id: 'base', address: BRIDGE_TOKEN_DESTINATION, decimals: 18 }
    ]
  }
}

const BY_IMPLEMENTATION = {
  ethereum: ETH_FUNGIBLE,
  [`ethereum:${TOKEN_IN.toLowerCase()}`]: TOKEN_IN_FUNGIBLE,
  [`ethereum:${TOKEN_OUT.toLowerCase()}`]: TOKEN_OUT_FUNGIBLE,
  [`ethereum:${BRIDGE_TOKEN_SOURCE}`]: BRIDGE_TOKEN_FUNGIBLE
}

const FUNGIBLES_BY_ID = {
  eth: ETH_FUNGIBLE,
  'asset-uuid': BRIDGE_TOKEN_FUNGIBLE,
  'token-out-id': TOKEN_OUT_FUNGIBLE,
  [TOKEN_OUT.toLowerCase()]: TOKEN_OUT_FUNGIBLE
}

const SWAP_FUNGIBLES_RESPONSE = {
  data: [ETH_FUNGIBLE, TOKEN_OUT_FUNGIBLE]
}

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
                from: USER_ADDRESS,
                to: ROUTER,
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
                from: USER_ADDRESS,
                to: TOKEN_IN.toLowerCase(),
                nonce: '5',
                chain_id: '0x1',
                gas: '60000',
                value: '0',
                data: APPROVE_DATA
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

describe('ZerionProtocol', () => {
  let account,
      protocol,
      fetchMock,
      quotesResponse,
      quotesRequests

  const createProtocol = (acc, config = {}) => new ZerionProtocol(acc, { apiKey: 'zk_test_key', fetch: fetchMock, ...config })

  beforeEach(() => {
    getNetworkMock.mockResolvedValue({ chainId: 1n })
    getTransactionReceiptMock.mockReset()

    quotesResponse = { data: [makeQuote()] }
    quotesRequests = []

    fetchMock = jest.fn(async (url) => {
      const parsed = new URL(url)

      if (parsed.pathname === '/v1/chains/') return jsonResponse(CHAINS_RESPONSE)

      if (parsed.pathname === '/v1/swap/quotes/') {
        quotesRequests.push(parsed)
        return jsonResponse(quotesResponse)
      }

      if (parsed.pathname === '/v1/swap/fungibles/') return jsonResponse(SWAP_FUNGIBLES_RESPONSE)

      if (parsed.pathname === '/v1/fungibles/by-implementation') {
        const implementation = parsed.searchParams.get('implementation')
        const fungible = BY_IMPLEMENTATION[implementation]

        if (!fungible) return jsonResponse({ errors: [{ title: 'not_found', detail: 'Fungible not found' }] }, 404)

        return jsonResponse({ data: fungible })
      }

      if (parsed.pathname === '/v1/fungibles/') return jsonResponse(SWAP_FUNGIBLES_RESPONSE)

      if (parsed.pathname.startsWith('/v1/fungibles/')) {
        const id = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop())
        const fungible = FUNGIBLES_BY_ID[id]

        if (!fungible) return jsonResponse({ errors: [{ title: 'not_found', detail: 'Fungible not found' }] }, 404)

        return jsonResponse({ data: fungible })
      }

      throw new Error(`Unexpected url: ${url}`)
    })
  })

  describe('with WalletAccountEvm', () => {
    beforeEach(() => {
      account = new WalletAccountEvm(SEED, "0'/0/0", { provider: 'https://mock-rpc-url.com' })

      account._provider = { getNetwork: getNetworkMock }
      account.getAddress = jest.fn().mockResolvedValue(USER_ADDRESS)
      account.getTransactionReceipt = getTransactionReceiptMock
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 10n ** 15n })
      account.sendTransaction = jest.fn().mockResolvedValue({ hash: SWAP_HASH, fee: 12_345n })

      protocol = createProtocol(account)
    })

    describe('quoteSwidge', () => {
      test('should quote a same-chain swap', async () => {
        const quote = await protocol.quoteSwidge({
          fromToken: TOKEN_IN,
          toToken: TOKEN_OUT,
          fromTokenAmount: 10n ** 18n
        })

        expect(quote.fromTokenAmount).toBe(10n ** 18n)
        expect(quote.toTokenAmount).toBe(2_500_000_000n)
        expect(quote.toTokenAmountMin).toBe(2_475_000_000n)
        expect(quote.estimatedDuration).toBe(30)

        expect(quote.fees).toEqual([
          { type: 'network', amount: 10n ** 15n, token: 'eth', chain: 'ethereum', included: false, description: 'Network (gas) fee' },
          { type: 'protocol', amount: 20_000_000n, token: 'token-out-id', chain: 'ethereum', included: true, description: 'Zerion protocol fee (0.8%)' }
        ])

        const request = quotesRequests[0]

        expect(request.searchParams.get('from')).toBe(USER_ADDRESS)
        expect(request.searchParams.get('to')).toBe(USER_ADDRESS)
        expect(request.searchParams.get('input[chain_id]')).toBe('ethereum')
        expect(request.searchParams.get('input[fungible_id]')).toBe('token-in-id')
        expect(request.searchParams.get('input[amount]')).toBe('1')
        expect(request.searchParams.get('output[chain_id]')).toBe('ethereum')
        expect(request.searchParams.get('output[fungible_id]')).toBe('token-out-id')
        expect(request.searchParams.get('slippage_percent')).toBeNull()
        expect(account.quoteSendTransaction).toHaveBeenCalledWith({
          to: ROUTER,
          value: 1_000n,
          data: '0x1234'
        }, undefined)
      })

      test.each(['output_amount', 'minimum_output_amount'])('should reject executable quotes missing %s', async (field) => {
        const quote = makeQuote()
        delete quote.attributes[field]
        quotesResponse = { data: [quote] }

        await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow(ZerionQuoteError)
      })

      test('should reject invalid executable output amounts', async () => {
        const quote = makeQuote()
        quote.attributes.minimum_output_amount.quantity = 'not-a-number'
        quotesResponse = { data: [quote] }

        await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow('invalid output amount')
      })

      test.each([429, 503])('should propagate fee-token lookup failures with status %s', async (status) => {
        const quote = makeQuote()
        quote.attributes.network_fee.fungible.id = 'fee-token'
        quotesResponse = { data: [quote] }

        jest.spyOn(protocol._client, 'getFungible').mockRejectedValue(new ZerionApiError('api_error', 'Try again', status))

        await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toMatchObject({ status })
      })

      test.each([
        ['from', ROUTER, 'different sender'],
        ['chain_id', '0x2105', 'different chain'],
        ['to', 'invalid-target', 'invalid swap transaction target']
      ])('should reject an executable transaction with invalid %s', async (field, value, message) => {
        const quote = makeQuote()
        quote.attributes.transaction_swap.evm[field] = value
        quotesResponse = { data: [quote] }

        await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow(message)
      })

      test('should reject a reported fee after deterministic lookup misses', async () => {
        const quote = makeQuote()
        quote.attributes.network_fee.fungible.id = 'fee-token'
        quotesResponse = { data: [quote] }

        jest.spyOn(protocol._client, 'getFungible').mockRejectedValue(new ZerionApiError('not_found', 'Missing', 404))

        await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow('fee token')
      })

      test('should send the api key as basic auth', async () => {
        await protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n })

        const [, init] = fetchMock.mock.calls[0]

        expect(init.headers.authorization).toBe(`Basic ${Buffer.from('zk_test_key:').toString('base64')}`)
      })

      test('should resolve native sentinels to the chain base asset', async () => {
        await protocol.quoteSwidge({
          fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          toToken: TOKEN_OUT,
          fromTokenAmount: 10n ** 18n
        })

        expect(quotesRequests[0].searchParams.get('input[fungible_id]')).toBe('eth')
      })

      test('should forward the slippage option in percent', async () => {
        await protocol.quoteSwidge({
          fromToken: TOKEN_IN,
          toToken: TOKEN_OUT,
          fromTokenAmount: 10n ** 18n,
          slippage: 0.005
        })

        expect(quotesRequests[0].searchParams.get('slippage_percent')).toBe('0.5')
      })

      test('should throw on exact-out operations', async () => {
        await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, toTokenAmount: 1_000_000n }))
          .rejects.toThrow(ZerionCapabilityError)
      })

      test.each([Number.MAX_SAFE_INTEGER + 1, 1.5])('should reject unsafe numeric input amounts (%s)', async (amount) => {
        await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: amount }))
          .rejects.toThrow('safe integer')
      })

      test('should throw when the api rejects the request', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ errors: [{ title: 'unauthenticated', detail: 'Invalid api key' }] }, 401))

        await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow(ZerionApiError)
      })

      test('should throw when no routes are available', async () => {
        quotesResponse = { data: [] }

        await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow(ZerionQuoteError)
      })

      test('should throw when no executable quote is available', async () => {
        quotesResponse = {
          data: [makeQuote({
            executable: false,
            error: { code: 'not_enough_input_asset_balance', hint: 'topup', message: 'Not enough balance' }
          })]
        }

        await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow('Not enough balance')
      })

      test('should reuse the account provider for failover configurations', async () => {
        const initializedProvider = { getNetwork: jest.fn().mockResolvedValue({ chainId: 1n }) }

        account._config.provider = ['https://rpc-one.example', 'https://rpc-two.example']
        account._provider = initializedProvider
        protocol = createProtocol(account)

        await protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n })

        expect(initializedProvider.getNetwork).toHaveBeenCalledTimes(1)
      })
    })

    describe('swidge', () => {
      test('should execute a same-chain swap', async () => {
        const result = await protocol.swidge({
          fromToken: TOKEN_IN,
          toToken: TOKEN_OUT,
          fromTokenAmount: 10n ** 18n
        })

        expect(account.sendTransaction).toHaveBeenCalledWith({
          to: ROUTER,
          value: 1_000n,
          data: '0x1234'
        })

        expect(result).toEqual({
          id: `ethereum:ethereum:${SWAP_HASH}`,
          hash: SWAP_HASH,
          fees: expect.any(Array),
          transactions: [{ hash: SWAP_HASH, chain: 'ethereum', type: 'source' }],
          fromTokenAmount: 10n ** 18n,
          toTokenAmount: 2_500_000_000n,
          toTokenAmountMin: 2_475_000_000n
        })
      })

      test('should throw an allowance error when an approval is required', async () => {
        quotesResponse = { data: [makeQuote({ approve: true })] }

        const error = await protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n })
          .catch(err => err)

        expect(error).toBeInstanceOf(ZerionAllowanceError)
        expect(error.details.token).toBe(TOKEN_IN.toLowerCase())
        expect(error.details.transaction).toEqual({ to: TOKEN_IN.toLowerCase(), value: 0n, data: APPROVE_DATA })
        expect(account.sendTransaction).not.toHaveBeenCalled()
      })

      test('should surface the quote error when no executable quote exists', async () => {
        quotesResponse = {
          data: [makeQuote({
            executable: false,
            error: { code: 'not_enough_input_asset_balance', hint: 'topup', message: 'Not enough balance' }
          })]
        }

        await expect(protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow('Not enough balance')
      })

      test('should enforce minAmountOut', async () => {
        await expect(protocol.swidge({
          fromToken: TOKEN_IN,
          toToken: TOKEN_OUT,
          fromTokenAmount: 10n ** 18n,
          minAmountOut: 3_000_000_000n
        })).rejects.toThrow('minAmountOut')
      })

      test('should enforce the protocol fee cap', async () => {
        const protocol = createProtocol(account, { maxProtocolFeeBps: 10 })

        await expect(protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow('maxProtocolFeeBps')
      })

      test('should enforce the network fee cap', async () => {
        const protocol = createProtocol(account, { maxNetworkFeeBps: 10 })

        await expect(protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow('maxNetworkFeeBps')
      })

      test('should fail closed when a network fee cap cannot be verified', async () => {
        const quote = makeQuote()
        delete quote.attributes.network_fee.amount.usd_value
        quotesResponse = { data: [quote] }
        const protocol = createProtocol(account, { maxNetworkFeeBps: 1 })

        await expect(protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toMatchObject({ code: 'fee_cap_unverifiable' })
      })

      test('should fail closed when the capped quote has no input USD value', async () => {
        const quote = makeQuote()
        delete quote.attributes.input_amount.usd_value
        quotesResponse = { data: [quote] }
        const protocol = createProtocol(account, { maxNetworkFeeBps: 1 })

        await expect(protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toMatchObject({ code: 'fee_cap_unverifiable' })
      })

      test('should fail closed when a protocol fee cap cannot be verified', async () => {
        const quote = makeQuote()
        delete quote.attributes.protocol_fee.amount.usd_value
        quotesResponse = { data: [quote] }
        const protocol = createProtocol(account, { maxProtocolFeeBps: 1 })

        await expect(protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toMatchObject({ code: 'fee_cap_unverifiable' })
      })

      test.each([
        ['maxNetworkFeeBps', NaN],
        ['maxNetworkFeeBps', -1],
        ['maxProtocolFeeBps', Number.POSITIVE_INFINITY]
      ])('should reject invalid %s values', async (name, value) => {
        const protocol = createProtocol(account, { [name]: value })

        await expect(protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toMatchObject({ code: 'invalid_config' })
      })

      test('should reject an approval that authorizes an unexpected spender', async () => {
        const quote = makeQuote({ approve: true })
        quote.attributes.transaction_approve.evm.data = `0x095ea7b3${USER_ADDRESS.slice(2).toLowerCase().padStart(64, '0')}${(10n ** 18n).toString(16).padStart(64, '0')}`
        quotesResponse = { data: [quote] }

        await expect(protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow('unexpected spender')
      })

      test('should throw if the account is read-only', async () => {
        const readOnly = new WalletAccountReadOnlyEvm(USER_ADDRESS, { provider: 'https://mock-rpc-url.com' })

        const protocol = createProtocol(readOnly)

        await expect(protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n }))
          .rejects.toThrow('non read-only')
      })
    })

    describe('cross-chain', () => {
      test('should quote a bridge using a numeric destination chain id', async () => {
        quotesResponse = { data: [makeQuote({ outputChain: 'base' })] }

        await protocol.quoteSwidge({
          fromToken: TOKEN_IN,
          toToken: 'token-out-id',
          toChain: 8453,
          fromTokenAmount: 10n ** 18n
        })

        const request = quotesRequests[0]

        expect(request.searchParams.get('output[chain_id]')).toBe('base')
        expect(request.searchParams.get('output[fungible_id]')).toBe('token-out-id')
      })

      test('should fall back to fungible-id resolution for address-shaped canonical ids', async () => {
        quotesResponse = { data: [makeQuote({ outputChain: 'base' })] }

        // TOKEN_OUT has no by-implementation entry on base, but its address
        // doubles as a fungible id with a base implementation.
        await protocol.quoteSwidge({
          fromToken: TOKEN_IN,
          toToken: TOKEN_OUT,
          toChain: 'base',
          fromTokenAmount: 10n ** 18n
        })

        expect(quotesRequests[0].searchParams.get('output[fungible_id]')).toBe('token-out-id')
      })

      test('should require a recipient for solana destinations', async () => {
        await expect(protocol.quoteSwidge({
          fromToken: TOKEN_IN,
          toToken: 'eth',
          toChain: 'solana',
          fromTokenAmount: 10n ** 18n
        })).rejects.toThrow("The 'recipient' option is required")
      })

      test('should reject an unrelated refund address', async () => {
        await expect(protocol.quoteSwidge({
          fromToken: TOKEN_IN,
          toToken: TOKEN_OUT,
          fromTokenAmount: 10n ** 18n,
          refundAddress: '0x' + '99'.repeat(20)
        })).rejects.toThrow('refundAddress')
      })
    })

    describe('getSwidgeStatus', () => {
      test('should report completed for a successful same-chain swap', async () => {
        getTransactionReceiptMock.mockResolvedValue({ status: 1 })

        const result = await protocol.getSwidgeStatus(`ethereum:ethereum:${SWAP_HASH}`)

        expect(result).toEqual({
          status: 'completed',
          transactions: [{ hash: SWAP_HASH, chain: 'ethereum', type: 'source' }]
        })
      })

      test('should report pending for a successful cross-chain source transaction', async () => {
        getTransactionReceiptMock.mockResolvedValue({ status: 1 })

        const result = await protocol.getSwidgeStatus(`ethereum:base:${SWAP_HASH}`)

        expect(result.status).toBe('pending')
      })

      test('should report failed when the source transaction reverted', async () => {
        getTransactionReceiptMock.mockResolvedValue({ status: 0 })

        const result = await protocol.getSwidgeStatus(SWAP_HASH)

        expect(result.status).toBe('failed')
      })

      test('should report pending when the source transaction is not yet mined', async () => {
        getTransactionReceiptMock.mockResolvedValue(null)

        const result = await protocol.getSwidgeStatus(SWAP_HASH)

        expect(result.status).toBe('pending')
      })

      test('should throw on malformed ids', async () => {
        await expect(protocol.getSwidgeStatus('not-a-hash')).rejects.toThrow('Invalid swidge id')
      })
    })

    describe('swap and bridge delegation', () => {
      test('should support the swap interface', async () => {
        const result = await protocol.swap({
          tokenIn: TOKEN_IN,
          tokenOut: TOKEN_OUT,
          tokenInAmount: 10n ** 18n
        })

        expect(result.tokenInAmount).toBe(10n ** 18n)
        expect(result.tokenOutAmount).toBe(2_500_000_000n)
        expect(result.hash).toBe(SWAP_HASH)
        expect(result.fee).toBe(12_345n)
        expect(account.sendTransaction).toHaveBeenCalled()
      })

      test('should use classic vocabulary for exact-out rejections', async () => {
        await expect(protocol.swap({ tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT, tokenOutAmount: 1_000_000n }))
          .rejects.toThrow('Specify tokenInAmount instead of tokenOutAmount')
      })

      test('should forward minAmountOut through the classic swap interface', async () => {
        await expect(protocol.swap({
          tokenIn: TOKEN_IN,
          tokenOut: TOKEN_OUT,
          tokenInAmount: 10n ** 18n,
          minAmountOut: 3_000_000_000n
        })).rejects.toThrow('minAmountOut')

        expect(account.sendTransaction).not.toHaveBeenCalled()
      })

      test('should expose only the network fee through the classic quote interface', async () => {
        const result = await protocol.quoteSwap({
          tokenIn: TOKEN_IN,
          tokenOut: TOKEN_OUT,
          tokenInAmount: 10n ** 18n
        })

        expect(result.fee).toBe(10n ** 15n)
      })

      test('should expose bridge-provider fees separately from protocol fees', async () => {
        quotesResponse = { data: [makeQuote({ bridgeFee: true, outputChain: 'base' })] }

        const result = await protocol.quoteBridge({
          token: TOKEN_OUT,
          targetChain: 'base',
          recipient: USER_ADDRESS,
          amount: 10n ** 6n
        })

        expect(result.fee).toBe(10n ** 15n)
        expect(result.bridgeFee).toBe(2n * 10n ** 15n)
      })

      test('should bridge by canonical fungible id when chain addresses differ', async () => {
        quotesResponse = { data: [makeQuote({ outputChain: 'base' })] }

        await protocol.quoteBridge({
          token: BRIDGE_TOKEN_SOURCE,
          targetChain: 'base',
          recipient: USER_ADDRESS,
          amount: 10n ** 18n
        })

        expect(quotesRequests[0].searchParams.get('input[fungible_id]')).toBe('asset-uuid')
        expect(quotesRequests[0].searchParams.get('output[fungible_id]')).toBe('asset-uuid')
      })
    })
  })

  describe('with WalletAccountEvmErc4337', () => {
    beforeEach(() => {
      account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://mock-rpc-url.com',
        safeModulesVersion: '0.3.0'
      })

      account.getAddress = jest.fn().mockResolvedValue(USER_ADDRESS)
      account.getTransactionReceipt = getTransactionReceiptMock
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 10n ** 15n })
      account.sendTransaction = jest.fn().mockResolvedValue({ hash: SWAP_HASH, fee: 12_345n })

      protocol = createProtocol(account)
    })

    test('should bundle the approval with the swap', async () => {
      quotesResponse = { data: [makeQuote({ approve: true })] }

      const result = await protocol.swidge({
        fromToken: TOKEN_IN,
        toToken: TOKEN_OUT,
        fromTokenAmount: 10n ** 18n
      }, { paymasterToken: 'USDT' })

      expect(account.sendTransaction).toHaveBeenCalledWith([
        { to: TOKEN_IN.toLowerCase(), value: 0n, data: APPROVE_DATA },
        { to: ROUTER, value: 1_000n, data: '0x1234' }
      ], { paymasterToken: 'USDT' })

      expect(result.hash).toBe(SWAP_HASH)
    })

    test('should send a single transaction when no approval is needed', async () => {
      await protocol.swidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 10n ** 18n })

      expect(account.sendTransaction).toHaveBeenCalledWith([
        { to: ROUTER, value: 1_000n, data: '0x1234' }
      ], {})
    })

    test('should resolve status through the erc-4337 account', async () => {
      getTransactionReceiptMock.mockResolvedValue({ status: 1 })

      const result = await protocol.getSwidgeStatus(`ethereum:ethereum:${SWAP_HASH}`)

      expect(account.getTransactionReceipt).toHaveBeenCalledWith(SWAP_HASH)
      expect(result.status).toBe('completed')
    })
  })

  describe('discovery', () => {
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

    test('should list top tokens on a single chain by market cap', async () => {
      const tokens = await protocol.getSupportedTokens({ fromChain: 'ethereum' })

      expect(tokens).toEqual([
        { token: 'eth', chain: 'ethereum', symbol: 'ETH', decimals: 18, name: 'Ethereum' },
        { token: 'token-out-id', chain: 'ethereum', symbol: 'TOUT', decimals: 6, address: TOKEN_OUT.toLowerCase(), name: 'Token Out' }
      ])

      const url = new URL(fetchMock.mock.calls.find(([u]) => new URL(u).pathname === '/v1/fungibles/')[0])

      expect(url.searchParams.get('filter[implementation_chain_id]')).toBe('ethereum')
      expect(url.searchParams.get('sort')).toBe('-market_data.market_cap')
    })

    test('should list route tokens for a cross-chain pair', async () => {
      const tokens = await protocol.getSupportedTokens({ fromChain: 'ethereum', toChain: 'base' })

      expect(tokens).toEqual([
        { token: 'eth', chain: 'ethereum', symbol: 'ETH', decimals: 18, name: 'Ethereum' },
        { token: 'token-out-id', chain: 'ethereum', symbol: 'TOUT', decimals: 6, address: TOKEN_OUT.toLowerCase(), name: 'Token Out' },
        { token: 'eth', chain: 'base', symbol: 'ETH', decimals: 18, name: 'Ethereum' },
        { token: 'token-out-id', chain: 'base', symbol: 'TOUT', decimals: 6, address: '0x' + '11'.repeat(20), name: 'Token Out' }
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

    test('should throw when quoting without an account', async () => {
      await expect(protocol.quoteSwidge({ fromToken: TOKEN_IN, toToken: TOKEN_OUT, fromTokenAmount: 1n }))
        .rejects.toThrow('wallet account')
    })
  })
})
