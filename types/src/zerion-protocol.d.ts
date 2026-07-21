export default class ZerionProtocol extends SwidgeProtocol {
    /**
     * Creates a discovery-only interface to the Zerion swap and bridge API.
     *
     * @overload
     * @param {undefined} [account] - The wallet account to use to interact with the protocol.
     * @param {ZerionProtocolConfig} [config] - The protocol configuration.
     */
    constructor(account?: undefined, config?: ZerionProtocolConfig);
    /**
     * Creates a new read-only interface to the Zerion swap and bridge API.
     *
     * @overload
     * @param {IWalletAccountReadOnly} account - The wallet account to use to interact with the protocol.
     * @param {ZerionProtocolConfig} [config] - The protocol configuration.
     */
    constructor(account: IWalletAccountReadOnly, config?: ZerionProtocolConfig);
    /**
     * Creates a new interface to the Zerion swap and bridge API.
     *
     * @overload
     * @param {IWalletAccount} account - The wallet account to use to interact with the protocol.
     * @param {ZerionProtocolConfig} [config] - The protocol configuration.
     */
    constructor(account: IWalletAccount, config?: ZerionProtocolConfig);
    /** @private */
    private _client;
    /** @private */
    private _provider;
    /** @private @type {Promise<ZerionChain[]> | undefined} */
    private _chainsPromise;
    /** @private @type {Promise<ZerionChain> | undefined} */
    private _accountChainPromise;
    /** @private @type {Map<string, ZerionToken>} */
    private _tokenCache;
    /**
     * Quotes the estimated costs and output of a same-chain swap or cross-chain bridge.
     * Quotes are non-binding; the best route across Zerion's aggregated liquidity
     * sources is selected automatically.
     *
     * @param {ZerionSwidgeOptions} options - The swidge options.
     * @returns {Promise<SwidgeQuote>} The quoted swidge details.
     */
    quoteSwidge(options: ZerionSwidgeOptions): Promise<SwidgeQuote>;
    /**
     * Executes a same-chain swap or cross-chain bridge through the Zerion API.
     *
     * With standard (non erc-4337) accounts, the input token must already be approved:
     * if an approval is missing, a {@link ZerionAllowanceError} is thrown carrying the
     * ready-to-send approve transaction. Erc-4337 accounts bundle the approval with the
     * swap automatically, so no prior approval is needed.
     *
     * @param {ZerionSwidgeOptions} options - The swidge options.
     * @param {SwidgeProtocolConfig & Object} [config] - Overrides for the fee caps, plus erc-4337
     *   execution options (e.g. paymaster configuration) forwarded to the account.
     * @returns {Promise<SwidgeResult>} The swidge execution result.
     */
    swidge(options: ZerionSwidgeOptions, config?: SwidgeProtocolConfig & any): Promise<SwidgeResult>;
    /**
     * Maps classic swap options to swidge options, translating the exact-input
     * constraint into the classic interface's vocabulary.
     *
     * @private
     * @param {SwapOptions} options - The swap options.
     * @returns {ZerionSwidgeOptions} The equivalent swidge options.
     */
    private _toSwidgeOptions;
    /**
     * Retrieves the current status of a swidge by inspecting the source transaction.
     *
     * @param {string} id - The swidge id returned by {@link swidge} ('fromChain:toChain:hash'), or a plain transaction hash.
     * @param {ZerionSwidgeStatusOptions} [options] - Optional source/destination chain hints (used with plain-hash ids).
     * @returns {Promise<ZerionSwidgeStatusResult>} The current swidge status.
     */
    getSwidgeStatus(id: string, options?: ZerionSwidgeStatusOptions): Promise<ZerionSwidgeStatusResult>;
    /**
     * Retrieves the chains on which Zerion supports trading.
     *
     * @returns {Promise<ZerionSwidgeSupportedChain[]>} The supported chains.
     */
    getSupportedChains(): Promise<ZerionSwidgeSupportedChain[]>;
    /**
     * Retrieves the tokens available for swidge operations, optionally scoped to a route.
     *
     * @param {ZerionSwidgeSupportedTokensOptions} [options] - Optional source/destination chain filters.
     * @returns {Promise<ZerionSwidgeSupportedToken[]>} The supported tokens.
     */
    getSupportedTokens(options?: ZerionSwidgeSupportedTokensOptions): Promise<ZerionSwidgeSupportedToken[]>;
    /**
     * Maps a Zerion fungibles response to supported-token entries on a chain.
     *
     * @private
     * @returns {SwidgeSupportedToken[]} The mapped tokens.
     */
    private _mapSupportedTokens;
    /**
     * Asserts that the configured account can sign and broadcast transactions.
     * Writable accounts are detected by their `sendTransaction` capability
     * (read-only accounts do not expose it), keeping the wallet packages out
     * of the module's runtime dependency tree.
     *
     * @private
     */
    private _assertWritableAccount;
    /** @private */
    private _getChains;
    /** @private */
    private _getAccountChain;
    /**
     * Resolves a chain reference (Zerion chain id, EIP-155 numeric id, or hex id) to a Zerion chain.
     *
     * @private
     * @param {string | number | bigint} chainRef - The chain reference.
     * @returns {Promise<ZerionChain>} The resolved chain.
     */
    private _normalizeChain;
    /**
     * Resolves a token reference to a Zerion fungible on the given chain.
     * Accepts an ERC-20 contract address, a Zerion fungible id (e.g. 'eth'),
     * or a native-asset sentinel ('native' or 0xeeee...eeee).
     *
     * @private
     * @param {string} token - The token reference.
     * @param {ZerionChain} chain - The chain the token lives on.
     * @returns {Promise<ZerionToken>} The resolved token.
     */
    private _resolveToken;
    /** @private */
    private _buildQuoteRequest;
    /** @private */
    private _selectQuote;
    /** @private */
    private _sumFees;
    /** @private */
    private _mapQuote;
    /**
     * Maps Zerion fee blocks to the swidge fee model. Zerion's network fee is charged
     * on the source chain, Zerion's own fee is 'protocol', and bridge-provider fees
     * are 'other' so classic bridge adapters do not mix denominations.
     *
     * @private
     * @returns {Promise<SwidgeFee[]>} The mapped fees.
     */
    private _mapFees;
    /** @private */
    private _resolveFeeToken;
    /**
     * Enforces the configured fee caps against a quote, using the fiat values reported
     * by the Zerion API. Caps are skipped when the API reports no fiat value for the
     * corresponding amounts.
     *
     * @private
     */
    private _enforceFeeCaps;
}
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type IWalletAccountReadOnly = import("@tetherto/wdk-wallet").IWalletAccountReadOnly;
export type SwidgeProtocolConfig = import("@tetherto/wdk-wallet/protocols").SwidgeProtocolConfig;
export type SwidgeOptions = import("@tetherto/wdk-wallet/protocols").SwidgeOptions;
export type SwidgeQuote = import("@tetherto/wdk-wallet/protocols").SwidgeQuote;
export type SwidgeResult = import("@tetherto/wdk-wallet/protocols").SwidgeResult;
export type SwidgeFee = import("@tetherto/wdk-wallet/protocols").SwidgeFee;
export type SwidgeStatusOptions = import("@tetherto/wdk-wallet/protocols").SwidgeStatusOptions;
export type SwidgeStatusResult = import("@tetherto/wdk-wallet/protocols").SwidgeStatusResult;
export type SwidgeSupportedChain = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedChain;
export type SwidgeSupportedToken = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedToken;
export type SwidgeSupportedTokensOptions = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedTokensOptions;
export type SwapOptions = import("@tetherto/wdk-wallet/protocols").SwapOptions;
export type SwapResult = import("@tetherto/wdk-wallet/protocols").SwapResult;
export type BridgeOptions = import("@tetherto/wdk-wallet/protocols").BridgeOptions;
export type BridgeResult = import("@tetherto/wdk-wallet/protocols").BridgeResult;
export type ZerionProtocolSpecificConfig = {
    /**
     * - The Zerion API key (from https://dashboard.zerion.io). Required unless a custom client is provided.
     */
    apiKey?: string;
    /**
     * - The Zerion API base url. Defaults to 'https://api.zerion.io'.
     */
    baseUrl?: string;
    /**
     * - Default maximum acceptable slippage in percent (e.g. 1 for 1%).
     * When omitted, Zerion picks an auto-slippage value based on the pair's volatility and liquidity.
     */
    slippagePercent?: number;
    /**
     * - Currency for fiat values in quotes. Defaults to 'usd'.
     */
    currency?: string;
    /**
     * - Per-request timeout in milliseconds.
     */
    timeoutMs?: number;
    /**
     * - Maximum number of retries for retryable API failures.
     */
    maxRetries?: number;
    /**
     * - Custom fetch implementation.
     */
    fetch?: typeof fetch;
    /**
     * - Custom pre-configured Zerion API client.
     */
    client?: ZerionApiClient;
};
export type ZerionProtocolConfig = SwidgeProtocolConfig & ZerionProtocolSpecificConfig;
export type ZerionSwidgeOptionsExtension = {
    /**
     * - Abort execution when the quoted minimum output is below this base-unit amount.
     */
    minAmountOut?: number | bigint;
};
export type ZerionSwidgeOptions = SwidgeOptions & ZerionSwidgeOptionsExtension;
export type ZerionSwidgeStatusOptions = SwidgeStatusOptions;
export type ZerionSwidgeStatusResult = SwidgeStatusResult;
export type ZerionSwidgeSupportedChain = SwidgeSupportedChain;
export type ZerionSwidgeSupportedToken = SwidgeSupportedToken;
export type ZerionSwidgeSupportedTokensOptions = SwidgeSupportedTokensOptions;
export type ZerionChain = {
    /**
     * - The Zerion chain id (e.g. 'ethereum', 'base').
     */
    id: string;
    /**
     * - The EIP-155 chain id in hex (e.g. '0x1'), when applicable.
     */
    externalId: string | undefined;
    /**
     * - The human-readable chain name.
     */
    name: string;
    /**
     * - Chain capability flags (e.g. supports_trading, supports_bridge).
     */
    flags: any;
};
export type ZerionToken = {
    /**
     * - The Zerion fungible id to use in swap requests.
     */
    fungibleId: string;
    /**
     * - The token symbol.
     */
    symbol: string;
    /**
     * - The token's number of decimal places on the resolved chain.
     */
    decimals: number;
    /**
     * - The token contract address, or null for native assets.
     */
    address: string | null;
};
import { SwidgeProtocol } from '@tetherto/wdk-wallet/protocols';
import { ZerionApiClient } from './zerion-api-client.js';
