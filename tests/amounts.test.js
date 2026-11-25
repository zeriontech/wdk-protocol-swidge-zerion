import { describe, expect, test } from '@jest/globals'

import { toBaseUnits, fromBaseUnits } from '../src/amounts.js'

describe('amounts', () => {
  describe('toBaseUnits', () => {
    test('should convert decimal strings to base units', () => {
      expect(toBaseUnits('0.001', 18)).toBe(1_000_000_000_000_000n)
      expect(toBaseUnits('1', 6)).toBe(1_000_000n)
      expect(toBaseUnits('2500.5', 6)).toBe(2_500_500_000n)
      expect(toBaseUnits('0', 18)).toBe(0n)
      expect(toBaseUnits('.5', 2)).toBe(50n)
      expect(toBaseUnits('42', 0)).toBe(42n)
    })

    test('should truncate excess precision', () => {
      expect(toBaseUnits('0.1234567', 6)).toBe(123_456n)
    })

    test('should throw on invalid input', () => {
      expect(() => toBaseUnits('', 18)).toThrow('Invalid decimal amount')
      expect(() => toBaseUnits('abc', 18)).toThrow('Invalid decimal amount')
      expect(() => toBaseUnits('1e18', 18)).toThrow('Invalid decimal amount')
      expect(() => toBaseUnits('-1', 18)).toThrow('Invalid decimal amount')
      expect(() => toBaseUnits('.', 18)).toThrow('Invalid decimal amount')
    })
  })

  describe('fromBaseUnits', () => {
    test('should convert base units to decimal strings', () => {
      expect(fromBaseUnits(1_000_000_000_000_000n, 18)).toBe('0.001')
      expect(fromBaseUnits(1_000_000n, 6)).toBe('1')
      expect(fromBaseUnits(2_500_500_000n, 6)).toBe('2500.5')
      expect(fromBaseUnits(0n, 18)).toBe('0')
      expect(fromBaseUnits(42, 0)).toBe('42')
    })

    test('should round-trip with toBaseUnits', () => {
      expect(toBaseUnits(fromBaseUnits(123_456_789n, 8), 8)).toBe(123_456_789n)
    })

    test('should throw on negative amounts', () => {
      expect(() => fromBaseUnits(-1n, 18)).toThrow('Amounts must be positive')
    })

    test('should reject unsafe or fractional numeric amounts', () => {
      expect(() => fromBaseUnits(Number.MAX_SAFE_INTEGER + 1, 18)).toThrow('safe integers')
      expect(() => fromBaseUnits(1.5, 18)).toThrow('safe integers')
    })

    test('should reject non-numeric amounts', () => {
      expect(() => fromBaseUnits('1', 18)).toThrow('safe integer or bigint')
      expect(() => fromBaseUnits(undefined, 18)).toThrow('safe integer or bigint')
    })
  })
})
