import { describe, it, expect, vi } from 'vitest';
import {
  assertDefined,
  getOrDefault,
  safeArrayAccess,
  safeArrayAccessOrThrow,
  hasProperty,
  hasProperties,
  isNonEmptyString,
  isValidNumber,
  isNonEmptyArray,
  safeJsonParse,
  safeJsonParseWithFallback,
  typedKeys,
  typedEntries,
  typedValues,
  asRecord,
  exhaustiveCheck,
} from './type-guards';

describe('type-guards', () => {
  describe('assertDefined', () => {
    it('passes for defined values', () => {
      expect(() => assertDefined('hello', 'test')).not.toThrow();
      expect(() => assertDefined(0, 'test')).not.toThrow();
      expect(() => assertDefined(false, 'test')).not.toThrow();
      expect(() => assertDefined({}, 'test')).not.toThrow();
      expect(() => assertDefined([], 'test')).not.toThrow();
    });

    it('throws for null', () => {
      expect(() => assertDefined(null, 'myValue')).toThrow(
        'Assertion failed: myValue is null'
      );
    });

    it('throws for undefined', () => {
      expect(() => assertDefined(undefined, 'myValue')).toThrow(
        'Assertion failed: myValue is undefined'
      );
    });

    it('narrows type after assertion', () => {
      const value: string | undefined = 'test';
      assertDefined(value, 'value');
      // TypeScript should allow this without error
      const length: number = value.length;
      expect(length).toBe(4);
    });
  });

  describe('getOrDefault', () => {
    it('returns value when defined', () => {
      expect(getOrDefault('hello', 'default')).toBe('hello');
      expect(getOrDefault(0, 42)).toBe(0);
      expect(getOrDefault(false, true)).toBe(false);
    });

    it('returns default for null', () => {
      expect(getOrDefault(null, 'default')).toBe('default');
    });

    it('returns default for undefined', () => {
      expect(getOrDefault(undefined, 'default')).toBe('default');
    });
  });

  describe('safeArrayAccess', () => {
    const arr = ['a', 'b', 'c'];

    it('returns element at valid index', () => {
      expect(safeArrayAccess(arr, 0)).toBe('a');
      expect(safeArrayAccess(arr, 1)).toBe('b');
      expect(safeArrayAccess(arr, 2)).toBe('c');
    });

    it('returns undefined for negative index', () => {
      expect(safeArrayAccess(arr, -1)).toBeUndefined();
    });

    it('returns undefined for out of bounds index', () => {
      expect(safeArrayAccess(arr, 3)).toBeUndefined();
      expect(safeArrayAccess(arr, 100)).toBeUndefined();
    });

    it('returns undefined for empty array', () => {
      expect(safeArrayAccess([], 0)).toBeUndefined();
    });
  });

  describe('safeArrayAccessOrThrow', () => {
    const arr = ['a', 'b', 'c'];

    it('returns element at valid index', () => {
      expect(safeArrayAccessOrThrow(arr, 0, 'arr')).toBe('a');
      expect(safeArrayAccessOrThrow(arr, 2, 'arr')).toBe('c');
    });

    it('throws for negative index', () => {
      expect(() => safeArrayAccessOrThrow(arr, -1, 'arr')).toThrow(
        'Array access out of bounds: arr[-1], length=3'
      );
    });

    it('throws for out of bounds index', () => {
      expect(() => safeArrayAccessOrThrow(arr, 5, 'arr')).toThrow(
        'Array access out of bounds: arr[5], length=3'
      );
    });
  });

  describe('hasProperty', () => {
    it('returns true when property exists', () => {
      expect(hasProperty({ foo: 'bar' }, 'foo')).toBe(true);
      expect(hasProperty({ foo: null }, 'foo')).toBe(true);
      expect(hasProperty({ foo: undefined }, 'foo')).toBe(true);
    });

    it('returns false when property does not exist', () => {
      expect(hasProperty({ foo: 'bar' }, 'baz')).toBe(false);
      expect(hasProperty({}, 'foo')).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(hasProperty(null, 'foo')).toBe(false);
      expect(hasProperty(undefined, 'foo')).toBe(false);
      expect(hasProperty('string', 'foo')).toBe(false);
      expect(hasProperty(42, 'foo')).toBe(false);
    });
  });

  describe('hasProperties', () => {
    it('returns true when all properties exist', () => {
      expect(hasProperties({ a: 1, b: 2, c: 3 }, ['a', 'b'])).toBe(true);
      expect(hasProperties({ a: 1, b: 2 }, ['a', 'b'])).toBe(true);
    });

    it('returns false when any property is missing', () => {
      expect(hasProperties({ a: 1 }, ['a', 'b'])).toBe(false);
      expect(hasProperties({}, ['a'])).toBe(false);
    });

    it('returns true for empty keys array', () => {
      expect(hasProperties({ a: 1 }, [])).toBe(true);
      expect(hasProperties({}, [])).toBe(true);
    });

    it('returns false for non-objects', () => {
      expect(hasProperties(null, ['a'])).toBe(false);
      expect(hasProperties(undefined, ['a'])).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('returns true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString(' ')).toBe(true);
      expect(isNonEmptyString('0')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isNonEmptyString('')).toBe(false);
    });

    it('returns false for non-strings', () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(42)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
      expect(isNonEmptyString([])).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('returns true for valid numbers', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(42)).toBe(true);
      expect(isValidNumber(-42)).toBe(true);
      expect(isValidNumber(3.14)).toBe(true);
    });

    it('returns false for NaN', () => {
      expect(isValidNumber(NaN)).toBe(false);
    });

    it('returns false for Infinity', () => {
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber(-Infinity)).toBe(false);
    });

    it('returns false for non-numbers', () => {
      expect(isValidNumber('42')).toBe(false);
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
    });
  });

  describe('isNonEmptyArray', () => {
    it('returns true for non-empty arrays', () => {
      expect(isNonEmptyArray([1])).toBe(true);
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray([null])).toBe(true);
    });

    it('returns false for empty array', () => {
      expect(isNonEmptyArray([])).toBe(false);
    });

    it('returns false for non-arrays', () => {
      expect(isNonEmptyArray(null)).toBe(false);
      expect(isNonEmptyArray(undefined)).toBe(false);
      expect(isNonEmptyArray('abc')).toBe(false);
      expect(isNonEmptyArray({ length: 1 })).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    interface TestType {
      id: number;
      name: string;
    }

    const isTestType = (data: unknown): data is TestType =>
      hasProperties(data, ['id', 'name']) &&
      typeof (data as TestType).id === 'number' &&
      typeof (data as TestType).name === 'string';

    it('parses valid JSON matching validator', () => {
      const result = safeJsonParse('{"id": 1, "name": "test"}', isTestType);
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('returns null for invalid JSON', () => {
      const result = safeJsonParse('not json', isTestType);
      expect(result).toBeNull();
    });

    it('returns null for valid JSON not matching validator', () => {
      const result = safeJsonParse('{"id": "wrong", "name": "test"}', isTestType);
      expect(result).toBeNull();
    });
  });

  describe('safeJsonParseWithFallback', () => {
    interface Config {
      theme: string;
    }

    const isConfig = (data: unknown): data is Config =>
      hasProperty(data, 'theme') && typeof (data as Config).theme === 'string';

    const defaultConfig: Config = { theme: 'light' };

    it('returns parsed value for valid JSON', () => {
      const result = safeJsonParseWithFallback('{"theme": "dark"}', isConfig, defaultConfig);
      expect(result).toEqual({ theme: 'dark' });
    });

    it('returns fallback for invalid JSON', () => {
      const result = safeJsonParseWithFallback('invalid', isConfig, defaultConfig);
      expect(result).toEqual(defaultConfig);
    });

    it('returns fallback for non-matching JSON', () => {
      const result = safeJsonParseWithFallback('{"other": "value"}', isConfig, defaultConfig);
      expect(result).toEqual(defaultConfig);
    });
  });

  describe('typedKeys', () => {
    it('returns typed keys array', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const keys = typedKeys(obj);
      expect(keys).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array for empty object', () => {
      expect(typedKeys({})).toEqual([]);
    });
  });

  describe('typedEntries', () => {
    it('returns typed entries array', () => {
      const obj = { a: 1, b: 2 };
      const entries = typedEntries(obj);
      expect(entries).toEqual([
        ['a', 1],
        ['b', 2],
      ]);
    });
  });

  describe('typedValues', () => {
    it('returns typed values array', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const values = typedValues(obj);
      expect(values).toEqual([1, 2, 3]);
    });
  });

  describe('asRecord', () => {
    it('returns object as record', () => {
      const obj = { foo: 'bar' };
      const record = asRecord(obj);
      expect(record).toBe(obj);
    });

    it('returns null for null', () => {
      expect(asRecord(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(asRecord(undefined)).toBeNull();
    });

    it('returns null for arrays', () => {
      expect(asRecord([1, 2, 3])).toBeNull();
    });

    it('returns null for primitives', () => {
      expect(asRecord('string')).toBeNull();
      expect(asRecord(42)).toBeNull();
      expect(asRecord(true)).toBeNull();
    });
  });

  describe('exhaustiveCheck', () => {
    it('throws for unexpected values', () => {
      // This tests the runtime behavior
      // @ts-expect-error: Testing runtime behavior with invalid input
      expect(() => exhaustiveCheck('unexpected')).toThrow(
        'Unhandled discriminated union member: "unexpected"'
      );
    });
  });
});
