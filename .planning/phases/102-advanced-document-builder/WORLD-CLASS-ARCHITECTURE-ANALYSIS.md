# Phase 102: World-Class Architecture Analysis

> **Premise:** AI codes 100x faster. Development time is NOT a constraint. The only questions are: What is the architecturally correct solution? What scales to 10,000+ prospects/month? What creates a defensible platform?

**Created:** 2026-05-15
**Status:** Architecture-First Analysis
**Supersedes:** Time-biased recommendations in BLOCKING-DECISION-ANALYSIS.md

---

## The Reframed Problem

### Old Framing (Rejected)
> "How do we ship something quickly that works well enough?"

### New Framing (Adopted)
> "If we could build anything, what would the world-class proposal platform look like — one that handles 10,000+ prospects/month, enables A/B testing at statistical significance, provides real-time collaboration, and becomes the operating system for agency sales?"

### Constraints Removed
- ~~"Too complex to build"~~ — AI handles complexity
- ~~"Takes too long"~~ — Time is not the bottleneck
- ~~"Maintenance burden"~~ — Proper architecture reduces maintenance
- ~~"Over-engineering"~~ — Under-engineering at scale is technical debt

### Constraints Retained
- Must be operationally excellent (observable, debuggable)
- Must be cost-efficient at scale (not burning money on infra)
- Must provide excellent UX (complexity hidden from users)
- Must integrate with existing TeveroSEO ecosystem

---

## Ten World-Class Expert Perspectives

### Expert 1: Distributed Systems Architect (Ex-Google, Spanner Team)

```xml
<expert 
  role="distributed-systems-architect" 
  background="15 years at Google, led Spanner regional deployment, now consulting for high-scale startups"
  mindset="correctness-first, then performance">
  
  <context>
    You're designing a proposal system that must handle:
    - 10,000+ proposals created/month
    - 100,000+ prospect views/month  
    - Real-time analytics (which section is being read NOW)
    - Multi-region deployment (EU data residency for GDPR)
    - 99.9% availability for public proposal views
  </context>
  
  <analysis>
    <section name="consistency-model">
      Proposals have interesting consistency requirements:
      
      STRONG CONSISTENCY needed for:
      - Proposal content edits (can't lose user work)
      - Publishing state (is this live or draft?)
      - Payment/agreement status
      
      EVENTUAL CONSISTENCY acceptable for:
      - View counts
      - Analytics aggregations
      - A/B test assignments (deterministic hash makes this safe)
      
      This suggests a CQRS architecture:
      - Write path: Single leader, synchronous replication
      - Read path: Read replicas, edge caching, eventual consistency OK
    </section>
    
    <section name="data-partitioning">
      Natural partition key: organization_id (tenant)
      
      This gives us:
      - All proposals for one org on same partition
      - Cross-org queries rare (admin dashboards only)
      - Easy horizontal scaling (add partitions as orgs grow)
      - Data locality for GDPR (EU orgs on EU partitions)
      
      Secondary index on: magic_link_token (for public access)
      - This is a global index, but read-only and cacheable
    </section>
    
    <section name="failure-modes">
      What happens when things break?
      
      Database unavailable:
      - Public views: Serve from edge cache (stale OK for minutes)
      - Edits: Queue locally, sync when restored (optimistic UI)
      - Publishing: Block until confirmed (critical path)
      
      Analytics pipeline down:
      - Views still work (analytics is fire-and-forget)
      - Buffer events in Redis, replay when restored
      - Never block user experience for analytics
      
      PDF generation fails:
      - Retry with exponential backoff
      - Notify user after 3 failures
      - Provide "regenerate" button
    </section>
  </analysis>
  
  <architecture>
    ```
    ┌─────────────────────────────────────────────────────────────────┐
    │                        EDGE LAYER                               │
    │  Cloudflare/Vercel Edge: Cache public proposals, geo-routing   │
    └─────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
    ┌───────────────────────────┐   ┌───────────────────────────────┐
    │      READ PATH            │   │       WRITE PATH              │
    │                           │   │                               │
    │  - Public proposal view   │   │  - Create/edit proposal       │
    │  - Template browsing      │   │  - Publish/unpublish          │
    │  - Analytics dashboards   │   │  - A/B test configuration     │
    │                           │   │                               │
    │  Read replicas            │   │  Primary database             │
    │  Redis cache              │   │  Event log                    │
    │  CDN for static assets    │   │  Outbox pattern for events    │
    └───────────────────────────┘   └───────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                    ASYNC PROCESSING                             │
    │                                                                 │
    │  BullMQ Workers:                                               │
    │  - PDF generation (isolated, can OOM without affecting app)    │
    │  - Analytics aggregation (batch processing)                    │
    │  - Email notifications                                         │
    │  - Webhook delivery                                            │
    └─────────────────────────────────────────────────────────────────┘
    ```
  </architecture>
  
  <recommendations>
    1. Use PostgreSQL with logical replication for read scaling
    2. Implement event sourcing for proposal changes (audit + undo)
    3. Edge cache public proposals with 60s TTL, purge on publish
    4. Partition analytics data by time (daily tables, auto-archive)
    5. Use deterministic hashing for A/B assignment (no database lookup)
  </recommendations>
  
  <anti-patterns>
    - DON'T use distributed transactions across services
    - DON'T make analytics synchronous with user actions
    - DON'T store binary blobs (PDFs) in primary database
    - DON'T poll for real-time updates (use WebSockets/SSE)
  </anti-patterns>
</expert>
```

### Expert 2: Event Sourcing & CQRS Specialist (Author of "Implementing Domain-Driven Design")

```xml
<expert
  role="event-sourcing-specialist"
  background="20 years in enterprise architecture, wrote the book on DDD implementation, consulted for financial systems requiring full audit trails"
  mindset="model-the-domain-correctly-and-scale-follows">
  
  <context>
    Proposals are documents that evolve over time. Users need to:
    - See version history
    - Undo changes
    - Compare versions (diff)
    - Know exactly what a prospect saw
    - A/B test with attribution (which version converted?)
    
    This is a textbook case for event sourcing.
  </context>
  
  <domain-model>
    <aggregate name="Proposal">
      The Proposal is the aggregate root. It contains blocks, but blocks
      are not independent aggregates — they only exist within a proposal.
      
      Identity: proposal_id (UUID)
      
      Invariants:
      - A proposal must have at least one block
      - Block positions must be contiguous (no gaps)
      - Only one version can be "published" at a time
      - A/B variants must sum to 100% traffic allocation
    </aggregate>
    
    <events>
      // Lifecycle events
      ProposalCreated { proposal_id, organization_id, template_id?, created_by, timestamp }
      ProposalPublished { proposal_id, version, magic_link, published_by, timestamp }
      ProposalUnpublished { proposal_id, unpublished_by, timestamp }
      ProposalArchived { proposal_id, archived_by, timestamp }
      
      // Block events
      BlockAdded { proposal_id, block_id, block_type, position, initial_content, timestamp }
      BlockContentUpdated { proposal_id, block_id, field_path, old_value, new_value, updated_by, timestamp }
      BlockMoved { proposal_id, block_id, old_position, new_position, timestamp }
      BlockRemoved { proposal_id, block_id, removed_by, timestamp }
      
      // A/B testing events
      VariantCreated { proposal_id, block_id, variant_id, content, traffic_percentage, timestamp }
      VariantUpdated { proposal_id, block_id, variant_id, field_path, old_value, new_value, timestamp }
      VariantTrafficChanged { proposal_id, block_id, variant_allocations: Map<variant_id, percentage>, timestamp }
      VariantWinnerDeclared { proposal_id, block_id, winning_variant_id, declared_by, timestamp }
      
      // Variable events
      VariableSet { proposal_id, variable_name, value, timestamp }
      VariableUnset { proposal_id, variable_name, timestamp }
      
      // Prospect binding events
      ProspectLinked { proposal_id, prospect_id, timestamp }
      ProspectDataRefreshed { proposal_id, prospect_id, refreshed_fields: string[], timestamp }
    </events>
    
    <projections>
      // Current state projection (for editing)
      ProposalCurrentState = fold(events) → {
        id, status, blocks: Block[], variables: Map, published_version?, ...
      }
      
      // Version history projection (for history view)
      ProposalVersionHistory = events.filter(e => e.type === 'ProposalPublished')
        .map(e => ({ version: e.version, published_at: e.timestamp, published_by: e.published_by }))
      
      // Block change history projection (for diff view)
      BlockChangeHistory(block_id) = events
        .filter(e => e.block_id === block_id)
        .map(e => ({ type: e.type, timestamp: e.timestamp, changes: extractChanges(e) }))
      
      // A/B test results projection (for analytics)
      ABTestResults(block_id) = {
        variants: Map<variant_id, { views, conversions, revenue }>,
        statistical_significance: calculateSignificance(variants),
        recommended_winner: variants.maxBy(v => v.conversion_rate)
      }
    </projections>
  </domain-model>
  
  <implementation>
    <event-store>
      PostgreSQL with events table:
      
      CREATE TABLE proposal_events (
        event_id UUID PRIMARY KEY,
        proposal_id UUID NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB NOT NULL,
        metadata JSONB NOT NULL, -- { user_id, correlation_id, causation_id }
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        -- For efficient replay
        sequence_number BIGSERIAL,
        
        -- Partition by proposal for efficient single-aggregate queries
        CONSTRAINT proposal_events_pk PRIMARY KEY (proposal_id, sequence_number)
      ) PARTITION BY HASH (proposal_id);
      
      -- Create 16 partitions for parallelism
      CREATE TABLE proposal_events_0 PARTITION OF proposal_events FOR VALUES WITH (MODULUS 16, REMAINDER 0);
      -- ... repeat for 1-15
      
      -- Index for cross-proposal queries (admin, analytics)
      CREATE INDEX proposal_events_by_time ON proposal_events (created_at DESC);
      CREATE INDEX proposal_events_by_type ON proposal_events (event_type, created_at DESC);
    </event-store>
    
    <snapshot-strategy>
      Problem: Replaying 1000 events for every read is slow.
      
      Solution: Snapshot every N events or T time.
      
      CREATE TABLE proposal_snapshots (
        proposal_id UUID NOT NULL,
        snapshot_version BIGINT NOT NULL, -- sequence_number at snapshot time
        state JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (proposal_id, snapshot_version)
      );
      
      Loading algorithm:
      1. Load latest snapshot (if exists)
      2. Replay events after snapshot_version
      3. If events_since_snapshot > 100, create new snapshot async
      
      Snapshot frequency: Every 100 events OR every 24 hours
    </snapshot-strategy>
    
    <optimistic-concurrency>
      When saving events:
      
      async function saveEvents(proposalId, expectedVersion, newEvents) {
        const currentVersion = await getLatestSequenceNumber(proposalId);
        
        if (currentVersion !== expectedVersion) {
          throw new ConcurrencyConflict({
            expected: expectedVersion,
            actual: currentVersion,
            events: await getEventsSince(proposalId, expectedVersion)
          });
        }
        
        await appendEvents(proposalId, newEvents);
      }
      
      On conflict: Reload state, re-validate command, retry or notify user.
    </optimistic-concurrency>
  </implementation>
  
  <benefits>
    1. COMPLETE AUDIT TRAIL — Every change is recorded forever
    2. TIME TRAVEL — Reconstruct proposal state at any point in time
    3. UNDO/REDO — Trivial to implement (replay without last event, or replay undone event)
    4. A/B ATTRIBUTION — Know exactly which version a prospect saw
    5. DEBUGGING — "What happened?" is always answerable
    6. ANALYTICS — Events are the raw data for any metric
    7. COMPLIANCE — GDPR "right to know what data" is just event export
  </benefits>
  
  <cautions>
    1. Event schema evolution requires care (use versioned event types)
    2. Projections must be idempotent (same events → same state)
    3. Don't put derived data in events (that's what projections are for)
    4. Global ordering is expensive — only order within aggregate
  </cautions>
</expert>
```

