# Phase 102: Remediation Plan

**Created:** 2026-05-18
**Source:** 20-Agent Comprehensive Review
**Status:** Ready for Implementation

---

## Remediation Waves

### Wave 1: Critical Security & Blocking (Day 1)
- [C1] Fix analytics rate-limit fail-open
- [C2] Fix failing test

### Wave 2: Accessibility & Exports (Day 1-2)  
- [H3] Add missing index.ts exports
- [H6] Add accessible labels to 4 form inputs

### Wave 3: Template System (Day 2-3)
- [H4] Template blocks use getBlockTemplate() for placeholders
- [H5] Set content mode on blocks

### Wave 4: Infrastructure Hardening (Day 3-4)
- [H8] Queue persistence/recovery
- [H9] Python service auth

### Wave 5: Architecture Alignment (Sprint 2)
- [C1-FULL] Refactor store to use 3-layer architecture
- [M1-M7] Medium priority items

---

## Detailed Remediation Plans

### [C1] Analytics Rate-Limit Fails OPEN (CRITICAL)

**Location:** `apps/web/src/app/api/document-builder/analytics/route.ts:66-73`

**Current Behavior:**
```typescript
// Rate limit check fails OPEN - allows unlimited requests on Redis failure
try {
  await checkRateLimit(sessionKey, 100, 60000);
} catch (error) {
  logger.warn('Rate limit check failed', { error });
  // CONTINUES PROCESSING - security risk
}
```

**Solution:**
```typescript
// Fail CLOSED - block requests on Redis failure
try {
  await checkRateLimit(sessionKey, 100, 60000);
} catch (error) {
  logger.error('Rate limit service unavailable', { error });
  return NextResponse.json(
    { error: 'Service temporarily unavailable', code: 'RATE_LIMIT_UNAVAILABLE' },
    { status: 503, headers: { 'Retry-After': '60' } }
  );
}
```

**Verification:**
- Kill Redis, send analytics request → expect 503
- Restore Redis, send request → expect 202

---

### [H3] Missing Index.ts Exports

**Location:** `apps/web/src/lib/document-builder/index.ts`

**Add exports:**
```typescript
// heatmap-calculator.ts
export {
  calculateEngagementScore,
  getHeatLevel,
  getHeatColor,
  getHeatLabel,
  calculateHeatmapData,
  getHeatGradient,
  type HeatLevel,
  type HeatmapData,
} from './heatmap-calculator';

// analytics-sync-worker.ts
export {
  syncAnalytics,
  analyticsSyncWorker,
  type SyncResult,
} from './analytics-sync-worker';

// version-diff.ts
export {
  computeBlockDiff,
  computeTextDiff,
  extractTextFromContent,
  getDiffSummary,
  hasChanges,
  type BlockDiff,
  type TextDiffSegment,
  type DiffSummary,
} from './version-diff';

// ab-testing-service.ts (missing types)
export type {
  ABTestResult,
  CreateVariantRequest,
  UpdateWeightsRequest,
} from './ab-testing-service';
```

---

### [H4] Template Blocks Created Without Placeholders

**Location:** `apps/web/src/lib/document-builder/template-service.ts:112`

**Current:**
```typescript
const blocks: CanvasBlock[] = sequence.map((type, index) => ({
  id: `${type}-${Date.now()}-${index}`,
  type,
  position: index,
  content: createEmptyTipTapDoc(), // EMPTY - no guidance
  // ...
}));
```

**Solution:**
```typescript
import { getBlockTemplate } from './persuasion-blocks';
import { nanoid } from 'nanoid';

const blocks: CanvasBlock[] = sequence.map((type, index) => ({
  id: nanoid(),
  type,
  position: index,
  content: getBlockTemplate(type), // Uses placeholder content with guidance
  // ...
}));
```

---

### [H5] Content Mode Not Set on Blocks

**Location:** `apps/web/src/lib/document-builder/template-service.ts:111`

