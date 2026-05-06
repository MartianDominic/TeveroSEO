# Phase 89: Client Acquisition (Keyword Lock-in) — Context

> **Created:** 2026-05-05
> **Status:** Planning Complete, Ready for Execution
> **Total Effort:** 2-3 days
> **Dependencies:** Phase 45 (Data Foundation), Phase 87 (Client Portal)
> **Spec Document:** [CLIENT-PORTAL-SPEC.md](../CLIENT-PORTAL-SPEC.md)

---

## Executive Summary

Phase 89 implements **Keyword Lock-in** — the contract-to-delivery bridge that proves ROI and prevents scope creep.

**Two Problems Solved:**
1. **Scope creep** — Client signs for 50 keywords, then asks "can you also do X, Y, Z?"
2. **Value attribution** — Client says "I don't see results" when they have 40 keywords in top 10

**Solution:** A permanent record of what was promised vs. what was delivered.

---

## Key Decisions (Locked)

### 1. Keyword Lock-in is Infrastructure (ON by Default)

Unlike portal/notifications (optional), keyword lock-in is **foundational infrastructure**:

| Feature | Default | Rationale |
|---------|---------|-----------|
| **Keyword Lock-in** | ON | Needed for accurate reporting |
| **Strict Enforcement** | OFF | Agency chooses informal vs formal |

**Informal mode:** Track keywords but no hard scope boundaries.
**Strict mode:** Out-of-scope requests flagged, require change orders.

### 2. Value Proposition Math

Use the **single contracted target** from the agreement:

```
Goal Achievement = Delivered ÷ Contracted Target × 100

Example: Contract says "10 keywords in top 10", delivered 40
         40 ÷ 10 = 400% of goal achieved
```

**Rationale:** No ranges. Simple, honest math tied to the signed agreement.

### 3. Contract Signing Flow

```
PRE-CONTRACT                           SIGNING                              POST-SIGNING
┌─────────────────┐                    ┌─────────────────┐                   ┌─────────────────┐
│ Keywords        │                    │ Lock Event      │                   │ Delivery        │
│ analyzed but    │──── Contract ─────▶│ • Snapshot      │────  Execution ──▶│ • Track vs      │
│ not committed   │     Signed         │ • Baseline pos  │                   │   baseline      │
└─────────────────┘                    │ • Goal recorded │                   │ • Flag out-of-  │
                                       └─────────────────┘                   │   scope         │
                                                                             └─────────────────┘
```

### 4. Multi-Client Conflict Detection

When locking keywords, warn if same keyword already locked to competing client in same geo:

```
⚠️ CONFLICT DETECTED
"šampūnas plaukams" is already locked to:
• Grožio Namai (Vilnius) — expires Dec 2026

Options:
[Proceed Anyway] [Exclude This Keyword] [Contact Grožio Namai]
```

**Rationale:** Agencies shouldn't promise the same keyword to competitors.

---

## Sub-Phase Overview

| Sub-phase | Focus | Effort | Key Deliverable |
|-----------|-------|--------|-----------------|
| **89-01** | Contracted Keywords Schema | 0.5 day | `contracted_keywords` table |
| **89-02** | Contract Goals Schema | 0.5 day | `contract_goals` table |
| **89-03** | Lock Event Flow | 0.5 day | Signing UI + baseline snapshot |
| **89-04** | Out-of-Scope Detection | 0.5 day | Request flagging + change orders |
| **89-05** | Conflict Detection | 0.5 day | Multi-client keyword overlap warnings |
| **89-06** | Progress Tracking UI | 0.5 day | Contracted scope view in portal |

---

## Architecture

### Keyword Lock-in Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                    KEYWORD LOCK-IN LIFECYCLE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CONTRACT SIGNED                                                    │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Goal: Land 10 keywords in top 10 by July 31, 2026              ││
│  │ Locked Keywords: 50 (the working set to achieve goal)          ││
│  │ Baseline Snapshot: Position data at contract signing           ││
│  └────────────────────────────────────────────────────────────────┘│
│                                 │                                   │
│                                 ▼                                   │
│  EXECUTION                                                          │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Weekly: Position tracking against baseline                     ││
│  │ Monthly: Progress report (12/10 in top 10 = 120% to goal)      ││
│  │ Flags: Out-of-scope requests logged, not automatically added   ││
│  └────────────────────────────────────────────────────────────────┘│
│                                 │                                   │
│                                 ▼                                   │
│  CONTRACT END                                                       │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Delivered: 40 keywords in top 10 (goal was 10)                 ││
│  │ Goal Achievement: 400% of target                               ││
│  │ Renewal Proof: Clear, auditable, undeniable                    ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Contracted Keywords

```sql
CREATE TABLE contracted_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  keyword_id UUID NOT NULL,
  
  -- Keyword data (denormalized for historical accuracy)
  keyword_text TEXT NOT NULL,
  search_volume INTEGER,
  difficulty INTEGER,
  funnel_stage TEXT, -- BOFU, MOFU, TOFU
  
  -- Baseline (captured at lock time)
  baseline_position INTEGER, -- NULL if not ranking
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Current state
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, replaced
  
  -- Replacement tracking
  replaced_by UUID REFERENCES contracted_keywords(id),
  replaced_at TIMESTAMPTZ,
  replacement_reason TEXT,
  
  -- Change order (if added after contract)
  change_order_id UUID REFERENCES change_orders(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX contracted_keywords_contract_id_idx ON contracted_keywords(contract_id);
CREATE INDEX contracted_keywords_keyword_text_idx ON contracted_keywords(keyword_text);
CREATE INDEX contracted_keywords_status_idx ON contracted_keywords(status);
```