### Expert 3: React Performance Architect (Ex-Meta, React Core Team Adjacent)

```xml
<expert
  role="react-performance-architect"
  background="8 years at Meta working on React and Relay, now technical lead for a high-traffic SaaS dashboard"
  mindset="measure-first-optimize-where-it-matters">

  <context>
    The proposal builder has two very different rendering contexts:
    
    1. EDITOR: Complex, interactive, single user, can be slower
       - Block editing with forms
       - Drag-and-drop reordering
       - Real-time preview
       - Undo/redo
    
    2. PUBLIC VIEW: Simple, read-only, must be FAST
       - Prospect views proposal via magic link
       - First paint must be <1 second
       - Needs to work on slow mobile connections
       - Analytics tracking must not block rendering
  </context>
  
  <architecture>
    <principle name="islands-architecture">
      The proposal view is mostly static content with small interactive islands.
      
      Static (server-rendered, cached):
      - All text content
      - Images
      - Pricing tables
      - Process diagrams
      
      Interactive islands (client-hydrated):
      - Accept/Decline buttons
      - Scroll tracking (analytics)
      - Video embeds (lazy-loaded)
      - Interactive calculators (if any)
      
      Implementation: Next.js App Router with selective hydration
      
      // Static by default
      export default async function ProposalPage({ params }) {
        const proposal = await getPublishedProposal(params.token);
        return <ProposalRenderer proposal={proposal} />;
      }
      
      // Interactive islands marked explicitly
      'use client';
      export function AcceptDeclineButtons({ proposalId }) {
        // Only this component hydrates on client
      }
    </principle>
    
    <principle name="streaming-ssr">
      For the editor, use streaming SSR to show UI progressively:
      
      1. Shell loads instantly (navigation, sidebar)
      2. Block list streams in as data loads
      3. Heavy components (preview, analytics) load last
      
      Implementation with Suspense boundaries:
      
      export default function EditorPage({ params }) {
        return (
          <EditorShell>
            <Suspense fallback={<BlockListSkeleton />}>
              <BlockList proposalId={params.id} />
            </Suspense>
            <Suspense fallback={<PreviewSkeleton />}>
              <ProposalPreview proposalId={params.id} />
            </Suspense>
          </EditorShell>
        );
      }
    </principle>
    
    <principle name="optimistic-updates">
      Every edit should feel instant. Don't wait for server confirmation.
      
      Pattern: Optimistic update → Background save → Reconcile on conflict
      
      function useBlockEdit(proposalId, blockId) {
        const [optimisticState, setOptimisticState] = useState(null);
        const { data: serverState } = useProposalQuery(proposalId);
        
        const updateBlock = useMutation({
          mutationFn: (changes) => api.updateBlock(proposalId, blockId, changes),
          onMutate: (changes) => {
            // Immediately show change
            setOptimisticState(prev => ({ ...prev, ...changes }));
          },
          onError: (error, variables, context) => {
            // Revert on failure
            setOptimisticState(null);
            toast.error('Failed to save. Your changes have been reverted.');
          },
          onSuccess: () => {
            // Clear optimistic state, server state takes over
            setOptimisticState(null);
          }
        });
        
        // Merge optimistic over server state
        const currentState = optimisticState 
          ? { ...serverState, ...optimisticState }
          : serverState;
        
        return { currentState, updateBlock };
      }
    </principle>
    
    <principle name="virtualization">
      Proposals with 20+ blocks need virtualization in the editor.
      
      Use @tanstack/react-virtual for the block list:
      
      function BlockList({ blocks }) {
        const parentRef = useRef(null);
        const virtualizer = useVirtualizer({
          count: blocks.length,
          getScrollElement: () => parentRef.current,
          estimateSize: (index) => estimateBlockHeight(blocks[index]),
          overscan: 3, // Render 3 extra blocks above/below viewport
        });
        
        return (
          <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
            <div style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtualRow) => (
                <BlockEditor
                  key={blocks[virtualRow.index].id}
                  block={blocks[virtualRow.index]}
                  style={{
                    position: 'absolute',
                    top: virtualRow.start,
                    height: virtualRow.size,
                  }}
                />
              ))}
            </div>
          </div>
        );
      }
      
      Note: Don't virtualize the PUBLIC view — it's meant to be scrolled/printed.
    </principle>
    
    <principle name="component-memoization">
      Block renderers are expensive. Memoize aggressively.
      
      const BlockRenderer = memo(function BlockRenderer({ block, mode }) {
        // Render based on block.type
      }, (prev, next) => {
        // Custom equality: only re-render if content changed
        return prev.block.content_hash === next.block.content_hash
            && prev.mode === next.mode;
      });
      
      Content hash: SHA256 of JSON.stringify(block.content), computed on save.
      This avoids deep equality checks on every render.
    </principle>
  </architecture>
  
  <performance-budgets>
    PUBLIC VIEW:
    - Time to First Byte: <200ms (edge cached)
    - First Contentful Paint: <1s
    - Largest Contentful Paint: <2s
    - Time to Interactive: <3s (minimal JS)
    - Total JS bundle: <50KB (proposal view only)
    
    EDITOR:
    - Initial load: <3s
    - Block edit response: <100ms (optimistic)
    - Preview update: <200ms after edit
    - Drag-drop reorder: 60fps
    - Undo/redo: <50ms
  </performance-budgets>
  
  <anti-patterns>
    - DON'T use useEffect for derived state (use useMemo)
    - DON'T pass entire proposal object as prop (pass IDs, select in component)
    - DON'T re-render preview on every keystroke (debounce 300ms)
    - DON'T load analytics library on public view initial render (lazy load after interaction)
    - DON'T use CSS-in-JS runtime (use Tailwind or CSS modules)
  </anti-patterns>
</expert>
```

### Expert 4: Database Architect (PostgreSQL Core Contributor)

