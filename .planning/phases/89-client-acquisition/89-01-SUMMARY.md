---
plan: 89-01
status: complete
completed_at: "2026-05-05T20:20:00Z"
---

# 89-01 Summary: Keyword Lock-in Schema

## Completed

Created `open-seo-main/src/db/keyword-lockin-schema.ts` with:

### Tables
- `contractedKeywords` — Keywords locked at contract signing with baseline position, search volume, difficulty
- `contractGoals` — Numeric goals with achievement tracking (delivered/target × 100)
- `changeOrders` — Contract amendments for out-of-scope work
- `outOfScopeRequests` — Requests for keywords outside original contract

### Enums
- `KEYWORD_LOCK_STATUS` — active, inactive, out_of_scope
- `GOAL_STATUS` — in_progress, achieved, missed
- `GOAL_METRIC` — keywords_in_top_10, traffic_increase, ranking_improvement
- `OUT_OF_SCOPE_STATUS` — pending, approved, rejected, change_order_created
- `CHANGE_ORDER_STATUS` — draft, sent, approved, rejected, executed

### Schema exported from `src/db/schema.ts`

## Tests

62 tests covering all enums, table columns, and type exports — all passing.

## Files Created
- `open-seo-main/src/db/keyword-lockin-schema.ts`
- `open-seo-main/src/db/keyword-lockin-schema.test.ts`
