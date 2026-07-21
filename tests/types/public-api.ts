import ZerionProtocol, { type ZerionProtocolConfig, type ZerionSwidgeOptions } from 'wdk-protocol-swidge-zerion'

declare const protocol: ZerionProtocol

type IsAny<T> = 0 extends (1 & T) ? true : false
type SwidgeExecutionConfig = NonNullable<Parameters<ZerionProtocol['swidge']>[1]>

const swidgeExecutionConfigIsNotAny: IsAny<SwidgeExecutionConfig> = false

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
  maxNetworkFeeBps: 100n,
  maxProtocolFeeBps: 100
} satisfies ZerionProtocolConfig

void protocol.quoteSwidge(options)
void protocol.swidge(options, { maxNetworkFeeBps: config.maxNetworkFeeBps, paymasterToken: 'USDT' })
void protocol.getSwidgeStatus('0x' + '00'.repeat(32))
void protocol.getSupportedChains()
void protocol.getSupportedTokens({ fromChain: 'ethereum' })
void swidgeExecutionConfigIsNotAny
