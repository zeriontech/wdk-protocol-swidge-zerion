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

// Interactive demo for wdk-protocol-swidge-zerion.
//
//   node scripts/demo.js quote   --wallet <addr|ens> --sell eth --buy usdc --amount 0.1 [--chain base] [--to-chain arbitrum]
//   node scripts/demo.js execute --sell eth --buy usdc --amount 0.01 [--chain base]        (requires SEED, asks to confirm)
//   node scripts/demo.js status  <swidge-id> [--chain base]
//
// Configuration comes from the environment or a local .env file:
//   ZERION_API_KEY   required — https://dashboard.zerion.io
//   SEED             only for `execute` — BIP-39 seed phrase of a TEST wallet
//   RPC_<CHAIN>      optional RPC override, e.g. RPC_BASE=https://...
//
// `quote` is read-only and needs no keys: it quotes as any wallet address.
// `execute` signs and broadcasts a REAL transaction from the SEED wallet.

'use strict'

import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline/promises'

import { WalletAccountEvm, WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'
import ZerionProtocol, { ZerionApiClient, ZerionAllowanceError } from '../index.js'
import { toBaseUnits, fromBaseUnits } from '../src/amounts.js'

const RPC_DEFAULTS = {
  ethereum: 'https://ethereum-rpc.publicnode.com',
  base: 'https://base-rpc.publicnode.com',
  arbitrum: 'https://arbitrum-one-rpc.publicnode.com',
  optimism: 'https://optimism-rpc.publicnode.com',
  polygon: 'https://polygon-bor-rpc.publicnode.com',
  'binance-smart-chain': 'https://bsc-rpc.publicnode.com',
  avalanche: 'https://avalanche-c-chain-rpc.publicnode.com'
}

// Convenience symbols -> canonical Zerion fungible ids (chain-agnostic:
// one id resolves to the right implementation on every supported chain).
const SYMBOLS = {
  eth: 'eth',
  weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  usdt0: '8f0f869d-f6c8-45a2-b38c-47235b023430',
  dai: '0x6b175474e89094c44da98b954eedeac495271d0f',
  wbtc: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  native: 'native'
}

const CHAIN_ALIASES = { bsc: 'binance-smart-chain', mainnet: 'ethereum', gnosis: 'xdai' }

function loadDotEnv () {
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')

    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)

      if (!match || line.trim().startsWith('#')) continue

      const value = match[2].replace(/^['"]|['"]$/g, '')

      if (process.env[match[1]] === undefined) process.env[match[1]] = value
    }
  } catch {}
}