```xml
<expert
  role="database-architect"
  background="PostgreSQL core contributor, designed schemas for 3 unicorn startups, wrote 'PostgreSQL High Performance'"
  mindset="the-database-is-the-application">

  <context>
    The proposal system needs to store:
    - Proposals with nested blocks (document structure)
    - Event history (append-only, high write volume)
    - Analytics data (time-series, high cardinality)
    - A/B test configurations and results
    - Templates (shared across organizations)
    - Multi-tenant data isolation
    
    Scale targets:
    - 1M proposals (across all tenants)
    - 100M events (growing 10M/month)
    - 1B analytics rows (growing 100M/month)
  </context>
  
  <schema-design>
    <principle name="jsonb-for-flexible-content">
      Block content varies by type. Don't create 8 tables for 8 block types.
      
      CREATE TABLE blocks (
        block_id UUID PRIMARY KEY,
        proposal_id UUID NOT NULL REFERENCES proposals(proposal_id),
        block_type VARCHAR(50) NOT NULL,
        position SMALLINT NOT NULL,
        content JSONB NOT NULL,
        content_hash BYTEA GENERATED ALWAYS AS (digest(content::text, 'sha256')) STORED,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT blocks_position_unique UNIQUE (proposal_id, position),
        CONSTRAINT blocks_content_valid CHECK (jsonb_typeof(content) = 'object')
      );
      
      -- Index for type-specific queries
      CREATE INDEX blocks_by_type ON blocks (block_type) WHERE block_type IN ('offer_stack', 'pain_amplifier');
      
      -- GIN index for content search (find all blocks mentioning a keyword)
      CREATE INDEX blocks_content_search ON blocks USING GIN (content jsonb_path_ops);
      
      Why JSONB:
      - Schema-per-block-type would require migrations for every new block type
      - JSONB is queryable, indexable, and compressible
      - Validation happens in application layer (Zod schemas per block type)
      - PostgreSQL 14+ has excellent JSONB performance
    </principle>
    
    <principle name="time-partitioned-analytics">
      Analytics tables grow without bound. Partition by time.
      
      CREATE TABLE proposal_views (
        view_id UUID NOT NULL,
        proposal_id UUID NOT NULL,
        prospect_id UUID,
        variant_assignments JSONB NOT NULL, -- { block_id: variant_id }
        viewed_at TIMESTAMPTZ NOT NULL,
        duration_seconds INTEGER,
        scroll_depth_percent SMALLINT,
        device_type VARCHAR(20),
        geo_country CHAR(2),
        referrer_domain VARCHAR(255),
        
        PRIMARY KEY (viewed_at, view_id)
      ) PARTITION BY RANGE (viewed_at);
      
      -- Create monthly partitions
      CREATE TABLE proposal_views_2026_05 PARTITION OF proposal_views
        FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
      
      -- Automate partition creation
      SELECT cron.schedule('create-analytics-partitions', '0 0 1 * *', $$
        SELECT create_next_month_partition('proposal_views');
      $$);
      
      -- Archive old partitions to cold storage after 12 months
      SELECT cron.schedule('archive-old-analytics', '0 2 1 * *', $$
        SELECT archive_partitions_older_than('proposal_views', interval '12 months');
      $$);
      
      Benefits:
      - DROP PARTITION is instant (vs DELETE which is slow and bloats)
      - Queries on recent data only scan recent partitions
      - Old data can be moved to cheaper storage
    </principle>
    
    <principle name="materialized-views-for-dashboards">
      Aggregating 100M rows on every dashboard load is not feasible.
      
      CREATE MATERIALIZED VIEW proposal_analytics_daily AS
      SELECT
        date_trunc('day', viewed_at) AS date,
        proposal_id,
        organization_id,
        COUNT(*) AS views,
        COUNT(DISTINCT prospect_id) AS unique_prospects,
        AVG(duration_seconds) AS avg_duration,
        AVG(scroll_depth_percent) AS avg_scroll_depth,
        COUNT(*) FILTER (WHERE scroll_depth_percent >= 80) AS completed_views
      FROM proposal_views pv
      JOIN proposals p ON pv.proposal_id = p.proposal_id
      GROUP BY 1, 2, 3;
      
      -- Refresh incrementally (PostgreSQL 15+)
      CREATE UNIQUE INDEX ON proposal_analytics_daily (date, proposal_id);
      
      -- Refresh every hour
      SELECT cron.schedule('refresh-analytics-daily', '0 * * * *', $$
        REFRESH MATERIALIZED VIEW CONCURRENTLY proposal_analytics_daily;
      $$);
      
      Dashboard queries hit the materialized view (thousands of rows),
      not the raw analytics table (millions of rows).
    </principle>
    
    <principle name="row-level-security">
      Multi-tenant isolation must be enforced at database level, not just application.
      
      ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY proposals_tenant_isolation ON proposals
        USING (organization_id = current_setting('app.current_org_id')::uuid);
      
      -- Set org context on every request
      SET app.current_org_id = 'org-uuid-here';
      
      Benefits:
      - Even SQL injection can't access other tenants' data
      - Works with any query tool (psql, BI tools)
      - Auditable security boundary
      
      Performance note: Add organization_id to all indexes used with RLS.
    </principle>
    
    <principle name="advisory-locks-for-proposal-editing">
      Prevent concurrent edits to same proposal without blocking reads.
      
      -- Acquire edit lock (non-blocking check)
      SELECT pg_try_advisory_lock(hashtext('proposal:' || proposal_id::text)) AS acquired;
      
      -- If not acquired, someone else is editing
      -- Show "X is currently editing this proposal"
      
      -- Release on save or disconnect
      SELECT pg_advisory_unlock(hashtext('proposal:' || proposal_id::text));
      
      Alternative: Use WebSocket presence for real-time "who's editing" display.
    </principle>
  </schema-design>
  
  <indexing-strategy>
    CRITICAL INDEXES:
    
    -- Proposal lookup by magic link (public view hot path)
    CREATE UNIQUE INDEX proposals_magic_link ON proposals (magic_link_token) 
      WHERE magic_link_token IS NOT NULL AND status = 'published';
    
    -- Organization's proposals (dashboard listing)
    CREATE INDEX proposals_by_org ON proposals (organization_id, updated_at DESC)
      WHERE status != 'archived';
    
    -- Event sourcing replay (load single proposal)
    CREATE INDEX proposal_events_replay ON proposal_events (proposal_id, sequence_number);
    
    -- Analytics: conversion by variant (A/B test results)
    CREATE INDEX proposal_views_ab ON proposal_views (proposal_id, (variant_assignments->>'block_id'))
      WHERE variant_assignments IS NOT NULL;
    
    DON'T INDEX:
    - Every JSONB path (use GIN for search, explicit for hot paths)
    - Columns only used in non-time-critical admin queries
    - High-cardinality columns with low selectivity
  </indexing-strategy>
  
  <connection-management>
    At 10K proposals/month scale, connection pooling is critical.
    
    Use PgBouncer in transaction mode:
    - Pool size: 20-50 connections to PostgreSQL
    - Application sees "unlimited" connections via PgBouncer
    - Transactions complete quickly, connections return to pool
    
    For serverless (Vercel Edge):
    - Use Neon's serverless driver or Supabase connection pooler
    - These handle connection warming and pooling at edge
  </connection-management>
</expert>
```

### Expert 5: Real-Time Collaboration Engineer (Ex-Figma)

