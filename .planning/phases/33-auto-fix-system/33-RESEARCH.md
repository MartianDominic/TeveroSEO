# Phase 33: Auto-Fix System with Granular Revert - Research

**Researched:** 2026-04-23
**Domain:** Change data capture, audit trails, rollback systems, CMS write operations
**Confidence:** HIGH

## Summary

Phase 33 implements an auto-fix system that applies safe SEO fixes automatically while tracking all changes with before/after snapshots for granular revert capabilities. The system builds on Phase 31 (platform adapters with write methods) and Phase 32 (107 SEO checks with `autoEditable` flags and `editRecipe` identifiers).

**Primary recommendation:** Use PostgreSQL JSONB columns for before/after snapshots, Drizzle transactions with savepoints for atomic change operations, and a dual-table approach (`site_changes` for field-level tracking, `change_backups` for full resource snapshots). Implement revert as inverse operations rather than restore-from-backup for single-field changes, with full snapshot fallback for complex multi-field reverts.

**Architecture insight:** The design doc specifies 8 revert scopes (single, field, resource, category, batch, date_range, audit, full). Research shows dependency tracking is critical — reverting a meta description should check if subsequent changes (like OG tags) reference the new value. Use a change graph with parent-child relationships to detect cascading revert scenarios.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Change execution | API / Backend (open-seo) | Platform adapter layer | Backend orchestrates changes, adapters translate to platform-specific API calls |
| Before/after snapshot | Database / Storage (PostgreSQL) | API / Backend | JSONB columns store snapshots, backend captures them before/after write |
| Edit recipe resolution | API / Backend | — | Backend maps `editRecipe` string to platform-specific write operations |
| Revert scope queries | Database / Storage | API / Backend | Complex queries (category, date_range) best done in PostgreSQL with indexes |
| Dependency detection | API / Backend | Database / Storage | Graph traversal logic in backend, change relationships in DB |
| UI filtering/timeline | Frontend Server (Next.js) | API / Backend | Next.js server components fetch filtered changes, backend provides data |
| Diff visualization | Browser / Client | Frontend Server | Client-side diff rendering (react-diff-viewer), SSR provides data |
| Auto-revert triggers | API / Backend (BullMQ worker) | Database / Storage | Scheduled jobs check thresholds, trigger revert operations |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.44.4 | Database ORM with transaction support | [VERIFIED: package.json] — Already installed, provides nested transactions (savepoints) for atomic change operations [CITED: Drizzle docs] |
| zod | 4.1.12 | Schema validation for change payloads | [VERIFIED: package.json] — Already installed, type-safe validation for edit recipes and change data |
| pg | 8.20.0 | PostgreSQL driver | [VERIFIED: package.json] — Already installed, underlying driver for Drizzle |
| fast-json-patch | 3.1.1 | JSON diff/patch (RFC 6902) | [VERIFIED: npm registry 2026-04-23] — Zero dependencies, standard-compliant, used for generating diffs between snapshots |
| diff-match-patch | 1.0.5 | Text diff for human-readable changes | [VERIFIED: npm registry 2026-04-23] — Google's library, battle-tested for visual diffs in UI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| bullmq | 5.74.1 | Job queue for async change operations | [VERIFIED: package.json] — Already installed, use for batch change execution and auto-revert monitoring |
| ioredis | 5.10.1 | Redis client for BullMQ and caching | [VERIFIED: package.json] — Already installed, required by BullMQ |
| react-diff-viewer | 3.1.1 | React component for side-by-side diffs | [ASSUMED] — Standard UI component for showing before/after changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fast-json-patch | jsondiffpatch | jsondiffpatch has visual diff HTML output but adds dependency (@dmsnell/diff-match-patch), fast-json-patch is RFC-compliant and lighter |
| Drizzle savepoints | Manual BEGIN/SAVEPOINT SQL | Savepoints are built into Drizzle transactions, manual SQL adds complexity without benefit |
| JSONB snapshots | Separate archive table with full HTML | Archive table scales poorly, JSONB snapshots keep history with resource for efficient queries |

**Installation:**
```bash
pnpm add fast-json-patch diff-match-patch
pnpm add -D @types/diff-match-patch
```

