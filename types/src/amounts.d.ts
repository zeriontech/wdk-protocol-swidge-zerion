/**
 * Converts a human-readable decimal string into base units.
 * Fractional digits beyond the token's precision are truncated.
 *
 * @param {string} quantity - Human-readable amount as a decimal string (e.g. '0.001').
 * @param {number} decimals - The token's number of decimal places.
 * @returns {bigint} The amount in base units.
 */
export function toBaseUnits(quantity: string, decimals: number): bigint;
/**
 * Converts an amount in base units into a human-readable decimal string.
 *
 * @param {number | bigint} amount - The amount in base units.
 * @param {number} decimals - The token's number of decimal places.
 * @returns {string} Human-readable amount as a decimal string.
 */
export function fromBaseUnits(amount: number | bigint, decimals: number): string;
