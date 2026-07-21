import ZerionProtocol, { type ZerionSwidgeOptions } from 'wdk-protocol-swidge-zerion'

declare const protocol: ZerionProtocol

const options = {
  fromToken: 'eth',
  toToken: 'usdc',
  fromTokenAmount: 1n,
  minAmountOut: 1n
} satisfies ZerionSwidgeOptions

void protocol.quoteSwidge(options)
void protocol.swidge(options)
void protocol.getSwidgeStatus('0x' + '00'.repeat(32))
void protocol.getSupportedChains()
void protocol.getSupportedTokens({ fromChain: 'ethereum' })