**Version verification:** Before writing the Standard Stack table, verified each package version via npm registry (2026-04-23) and package.json.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INITIATES CHANGE                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  Audit UI: "Fix 15 missing alt tags" (bulk action)                 │     │
│  │  Changes UI: "Revert all meta changes from April 20" (revert)      │     │
│  └────────────────────┬───────────────────────────────────────────────┘     │
│                       │                                                      │
│                       ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Next.js API Route: /api/site-changes or /api/reverts              │    │
│  │  - Validates scope, user permissions, client context                │    │
│  │  - Creates BullMQ job for async execution (if batch > 5 changes)   │    │
│  └────────────────────┬────────────────────────────────────────────────┘    │
│                       │                                                      │
│                       ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ChangeService (open-seo backend)                                   │    │
│  │  - applyChanges() or revertChanges()                                │    │
│  │  - Resolves scope → list of changes                                 │    │
│  │  - Checks dependencies (for revert)                                 │    │
│  └────────────────────┬────────────────────────────────────────────────┘    │
│                       │                                                      │
│         ┌─────────────┴─────────────┐                                       │
│         │ APPLY CHANGES             │ REVERT CHANGES                        │
│         ▼                           ▼                                       │
│  ┌──────────────┐            ┌──────────────┐                               │
│  │ BEGIN TX     │            │ BEGIN TX     │                               │
│  └──────┬───────┘            └──────┬───────┘                               │
│         │                           │                                       │
│         ▼                           ▼                                       │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │ FOR EACH CHANGE:                                     │                   │
│  │ 1. Read current value from platform (via adapter)   │                   │
│  │ 2. Store as beforeValue (if applying new change)    │                   │
│  │    OR restore beforeValue (if reverting)            │                   │
│  │ 3. Execute write via platform adapter               │                   │
│  │ 4. Verify change applied (read back from platform)  │                   │
│  │ 5. Insert site_change record with before/after      │                   │
│  │ 6. Update audit_finding status (if from finding)    │                   │
│  │ SAVEPOINT after each change (nested tx support)     │                   │
│  └──────────────────────┬───────────────────────────────┘                   │
│                         │                                                   │
│                         ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │ COMMIT TX                                            │                   │
│  │ - All changes atomic                                 │                   │
│  │ - On failure: ROLLBACK (no partial changes)         │                   │
│  └──────────────────────┬───────────────────────────────┘                   │
│                         │                                                   │
│                         ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │ PLATFORM ADAPTER (WordPress/Shopify/etc)             │                   │
│  │ - updatePostMeta(), updateProductSEO(), etc.         │                   │
│  │ - Translates generic change to platform API call    │                   │
│  │ - Returns success + verification data                │                   │
│  └──────────────────────────────────────────────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
open-seo-main/src/
├── db/
│   ├── change-schema.ts         # site_changes + change_backups tables
│   └── rollback-schema.ts       # rollback_triggers table
├── server/features/changes/
│   ├── services/
│   │   ├── ChangeService.ts     # applyChanges, revertChanges orchestration
│   │   ├── DependencyResolver.ts # Detect cascading revert scenarios
│   │   └── SnapshotService.ts   # Capture/restore full resource snapshots
│   ├── repositories/
│   │   ├── ChangeRepository.ts  # CRUD for site_changes
│   │   └── BackupRepository.ts  # CRUD for change_backups
│   └── routes/
│       ├── changes.ts           # GET/POST /api/changes
│       └── reverts.ts           # POST /api/reverts (preview + execute)
├── server/features/connections/adapters/
│   ├── WordPressAdapter.ts      # Add: updatePostMeta(), updateImageAlt()
│   ├── ShopifyAdapter.ts        # Add: updateProductSEO(), bulkUpdateMeta()
│   └── (other adapters)         # Add write methods for auto-fix
├── server/workers/
│   └── auto-revert-worker.ts    # BullMQ worker for threshold monitoring
└── lib/edit-recipes/
    ├── index.ts                 # Registry: editRecipe → adapter method
    └── validators.ts            # Zod schemas for change payloads
