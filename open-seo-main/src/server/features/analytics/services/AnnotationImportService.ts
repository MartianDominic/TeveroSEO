/**
 * AnnotationImportService
 * Phase 96-03: Google Algorithm Update Auto-Import
 *
 * Fetches algorithm updates from DemandSphere's free JSON API.
 * API: https://www.demandsphere.com/api/algorithm-updates
 * Coverage: 170+ updates from 2001-2026
 *
 * Runs daily via BullMQ job at 4 AM UTC.
 */
import { createLogger } from '@/server/lib/logger';
import { AnnotationsRepository } from '../repositories/AnnotationsRepository';
import type { GoogleAlgorithmUpdate, AnnotationType } from '../types';

const log = createLogger({ module: 'annotation-import-service' });

// DemandSphere API endpoint (free, no auth required)
const DEMANDSPHERE_API_URL = 'https://www.demandsphere.com/api/algorithm-updates';

// Map DemandSphere types to our AnnotationType
const TYPE_MAP: Record<string, AnnotationType> = {
  'core': 'core_update',
  'core update': 'core_update',
  'spam': 'spam_update',
  'spam update': 'spam_update',
  'helpful content': 'helpful_content',
  'helpful content update': 'helpful_content',
  'product reviews': 'product_reviews',
  'product review': 'product_reviews',
  'link spam': 'link_spam',
  'link spam update': 'link_spam',
};

export class AnnotationImportService {
  constructor(private annotationsRepo: AnnotationsRepository) {}

  /**
   * Import Google algorithm updates from DemandSphere API.
   * Only imports updates from 2020 onwards (recent relevance).
   */
  async importGoogleUpdates(workspaceId: string): Promise<{ imported: number; skipped: number }> {
    let updates: GoogleAlgorithmUpdate[];

    try {
      const response = await fetch(DEMANDSPHERE_API_URL, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (!response.ok) {
        throw new Error(`DemandSphere API returned ${response.status}`);
      }

      updates = await response.json() as GoogleAlgorithmUpdate[];
    } catch (error) {
      log.error('Failed to fetch DemandSphere API', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }

    let imported = 0;
    let skipped = 0;

    // Filter to 2020+ updates
    const cutoffDate = new Date('2020-01-01');

    for (const update of updates) {
      const updateDate = new Date(update.date);

      if (updateDate < cutoffDate) {
        skipped++;
        continue;
      }

      const annotationType = TYPE_MAP[update.type?.toLowerCase()] ?? 'core_update';

      try {
        await this.annotationsRepo.upsertGoogleUpdate(workspaceId, {
          date: updateDate,
          name: update.name,
          description: update.description,
          type: annotationType,
          sourceUrl: update.source_url,
        });
        imported++;
      } catch (error) {
        log.warn('Failed to upsert annotation', { update: update.name, error });
        skipped++;
      }
    }

    log.info('Google updates import complete', { imported, skipped, workspaceId });
    return { imported, skipped };
  }
}

// Convenience function
export async function importGoogleUpdates(
  workspaceId: string
): Promise<{ imported: number; skipped: number }> {
  const { db } = await import('@/db');
  const repo = new AnnotationsRepository(db);
  const service = new AnnotationImportService(repo);
  return service.importGoogleUpdates(workspaceId);
}
