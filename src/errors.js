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

export class ZerionError extends Error {
  /**
   * @param {string} code - Machine-readable error code.
   * @param {string} message - Human-readable error message.
   * @param {*} [details] - Additional error context.
   */
  constructor (code, message, details) {
    super(message)
    this.name = 'ZerionError'
    this.code = code
    this.details = details
  }
}

export class ZerionApiError extends ZerionError {
  /**
   * @param {string} code - Machine-readable error code.
   * @param {string} message - Human-readable error message.
   * @param {number} status - The HTTP status code returned by the Zerion API.
   * @param {*} [details] - Additional error context.
   */
  constructor (code, message, status, details) {
    super(code, message, details)
    this.name = 'ZerionApiError'
    this.status = status
  }
}

export class ZerionQuoteError extends ZerionError {
  /**
   * @param {string} message - Human-readable error message.
   * @param {*} [details] - Additional error context.
   */
  constructor (message, details) {
    super('no_executable_quote', message, details)
    this.name = 'ZerionQuoteError'
  }
}

export class ZerionCapabilityError extends ZerionError {
  /**
   * @param {string} message - Human-readable error message.
   * @param {*} [details] - Additional error context.
   */
  constructor (message, details) {
    super('unsupported_operation', message, details)
    this.name = 'ZerionCapabilityError'
  }
}

export class ZerionAllowanceError extends ZerionError {
  /**
   * @param {string} message - Human-readable error message.
   * @param {{ token: string, transaction: { to: string, value: bigint, data: string } }} details - The
   *   token requiring approval and the ready-to-send approve transaction returned by the Zerion API.
   */
  constructor (message, details) {
    super('allowance_required', message, details)
    this.name = 'ZerionAllowanceError'
  }
}
