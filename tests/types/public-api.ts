import ZerionProtocol, {
  ISwidgeProtocol,
  ZerionApiClient,
  ZerionApiError,
  ZerionProtocol as NamedZerionProtocol,
  ZerionQuoteError,
  toSwidgeErrorReason,
  type ZerionProtocolConfig,
  type ZerionSwidgeOptions
} from 'wdk-protocol-swidge-zerion'

import { ProviderError, SwidgeError } from '@tetherto/wdk-wallet/protocols'

declare const protocol: ZerionProtocol

type IsAny<T> = 0 extends (1 & T) ? true : false
type SwidgeExecutionConfig = NonNullable<Parameters<ZerionProtocol['swidge']>[1]>

const swidgeExecutionConfigIsNotAny: IsAny<SwidgeExecutionConfig> = false

// The class is available under both the default and the named export.
const sameClass: typeof ZerionProtocol = NamedZerionProtocol

// The protocol satisfies the wdk swidge interface.
const asInterface: ISwidgeProtocol = protocol

const options = {
  fromToken: 'eth',
  toToken: 'usdc',
  fromTokenAmount: 1n,
  minAmountOut: 1n
} satisfies ZerionSwidgeOptions

const config = {
  apiKey: 'zk_test',
  timeoutMs: 1_000,
  maxRetries: 1,
  retryDelayMs: 100,
  approvalPollIntervalMs: 1_000,
  approvalTimeoutMs: 60_000,
  maxNetworkFeeBps: 100n,
  maxProtocolFeeBps: 100
} satisfies ZerionProtocolConfig

declare const failure: unknown

if (failure instanceof ZerionApiError) {
  const provider: ProviderError = failure
  const code: string = failure.code
  const status: number = failure.status

  void provider
  void code
  void status
}

if (failure instanceof ZerionQuoteError) {
  const swidge: SwidgeError = failure
  const hint: string | undefined = failure.hint

  void swidge
  void hint
}

const reason: string = toSwidgeErrorReason('no_routes')
const client = new ZerionApiClient({ apiKey: 'zk_test' })

void protocol.quoteSwidge(options)
void protocol.swidge(options, { maxNetworkFeeBps: config.maxNetworkFeeBps, paymasterToken: 'USDT' })
void protocol.getSwidgeStatus('0x' + '00'.repeat(32))
void protocol.getSupportedChains()
void protocol.getSupportedTokens({ fromChain: 'ethereum' })
void swidgeExecutionConfigIsNotAny
void sameClass
void asInterface
void reason
void client
