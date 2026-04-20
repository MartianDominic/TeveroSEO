---
phase: 25
plan: 01
subsystem: team-management
tags: [team, workload, capacity, dashboard, drag-drop]
dependency_graph:
  requires: []
  provides: [team-types, team-metrics-action, team-metrics-hook, team-dashboard, workload-balancer]
  affects: [dashboard]
tech_stack:
  added: []
  patterns: [react-query-hooks, server-actions, dnd-kit]
key_files:
  created:
    - src/types/team.ts
    - src/actions/team/get-team-metrics.ts
    - src/hooks/useTeamMetrics.ts
    - src/components/team/TeamDashboard.tsx
    - src/components/team/WorkloadBalancer.tsx
    - src/components/team/index.ts
  modified: []
decisions:
  - Used custom div-based progress bars since @tevero/ui lacks Progress component
  - Implemented generateReassignmentSuggestions algorithm that prioritizes moving newest clients from overloaded members
  - Used @dnd-kit for drag-and-drop following existing ColumnCustomizer pattern
metrics:
  duration_seconds: 279
  completed_at: "2026-04-20T12:52:44Z"
---

# Phase 25 Plan 01: Team Dashboard + Workload Balancing Summary

Team management foundation with capacity visualization and workload balancing tools.

## One-liner

Team dashboard with capacity bars, overload warnings, and drag-and-drop workload balancer using @dnd-kit.

## What Was Built

### Task 1: Team Types (`e2d944fb`)
Created comprehensive type definitions at `src/types/team.ts`:
- `TeamMember` interface with id, name, email, avatar, role, capacity, clientCount
- `ClientAssignment` for tracking member-client relationships
- `TeamMetrics` for aggregated capacity metrics (totalCapacity, utilizedCapacity, overloadedMembers)
- `TeamMemberWithAssignments` extending TeamMember with full assignment details
- `ReassignmentSuggestion` for workload balancing recommendations

### Task 2: Server Action (`0fb1a98c`)
Created `src/actions/team/get-team-metrics.ts`:
- `getTeamMetrics()` fetches team members with assignments from backend
- Calculates workload percentages and overload status
- 60-second Redis caching with workspace tag invalidation
- `reassignClient()` action for moving clients between team members
- Graceful error handling with empty result fallback

### Task 3: React Query Hook (`5cbc8c59`)
Created `src/hooks/useTeamMetrics.ts`:
- `useTeamMetrics()` hook with 30-second stale time
- `useReassignClient()` mutation with cache invalidation
- Query key factory for cache management
- Follows existing usePaginatedClients/useGoals pattern

### Task 4: Team Dashboard Component (`3fb280fa`)
Created `src/components/team/TeamDashboard.tsx`:
- Member cards with capacity bars (green <80%, yellow 80-99%, red >=100%)
- Status badges: Available, Near Capacity, Overloaded
- Team summary stats (members, capacity, utilization, overloaded count)
- Avatar component with initial fallback
- Click handler for member selection
- Empty state for solo operators

### Task 5: Workload Balancer Component (`49c2cfb1`)
Created `src/components/team/WorkloadBalancer.tsx`:
- `generateReassignmentSuggestions()` algorithm:
  - Identifies overloaded members (>=100% capacity)
  - Finds available members (<80% capacity)
  - Prioritizes moving newest clients (least established relationships)
  - Calculates impact score for each suggestion
- Drag-and-drop client reassignment using @dnd-kit
- Suggestion cards with one-click apply
- Member columns with visual capacity indicators
- DragOverlay for smooth drag experience

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused Progress import**
- **Found during:** Verification (typecheck)
- **Issue:** TeamDashboard imported Progress from @tevero/ui but the package doesn't export it
- **Fix:** Removed Progress import since custom div-based progress bars are used
- **Files modified:** src/components/team/TeamDashboard.tsx
- **Commit:** Included in later parallel commit (bd36b8b8)

## Verification

- TypeScript compilation: PASSED (team components have no type errors)
- Pre-existing error in OpportunitiesPanel.tsx is out of scope

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e2d944fb | Team types for workload management |
| 2 | 0fb1a98c | get-team-metrics server action |
| 3 | 5cbc8c59 | useTeamMetrics React Query hook |
| 4 | 3fb280fa | TeamDashboard component |
| 5 | 49c2cfb1 | WorkloadBalancer component |

## Success Criteria Met

- [x] Team members displayed with capacity bars
- [x] Overloaded members highlighted (red when >=100%)
- [x] Reassignment suggestions generated
- [x] Drag-and-drop client reassignment implemented

## Self-Check: PASSED

All commits verified present in repository:
- e2d944fb: FOUND
- 0fb1a98c: FOUND
- 5cbc8c59: FOUND
- 3fb280fa: FOUND
- 49c2cfb1: FOUND

All created files verified on disk:
- src/types/team.ts: FOUND
- src/actions/team/get-team-metrics.ts: FOUND
- src/hooks/useTeamMetrics.ts: FOUND
- src/components/team/TeamDashboard.tsx: FOUND
- src/components/team/WorkloadBalancer.tsx: FOUND
- src/components/team/index.ts: FOUND