```xml
<expert
  role="realtime-collaboration-engineer"
  background="6 years at Figma building multiplayer infrastructure, expert in CRDTs and operational transforms"
  mindset="eventual-consistency-is-a-feature-not-a-bug">

  <context>
    Today: Single user edits proposal.
    Tomorrow: Team collaborates on proposal in real-time.
    
    Building for single-user but architecting for multi-user means:
    - State management must handle concurrent mutations
    - UI must handle "someone else changed this"
    - Persistence must resolve conflicts gracefully
  </context>
  
  <analysis>
    <question>Does a proposal builder need real-time collaboration?</question>
    
    <answer>
      Probably NOT full Figma-style collaboration. But it DOES need:
      
      1. PRESENCE — See who else is viewing/editing
         "Karolina is also viewing this proposal"
         Low complexity. WebSocket with heartbeat.
      
      2. LIVE CURSORS — See where they are (optional, nice-to-have)
         "Karolina is editing the Pricing block"
         Medium complexity. Throttled position updates.
      
      3. CONFLICT RESOLUTION — Handle simultaneous edits
         Two people change same headline. Who wins?
         High complexity. But event sourcing helps!
      
      Recommendation: Build 1 and 3. Skip 2 for now.
    </answer>
  </analysis>
  
  <architecture>
    <component name="presence-system">
      Simple WebSocket presence:
      
      // Server
      const presenceByProposal = new Map<ProposalId, Set<{userId, userName, lastSeen}>>();
      
      ws.on('join', ({ proposalId, userId, userName }) => {
        presenceByProposal.get(proposalId).add({ userId, userName, lastSeen: Date.now() });
        broadcast(proposalId, { type: 'presence_update', users: [...presenceByProposal.get(proposalId)] });
      });
      
      ws.on('disconnect', ({ proposalId, userId }) => {
        presenceByProposal.get(proposalId).delete(userId);
        broadcast(proposalId, { type: 'presence_update', users: [...presenceByProposal.get(proposalId)] });
      });
      
      // Heartbeat to detect zombies
      setInterval(() => {
        for (const [proposalId, users] of presenceByProposal) {
          const now = Date.now();
          for (const user of users) {
            if (now - user.lastSeen > 30000) users.delete(user);
          }
        }
      }, 10000);
      
      // Client
      useEffect(() => {
        const ws = new WebSocket(`wss://api.tevero.com/presence/${proposalId}`);
        ws.send(JSON.stringify({ type: 'join', userId, userName }));
        
        const heartbeat = setInterval(() => ws.send(JSON.stringify({ type: 'heartbeat' })), 15000);
        
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'presence_update') setActiveUsers(msg.users);
        };
        
        return () => { clearInterval(heartbeat); ws.close(); };
      }, [proposalId]);
    </component>
    
    <component name="conflict-resolution">
      With event sourcing, conflicts are detectable and resolvable:
      
      Scenario: Alice and Bob both edit the same headline.
      
      Timeline:
      T0: Both load proposal (version 5)
      T1: Alice changes headline to "A" (expects version 5)
      T2: Bob changes headline to "B" (expects version 5)
      T3: Server receives Alice's change, saves as version 6
      T4: Server receives Bob's change, expects version 5, but current is 6 → CONFLICT
      
      Resolution strategies:
      
      1. LAST WRITE WINS (simple, lossy)
         Bob's change overwrites Alice's.
         Alice sees her change disappear.
         Bad UX but simple.
      
      2. FIRST WRITE WINS (simple, Bob retries)
         Bob gets conflict error.
         Bob's UI reloads to version 6 (shows Alice's change).
         Bob can re-apply his edit if still desired.
         Better UX, requires retry logic.
      
      3. MERGE (complex, best UX)
         Server detects both changed same field.
         Server asks: "Alice changed to 'A', Bob changed to 'B'. Keep which?"
         Or: Auto-merge if different fields changed.
         Best UX, most complex.
      
      Recommendation for proposals: FIRST WRITE WINS with real-time sync.
      
      Because:
      - Proposals are edited infrequently (not like code or docs)
      - Real-time presence means people know someone else is editing
      - Event sourcing makes it easy to see what changed
      - Merge complexity isn't worth it for proposal content
      
      Implementation:
      
      async function saveBlockChange(proposalId, blockId, changes, expectedVersion) {
        try {
          await api.saveBlockChange(proposalId, blockId, changes, expectedVersion);
        } catch (error) {
          if (error.code === 'CONFLICT') {
            // Fetch latest state
            const latest = await api.getProposal(proposalId);
            
            // Show user what changed
            toast.warning(`${error.conflictingUser} just edited this. Refreshing...`);
            
            // Update local state to latest
            setProposal(latest);
            
            // Let user re-apply their change if they want
          }
        }
      }
    </component>
    
    <component name="real-time-sync">
      Beyond conflict resolution, sync changes in real-time:
      
      // Server broadcasts all changes to connected users
      function onProposalEventSaved(event) {
        broadcast(event.proposalId, {
          type: 'proposal_change',
          event: event,
          newVersion: event.sequenceNumber
        });
      }
      
      // Client applies remote changes
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'proposal_change' && msg.event.userId !== currentUserId) {
          // Someone else made a change
          applyRemoteEvent(msg.event);
          setVersion(msg.newVersion);
          
          // Show subtle notification
          toast.info(`${msg.event.userName} updated ${msg.event.blockType}`);
        }
      };
      
      This way, Alice sees Bob's changes appear in real-time,
      reducing the chance they both edit the same thing.
    </component>
  </architecture>
  
  <future-proofing>
    If you later need full CRDT-style collaboration (like Notion or Figma):
    
    1. Block-level is the right granularity
       - Don't need character-level CRDTs (overkill for forms)
       - Block-level: Each block is independently mergeable
    
    2. Event sourcing provides the foundation
       - Events are the "operations" in operational transform
       - Sequence numbers enable causal ordering
    
    3. Yjs/Automerge can be added later
       - For rich text WITHIN a block (if you add WYSIWYG)
       - Not needed for form-based editing
    
    Current architecture doesn't preclude this evolution.
  </future-proofing>