**Solution:**
```typescript
// Add helper function
function determineContentMode(
  type: PersuasionBlockType,
  frameworkId: string
): TemplateContentMode {
  // Fixed: guarantees, specific claims
  if (type === 'risk_reversal' || type === 'credibility') {
    return 'fixed';
  }
  // Regenerate: case studies, testimonials
  if (type === 'social_proof') {
    return 'regenerate';
  }
  // Variable: everything else uses prospect data
  return 'variable';
}

// Apply in block creation
const blocks: CanvasBlock[] = sequence.map((type, index) => ({
  id: nanoid(),
  type,
  position: index,
  content: getBlockTemplate(type),
  mode: determineContentMode(type, frameworkId), // NEW
  // ...
}));
```

---

### [H6] Missing Accessible Labels

**Locations & Fixes:**

1. **PersuasionBlock.tsx:170**
```tsx
<input
  type="text"
  value={block.title || ''}
  onChange={handleTitleChange}
  aria-label="Block title"
  placeholder="Enter block title..."
/>
```

2. **VariablePicker.tsx:177**
```tsx
<Input
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  aria-label="Search variables"
  placeholder="Search variables..."
/>
```

3. **VerificationUI.tsx:452**
```tsx
<textarea
  value={editContent}
  onChange={(e) => setEditContent(e.target.value)}
  aria-label="Edit block content"
  className="..."
/>
```

4. **ManualBlockCreator.tsx (InlineBlockCreator)**
```tsx
<textarea
  value={content}
  onChange={(e) => setContent(e.target.value)}
  aria-label="Block content"
  placeholder="Enter block content..."
/>
```

---

### [H7] Failing Test in analytics-sync-worker.test.ts

**Likely Issue:** Jest timer mocking not advancing properly for setInterval

**Debug Steps:**
1. Check if `jest.useFakeTimers()` is called
2. Verify `jest.advanceTimersByTime(5 * 60 * 1000)` is used
3. Check for async/await issues with timers

**Common Fix:**
```typescript
it('runs sync every 5 minutes', async () => {
  jest.useFakeTimers();
  
  const syncMock = jest.spyOn(module, 'syncAnalytics');
  
  analyticsSyncWorker.start();
  
  // Advance timers
  jest.advanceTimersByTime(5 * 60 * 1000);
  
  // Flush promises
  await Promise.resolve();
  
  expect(syncMock).toHaveBeenCalledTimes(1);
  
  analyticsSyncWorker.stop();
  jest.useRealTimers();
});
```

---

### [H8] In-Memory Queue Loses Jobs on Restart

**Current Problem:** `processing-queue.ts` uses in-memory array that's lost on restart.

**Solution Options:**

**Option A: Persist to Database (Recommended)**
```typescript
// On shutdown
async function persistQueueState() {
  const pendingJobs = queue.filter(j => j.status === 'pending' || j.status === 'processing');
  
  for (const job of pendingJobs) {
    await db.insert(queuedJobs).values({
      documentId: job.documentId,
      status: 'pending', // Reset processing to pending
      attempts: job.attempts,
      createdAt: job.createdAt,
    });
  }
}

// On startup
async function recoverQueueState() {
  const pendingJobs = await db.query.queuedJobs.findMany({
    where: eq(queuedJobs.status, 'pending'),
  });
  
  for (const job of pendingJobs) {
    queue.push({ ...job, status: 'pending' });
  }
  
  // Delete recovered jobs from DB
  await db.delete(queuedJobs).where(inArray(queuedJobs.id, pendingJobs.map(j => j.id)));
}
```

**Option B: Use uploaded_documents status as queue**
```typescript
// Documents with status='pending' ARE the queue
async function processNextDocument() {
  const next = await db.query.uploadedDocuments.findFirst({
    where: eq(uploadedDocuments.status, 'pending'),
    orderBy: [asc(uploadedDocuments.createdAt)],
  });
  
  if (next) {
    await processDocument(next);
  }
}
```

---

### [H9] No Auth on Python /parse Endpoint

**Location:** `services/document-parser/main.py`

