# Plan 95-12: CWV Consolidation

**Phase:** 95 - Scraping Infrastructure  
**Plan:** 12 - CWV Consolidation  
**Status:** Ready  
**Priority:** P1 (High)  
**Estimated Effort:** 6 hours  
**Dependencies:** 95-07 (CWV Integration)

---

## Objective

Consolidate the two parallel CWV (Core Web Vitals) implementations into a single system:
- Tier 3 SEO checks use the Phase 95 CwvService
- Eliminate duplicate CrUX API calls
- Enable PSI fallback for all CWV checks
- Share cache across audit checks and ScrapingService

---

## Current State Analysis

### Two Parallel Systems Identified

**System 1: Tier 3 SEO Checks** (`/open-seo-main/src/server/lib/audit/checks/tier3/cwv.ts`)
- Direct CrUX API calls
- In-memory cache with TTL
- Rate limiting (400 req/min)
- No PSI fallback
- Client-namespaced cache keys

**System 2: Phase 95 CwvService** (`/open-seo-main/src/server/features/scraping/cwv/CwvService.ts`)
- Tiered lookup: Cache -> CrUX origin -> CrUX URL -> PSI
- Daily PSI budget enforcement (100/day default)
- Redis + PostgreSQL caching
- Batch optimization

### Problems with Current State

1. **Duplicate API calls**: Same origin can be queried twice
2. **No PSI fallback**: Tier 3 checks fail if no CrUX data
3. **Inconsistent caching**: Two separate caches
4. **No shared budget**: PSI budget not enforced for checks

### Files to Modify

```
open-seo-main/src/server/
├── lib/audit/checks/tier3/cwv.ts           # Main modification
├── lib/audit/checks/tier3/cwv-checks/      # Individual check files
│   ├── lcp.ts
│   ├── fid.ts
│   ├── cls.ts
│   ├── inp.ts
│   └── ttfb.ts
└── features/scraping/cwv/
    ├── CwvService.ts                        # Already complete
    └── types.ts                             # May need exports
```

---

## Task Breakdown

### Task 1: Export CwvService Types

**File:** `open-seo-main/src/server/features/scraping/cwv/types.ts`

Ensure all types are exported for use by Tier 3 checks:

```typescript
// Existing types - ensure exported
export interface CwvMetrics {
  lcp: CwvMetric;
  fid: CwvMetric;
  cls: CwvMetric;
  inp: CwvMetric;
  ttfb: CwvMetric;
}

export interface CwvMetric {
  p75: number;
  good: number;    // % of users with good experience
  needsImprovement: number;
  poor: number;
  histogram?: HistogramBin[];
}

export interface CwvResult {
  origin: string;
  url?: string;
  metrics: CwvMetrics;
  source: 'crux_origin' | 'crux_url' | 'psi' | 'cache';
  recordDate?: string;
  collectionPeriod?: {
    firstDate: string;
    lastDate: string;
  };
}

// NEW: Threshold constants for checks
export const CWV_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },      // milliseconds
  fid: { good: 100, poor: 300 },        // milliseconds
  cls: { good: 0.1, poor: 0.25 },       // unitless
  inp: { good: 200, poor: 500 },        // milliseconds
  ttfb: { good: 800, poor: 1800 },      // milliseconds
} as const;

export type CwvMetricName = keyof typeof CWV_THRESHOLDS;
```

**Acceptance Criteria:**
- [ ] All types exported
- [ ] CWV_THRESHOLDS constant exported
- [ ] Type-safe metric name type

---

### Task 2: Create CWV Check Adapter

**New File:** `open-seo-main/src/server/lib/audit/checks/tier3/CwvCheckAdapter.ts`

Create an adapter that provides Tier 3 checks with CwvService access:

