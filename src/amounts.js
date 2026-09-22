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

import { ValueError } from '@tetherto/wdk-wallet/protocols'

const DECIMAL_PATTERN = /^(\d+)?(?:\.(\d+))?$/

/**
 * Converts a human-readable decimal string into base units.
 * Fractional digits beyond the token's precision are truncated.
 *
 * @param {string} quantity - Human-readable amount as a decimal string (e.g. '0.001').
 * @param {number} decimals - The token's number of decimal places.
 * @returns {bigint} The amount in base units.
 */
export function toBaseUnits (quantity, decimals) {
  if (typeof quantity !== 'string' || quantity.length === 0) {
    throw new ValueError(`Invalid decimal amount: '${quantity}'.`)
  }

  const match = quantity.match(DECIMAL_PATTERN)

  if (!match || (match[1] === undefined && match[2] === undefined)) {
    throw new ValueError(`Invalid decimal amount: '${quantity}'.`)
  }

  const integer = match[1] ?? '0'
  const fraction = (match[2] ?? '').slice(0, decimals).padEnd(decimals, '0')

  return BigInt(integer) * 10n ** BigInt(decimals) + BigInt(fraction === '' ? '0' : fraction)
}

/**
 * Converts an amount in base units into a human-readable decimal string.
 *
 * @param {number | bigint} amount - The amount in base units.
 * @param {number} decimals - The token's number of decimal places.
 * @returns {string} Human-readable amount as a decimal string.
 */
export function fromBaseUnits (amount, decimals) {
  if (typeof amount === 'number' && !Number.isSafeInteger(amount)) {
    throw new ValueError('Numeric amounts must be safe integers; use bigint for larger values.')
  }

  if (typeof amount !== 'number' && typeof amount !== 'bigint') {
    throw new ValueError('Amounts must be provided as a safe integer or bigint.')
  }

  const value = BigInt(amount)

  if (value < 0n) {
    throw new ValueError('Amounts must be positive.')
  }

  if (decimals === 0) return value.toString()

  const divisor = 10n ** BigInt(decimals)
  const integer = value / divisor
  const fraction = (value % divisor).toString().padStart(decimals, '0').replace(/0+$/, '')

  return fraction === '' ? integer.toString() : `${integer}.${fraction}`
}
