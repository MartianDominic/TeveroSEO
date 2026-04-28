import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyChange, applyBatchChanges, previewChange, type ApplyChangeInput } from './ChangeService';
import type { PlatformWriteAdapter } from '@/server/features/connections/adapters/BaseAdapter';
import type { RecipeContext } from '@/lib/edit-recipes';

// Mock dependencies
vi.mock('../repositories/ChangeRepository', () => ({
  insertChange: vi.fn().mockResolvedValue({ id: 'change-1' }),
  markChangeVerified: vi.fn().mockResolvedValue({ id: 'change-1', status: 'verified' }),
  markChangeFailed: vi.fn().mockResolvedValue({ id: 'change-1', status: 'failed' }),
  ChangeRepository: {
    getChangesByResource: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('~/db', () => ({
  db: {
    transaction: vi.fn((fn) => fn({
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    })),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('test-change-id'),
}));

describe('ChangeService', () => {
  const mockAdapter: PlatformWriteAdapter = {
    platform: 'wordpress' as const,
    siteUrl: 'https://example.com',
    readField: vi.fn(),
    writeField: vi.fn(),
    updateMeta: vi.fn(),
    updateImageAlt: vi.fn(),
    updateImageAttributes: vi.fn(),
    verifyConnection: vi.fn(),
    testWritePermission: vi.fn(),
  };

  const baseContext: RecipeContext = {
    resourceId: 'post-123',
    resourceUrl: 'https://example.com/page',
    resourceType: 'page',
    findingDetails: {},
  };

  const baseInput: ApplyChangeInput = {
    clientId: 'client-1',
    connectionId: 'conn-1',
    recipeId: 'add-canonical',
    context: baseContext,
    triggeredBy: 'audit',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockAdapter.readField).mockResolvedValue(null);
    vi.mocked(mockAdapter.writeField).mockResolvedValue({ success: true });
  });

  describe('applyChange', () => {
    it('applies a safe recipe successfully', async () => {
      const result = await applyChange(mockAdapter, baseInput);

      expect(result.success).toBe(true);
      expect(result.changeId).toBe('test-change-id');
      expect(result.error).toBeUndefined();
    });

    it('rejects unknown recipe', async () => {
      const result = await applyChange(mockAdapter, {
        ...baseInput,
        recipeId: 'unknown-recipe',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown recipe');
    });

    it('rejects complex recipe for audit trigger', async () => {
      const result = await applyChange(mockAdapter, {
        ...baseInput,
        recipeId: 'add-title', // Complex recipe
        triggeredBy: 'audit',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires human review');
    });

    it('allows complex recipe for manual trigger', async () => {
      const result = await applyChange(mockAdapter, {
        ...baseInput,
        recipeId: 'add-title',
        triggeredBy: 'manual',
        context: {
          ...baseContext,
          suggestedValue: 'New Title',
        },
      });

      // Complex recipes return error from stub handler, not from safety check
      expect(result.error).not.toContain('requires human review');
    });

    it('includes batch info when provided', async () => {
      const { insertChange } = await import('../repositories/ChangeRepository');

      await applyChange(mockAdapter, {
        ...baseInput,
        batchId: 'batch-123',
        batchSequence: 5,
      });

      expect(insertChange).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: 'batch-123',
          batchSequence: 5,
        })
      );
    });
  });

  describe('applyBatchChanges', () => {
    it('processes multiple changes', async () => {
      const inputs = [
        { ...baseInput, context: { ...baseContext, resourceId: 'post-1' } },
        { ...baseInput, context: { ...baseContext, resourceId: 'post-2' } },
        { ...baseInput, context: { ...baseContext, resourceId: 'post-3' } },
      ];

      const result = await applyBatchChanges(mockAdapter, inputs);

      expect(result.total).toBe(3);
      expect(result.succeeded.length).toBe(3);
      expect(result.failed.length).toBe(0);
      expect(result.batchId).toBeDefined();
    });

    it('continues on individual failures', async () => {
      // Second call fails
      vi.mocked(mockAdapter.writeField)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'API error' })
        .mockResolvedValueOnce({ success: true });

      const inputs = [
        { ...baseInput, context: { ...baseContext, resourceId: 'post-1' }, findingId: 'finding-1' },
        { ...baseInput, context: { ...baseContext, resourceId: 'post-2' }, findingId: 'finding-2' },
        { ...baseInput, context: { ...baseContext, resourceId: 'post-3' }, findingId: 'finding-3' },
      ];

      const result = await applyBatchChanges(mockAdapter, inputs);

      expect(result.succeeded.length).toBe(2);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].findingId).toBe('finding-2');
    });
  });

  describe('previewChange', () => {
    it('returns preview with current value', async () => {
      vi.mocked(mockAdapter.readField).mockResolvedValue('https://example.com/old');

      const preview = await previewChange(mockAdapter, 'add-canonical', {
        ...baseContext,
        suggestedValue: 'https://example.com/new',
      });

      expect(preview.recipeId).toBe('add-canonical');
      expect(preview.recipeName).toBe('Add Canonical URL');
      expect(preview.field).toBe('canonical');
      expect(preview.currentValue).toBe('https://example.com/old');
      expect(preview.newValue).toBe('https://example.com/new');
      expect(preview.isSafe).toBe(true);
    });

    it('throws for unknown recipe', async () => {
      await expect(
        previewChange(mockAdapter, 'unknown', baseContext)
      ).rejects.toThrow('Unknown recipe');
    });

    it('uses provided currentValue if available', async () => {
      const preview = await previewChange(mockAdapter, 'add-canonical', {
        ...baseContext,
        currentValue: 'provided-value',
      });

      expect(preview.currentValue).toBe('provided-value');
      expect(mockAdapter.readField).not.toHaveBeenCalled();
    });
  });
});
