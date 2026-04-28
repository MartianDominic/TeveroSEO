---
phase: 38-autonomous-pipeline-orchestration
plan: 02
subsystem: pipeline-queue-orchestration
tags: [backend, orchestration, bullmq, flow-producer, workers]
dependency_graph:
  requires:
    - roadmap-parser (38-01)
    - dependency-resolver (38-01)
    - pipeline-types (38-01)
  provides:
    - pipelineFlowProducer
    - phaseQueue
    - planQueue
    - schedulePhase
    - schedulePipeline
    - phase-worker
    - plan-worker
  affects:
    - BullMQ job queues
    - Redis (flow:pipeline, queue:pipeline-phase, queue:pipeline-plan)
tech_stack:
  added: []
  patterns:
    - BullMQ Flow Producer for parent-child job trees
    - Step-enum pattern for durable execution
    - TDD with Vitest and mocked BullMQ
key_files:
  created:
    - src/server/queues/pipelineQueue.ts
    - src/server/queues/pipelineQueue.test.ts
    - src/server/pipeline/pipeline-scheduler.ts
    - src/server/pipeline/pipeline-scheduler.test.ts
    - src/server/workers/phase-worker.ts
    - src/server/workers/plan-worker.ts
  modified: []
decisions:
  - Use BullMQ Flow Producer for atomic parent-child job creation
  - Phase jobs have attempts=1 (no retry); plan jobs retry with exponential backoff
  - Plan paths validated with regex to prevent path traversal (T-38-03)
  - GSD executor spawned without shell:true for security (T-38-05)
  - Step-enum pattern enables resume from last step on retry
metrics:
  duration_minutes: 8
  tasks_completed: 3
  tests_added: 23
  test_files: 2
  commits: 1
  files_created: 6
completed_date: "2026-04-24"
---

# Phase 38 Plan 02: BullMQ Flow Producer for Parallel Agent Coordination

**One-liner:** BullMQ Flow Producer creates parent-child job trees enabling parallel plan execution within phases, with phase workers that wait for all child plans to complete.

## What Was Built

Implemented the wave dispatcher with BullMQ Flow Producer for parallel agent coordination:

1. **Pipeline Queue Definitions** (`pipelineQueue.ts`)
   - `PHASE_QUEUE_NAME = "pipeline-phase"`: Queue for phase-level jobs
   - `PLAN_QUEUE_NAME = "pipeline-plan"`: Queue for plan-level jobs
   - `pipelineFlowProducer`: Creates atomic parent-child job trees
   - `PhaseJobData`: Phase metadata (phaseNumber, phaseName, phaseSlug, workspaceId, planIds, startedAt)
   - `PlanJobData`: Plan metadata (planId, phaseNumber, phaseName, workspaceId, planPath, step)
   - `PLAN_STEP`: Step enum (INITIAL, EXECUTING, VERIFYING, COMPLETE)
   - Plan jobs: 3 attempts with exponential backoff (10s, 20s, 40s)
   - Phase jobs: 1 attempt (no retry; child plans retry)

2. **Pipeline Scheduler** (`pipeline-scheduler.ts`)
   - `schedulePhase(phase, workspaceId)`: Creates Flow with phase as parent, plans as children
   - `schedulePipeline(options)`: Reads ROADMAP.md, resolves dependencies, schedules phases in order
   - `generatePlanIds(phase)`: Generates plan IDs in "NN-PP" format (e.g., "38-01", "38-02")
   - Plan paths derived from phase slug: `.planning/phases/38-autonomous-pipeline-orchestration/38-01-PLAN.md`
   - Workspace ID propagated to all job data

3. **Phase Worker** (`phase-worker.ts`)
   - Orchestrates child plan jobs via BullMQ Flow semantics
   - Processor runs AFTER all children complete (no explicit coordination needed)
   - `startPhaseWorker()`: Creates singleton worker with concurrency=1
   - `stopPhaseWorker()`: Graceful shutdown with 30s timeout
   - Lock duration: 5 minutes

