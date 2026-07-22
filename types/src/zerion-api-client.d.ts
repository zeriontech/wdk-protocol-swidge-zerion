/**
 * Minimal HTTP client for the Zerion REST API (https://developers.zerion.io).
 */
export class ZerionApiClient {
    /**
     * Creates a new Zerion API client.
     *
     * @param {ZerionApiClientConfig} config - The client configuration.
     */
    constructor(config?: ZerionApiClientConfig);
    /** @private */
    private _authorization;
    /** @private */
    private _baseUrl;
    /** @private */
    private _fetch;
    /** @private */
    private _timeoutMs;
    /** @private */
    private _maxRetries;
    /** @private */
    private _retryDelayMs;
    /**
     * Returns swap and bridge quotes for a pair of fungible assets.
     * See https://developers.zerion.io for the full reference of `GET /v1/swap/quotes/`.
     *
     * @param {Object} params - The quote request parameters.
     * @param {string} params.from - Address of the wallet performing the swap.
     * @param {string} params.to - Recipient of the output asset.
     * @param {string} params.inputChainId - Chain id the input asset lives on.
     * @param {string} params.inputFungibleId - Fungible id of the input asset.
     * @param {string} params.amount - Human-readable input amount as a decimal string.
     * @param {string} [params.outputChainId] - Chain id the output asset lives on. Defaults to the input chain.
     * @param {string} params.outputFungibleId - Fungible id of the output asset.
     * @param {number} [params.slippagePercent] - Maximum acceptable slippage in percent.
     * @param {string} [params.currency] - Currency for the fiat values in the response.
     * @returns {Promise<*>} The raw quotes response.
     */
    getSwapQuotes(params: {
        from: string;
        to: string;
        inputChainId: string;
        inputFungibleId: string;
        amount: string;
        outputChainId?: string;
        outputFungibleId: string;
        slippagePercent?: number;
        currency?: string;
    }): Promise<any>;
    /**
     * Returns the list of all chains supported by Zerion.
     *
     * @returns {Promise<*>} The raw chains response.
     */
    getChains(): Promise<any>;
    /**
     * Returns fungibles available for swapping and bridging between two chains.
     *
     * @param {Object} params - The request parameters.
     * @param {string} [params.inputChainId] - The source chain id.
     * @param {string} [params.outputChainId] - The destination chain id.
     * @param {'input' | 'output' | 'both'} [params.direction] - Which side of the route to list fungibles for.
     * @returns {Promise<*>} The raw fungibles response.
     */
    getSwapFungibles(params: {
        inputChainId?: string;
        outputChainId?: string;
        direction?: "input" | "output" | "both";
    }): Promise<any>;
    /**
     * Returns fungible assets, optionally filtered by chain, ordered by market cap
     * (descending) unless a different sort is provided.
     *
     * @param {Object} params - The request parameters.
     * @param {string} [params.implementationChainId] - Keep only fungibles deployed on this chain.
     * @param {string} [params.sort] - Sort order. Defaults to '-market_data.market_cap'.
     * @param {number} [params.pageSize] - Maximum number of fungibles to return (up to 100).
     * @returns {Promise<*>} The raw fungibles response.
     */
    listFungibles(params: {
        implementationChainId?: string;
        sort?: string;
        pageSize?: number;
    }): Promise<any>;
    /**
     * Returns a fungible asset by its Zerion fungible id.
     *
     * @param {string} fungibleId - The fungible id.
     * @returns {Promise<*>} The raw fungible response.
     */
    getFungible(fungibleId: string): Promise<any>;
    /**
     * Returns a fungible asset by one of its implementations.
     *
     * @param {string} implementation - Implementation in the format `chain` or `chain:address`.
     *   When only the chain is provided, the chain's base (native) asset is returned.
     * @returns {Promise<*>} The raw fungible response.
     */
    getFungibleByImplementation(implementation: string): Promise<any>;
    /** @private */
    private _requestJson;
}
export type ZerionApiClientConfig = {
    /**
     * - The Zerion API key (from https://dashboard.zerion.io).
     */
    apiKey: string;
    /**
     * - The Zerion API base url. Defaults to 'https://api.zerion.io'.
     */
    baseUrl?: string;
    /**
     * - Custom fetch implementation. Defaults to the global fetch.
     */
    fetch?: typeof fetch;
    /**
     * - Per-request timeout in milliseconds. Defaults to 30000.
     */
    timeoutMs?: number;
    /**
     * - Maximum number of retries for retryable failures. Defaults to 2.
     */
    maxRetries?: number;
    /**
     * - Base delay between retries in milliseconds. Defaults to 400.
     */
    retryDelayMs?: number;
};