</expert>
```

### Expert 6: Content Management System Architect (Built WordPress VIP, Contentful)

```xml
<expert
  role="cms-architect"
  background="Architected WordPress VIP (serves 30% of top 10K sites), then led Contentful's content modeling team"
  mindset="content-is-structured-data-not-blobs">

  <context>
    A proposal is a CONTENT TYPE with:
    - Defined structure (blocks in a sequence)
    - Typed fields (each block type has a schema)
    - Variables (placeholders resolved at render)
    - Relationships (linked to prospect, organization, template)
    - Lifecycle states (draft, published, archived)
    - Localization potential (future: same proposal in multiple languages)
  </context>
  
  <content-modeling>
    <principle name="schemas-per-block-type">
      Every block type has a Zod schema:
      
      // packages/proposal-schemas/src/blocks/pain-amplifier.ts
      export const PainAmplifierContentSchema = z.object({
        headline: z.string().min(1).max(200),
        body: z.string().min(1).max(2000),
        statistic: z.object({
          value: z.number(),
          unit: z.enum(['percent', 'currency', 'number']),
          context: z.string().optional() // "of businesses"
        }).optional(),
        icon: z.enum(['warning', 'money', 'chart', 'clock']).default('warning')
      });
      
      export type PainAmplifierContent = z.infer<typeof PainAmplifierContentSchema>;
      
      // packages/proposal-schemas/src/blocks/offer-stack.ts
      export const OfferStackContentSchema = z.object({
        headline: z.string().optional(),
        tiers: z.array(z.object({
          id: z.string().uuid(),
          name: z.string(),
          price: z.number(),
          currency: z.enum(['EUR', 'USD', 'GBP']).default('EUR'),
          period: z.enum(['one-time', 'monthly', 'yearly']).default('one-time'),
          originalPrice: z.number().optional(), // For struck-through price
          features: z.array(z.object({
            text: z.string(),
            included: z.boolean(),
            highlighted: z.boolean().default(false)
          })),
          cta: z.string(),
          recommended: z.boolean().default(false)
        })).min(1).max(4),
        footnote: z.string().optional()
      });
      
      // Registry of all block types
      export const BlockContentSchemas = {
        pain_amplifier: PainAmplifierContentSchema,
        villain_story: VillainStoryContentSchema,
        credibility: CredibilityContentSchema,
        social_proof: SocialProofContentSchema,
        process_reveal: ProcessRevealContentSchema,
        offer_stack: OfferStackContentSchema,
        risk_reversal: RiskReversalContentSchema,
        objection_handler: ObjectionHandlerContentSchema,
        urgency: UrgencyContentSchema,
        cta: CtaContentSchema,
        // Data blocks (from SEO analysis)
        keyword_table: KeywordTableContentSchema,
        competitor_gap: CompetitorGapContentSchema,
        technical_audit_summary: TechnicalAuditSummaryContentSchema
      } as const;
      
      Validation happens:
      - On save (API validates before persisting)
      - On render (components assert correct shape)
      - On migration (old content upgraded to new schema)
    </principle>
    
    <principle name="variable-system">
      Variables are REFERENCES, not inline text.
      
      Content stores: "Dear {{prospect.contact_name}},"
      Not: "Dear Karolina,"
      
      Variable resolution happens at RENDER TIME:
      
      interface VariableContext {
        prospect: {
          company_name: string;
          contact_name: string;
          domain: string;
          industry?: string;
        };
        package: {
          name: string;
          price: number;
          currency: string;
        };
        organization: {
          name: string;
          website: string;
          phone?: string;
        };
        seo_data?: {
          domain_rating?: number;
          organic_traffic?: number;
          top_keywords?: string[];
        };
        custom: Record<string, string>; // User-defined variables
      }
      
      function resolveVariables(text: string, context: VariableContext): string {
        return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
          const value = get(context, path);
          if (value === undefined) {
            console.warn(`Unresolved variable: ${path}`);
            return match; // Keep placeholder if not found
          }
          return String(value);
        });
      }
      
      Benefits:
      - Same proposal, different prospect = different output
      - Variables are validated (typos caught)
      - Easy to see all variables used in a proposal
      - Supports conditional content (future: {{#if seo_data}}...{{/if}})
    </principle>
    
    <principle name="template-inheritance">
      Templates are PROPOSALS with special status, not a separate entity.
      
      CREATE TABLE proposals (
        -- ...
        is_template BOOLEAN NOT NULL DEFAULT FALSE,
        template_id UUID REFERENCES proposals(proposal_id), -- If created from template
        -- ...
      );
      
      When creating from template:
      1. Deep clone template's blocks
      2. Set template_id reference
      3. Keep template's structure, user edits content
      
      Templates can have:
      - FIXED blocks (can't be removed or reordered)
      - OPTIONAL blocks (can be toggled on/off)
      - PLACEHOLDER blocks (must be filled before publish)
      
      Block metadata:
      {
        block_id: "...",
        template_behavior: "fixed" | "optional" | "placeholder" | "editable"
      }
      
      This allows org-level brand consistency:
      "Every proposal MUST have our guarantee block, and it CANNOT be edited."
    </principle>
    
    <principle name="content-lifecycle">
      Proposals have a state machine:
      
      ```
      DRAFT ──publish──▶ PUBLISHED ──archive──▶ ARCHIVED
        │                    │                      │
        │◀──unpublish───────┘                      │
        │                                           │
        │◀─────────restore─────────────────────────┘
      ```
      
      State constraints:
      - DRAFT: Editable, not accessible via magic link
      - PUBLISHED: Read-only (edits create new version), accessible via magic link
      - ARCHIVED: Read-only, magic link disabled, hidden from lists
      
      Publishing creates a SNAPSHOT:
      - Current block content frozen as "version N"
      - Version stored with publish event
      - Public view always shows specific version, not current draft
      
      This allows:
      - Editing draft while published version is live
      - Prospect sees stable content (not your mid-edit state)
      - A/B test knows exactly which version was shown
    </principle>
  </content-modeling>
  
  <content-delivery>
    <api name="content-delivery-api">
      Separate APIs for editing vs viewing:
      
      EDITING API (authenticated, full access):
      GET  /api/proposals/:id           → Full proposal with all versions, analytics
      PUT  /api/proposals/:id/blocks/:blockId → Update block content
      POST /api/proposals/:id/publish   → Create published version
      
      DELIVERY API (public, cached):
      GET /p/:token                     → Published proposal (resolved variables, specific version)
      
      The delivery endpoint:
      - Has no authentication (magic link is the auth)
      - Is heavily cached (edge, CDN)
      - Returns FULLY RESOLVED content (no variables, no drafts)
      - Is optimized for render performance
      
      Cache strategy:
      - Cache key: `proposal:${token}:${version}`
      - TTL: 24 hours (or until republished)
      - Purge on: republish, unpublish
    </api>
  </content-delivery>
</expert>
```

### Expert 7: Analytics Pipeline Engineer (Ex-Amplitude)

```xml
<expert
  role="analytics-engineer"
  background="Built Amplitude's ingestion pipeline handling 1T events/month, expert in clickstream analytics"
  mindset="every-interaction-is-a-signal">

  <context>
    Proposal analytics need to answer:
    
    1. ENGAGEMENT — Did they read it? How much? Which parts?
    2. CONVERSION — Did they accept? How long did it take?
    3. ATTRIBUTION — Which block/variant drove the conversion?
    4. PATTERNS — What do winning proposals have in common?
    
    Volume: 100K views/month → 10M events/month (with scroll tracking)
  </context>
  
  <event-taxonomy>
    <event-category name="page-level">
      proposal_viewed {
        proposal_id, version, prospect_id?, 
        magic_link_token, session_id,
        referrer, utm_params,
        device: { type, os, browser },
        geo: { country, region, city },
        timestamp
      }
      
      proposal_scroll {
        proposal_id, session_id,
        scroll_depth_percent: 0-100,
        visible_blocks: string[], // Block IDs currently in viewport
        timestamp
      }
      
      proposal_exit {
        proposal_id, session_id,
        total_duration_seconds,
        max_scroll_depth_percent,
        blocks_viewed: string[],
        exit_trigger: 'tab_close' | 'navigation' | 'timeout',
        timestamp
      }
    </event-category>
    
    <event-category name="block-level">
      block_viewed {
        proposal_id, session_id, block_id, variant_id?,
        viewport_time_ms, // How long block was in viewport
        timestamp
      }
      
      block_interaction {
        proposal_id, session_id, block_id,
        interaction_type: 'click' | 'hover' | 'expand' | 'copy',
        element: string, // CSS selector or element name
        timestamp
      }
    </event-category>
    
    <event-category name="conversion">
      proposal_accepted {
        proposal_id, session_id, prospect_id,
        accepted_tier: string, // Which pricing tier
        time_to_accept_hours: number,
        blocks_viewed_before_accept: string[],
        variant_assignments: Record<block_id, variant_id>,
        timestamp
      }
      
      proposal_declined {
        proposal_id, session_id, prospect_id?,
        decline_reason?: string, // If they provided feedback
        time_to_decline_hours: number,
        blocks_viewed_before_decline: string[],
        timestamp
      }
    </event-category>
  </event-taxonomy>
  
  <ingestion-architecture>
    ```
    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
    │   Browser    │────▶│   Edge API   │────▶│    Kafka     │
    │  (beacon)    │     │  (validate)  │     │   (buffer)   │
    └──────────────┘     └──────────────┘     └──────────────┘
                                                     │
                              ┌──────────────────────┼──────────────────────┐
                              │                      │                      │
                              ▼                      ▼                      ▼
                    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
                    │   ClickHouse  │      │   Redis      │      │  PostgreSQL  │
                    │  (raw events) │      │ (real-time)  │      │ (aggregates) │
                    └──────────────┘      └──────────────┘      └──────────────┘
    ```
    
    Why this architecture:
    
    1. BEACON API (edge): 
       - Receives events via navigator.sendBeacon (reliable on page close)
       - Validates schema, enriches with server-side data (geo, device)
       - Non-blocking, fire-and-forget from browser's perspective
    
    2. KAFKA (buffer):
       - Decouples ingestion from processing
       - Handles traffic spikes without dropping events
       - Enables replay if downstream fails
       - For smaller scale: Redis Streams or BullMQ instead
    
    3. CLICKHOUSE (raw storage):
       - Columnar storage optimized for analytics queries
       - Handles billions of rows efficiently
       - For smaller scale: PostgreSQL with TimescaleDB or partitioned tables
    
    4. REDIS (real-time):
       - Live counters: "5 people viewing this proposal now"
       - Recent activity: "Karolina viewed 30 seconds ago"
       - HyperLogLog for unique visitor counts
    
    5. POSTGRESQL (aggregates):
       - Pre-computed rollups for dashboards
       - Proposal-level metrics (total views, avg time, conversion rate)
       - Joined with business data (prospect info, organization)
  </ingestion-architecture>
  
  <real-time-dashboards>
    For live analytics ("someone is reading your proposal right now"):
    
    // Redis keys
    `proposal:${id}:active_sessions` → Set of session_ids (TTL 5 min)
    `proposal:${id}:view_count` → Counter
    `proposal:${id}:last_viewed` → Timestamp
    
    // WebSocket to editor
    subscribeToProposalActivity(proposalId, (activity) => {
      setActiveViewers(activity.active_sessions.length);
      setTotalViews(activity.view_count);
      setLastViewed(activity.last_viewed);
    });
    
    // Update on each view event
    onProposalViewed(event) {
      redis.sadd(`proposal:${event.proposal_id}:active_sessions`, event.session_id);
      redis.expire(`proposal:${event.proposal_id}:active_sessions`, 300);
      redis.incr(`proposal:${event.proposal_id}:view_count`);
      redis.set(`proposal:${event.proposal_id}:last_viewed`, Date.now());
      
      publishToWebSocket(event.proposal_id, 'activity_update');
    }
  </real-time-dashboards>
  
  <ab-testing-analytics>
    A/B test results require:
    
    1. ASSIGNMENT TRACKING
       - Which variant did each session see?
       - Stored in proposal_viewed event
       - Deterministic: Hash(session_id + block_id) % num_variants
    
    2. CONVERSION ATTRIBUTION
       - Which variant was shown when they converted?
       - Stored in proposal_accepted event
       - Join: accepted.variant_assignments matches viewed.variant_assignments
    
    3. STATISTICAL SIGNIFICANCE
       - Is variant A actually better than B?
       - Calculate: chi-squared test or Bayesian probability
       - Only show "winner" when confidence > 95%
    
    Query for A/B results:
    
    SELECT
      block_id,
      variant_id,
      COUNT(DISTINCT v.session_id) AS views,
      COUNT(DISTINCT a.session_id) AS conversions,
      COUNT(DISTINCT a.session_id)::float / NULLIF(COUNT(DISTINCT v.session_id), 0) AS conversion_rate
    FROM proposal_viewed v
    LEFT JOIN proposal_accepted a 
      ON v.proposal_id = a.proposal_id 
      AND v.session_id = a.session_id
    CROSS JOIN LATERAL jsonb_each_text(v.variant_assignments) AS va(block_id, variant_id)
    WHERE v.proposal_id = $1
    GROUP BY block_id, variant_id
    ORDER BY block_id, conversion_rate DESC;
    
    Statistical significance calculation (server-side):
    
    function calculateSignificance(controlViews, controlConversions, variantViews, variantConversions) {
      // Chi-squared test
      const controlRate = controlConversions / controlViews;
      const variantRate = variantConversions / variantViews;
      const pooledRate = (controlConversions + variantConversions) / (controlViews + variantViews);
      
      const expectedControl = controlViews * pooledRate;
      const expectedVariant = variantViews * pooledRate;
      
      const chiSquared = 
        Math.pow(controlConversions - expectedControl, 2) / expectedControl +
        Math.pow(variantConversions - expectedVariant, 2) / expectedVariant;
      
      // Chi-squared with 1 degree of freedom
      // 3.84 = 95% confidence, 6.64 = 99% confidence
      return {
        significant: chiSquared > 3.84,
        confidence: chiSquaredToPValue(chiSquared),
        winner: variantRate > controlRate ? 'variant' : 'control',
        lift: ((variantRate - controlRate) / controlRate) * 100
      };
    }
  </ab-testing-analytics>
  
  <heatmaps>
    Block-level heatmaps (which sections get attention):
    
    Data collection:
    - Track scroll events (throttled to 1/second)
    - Record which blocks are in viewport
    - Accumulate viewport_time_ms per block
    
    Visualization:
    - Overlay on proposal preview
    - Color gradient: cold (not viewed) → hot (most viewed)
    - Show average attention per block position
    
    Query:
    SELECT
      block_id,
      AVG(viewport_time_ms) AS avg_attention_ms,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY viewport_time_ms) AS median_attention_ms,
      COUNT(DISTINCT session_id) AS unique_viewers
    FROM block_viewed
    WHERE proposal_id = $1 AND timestamp > NOW() - INTERVAL '30 days'
    GROUP BY block_id;
    
    Insight: "Your pricing block gets 2x less attention than your guarantee block.
              Consider moving pricing higher or making it more visually prominent."
  </heatmaps>
</expert>
```

### Expert 8: Edge Computing & CDN Architect (Ex-Cloudflare)

```xml
<expert
  role="edge-architect"
  background="7 years at Cloudflare, built Workers KV and Durable Objects, expert in edge-first architectures"
  mindset="every-millisecond-matters-for-conversion">

  <context>
    Proposal public views are the critical path:
    - Prospect clicks magic link
    - Page must load FAST (sub-second)
    - Slow page = prospect bounces = lost deal
    - Global audience (Lithuania, EU, potentially worldwide)
    
    The goal: <200ms Time to First Byte globally.
  </context>
  
  <architecture>
    <principle name="static-at-the-edge">
      Proposals are mostly static after publishing. Treat them as static assets.
      
      Publish workflow:
      1. User clicks "Publish"
      2. Server renders proposal to HTML (with resolved variables)
      3. HTML uploaded to edge storage (Cloudflare R2, Vercel Blob)
      4. CDN invalidation triggered
      5. Magic link now serves static HTML from edge
      
      No server round-trip on view. No database query. Pure static.
      
      Implementation with Next.js:
      
      // Generate static HTML at publish time
      async function publishProposal(proposalId) {
        const proposal = await getProposal(proposalId);
        const context = await buildVariableContext(proposal);
        
        // Render to static HTML
        const html = await renderToStaticMarkup(
          <ProposalDocument proposal={proposal} context={context} />
        );
        
        // Upload to edge storage
        const token = proposal.magic_link_token;
        await uploadToR2(`proposals/${token}/index.html`, html);
        
        // Invalidate CDN cache
        await purgeCDN(`/p/${token}`);
        
        // Record publish event
        await saveEvent(ProposalPublished({ proposalId, version: proposal.version }));
      }
      
      // Edge function serves static HTML
      // pages/p/[token].tsx or app/p/[token]/page.tsx
      export async function GET(request, { params }) {
        const html = await getFromR2(`proposals/${params.token}/index.html`);
        
        if (!html) {
          return new Response('Proposal not found', { status: 404 });
        }
        
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
          }
        });
      }
    </principle>
    
    <principle name="edge-analytics">
      Analytics collection must not slow down the page.
      
      Options:
      
      1. BEACON API (recommended)
         - navigator.sendBeacon() is async and survives page close
         - Fires to edge function that queues to analytics pipeline
         - Zero impact on page load
      
      2. EDGE WORKER INLINE
         - Cloudflare Worker intercepts request
         - Logs to Workers Analytics Engine (free tier: 100K/day)
         - Zero client-side JavaScript needed
         
         export default {
           async fetch(request, env) {
             const response = await env.ASSETS.fetch(request);
             
             // Log view to analytics (non-blocking)
             env.ANALYTICS.writeDataPoint({
               blobs: [request.url],
               indexes: [request.cf?.country || 'unknown']
             });
             
             return response;
           }
         }
      
      3. HYBRID
         - Basic metrics (view, country) from edge worker
         - Rich metrics (scroll, time) from client beacon
         - Best of both worlds
    </principle>
    
    <principle name="geo-optimized-delivery">
      Lithuanian prospects should hit EU edge nodes.
      EU data should stay in EU (GDPR).
      
      Architecture:
      
      ```
      ┌─────────────────────────────────────────────────────────────┐
      │                    CLOUDFLARE GLOBAL                        │
      │                                                             │
      │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
      │  │  EU EDGE    │  │  US EDGE    │  │  ASIA EDGE  │        │
      │  │  (primary)  │  │             │  │             │        │
      │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
      │         │                │                │                │
      │         ▼                ▼                ▼                │
      │  ┌─────────────────────────────────────────────────────┐  │
      │  │               R2 (EU region)                         │  │
      │  │  proposals/abc123/index.html                         │  │
      │  │  proposals/def456/index.html                         │  │
      │  └─────────────────────────────────────────────────────┘  │
      └─────────────────────────────────────────────────────────────┘
      ```
      
      R2 configuration:
      - Location hint: EU (stores data in EU)
      - Replication: Automatic to other regions for read performance
      
      For full GDPR compliance:
      - Analytics data also stored in EU
      - Use Cloudflare Workers with jurisdiction restrictions
    </principle>
    
    <principle name="instant-updates">
      When proposal is republished, update must be instant globally.
      
      Problem: CDN cache means old version served for TTL duration.
      
      Solution: Cache invalidation + versioned URLs
      
      // Option 1: Purge on publish
      await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}` },
        body: JSON.stringify({
          files: [`https://proposals.tevero.com/p/${token}`]
        })
      });
      
      // Option 2: Versioned URLs (no purge needed)
      // Magic link: /p/abc123?v=3
      // Each publish increments version
      // Old versions still accessible if needed
      
      // Option 3: Stale-while-revalidate
      // Cache-Control: public, max-age=60, stale-while-revalidate=3600
      // User gets cached version, edge fetches fresh in background
      // 60 second worst-case staleness is usually acceptable
    </principle>
  </architecture>
  
  <performance-targets>
    | Metric | Target | How to Achieve |
    |--------|--------|----------------|
    | TTFB | <100ms | Edge-served static HTML |
    | FCP | <500ms | Minimal CSS, no JS blocking |
    | LCP | <1s | Preload hero image, inline critical CSS |
    | CLS | 0 | No layout shifts (reserved space for images) |
    | TBT | <50ms | Defer all JS, use beacon for analytics |
    | TTI | <1s | Minimal hydration (islands only) |
  </performance-targets>
  
  <cost-optimization>
    At 100K views/month:
    
    Cloudflare (recommended for edge):
    - R2 storage: $0.015/GB/month → ~$0.50/month for 1000 proposals
    - R2 egress: Free to Cloudflare edge
    - Workers: Free tier covers 100K requests/day
    - Total: ~$5/month
    
    Vercel (if already using):
    - Blob storage: $0.15/GB/month → ~$5/month
    - Edge functions: Free tier covers 100K/month
    - Bandwidth: $0.15/GB → ~$15/month for 100GB
    - Total: ~$25/month
    
    Recommendation: Use Cloudflare R2 + Workers for proposal hosting,
    even if main app is on Vercel. The cost and performance difference is significant.
  </cost-optimization>