### Contract Goals

```sql
CREATE TABLE contract_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  
  -- Goal definition
  metric TEXT NOT NULL DEFAULT 'keywords_in_top_10', -- keywords_in_top_10, traffic_increase, etc.
  target_value INTEGER NOT NULL, -- e.g., 10 (keywords)
  target_deadline TIMESTAMPTZ NOT NULL,
  
  -- Current progress
  current_value INTEGER DEFAULT 0,
  achievement_percent DECIMAL(6,2) DEFAULT 0, -- 400.00 = 400%
  
  -- Status
  status TEXT DEFAULT 'in_progress', -- in_progress, achieved, missed
  achieved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX contract_goals_contract_id_idx ON contract_goals(contract_id);
```

### Out-of-Scope Requests

```sql
CREATE TABLE out_of_scope_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  
  -- Request details
  keyword_text TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  requested_by TEXT, -- email or name
  
  -- Resolution
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, change_order
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- If approved via change order
  change_order_id UUID REFERENCES change_orders(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX out_of_scope_requests_client_id_idx ON out_of_scope_requests(client_id);
CREATE INDEX out_of_scope_requests_status_idx ON out_of_scope_requests(status);
```

### Change Orders

```sql
CREATE TABLE change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  
  -- Change details
  description TEXT NOT NULL,
  keywords_added TEXT[] DEFAULT '{}',
  keywords_removed TEXT[] DEFAULT '{}',
  
  -- Pricing
  additional_fee DECIMAL(10,2) DEFAULT 0,
  fee_type TEXT DEFAULT 'one_time', -- one_time, monthly
  
  -- Status
  status TEXT DEFAULT 'draft', -- draft, sent, approved, rejected
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX change_orders_contract_id_idx ON change_orders(contract_id);
```

---

## Conflict Detection

### Query for Keyword Overlap

```sql
-- Find conflicting keywords across clients
SELECT 
  ck.keyword_text,
  c.id AS contract_id,
  cl.company_name,
  cl.city,
  co.end_date
FROM contracted_keywords ck
JOIN contracts co ON ck.contract_id = co.id
JOIN clients cl ON co.client_id = cl.id
WHERE 
  ck.keyword_text = ANY($1::text[]) -- keywords being locked
  AND ck.status = 'active'
  AND co.status = 'active'
  AND cl.city = $2 -- same geographic market
  AND cl.id != $3 -- exclude current client
ORDER BY co.end_date;
```

### Conflict UI Component

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️ KEYWORD CONFLICTS DETECTED                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  The following keywords overlap with existing client contracts:     │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ "šampūnas plaukams"                                           │ │
│  │ Already locked to: Grožio Namai (Vilnius)                     │ │
│  │ Contract expires: Dec 2026                                    │ │
│  │                                                               │ │
│  │ [Proceed Anyway] [Exclude] [Contact Client]                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ "plaukų priežiūra"                                            │ │
│  │ Already locked to: Beauty Lab (Vilnius)                       │ │
│  │ Contract expires: Mar 2027                                    │ │
│  │                                                               │ │
│  │ [Proceed Anyway] [Exclude] [Contact Client]                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                               [Exclude All Conflicts] [Continue →] │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Client Portal Integration

### Contracted Scope View

```
┌─────────────────────────────────────────────────────────────────────┐
│ CONTRACTED SCOPE (50 keywords)                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐
│  │ ✅ RANKED TOP 10                                          23   │
│  │ ████████████████████████████████████████░░░░░░░░░░░░░░░░░░     │
│  └─────────────────────────────────────────────────────────────────┘
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐
│  │ 🔄 IN PROGRESS                                            18   │
│  │ ████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │
│  └─────────────────────────────────────────────────────────────────┘
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐
│  │ ⏳ NOT STARTED                                             9   │
│  │ ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │
│  └─────────────────────────────────────────────────────────────────┘
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐
│  │ 📊 OUT OF SCOPE REQUESTS                                  12   │
│  │ Keywords requested outside original contract                   │
│  │ [View change order options →]                                  │
│  └─────────────────────────────────────────────────────────────────┘
│                                                                     │
│  GOAL: 10 keywords in Top 10 by July 31, 2026                      │
│  STATUS: 230% achieved (23/10) ✅                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

1. Keywords locked at contract signing with baseline positions
2. Goal achievement calculated correctly (delivered ÷ target × 100)
3. Out-of-scope requests flagged and trackable
4. Conflict detection warns before locking overlapping keywords
5. Change orders create auditable scope modifications
6. Progress visible in client portal (if enabled)
7. Value proposition clear at renewal time

---

## Business Impact

| Problem | Before | After |
|---------|--------|-------|
| **Scope creep** | Constant negotiation | Clear boundaries + change orders |
| **Value attribution** | "I don't see results" | "400% of contracted goal" |
| **Renewal friction** | Unclear ROI | Undeniable proof of delivery |
| **Competitor conflicts** | Unknown overlaps | Proactive detection |

---

## References

- [CLIENT-PORTAL-SPEC.md](../CLIENT-PORTAL-SPEC.md) — Comprehensive specification
- [PHASE-85-89-DEEP-DIVE.md](../PHASE-85-89-DEEP-DIVE.md) — Technical deep-dive
- `open-seo-main/src/db/contract-schema.ts` — Existing contract schema
- `open-seo-main/src/db/pipeline-schema.ts` — Existing pipeline schema

---

*Context document completed: 2026-05-05*