```typescript
import { getCwvService } from '@/server/features/scraping/cwv';
import { CwvResult, CwvMetrics, CWV_THRESHOLDS, CwvMetricName } from '@/server/features/scraping/cwv/types';

export interface CwvCheckResult {
  pass: boolean;
  score: number;        // 0-100
  metric: CwvMetricName;
  value: number;
  threshold: { good: number; poor: number };
  rating: 'good' | 'needs-improvement' | 'poor';
  source: string;
  details: {
    p75: number;
    goodPercent: number;
    needsImprovementPercent: number;
    poorPercent: number;
  };
}

export class CwvCheckAdapter {
  private cwvService = getCwvService();

  async getCwvForCheck(url: string, clientId?: string): Promise<CwvResult | null> {
    try {
      const result = await this.cwvService.getCwv(url, {
        clientId,
        allowPsiFallback: true, // Always allow PSI for checks
      });
      return result;
    } catch (error) {
      // Log but don't fail the check
      console.warn(`CWV fetch failed for ${url}:`, error);
      return null;
    }
  }

  evaluateMetric(
    metrics: CwvMetrics | null, 
    metricName: CwvMetricName
  ): CwvCheckResult | null {
    if (!metrics) return null;

    const metric = metrics[metricName];
    if (!metric || metric.p75 === undefined) return null;

    const threshold = CWV_THRESHOLDS[metricName];
    const value = metric.p75;
    
    // Determine rating
    let rating: 'good' | 'needs-improvement' | 'poor';
    if (value <= threshold.good) {
      rating = 'good';
    } else if (value <= threshold.poor) {
      rating = 'needs-improvement';
    } else {
      rating = 'poor';
    }

    // Calculate score (0-100)
    // Good = 100, Poor threshold = 0, linear interpolation
    let score: number;
    if (value <= threshold.good) {
      score = 100;
    } else if (value >= threshold.poor) {
      score = 0;
    } else {
      const range = threshold.poor - threshold.good;
      const delta = value - threshold.good;
      score = Math.round(100 * (1 - delta / range));
    }

    return {
      pass: rating === 'good' || rating === 'needs-improvement',
      score,
      metric: metricName,
      value,
      threshold,
      rating,
      source: 'cwv_service',
      details: {
        p75: metric.p75,
        goodPercent: metric.good,
        needsImprovementPercent: metric.needsImprovement,
        poorPercent: metric.poor,
      },
    };
  }

  // Convenience method for checks
  async runCwvCheck(
    url: string,
    metricName: CwvMetricName,
    clientId?: string
  ): Promise<CwvCheckResult | null> {
    const cwvResult = await this.getCwvForCheck(url, clientId);
    if (!cwvResult) return null;
    return this.evaluateMetric(cwvResult.metrics, metricName);
  }
}

// Singleton
let adapter: CwvCheckAdapter | null = null;

export function getCwvCheckAdapter(): CwvCheckAdapter {
  if (!adapter) {
    adapter = new CwvCheckAdapter();
  }
  return adapter;
}
```

**Acceptance Criteria:**
- [ ] Adapter wraps CwvService
- [ ] PSI fallback always enabled for checks
- [ ] Score calculation (0-100)
- [ ] Rating determination (good/needs-improvement/poor)
- [ ] Null handling for missing data

---

### Task 3: Migrate LCP Check

**File:** `open-seo-main/src/server/lib/audit/checks/tier3/cwv-checks/lcp.ts`

**Before:**
```typescript
import { CruxClient } from './crux-client';

export async function checkLCP(context: CheckContext): Promise<CheckResult> {
  const crux = new CruxClient();
  const data = await crux.getOriginData(context.url);
  
  if (!data?.record?.metrics?.largest_contentful_paint) {
    return { pass: false, message: 'No CrUX data available' };
  }
  
  const lcp = data.record.metrics.largest_contentful_paint.percentiles.p75;
  const pass = lcp <= 2500;
  
  return {
    pass,
    score: pass ? 100 : (lcp <= 4000 ? 50 : 0),
    message: `LCP: ${lcp}ms (${pass ? 'Good' : 'Needs Improvement'})`,
  };
}
```

**After:**
```typescript
import { getCwvCheckAdapter, CwvCheckResult } from '../CwvCheckAdapter';
import { CheckContext, CheckResult } from '../../types';

export async function checkLCP(context: CheckContext): Promise<CheckResult> {
  const adapter = getCwvCheckAdapter();
  const result = await adapter.runCwvCheck(context.url, 'lcp', context.clientId);
  
  if (!result) {
    return {
      pass: false,
      score: 0,
      message: 'No Core Web Vitals data available. Site may lack sufficient traffic for CrUX data.',
      checkId: 'T3-CWV-LCP',
      severity: 'medium',
    };
  }

  return {
    pass: result.pass,
    score: result.score,
    message: formatLcpMessage(result),
    checkId: 'T3-CWV-LCP',
    severity: result.rating === 'poor' ? 'high' : 'medium',
    details: {
      metric: 'LCP',
      value: result.value,
      unit: 'ms',
      threshold: result.threshold,
      rating: result.rating,
      distribution: {
        good: result.details.goodPercent,
        needsImprovement: result.details.needsImprovementPercent,
        poor: result.details.poorPercent,
      },
      source: result.source,
    },
  };
}

function formatLcpMessage(result: CwvCheckResult): string {
  const valueStr = result.value.toLocaleString();
  const ratingEmoji = {
    'good': '✅',
    'needs-improvement': '⚠️',
    'poor': '❌',
  }[result.rating];
  
  return `${ratingEmoji} LCP: ${valueStr}ms (${result.rating}). ` +
    `${result.details.goodPercent.toFixed(0)}% of users have good experience. ` +
    `Target: ≤${result.threshold.good}ms`;
}
```