</expert>
```

### Expert 9: API Design & Developer Experience (Built Stripe's API)

```xml
<expert
  role="api-architect"
  background="10 years at Stripe, designed the Stripe API that developers love, now advising API-first startups"
  mindset="the-api-is-the-product">

  <context>
    TeveroSEO will eventually have:
    - External integrations (CRMs, email tools, accounting)
    - White-label partners using the API
    - Webhooks for real-time updates
    - SDK/client libraries
    
    Design the API right from the start, even for internal use.
  </context>
  
  <api-design>
    <principle name="resource-oriented">
      REST resources map to domain concepts:
      
      /organizations/{org_id}
      /organizations/{org_id}/proposals
      /organizations/{org_id}/proposals/{proposal_id}
      /organizations/{org_id}/proposals/{proposal_id}/blocks
      /organizations/{org_id}/proposals/{proposal_id}/blocks/{block_id}
      /organizations/{org_id}/proposals/{proposal_id}/versions
      /organizations/{org_id}/proposals/{proposal_id}/analytics
      /organizations/{org_id}/templates
      /organizations/{org_id}/prospects
      
      /proposals/{proposal_id}/public  -- Public view (by magic link token in auth)
      
      Resource actions:
      POST   /proposals                    -- Create proposal
      GET    /proposals/{id}               -- Get proposal
      PATCH  /proposals/{id}               -- Update proposal metadata
      DELETE /proposals/{id}               -- Archive proposal
      POST   /proposals/{id}/publish       -- Publish proposal
      POST   /proposals/{id}/unpublish     -- Unpublish proposal
      POST   /proposals/{id}/clone         -- Clone proposal
      
      Block actions:
      POST   /proposals/{id}/blocks        -- Add block
      PATCH  /proposals/{id}/blocks/{bid}  -- Update block
      DELETE /proposals/{id}/blocks/{bid}  -- Remove block
      POST   /proposals/{id}/blocks/reorder -- Reorder blocks
    </principle>
    
    <principle name="consistent-response-format">
      Every response follows the same envelope:
      
      // Success
      {
        "object": "proposal",
        "id": "prop_abc123",
        "created_at": "2026-05-15T10:30:00Z",
        "updated_at": "2026-05-15T14:22:00Z",
        "status": "draft",
        "organization": "org_xyz789",
        "blocks": [...],
        "variables": {...},
        "metadata": {...}
      }
      
      // Error
      {
        "error": {
          "type": "invalid_request_error",
          "code": "resource_not_found",
          "message": "No proposal found with ID 'prop_abc123'",
          "param": "proposal_id",
          "doc_url": "https://docs.tevero.com/errors#resource_not_found"
        }
      }
      
      // List
      {
        "object": "list",
        "data": [...],
        "has_more": true,
        "total_count": 142,
        "url": "/v1/proposals"
      }
      
      Key patterns:
      - "object" field tells you what you're looking at
      - IDs have prefixes (prop_, blk_, org_) for debuggability
      - Timestamps are ISO 8601 UTC
      - Errors have codes, not just messages (for i18n, automation)
      - Lists support pagination with has_more + cursor
    </principle>
    
    <principle name="idempotency">
      Creating resources should be idempotent (retryable without duplicates).
      
      POST /proposals
      Headers:
        Idempotency-Key: user-provided-unique-key
      
      Server behavior:
      1. Check if idempotency key exists in cache
      2. If exists, return cached response (exact same response as first call)
      3. If not, process request, cache response with key, return response
      4. Cache expires after 24 hours
      
      Implementation:
      
      async function handleIdempotentRequest(req, handler) {
        const idempotencyKey = req.headers['idempotency-key'];
        
        if (idempotencyKey) {
          const cached = await redis.get(`idempotency:${idempotencyKey}`);
          if (cached) {
            return JSON.parse(cached);
          }
        }
        
        const response = await handler(req);
        
        if (idempotencyKey) {
          await redis.setex(
            `idempotency:${idempotencyKey}`,
            86400, // 24 hours
            JSON.stringify(response)
          );
        }
        
        return response;
      }
      
      This prevents duplicate proposals if client retries on network error.
    </principle>
    
    <principle name="webhooks">
      Push updates to integrations:
      
      Webhook events:
      - proposal.created
      - proposal.updated
      - proposal.published
      - proposal.unpublished
      - proposal.viewed (batched, not per-view)
      - proposal.accepted
      - proposal.declined
      
      Webhook payload:
      {
        "id": "evt_abc123",
        "type": "proposal.accepted",
        "created_at": "2026-05-15T16:45:00Z",
        "data": {
          "object": {
            "id": "prop_xyz789",
            "accepted_tier": "augimo",
            "prospect": { ... }
          },
          "previous_attributes": null
        }
      }
      
      Webhook reliability:
      - Retry with exponential backoff (3 attempts over 24 hours)
      - Allow endpoint to return 2xx to acknowledge
      - Provide webhook logs in dashboard
      - Support signature verification (HMAC)
      
      Implementation:
      
      async function sendWebhook(event: WebhookEvent) {
        const endpoints = await getActiveWebhookEndpoints(event.organization_id);
        
        for (const endpoint of endpoints) {
          await webhookQueue.add('send', {
            endpoint_url: endpoint.url,
            secret: endpoint.secret,
            event: event
          }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 60000 }
          });
        }
      }
      
      async function processWebhookJob(job) {
        const { endpoint_url, secret, event } = job.data;
        
        const signature = crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(event))
          .digest('hex');
        
        const response = await fetch(endpoint_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tevero-Signature': signature,
            'X-Tevero-Event': event.type
          },
          body: JSON.stringify(event)
        });
        
        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status}`);
        }
      }
    </principle>
    
    <principle name="versioning">
      API versions for breaking changes:
      
      /v1/proposals      -- Current stable
      /v2/proposals      -- Next version (when needed)
      
      Header-based version selection:
      X-Tevero-Version: 2026-05-15
      
      Version changelog documented at:
      https://docs.tevero.com/changelog
      
      Breaking change policy:
      - 12 months deprecation notice
      - Old versions supported for 24 months
      - Migration guides provided
      
      Non-breaking changes (no version bump):
      - Adding new optional fields
      - Adding new endpoints
      - Adding new enum values (clients should handle unknown values)
      
      Breaking changes (require version bump):
      - Removing fields
      - Changing field types
      - Changing required/optional status
      - Changing error codes
    </principle>
  </api-design>
  
  <developer-experience>
    <sdks>
      Generate SDKs from OpenAPI spec:
      
      @tevero/sdk-node
      @tevero/sdk-python
      
      // Node.js example
      import Tevero from '@tevero/sdk-node';
      
      const tevero = new Tevero({ apiKey: process.env.TEVERO_API_KEY });
      
      const proposal = await tevero.proposals.create({
        template: 'tmpl_lithuanian_standard',
        prospect: {
          company_name: 'Plaukų Pasaka',
          contact_name: 'Karolina',
          domain: 'plaukupasaka.lt'
        },
        variables: {
          package: 'augimo',
          price: 3500
        }
      });
      
      await tevero.proposals.publish(proposal.id);
      
      console.log(`Magic link: ${proposal.magic_link_url}`);
    </sdks>
    
    <documentation>
      Stripe-quality docs:
      - Interactive API explorer
      - Code samples in multiple languages
      - Copy-paste curl commands
      - Webhook testing tool
      - Sandbox environment with test data
    </documentation>
  </developer-experience>
</expert>
```

