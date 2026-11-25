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
     * Executes a same-chain swap or cross-chain bridge through the Zerion API.
     *
     * When the input token is not yet approved, the approval returned by the API is
     * executed as part of the operation: erc-4337 accounts bundle it with the swap in a
     * single user operation, standard accounts send it first and wait for it to confirm.
     * Every transaction produced is listed in the result's `transactions` array.
     *
     * @param {ZerionSwidgeOptions} options - The swidge options.
     * @param {SwidgeProtocolConfig & Record<string, unknown>} [config] - Overrides for the fee caps, plus erc-4337
     *   execution options (e.g. paymaster configuration) forwarded to the account.
     * @returns {Promise<SwidgeResult>} The swidge execution result.
     * @throws {AccountRequiredError} If the protocol was created without a full account.
     * @throws {ValueError} If the swidge options are not valid, including exact-output requests.
     * @throws {InvalidTokenError} If a token cannot be resolved on its chain.
     * @throws {ProviderRequiredError} If the account is not connected to a provider.
     * @throws {ProviderError} If the Zerion API, the account's provider, or the approval transaction fails.
     * @throws {ZerionQuoteError} If no executable route is available or the minimum output is not met.
     * @throws {MaximumFeeExceededError} If a configured fee cap is exceeded or cannot be verified.
     */
    swidge(options: ZerionSwidgeOptions, config?: SwidgeProtocolConfig & Record<string, unknown>): Promise<SwidgeResult>;
    /**
     * Quotes the estimated costs and output of a same-chain swap or cross-chain bridge.
     *
     * @param {ZerionSwidgeOptions} options - The swidge options.
     * @returns {Promise<SwidgeQuote>} The quoted swidge details.
     */
    quoteSwidge(options: ZerionSwidgeOptions): Promise<SwidgeQuote>;
    /**
     * Retrieves the current status of a swidge by inspecting the source transaction.
     *
     * @param {string} id - The swidge id returned by {@link swidge}: a transaction hash for same-chain swaps, or
     *   'fromChain:toChain:hash' for cross-chain bridges.
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
    /** @private */
    private _mapSupportedTokens;
    /** @private */
    private _assertWritableAccount;
    /** @private */
    private _waitForTransaction;
    /** @private */
    private _getChains;
    /** @private */
    private _getAccountChain;
    /** @private */
    private _normalizeChain;
    /** @private */
    private _resolveToken;
    /** @private */
    private _buildQuoteRequest;
    /** @private */
    private _selectQuote;
    /** @private */
    private _prepareQuote;
    /** @private */
    private _quoteWithWallet;
    /** @private */
    private _validateEvmTransaction;
    /** @private */
    private _validateApproval;
    /** @private */
    private _mapQuote;
    /** @private */
    private _mapFees;
    /** @private */
    private _resolveFeeToken;
    /** @private */
    private _enforceFeeCaps;
}
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type IWalletAccountReadOnly = import("@tetherto/wdk-wallet").IWalletAccountReadOnly;
export type SwidgeProtocolConfig = import("@tetherto/wdk-wallet/protocols").SwidgeProtocolConfig;
export type SwidgeOptions = import("@tetherto/wdk-wallet/protocols").SwidgeOptions;
export type SwidgeQuote = import("@tetherto/wdk-wallet/protocols").SwidgeQuote;
export type SwidgeResult = import("@tetherto/wdk-wallet/protocols").SwidgeResult;
export type SwidgeFee = import("@tetherto/wdk-wallet/protocols").SwidgeFee;
export type SwidgeTransaction = import("@tetherto/wdk-wallet/protocols").SwidgeTransaction;
export type SwidgeStatusOptions = import("@tetherto/wdk-wallet/protocols").SwidgeStatusOptions;
export type SwidgeStatusResult = import("@tetherto/wdk-wallet/protocols").SwidgeStatusResult;
export type SwidgeSupportedChain = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedChain;
export type SwidgeSupportedToken = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedToken;
export type SwidgeSupportedTokensOptions = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedTokensOptions;
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
     * - Interval between approval-confirmation polls for standard accounts. Defaults to 3000.
     */
    approvalPollIntervalMs?: number;
    /**
     * - Maximum time to wait for an approval to confirm for standard accounts. Defaults to 180000.
     */
    approvalTimeoutMs?: number;
    /**
     * - Per-request timeout in milliseconds. Defaults to 30000.
     */
    timeoutMs?: number;
    /**
     * - Maximum number of retries for retryable API failures. Defaults to 2.
     */
    maxRetries?: number;
    /**
     * - Base delay between retries in milliseconds. Defaults to 400.
     */
    retryDelayMs?: number;
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
export type ZerionSwidgeOptions = SwidgeOptions;
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
    flags: Record<string, boolean>;
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
export type ZerionEvmTransaction = {
    /**
     * - The transaction target.
     */
    to: string;
    /**
     * - The native value attached to the transaction, in wei.
     */
    value: bigint;
    /**
     * - The transaction calldata.
     */
    data: string;
};
import { SwidgeProtocol } from '@tetherto/wdk-wallet/protocols';
import { ZerionApiClient } from './zerion-api-client.js';
