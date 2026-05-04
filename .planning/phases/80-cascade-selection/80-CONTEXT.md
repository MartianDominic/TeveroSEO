# Phase 80: Cascade Selection - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** New feature - World-Class Keyword Intelligence v8.0

<domain>
## Phase Boundary

Select keywords by funnel priority with configurable fallback to reach target count. This replaces naive `slice(0, N)` with intelligent cascade that prioritizes BOFU keywords.

**The Problem:**
Current keyword selection is `topKeywords.slice(0, 10)` — takes top 10 by whatever sort order exists. This ignores:
- Funnel stage (BOFU should come first)
- Target count configuration (100, 150, 200)
- Minimum guarantees (at least 20 BOFU)
- Maximum caps (no more than 30% TOFU)

**The Solution:**
BOFU-first cascade with configurable fallback:
1. Fill from BOFU until exhausted or max reached
2. Fill from MOFU until exhausted or max reached
3. Fill from TOFU until target reached or max reached
4. Report breakdown and overflow

</domain>

<decisions>
## Implementation Decisions

### Cascade Configuration

```typescript
interface CascadeConfig {
  targetCount: number;  // 100, 150, 200, or custom
  
  // Per-stage configuration
  stages: {
    bofu: { min: number; max: number; priority: 1 };
    mofu: { min: number; max: number; priority: 2 };
    tofu: { min: number; max: number; priority: 3 };
  };
  
  // Overflow handling
  allowOverflow: boolean;  // If true, can exceed targetCount to meet mins
  strictMax: boolean;       // If true, never exceed stage max even if target not met
}

// Default configuration
const DEFAULT_CASCADE: CascadeConfig = {
  targetCount: 100,
  stages: {
    bofu: { min: 20, max: 60, priority: 1 },
    mofu: { min: 15, max: 40, priority: 2 },
    tofu: { min: 5, max: 30, priority: 3 },
  },
  allowOverflow: false,
  strictMax: true,
};

// Alternative: BOFU-heavy for service businesses
const SERVICE_CASCADE: CascadeConfig = {
  targetCount: 100,
  stages: {
    bofu: { min: 40, max: 80, priority: 1 },
    mofu: { min: 10, max: 30, priority: 2 },
    tofu: { min: 5, max: 15, priority: 3 },
  },
  allowOverflow: false,
  strictMax: true,
};
```

### Selection Algorithm

```
Input: 
  - filteredKeywords: FilterResult[] (from Phase 79)
  - config: CascadeConfig

Output:
  - selected: SelectedKeyword[]
  - excluded: ExcludedKeyword[]
  - breakdown: SelectionBreakdown

Algorithm:

1. Group keywords by funnel stage
   → bofuPool = filteredKeywords.filter(k => k.funnelStage === 'bofu')
   → mofuPool = filteredKeywords.filter(k => k.funnelStage === 'mofu')
   → tofuPool = filteredKeywords.filter(k => k.funnelStage === 'tofu')

2. Sort each pool by composite score (descending)
   → bofuPool.sort((a, b) => b.compositeScore - a.compositeScore)
   → Same for MOFU, TOFU

3. Cascade selection
   selected = []
   remaining = config.targetCount
   
   // Phase 1: BOFU (highest priority)
   bofuTake = Math.min(
     bofuPool.length,
     config.stages.bofu.max,
     remaining
   )
   bofuTake = Math.max(bofuTake, config.stages.bofu.min)  // Ensure minimum
   selected.push(...bofuPool.slice(0, bofuTake))
   remaining -= bofuTake
   
   // Phase 2: MOFU
   if (remaining > 0) {
     mofuTake = Math.min(
       mofuPool.length,
       config.stages.mofu.max,
       remaining
     )
     selected.push(...mofuPool.slice(0, mofuTake))
     remaining -= mofuTake
   }
   
   // Phase 3: TOFU
   if (remaining > 0) {
     tofuTake = Math.min(
       tofuPool.length,
       config.stages.tofu.max,
       remaining
     )
     selected.push(...tofuPool.slice(0, tofuTake))
   }

4. Compute breakdown
   breakdown = {
     total: selected.length,
     bofu: { count: bofuTake, percentage: bofuTake/selected.length },
     mofu: { count: mofuTake, percentage: mofuTake/selected.length },
     tofu: { count: tofuTake, percentage: tofuTake/selected.length },
     meetsTarget: selected.length >= config.targetCount,
     overflow: selected.length - config.targetCount,
   }
```

### Selection Result Type

```typescript
interface SelectionResult {
  selected: SelectedKeyword[];
  excluded: ExcludedKeyword[];
  breakdown: SelectionBreakdown;
  config: CascadeConfig;
  metadata: {
    totalInput: number;
    passedFilters: number;
    selectedCount: number;
    processingTimeMs: number;
  };
}

interface SelectedKeyword {
  keyword: string;
  funnelStage: 'bofu' | 'mofu' | 'tofu';
  compositeScore: number;
  cascadePosition: number;  // 1-based position in selection
  metrics: {
    volume: number;
    difficulty: number;
    position?: number;
  };
}

interface ExcludedKeyword {
  keyword: string;
  funnelStage: 'bofu' | 'mofu' | 'tofu';
  compositeScore: number;
  exclusionReason: 'cascade_overflow' | 'stage_max_reached' | 'target_reached';
  cascadePosition: number;  // Position when excluded
}

interface SelectionBreakdown {
  total: number;
  bofu: { count: number; percentage: number; poolSize: number };
  mofu: { count: number; percentage: number; poolSize: number };
  tofu: { count: number; percentage: number; poolSize: number };
  meetsTarget: boolean;
  meetsMinimums: boolean;
  warnings: string[];  // e.g., "BOFU minimum (20) not met: only 12 available"
}
```

