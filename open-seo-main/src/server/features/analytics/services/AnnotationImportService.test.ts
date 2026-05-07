/**
 * AnnotationImportService Tests
 * Phase 96-03: Google Algorithm Update Auto-Import
 *
 * RED Phase: Write tests first - they should FAIL
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock AnnotationsRepository
const mockAnnotationsRepo = {
  upsertGoogleUpdate: vi.fn(),
};

// Mock logger
vi.mock('@/server/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Now import after mocking
const { AnnotationImportService } = await import('./AnnotationImportService');

describe('AnnotationImportService', () => {
  let service: AnnotationImportService;
  const mockWorkspaceId = 'workspace-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AnnotationImportService(mockAnnotationsRepo as any);
  });

  describe('importGoogleUpdates', () => {
    it('should fetch updates from DemandSphere API', async () => {
      const mockUpdates = [
        {
          date: '2024-03-15',
          name: 'March 2024 Core Update',
          description: 'A significant core algorithm update',
          type: 'core',
          confirmed: true,
          source_url: 'https://example.com/update',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUpdates),
      });

      mockAnnotationsRepo.upsertGoogleUpdate.mockResolvedValue(undefined);

      const result = await service.importGoogleUpdates(mockWorkspaceId);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.demandsphere.com/api/algorithm-updates',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      );
      expect(result.imported).toBe(1);
    });

    it('should filter updates to 2020+ only', async () => {
      const mockUpdates = [
        {
          date: '2019-12-31',
          name: 'Old Update',
          type: 'core',
          confirmed: true,
        },
        {
          date: '2024-03-15',
          name: 'Recent Update',
          type: 'core',
          confirmed: true,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUpdates),
      });

      mockAnnotationsRepo.upsertGoogleUpdate.mockResolvedValue(undefined);

      const result = await service.importGoogleUpdates(mockWorkspaceId);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should map DemandSphere types to AnnotationType', async () => {
      const mockUpdates = [
        {
          date: '2024-03-15',
          name: 'Core Update',
          type: 'core update',
          confirmed: true,
        },
        {
          date: '2024-04-10',
          name: 'Spam Update',
          type: 'spam',
          confirmed: true,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUpdates),
      });

      mockAnnotationsRepo.upsertGoogleUpdate.mockResolvedValue(undefined);

      await service.importGoogleUpdates(mockWorkspaceId);

      expect(mockAnnotationsRepo.upsertGoogleUpdate).toHaveBeenCalledWith(
        mockWorkspaceId,
        expect.objectContaining({ type: 'core_update' })
      );
      expect(mockAnnotationsRepo.upsertGoogleUpdate).toHaveBeenCalledWith(
        mockWorkspaceId,
        expect.objectContaining({ type: 'spam_update' })
      );
    });

    it('should handle API fetch errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(service.importGoogleUpdates(mockWorkspaceId)).rejects.toThrow();
    });

    it('should handle non-200 API responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(service.importGoogleUpdates(mockWorkspaceId)).rejects.toThrow(
        'DemandSphere API returned 500'
      );
    });

    it('should continue on individual upsert errors', async () => {
      const mockUpdates = [
        {
          date: '2024-03-15',
          name: 'Update 1',
          type: 'core',
          confirmed: true,
        },
        {
          date: '2024-04-10',
          name: 'Update 2',
          type: 'spam',
          confirmed: true,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUpdates),
      });

      // First upsert fails, second succeeds
      mockAnnotationsRepo.upsertGoogleUpdate
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined);

      const result = await service.importGoogleUpdates(mockWorkspaceId);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });
});
