# Phase 22: Goal-Based Metrics System

**Status:** Planned  
**Priority:** High  
**Dependencies:** Phase 21 (Agency Command Center) completed  
**Estimated Effort:** 5 plans, ~3 days

---

## Goal

Replace the arbitrary health score system with goal-based tracking. Agencies select goal templates (e.g., "Keywords in Top 10"), configure target values per client, and the system tracks progress automatically.

**Success Criteria:**
- [ ] Goal templates seeded in database
- [ ] Per-client goal configuration UI working
- [ ] Goals computed automatically by BullMQ worker
- [ ] Dashboard displays goal attainment instead of health score
- [ ] Priority score computed for attention queue sorting

---

## Business Value

1. **Transparency** — Goals are explicit, not opaque weights
2. **Client Alignment** — Track what client is paying for
3. **Actionable** — "7/10 keywords" beats "72 health"
4. **Flexible** — Different clients, different goals

---

## Plans

| Plan | Name | Focus | Dependencies |
|------|------|-------|--------------|
| 22-01 | Schema & Templates | Database schema, seed templates | — |
| 22-02 | Goal Computation Worker | BullMQ job, computation methods | 22-01 |
| 22-03 | Goal Management API | CRUD endpoints, server actions | 22-01 |
| 22-04 | Goal Configuration UI | Template selector, config form, wizard | 22-03 |
| 22-05 | Dashboard Integration | Replace health score, update components | 22-02, 22-04 |

---

## Technical Approach

### New Tables
- `goal_templates` — System-level goal type definitions
- `client_goals` — Per-client goal configurations
- `goal_snapshots` — Historical goal progress tracking

### Goal Templates (Seeded)
1. Keywords in Top 10
2. Keywords in Top 3
3. #1 Rankings
4. Weekly Clicks
5. Monthly Clicks
6. CTR Target
7. MoM Traffic Growth
8. Monthly Impressions
9. Custom Goal

### Computation Flow
1. BullMQ job runs every 5 minutes
2. For each client with goals:
   - Fetch goal configuration
   - Run computation method based on template
   - Calculate attainment percentage
   - Compute trend vs 30 days ago
   - Update `client_goals` and `client_dashboard_metrics`
   - Save snapshot to `goal_snapshots`

### UI Flow
1. Client Settings > Goals tab
2. Click "Add Goal"
3. Select template from dropdown
4. Fill in target value (and denominator if applicable)
5. Mark as primary if desired
6. Save — triggers immediate computation

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Computation performance at 500 clients | Medium | Medium | Batch processing, caching |
| Data not available for computation | Low | Low | Graceful fallback to 0 |
| Migration breaks existing dashboard | Low | High | Feature flag for gradual rollout |

---

## Out of Scope

- Goal recommendations/suggestions (Phase 25)
- Client-facing goal view (separate phase)
- Goal alerts/notifications beyond regression warning
- AI-based goal analysis