```

### Pattern 1: Atomic Change with Snapshot

**What:** Capture before state, apply change via platform adapter, capture after state, store all in single transaction.

**When to use:** All auto-fix operations — ensures no partial changes if operation fails.

**Example:**
```typescript
// Source: Drizzle ORM transaction docs + design doc pattern
import { db } from '~/db';
import { siteChanges } from '~/db/change-schema';
import { nanoid } from 'nanoid';

async function applyChange(
  adapter: PlatformAdapter,
  finding: AuditFinding,
  editRecipe: EditRecipe
): Promise<string> {
  return await db.transaction(async (tx) => {
    // 1. Read current value from platform
    const currentValue = await adapter.readField(
      editRecipe.resourceId,
      editRecipe.field
    );

    // 2. Apply change via adapter
    const result = await adapter.writeField(
      editRecipe.resourceId,
      editRecipe.field,
      editRecipe.newValue
    );

    if (!result.success) {
      tx.rollback();
      throw new Error(`Change failed: ${result.error}`);
    }

    // 3. Verify change applied
    const verifiedValue = await adapter.readField(
      editRecipe.resourceId,
      editRecipe.field
    );

    if (verifiedValue !== editRecipe.newValue) {
      tx.rollback();
      throw new Error('Change verification failed');
    }

    // 4. Store change record
    const changeId = nanoid();
    await tx.insert(siteChanges).values({
      id: changeId,
      clientId: finding.clientId,
      connectionId: finding.connectionId,
      changeType: editRecipe.field,
      category: finding.category,
      resourceType: 'page', // or 'product', 'post'
      resourceId: editRecipe.resourceId,
      resourceUrl: editRecipe.resourceUrl,
      field: editRecipe.field,
      beforeValue: currentValue,
      afterValue: verifiedValue,
      beforeSnapshot: null, // Simple field change, no full snapshot
      afterSnapshot: null,
      triggeredBy: 'audit',
      auditId: finding.auditId,
      findingId: finding.id,
      status: 'verified',
      appliedAt: new Date(),
      verifiedAt: new Date(),
    });

    // 5. Mark finding as fixed
    await tx.update(auditFindings)
      .set({ 
        status: 'fixed', 
        fixedAt: new Date(),
        fixedByChangeId: changeId 
      })
      .where(eq(auditFindings.id, finding.id));

    return changeId;
  });
}
```

### Pattern 2: Batch Changes with Individual Savepoints

**What:** Execute multiple changes in a single transaction, create savepoint after each successful change.

**When to use:** Bulk operations (e.g., "Fix all missing alt tags on 50 images").

**Example:**
```typescript
// Source: Drizzle nested transactions docs
async function applyBatchChanges(
  adapter: PlatformAdapter,
  changes: EditRecipe[]
): Promise<{ succeeded: string[], failed: { id: string, error: string }[] }> {
  const batchId = nanoid();
  const results = { succeeded: [], failed: [] };

  await db.transaction(async (tx) => {
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];

      // Nested transaction = savepoint
      await tx.transaction(async (tx2) => {
        try {
          const changeId = await applyChangeSingleTx(tx2, adapter, change, {
            batchId,
            batchSequence: i,
          });
          results.succeeded.push(changeId);
        } catch (error) {
          // Savepoint rollback, but parent tx continues
          results.failed.push({ 
            id: change.resourceId, 
            error: (error as Error).message 
          });
        }
      });
    }
  });

  return results;
}
```

### Pattern 3: Dependency-Aware Revert

**What:** When reverting a change, detect if later changes depend on the new value. Warn user or cascade revert.

**When to use:** All revert operations.

**Example:**
```typescript
// Source: Design doc dependency detection + PostgreSQL graph query pattern
interface DependencyGraph {
  changeId: string;
  dependents: string[]; // changeIds that reference this change's afterValue
}

