# 50-02 Today's Tasks Feed: Priority Algorithm, Action Buttons, Filtering

## Summary

Implemented the complete Today's Tasks feed system with multi-source task aggregation (D-09), full task management (D-10), and 5-layer priority system with urgency scoring (D-11).

## Completed Tasks

### Task 1: D-09 Task Sources Schema
- Created `/open-seo-main/src/db/tasks-schema.ts` with:
  - 6 task sources: `checklist`, `pipeline`, `follow_up`, `expiring`, `seo`, `manual`
  - 3 priority levels: `high`, `medium`, `low`
  - 4 categories: `onboarding`, `pipeline`, `renewal`, `audit`
- Created migration `/open-seo-main/drizzle/0039_tasks.sql`

### Task 2: D-10 Full Task System
- Task schema includes: `assigneeId`, `priority`, `dueAt`, `reminders` (JSONB)
- TaskService with CRUD operations in `/open-seo-main/src/server/features/tasks/services/TaskService.ts`

### Task 3: D-11 Layer 1 - Urgency Score Algorithm
- Implemented in `/open-seo-main/src/server/features/tasks/services/TaskAggregationService.ts`:
```typescript
score = (daysOverdue * 20) + (dueToday ? 50 : 0) + Math.floor(dealValueCents / 1000) + (daysStale * 3) + PRIORITY_WEIGHTS[priority]
```
- `PRIORITY_WEIGHTS = { high: 75, medium: 50, low: 25 }`
- 13 unit tests passing

### Task 4: D-11 Layer 2 - Pin/Snooze/Priority Actions
- Schema columns: `pinnedAt`, `snoozedUntil`
- TaskService methods: `pinTask()`, `unpinTask()`, `snoozeTask()`, `updatePriority()`
- Server actions in `/apps/web/src/app/(shell)/dashboard/tasks/actions.ts`

### Task 5: D-11 Layer 3 - Sort Mode Toggle
- TodaysFeed component with 4 sort modes: `smart`, `due_date`, `deal_value`, `client_name`
- Client-side sorting in `/apps/web/src/components/tasks/TodaysFeed.tsx`

### Task 6: D-11 Layer 4 - Visual Urgency Indicators
- UrgencyScoreBadge component with color coding:
  - Red (score >= 100): Overdue/critical
  - Yellow (score >= 50): Due today/high priority
  - Blue (score >= 25): Stale/medium priority
  - Gray: Low priority

### Task 7: D-11 Layer 5 - My Focus Section
- MyFocusSection component showing max 5 pinned tasks
- Integrated into TodaysFeed with pin/unpin actions

## Files Created

### Backend (open-seo-main)
| File | Purpose |
|------|---------|
| `src/db/tasks-schema.ts` | Drizzle schema for tasks table |
| `drizzle/0039_tasks.sql` | Migration file |
| `src/server/features/tasks/services/TaskService.ts` | CRUD + D-11 operations |
| `src/server/features/tasks/services/TaskAggregationService.ts` | Urgency scoring + aggregation |
| `src/server/features/tasks/services/TaskAggregationService.test.ts` | 13 unit tests |

### Frontend (apps/web)
| File | Purpose |
|------|---------|
| `src/components/tasks/types.ts` | TypeScript interfaces |
| `src/components/tasks/UrgencyScoreBadge.tsx` | D-11 Layer 4 visual indicators |
| `src/components/tasks/TaskItem.tsx` | Task card with action buttons |
| `src/components/tasks/MyFocusSection.tsx` | D-11 Layer 5 pinned tasks |
| `src/components/tasks/TodaysFeed.tsx` | D-11 Layer 3 sort toggle |
| `src/components/tasks/index.ts` | Barrel exports |
| `src/app/(shell)/dashboard/tasks/page.tsx` | Tasks page (Server Component) |
| `src/app/(shell)/dashboard/tasks/actions.ts` | Server actions |
| `src/app/(shell)/dashboard/tasks/TodaysFeedClient.tsx` | Client wrapper with optimistic updates |

### Shared UI (packages/ui)
| File | Purpose |
|------|---------|
| `src/components/dropdown-menu.tsx` | Radix UI dropdown menu |

## Files Modified

| File | Change |
|------|--------|
| `open-seo-main/src/db/schema.ts` | Added `export * from "./tasks-schema"` |
| `packages/ui/src/index.ts` | Added DropdownMenu exports |
| `packages/ui/package.json` | Added `@radix-ui/react-dropdown-menu` |

## Test Results

```
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

Tests cover:
- Urgency score calculation (overdue, due today, deal value, stale, priority weights)
- Combined urgency scoring
- Snooze filtering
- Edge cases (null dates, zero values)

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| D-09: 6 task sources defined | PASS |
| D-10: Full task schema with assignee, priority, due, reminders | PASS |
| D-11 Layer 1: Urgency formula matches spec | PASS |
| D-11 Layer 2: Pin/snooze/priority actions | PASS |
| D-11 Layer 3: Sort mode toggle (4 modes) | PASS |
| D-11 Layer 4: Color-coded urgency badges | PASS |
| D-11 Layer 5: My Focus section (max 5) | PASS |
| TypeScript compiles | PASS |
| Unit tests pass | PASS |

## Next Steps

- 50-01 (Pipeline Kanban) is in progress via parallel agent
- 51-01 (Dashboard Stats) can begin after 50-01 completes
- Integration testing with real API endpoints
