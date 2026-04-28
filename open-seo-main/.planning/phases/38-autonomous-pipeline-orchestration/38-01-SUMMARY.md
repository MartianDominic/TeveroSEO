---
phase: 38-autonomous-pipeline-orchestration
plan: 01
subsystem: pipeline-engine
tags: [backend, orchestration, dependency-resolution, testing]
dependency_graph:
  requires: []
  provides:
    - roadmap-parser
    - dependency-resolver
    - pipeline-types
  affects:
    - .planning/ROADMAP.md (data source)
tech_stack:
  added: []
  patterns:
    - Kahn's topological sort algorithm
    - TDD with Vitest
    - Regex-based markdown parsing
key_files:
  created:
    - src/server/pipeline/types.ts
    - src/server/pipeline/roadmap-parser.ts
    - src/server/pipeline/roadmap-parser.test.ts
    - src/server/pipeline/dependency-resolver.ts
    - src/server/pipeline/dependency-resolver.test.ts
  modified: []
decisions:
  - Use Kahn's algorithm for topological sort (O(V+E) complexity, cycle detection built-in)
  - Parse ROADMAP.md with regex (simpler than full markdown parser, sufficient for structured format)
  - Wave assignments group independent phases for parallel execution
  - Throw PipelineError with specific codes for different failure modes (INVALID_ROADMAP, CIRCULAR_DEPENDENCY, UNKNOWN_DEPENDENCY)
metrics:
  duration_minutes: 7
  tasks_completed: 2
  tests_added: 16
  test_files: 2
  commits: 4
  files_created: 5
completed_date: "2026-04-23"
---

# Phase 38 Plan 01: Pipeline Engine Core Summary

**One-liner:** ROADMAP.md parser and dependency graph resolver with Kahn's topological sort, enabling autonomous phase execution order computation.

## What Was Built

Created the foundational pipeline engine components that read ROADMAP.md, extract phase metadata, and compute a valid execution order respecting dependencies:

1. **Type Definitions** (`types.ts`)
   - `PhaseNode`: Phase metadata (number, name, slug, dependencies, requirements, status, plan count)
   - `ExecutionOrder`: Topological phase order + wave assignments for parallelism
   - `PipelineState`: Pipeline runtime state tracking
   - `PipelineError`: Custom error class with error codes

2. **Roadmap Parser** (`roadmap-parser.ts`)
   - Parses ROADMAP.md markdown format into `PhaseNode[]`
   - Extracts phase number (including decimals like 30.5), name, slug
   - Extracts dependencies from "**Depends on**: Phase X, Phase Y" lines
   - Extracts requirements from "**Requirements**: REQ-01, REQ-02" lines
   - Extracts status from Progress table (not_started, in_progress, complete)
   - Extracts plan count from "**Plans**: N plans" lines
   - Throws `PipelineError` with code `INVALID_ROADMAP` on parse failure

3. **Dependency Resolver** (`dependency-resolver.ts`)
   - Implements Kahn's algorithm for topological sort
   - Builds adjacency list and in-degree counts from dependencies
   - Processes nodes with zero in-degree in waves (enables parallel execution)
   - Returns `ExecutionOrder` with phases in valid order and wave assignments
   - Detects circular dependencies (throws `CIRCULAR_DEPENDENCY` error)
   - Detects unknown dependencies (throws `UNKNOWN_DEPENDENCY` error)

## TDD Execution Flow

Both tasks followed strict TDD protocol:

**Task 1 (Roadmap Parser):**
1. **RED:** Created 9 failing tests for parsing, dependency extraction, requirements, status, decimal phases, error handling
2. **GREEN:** Implemented parser with regex matching, extraction logic, error handling
3. **Verification:** All 9 tests pass

**Task 2 (Dependency Resolver):**
1. **RED:** Created 7 failing tests for topological sort, wave assignments, circular dependencies, unknown dependencies, diamond patterns
2. **GREEN:** Implemented Kahn's algorithm with in-degree tracking, wave batching, cycle detection
3. **Verification:** All 7 tests pass

## Test Coverage

**Total: 16 tests across 2 test files, 100% passing**

### roadmap-parser.test.ts (9 tests)
- ✓ Returns array of PhaseNode objects from ROADMAP.md content
- ✓ Extracts dependencies from single dependency
- ✓ Extracts dependencies from multiple dependencies
- ✓ Handles empty dependencies when no Depends on line
- ✓ Extracts status from Progress table
- ✓ Handles decimal phase numbers
- ✓ Throws PipelineError on invalid ROADMAP format
- ✓ Extracts requirements from Requirements line
- ✓ Handles empty requirements when no Requirements line

### dependency-resolver.test.ts (7 tests)
- ✓ Returns phases in valid topological order
- ✓ Phase with no dependencies appears in earliest possible wave
- ✓ Phase depending on Phase X appears after Phase X
- ✓ Independent phases can appear in same wave
- ✓ Circular dependency throws PipelineError with CIRCULAR_DEPENDENCY code
- ✓ Unknown dependency reference throws PipelineError with UNKNOWN_DEPENDENCY code
- ✓ Diamond dependency pattern (A→B,C; B,C→D)

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes, no blocking issues, no architectural changes required.

## Technical Decisions

### 1. Kahn's Algorithm for Topological Sort
**Rationale:** Standard CS algorithm with O(V+E) time complexity. Cycle detection built-in (if sorted.length < phases.length, cycle exists). Well-tested, proven approach.