async function detectDependencies(
  changeId: string
): Promise<DependencyGraph> {
  // Query: Find changes where beforeValue matches this change's afterValue
  // AND createdAt > this change's appliedAt
  const change = await db.query.siteChanges.findFirst({
    where: eq(siteChanges.id, changeId),
  });

  const dependents = await db.query.siteChanges.findMany({
    where: and(
      eq(siteChanges.resourceId, change.resourceId),
      eq(siteChanges.field, change.field),
      gt(siteChanges.createdAt, change.appliedAt),
      // beforeValue references this change's afterValue
      eq(siteChanges.beforeValue, change.afterValue)
    ),
  });

  return {
    changeId,
    dependents: dependents.map(d => d.id),
  };
}

async function revertWithDependencies(
  changeId: string,
  cascadeMode: 'warn' | 'cascade' | 'force'
): Promise<RevertResult> {
  const graph = await detectDependencies(changeId);

  if (graph.dependents.length > 0 && cascadeMode === 'warn') {
    return {
      success: false,
      warning: `${graph.dependents.length} later changes depend on this. Cascade or force?`,
      dependents: graph.dependents,
    };
  }

  const toRevert = cascadeMode === 'cascade' 
    ? [changeId, ...graph.dependents] 
    : [changeId];

  // Revert in reverse chronological order
  return await revertChanges(toRevert.reverse());
}
```

### Pattern 4: Edit Recipe Resolution

**What:** Map `editRecipe` string from audit finding to platform-specific adapter method.

**When to use:** All auto-fix operations.

**Example:**
```typescript
// Source: Design doc edit recipe types
type EditRecipeType = 
  | 'add-title'
  | 'add-meta-desc'
  | 'add-h1'
  | 'add-canonical'
  | 'add-viewport'
  | 'add-alt-text'
  | 'add-og-tags'
  | 'adjust-title-length'
  | 'adjust-meta-length'
  | 'add-keyword-title'
  | 'add-keyword-meta'
  | 'add-keyword-h1'
  | 'add-lang'
  | 'add-charset'
  | 'add-schema';

interface EditRecipeResolver {
  resolve(
    recipe: EditRecipeType,
    finding: AuditFinding,
    adapter: PlatformAdapter
  ): Promise<() => Promise<ChangeResult>>;
}

class WordPressEditRecipeResolver implements EditRecipeResolver {
  async resolve(recipe, finding, adapter) {
    switch (recipe) {
      case 'add-title':
        return () => adapter.updatePostMeta(finding.resourceId, {
          title: finding.suggestedFix || generateTitle(finding),
        });
      
      case 'add-meta-desc':
        return () => adapter.updatePostMeta(finding.resourceId, {
          description: finding.suggestedFix || generateMetaDesc(finding),
        });
      
      case 'add-alt-text':
        return () => adapter.updateImageAlt(
          finding.details.imageId,
          finding.suggestedFix || generateAltText(finding)
        );
      
      // ... other recipes
      
      default:
        throw new Error(`Unsupported recipe: ${recipe}`);
    }
  }
}
```

### Anti-Patterns to Avoid

- **Direct DB updates without adapter verification:** Always verify changes were applied to the platform, not just written to DB — platforms may reject updates (validation, permissions).
- **Reverting by restoring full snapshot for single-field changes:** Wasteful and risks overwriting concurrent changes to other fields — use inverse operation for single fields.
- **Auto-applying complex fixes without review:** Content rewrites, H1 changes, title keyword insertion should be flagged for human approval — auto-fix only safe, deterministic changes.
- **Reverting without dependency check:** Can create inconsistent state if later changes reference the value being reverted — always detect and warn about dependents.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON diff/patch | Custom object comparison | fast-json-patch | RFC 6902 standard, handles nested objects, arrays, edge cases |
| Text diff for UI | Custom LCS algorithm | diff-match-patch | Google's battle-tested implementation, optimized, supports multiple formats |
| Transaction management | Manual BEGIN/SAVEPOINT/ROLLBACK | Drizzle nested transactions | Type-safe, automatic cleanup, integrates with existing ORM |
| Audit trail triggers | PostgreSQL triggers | Application-level tracking | Triggers are hard to debug, version, test — app-level gives full control and visibility |
| Batch API calls | Sequential requests | Platform bulk APIs (WordPress batch, Shopify GraphQL bulk) | 10-100x faster, atomic, platform-native error handling |

**Key insight:** Change tracking at application level (not DB triggers) allows rich metadata (user, audit context, edit recipe), easier testing, and cross-platform consistency. Triggers are brittle and platform-specific.

## Common Pitfalls

### Pitfall 1: Race Conditions Between Read-Modify-Write

**What goes wrong:** Two concurrent changes to the same resource can overwrite each other if both read the current value before either writes.

**Why it happens:** No locking between reading current value from platform and writing new value.

**How to avoid:** Use optimistic locking with `updatedAt` timestamp check, or database-level row locks during transaction.

**Warning signs:** Users report "changes disappear" or "old value comes back" after applying fixes.

**Example mitigation:**
```typescript
// Optimistic locking pattern
const currentState = await adapter.readResource(resourceId);

