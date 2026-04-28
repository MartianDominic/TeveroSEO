---
phase: 38-autonomous-pipeline-orchestration
plan: 03
subsystem: pipeline
tags: [checkpoint, recovery, blocker-detection, crash-resilience]
dependency_graph:
  requires: [38-01-types]
  provides: [checkpoint-manager, blocker-detector]
  affects: [plan-worker, pipeline-orchestrator]
tech_stack:
  added: [yaml@2.8.3]
  patterns: [yaml-frontmatter-manipulation, blocker-heuristics]
key_files:
  created:
    - src/server/pipeline/checkpoint-manager.ts
    - src/server/pipeline/checkpoint-manager.test.ts
    - src/server/pipeline/blocker-detector.ts
    - src/server/pipeline/blocker-detector.test.ts
    - src/server/pipeline/types.ts
  modified:
    - package.json
decisions:
  - Use phase slug instead of number for checkpoint resilience
  - Store pipeline_state in STATE.md frontmatter (not separate file)
  - Blocker detection based on string patterns (not exit code alone)
  - isRetryable excludes human-input blockers (DISCUSS, MANUAL_ACTION)
metrics:
  duration_minutes: 8
  tasks_completed: 2
  files_created: 5
  tests_added: 32
  test_files: 2
  completed_date: "2026-04-23"
---

# Phase 38 Plan 03: Checkpoint and Recovery System Summary

**One-liner:** Crash-resilient pipeline with STATE.md checkpoints and blocker detection for autonomous recovery.

## What Was Built

Implemented checkpoint persistence and blocker detection to enable crash recovery for autonomous pipeline execution.

**Checkpoint Manager:**
- Reads/writes STATE.md YAML frontmatter preserving all fields
- Tracks `pipeline_state` with phase slug, last completed plan, timestamps
- `getResumePoint()` calculates next plan from last checkpoint
- Uses phase slug (not number) for ROADMAP.md edit resilience
- Handles missing/corrupted STATE.md gracefully

**Blocker Detector:**
- Detects 5 blocker types: `DISCUSS_REQUIRED`, `VERIFICATION_FAILED`, `MISSING_ENV_VAR`, `AUTH_ERROR`, `MANUAL_ACTION_REQUIRED`
- Pattern-based detection (string matching + exit code)
- Extracts context (env var names, exit codes)
- Provides suggested actions for each blocker type
- `isRetryable()` determines if blocker allows auto-retry

**Test Coverage:**
- 32 passing tests (15 checkpoint + 17 blocker)
- TDD protocol followed: RED→GREEN→commit cycles
- Mocked fs operations for checkpoint tests
- Edge cases: missing files, corrupted YAML, unknown phases, empty phase lists

## Implementation Highlights

**Checkpoint Frontmatter Structure:**
```yaml
pipeline_state:
  current_phase_slug: "38-autonomous-pipeline-orchestration"
  last_completed_phase_slug: "38-autonomous-pipeline-orchestration"
  last_completed_plan: "38-02"
  started_at: "2026-04-23T09:00:00Z"
```

**Blocker Detection Patterns:**
- `/gsd-discuss`, `requires discussion`, `checkpoint:decision` → DISCUSS_REQUIRED
- `VERIFICATION FAILED`, `verification_status: failed` → VERIFICATION_FAILED
- `Missing required environment variable: X` → MISSING_ENV_VAR (extracts var name)
- `authentication failed`, `unauthorized`, `401` → AUTH_ERROR
- `checkpoint:human-action`, `manual action required` → MANUAL_ACTION_REQUIRED

**Resume Logic:**
- `getResumePoint()` parses `last_completed_plan` (e.g., "38-02")
- Calculates next plan index (planNum is 1-based, so `planNum` = next index)
- Handles phase transitions when current phase complete
- Returns `null` when pipeline complete or phase not found

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Missing yaml package**
- **Found during:** Task 1 GREEN phase
- **Issue:** `yaml` package not installed; tests failed with module not found
- **Fix:** Ran `pnpm add yaml` to install YAML parser
- **Files modified:** `package.json`
- **Commit:** Included in Task 1 GREEN commit `55b0643`

