/**
 * CascadeSelector Tests
 * Phase 80-01: BOFU-first cascade selection with configurable fallback
 *
 * Test coverage:
 * 1. Basic cascade with sufficient keywords
 * 2. Insufficient BOFU fallback
 * 3. BOFU minimum not met warning
 * 4. SERVICE_CASCADE preset behavior
 * 5. Edge case: empty input
 * 6. Edge case: single stage only
 * 7. cascadePosition sequential numbering
 * 8. exclusionReason correctness
 * 9. compositeScore ordering within pools
 */

import { describe, it, expect } from 'vitest';
import { CascadeSelector } from './CascadeSelector';
import { DEFAULT_CASCADE, SERVICE_CASCADE } from './presets';
import type { FunnelStage } from './types';

// Mock FilteredKeyword type (Phase 79 not yet implemented)
interface FilteredKeyword {
  keyword: string;
  funnelStage: FunnelStage;
  compositeScore: number;
  metrics: {
    volume: number;
    difficulty: number;
    position?: number;
  };
}

// Helper to create mock keywords
function createKeyword(
  keyword: string,
  stage: FunnelStage,
  score: number,
  volume = 1000,
  difficulty = 0.5
): FilteredKeyword {
  return {
    keyword,
    funnelStage: stage,
    compositeScore: score,
    metrics: { volume, difficulty },
  };
}