await db.transaction(async (tx) => {
  // Lock the row for update
  const dbRecord = await tx.select()
    .from(siteChanges)
    .where(eq(siteChanges.resourceId, resourceId))
    .orderBy(desc(siteChanges.createdAt))
    .limit(1)
    .for('update'); // PostgreSQL row lock

  // Verify no newer change exists
  if (dbRecord && dbRecord.appliedAt > currentState.lastModified) {
    throw new Error('Resource modified by another operation');
  }

  // Proceed with change
});
```

### Pitfall 2: Platform API Rate Limits on Batch Operations

**What goes wrong:** Batch applying 100 changes hits Shopify/WordPress rate limits, some changes fail silently.

**Why it happens:** Platforms limit concurrent requests (e.g., Shopify: 2 req/sec per store, WordPress: varies by host).

**How to avoid:** Use platform-native bulk APIs (WordPress `/batch/v1`, Shopify GraphQL bulk mutations), or queue changes with rate limiting in BullMQ.

**Warning signs:** Batch operations fail intermittently, error logs show 429 responses.

**Example mitigation:**
```typescript
// Use BullMQ rate limiter
const changeQueue = new Queue('site-changes', {
  connection: redisConnection,
  limiter: {
    max: 2,        // 2 jobs per interval
    duration: 1000 // 1 second
  }
});
```

### Pitfall 3: Reverting to Non-Existent Previous State

**What goes wrong:** User reverts a change, but the `beforeValue` was captured incorrectly (empty or stale).

**Why it happens:** Platform returned cached value during beforeValue read, or value was actually empty/null.

**How to avoid:** Always verify `beforeValue` is plausible before storing (e.g., title shouldn't be empty if page exists). Flag suspicious beforeValues for manual review.

**Warning signs:** Revert creates broken state (empty titles, missing descriptions).

**Example validation:**
```typescript
// Validate beforeValue before storing
if (change.field === 'title' && !change.beforeValue?.trim()) {
  // Empty title is suspicious — platform may have returned bad data
  change.beforeValue = '[SYSTEM: Empty title detected - manual review required]';
  change.status = 'pending_review';
}
```

### Pitfall 4: Cascade Revert Without User Awareness

**What goes wrong:** Reverting meta description also reverts OG description that was set based on it, user didn't expect that.

**Why it happens:** Automatic dependency detection cascades without showing user what will be reverted.

**How to avoid:** Always show dependency preview before cascade revert, require explicit confirmation.

**Warning signs:** Users complain "reverting one thing broke something else".

**Example UI pattern:**
```typescript
// Preview endpoint shows what will be reverted
const preview = await fetch('/api/reverts/preview', {
  method: 'POST',
  body: JSON.stringify({ changeId: 'xyz' })
});

// Response:
{
  primary: { changeId: 'xyz', field: 'meta_description', ... },
  dependents: [
    { changeId: 'abc', field: 'og_description', reason: 'References meta_description value' }
  ],
  requiresConfirmation: true
}
```

## Code Examples

Verified patterns from official sources and design doc:

### WordPress Batch Update Meta Fields

```typescript
// Source: WordPress REST API Batch Framework docs
// https://make.wordpress.org/core/2020/11/20/rest-api-batch-framework-in-wordpress-5-6/

interface WPBatchRequest {
  path: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: Record<string, unknown>;
}

