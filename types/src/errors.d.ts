/**
 * Maps a Zerion API quote error code to the closest WDK swidge error reason.
 *
 * @param {string | undefined} code - The machine-readable error code reported by the Zerion API.
 * @returns {string} The swidge error reason.
 */
export function toSwidgeErrorReason(code: string | undefined): string;
/**
 * @typedef {Object} ZerionApiErrorDetails
 * @property {string} [url] - The request url that failed.
 * @property {*} [body] - The parsed error body returned by the Zerion API, when available.
 * @property {unknown} [cause] - The underlying error, when available.
 */
/**
 * @typedef {Object} ZerionQuoteErrorDetails
 * @property {string} [reason] - The swidge error reason. Defaults to `ROUTE_NOT_SUPPORTED`.
 * @property {string} [code] - The machine-readable error code reported by the Zerion API.
 * @property {string} [hint] - The suggested user action reported by the Zerion API.
 * @property {unknown} [cause] - The underlying error, when available.
 */
/**
 * Error raised when the Zerion API cannot be reached, rejects a request, or returns a
 * malformed payload. It extends the WDK `ProviderError` so wallet applications can handle
 * it together with other provider failures.
 */
export class ZerionApiError extends ProviderError {
    /**
     * Creates a new Zerion API error.
     *
     * @param {string} code - Machine-readable error code: the API error title, `network_error`, or `invalid_response`.
     * @param {string} message - Human-readable error message.
     * @param {number} status - The HTTP status code returned by the Zerion API, or 0 when no response was received.
     * @param {ZerionApiErrorDetails} [details] - Additional request context.
     */
    constructor(code: string, message: string, status: number, details?: ZerionApiErrorDetails);
    /**
     * Machine-readable error code.
     *
     * @type {string}
     */
    code: string;
    /**
     * The HTTP status code returned by the Zerion API, or 0 when no response was received.
     *
     * @type {number}
     */
    status: number;
    /**
     * Additional request context.
     *
     * @type {ZerionApiErrorDetails}
     */
    details: ZerionApiErrorDetails;
}
/**
 * Error raised when Zerion returns no executable route for the requested pair, or when the
 * best route cannot satisfy the requested constraints. It extends the WDK `SwidgeError`
 * and always carries a standard swidge error reason.
 */
export class ZerionQuoteError extends SwidgeError {
    /**
     * Creates a new Zerion quote error.
     *
     * @param {string} message - Human-readable error message.
     * @param {ZerionQuoteErrorDetails} [details] - The swidge error reason and the Zerion API error context.
     */
    constructor(message: string, details?: ZerionQuoteErrorDetails);
    /**
     * The machine-readable error code reported by the Zerion API, when available.
     *
     * @type {string | undefined}
     */
    code: string | undefined;
    /**
     * The suggested user action reported by the Zerion API, when available.
     *
     * @type {string | undefined}
     */
    hint: string | undefined;
}
export type ZerionApiErrorDetails = {
    /**
     * - The request url that failed.
     */
    url?: string;
    /**
     * - The parsed error body returned by the Zerion API, when available.
     */
    body?: any;
    /**
     * - The underlying error, when available.
     */
    cause?: unknown;
};
export type ZerionQuoteErrorDetails = {
    /**
     * - The swidge error reason. Defaults to `ROUTE_NOT_SUPPORTED`.
     */
    reason?: string;
    /**
     * - The machine-readable error code reported by the Zerion API.
     */
    code?: string;
    /**
     * - The suggested user action reported by the Zerion API.
     */
    hint?: string;
    /**
     * - The underlying error, when available.
     */
    cause?: unknown;
};
import { ProviderError } from '@tetherto/wdk-wallet/protocols';
import { SwidgeError } from '@tetherto/wdk-wallet/protocols';
