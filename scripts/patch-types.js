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

import { readFileSync, writeFileSync } from 'node:fs'

const declarationPath = new URL('../types/src/zerion-protocol.d.ts', import.meta.url)

let source = readFileSync(declarationPath, 'utf8')

// tsc omits JS class members whose inferred signature matches the inherited
// abstract member. Re-insert the public SwidgeProtocol methods it dropped so
// the declaration file describes the full public API.
const marker = '    /** @private */\n    private _mapSupportedTokens;'

const declarations = [
  ['quoteSwidge(', `    /**
     * Quotes the estimated costs and output of a same-chain swap or cross-chain bridge.
     *
     * @param {ZerionSwidgeOptions} options - The swidge options.
     * @returns {Promise<SwidgeQuote>} The quoted swidge details.
     */
    quoteSwidge(options: ZerionSwidgeOptions): Promise<SwidgeQuote>;
`],
  ['getSwidgeStatus(', `    /**
     * Retrieves the current status of a swidge by inspecting the source transaction.
     *
     * @param {string} id - The swidge id returned by {@link swidge}: a transaction hash for same-chain swaps, or
     *   'fromChain:toChain:hash' for cross-chain bridges.
     * @param {ZerionSwidgeStatusOptions} [options] - Optional source/destination chain hints (used with plain-hash ids).
     * @returns {Promise<ZerionSwidgeStatusResult>} The current swidge status.
     */
    getSwidgeStatus(id: string, options?: ZerionSwidgeStatusOptions): Promise<ZerionSwidgeStatusResult>;
`],
  ['getSupportedChains(', `    /**
     * Retrieves the chains on which Zerion supports trading.
     *
     * @returns {Promise<ZerionSwidgeSupportedChain[]>} The supported chains.
     */
    getSupportedChains(): Promise<ZerionSwidgeSupportedChain[]>;
`],
  ['getSupportedTokens(', `    /**
     * Retrieves the tokens available for swidge operations, optionally scoped to a route.
     *
     * @param {ZerionSwidgeSupportedTokensOptions} [options] - Optional source/destination chain filters.
     * @returns {Promise<ZerionSwidgeSupportedToken[]>} The supported tokens.
     */
    getSupportedTokens(options?: ZerionSwidgeSupportedTokensOptions): Promise<ZerionSwidgeSupportedToken[]>;
`]
]

const missing = declarations.filter(([signature]) => !source.includes(signature))

if (missing.length > 0) {
  if (!source.includes(marker)) {
    throw new Error('Unable to patch zerion-protocol.d.ts: insertion marker not found.')
  }

  source = source.replace(marker, missing.map(([, declaration]) => declaration).join('') + marker)
  writeFileSync(declarationPath, source)
}