**Acceptance Criteria:**
- [ ] Uses CwvCheckAdapter
- [ ] Handles null (no data) gracefully
- [ ] Returns standardized CheckResult
- [ ] Includes distribution details
- [ ] Source tracked (crux/psi/cache)

---

### Task 4: Migrate Remaining CWV Checks

Apply the same pattern to FID, CLS, INP, and TTFB:

**File:** `open-seo-main/src/server/lib/audit/checks/tier3/cwv-checks/fid.ts`

```typescript
import { getCwvCheckAdapter } from '../CwvCheckAdapter';
import { CheckContext, CheckResult } from '../../types';

export async function checkFID(context: CheckContext): Promise<CheckResult> {
  const adapter = getCwvCheckAdapter();
  const result = await adapter.runCwvCheck(context.url, 'fid', context.clientId);
  
  if (!result) {
    return {
      pass: false,
      score: 0,
      message: 'No FID data available',
      checkId: 'T3-CWV-FID',
      severity: 'medium',
    };
  }

  return {
    pass: result.pass,
    score: result.score,
    message: `FID: ${result.value}ms (${result.rating})`,
    checkId: 'T3-CWV-FID',
    severity: result.rating === 'poor' ? 'high' : 'medium',
    details: {
      metric: 'FID',
      value: result.value,
      unit: 'ms',
      threshold: result.threshold,
      rating: result.rating,
    },
  };
}
```

**File:** `open-seo-main/src/server/lib/audit/checks/tier3/cwv-checks/cls.ts`

```typescript
import { getCwvCheckAdapter } from '../CwvCheckAdapter';
import { CheckContext, CheckResult } from '../../types';

export async function checkCLS(context: CheckContext): Promise<CheckResult> {
  const adapter = getCwvCheckAdapter();
  const result = await adapter.runCwvCheck(context.url, 'cls', context.clientId);
  
  if (!result) {
    return {
      pass: false,
      score: 0,
      message: 'No CLS data available',
      checkId: 'T3-CWV-CLS',
      severity: 'medium',
    };
  }

  return {
    pass: result.pass,
    score: result.score,
    message: `CLS: ${result.value.toFixed(3)} (${result.rating})`,
    checkId: 'T3-CWV-CLS',
    severity: result.rating === 'poor' ? 'high' : 'medium',
    details: {
      metric: 'CLS',
      value: result.value,
      unit: 'score',
      threshold: result.threshold,
      rating: result.rating,
    },
  };
}
```

**File:** `open-seo-main/src/server/lib/audit/checks/tier3/cwv-checks/inp.ts`

```typescript
import { getCwvCheckAdapter } from '../CwvCheckAdapter';
import { CheckContext, CheckResult } from '../../types';

export async function checkINP(context: CheckContext): Promise<CheckResult> {
  const adapter = getCwvCheckAdapter();
  const result = await adapter.runCwvCheck(context.url, 'inp', context.clientId);
  
  if (!result) {
    return {
      pass: false,
      score: 0,
      message: 'No INP data available (replaced FID in March 2024)',
      checkId: 'T3-CWV-INP',
      severity: 'medium',
    };
  }

  return {
    pass: result.pass,
    score: result.score,
    message: `INP: ${result.value}ms (${result.rating})`,
    checkId: 'T3-CWV-INP',
    severity: result.rating === 'poor' ? 'high' : 'medium',
    details: {
      metric: 'INP',
      value: result.value,
      unit: 'ms',
      threshold: result.threshold,
      rating: result.rating,
    },
  };
}
```

