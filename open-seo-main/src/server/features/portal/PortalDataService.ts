/**
 * Portal Data Service
 * Phase 86-10: Final Integration
 *
 * Aggregates portal data including clusters for "growth areas" view.
 * MINIMAL IMPLEMENTATION - production readiness deferred to Phase 90.
 */

import type { PortalDataResponse, PortalCluster, PortalKeyword } from './types';

const TIER_ORDER = { pillar: 0, subtopic: 1, longtail: 2 };

/**
 * Service for aggregating portal data.
 */
export class PortalDataService {
  constructor(private db: any) {}

  /**
   * Get portal data for a token.
   * STUB: Returns mock structure with clusters field present.
   */
  async getPortalData(token: string): Promise<PortalDataResponse> {
    // Stub implementation - validates structure only
    const clusters = this.buildPortalClusters([], new Map());
    const keywords = this.flattenKeywords(clusters);

    return {
      client: { name: 'Test Client', domain: 'test.com' },
      agency: { name: 'Test Agency', logoUrl: null },
      goal: { metric: 'top_10', target: 30, deadline: '', currentCount: 0, achievementPct: 0 },
      achievement: { current: 0, target: 30, percentage: 0, daysAhead: 0 },
      clusters,
      keywords,
      calendar: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Build portal clusters with progress metrics.
   */
  private buildPortalClusters(rawClusters: any[], positions: Map<string, number | null>): PortalCluster[] {
    const clusters: PortalCluster[] = rawClusters.map(cluster => {
      const keywords: PortalKeyword[] = (cluster.keywords || []).map((kw: any) => {
        const currentPosition = positions.get(kw.keyword) ?? kw.currentPosition ?? null;
        const status = this.getKeywordStatus(currentPosition);

        return {
          id: kw.id || crypto.randomUUID(),
          keyword: kw.keyword,
          volume: kw.volume,
          difficulty: kw.difficulty,
          funnelStage: kw.funnelStage,
          currentPosition,
          lockedPosition: kw.lockedPosition ?? null,
          positionChange: this.calculatePositionChange(kw.lockedPosition, currentPosition),
          status,
        };
      });

      const inTop10 = keywords.filter(k => k.status === 'top10').length;
      const inTop20 = keywords.filter(k => k.status === 'top20').length;

      return {
        id: cluster.id,
        tier: cluster.tier,
        label: cluster.labelLt || cluster.label,
        labelEn: cluster.labelEn || cluster.label,
        totalVolume: cluster.totalVolume,
        averageDifficulty: cluster.averageDifficulty,
        dominantFunnel: cluster.dominantFunnel,
        keywords,
        progress: {
          inTop10,
          inTop20,
          total: keywords.length,
          percentComplete: keywords.length > 0 ? Math.round((inTop10 / keywords.length) * 100) : 0,
        },
        parentId: cluster.parentId || null,
      };
    });

    // Sort by tier (pillar first) then by volume descending
    return clusters.sort((a, b) => {
      const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.totalVolume - a.totalVolume;
    });
  }

  /**
   * Get keyword status based on position.
   */
  private getKeywordStatus(position: number | null): PortalKeyword['status'] {
    if (position === null) return 'pending';
    if (position <= 10) return 'top10';
    if (position <= 20) return 'top20';
    return 'progress';
  }

  /**
   * Calculate position change.
   */
  private calculatePositionChange(locked: number | null, current: number | null): number | null {
    if (locked === null || current === null) return null;
    return locked - current; // Positive = improved
  }

  /**
   * Flatten keywords from clusters for backwards compatibility.
   */
  private flattenKeywords(clusters: PortalCluster[]): PortalKeyword[] {
    return clusters.flatMap(c => c.keywords);
  }
}

/**
 * Factory function for getting portal data.
 */
export async function getPortalData(db: any, token: string): Promise<PortalDataResponse> {
  const service = new PortalDataService(db);
  return service.getPortalData(token);
}
