import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  ApiValidationError,
  validateApiResponse,
  validateApiResponseWithErrors,
  parseApiResponse,
  tryValidateApiResponse,
  createPaginatedValidator,
  isApiErrorResponse,
  createApiResponseValidator,
  fetchJson,
  fetchJsonOrDefault,
  type ValidationResult,
  type PaginatedResponse,
} from './api-validation';
import { hasProperties } from './type-guards';

describe('api-validation', () => {
  describe('ApiValidationError', () => {
    it('creates error with context and validation errors', () => {
      const error = new ApiValidationError('fetchUser', ['Missing id', 'Invalid name']);
      expect(error.name).toBe('ApiValidationError');
      expect(error.context).toBe('fetchUser');
      expect(error.validationErrors).toEqual(['Missing id', 'Invalid name']);
      expect(error.message).toBe('API validation failed for fetchUser: Missing id, Invalid name');
    });
  });

  describe('validateApiResponse', () => {
    interface User {
      id: string;
      name: string;
    }

    const isUser = (data: unknown): data is User =>
      hasProperties(data, ['id', 'name']) &&
      typeof (data as User).id === 'string' &&
      typeof (data as User).name === 'string';

    it('returns data when validation passes', () => {
      const data = { id: '1', name: 'Test User' };
      const result = validateApiResponse(data, isUser, 'fetchUser');
      expect(result).toEqual(data);
    });

    it('throws ApiValidationError when validation fails', () => {
      const data = { id: 123, name: 'Test User' }; // id should be string
      expect(() => validateApiResponse(data, isUser, 'fetchUser')).toThrow(
        ApiValidationError
      );
    });

    it('includes context in error', () => {
      const data = { invalid: true };
      try {
        validateApiResponse(data, isUser, 'fetchUser');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiValidationError);
        expect((error as ApiValidationError).context).toBe('fetchUser');
      }
    });
  });

  describe('validateApiResponseWithErrors', () => {
    interface User {
      id: string;
      name: string;
    }

    const validateUser = (data: unknown): ValidationResult<User> => {
      const errors: string[] = [];

      if (!hasProperties(data, ['id', 'name'])) {
        return { success: false, errors: ['Missing required properties'] };
      }

      const obj = data as { id: unknown; name: unknown };

      if (typeof obj.id !== 'string') errors.push('id must be a string');
      if (typeof obj.name !== 'string') errors.push('name must be a string');

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return { success: true, data: data as User };
    };

    it('returns data when validation passes', () => {
      const data = { id: '1', name: 'Test User' };
      const result = validateApiResponseWithErrors(data, validateUser, 'fetchUser');
      expect(result).toEqual(data);
    });

    it('throws with detailed errors when validation fails', () => {
      const data = { id: 123, name: 456 };
      try {
        validateApiResponseWithErrors(data, validateUser, 'fetchUser');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiValidationError);
        const apiError = error as ApiValidationError;
        expect(apiError.validationErrors).toContain('id must be a string');
        expect(apiError.validationErrors).toContain('name must be a string');
      }
    });
  });

  describe('parseApiResponse', () => {
    const isString = (data: unknown): data is string => typeof data === 'string';
    const fallback = 'default';

    it('returns data when validation passes', () => {
      expect(parseApiResponse('hello', isString, fallback)).toBe('hello');
    });

    it('returns fallback when validation fails', () => {
      expect(parseApiResponse(123, isString, fallback)).toBe('default');
    });

    it('returns fallback for null', () => {
      expect(parseApiResponse(null, isString, fallback)).toBe('default');
    });
  });

  describe('tryValidateApiResponse', () => {
    interface Config {
      theme: string;
    }

    const validateConfig = (data: unknown): ValidationResult<Config> => {
      if (!hasProperties(data, ['theme'])) {
        return { success: false, errors: ['Missing theme property'] };
      }
      const obj = data as { theme: unknown };
      if (typeof obj.theme !== 'string') {
        return { success: false, errors: ['theme must be a string'] };
      }
      return { success: true, data: data as Config };
    };

    it('returns success result for valid data', () => {
      const result = tryValidateApiResponse({ theme: 'dark' }, validateConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ theme: 'dark' });
      }
    });

    it('returns failure result for invalid data', () => {
      const result = tryValidateApiResponse({ theme: 123 }, validateConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain('theme must be a string');
      }
    });
  });

  describe('createPaginatedValidator', () => {
    interface Item {
      id: number;
    }

    const isItem = (data: unknown): data is Item =>
      hasProperties(data, ['id']) && typeof (data as Item).id === 'number';

    const validatePaginated = createPaginatedValidator(isItem);

    it('validates valid paginated response', () => {
      const data: PaginatedResponse<Item> = {
        data: [{ id: 1 }, { id: 2 }],
        meta: { total: 2, page: 1, limit: 10 },
      };

      const result = validatePaginated(data);
      expect(result.success).toBe(true);
    });

    it('fails for missing data property', () => {
      const data = { meta: { total: 0, page: 1, limit: 10 } };
      const result = validatePaginated(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain('Missing "data" property');
      }
    });

    it('fails for missing meta property', () => {
      const data = { data: [] };
      const result = validatePaginated(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain('Missing "meta" property');
      }
    });

    it('fails for invalid item in data array', () => {
      const data = {
        data: [{ id: 1 }, { invalid: true }],
        meta: { total: 2, page: 1, limit: 10 },
      };
      const result = validatePaginated(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain('Item at index 1 is invalid');
      }
    });

    it('fails for invalid meta properties', () => {
      const data = {
        data: [],
        meta: { total: 'invalid', page: 1, limit: 10 },
      };
      const result = validatePaginated(data);
      expect(result.success).toBe(false);
    });
  });

  describe('isApiErrorResponse', () => {
    it('returns true for valid error response', () => {
      expect(isApiErrorResponse({ error: 'Something went wrong' })).toBe(true);
      expect(isApiErrorResponse({ error: 'Error', code: 'ERR_001' })).toBe(true);
      expect(
        isApiErrorResponse({ error: 'Error', details: { field: 'name' } })
      ).toBe(true);
    });

    it('returns false for empty error string', () => {
      expect(isApiErrorResponse({ error: '' })).toBe(false);
    });

    it('returns false for missing error property', () => {
      expect(isApiErrorResponse({ message: 'Error' })).toBe(false);
      expect(isApiErrorResponse({})).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(isApiErrorResponse(null)).toBe(false);
      expect(isApiErrorResponse('error')).toBe(false);
    });
  });

  describe('createApiResponseValidator', () => {
    interface Data {
      value: number;
    }

    const isData = (data: unknown): data is Data =>
      hasProperties(data, ['value']) && typeof (data as Data).value === 'number';

    const validateResponse = createApiResponseValidator(isData);

    it('validates successful response', () => {
      expect(validateResponse({ success: true, data: { value: 42 } })).toBe(true);
    });

    it('validates error response', () => {
      expect(validateResponse({ success: false, error: 'Failed' })).toBe(true);
      expect(validateResponse({ success: false })).toBe(true);
    });

    it('fails for missing success property', () => {
      expect(validateResponse({ data: { value: 42 } })).toBe(false);
    });

    it('fails for success=true with invalid data', () => {
      expect(validateResponse({ success: true, data: { value: 'wrong' } })).toBe(
        false
      );
    });
  });

  describe('fetchJson', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns validated data for successful response', async () => {
      const mockData = { id: '1', name: 'Test' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const isUser = (data: unknown): data is { id: string; name: string } =>
        hasProperties(data, ['id', 'name']);

      const result = await fetchJson('/api/user', isUser, 'fetchUser');
      expect(result).toEqual(mockData);
    });

    it('throws for non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const isUser = (data: unknown): data is { id: string } =>
        hasProperties(data, ['id']);

      await expect(fetchJson('/api/user', isUser, 'fetchUser')).rejects.toThrow(
        ApiValidationError
      );
    });

    it('throws for invalid response data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: true }),
      });

      const isUser = (data: unknown): data is { id: string } =>
        hasProperties(data, ['id']);

      await expect(fetchJson('/api/user', isUser, 'fetchUser')).rejects.toThrow(
        ApiValidationError
      );
    });
  });

  describe('fetchJsonOrDefault', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns data for successful response', async () => {
      const mockData = { theme: 'dark' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const isConfig = (data: unknown): data is { theme: string } =>
        hasProperties(data, ['theme']);
      const fallback = { theme: 'light' };

      const result = await fetchJsonOrDefault('/api/config', isConfig, fallback);
      expect(result).toEqual(mockData);
    });

    it('returns fallback for non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const isConfig = (data: unknown): data is { theme: string } =>
        hasProperties(data, ['theme']);
      const fallback = { theme: 'light' };

      const result = await fetchJsonOrDefault('/api/config', isConfig, fallback);
      expect(result).toEqual(fallback);
    });

    it('returns fallback for invalid data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: true }),
      });

      const isConfig = (data: unknown): data is { theme: string } =>
        hasProperties(data, ['theme']);
      const fallback = { theme: 'light' };

      const result = await fetchJsonOrDefault('/api/config', isConfig, fallback);
      expect(result).toEqual(fallback);
    });

    it('returns fallback on fetch error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const isConfig = (data: unknown): data is { theme: string } =>
        hasProperties(data, ['theme']);
      const fallback = { theme: 'light' };

      const result = await fetchJsonOrDefault('/api/config', isConfig, fallback);
      expect(result).toEqual(fallback);
    });
  });
});
