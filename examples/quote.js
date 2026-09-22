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

// Quotes a same-chain swap and a cross-chain bridge as a read-only wallet.
// Nothing is signed or broadcast.
//
//   ZERION_API_KEY=... node examples/quote.js

import { WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'

import ZerionProtocol from 'wdk-protocol-swidge-zerion'

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

// Any address works for quotes; use the wallet that will execute the swidge
// so balances and allowances are evaluated for the right account.
const account = new WalletAccountReadOnlyEvm('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', {
  provider: 'https://ethereum-rpc.publicnode.com'
})

const zerion = new ZerionProtocol(account, { apiKey: process.env.ZERION_API_KEY })

const swap = await zerion.quoteSwidge({
  fromToken: 'eth',
  toToken: USDC,
  fromTokenAmount: 10n ** 17n // 0.1 ETH
})

console.log(`0.1 ETH -> USDC on Ethereum: ${swap.toTokenAmount} (min ${swap.toTokenAmountMin})`)

for (const fee of swap.fees) {
  console.log(`  ${fee.type} fee: ${fee.amount} ${fee.token}${fee.included ? ' (included in rate)' : ''}`)
}

const bridge = await zerion.quoteSwidge({
  fromToken: USDC,
  toToken: USDC, // same identifier + different chain = bridge the same asset
  toChain: 'base',
  fromTokenAmount: 25_000_000n // 25 USDC
})

console.log(`25 USDC Ethereum -> Base: ${bridge.toTokenAmount} (min ${bridge.toTokenAmountMin}), ~${bridge.estimatedDuration}s`)
