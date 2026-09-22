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

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeProtocolConfig} SwidgeProtocolConfig */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeOptions} SwidgeOptions */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeQuote} SwidgeQuote */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeResult} SwidgeResult */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeFee} SwidgeFee */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeTransaction} SwidgeTransaction */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeStatusOptions} SwidgeStatusOptions */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeStatusResult} SwidgeStatusResult */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedChain} SwidgeSupportedChain */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedToken} SwidgeSupportedToken */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedTokensOptions} SwidgeSupportedTokensOptions */

/** @typedef {import('./src/zerion-protocol.js').ZerionProtocolConfig} ZerionProtocolConfig */

/** @typedef {import('./src/zerion-protocol.js').ZerionSwidgeOptions} ZerionSwidgeOptions */

/** @typedef {import('./src/errors.js').ZerionApiErrorDetails} ZerionApiErrorDetails */

/** @typedef {import('./src/errors.js').ZerionQuoteErrorDetails} ZerionQuoteErrorDetails */

export { default, default as ZerionProtocol } from './src/zerion-protocol.js'

export { ISwidgeProtocol } from '@tetherto/wdk-wallet/protocols'

export { ZerionApiClient } from './src/zerion-api-client.js'

export { ZerionApiError, ZerionQuoteError, toSwidgeErrorReason } from './src/errors.js'
