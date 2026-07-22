export class ZerionError extends Error {
    /**
     * @param {string} code - Machine-readable error code.
     * @param {string} message - Human-readable error message.
     * @param {*} [details] - Additional error context.
     */
    constructor(code: string, message: string, details?: any);
    code: string;
    details: any;
}
export class ZerionApiError extends ZerionError {
    /**
     * @param {string} code - Machine-readable error code.
     * @param {string} message - Human-readable error message.
     * @param {number} status - The HTTP status code returned by the Zerion API.
     * @param {*} [details] - Additional error context.
     */
    constructor(code: string, message: string, status: number, details?: any);
    status: number;
}
export class ZerionQuoteError extends ZerionError {
    /**
     * @param {string} message - Human-readable error message.
     * @param {*} [details] - Additional error context.
     */
    constructor(message: string, details?: any);
}
export class ZerionCapabilityError extends ZerionError {
    /**
     * @param {string} message - Human-readable error message.
     * @param {*} [details] - Additional error context.
     */
    constructor(message: string, details?: any);
}
export class ZerionAllowanceError extends ZerionError {
    /**
     * @param {string} message - Human-readable error message.
     * @param {{ token: string, transaction: { to: string, value: bigint, data: string } }} details - The
     *   token requiring approval and the ready-to-send approve transaction returned by the Zerion API.
     */
    constructor(message: string, details: {
        token: string;
        transaction: {
            to: string;
            value: bigint;
            data: string;
        };
    });
}