function fail (message) {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

function chainSlug (name) {
  const lower = String(name).toLowerCase()

  return CHAIN_ALIASES[lower] ?? lower
}

function rpcFor (chain, override) {
  const envKey = `RPC_${chain.toUpperCase().replaceAll('-', '_')}`

  const url = override ?? process.env[envKey] ?? RPC_DEFAULTS[chain]

  if (!url) fail(`No RPC known for '${chain}'. Pass --rpc <url> or set ${envKey}.`)

  return url
}

function tokenRef (input) {
  return SYMBOLS[String(input).toLowerCase()] ?? input
}

async function resolveWallet (wallet) {
  if (!wallet) return undefined

  if (/^0x[0-9a-fA-F]{40}$/.test(wallet)) return wallet

  if (wallet.includes('.')) {
    // ENS resolution is optional sugar: ethers is a dev dependency here (and
    // present transitively via the WDK wallet packages), not a runtime one.
    let JsonRpcProvider

    try {
      ({ JsonRpcProvider } = await import('ethers'))
    } catch {
      fail(`ENS resolution requires the 'ethers' package (npm install ethers), or pass a 0x address instead of '${wallet}'.`)
    }

    const provider = new JsonRpcProvider(RPC_DEFAULTS.ethereum)
    const resolved = await provider.resolveName(wallet)

    if (!resolved) fail(`Could not resolve ENS name '${wallet}'.`)

    console.log(`  ${wallet} -> ${resolved}`)

    return resolved
  }

  fail(`'${wallet}' is not an address or ENS name.`)
}

// The module speaks base units; the demo takes human amounts, so it resolves
// the sell token's decimals the same way the module does (via the Zerion API).
async function resolveDecimals (client, token, chain) {
  let response

  if (token === 'native') {
    response = await client.getFungibleByImplementation(chain)
  } else if (/^0x[0-9a-fA-F]{40}$/.test(token)) {
    try {
      response = await client.getFungibleByImplementation(`${chain}:${token.toLowerCase()}`)
    } catch (err) {
      if (err?.status !== 404) throw err

      response = await client.getFungible(token.toLowerCase())
    }
  } else {
    response = await client.getFungible(token)
  }

  const implementation = (response?.data?.attributes?.implementations ?? []).find(i => i.chain_id === chain)

  if (!implementation) fail(`Token '${token}' has no implementation on '${chain}'.`)

  return {
    id: response.data.id,
    decimals: implementation.decimals,
    symbol: response.data.attributes?.symbol ?? token
  }
}

function printQuote (quote, sellToken, buyToken) {
  const known = {
    [sellToken.id]: sellToken,
    [buyToken.id]: buyToken,
    eth: { decimals: 18, symbol: 'ETH' }
  }

  const feeAmount = (fee) => {
    const token = known[fee.token]

    return token
      ? `${fromBaseUnits(fee.amount, token.decimals)} ${token.symbol}`
      : `${fee.amount} base units of '${fee.token}'`
  }

  console.log('\n  Quote (best route across Zerion\'s aggregated sources):')
  console.log(`    sell           ${fromBaseUnits(quote.fromTokenAmount, sellToken.decimals)} ${sellToken.symbol}`)
  console.log(`    receive (est)  ${fromBaseUnits(quote.toTokenAmount, buyToken.decimals)} ${buyToken.symbol}`)
  console.log(`    receive (min)  ${fromBaseUnits(quote.toTokenAmountMin, buyToken.decimals)} ${buyToken.symbol}`)

  for (const fee of quote.fees) {
    console.log(`    fee            ${fee.description ?? fee.type} — ${feeAmount(fee)}${fee.included ? ' (included in rate)' : ''}`)
  }

  if (quote.estimatedDuration !== undefined) console.log(`    est. duration  ${quote.estimatedDuration}s`)
}

loadDotEnv()

const { values: flags, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    wallet: { type: 'string' },
    sell: { type: 'string', default: 'eth' },
    buy: { type: 'string', default: 'usdc' },
    amount: { type: 'string', default: '0.1' },
    chain: { type: 'string', default: 'ethereum' },
    'to-chain': { type: 'string' },
    recipient: { type: 'string' },
    slippage: { type: 'string' },
    rpc: { type: 'string' },
    path: { type: 'string', default: "0'/0/0" },
    yes: { type: 'boolean', default: false }
  }
})

const command = positionals[0] ?? 'quote'

const apiKey = process.env.ZERION_API_KEY

if (!apiKey) fail('ZERION_API_KEY is not set. Add it to the environment or a .env file in the repo root.')

const chain = chainSlug(flags.chain)
const toChain = flags['to-chain'] ? chainSlug(flags['to-chain']) : undefined

const client = new ZerionApiClient({ apiKey })

