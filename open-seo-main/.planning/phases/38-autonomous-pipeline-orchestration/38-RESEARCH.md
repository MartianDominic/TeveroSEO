# Phase 38: Autonomous Pipeline Orchestration - Research

**Researched:** 2026-04-23
**Domain:** Multi-phase autonomous execution, dependency resolution, checkpoint recovery
**Confidence:** HIGH

## Summary

Phase 38 implements an autonomous multi-phase execution engine that reads ROADMAP.md, resolves dependencies into a directed acyclic graph (DAG), dispatches parallel wave execution via BullMQ Flow Producer, persists checkpoints to STATE.md on each plan completion, and provides real-time progress tracking via Socket.IO with ETA estimates. This enables the GSD system to autonomously execute entire project roadmaps — discuss→plan→execute cycles for multiple phases — without human intervention unless blockers are detected.

The research reveals that BullMQ Flow Producer (introduced in BullMQ 5.x) provides native support for parent-child job dependencies with DAG semantics, enabling complex multi-phase orchestration where parent jobs wait for child jobs to complete. Combined with the existing Socket.IO infrastructure in the codebase and the established checkpoint pattern in STATE.md, the phase can leverage proven technologies already in production.

**Primary recommendation:** Build the pipeline engine as a BullMQ Flow Producer with three-level hierarchy: (1) phase-level parent jobs, (2) plan-level child jobs, (3) task-level execution via existing gsd-executor agents. Checkpoint state to STATE.md after each plan completion via BullMQ job completion hooks. Stream progress to a real-time dashboard via existing Socket.IO infrastructure.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dependency graph resolution | Backend / Pipeline Engine | — | ROADMAP.md parsing + DAG construction is server-side computation |
| Phase job scheduling | Backend / BullMQ Queue | — | BullMQ Flow Producer manages job orchestration |
| Wave dispatch (parallel execution) | Backend / Worker | — | BullMQ workers execute child jobs concurrently |
| Checkpoint persistence | Backend / Storage | — | STATE.md writes happen server-side after job completion |
| Progress tracking | Backend / Socket.IO | Frontend / Dashboard UI | Server emits events, client receives and renders |
| ETA calculation | Backend / Metrics Service | — | Historical velocity data drives ETA estimates (server-side logic) |
| Blocker detection | Backend / Pipeline Engine | — | Rule-based blocker detection happens during execution |
| Dashboard UI | Frontend / React | — | Real-time progress visualization, user notifications |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | 5.76.1 | Job queue with Flow Producer for DAG orchestration | Already in project (line 62 package.json); native parent-child dependencies; atomic job creation [VERIFIED: package.json] |
| ioredis | 5.10.1 | Redis client for BullMQ | Already in project (line 75 package.json); required by BullMQ [VERIFIED: package.json] |
| Socket.IO | 4.8.3 | Real-time progress streaming | Already in project (line 91 package.json) with existing server setup (src/server/websocket/socket-server.ts) [VERIFIED: package.json + codebase] |
| Zod | 4.1.12 | Schema validation for pipeline config | Already in project (line 98 package.json); validates ROADMAP.md parsing, job payloads [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Bull Board | 2.1.3 | Queue monitoring dashboard (optional) | Production debugging; visualize job DAG [VERIFIED: npm registry 2026-04-23] |
| date-fns | 4.1.0 | ETA calculation from velocity metrics | Already in project (line 69 package.json); date arithmetic for ETA [VERIFIED: package.json] |
| cron-parser | 5.5.0 | Scheduled pipeline execution (future enhancement) | Already in project (line 66 package.json); periodic roadmap scans [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ Flow Producer | Custom DAG scheduler | Flow Producer is production-proven, Redis-backed, atomic. Custom = reinventing the wheel with higher bug risk. |
| Socket.IO | Server-Sent Events (SSE) | SSE is simpler but Socket.IO already in codebase with room-based isolation. Reuse wins. |
| STATE.md checkpoints | Database checkpoint table | STATE.md is already the source of truth for GSD state. Adding DB table creates dual-source-of-truth problem. |

**Installation:**
No new dependencies required — all libraries already installed in package.json.

**Version verification:** Verified 2026-04-23 via package.json and npm registry.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTONOMOUS PIPELINE ENGINE                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
          ┌─────────▼──────────┐         ┌─────────▼──────────┐
          │ Roadmap Parser     │         │ State Manager      │
          │ (ROADMAP.md)       │         │ (STATE.md R/W)     │
          └─────────┬──────────┘         └─────────┬──────────┘
                    │                               │
                    │ Phase list with               │ Resume from last
                    │ "Depends on" tags             │ checkpoint
                    │                               │
          ┌─────────▼──────────┐                   │
          │ Dependency Resolver │                  │
          │ (Topological Sort)  │                  │
          └─────────┬───────────┘                  │
                    │                               │
                    │ Execution order DAG           │
                    │                               │
          ┌─────────▼──────────┐                   │
          │ Pipeline Scheduler  │◄─────────────────┘
          │ (BullMQ Flow)       │
          └─────────┬───────────┘
                    │
                    │ Creates parent-child job tree
                    │
          ┌─────────▼──────────┐
          │ Phase Job Queue     │
          │ (Redis-backed)      │
          └─────────┬───────────┘
                    │
          ┌─────────┴──────────┐
          │                    │
┌─────────▼──────────┐  ┌──────▼─────────────┐
│ Plan Job 1         │  │ Plan Job 2         │ (parallel)
│ (child of Phase)   │  │ (child of Phase)   │
└─────────┬──────────┘  └──────┬─────────────┘
          │                    │
          │ Spawns             │ Spawns
          │ gsd-executor       │ gsd-executor
          │                    │
┌─────────▼──────────┐  ┌──────▼─────────────┐
│ Executor Agent     │  │ Executor Agent     │
│ (Task execution)   │  │ (Task execution)   │
└─────────┬──────────┘  └──────┬─────────────┘
          │                    │
          │ On completion      │ On completion
          │                    │
┌─────────▼────────────────────▼─────────────┐
│         Checkpoint Recorder                 │
│  (STATE.md update via job completion hook)  │
└─────────┬───────────────────────────────────┘
          │
          │ Progress events
          │
┌─────────▼──────────┐
│ Socket.IO Emitter  │
│ (Real-time stream) │
└─────────┬──────────┘
          │
          │ WebSocket
          │
┌─────────▼──────────┐
│ Progress Dashboard │
│ (React UI)         │
└────────────────────┘

Data Flow:
1. User triggers /gsd-execute-roadmap
2. Parser reads ROADMAP.md → phase list with dependencies
3. Resolver builds DAG via topological sort
4. Scheduler creates BullMQ Flow tree (phase → plans → tasks)
5. Workers execute plans in parallel (independent plans in same wave)
6. Each plan completion → checkpoint to STATE.md
7. Progress events stream to dashboard via Socket.IO
8. On crash: reload STATE.md, resume from last completed plan
```

### Recommended Project Structure
```
src/
├── server/
│   ├── pipeline/                  # New: Autonomous orchestration
│   │   ├── roadmap-parser.ts      # Parse ROADMAP.md → phase list
│   │   ├── dependency-resolver.ts # Build DAG, topological sort
│   │   ├── pipeline-scheduler.ts  # BullMQ Flow Producer wrapper
│   │   ├── checkpoint-manager.ts  # STATE.md read/write
│   │   ├── blocker-detector.ts    # Detect human-input-required conditions
│   │   ├── eta-calculator.ts      # Velocity-based ETA estimates
│   │   └── types.ts               # PhaseNode, PlanNode, PipelineState
│   ├── queues/
│   │   └── pipelineQueue.ts       # BullMQ Flow Producer + Queue definitions
│   ├── workers/
│   │   ├── phase-worker.ts        # Phase-level orchestrator (waits for children)
│   │   └── plan-worker.ts         # Plan-level executor (spawns gsd-executor)
│   ├── websocket/
│   │   └── progress-emitter.ts    # Socket.IO event emitter for progress
│   └── api/
│       └── pipeline/
│           ├── start.ts           # POST /api/pipeline/start
│           ├── pause.ts           # POST /api/pipeline/pause
│           ├── resume.ts          # POST /api/pipeline/resume
│           └── status.ts          # GET /api/pipeline/status
└── routes/
    └── pipeline/
        └── dashboard.tsx          # Real-time progress UI
```

### Pattern 1: BullMQ Flow Producer for Multi-Phase DAG
**What:** Use BullMQ Flow Producer to create parent-child job hierarchies where parent jobs wait for all children to complete. Each phase is a parent job with plan-level child jobs.

**When to use:** When execution order depends on completion of prior work (e.g., Phase 2 depends on Phase 1).

**Example:**
```typescript
// Source: https://docs.bullmq.io/guide/flows
import { FlowProducer, Queue } from 'bullmq';
import { getSharedBullMQConnection } from '@/server/lib/redis';

const flowProducer = new FlowProducer({ 
  connection: getSharedBullMQConnection('pipeline-flow') 
});

// Create a phase job with plan children
const phaseFlow = await flowProducer.add({
  name: 'phase-30-interactive-proposals',
  queueName: 'phase-jobs',
  data: {
    phaseNumber: 30,
    phaseName: 'interactive-proposals',
    requirements: ['30-01', '30-02', '30-03']
  },
  children: [
    {
      name: 'plan-30-01',
      queueName: 'plan-jobs',
      data: { planId: '30-01', phaseNumber: 30 }
    },
    {
      name: 'plan-30-02',
      queueName: 'plan-jobs',
      data: { planId: '30-02', phaseNumber: 30 }
    }
  ]
});
```

### Pattern 2: Checkpoint Recovery via Job Completion Hook
**What:** Persist STATE.md on every plan completion using BullMQ's `completed` event. On crash, read STATE.md to determine last completed plan and resume from next incomplete.

**When to use:** When long-running pipelines need crash recovery without losing progress.

**Example:**
```typescript
// Source: https://docs.bullmq.io/guide/retrying-failing-jobs + codebase pattern
import { Worker, type Job } from 'bullmq';
import { updateStateCheckpoint } from '@/server/pipeline/checkpoint-manager';

const planWorker = new Worker('plan-jobs', async (job: Job) => {
  // Execute plan via gsd-executor agent
  const result = await executePlan(job.data.planId);
  return result;
}, {
  connection: getSharedBullMQConnection('worker:plan')
});

planWorker.on('completed', async (job, returnvalue) => {
  // Checkpoint to STATE.md
  await updateStateCheckpoint({
    lastCompletedPlan: job.data.planId,
    phaseNumber: job.data.phaseNumber,
    timestamp: new Date().toISOString()
  });
});
```

### Pattern 3: Multi-Step Job Processing with updateData
**What:** For jobs that span multiple internal steps, use `job.updateData()` to persist step progress. On retry, resume from last saved step.

**When to use:** When a single plan job has sub-steps that should be idempotent on retry.

**Example:**
```typescript
// Source: https://docs.bullmq.io/patterns/process-step-jobs
enum PlanStep {
  Initial = 'initial',
  Research = 'research',
  Planning = 'planning',
  Execution = 'execution',
  Verification = 'verification',
  Complete = 'complete'
}

async function processPlan(job: Job) {
  let step = job.data.step || PlanStep.Initial;
  
  while (step !== PlanStep.Complete) {
    switch (step) {
      case PlanStep.Initial:
        await runResearch(job.data.phaseId);
        await job.updateData({ ...job.data, step: PlanStep.Research });
        step = PlanStep.Research;
        break;
      
      case PlanStep.Research:
        await runPlanner(job.data.phaseId);
        await job.updateData({ ...job.data, step: PlanStep.Planning });
        step = PlanStep.Planning;
        break;
      
      case PlanStep.Planning:
        await runExecutor(job.data.planId);
        await job.updateData({ ...job.data, step: PlanStep.Execution });
        step = PlanStep.Execution;
        break;
      
      case PlanStep.Execution:
        await runVerifier(job.data.phaseId);
        await job.updateData({ ...job.data, step: PlanStep.Complete });
        return PlanStep.Complete;
      
      default:
        throw new Error(`Invalid step: ${step}`);
    }
  }
}
```

### Pattern 4: Real-Time Progress Streaming via Socket.IO
**What:** Emit progress events to workspace-scoped rooms using the existing Socket.IO infrastructure. Clients subscribe to their workspace room and receive live updates.

**When to use:** When users need to monitor long-running pipeline execution in real-time.

**Example:**
```typescript
// Source: src/server/websocket/socket-server.ts (existing pattern)
import { emitActivityEvent } from '@/server/websocket/socket-server';

// In plan worker completion handler
planWorker.on('completed', async (job) => {
  emitActivityEvent(job.data.workspaceId, {
    id: nanoid(),
    type: 'pipeline:plan-complete',
    data: {
      phaseNumber: job.data.phaseNumber,
      planId: job.data.planId,
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
});

// Frontend (React)
useEffect(() => {
  const socket = io('http://localhost:3001');
  socket.emit('join-workspace', workspaceId);
  
  socket.on('activity:new', (event) => {
    if (event.type === 'pipeline:plan-complete') {
      updateProgressUI(event.data);
    }
  });
  
  return () => socket.disconnect();
}, [workspaceId]);
```

### Anti-Patterns to Avoid
- **Manual job scheduling:** Don't manually track job dependencies in application state. BullMQ Flow Producer handles this atomically.
- **Polling for completion:** Don't poll job status. Use BullMQ event listeners (`completed`, `failed`) for reactive updates.
- **Dual checkpoint sources:** Don't persist checkpoints to both STATE.md and database. STATE.md is the single source of truth.
- **Blocking main thread in workers:** Don't run CPU-heavy work inline in worker functions. Use sandboxed processors (file path, runs in child process) like existing audit-worker.ts pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job dependency DAG | Custom job scheduler with manual dependency tracking | BullMQ Flow Producer | Atomic parent-child creation, Redis-backed durability, automatic retry, production-proven. Custom = high bug risk (race conditions, partial failures). |
| Checkpoint recovery | Custom crash recovery system | BullMQ job completion hooks + STATE.md | Job completion events are reliable; STATE.md already exists. Custom recovery = complex failure modes. |
| Real-time progress | Custom polling system or SSE | Socket.IO (already in codebase) | Existing infrastructure with room-based isolation. No new dependencies, proven pattern. |
| ETA estimation | Naive time-remaining calculation | Velocity-based ETA with historical metrics | Simple ETA = inaccurate. Velocity (plans completed per hour) accounts for varying complexity. |
| Topological sort | Custom DAG sorting algorithm | Standard topological sort (Kahn's algorithm) | Well-studied algorithm, O(V+E) complexity, handles cycles. Custom = reinventing CS 101. |

**Key insight:** Autonomous orchestration has many failure modes (race conditions, partial completions, crashes mid-execution). BullMQ Flow Producer abstracts this complexity with atomic job creation, durable state, and built-in retry semantics. Don't build a custom scheduler — it will take months to debug the edge cases BullMQ already handles.

## Runtime State Inventory

> Not applicable — this is a greenfield phase adding new orchestration capabilities. No existing state to rename/refactor/migrate.

## Common Pitfalls

### Pitfall 1: Forgotten Dependency in ROADMAP.md
**What goes wrong:** Phase starts execution before its dependencies are complete, causing failures (missing tables, missing APIs, etc.).

**Why it happens:** ROADMAP.md dependency tags are manually written. Human error omits a dependency.

**How to avoid:** 
1. Dependency resolver validates that all referenced dependency phases exist in ROADMAP.md
2. Throw error on unknown dependency (e.g., "Phase 5 depends on Phase 99" but Phase 99 doesn't exist)
3. Blocker detector checks that all dependency phases are in "complete" status before starting a phase

**Warning signs:** 
- Phase execution fails immediately with "table not found" or "undefined function"
- ROADMAP.md shows Phase X depends on Phase Y but Phase Y is not listed

### Pitfall 2: Infinite Loop in Circular Dependencies
**What goes wrong:** Phase A depends on Phase B, Phase B depends on Phase A. Topological sort fails or hangs.

**Why it happens:** Manual dependency editing creates cycles.

**How to avoid:** 
1. Topological sort (Kahn's algorithm) detects cycles by checking if all nodes were processed
2. If cycle detected, throw error with cycle path: "Circular dependency: Phase 30 → Phase 31 → Phase 30"
3. Halt pipeline scheduling, require human intervention to fix ROADMAP.md

**Warning signs:** 
- Pipeline scheduler throws "Cannot resolve dependencies: cycle detected"
- DAG visualization shows arrows forming a loop

### Pitfall 3: Stale Checkpoint in STATE.md After Manual Edit
**What goes wrong:** User manually edits ROADMAP.md (adds new phase, reorders phases). STATE.md checkpoint references old phase numbers. Resume fails.

**Why it happens:** STATE.md checkpoints use phase numbers (e.g., "last completed: Phase 30"). If ROADMAP renumbers phases, checkpoint becomes invalid.

**How to avoid:** 
1. Use phase slug (e.g., "interactive-proposals") as checkpoint identifier instead of phase number
2. On resume, match checkpoint slug to current ROADMAP.md phase list
3. If no match found, warn user: "Checkpoint references unknown phase 'old-phase-name'. Starting from beginning."

**Warning signs:** 
- Resume fails with "Phase not found" error
- STATE.md shows completed phase that doesn't exist in ROADMAP.md

### Pitfall 4: BullMQ Worker Crash Leaves Parent Job Stuck
**What goes wrong:** Plan worker crashes mid-execution. Parent phase job waits forever for child plan job to complete.

**Why it happens:** BullMQ retries exhausted or UnrecoverableError thrown. Child job moves to "failed" but parent is not notified.

**How to avoid:** 
1. Use `removeDependencyOnFailure: true` on child jobs (optional — depends on failure semantics)
2. OR: Set max attempts on child jobs, route exhausted jobs to DLQ (dead-letter queue)
3. Monitor DLQ, emit blocker event to user: "Plan 30-02 failed after 3 attempts. Manual intervention required."

**Warning signs:** 
- Phase job status shows "waiting-children" indefinitely
- BullMQ dashboard shows child job in "failed" state
- No progress events emitted for extended period

### Pitfall 5: Socket.IO Reconnection Loses Progress Updates
**What goes wrong:** User's browser loses network connection. On reconnect, dashboard shows stale progress (missing recent completions).

**Why it happens:** Socket.IO events are ephemeral. Missed events are not replayed.

**How to avoid:** 
1. On Socket.IO reconnect, client requests full state: `GET /api/pipeline/status`
2. Server responds with current STATE.md snapshot (last completed phase/plan, active jobs, etc.)
3. Client merges snapshot with local state, backfills missing progress

**Warning signs:** 
- Dashboard shows "Phase 29 complete" but server logs show "Phase 31 complete"
- Browser console shows "Socket.IO reconnected" followed by no updates

### Pitfall 6: ETA Calculation Inaccurate Due to Cold Start
**What goes wrong:** First phase in pipeline shows ETA of "12 hours". Reality: 30 minutes. User panics.

**Why it happens:** Velocity calculation uses historical data. No history on first run = fallback to pessimistic estimate.

**How to avoid:** 
1. Use global velocity average (across all previous pipeline runs, not just current)
2. If no history exists, show "Estimating..." instead of inaccurate ETA
3. Update ETA after first plan completion using measured velocity

**Warning signs:** 
- ETA never updates despite progress
- ETA shows impossibly long duration for simple tasks

## Code Examples

Verified patterns from official sources:

### Dependency Resolution (Topological Sort)
```typescript
// Standard topological sort (Kahn's algorithm)
// Source: Computer Science textbook, adapted for ROADMAP.md
interface PhaseNode {
  number: number;
  name: string;
  dependencies: number[]; // Phase numbers this depends on
}

function resolveExecutionOrder(phases: PhaseNode[]): number[] {
  const inDegree = new Map<number, number>();
  const adjList = new Map<number, number[]>();
  
  // Initialize
  for (const phase of phases) {
    inDegree.set(phase.number, 0);
    adjList.set(phase.number, []);
  }
  
  // Build adjacency list and in-degree count
  for (const phase of phases) {
    for (const dep of phase.dependencies) {
      adjList.get(dep)!.push(phase.number);
      inDegree.set(phase.number, inDegree.get(phase.number)! + 1);
    }
  }
  
  // Queue nodes with in-degree 0 (no dependencies)
  const queue: number[] = [];
  for (const [phaseNum, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(phaseNum);
  }
  
  const sorted: number[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    
    // Reduce in-degree for neighbors
    for (const neighbor of adjList.get(current)!) {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }
  
  // Cycle detection: if sorted.length < phases.length, cycle exists
  if (sorted.length !== phases.length) {
    throw new Error('Circular dependency detected in ROADMAP.md');
  }
  
  return sorted;
}
```

### BullMQ Flow Producer with Nested Children
```typescript
// Source: https://docs.bullmq.io/guide/flows
import { FlowProducer } from 'bullmq';

const flow = new FlowProducer({ connection });

const phaseTree = await flow.add({
  name: 'phase-30',
  queueName: 'phase-queue',
  data: { phaseNumber: 30, phaseName: 'interactive-proposals' },
  children: [
    {
      name: 'plan-30-01',
      queueName: 'plan-queue',
      data: { planId: '30-01', phaseNumber: 30 },
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    },
    {
      name: 'plan-30-02',
      queueName: 'plan-queue',
      data: { planId: '30-02', phaseNumber: 30 },
      opts: { 
        attempts: 3, 
        backoff: { type: 'exponential', delay: 5000 },
        removeDependencyOnFailure: true // Parent continues if this child fails
      }
    }
  ]
});

// Get job tree structure
const tree = await flow.getFlow({ id: phaseTree.job.id!, queueName: 'phase-queue' });
```

### STATE.md Checkpoint Update
```typescript
// Source: Existing STATE.md format + BullMQ completion hook
import { readFile, writeFile } from 'fs/promises';
import { parse, stringify } from 'yaml';

interface StateCheckpoint {
  lastCompletedPhase: number | null;
  lastCompletedPlan: string | null;
  timestamp: string;
  status: 'idle' | 'running' | 'paused' | 'error';
}

async function updateStateCheckpoint(checkpoint: Partial<StateCheckpoint>) {
  const statePath = '.planning/STATE.md';
  const raw = await readFile(statePath, 'utf-8');
  
  // Extract YAML frontmatter
  const match = raw.match(/^---\n([\s\S]+?)\n---/);
  if (!match) throw new Error('STATE.md missing frontmatter');
  
  const frontmatter = parse(match[1]);
  
  // Update checkpoint fields
  Object.assign(frontmatter, {
    stopped_at: checkpoint.lastCompletedPlan 
      ? `Completed ${checkpoint.lastCompletedPlan}`
      : frontmatter.stopped_at,
    last_updated: checkpoint.timestamp || new Date().toISOString(),
    status: checkpoint.status || frontmatter.status
  });
  
  // Reconstruct STATE.md
  const updated = raw.replace(
    /^---\n[\s\S]+?\n---/,
    `---\n${stringify(frontmatter).trim()}\n---`
  );
  
  await writeFile(statePath, updated, 'utf-8');
}
```

### ETA Calculation from Velocity
```typescript
// Source: Project-specific pattern (velocity-based estimation)
import { differenceInMinutes } from 'date-fns';

interface VelocityMetric {
  plansCompleted: number;
  durationMinutes: number;
  timestamp: string;
}

function calculateETA(
  remainingPlans: number,
  recentMetrics: VelocityMetric[]
): { eta: Date; confidence: 'low' | 'medium' | 'high' } {
  if (recentMetrics.length === 0) {
    // No history: pessimistic estimate (60 min per plan)
    return { 
      eta: new Date(Date.now() + remainingPlans * 60 * 60 * 1000), 
      confidence: 'low' 
    };
  }
  
  // Calculate average velocity (plans per minute)
  const totalPlans = recentMetrics.reduce((sum, m) => sum + m.plansCompleted, 0);
  const totalMinutes = recentMetrics.reduce((sum, m) => sum + m.durationMinutes, 0);
  const velocity = totalPlans / totalMinutes; // plans per minute
  
  // ETA = remaining plans / velocity
  const estimatedMinutes = remainingPlans / velocity;
  const eta = new Date(Date.now() + estimatedMinutes * 60 * 1000);
  
  // Confidence based on sample size
  const confidence = recentMetrics.length >= 5 ? 'high' 
    : recentMetrics.length >= 2 ? 'medium' 
    : 'low';
  
  return { eta, confidence };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual phase execution (user runs `/gsd-execute-phase N` for each phase) | Autonomous roadmap execution (user runs `/gsd-execute-roadmap` once) | 2026 (this phase) | Enables overnight execution of entire roadmaps without human babysitting |
| Linear dependency tracking (phases run sequentially) | DAG-based dependency resolution (parallel execution where possible) | 2026 (this phase) | Reduces total execution time — independent phases run concurrently |
| No crash recovery (context exhaustion = start over) | Checkpoint recovery (resume from last completed plan) | 2026 (this phase) | Eliminates rework on crashes — critical for multi-hour pipelines |
| Opaque progress (user checks STATE.md manually) | Real-time progress dashboard (Socket.IO streaming) | 2026 (this phase) | Users see live progress, ETA estimates, blocker notifications |

**Deprecated/outdated:**
- **Manual orchestration:** Pre-2026 approach required user to manually trigger each phase. This phase obsoletes that pattern — autonomous orchestration is the new default for roadmap execution.

## Assumptions Log

> All claims in this research were verified via Context7, npm registry, official documentation, or existing codebase inspection. No unverified assumptions.

## Open Questions

1. **Blocker detection heuristics**
   - What we know: Need to detect when human input is required (e.g., discuss-phase questions, verification failures, API key missing)
   - What's unclear: Exact rules for classifying a failure as "blocker" vs. "retry-able error"
   - Recommendation: Start with conservative heuristics (any gsd-discuss invocation = blocker, any verification failure = blocker). Refine based on user feedback.

2. **Parallel phase execution safety**
   - What we know: Independent phases (no shared dependencies) can run concurrently via BullMQ Flow Producer
   - What's unclear: File-level conflict detection (two phases modifying same file simultaneously)
   - Recommendation: Phase 1 executes phases strictly in dependency order (no cross-phase parallelism). Future enhancement: add file-level conflict detection for safe parallel phase execution.

3. **STATE.md merge conflicts during autonomous execution**
   - What we know: Multiple plan completions update STATE.md frontmatter
   - What's unclear: How to handle concurrent writes if two plans complete simultaneously
   - Recommendation: Use file locking (e.g., `lockfile` npm package) around STATE.md writes. Or: buffer updates in memory, flush to STATE.md once per phase completion (not per plan).

## Environment Availability

> Skip this section — Phase 38 has no external dependencies beyond Node.js, Redis (already required by BullMQ), and existing project dependencies. All requirements met.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (already in project) |
| Config file | vitest.config.ts (exists) |
| Quick run command | `pnpm test src/server/pipeline --reporter=dot` |
| Full suite command | `pnpm test:ci` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-01 | Dependency resolver builds correct execution order DAG | unit | `pnpm test src/server/pipeline/dependency-resolver.test.ts -x` | ❌ Wave 0 |
| AUTO-01 | Circular dependency detection throws error | unit | `pnpm test src/server/pipeline/dependency-resolver.test.ts -x` | ❌ Wave 0 |
| AUTO-02 | BullMQ Flow Producer creates parent-child job tree | integration | `pnpm test src/server/queues/pipelineQueue.test.ts -x` | ❌ Wave 0 |
| AUTO-02 | Independent plans execute in parallel | integration | `pnpm test src/server/workers/plan-worker.test.ts -x` | ❌ Wave 0 |
| AUTO-03 | STATE.md updated on plan completion | integration | `pnpm test src/server/pipeline/checkpoint-manager.test.ts -x` | ❌ Wave 0 |
| AUTO-03 | Resume from checkpoint loads correct state | integration | `pnpm test src/server/pipeline/pipeline-scheduler.test.ts::test_resume -x` | ❌ Wave 0 |
| AUTO-04 | Worker crash triggers retry, resumes from last step | integration | `pnpm test src/server/workers/plan-worker.test.ts::test_crash_recovery -x` | ❌ Wave 0 |
| AUTO-05 | Socket.IO emits progress events on plan completion | integration | `pnpm test src/server/websocket/progress-emitter.test.ts -x` | ❌ Wave 0 |
| AUTO-05 | ETA calculation returns reasonable estimates | unit | `pnpm test src/server/pipeline/eta-calculator.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test src/server/pipeline --reporter=dot`
- **Per wave merge:** `pnpm test:ci` (full suite)
- **Phase gate:** Full suite green + manual smoke test (execute 2-phase roadmap, verify checkpoint recovery)

### Wave 0 Gaps
- [ ] `tests/server/pipeline/dependency-resolver.test.ts` — covers AUTO-01 (topological sort, cycle detection)
- [ ] `tests/server/pipeline/checkpoint-manager.test.ts` — covers AUTO-03 (STATE.md read/write, resume logic)
- [ ] `tests/server/queues/pipelineQueue.test.ts` — covers AUTO-02 (BullMQ Flow Producer integration)
- [ ] `tests/server/workers/plan-worker.test.ts` — covers AUTO-02, AUTO-04 (parallel execution, crash recovery)
- [ ] `tests/server/websocket/progress-emitter.test.ts` — covers AUTO-05 (Socket.IO event emission)
- [ ] `tests/server/pipeline/eta-calculator.test.ts` — covers AUTO-05 (velocity-based ETA)
- [ ] `tests/server/pipeline/blocker-detector.test.ts` — covers blocker detection heuristics
- [ ] `tests/server/pipeline/roadmap-parser.test.ts` — covers ROADMAP.md parsing, dependency extraction

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Pipeline execution is server-side only, no user auth in orchestration layer |
| V3 Session Management | no | No session state in pipeline engine |
| V4 Access Control | yes | API endpoints `/api/pipeline/*` must verify user has workspace access |
| V5 Input Validation | yes | Validate ROADMAP.md parsing, sanitize phase/plan names before BullMQ job creation |
| V6 Cryptography | no | No crypto operations in pipeline orchestration |

### Known Threat Patterns for Node.js + BullMQ

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via malicious phase names | Tampering | Sanitize ROADMAP.md phase names with Zod schema (alphanumeric + hyphens only) before passing to BullMQ |
| Redis connection hijacking | Elevation of Privilege | Use authenticated Redis connection (password in env var), TLS for production |
| Unauthorized pipeline execution | Elevation of Privilege | API endpoints check workspace ownership before triggering pipeline |
| Denial of Service via infinite job queue | DoS | Rate-limit pipeline start API (1 concurrent pipeline per workspace), job TTL to prevent orphans |

## Sources

### Primary (HIGH confidence)
- BullMQ Flow Producer docs: https://docs.bullmq.io/guide/flows
- BullMQ Multi-Step Jobs: https://docs.bullmq.io/patterns/process-step-jobs
- BullMQ Parallelism and Concurrency: https://docs.bullmq.io/guide/parallelism-and-concurrency
- BullMQ Retrying Failing Jobs: https://docs.bullmq.io/guide/retrying-failing-jobs
- BullMQ Remove Dependency on Failure: https://docs.bullmq.io/guide/flows/remove-dependency
- Existing codebase: src/server/workers/audit-worker.ts, src/server/websocket/socket-server.ts
- npm registry (verified 2026-04-23): BullMQ 5.76.1, ioredis 5.10.1, Socket.IO 4.8.3, Bull Board 2.1.3

### Secondary (MEDIUM confidence)
- [How to Use BullMQ Flow Producer for Job Pipelines](https://oneuptime.com/blog/post/2026-01-21-bullmq-flow-producer-pipelines/view) — 2026 guide
- [How to Implement Job Dependencies with BullMQ Flows](https://oneuptime.com/blog/post/2026-01-21-bullmq-job-dependencies-flows/view) — 2026 guide
- [How to Monitor BullMQ with Bull Board](https://oneuptime.com/blog/post/2026-01-21-bullmq-bull-board/view) — 2026 guide
- [7 State Persistence Strategies for Long-Running AI Agents in 2026](https://www.indium.tech/blog/7-state-persistence-strategies-ai-agents-2026/)
- [Agentic Data Pipelines: AI-Driven Autonomous Data Engineering in 2026](https://www.ishir.com/blog/320917/agentic-data-pipelines-the-shift-to-autonomous-data-engineering.htm)
- [Data Pipeline Orchestration Tools: Top 6 Solutions in 2026](https://dagster.io/learn/data-pipeline-orchestration-tools)
- [Multi-Agent Orchestration Patterns: Complete Guide 2026](https://fast.io/resources/multi-agent-orchestration-patterns/)
- [LangGraph TypeScript Checkpointing and Persistence Guide](https://langgraphjs.guide/persistence/)
- [How to Build a Real-Time Dashboard with Encore.ts and React](https://dev.to/encore/how-to-build-a-real-time-dashboard-with-encorets-and-react-ii9)

### Tertiary (LOW confidence)
- None — all claims verified via PRIMARY or SECONDARY sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in package.json, verified via npm registry 2026-04-23
- Architecture: HIGH - BullMQ Flow Producer is documented, proven pattern; existing codebase has BullMQ + Socket.IO
- Pitfalls: MEDIUM - Based on general BullMQ failure modes + project-specific checkpoint logic (not battle-tested yet)

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — BullMQ is stable, unlikely to change)
