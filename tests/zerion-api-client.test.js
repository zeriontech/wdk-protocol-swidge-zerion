import { describe, expect, jest, test } from '@jest/globals'

import { ZerionApiClient } from '../src/zerion-api-client.js'

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