### Expert 10: Multi-Tenant SaaS Architect (Built Shopify's Multi-Tenant Platform)

```xml
<expert
  role="multi-tenant-architect"
  background="12 years at Shopify, architected the platform serving 2M+ merchants, expert in tenant isolation and fair resource allocation"
  mindset="every-tenant-is-a-vip">

  <context>
    TeveroSEO serves:
    - Tevero (the agency) as primary tenant
    - Other agencies as SaaS customers
    
    Each tenant needs:
    - Complete data isolation (can never see other tenants' data)
    - Custom branding (their logo, colors on proposals)
    - Usage limits (proposals/month, storage, etc.)
    - Fair resource allocation (one tenant can't DoS others)
  </context>
  
  <multi-tenancy-architecture>
    <principle name="tenant-per-schema">
      For strong isolation, consider schema-per-tenant in PostgreSQL:
      
      CREATE SCHEMA org_abc123;
      CREATE TABLE org_abc123.proposals (...);
      CREATE TABLE org_abc123.blocks (...);
      
      Benefits:
      - Physical isolation (no accidental cross-tenant queries)
      - Per-tenant backups and restores
      - Per-tenant resource limits (pg_bouncer pool per schema)
      - Compliance: Can prove data separation to auditors
      
      Drawbacks:
      - Schema migrations must run N times
      - Cross-tenant analytics requires UNION ALL
      - Connection pooling is more complex
      
      Recommendation: Start with shared schema + RLS (simpler),
      migrate to schema-per-tenant if compliance requires it.
    </principle>
    
    <principle name="shared-schema-with-rls">
      Simpler approach: Shared tables with row-level security.
      
      CREATE TABLE proposals (
        proposal_id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        -- ... other columns
      );
      
      ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY tenant_isolation ON proposals
        USING (organization_id = current_setting('app.current_org')::uuid);
      
      -- Every query automatically filtered by tenant
      SET app.current_org = 'org-uuid';
      SELECT * FROM proposals; -- Only sees their proposals
      
      Application code:
      
      async function withTenantContext<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
        await db.query(`SET app.current_org = '${orgId}'`);
        try {
          return await fn();
        } finally {
          await db.query(`RESET app.current_org`);
        }
      }
      
      // Usage
      await withTenantContext(req.user.organization_id, async () => {
        const proposals = await db.query('SELECT * FROM proposals');
        // Automatically filtered to this tenant
      });
    </principle>
    
    <principle name="tenant-aware-caching">
      Cache keys must include tenant:
      
      // WRONG: Cache collision between tenants
      cache.get('proposals:list');
      
      // CORRECT: Tenant-scoped cache
      cache.get(`org:${orgId}:proposals:list`);
      
      // For proposal public views (no tenant in context)
      cache.get(`proposal:${magicLinkToken}`);
      
      Cache invalidation must also be tenant-scoped:
      
      async function invalidateProposalCache(orgId: string, proposalId: string) {
        await cache.del(`org:${orgId}:proposals:list`);
        await cache.del(`org:${orgId}:proposals:${proposalId}`);
        // Don't invalidate other tenants' caches!
      }
    </principle>
    
    <principle name="resource-limits">
      Prevent one tenant from consuming all resources:
      
      // Limits stored per plan
      const PLAN_LIMITS = {
        starter: {
          proposals_per_month: 50,
          storage_gb: 1,
          team_members: 3,
          api_requests_per_minute: 60,
          ab_tests_per_proposal: 0
        },
        growth: {
          proposals_per_month: 200,
          storage_gb: 10,
          team_members: 10,
          api_requests_per_minute: 300,
          ab_tests_per_proposal: 3
        },
        enterprise: {
          proposals_per_month: Infinity,
          storage_gb: 100,
          team_members: Infinity,
          api_requests_per_minute: 1000,
          ab_tests_per_proposal: Infinity
        }
      };
      
      // Rate limiting per tenant
      async function checkRateLimit(orgId: string, limit: number) {
        const key = `ratelimit:${orgId}:${Math.floor(Date.now() / 60000)}`;
        const count = await redis.incr(key);
        await redis.expire(key, 120);
        
        if (count > limit) {
          throw new RateLimitExceeded({
            limit,
            current: count,
            reset_at: new Date(Math.ceil(Date.now() / 60000) * 60000)
          });
        }
      }
      
      // Usage limits per tenant
      async function checkUsageLimit(orgId: string, resource: string) {
        const org = await getOrganization(orgId);
        const limits = PLAN_LIMITS[org.plan];
        const usage = await getUsage(orgId, resource);
        
        if (usage >= limits[resource]) {
          throw new UsageLimitExceeded({
            resource,
            limit: limits[resource],
            current: usage,
            upgrade_url: `https://app.tevero.com/billing/upgrade`
          });
        }
      }
    </principle>
    
    <principle name="tenant-branding">
      Allow tenants to customize proposal appearance:
      
      CREATE TABLE organization_branding (
        organization_id UUID PRIMARY KEY REFERENCES organizations(organization_id),
        logo_url VARCHAR(500),
        primary_color VARCHAR(7), -- #RRGGBB
        secondary_color VARCHAR(7),
        font_family VARCHAR(100),
        custom_css TEXT, -- Advanced: allow CSS overrides
        email_from_name VARCHAR(100),
        email_reply_to VARCHAR(255)
      );
      
      Branding applied at render time:
      
      function ProposalDocument({ proposal, branding }) {
        return (
          <div style={{
            '--primary-color': branding.primary_color,
            '--secondary-color': branding.secondary_color,
            fontFamily: branding.font_family
          }}>
            <header>
              {branding.logo_url && <img src={branding.logo_url} alt="Logo" />}
            </header>
            <ProposalContent proposal={proposal} />
          </div>
        );
      }
      
      Security: Sanitize custom_css to prevent XSS.
      Only allow whitelisted properties.
    </principle>
    
    <principle name="tenant-data-export">
      GDPR requires data portability. Each tenant must be able to export all their data.
      
      async function exportTenantData(orgId: string): Promise<ExportBundle> {
        return {
          organization: await getOrganization(orgId),
          proposals: await getAllProposals(orgId, { includeArchived: true }),
          templates: await getAllTemplates(orgId),
          prospects: await getAllProspects(orgId),
          events: await getAllEvents(orgId), // Event sourcing makes this easy
          analytics: await getAnalyticsSummary(orgId),
          exported_at: new Date().toISOString()
        };
      }
      
      Export format: JSON (machine-readable) + CSV (spreadsheet-readable)
      
      Trigger: Self-service in dashboard OR support request OR account deletion.
    </principle>
  </multi-tenancy-architecture>
  
  <operational-concerns>
    <monitoring>
      Per-tenant metrics:
      - Proposals created this month
      - Storage used
      - API requests
      - Error rate
      - P95 latency
      
      Alerts:
      - Tenant approaching limits (80% threshold)
      - Tenant error rate spike (anomaly detection)
      - Tenant latency spike (might indicate query issue)
    </monitoring>
    
    <tenant-support>
      Support tools:
      - Impersonation (view app as tenant sees it)
      - Activity log (what did they do before the bug?)
      - Data inspector (see their proposals, not edit)
      - Audit log (who from our team accessed their data?)
    </tenant-support>
    
    <tenant-offboarding>
      When tenant cancels:
      1. Immediately disable API access
      2. Keep data for 30 days (grace period)
      3. Send data export link
      4. After 30 days, hard delete all data
      5. Purge from all caches and backups within 90 days
    </tenant-offboarding>
  </operational-concerns>