if (command === 'quote') {
  const rpcUrl = rpcFor(chain, flags.rpc)
  const wallet = (await resolveWallet(flags.wallet)) ?? '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

  console.log(`\nQuoting as ${wallet} on ${chain}${toChain ? ` -> ${toChain}` : ''} (read-only, no keys)`)

  const account = new WalletAccountReadOnlyEvm(wallet, { provider: rpcUrl })
  const zerion = new ZerionProtocol(account, { apiKey })

  const sell = tokenRef(flags.sell)
  const buy = tokenRef(flags.buy)

  const sellToken = await resolveDecimals(client, sell, chain)
  const buyToken = await resolveDecimals(client, buy, toChain ?? chain)

  const quote = await zerion.quoteSwidge({
    fromToken: sell,
    toToken: buy,
    toChain,
    recipient: flags.recipient,
    fromTokenAmount: toBaseUnits(flags.amount, sellToken.decimals),
    slippage: flags.slippage ? Number(flags.slippage) / 100 : undefined
  })

  printQuote(quote, sellToken, buyToken)

  const hint = [`--sell ${flags.sell}`, `--buy ${flags.buy}`, `--amount ${flags.amount}`, `--chain ${flags.chain}`, toChain ? `--to-chain ${flags['to-chain']}` : '']
    .filter(Boolean).join(' ')

  console.log(`\n  To execute this for real (needs SEED in .env):  npm run demo -- execute ${hint}`)
} else if (command === 'execute') {
  const seed = process.env.SEED

  if (!seed) fail("SEED is not set. Put a TEST wallet's BIP-39 seed phrase in .env (SEED=...) to execute swaps.")

  const rpcUrl = rpcFor(chain, flags.rpc)
  const account = new WalletAccountEvm(seed, flags.path, { provider: rpcUrl })
  const address = await account.getAddress()

  const zerion = new ZerionProtocol(account, { apiKey })

  const sell = tokenRef(flags.sell)
  const buy = tokenRef(flags.buy)

  const sellToken = await resolveDecimals(client, sell, chain)
  const buyToken = await resolveDecimals(client, buy, toChain ?? chain)

  console.log(`\nWallet ${address} (derived m/44'/60'/${flags.path}) on ${chain}${toChain ? ` -> ${toChain}` : ''}`)

  const options = {
    fromToken: sell,
    toToken: buy,
    toChain,
    recipient: flags.recipient,
    fromTokenAmount: toBaseUnits(flags.amount, sellToken.decimals),
    slippage: flags.slippage ? Number(flags.slippage) / 100 : undefined
  }

  const quote = await zerion.quoteSwidge(options)

  printQuote(quote, sellToken, buyToken)

  if (!flags.yes) {
    const readline = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await readline.question(`\n  This signs and broadcasts a REAL transaction selling ${flags.amount} ${sellToken.symbol}. Type 'swap' to proceed: `)

    readline.close()

    if (answer.trim() !== 'swap') fail('Aborted — nothing was sent.')
  }

  try {
    const result = await zerion.swidge(options)

    console.log(`\n✓ Sent. hash: ${result.hash}`)
    console.log(`  swidge id: ${result.id}`)
    console.log('\n  Tracking status (ctrl-c to stop)...')

    for (let i = 0; i < 24; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000))

      const { status } = await zerion.getSwidgeStatus(result.id)

      console.log(`    ${new Date().toISOString()}  ${status}`)

      if (status === 'completed' || status === 'failed') break
    }
  } catch (err) {
    if (err instanceof ZerionAllowanceError) {
      console.log(`\n! Approval needed first: token ${err.details.token}`)

      if (!flags.yes) {
        const readline = createInterface({ input: process.stdin, output: process.stdout })
        const answer = await readline.question("  Send the approve transaction now? Type 'approve' to proceed: ")

        readline.close()

        if (answer.trim() !== 'approve') fail('Aborted — nothing was sent.')
      }

      const { hash } = await account.sendTransaction(err.details.transaction)

      console.log(`  ✓ Approve sent: ${hash}`)
      console.log('  Wait for it to confirm, then re-run the same execute command.')
    } else {
      throw err
    }
  }
} else if (command === 'status') {
  const id = positionals[1]

  if (!id) fail('Usage: node scripts/demo.js status <swidge-id> [--chain <source-chain>]')

  const rpcUrl = rpcFor(chain, flags.rpc)
  const account = new WalletAccountReadOnlyEvm('0x0000000000000000000000000000000000000000', { provider: rpcUrl })
  const zerion = new ZerionProtocol(account, { apiKey })

  const result = await zerion.getSwidgeStatus(id)

  console.log(`\n  status: ${result.status}`)

  for (const tx of result.transactions ?? []) console.log(`  ${tx.type}: ${tx.hash} (${tx.chain})`)
} else if (command === 'chains') {
  const zerion = new ZerionProtocol(undefined, { apiKey })

  const chains = await zerion.getSupportedChains()

  console.log(`\n${chains.length} chains support trading:`)

  for (const entry of chains) console.log(`  - ${entry.id} (${entry.name}, ${entry.type})`)
} else if (command === 'tokens') {
  const zerion = new ZerionProtocol(undefined, { apiKey })

  const tokens = await zerion.getSupportedTokens({ fromChain: chain, toChain })

  console.log(`\n${tokens.length} tokens available (fromChain=${chain}${toChain ? `, toChain=${toChain}` : ''}), first 20:`)

  for (const token of tokens.slice(0, 20)) {
    console.log(`  - ${token.symbol} (${token.chain}, id=${token.token}, decimals=${token.decimals}${token.address ? `, ${token.address}` : ', native'})`)
  }
} else {
  fail(`Unknown command '${command}'. Use quote | execute | status | chains | tokens.`)
}