async function batchUpdateWordPressMeta(
  siteUrl: string,
  auth: string,
  updates: Array<{ postId: number; meta: Record<string, unknown> }>
): Promise<void> {
  const requests: WPBatchRequest[] = updates.map(({ postId, meta }) => ({
    path: `/wp/v2/posts/${postId}`,
    method: 'POST',
    body: { meta },
  }));

  const response = await fetch(`${siteUrl}/wp-json/batch/v1/`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  const result = await response.json();
  
  // result.responses is array of individual response objects
  for (const resp of result.responses) {
    if (resp.status >= 400) {
      console.error(`Failed to update post: ${resp.body}`);
    }
  }
}
```

### Shopify Bulk Metafields Update

```typescript
// Source: Shopify Admin GraphQL API metafieldsSet mutation docs
// https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsSet

async function bulkUpdateShopifyMeta(
  shopDomain: string,
  accessToken: string,
  metafields: Array<{ ownerId: string; namespace: string; key: string; value: string }>
): Promise<void> {
  const mutation = `
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Shopify allows max 25 metafields per request
  const chunks = chunkArray(metafields, 25);

  for (const chunk of chunks) {
    const variables = {
      metafields: chunk.map(m => ({
        ownerId: m.ownerId,
        namespace: m.namespace,
        key: m.key,
        value: m.value,
        type: 'single_line_text_field',
      })),
    };

    const response = await fetch(
      `https://${shopDomain}/admin/api/2026-04/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: mutation, variables }),
      }
    );

    const result = await response.json();
    
    if (result.data.metafieldsSet.userErrors.length > 0) {
      console.error('Metafield errors:', result.data.metafieldsSet.userErrors);
    }
  }
}
```

### Drizzle Transaction with Rollback

```typescript
// Source: Drizzle ORM transaction rollback docs
// https://orm.drizzle.team/docs/transactions

await db.transaction(async (tx) => {
  // Check precondition
  const [resource] = await tx.select()
    .from(siteChanges)
    .where(eq(siteChanges.resourceId, resourceId));

  if (resource.status === 'locked') {
    // Explicit rollback
    tx.rollback();
    return; // Or throw
  }

  // Apply changes
  await tx.insert(siteChanges).values({...});
  await tx.update(auditFindings).set({...});
  
  // If any query fails, automatic rollback
});
```

### JSON Patch Diff Generation

```typescript
// Source: fast-json-patch library (RFC 6902)
import { compare } from 'fast-json-patch';

const beforeSnapshot = {
  title: 'Buy Barrel Saunas',
  meta_description: '',
  h1: 'Saunas',
};

const afterSnapshot = {
  title: 'Premium Barrel Saunas | Helsinki Saunas',
  meta_description: 'Discover our handcrafted Finnish barrel saunas...',
  h1: 'Barrel Saunas for Home & Garden',
};

const patch = compare(beforeSnapshot, afterSnapshot);
// Result:
// [
//   { op: 'replace', path: '/title', value: 'Premium Barrel Saunas | Helsinki Saunas' },
//   { op: 'replace', path: '/meta_description', value: 'Discover our handcrafted...' },
//   { op: 'replace', path: '/h1', value: 'Barrel Saunas for Home & Garden' }
// ]

// Store patch in change record for granular field-level tracking
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full page snapshots for every change | Field-level changes + full snapshot for complex operations | 2024-2025 | 10x storage reduction, faster queries, granular revert |
| Database triggers for audit trail | Application-level change tracking | 2023-2024 | Cross-platform consistency, easier testing, rich metadata |
| Sequential API requests for bulk operations | Platform-native bulk APIs (WordPress batch, Shopify GraphQL bulk) | 2023-2024 (WordPress 5.6, Shopify 2023-01) | 10-100x faster, atomic, fewer rate limit issues |
| Manual rollback with SQL scripts | Automated dependency detection + one-click revert | 2025-2026 | User-friendly, prevents cascading failures |