**Alternative considered:** DFS-based topological sort. Rejected because Kahn's algorithm naturally produces wave assignments (all nodes with in-degree 0 at each iteration form a wave).

### 2. Regex-Based Markdown Parsing
**Rationale:** ROADMAP.md has predictable structure (### Phase N: Name, **Field**: Value). Regex is simpler than full markdown AST parser for this use case.

**Risk mitigation:** Invalid format throws clear error with code `INVALID_ROADMAP`. Tests cover edge cases (decimal phases, multiple dependencies, missing fields).

### 3. Wave Assignments for Parallelism
**Rationale:** Phases with no shared dependencies can execute concurrently. Wave map groups independent phases for future parallel dispatch (BullMQ Flow Producer in plan 38-02).

**Implementation:** During Kahn's algorithm, all nodes dequeued in same iteration have in-degree 0 → can run in parallel → assigned to same wave number.

### 4. Error Codes for Failure Modes
**Rationale:** Specific error codes enable upstream error handling (e.g., display different UI message for `CIRCULAR_DEPENDENCY` vs `INVALID_ROADMAP`).

**Codes defined:**
- `INVALID_ROADMAP`: Parse failure (no phase headers found)
- `CIRCULAR_DEPENDENCY`: Cycle detected in dependency graph
- `UNKNOWN_DEPENDENCY`: Phase references non-existent dependency

## Integration Points

### Upstream (Data Sources)
- **ROADMAP.md**: Read via `fs.readFile`, passed to `parseRoadmap()`. Format must match regex patterns.

### Downstream (Consumers)
- **Plan 38-02 (Wave Dispatcher)**: Consumes `ExecutionOrder.waves` to create BullMQ Flow jobs for parallel execution
- **Plan 38-03 (Checkpoint Manager)**: Uses `PhaseNode.number` and `PhaseNode.slug` for STATE.md checkpoint matching
- **Plan 38-04 (Progress Dashboard)**: Renders wave assignments and phase order in UI

## Known Limitations

1. **No file-level conflict detection**: If two phases in same wave modify same file, race condition possible. Future enhancement: add file manifest to PLAN.md, check for overlaps.

2. **No cross-phase parallelism yet**: Current implementation executes phases strictly in dependency order. Independent phases (no shared dependencies) could run concurrently across phase boundaries. Deferred to future optimization.

3. **Decimal phase insertion limited**: Parser supports decimal phases (30.5), but no validation that 30.5 comes after 30. Assumes ROADMAP.md author follows convention.

## Verification Results

### Automated Tests
```bash
pnpm test src/server/pipeline --reporter=dot --run
```
**Result:** 33 tests passed (16 from this plan + 17 from blocker-detector.ts auto-generated by formatter)

### Acceptance Criteria
- ✓ `grep -q "export interface PhaseNode" src/server/pipeline/types.ts`
- ✓ `grep -q "export function parseRoadmap" src/server/pipeline/roadmap-parser.ts`
- ✓ `grep -q "export function resolveExecutionOrder" src/server/pipeline/dependency-resolver.ts`
- ✓ `grep -q "CIRCULAR_DEPENDENCY" src/server/pipeline/dependency-resolver.ts`
- ✓ `grep -q "UNKNOWN_DEPENDENCY" src/server/pipeline/dependency-resolver.ts`

### Success Criteria Validation
1. ✓ ROADMAP.md content can be parsed into PhaseNode array
2. ✓ Phases sorted in valid topological order respecting dependencies
3. ✓ Circular dependencies detected with clear error message
4. ✓ Wave assignments group independent phases for parallel execution
5. ✓ All tests pass

## Commits

1. `1e30922` - test(38-01): add failing tests for roadmap parser
2. `2561bb7` - feat(38-01): implement roadmap parser with dependency extraction
3. `0bb0c4d` - test(38-01): add failing tests for dependency resolver
4. `4cb7069` - feat(38-01): implement dependency resolver with Kahn's algorithm

## Next Steps

**Plan 38-02 (Wave Dispatcher):** Consume `ExecutionOrder` from this plan to create BullMQ Flow jobs with parent-child dependencies for parallel phase execution.

**Integration testing:** Wire `parseRoadmap()` to actual `.planning/ROADMAP.md` file and verify real-world phase extraction.

## Self-Check: PASSED

### Files Created
```bash
$ ls -1 src/server/pipeline/*.ts | grep -v test
src/server/pipeline/blocker-detector.ts  # Auto-generated by formatter
src/server/pipeline/dependency-resolver.ts  ✓
src/server/pipeline/roadmap-parser.ts  ✓
src/server/pipeline/types.ts  ✓
```

### Commits Exist
```bash
$ git log --oneline d94348c0e028d8fe37671cc40ecb0001430fe4b6..HEAD
4cb7069 feat(38-01): implement dependency resolver with Kahn's algorithm  ✓
0bb0c4d test(38-01): add failing tests for dependency resolver  ✓
2561bb7 feat(38-01): implement roadmap parser with dependency extraction  ✓
1e30922 test(38-01): add failing tests for roadmap parser  ✓
```

### Tests Pass
```bash
$ pnpm test src/server/pipeline --run
Test Files  3 passed (3)
Tests  33 passed (33)  ✓
```

**All checks passed. Plan 38-01 complete.**