describe('CascadeSelector', () => {
  describe('Basic cascade (sufficient keywords)', () => {
    it('should select 60 BOFU (max), 40 MOFU, 0 TOFU when target=100', () => {
      // Setup: 80 BOFU, 120 MOFU, 100 TOFU - all above target
      const keywords: FilteredKeyword[] = [
        ...Array.from({ length: 80 }, (_, i) =>
          createKeyword(`bofu-${i}`, 'bofu', 0.9 - i * 0.001)
        ),
        ...Array.from({ length: 120 }, (_, i) =>
          createKeyword(`mofu-${i}`, 'mofu', 0.8 - i * 0.001)
        ),
        ...Array.from({ length: 100 }, (_, i) =>
          createKeyword(`tofu-${i}`, 'tofu', 0.7 - i * 0.001)
        ),
      ];

      const selector = new CascadeSelector();
      const result = selector.select(keywords);

      // Assertions
      expect(result.selected.length).toBe(100);
      expect(result.breakdown.total).toBe(100);

      // BOFU should hit max (60)
      expect(result.breakdown.bofu.count).toBe(60);
      expect(result.breakdown.bofu.percentage).toBeCloseTo(0.6);
      expect(result.breakdown.bofu.poolSize).toBe(80);

      // MOFU should fill to target (40)
      expect(result.breakdown.mofu.count).toBe(40);
      expect(result.breakdown.mofu.percentage).toBeCloseTo(0.4);
      expect(result.breakdown.mofu.poolSize).toBe(120);

      // TOFU should be 0 (target already met)
      expect(result.breakdown.tofu.count).toBe(0);
      expect(result.breakdown.tofu.percentage).toBe(0);
      expect(result.breakdown.tofu.poolSize).toBe(100);

      // Target met
      expect(result.breakdown.meetsTarget).toBe(true);
      expect(result.breakdown.meetsMinimums).toBe(true);
      expect(result.breakdown.warnings).toHaveLength(0);
    });
  });

  describe('Insufficient BOFU (fallback)', () => {
    it('should fallback to MOFU and TOFU when BOFU exhausted', () => {
      // Setup: Only 25 BOFU, but 100 MOFU and 75 TOFU
      const keywords: FilteredKeyword[] = [
        ...Array.from({ length: 25 }, (_, i) =>
          createKeyword(`bofu-${i}`, 'bofu', 0.9 - i * 0.01)
        ),
        ...Array.from({ length: 100 }, (_, i) =>
          createKeyword(`mofu-${i}`, 'mofu', 0.8 - i * 0.001)
        ),
        ...Array.from({ length: 75 }, (_, i) =>
          createKeyword(`tofu-${i}`, 'tofu', 0.7 - i * 0.001)
        ),
      ];

      const selector = new CascadeSelector();
      const result = selector.select(keywords);

      // BOFU: all 25 available (meets min=20)
      expect(result.breakdown.bofu.count).toBe(25);

      // MOFU: max 40
      expect(result.breakdown.mofu.count).toBe(40);

      // TOFU: max 30
      expect(result.breakdown.tofu.count).toBe(30);

      // Total: 95 (under target, but max constraints hit)
      expect(result.breakdown.total).toBe(95);
      expect(result.breakdown.meetsTarget).toBe(false);
      expect(result.breakdown.meetsMinimums).toBe(true);

      // Should warn that target not met
      expect(result.breakdown.warnings).toContain(
        'Target (100) not reached: only 95 selected within stage constraints'
      );
    });
  });

  describe('BOFU minimum not met', () => {
    it('should warn when BOFU minimum not met', () => {
      // Setup: Only 12 BOFU (under min=20)
      const keywords: FilteredKeyword[] = [
        ...Array.from({ length: 12 }, (_, i) =>
          createKeyword(`bofu-${i}`, 'bofu', 0.9 - i * 0.01)
        ),
        ...Array.from({ length: 80 }, (_, i) =>
          createKeyword(`mofu-${i}`, 'mofu', 0.8 - i * 0.001)
        ),
        ...Array.from({ length: 58 }, (_, i) =>
          createKeyword(`tofu-${i}`, 'tofu', 0.7 - i * 0.001)
        ),
      ];

      const selector = new CascadeSelector();
      const result = selector.select(keywords);

      // BOFU: all 12 (under min)
      expect(result.breakdown.bofu.count).toBe(12);

      // MOFU: max 40
      expect(result.breakdown.mofu.count).toBe(40);

      // TOFU: max 30
      expect(result.breakdown.tofu.count).toBe(30);

      // Total: 82
      expect(result.breakdown.total).toBe(82);

      // Minimums not met
      expect(result.breakdown.meetsMinimums).toBe(false);

      // Should warn about BOFU minimum
      expect(result.breakdown.warnings).toContain(
        'BOFU minimum (20) not met: only 12 available'
      );
    });
  });

  describe('SERVICE_CASCADE preset', () => {
    it('should apply BOFU-heavy configuration correctly', () => {
      // Setup: 50 BOFU, 100 MOFU, 50 TOFU
      const keywords: FilteredKeyword[] = [
        ...Array.from({ length: 50 }, (_, i) =>
          createKeyword(`bofu-${i}`, 'bofu', 0.9 - i * 0.001)
        ),
        ...Array.from({ length: 100 }, (_, i) =>
          createKeyword(`mofu-${i}`, 'mofu', 0.8 - i * 0.001)
        ),
        ...Array.from({ length: 50 }, (_, i) =>
          createKeyword(`tofu-${i}`, 'tofu', 0.7 - i * 0.001)
        ),
      ];

      const selector = new CascadeSelector();
      const result = selector.select(keywords, SERVICE_CASCADE);

      // BOFU: all 50 (meets min=40, under max=80)
      expect(result.breakdown.bofu.count).toBe(50);

      // MOFU: max 30
      expect(result.breakdown.mofu.count).toBe(30);

      // TOFU: max 15
      expect(result.breakdown.tofu.count).toBe(15);

      // Total: 95
      expect(result.breakdown.total).toBe(95);
      expect(result.breakdown.meetsTarget).toBe(false);
      expect(result.breakdown.meetsMinimums).toBe(true);
    });
  });

  describe('Edge case: empty input', () => {
    it('should return empty selection with warning', () => {
      const selector = new CascadeSelector();
      const result = selector.select([]);

      expect(result.selected).toHaveLength(0);
      expect(result.excluded).toHaveLength(0);
      expect(result.breakdown.total).toBe(0);
      expect(result.breakdown.meetsTarget).toBe(false);
      expect(result.breakdown.meetsMinimums).toBe(false);
      expect(result.breakdown.warnings).toContain(
        'No keywords provided for selection'
      );
    });
  });

  describe('Edge case: single stage only', () => {
    it('should select from single stage and warn about others', () => {
      // Only BOFU keywords
      const keywords: FilteredKeyword[] = Array.from({ length: 50 }, (_, i) =>
        createKeyword(`bofu-${i}`, 'bofu', 0.9 - i * 0.001)
      );

      const selector = new CascadeSelector();
      const result = selector.select(keywords);

      // BOFU: all 50 (meets min=20, under max=60)
      expect(result.breakdown.bofu.count).toBe(50);
      expect(result.breakdown.mofu.count).toBe(0);
      expect(result.breakdown.tofu.count).toBe(0);

      expect(result.breakdown.total).toBe(50);
      expect(result.breakdown.meetsTarget).toBe(false);
      expect(result.breakdown.meetsMinimums).toBe(false);

      // Should warn about unmet minimums for other stages
      expect(result.breakdown.warnings).toContain(
        'MOFU minimum (15) not met: only 0 available'
      );
      expect(result.breakdown.warnings).toContain(
        'TOFU minimum (5) not met: only 0 available'
      );
    });
  });

  describe('cascadePosition sequential numbering', () => {
    it('should assign 1-based sequential positions', () => {
      const keywords: FilteredKeyword[] = [
        createKeyword('bofu-1', 'bofu', 0.9, 5000),
        createKeyword('bofu-2', 'bofu', 0.85, 4000),
        createKeyword('mofu-1', 'mofu', 0.8, 3000),
        createKeyword('mofu-2', 'mofu', 0.75, 2000),
        createKeyword('tofu-1', 'tofu', 0.7, 1000),
      ];

      const selector = new CascadeSelector();
      const result = selector.select(keywords, {
        ...DEFAULT_CASCADE,
        targetCount: 5,
      });

      // Verify positions are 1-based and sequential
      expect(result.selected[0].cascadePosition).toBe(1);
      expect(result.selected[1].cascadePosition).toBe(2);
      expect(result.selected[2].cascadePosition).toBe(3);
      expect(result.selected[3].cascadePosition).toBe(4);
      expect(result.selected[4].cascadePosition).toBe(5);
    });
  });

  describe('exclusionReason correctness', () => {
    it('should set correct exclusion reasons', () => {
      // Create more keywords than target
      const keywords: FilteredKeyword[] = [
        ...Array.from({ length: 80 }, (_, i) =>
          createKeyword(`bofu-${i}`, 'bofu', 0.9 - i * 0.001)
        ),
        ...Array.from({ length: 60 }, (_, i) =>
          createKeyword(`mofu-${i}`, 'mofu', 0.8 - i * 0.001)
        ),
        ...Array.from({ length: 40 }, (_, i) =>
          createKeyword(`tofu-${i}`, 'tofu', 0.7 - i * 0.001)
        ),
      ];

      const selector = new CascadeSelector();
      const result = selector.select(keywords);

      // Should have excluded keywords
      expect(result.excluded.length).toBeGreaterThan(0);

      // Check BOFU excluded (after max=60 reached)
      const bofuExcluded = result.excluded.filter((k) => k.funnelStage === 'bofu');
      expect(bofuExcluded.length).toBe(20); // 80 - 60
      bofuExcluded.forEach((k) => {
        expect(k.exclusionReason).toBe('stage_max_reached');
      });

      // Check MOFU excluded (after max=40 reached)
      const mofuExcluded = result.excluded.filter((k) => k.funnelStage === 'mofu');
      expect(mofuExcluded.length).toBe(20); // 60 - 40
      mofuExcluded.forEach((k) => {
        expect(k.exclusionReason).toBe('target_reached');
      });

      // TOFU all excluded (target already met)
      const tofuExcluded = result.excluded.filter((k) => k.funnelStage === 'tofu');
      expect(tofuExcluded.length).toBe(40); // all TOFU
      tofuExcluded.forEach((k) => {
        expect(k.exclusionReason).toBe('cascade_overflow');
      });
    });
  });

  describe('compositeScore ordering within pools', () => {
    it('should select highest scoring keywords from each stage', () => {
      const keywords: FilteredKeyword[] = [
        createKeyword('bofu-high', 'bofu', 0.95),
        createKeyword('bofu-low', 'bofu', 0.60),
        createKeyword('bofu-medium', 'bofu', 0.80),
        createKeyword('mofu-high', 'mofu', 0.90),
        createKeyword('mofu-low', 'mofu', 0.55),
      ];

      const selector = new CascadeSelector();
      const result = selector.select(keywords, {
        ...DEFAULT_CASCADE,
        targetCount: 4,
        stages: {
          bofu: { min: 2, max: 2, priority: 1 },
          mofu: { min: 2, max: 2, priority: 2 },
          tofu: { min: 0, max: 0, priority: 3 },
        },
      });

      // Should select top 2 BOFU by score
      const bofuSelected = result.selected.filter((k) => k.funnelStage === 'bofu');
      expect(bofuSelected).toHaveLength(2);
      expect(bofuSelected[0].keyword).toBe('bofu-high');
      expect(bofuSelected[1].keyword).toBe('bofu-medium');

      // Should select top 2 MOFU by score
      const mofuSelected = result.selected.filter((k) => k.funnelStage === 'mofu');
      expect(mofuSelected).toHaveLength(2);
      expect(mofuSelected[0].keyword).toBe('mofu-high');
      expect(mofuSelected[1].keyword).toBe('mofu-low');
    });
  });
});