### Proposal Integration

```typescript
// Replace slice(0, 10) in ProposalGeneratorService
async function generateKeywordProposal(
  clientId: string,
  keywords: EnrichedKeyword[],
  config?: Partial<CascadeConfig>
): Promise<KeywordProposal> {
  // 1. Run constraint filtering (Phase 79)
  const filtered = await constraintFilter.filter(keywords, constraints);
  
  // 2. Run cascade selection
  const cascadeConfig = {
    ...DEFAULT_CASCADE,
    ...config,
    ...constraints.funnelConfig,  // Override from conversation
  };
  const selection = await cascadeSelector.select(filtered, cascadeConfig);
  
  // 3. Generate proposal with breakdown
  return {
    keywords: selection.selected,
    breakdown: selection.breakdown,
    excluded: selection.excluded,
    recommendations: generateRecommendations(selection),
  };
}
```

### API Endpoint

```typescript
// POST /api/keywords/analyze
interface AnalyzeRequest {
  conversation: string;       // Client conversation text
  keywords: string[];         // Bulk keywords (or CSV upload)
  config?: {
    targetCount?: number;     // Override default 100
    cascadePreset?: 'default' | 'service' | 'ecommerce' | 'content';
  };
}

interface AnalyzeResponse {
  constraints: AnalysisConstraints;   // Extracted from conversation
  selection: SelectionResult;         // Cascade selection result
  pseoOpportunities?: PSEOCluster[];  // From Phase 81
  sideKeywords?: SideKeyword[];       // From Phase 81
}
```

</decisions>

<references>
## Reference Documents

- `.planning/keyword-intelligence/WORLD-CLASS-ARCHITECTURE.md` — Full system design
- `open-seo-main/src/server/features/proposals/services/ProposalGeneratorService.ts` — Current slice(0, N)
- `open-seo-main/src/server/features/keywords/services/KeywordSelectionService.ts` — Basic selection

</references>

<existing_code>
## Existing Infrastructure

### ProposalGeneratorService
- Generates keyword proposals for clients
- Uses `topKeywords.slice(0, 10)` 
- **Gap:** No funnel awareness, no cascade logic

### KeywordSelectionService
- Basic selection by volume/difficulty
- **Gap:** No funnel stage, no configurable cascade

</existing_code>

<success_criteria>
## Success Criteria

1. Target count reached via cascade (e.g., 100 keywords)
2. BOFU prioritized (fills first before MOFU)
3. Fallback works when insufficient BOFU (adds MOFU to reach target)
4. Minimum guarantees enforced (at least N per stage)
5. Maximum caps respected (no more than X% of any stage)
6. Breakdown accurately reflects stage distribution
7. Excluded keywords exportable with cascade position
8. Warnings generated for unmet minimums

</success_criteria>

<test_cases>
## Key Test Cases

### Basic Cascade (Sufficient Keywords)

```
Input: 300 keywords passed filters
  - 80 BOFU
  - 120 MOFU
  - 100 TOFU
  
Config: DEFAULT_CASCADE (target=100, bofu max=60, mofu max=40, tofu max=30)

Expected selection:
  - 60 BOFU (max reached)
  - 40 MOFU (fills to target)
  - 0 TOFU (target reached)
  - Total: 100 ✓

Breakdown:
  - BOFU: 60 (60%)
  - MOFU: 40 (40%)
  - TOFU: 0 (0%)
```

### Insufficient BOFU (Fallback)

```
Input: 200 keywords passed filters
  - 25 BOFU
  - 100 MOFU
  - 75 TOFU

Config: target=100, bofu min=20

Expected selection:
  - 25 BOFU (all available, meets min)
  - 40 MOFU (max)
  - 30 TOFU (max) 
  - Total: 95 (under target, but maximums hit)

Breakdown:
  - BOFU: 25 (26%)
  - MOFU: 40 (42%)
  - TOFU: 30 (32%)
  - Warning: "Target (100) not reached: only 95 available within constraints"
```

### BOFU Minimum Not Met

```
Input: 150 keywords passed filters
  - 12 BOFU
  - 80 MOFU
  - 58 TOFU

Config: target=100, bofu min=20

Expected selection:
  - 12 BOFU (all available, under min)
  - 40 MOFU (max)
  - 30 TOFU (max)
  - Total: 82

Warning: "BOFU minimum (20) not met: only 12 available"
```

### Service Business Preset

```
Config: SERVICE_CASCADE
  target=100
  bofu: min=40, max=80
  mofu: min=10, max=30
  tofu: min=5, max=15

Input: 200 keywords
  - 50 BOFU
  - 100 MOFU
  - 50 TOFU

Expected:
  - 50 BOFU (all, under max)
  - 30 MOFU (max)
  - 15 TOFU (max)
  - Total: 95

Warning: "BOFU minimum (40) met but target (100) not fully reached"
```

</test_cases>