**Solution:**
```python
import os
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY")

@app.middleware("http")
async def verify_internal_auth(request: Request, call_next):
    # Skip auth for health check
    if request.url.path == "/health":
        return await call_next(request)
    
    # Require auth for all other endpoints
    auth_header = request.headers.get("X-Internal-Auth")
    if not INTERNAL_API_KEY:
        # Dev mode - no auth required
        return await call_next(request)
    
    if auth_header != INTERNAL_API_KEY:
        return JSONResponse(
            {"error": "Unauthorized", "code": "INTERNAL_AUTH_REQUIRED"},
            status_code=401
        )
    
    return await call_next(request)
```

**TypeScript Client Update:**
```typescript
// parser-client.ts
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

async function callParserService(endpoint: string, body: any) {
  return fetch(`${PARSER_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': INTERNAL_API_KEY || '',
    },
    body: JSON.stringify(body),
  });
}
```

---

### [C1-FULL] 3-Layer Architecture Refactor (Sprint 2)

**This is a significant refactor requiring careful planning.**

**Phase 1: Define New Store Structure**
```typescript
// stores/documentBuilderStoreV2.ts
interface DocumentBuilderStateV2 {
  // Structure Layer
  structure: {
    id: string;
    frameworkId?: string;
    frameworkName?: string;
    blockOrder: string[]; // Array of block IDs in order
    blocks: Record<string, StructureBlockRef>;
  };
  
  // Content Layer
  content: {
    version: number;
    blocks: Record<string, ContentBlock>;
    variants: Record<string, BlockVariant[]>;
  };
  
  // Context Layer
  context: {
    prospectId?: string;
    prospect?: ProspectContext;
    styleReferences: StyleReference[];
    brandTheme?: BrandTheme;
  };
  
  // UI State (not persisted)
  ui: {
    selectedBlockId: string | null;
    isGenerating: boolean;
    showHeatmap: boolean;
  };
}
```

**Phase 2: Create Adapter Layer**
```typescript
// Converts old PersuasionBlock[] to new 3-layer structure
function migrateToV2(oldState: DocumentBuilderState): DocumentBuilderStateV2 {
  const structure: StructureBlockRef[] = [];
  const content: Record<string, ContentBlock> = {};
  
  for (const block of oldState.blocks) {
    structure.push({
      id: block.id,
      type: block.type,
      position: block.position,
      required: block.persuasionMeta?.isRequired ?? false,
    });
    
    content[block.id] = {
      structureId: block.id,
      content: block.content,
      styling: block.styling,
      mode: block.mode,
    };
  }
  
  return {
    structure: {
      id: oldState.proposalId || nanoid(),
      frameworkId: oldState.frameworkId,
      blockOrder: structure.map(s => s.id),
      blocks: Object.fromEntries(structure.map(s => [s.id, s])),
    },
    content: {
      version: 1,
      blocks: content,
      variants: {},
    },
    context: {
      prospectId: oldState.prospectId,
      prospect: oldState.prospect,
      styleReferences: [],
    },
    ui: {
      selectedBlockId: null,
      isGenerating: false,
      showHeatmap: false,
    },
  };
}
```

**Phase 3: Migrate Components**
- Create selectors for each layer
- Update components one by one
- Test thoroughly at each step

**Phase 4: Remove Old Store**
- Remove deprecated store
- Clean up adapter code

---

## Implementation Priority Matrix

| Issue | Effort | Risk | Priority | Wave |
|-------|--------|------|----------|------|
| C1 (rate-limit) | 10 min | HIGH | P0 | 1 |
| H7 (failing test) | 30 min | LOW | P0 | 1 |
| H3 (exports) | 15 min | LOW | P1 | 2 |
| H6 (a11y labels) | 30 min | LOW | P1 | 2 |
| H4 (placeholders) | 20 min | LOW | P1 | 3 |
| H5 (content mode) | 30 min | LOW | P1 | 3 |
| H8 (queue persist) | 2 hrs | MED | P1 | 4 |
| H9 (python auth) | 1 hr | MED | P1 | 4 |
| C1-FULL (3-layer) | 3 days | HIGH | P2 | 5 |

---

*Plan created: 2026-05-18*
*Ready for implementation*