**2. [Rule 1 - Bug] Test regex patterns too strict**
- **Found during:** Task 1 GREEN phase
- **Issue:** YAML normalizes `1.0` to `1`; timestamp regex didn't match YAML output format
- **Fix:** Updated test patterns to accept both quoted/unquoted formats
- **Files modified:** `checkpoint-manager.test.ts`
- **Commit:** Included in Task 1 RED commit `651a832`

**3. [Process Issue] Working directory reset between bash calls**
- **Found during:** Task 1 commit attempt
- **Issue:** First execution created files in main repo, not worktree (bash cwd resets)
- **Fix:** Recreated all files in correct worktree location with explicit paths
- **Impact:** No functional changes; files recreated identically

## Verification Results

All verification criteria passed:

**Automated Tests:**
```bash
✓ pnpm test src/server/pipeline/checkpoint-manager.test.ts (15/15 pass)
✓ pnpm test src/server/pipeline/blocker-detector.test.ts (17/17 pass)
```

**Acceptance Criteria:**
- ✓ `readCheckpoint`, `writeCheckpoint`, `getResumePoint` exported
- ✓ `detectBlocker`, `BLOCKER_TYPE`, `isRetryable` exported
- ✓ `pipeline_state` tracked in checkpoint
- ✓ All blocker types defined (5 types)
- ✓ Test suites exist and pass

**Done Criteria:**
- ✓ Checkpoint persists to STATE.md on plan completion
- ✓ Resume point calculated from last completed plan
- ✓ Blocker detection identifies all human-input-required conditions
- ✓ All tests pass (32/32)

## Known Stubs

None - all functionality fully implemented.

## Integration Points

**Checkpoint Manager → STATE.md:**
- Reads `.planning/STATE.md` YAML frontmatter
- Writes `pipeline_state` block with phase slug + plan ID
- Preserves all other frontmatter fields (gsd_state_version, status, etc.)

**Blocker Detector → Executor Output:**
- Scans executor stdout/stderr for blocker patterns
- Returns `BlockerInfo` with type, message, context, suggested action
- Consumed by plan-worker to pause pipeline on blockers

**Resume Logic → ROADMAP.md:**
- `getResumePoint()` requires phase slugs from ROADMAP.md
- Phase slug format: `"38-autonomous-pipeline-orchestration"`
- Tolerates ROADMAP edits (uses slug, not line numbers)

## Self-Check: PASSED

**Files Created:**
- ✓ `src/server/pipeline/checkpoint-manager.ts` exists
- ✓ `src/server/pipeline/checkpoint-manager.test.ts` exists
- ✓ `src/server/pipeline/blocker-detector.ts` exists
- ✓ `src/server/pipeline/blocker-detector.test.ts` exists
- ✓ `src/server/pipeline/types.ts` exists

**Commits Exist:**
- ✓ `651a832` - test(38-03): add failing tests for checkpoint manager
- ✓ `55b0643` - feat(38-03): implement checkpoint manager for STATE.md
- ✓ `e723780` - test(38-03): add failing tests for blocker detector
- ✓ `806e442` - feat(38-03): implement blocker detector for pipeline execution

**Tests Pass:**
- ✓ All 32 tests passing
- ✓ No console errors
- ✓ TDD protocol followed (RED→GREEN cycles verified)

## Next Steps

**Plan 38-04: Plan Worker + Queue Integration**
- Integrate checkpoint manager into plan-worker.ts
- Call `writeCheckpoint()` after each plan completion
- Call `detectBlocker()` on executor failures
- Implement resume logic using `getResumePoint()`
- Add BullMQ queue for parallel plan execution