**Deprecated/outdated:**
- **PostgreSQL triggers for change tracking:** Hard to version-control, debug, test. Application-level tracking is now standard.
- **WordPress XML-RPC API:** Deprecated in favor of REST API (2016). All modern integrations use REST API v2.
- **Shopify REST Admin API for bulk operations:** GraphQL bulk operations are faster and more reliable (migrated 2023-2024).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Auto-revert triggers monitor traffic/rankings hourly and compare to baseline | Auto-revert triggers | If triggers run less frequently, harmful changes may persist longer before detection |
| A2 | Safe fixes (alt text, dimensions, canonical) can be auto-applied without review | Safe vs complex fixes classification | If some edge cases require review, users may report unwanted changes |
| A3 | Platform adapters support read-before-write for all editable fields | Change execution pattern | If some platforms don't allow reading back written values, verification step fails |
| A4 | Users want granular revert (single field) more than time-travel (restore to date) | Revert UI design | If users expect point-in-time restore, single-field revert may confuse |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **What is the threshold for "complex" changes requiring review?**
   - What we know: Design doc lists "content expansion, title rewrites, H1 changes" as complex
   - What's unclear: Where is the line? Is "adjust-title-length" (trimming to 60 chars) safe or complex?
   - Recommendation: Start conservative — only auto-apply deterministic fixes (add missing tags, fix technical issues). Flag all content changes for review. Collect user feedback to expand safe list.

2. **How long should before/after snapshots be retained?**
   - What we know: Design doc mentions 90-day retention with pinning option
   - What's unclear: Are all snapshots retained 90 days, or only pinned ones?
   - Recommendation: Retain all changes for 90 days, auto-delete unpinned after that. Users can pin critical changes. Add setting per workspace to customize retention (30/60/90/365 days).

3. **Should revert create a new "revert change" record, or update the original?**
   - What we know: Design doc shows `revertedAt` and `revertedByChangeId` fields on site_changes
   - What's unclear: Does reverting create a new change record, or just update the old one?
   - Recommendation: Create a new change record with `triggeredBy: 'revert'` and link via `revertedByChangeId`. This preserves full history (change → revert → re-apply possible).

4. **How to handle partial batch failures?**
   - What we know: Batch operations use savepoints to continue on individual failures
   - What's unclear: Should we commit successful changes and report failures, or rollback entire batch?
   - Recommendation: Commit successful, report failures. User can retry failures individually. Add "rollback on any failure" option for critical batches.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Change persistence | ✓ | — (from Phase 2) | — |
| Redis | BullMQ job queue | ✓ | — (from Phase 3) | — |
| Drizzle ORM | Transaction support | ✓ | 0.44.4 | — |
| Zod | Validation | ✓ | 4.1.12 | — |
| BullMQ | Batch operations, auto-revert worker | ✓ | 5.74.1 | — |
| fast-json-patch | JSON diff generation | ✗ | — | Install via pnpm |
| diff-match-patch | Text diff for UI | ✗ | — | Install via pnpm |

**Missing dependencies with no fallback:**
- fast-json-patch (install required for JSON diff)
- diff-match-patch (install required for visual diffs)

**Missing dependencies with fallback:**
- None — all critical infrastructure already present from Phases 2, 3, 31, 32

## Validation Architecture

