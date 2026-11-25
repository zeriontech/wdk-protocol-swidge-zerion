import { describe, expect, test } from '@jest/globals'

import { ProviderError, SwidgeError, SwidgeErrorReason, ISwidgeProtocol as SdkSwidgeInterface } from '@tetherto/wdk-wallet/protocols'

import DefaultExport, {
  ISwidgeProtocol,
  ZerionApiClient,
  ZerionApiError,
  ZerionProtocol,
  ZerionQuoteError,
  toSwidgeErrorReason
} from '../index.js'

describe('module exports', () => {
  test('should export the protocol as both default and named export', () => {
    expect(ZerionProtocol).toBe(DefaultExport)
    expect(typeof ZerionProtocol).toBe('function')
  })

  test('should re-export the swidge interface symbol from the wdk', () => {
    expect(ISwidgeProtocol).toBe(SdkSwidgeInterface)
  })

  test('should export the api client', () => {
    expect(typeof ZerionApiClient).toBe('function')
  })
})

describe('ZerionApiError', () => {
  test('should extend the wdk provider error', () => {
    const cause = new Error('socket hang up')
    const error = new ZerionApiError('network_error', 'Request failed', 0, { url: 'https://api.zerion.io/v1/chains/', cause })

    expect(error).toBeInstanceOf(ProviderError)
    expect(error.name).toBe('ZerionApiError')
    expect(error.message).toBe('Request failed')
    expect(error.code).toBe('network_error')
    expect(error.reason).toBe('network_error')
    expect(error.status).toBe(0)
    expect(error.cause).toBe(cause)
    expect(error.details).toEqual({ url: 'https://api.zerion.io/v1/chains/', cause })
  })

  test('should default to empty details', () => {
    const error = new ZerionApiError('unauthenticated', 'Invalid api key', 401)

    expect(error.details).toEqual({})
    expect(error.cause).toBeUndefined()
  })
})

describe('ZerionQuoteError', () => {
  test('should extend the wdk swidge error with a default reason', () => {
    const error = new ZerionQuoteError('No routes available for the requested pair.')

    expect(error).toBeInstanceOf(SwidgeError)
    expect(error.name).toBe('ZerionQuoteError')
    expect(error.reason).toBe(SwidgeErrorReason.ROUTE_NOT_SUPPORTED)
    expect(error.code).toBeUndefined()
    expect(error.hint).toBeUndefined()
  })

  test('should carry the api error context', () => {
    const error = new ZerionQuoteError('Not enough balance', {
      reason: SwidgeErrorReason.INSUFFICIENT_TOKEN_BALANCE,
      code: 'not_enough_input_asset_balance',
      hint: 'topup'
    })

    expect(error.reason).toBe(SwidgeErrorReason.INSUFFICIENT_TOKEN_BALANCE)
    expect(error.code).toBe('not_enough_input_asset_balance')
    expect(error.hint).toBe('topup')
  })
})

describe('toSwidgeErrorReason', () => {
  test.each([
    ['not_enough_input_asset_balance', SwidgeErrorReason.INSUFFICIENT_TOKEN_BALANCE],
    ['not_enough_base_asset_balance', SwidgeErrorReason.INSUFFICIENT_BALANCE],
    ['no_routes', SwidgeErrorReason.ROUTE_NOT_SUPPORTED],
    [undefined, SwidgeErrorReason.ROUTE_NOT_SUPPORTED]
  ])('should map %s to %s', (code, reason) => {
    expect(toSwidgeErrorReason(code)).toBe(reason)
  })
})
