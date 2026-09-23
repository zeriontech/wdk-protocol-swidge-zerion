import { describe, expect, jest, test } from '@jest/globals'

import { ValueError } from '@tetherto/wdk-wallet/protocols'

import { ZerionApiClient } from '../src/zerion-api-client.js'
import { ZerionApiError } from '../src/errors.js'

function stalledJsonResponse (status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => new Promise(() => {})
  }
}

describe('ZerionApiClient', () => {
  test('should keep the timeout active while reading a successful response body', async () => {
    const fetch = jest.fn(async () => stalledJsonResponse(200))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, timeoutMs: 10, maxRetries: 0 })

    await expect(client.getChains()).rejects.toMatchObject({ code: 'network_error', status: 0 })
  })

  test('should keep the timeout active while reading an error response body', async () => {
    const fetch = jest.fn(async () => stalledJsonResponse(503))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, timeoutMs: 10, maxRetries: 0 })

    await expect(client.getChains()).rejects.toMatchObject({ code: 'network_error', status: 0 })
  })
})

function jsonResponse (payload, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => payload
  }
}

const DUMMY_CHAINS = { data: [{ type: 'chains', id: 'ethereum' }] }
const DUMMY_ERROR_BODY = { errors: [{ title: 'rate_limited', detail: 'Slow down' }] }