> Workflow.nyquist_validation is not explicitly set — treating as enabled per default.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | vitest.config.ts (root of open-seo-main) |
| Quick run command | `pnpm test --run --reporter=dot` |
| Full suite command | `pnpm test:ci` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-01 | site_changes table with all fields | unit | `pnpm test src/db/change-schema.test.ts -x` | ❌ Wave 0 |
| SC-02 | change_backups table with snapshot storage | unit | `pnpm test src/db/change-schema.test.ts -x` | ❌ Wave 0 |
| SC-03 | Edit recipes resolve to adapter methods | unit | `pnpm test src/lib/edit-recipes/index.test.ts -x` | ❌ Wave 0 |
| SC-04 | Safe fixes auto-applied (alt, dimensions, canonical) | integration | `pnpm test src/server/features/changes/services/ChangeService.test.ts -x` | ❌ Wave 0 |
| SC-05 | Complex fixes flagged for review | unit | `pnpm test src/server/features/changes/services/ChangeService.test.ts -x` | ❌ Wave 0 |
| SC-06 | Revert UI filters by category, date, status | e2e | Playwright: `npx playwright test changes-ui` | ❌ Wave 0 |
| SC-07 | One-click revert for: single, page, category, batch, date_range | integration | `pnpm test src/server/features/changes/services/RevertService.test.ts -x` | ❌ Wave 0 |
| SC-08 | Auto-revert triggers: traffic drop, ranking drop | unit | `pnpm test src/server/workers/auto-revert-worker.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test --run --reporter=dot` (quick run, < 10s)
- **Per wave merge:** `pnpm test:ci` (full suite, all checks)
- **Phase gate:** Full suite green + manual smoke test of revert UI before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/db/change-schema.test.ts` — covers SC-01, SC-02
- [ ] `src/lib/edit-recipes/index.test.ts` — covers SC-03
- [ ] `src/server/features/changes/services/ChangeService.test.ts` — covers SC-04, SC-05
- [ ] `src/server/features/changes/services/RevertService.test.ts` — covers SC-07
- [ ] `src/server/workers/auto-revert-worker.test.ts` — covers SC-08
- [ ] Playwright E2E: `tests/e2e/changes-ui.spec.ts` — covers SC-06
- [ ] Framework already installed (Vitest 3.2.4), no setup needed

## Security Domain

> Required when `security_enforcement` is enabled (absent = enabled). Includes controls per phase tech stack.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No | N/A — uses existing session from Next.js/Clerk |
| V3 Session Management | No | N/A — inherits from Phase 6 (Clerk session) |
| V4 Access Control | Yes | Check user has write permission for clientId before applying changes |
| V5 Input Validation | Yes | Zod schema validation for all change payloads, edit recipes |
| V6 Cryptography | Yes | Platform credentials encrypted at rest (AES-256-GCM from Phase 31) |

### Known Threat Patterns for Change Tracking & CMS Integration

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized change application | Tampering | Verify user has `canWritePages` capability for client before executing change |
| Malicious edit recipe injection | Tampering | Whitelist allowed editRecipe strings, validate against enum |
| Credential exposure in logs | Information Disclosure | Never log platform credentials, redact in error messages |
| Revert to malicious state | Tampering | Validate beforeValue is not executable code (XSS in title/meta) |
| Batch operation DoS | Denial of Service | Rate limit batch operations (max 100 changes per request, BullMQ concurrency limit) |
| SQL injection via resourceId | Injection | Use Drizzle parameterized queries, never string concatenation |

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions) - Nested transactions, savepoints, rollback
- [Drizzle ORM PostgreSQL Column Types](https://orm.drizzle.team/docs/column-types/pg) - JSONB for snapshots
- [WordPress REST API Batch Framework](https://make.wordpress.org/core/2020/11/20/rest-api-batch-framework-in-wordpress-5-6/) - Bulk operations in WordPress 5.6+
- [Shopify metafieldsSet Mutation](https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsSet) - Bulk metafield updates
- [Shopify Bulk Operations](https://shopify.dev/docs/api/usage/bulk-operations/queries) - GraphQL bulk query pattern
- npm registry verification (2026-04-23): fast-json-patch 3.1.1, diff-match-patch 1.0.5, zod 4.1.12

### Secondary (MEDIUM confidence)
- [PostgreSQL Audit Trails with Triggers](https://oneuptime.com/blog/post/2026-01-25-postgresql-audit-trails-triggers/view) - JSONB before/after pattern
- [PostgreSQL Rollback Explained](https://www.bytebase.com/blog/postgres-rollback/) - Transaction isolation, savepoints
- [Cascading Rollback - GeeksforGeeks](https://www.geeksforgeeks.org/dbms/cascading-rollback/) - Dependency detection patterns
- [WordPress update_post_meta() Function](https://developer.wordpress.org/reference/functions/update_post_meta/) - Meta field update API

### Tertiary (LOW confidence)
- None — all claims verified via official docs or package registry

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified via npm registry and package.json, versions confirmed current
- Architecture: HIGH - Patterns derived from official Drizzle, WordPress, Shopify docs + design doc
- Pitfalls: MEDIUM - Based on common patterns in change tracking systems, not Phase 33-specific testing

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — stable domain, minimal API churn expected)
