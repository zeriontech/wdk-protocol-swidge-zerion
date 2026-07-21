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

import { ZerionApiError, ZerionError } from './errors.js'

const DEFAULT_BASE_URL = 'https://api.zerion.io'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 400
const MAX_RETRY_DELAY_MS = 10_000

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

/**
 * @typedef {Object} ZerionApiClientConfig
 * @property {string} apiKey - The Zerion API key (from https://dashboard.zerion.io).
 * @property {string} [baseUrl] - The Zerion API base url. Defaults to 'https://api.zerion.io'.
 * @property {typeof fetch} [fetch] - Custom fetch implementation. Defaults to the global fetch.
 * @property {number} [timeoutMs] - Per-request timeout in milliseconds. Defaults to 30000.
 * @property {number} [maxRetries] - Maximum number of retries for retryable failures. Defaults to 2.
 * @property {number} [retryDelayMs] - Base delay between retries in milliseconds. Defaults to 400.
 */

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function encodeBasicAuth (apiKey) {
  const token = `${apiKey}:`

  if (typeof globalThis.btoa === 'function') return globalThis.btoa(token)

  return Buffer.from(token, 'utf8').toString('base64')
}

function makeQuery (query) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue

    params.set(key, String(value))
  }

  const encoded = params.toString()

  return encoded ? `?${encoded}` : ''
}

function retryDelayMs (attempt, baseDelayMs, response) {
  const retryAfter = response?.headers?.get('retry-after')

  if (retryAfter) {
    const seconds = Number(retryAfter)

    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS)
  }

  return Math.min(baseDelayMs * (2 ** attempt), MAX_RETRY_DELAY_MS)
}

async function parseErrorBody (response) {
  try {
    const body = await response.json()
    const error = Array.isArray(body?.errors) ? body.errors[0] : undefined

    return {
      title: typeof error?.title === 'string' ? error.title : 'api_error',
      detail: typeof error?.detail === 'string' ? error.detail : `HTTP ${response.status}`,
      body
    }
  } catch {
    return { title: 'api_error', detail: `HTTP ${response.status}`, body: null }
  }
}

/**
 * Minimal HTTP client for the Zerion REST API (https://developers.zerion.io).
 */
export class ZerionApiClient {
  /**
   * Creates a new Zerion API client.
   *
   * @param {ZerionApiClientConfig} config - The client configuration.
   */
  constructor (config = /** @type {ZerionApiClientConfig} */ ({})) {
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new ZerionError('missing_api_key', "A Zerion API key is required (config.apiKey). Get one at 'https://dashboard.zerion.io'.")
    }

    /** @private */
    this._authorization = `Basic ${encodeBasicAuth(config.apiKey)}`

    /** @private */
    this._baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')

    /** @private */
    this._fetch = config.fetch ?? globalThis.fetch

    /** @private */
    this._timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS

    /** @private */
    this._maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES

    /** @private */
    this._retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