</expert>
```

---

## Synthesis: The World-Class Architecture

### Core Decisions (Revised with Expert Input)

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| **Data Model** | Event-sourced with CQRS | Full audit trail, undo/redo, A/B attribution (Expert 2) |
| **Content Structure** | Typed JSON blocks with Zod schemas | Flexible yet validated, no TipTap coupling (Expert 6) |
| **Rendering** | React components with mode prop | Single source, multiple outputs (Expert 3, 9) |
| **Editing UX** | Form-based with live preview | Separation of concerns, performant (Expert 3) |
| **Public View** | Static HTML at edge | Sub-100ms TTFB, global reach (Expert 8) |
| **Analytics** | Event stream → ClickHouse + Redis | Real-time + historical, scalable (Expert 7) |
| **Multi-Tenancy** | Shared schema + RLS, then schema-per-tenant | Start simple, scale as needed (Expert 10) |
| **API** | REST with webhooks, OpenAPI spec | Developer experience, integrations (Expert 9) |
| **Collaboration** | Presence + conflict detection | Future-proof without CRDT complexity (Expert 5) |
| **Scale Target** | 10K proposals/month, 1M views/month | Design for 10x current projections (Expert 1) |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EDGE LAYER                                      │
│  Cloudflare: Static proposal hosting, analytics beacon, geo-routing         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│   PUBLIC VIEW   │        │   EDITOR APP    │        │   API GATEWAY   │
│                 │        │                 │        │                 │
│  Static HTML    │        │  Next.js App    │        │  REST + Webhooks│
│  from R2        │        │  Router         │        │  Rate limiting  │
│  Analytics JS   │        │  Server Actions │        │  Auth           │
└─────────────────┘        └─────────────────┘        └─────────────────┘
                                     │                           │
                                     │         ┌─────────────────┘
                                     │         │
                                     ▼         ▼
                           ┌─────────────────────────────┐
                           │        COMMAND SIDE         │
                           │                             │
                           │  Event Store (PostgreSQL)   │
                           │  - proposal_events table    │
                           │  - Optimistic concurrency   │
                           │  - Snapshots every 100 evts │
                           └─────────────────────────────┘
                                     │
                                     │ Domain Events
                                     ▼
                           ┌─────────────────────────────┐
                           │      EVENT HANDLERS         │
                           │                             │
                           │  - Update read models       │
                           │  - Trigger webhooks         │
                           │  - Publish to edge          │
                           │  - Queue PDF generation     │
                           │  - Update analytics         │
                           └─────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│   READ MODELS   │        │  ASYNC WORKERS  │        │   ANALYTICS     │
│                 │        │                 │        │                 │
│  PostgreSQL     │        │  BullMQ         │        │  ClickHouse     │
│  - proposals    │        │  - PDF gen      │        │  - raw events   │
│  - blocks       │        │  - Email        │        │  Redis          │
│  - analytics    │        │  - Webhooks     │        │  - real-time    │
│  Redis cache    │        │  - Publish      │        │  - counters     │
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

### Implementation Priority (Architecture-First)

**Phase 102-A: Foundation (Week 1-2)**
1. Event store schema and event types
2. Block content Zod schemas (all 10+ types)
3. Aggregate root (Proposal) with event application
4. Basic CQRS: command handlers + read model projection

**Phase 102-B: Rendering (Week 3-4)**
5. Block React components with mode prop
6. ProposalRenderer combining blocks
7. Variable resolution system
8. Form-based block editors

**Phase 102-C: Publishing & Delivery (Week 5-6)**
9. Publish workflow (render → R2 → purge CDN)
10. Edge function for public view
11. Analytics beacon + ingestion
12. Magic link generation

**Phase 102-D: Polish & Scale (Week 7-8)**
13. Presence system (WebSocket)
14. Conflict detection and resolution
15. A/B test configuration and analytics
16. API documentation and webhooks

---

## Open Questions Resolved

| Original Question | Resolution |
|-------------------|------------|
| Template-First or Builder-First? | **Builder-First** — templates are saved builder states |
| Form-Based or WYSIWYG? | **Form-Based with live preview** — clean separation |
| Pathway Priority? | **All pathways share same infrastructure** — build once, enable all |
| Tevero vs Generic? | **Generic from day 1** — Tevero is first tenant, not special case |

---

*Architecture-first analysis complete. Ready for `/gsd-plan-phase 102` execution.*
