# Phase 85: Analysis Experience — Context

> **Created:** 2026-05-05
> **Status:** Ready for Planning
> **Total Effort:** ~4 hours
> **Dependencies:** Phase 83 (Scoring infrastructure)
> **Reference:** [PHASE-85-89-DEEP-DIVE.md](../PHASE-85-89-DEEP-DIVE.md)

---

## Executive Summary

Phase 85 implements **"Why This Keyword?"** — a transparency feature showing users exactly why each keyword was scored the way it was. This builds trust and helps users make informed decisions.

---

## Key Decisions (Locked)

### D-01: Leverage Existing CompositeScorer Breakdown

The `CompositeScorer` at `filtering/scoring.ts` already returns full breakdown:

```typescript
interface CompositeScore {
  baseScore: number;        // 0-1, weighted combination
  priorityMultiplier: number; // 1.0-2.0 from category match
  quickWinBonus: number;    // 0-0.2 from position opportunity
  finalScore: number;       // baseScore * priorityMultiplier + quickWinBonus
}
```

**Decision:** No backend changes needed — just expose existing data in UI.

### D-02: Human-Readable Explanations

Map technical terms to user-friendly Lithuanian/English explanations:

| Technical Term | User-Friendly (EN) | User-Friendly (LT) |
|----------------|--------------------|--------------------|
| relevance: 0.85 | "High semantic match to your business" | "Aukštas semantinis atitikimas jūsų verslui" |
| funnel: BOFU | "Ready-to-buy intent" | "Pirkimo ketinimas" |
| geoScore: 1.0 | "Exact city match" | "Tikslus miesto atitikimas" |
| priorityMultiplier: 1.5 | "Matches priority category" | "Atitinka prioritetinę kategoriją" |
| quickWinBonus: 0.2 | "Striking distance opportunity" | "Galimybė greitai patekti į TOP" |

**Decision:** Bilingual support (LT/EN) based on user locale.

### D-03: UI Pattern — Popover on Hover/Click

Show explanation as popover when user hovers over or clicks the score:

```
┌────────────────────────────────────────────────────┐
│ Why this score? (1.51)                             │
├────────────────────────────────────────────────────┤
│ Factor          Value    Contribution              │
│ ─────────────── ──────── ──────────────────────── │
│ Relevance       85%      +0.34  High match         │
│ Funnel Stage    BOFU     +0.27  Ready-to-buy       │
│ Geo Match       Šiauliai +0.20  Exact city         │
│ Volume          320      +0.06  Moderate traffic   │
│ ─────────────── ──────── ──────────────────────── │
│ Base Score               0.87                      │
│ Priority Boost  ×1.5     Matches "detailing"       │
│ Quick Win       +0.20    Position 15 opportunity   │
│ ─────────────── ──────── ──────────────────────── │
│ Final Score              1.51                      │
└────────────────────────────────────────────────────┘
```

---

## Implementation Scope

### Files to Create

| File | Purpose |
|------|---------|
| `ScoreExplanation.tsx` | Popover component showing score breakdown |
| `ScoreExplanationTranslations.ts` | Bilingual translation strings |

### Files to Modify

| File | Change |
|------|--------|
| `KeywordTable.tsx` or similar | Add popover trigger on score column |
| Scoring types if needed | Ensure breakdown is exported |

---

## Existing Code (Already Built)

### CompositeScorer
- Location: `open-seo-main/src/server/features/keywords/filtering/scoring.ts`
- Already returns: `{ baseScore, priorityMultiplier, quickWinBonus, finalScore }`
- Component scores available in scoring internals

### Keyword Table
- Location: `apps/web/src/components/keyword-analysis/` or `open-seo-main/src/client/`
- Displays final scores — needs popover trigger added

---

## Success Criteria

1. Score explanation popover appears on hover/click
2. All component scores displayed with human-readable descriptions
3. Bilingual support (LT/EN) working
4. No performance impact (lazy-load popover content)
5. Accessible (keyboard navigation, screen readers)

---

## Deferred Ideas

- Score comparison between keywords (nice-to-have)
- "Improve this score" suggestions (future phase)
- Score history/trend (requires tracking infrastructure)

---

*Phase: 85-analysis-experience*
*Context created: 2026-05-05*