    if (typeof this._fetch !== 'function') {
      throw new ZerionError('missing_fetch', 'A fetch implementation is required.')
    }
  }

  /**
   * Returns swap and bridge quotes for a pair of fungible assets.
   * See https://developers.zerion.io for the full reference of `GET /v1/swap/quotes/`.
   *
   * @param {Object} params - The quote request parameters.
   * @param {string} params.from - Address of the wallet performing the swap.
   * @param {string} params.to - Recipient of the output asset.
   * @param {string} params.inputChainId - Chain id the input asset lives on.
   * @param {string} params.inputFungibleId - Fungible id of the input asset.
   * @param {string} params.amount - Human-readable input amount as a decimal string.
   * @param {string} [params.outputChainId] - Chain id the output asset lives on. Defaults to the input chain.
   * @param {string} params.outputFungibleId - Fungible id of the output asset.
   * @param {number} [params.slippagePercent] - Maximum acceptable slippage in percent.
   * @param {string} [params.currency] - Currency for the fiat values in the response.
   * @returns {Promise<*>} The raw quotes response.
   */
  async getSwapQuotes (params) {
    return await this._requestJson('/v1/swap/quotes/', {
      from: params.from,
      to: params.to,
      'input[chain_id]': params.inputChainId,
      'input[fungible_id]': params.inputFungibleId,
      'input[amount]': params.amount,
      'output[chain_id]': params.outputChainId,
      'output[fungible_id]': params.outputFungibleId,
      slippage_percent: params.slippagePercent,
      currency: params.currency
    })
  }

  /**
   * Returns the list of all chains supported by Zerion.
   *
   * @returns {Promise<*>} The raw chains response.
   */
  async getChains () {
    return await this._requestJson('/v1/chains/', {})
  }

  /**
   * Returns fungibles available for swapping and bridging between two chains.
   *
   * @param {Object} params - The request parameters.
   * @param {string} [params.inputChainId] - The source chain id.
   * @param {string} [params.outputChainId] - The destination chain id.
   * @param {'input' | 'output' | 'both'} [params.direction] - Which side of the route to list fungibles for.
   * @returns {Promise<*>} The raw fungibles response.
   */
  async getSwapFungibles (params) {
    return await this._requestJson('/v1/swap/fungibles/', {
      'input[chain_id]': params.inputChainId,
      'output[chain_id]': params.outputChainId,
      direction: params.direction
    })
  }

  /**
   * Returns fungible assets, optionally filtered by chain, ordered by market cap
   * (descending) unless a different sort is provided.
   *
   * @param {Object} params - The request parameters.
   * @param {string} [params.implementationChainId] - Keep only fungibles deployed on this chain.
   * @param {string} [params.sort] - Sort order. Defaults to '-market_data.market_cap'.
   * @param {number} [params.pageSize] - Maximum number of fungibles to return (up to 100).
   * @returns {Promise<*>} The raw fungibles response.
   */
  async listFungibles (params) {
    return await this._requestJson('/v1/fungibles/', {
      'filter[implementation_chain_id]': params.implementationChainId,
      sort: params.sort ?? '-market_data.market_cap',
      'page[size]': params.pageSize
    })
  }

  /**
   * Returns a fungible asset by its Zerion fungible id.
   *
   * @param {string} fungibleId - The fungible id.
   * @returns {Promise<*>} The raw fungible response.
   */
  async getFungible (fungibleId) {
    return await this._requestJson(`/v1/fungibles/${encodeURIComponent(fungibleId)}`, {})
  }

  /**
   * Returns a fungible asset by one of its implementations.
   *
   * @param {string} implementation - Implementation in the format `chain` or `chain:address`.
   *   When only the chain is provided, the chain's base (native) asset is returned.
   * @returns {Promise<*>} The raw fungible response.
   */
  async getFungibleByImplementation (implementation) {
    return await this._requestJson('/v1/fungibles/by-implementation', { implementation })
  }

  /** @private */
  async _requestJson (path, query) {
    const url = `${this._baseUrl}${path}${makeQuery(query)}`

    let lastError

    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this._timeoutMs)

      let response

      try {
        response = await this._fetch(url, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            authorization: this._authorization
          },
          signal: controller.signal
        })
      } catch (err) {
        lastError = new ZerionApiError('network_error', `Request to '${path}' failed: ${err.message ?? err}.`, 0, { url })

        if (attempt < this._maxRetries) {
          await sleep(retryDelayMs(attempt, this._retryDelayMs))

          continue
        }

        throw lastError
      } finally {
        clearTimeout(timer)
      }

      if (response.ok) return await response.json()

      const { title, detail, body } = await parseErrorBody(response)

      lastError = new ZerionApiError(title, detail, response.status, { url, body })

      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this._maxRetries) {
        await sleep(retryDelayMs(attempt, this._retryDelayMs, response))

        continue
      }

      throw lastError
    }

    throw lastError
  }
}
