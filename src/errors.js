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

import { ProviderError, SwidgeError, SwidgeErrorReason } from '@tetherto/wdk-wallet/protocols'

/**
 * @typedef {Object} ZerionApiErrorDetails
 * @property {string} [url] - The request url that failed.
 * @property {*} [body] - The parsed error body returned by the Zerion API, when available.
 * @property {unknown} [cause] - The underlying error, when available.
 */

/**
 * @typedef {Object} ZerionQuoteErrorDetails
 * @property {string} [reason] - The swidge error reason. Defaults to `ROUTE_NOT_SUPPORTED`.
 * @property {string} [code] - The machine-readable error code reported by the Zerion API.
 * @property {string} [hint] - The suggested user action reported by the Zerion API.
 * @property {unknown} [cause] - The underlying error, when available.
 */

/**
 * Error raised when the Zerion API cannot be reached, rejects a request, or returns a
 * malformed payload. It extends the WDK `ProviderError` so wallet applications can handle
 * it together with other provider failures.
 */
export class ZerionApiError extends ProviderError {
  /**
   * Creates a new Zerion API error.
   *
   * @param {string} code - Machine-readable error code: the API error title, `network_error`, or `invalid_response`.
   * @param {string} message - Human-readable error message.
   * @param {number} status - The HTTP status code returned by the Zerion API, or 0 when no response was received.
   * @param {ZerionApiErrorDetails} [details] - Additional request context.
   */
  constructor (code, message, status, details = {}) {
    super(message, { reason: code, cause: details.cause })

    this.name = 'ZerionApiError'

    /**
     * Machine-readable error code.
     *
     * @type {string}
     */
    this.code = code

    /**
     * The HTTP status code returned by the Zerion API, or 0 when no response was received.
     *
     * @type {number}
     */
    this.status = status

    /**
     * Additional request context.
     *
     * @type {ZerionApiErrorDetails}
     */
    this.details = details
  }
}

/**
 * Error raised when Zerion returns no executable route for the requested pair, or when the
 * best route cannot satisfy the requested constraints. It extends the WDK `SwidgeError`
 * and always carries a standard swidge error reason.
 */
export class ZerionQuoteError extends SwidgeError {
  /**
   * Creates a new Zerion quote error.
   *
   * @param {string} message - Human-readable error message.
   * @param {ZerionQuoteErrorDetails} [details] - The swidge error reason and the Zerion API error context.
   */
  constructor (message, details = {}) {
    super(message, { reason: details.reason ?? SwidgeErrorReason.ROUTE_NOT_SUPPORTED, cause: details.cause })

    this.name = 'ZerionQuoteError'

    /**
     * The machine-readable error code reported by the Zerion API, when available.
     *
     * @type {string | undefined}
     */
    this.code = details.code

    /**
     * The suggested user action reported by the Zerion API, when available.
     *
     * @type {string | undefined}
     */
    this.hint = details.hint
  }
}

/**
 * Maps a Zerion API quote error code to the closest WDK swidge error reason.
 *
 * @param {string | undefined} code - The machine-readable error code reported by the Zerion API.
 * @returns {string} The swidge error reason.
 */
export function toSwidgeErrorReason (code) {
  switch (code) {
    case 'not_enough_input_asset_balance':
      return SwidgeErrorReason.INSUFFICIENT_TOKEN_BALANCE
    case 'not_enough_base_asset_balance':
      return SwidgeErrorReason.INSUFFICIENT_BALANCE
    default:
      return SwidgeErrorReason.ROUTE_NOT_SUPPORTED
  }
}