4. **Plan Worker** (`plan-worker.ts`)
   - Executes individual plans via gsd-executor agent
   - Step-enum pattern for durable execution across retries
   - Plan path validation to prevent path traversal (T-38-03)
   - GSD executor spawned via `child_process.spawn` (no shell for security)
   - `startPlanWorker()`: Creates singleton worker with concurrency=2
   - `stopPlanWorker()`: Graceful shutdown with 30s timeout
   - Lock duration: 10 minutes

## Key Implementation Details

### BullMQ Flow Producer Pattern

```typescript
// Phase job as parent, plan jobs as children
await pipelineFlowProducer.add({
  name: `phase-${phase.number}`,
  queueName: PHASE_QUEUE_NAME,
  data: { phaseNumber, phaseName, phaseSlug, workspaceId, planIds, startedAt },
  children: [
    { name: "plan-38-01", queueName: PLAN_QUEUE_NAME, data: { ... } },
    { name: "plan-38-02", queueName: PLAN_QUEUE_NAME, data: { ... } },
  ],
});
```

### Step-Enum Pattern for Durable Execution

```typescript
let step = job.data.step;
while (step !== PLAN_STEP.COMPLETE) {
  switch (step) {
    case PLAN_STEP.INITIAL:
      await job.updateData({ ...job.data, step: PLAN_STEP.EXECUTING });
      step = PLAN_STEP.EXECUTING;
      break;
    case PLAN_STEP.EXECUTING:
      await runGsdExecutor(job.data.planPath, jobLog);
      await job.updateData({ ...job.data, step: PLAN_STEP.VERIFYING });
      step = PLAN_STEP.VERIFYING;
      break;
    // ...
  }
}
```

## Test Coverage

- **pipelineQueue.test.ts** (12 tests)
  - Queue names and options validation
  - FlowProducer creation and flow addition
  - PhaseJobData and PlanJobData interface validation
  - PLAN_STEP enum values

- **pipeline-scheduler.test.ts** (11 tests)
  - schedulePhase creates correct Flow tree
  - Plan paths derived from phase slug
  - Workspace ID propagation
  - schedulePipeline reads ROADMAP.md and schedules in order
  - startFromPhase option for resume scenarios
  - Empty result when all phases complete

## Security Mitigations

| Threat ID | Mitigation |
|-----------|------------|
| T-38-03 (Tampering) | Plan path validated with regex: `/^\.planning\/phases\/[\w-]+\/[\w-]+-PLAN\.md$/` |
| T-38-05 (Elevation) | GSD executor spawned without `shell: true`, inherited env only |

## Acceptance Criteria Verification

- [x] `grep -q "export const PHASE_QUEUE_NAME" src/server/queues/pipelineQueue.ts`
- [x] `grep -q "export const PLAN_QUEUE_NAME" src/server/queues/pipelineQueue.ts`
- [x] `grep -q "export const pipelineFlowProducer" src/server/queues/pipelineQueue.ts`
- [x] `grep -q "FlowProducer" src/server/queues/pipelineQueue.ts`
- [x] `grep -q "interface PhaseJobData" src/server/queues/pipelineQueue.ts`
- [x] `grep -q "interface PlanJobData" src/server/queues/pipelineQueue.ts`
- [x] `grep -q "export async function schedulePhase" src/server/pipeline/pipeline-scheduler.ts`
- [x] `grep -q "export async function schedulePipeline" src/server/pipeline/pipeline-scheduler.ts`
- [x] `grep -q "pipelineFlowProducer.add" src/server/pipeline/pipeline-scheduler.ts`
- [x] `grep -q "export function startPhaseWorker" src/server/workers/phase-worker.ts`
- [x] `grep -q "export function stopPhaseWorker" src/server/workers/phase-worker.ts`
- [x] `grep -q "export function startPlanWorker" src/server/workers/plan-worker.ts`
- [x] `grep -q "export function stopPlanWorker" src/server/workers/plan-worker.ts`
- [x] `grep -q "spawn.*claude" src/server/workers/plan-worker.ts`

## Next Steps

Plan 03 implements checkpoint persistence and resume:
- STATE.md checkpoint manager
- BullMQ completion hooks for checkpoint updates
- Resume from last checkpoint on crash