describe('ZerionApiClient requests', () => {
  test('should require an api key', () => {
    expect(() => new ZerionApiClient({})).toThrow(ValueError)
    expect(() => new ZerionApiClient({ apiKey: 42 })).toThrow('A Zerion API key is required')
  })

  test('should require a fetch implementation', () => {
    const globalFetch = globalThis.fetch

    globalThis.fetch = undefined

    try {
      expect(() => new ZerionApiClient({ apiKey: 'zk_test' })).toThrow('A fetch implementation is required.')
    } finally {
      globalThis.fetch = globalFetch
    }
  })

  test('should send basic auth built without btoa', async () => {
    const globalBtoa = globalThis.btoa
    const fetch = jest.fn(async () => jsonResponse(DUMMY_CHAINS))

    globalThis.btoa = undefined

    try {
      const client = new ZerionApiClient({ apiKey: 'zk_test', fetch })

      await client.getChains()
    } finally {
      globalThis.btoa = globalBtoa
    }

    expect(fetch.mock.calls[0][1].headers.authorization).toBe(`Basic ${Buffer.from('zk_test:').toString('base64')}`)
  })

  test('should build query strings without undefined parameters', async () => {
    const fetch = jest.fn(async () => jsonResponse({ data: [] }))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, baseUrl: 'https://api.example.test/' })

    await client.getChains()
    await client.listFungibles({ implementationChainId: 'base', pageSize: 50 })
    await client.getSwapFungibles({ inputChainId: 'ethereum', outputChainId: 'base', direction: 'input' })
    await client.getFungible('asset/uuid')

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/chains/',
      'https://api.example.test/v1/fungibles/?filter%5Bimplementation_chain_id%5D=base&sort=-market_data.market_cap&page%5Bsize%5D=50',
      'https://api.example.test/v1/swap/fungibles/?input%5Bchain_id%5D=ethereum&output%5Bchain_id%5D=base&direction=input',
      'https://api.example.test/v1/fungibles/asset%2Fuuid'
    ])
  })

  test('should skip null query parameters', async () => {
    const fetch = jest.fn(async () => jsonResponse({ data: [] }))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch })

    await client.getSwapQuotes({ from: 'a', to: 'b', inputChainId: 'ethereum', inputFungibleId: 'eth', amount: '1', outputFungibleId: 'usdc', slippagePercent: null })

    expect(fetch.mock.calls[0][0]).toBe('https://api.zerion.io/v1/swap/quotes/?from=a&to=b&input%5Bchain_id%5D=ethereum&input%5Bfungible_id%5D=eth&input%5Bamount%5D=1&output%5Bfungible_id%5D=usdc')
  })

  test('should treat an aborted error-body read as a network failure', async () => {
    const fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        throw error
      }
    }))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, maxRetries: 0 })

    await expect(client.getChains()).rejects.toMatchObject({ code: 'network_error', status: 0 })
  })

  test('should describe non-error rejections', async () => {
    const fetch = jest.fn(async () => { throw 'socket closed' })
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, maxRetries: 0 })

    const error = await client.getChains().catch(err => err)

    expect(error).toMatchObject({ code: 'network_error', status: 0 })
    expect(error.message).toContain('socket closed')
  })

  test('should retry retryable statuses with exponential backoff', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse(DUMMY_ERROR_BODY, 503))
      .mockResolvedValueOnce(jsonResponse(DUMMY_ERROR_BODY, 429))
      .mockResolvedValueOnce(jsonResponse(DUMMY_CHAINS))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, retryDelayMs: 10, maxRetries: 2 })

    const started = Date.now()
    const result = await client.getChains()

    expect(result).toEqual(DUMMY_CHAINS)
    expect(fetch).toHaveBeenCalledTimes(3)
    // attempt 0 waits 10ms, attempt 1 waits 20ms
    expect(Date.now() - started).toBeGreaterThanOrEqual(25)
  })

  test('should give up after the configured retries', async () => {
    const fetch = jest.fn(async () => jsonResponse(DUMMY_ERROR_BODY, 503))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, retryDelayMs: 1, maxRetries: 2 })

    const error = await client.getChains().catch(err => err)

    expect(error).toBeInstanceOf(ZerionApiError)
    expect(error).toMatchObject({ code: 'rate_limited', reason: 'rate_limited', status: 503, message: 'Slow down' })
    expect(error.details.body).toEqual(DUMMY_ERROR_BODY)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  test('should not retry non-retryable statuses', async () => {
    const fetch = jest.fn(async () => jsonResponse({ errors: [{ title: 'bad_request', detail: 'Invalid amount' }] }, 400))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch })

    await expect(client.getChains()).rejects.toMatchObject({ code: 'bad_request', status: 400, message: 'Invalid amount' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('should honour a Retry-After header in seconds', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse(DUMMY_ERROR_BODY, 429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(jsonResponse(DUMMY_CHAINS))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, retryDelayMs: 5_000, maxRetries: 1 })

    const started = Date.now()

    await client.getChains()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(Date.now() - started).toBeLessThan(2_500)
  })

  test('should honour a Retry-After header as an http date', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse(DUMMY_ERROR_BODY, 503, { 'retry-after': new Date(Date.now() - 60_000).toUTCString() }))
      .mockResolvedValueOnce(jsonResponse(DUMMY_CHAINS))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, retryDelayMs: 5_000, maxRetries: 1 })

    const started = Date.now()

    await client.getChains()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(Date.now() - started).toBeLessThan(2_500)
  })

  test('should cap the retry delay', async () => {
    jest.useFakeTimers()

    try {
      const fetch = jest.fn()
        .mockResolvedValueOnce(jsonResponse(DUMMY_ERROR_BODY, 429, { 'retry-after': '3600' }))
        .mockResolvedValueOnce(jsonResponse(DUMMY_CHAINS))
      const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, maxRetries: 1 })

      const request = client.getChains()

      await jest.advanceTimersByTimeAsync(10_000)

      expect(await request).toEqual(DUMMY_CHAINS)
      expect(fetch).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  test('should retry network failures', async () => {
    const fetch = jest.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(DUMMY_CHAINS))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, retryDelayMs: 1, maxRetries: 1 })

    expect(await client.getChains()).toEqual(DUMMY_CHAINS)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('should surface network failures after the configured retries', async () => {
    const fetch = jest.fn(async () => { throw new TypeError('fetch failed') })
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, retryDelayMs: 1, maxRetries: 1 })

    const error = await client.getChains().catch(err => err)

    expect(error).toBeInstanceOf(ZerionApiError)
    expect(error).toMatchObject({ code: 'network_error', status: 0 })
    expect(error.message).toContain('fetch failed')
    expect(error.details.url).toBe('https://api.zerion.io/v1/chains/')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('should fall back to a generic error when the error body is not json', async () => {
    const fetch = jest.fn(async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => { throw new SyntaxError('Unexpected token') } }))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch, maxRetries: 0 })

    const error = await client.getChains().catch(err => err)

    expect(error).toMatchObject({ code: 'api_error', status: 500, message: 'HTTP 500' })
    expect(error.details.body).toBeNull()
  })

  test('should fall back to a generic error when the error body has no errors array', async () => {
    const fetch = jest.fn(async () => jsonResponse({ message: 'nope' }, 403))
    const client = new ZerionApiClient({ apiKey: 'zk_test', fetch })

    await expect(client.getChains()).rejects.toMatchObject({ code: 'api_error', status: 403, message: 'HTTP 403' })
  })
})