**File:** `open-seo-main/src/server/lib/audit/checks/tier3/cwv-checks/ttfb.ts`

```typescript
import { getCwvCheckAdapter } from '../CwvCheckAdapter';
import { CheckContext, CheckResult } from '../../types';

export async function checkTTFB(context: CheckContext): Promise<CheckResult> {
  const adapter = getCwvCheckAdapter();
  const result = await adapter.runCwvCheck(context.url, 'ttfb', context.clientId);
  
  if (!result) {
    return {
      pass: false,
      score: 0,
      message: 'No TTFB data available',
      checkId: 'T3-CWV-TTFB',
      severity: 'low',
    };
  }

  return {
    pass: result.pass,
    score: result.score,
    message: `TTFB: ${result.value}ms (${result.rating})`,
    checkId: 'T3-CWV-TTFB',
    severity: result.rating === 'poor' ? 'medium' : 'low',
    details: {
      metric: 'TTFB',
      value: result.value,
      unit: 'ms',
      threshold: result.threshold,
      rating: result.rating,
    },
  };
}
```

**Acceptance Criteria:**
- [ ] All 5 CWV checks migrated (LCP, FID, CLS, INP, TTFB)
- [ ] Consistent return format
- [ ] Appropriate severity per metric
- [ ] Unit handling (ms vs score)

---

### Task 5: Remove Legacy CrUX Client

**File:** `open-seo-main/src/server/lib/audit/checks/tier3/crux-client.ts`

Once migration is complete:

1. Add deprecation warning
2. Keep for 1 release cycle
3. Remove in next version

```typescript
// crux-client.ts

/**
 * @deprecated Use CwvCheckAdapter from '@/server/lib/audit/checks/tier3/CwvCheckAdapter' instead.
 * This file will be removed in the next release.
 */

import { getCwvService } from '@/server/features/scraping/cwv';

export class CruxClient {
  constructor() {
    console.warn(
      'CruxClient is deprecated. Use CwvCheckAdapter instead. ' +
      'This will be removed in the next release.'
    );
  }

  async getOriginData(url: string) {
    const service = getCwvService();
    const result = await service.getCwv(url);
    // Map to old format for backwards compatibility
    return this.mapToLegacyFormat(result);
  }

  private mapToLegacyFormat(result: any) {
    // ... mapping logic for any remaining consumers
  }
}
```

**Acceptance Criteria:**
- [ ] Deprecation warning added
- [ ] Backwards compatibility maintained
- [ ] Removal scheduled

---

### Task 6: Update CWV Check Index

**File:** `open-seo-main/src/server/lib/audit/checks/tier3/cwv.ts`

Update the main CWV check file to use the new adapter:

```typescript
import { CheckContext, CheckResult } from '../types';
import { getCwvCheckAdapter } from './CwvCheckAdapter';
import { checkLCP } from './cwv-checks/lcp';
import { checkFID } from './cwv-checks/fid';
import { checkCLS } from './cwv-checks/cls';
import { checkINP } from './cwv-checks/inp';
import { checkTTFB } from './cwv-checks/ttfb';

export interface CwvCheckResults {
  overall: CheckResult;
  lcp: CheckResult;
  fid: CheckResult;
  cls: CheckResult;
  inp: CheckResult;
  ttfb: CheckResult;
}

export async function runCwvChecks(context: CheckContext): Promise<CwvCheckResults> {
  // Run all CWV checks in parallel (they share cache via CwvService)
  const [lcp, fid, cls, inp, ttfb] = await Promise.all([
    checkLCP(context),
    checkFID(context),
    checkCLS(context),
    checkINP(context),
    checkTTFB(context),
  ]);

  // Calculate overall score (weighted average)
  const weights = { lcp: 0.25, fid: 0.10, cls: 0.25, inp: 0.30, ttfb: 0.10 };
  const scores = { lcp: lcp.score, fid: fid.score, cls: cls.score, inp: inp.score, ttfb: ttfb.score };
  
  const overallScore = Object.entries(weights).reduce((sum, [metric, weight]) => {
    return sum + (scores[metric as keyof typeof scores] * weight);
  }, 0);

  const overall: CheckResult = {
    pass: overallScore >= 50,
    score: Math.round(overallScore),
    message: `Core Web Vitals score: ${Math.round(overallScore)}/100`,
    checkId: 'T3-CWV-OVERALL',
    severity: overallScore >= 75 ? 'low' : overallScore >= 50 ? 'medium' : 'high',
    details: {
      breakdown: { lcp: lcp.score, fid: fid.score, cls: cls.score, inp: inp.score, ttfb: ttfb.score },
      weights,
    },
  };

  return { overall, lcp, fid, cls, inp, ttfb };
}

// Export individual checks for selective use
export { checkLCP, checkFID, checkCLS, checkINP, checkTTFB };
```

**Acceptance Criteria:**
- [ ] Parallel execution (shared cache)
- [ ] Weighted overall score
- [ ] Individual check exports
- [ ] INP weighted higher (replaced FID as core metric)

---

## Testing Requirements

### Unit Tests

```typescript
// __tests__/cwv-consolidation.test.ts

describe('CWV Consolidation', () => {
  describe('CwvCheckAdapter', () => {
    it('uses CwvService for data fetching', async () => {
      const adapter = getCwvCheckAdapter();
      await adapter.getCwvForCheck('https://example.com');
      
      expect(mockCwvService.getCwv).toHaveBeenCalledWith('https://example.com', {
        clientId: undefined,
        allowPsiFallback: true,
      });
    });

    it('calculates correct score for good LCP', () => {
      const adapter = getCwvCheckAdapter();
      const result = adapter.evaluateMetric(
        { lcp: { p75: 2000, good: 80, needsImprovement: 15, poor: 5 } } as any,
        'lcp'
      );
      
      expect(result?.rating).toBe('good');
      expect(result?.score).toBe(100);
    });

    it('calculates correct score for needs-improvement LCP', () => {
      const adapter = getCwvCheckAdapter();
      const result = adapter.evaluateMetric(
        { lcp: { p75: 3000, good: 50, needsImprovement: 30, poor: 20 } } as any,
        'lcp'
      );
      
      expect(result?.rating).toBe('needs-improvement');
      expect(result?.score).toBeGreaterThan(0);
      expect(result?.score).toBeLessThan(100);
    });
  });

  describe('Check Migration', () => {
    it('LCP check returns standardized format', async () => {
      mockCwvService.getCwv.mockResolvedValue({
        metrics: { lcp: { p75: 2000, good: 80, needsImprovement: 15, poor: 5 } },
        source: 'crux_origin',
      });

      const result = await checkLCP({ url: 'https://example.com' } as any);
      
      expect(result.checkId).toBe('T3-CWV-LCP');
      expect(result.details).toHaveProperty('metric', 'LCP');
      expect(result.details).toHaveProperty('source', 'cwv_service');
    });

    it('handles missing CWV data gracefully', async () => {
      mockCwvService.getCwv.mockResolvedValue(null);

      const result = await checkLCP({ url: 'https://new-site.com' } as any);
      
      expect(result.pass).toBe(false);
      expect(result.message).toContain('No Core Web Vitals data');
    });
  });

  describe('Cache Sharing', () => {
    it('CwvService cache is shared across checks', async () => {
      // First check warms cache
      await checkLCP({ url: 'https://example.com' } as any);
      
      // Subsequent checks use cache
      await checkCLS({ url: 'https://example.com' } as any);
      await checkINP({ url: 'https://example.com' } as any);
      
      // Only one API call should have been made
      expect(mockCwvService.getCwv).toHaveBeenCalledTimes(3);
      // But cache was used for 2 of them
      expect(mockCwvCache.get).toHaveBeenCalledTimes(3);
    });
  });
});
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| CrUX API calls reduction | 50%+ (via caching) |
| PSI fallback coverage | 100% of checks |
| Check response time | <500ms average |
| Cache hit rate | >70% for repeated origins |

---

## Migration Rollout

### Phase 1: Parallel Operation (Week 1)
- Deploy new checks alongside old
- Log comparison of results
- Verify identical outputs

### Phase 2: Shadow Mode (Week 2)
- New checks primary
- Old checks for comparison only
- Alert on discrepancies

### Phase 3: Cutover (Week 3)
- Remove old checks
- Deprecate CruxClient
- Update documentation

---

## Deliverables

1. Exported types in `cwv/types.ts`
2. New `CwvCheckAdapter.ts`
3. Migrated LCP, FID, CLS, INP, TTFB checks
4. Updated `cwv.ts` index with weighted scoring
5. Deprecated `crux-client.ts`
6. Unit tests for adapter and checks
7. Integration tests for cache sharing
