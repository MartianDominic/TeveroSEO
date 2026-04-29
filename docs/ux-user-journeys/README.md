# TeveroSEO UX User Journeys

> **Purpose**: Complete UX architecture analysis and design documentation for the $100M autonomous SEO platform vision

## Document Hierarchy

```
v7-master-design-architecture.md  ← START HERE (SEO execution layer)
         │
         ├── Links to design system rules
         │   └── .planning/design/design-system-v6.md
         │   └── .planning/design/design-decisions-and-rationale.md
         │
         ├── Synthesizes all journeys
         │   └── v6-comprehensive-journeys.md (200 journeys, 10 domains)
         │
         └── References prior analysis
             └── v5-journey-map.md (initial 10 journeys + wireframes)
             └── v4-prototype-gap-analysis.md (v6 prototype evaluation)
             └── v3-critical-gaps.md (original gap analysis)
             └── v2-layout-analysis.md (screen layout study)
             └── v1-ux-missing.md (initial architecture assessment)

v8-agency-pipeline.md  ← AGENCY CRM LAYER
         │
         ├── 6-stage pipeline: Lead → Proposal → Contract → Payment → Onboarding → Active
         ├── Checklist-driven workflows (auto-created at each stage)
         ├── Built vs Missing analysis (critical gaps identified)
         ├── Data model: ProspectStatus enum, proposals, contracts, invoices tables
         ├── API routes + Stripe/e-signature integration specs
         └── Component mapping to design-system-v6.md
```

## Quick Links

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [v7-master-design-architecture.md](./v7-master-design-architecture.md) | **Unified blueprint** — journeys, components, autonomy/control balance | **Start here** for SEO execution |
| [v8-agency-pipeline.md](./v8-agency-pipeline.md) | **Agency CRM** — prospect→client→results pipeline, checklists, payments | **Start here** for agency business ops |
| [v6-comprehensive-journeys.md](./v6-comprehensive-journeys.md) | All 200 journeys across 10 domains | Deep dive into specific flows |
| [v5-journey-map.md](./v5-journey-map.md) | Initial 10 journeys with ASCII wireframes | Component design inspiration |
| [v4-prototype-gap-analysis.md](./v4-prototype-gap-analysis.md) | How v6 prototype addresses gaps | Understanding v6 design choices |

## Design System References

The design system lives in `.planning/design/`:

| Document | Purpose |
|----------|---------|
| [design-system-v6.md](../../.planning/design/design-system-v6.md) | **The visual rules** — tokens, typography, shadows, motion |
| [design-decisions-and-rationale.md](../../.planning/design/design-decisions-and-rationale.md) | **The "why"** — what we tried, what failed, meta-principles |
| [prototypes/client-hub-v6.html](../../.planning/design/prototypes/client-hub-v6.html) | **Reference implementation** — the v6 prototype |

## The Core Insight

TeveroSEO must feel like **two things simultaneously**:

1. **"It takes care of everything"** — Users trust the system to work autonomously
2. **"I can tweak whatever I need"** — Power users feel in control

This is achieved through:
- **Progressive disclosure** — Calm at rest, depth on hover
- **Trust-building visibility** — Today feed, ops strip, quality gate explanations
- **Override points** — Every autonomous action has a control setting

## Implementation Status

| Sprint | Focus | Status |
|--------|-------|--------|
| 1 | Onboarding Layer | Not Started |
| 2 | Dashboard v6 Components | Not Started |
| 3 | Content Workflow | Not Started |
| 4 | Cross-Domain Links | Not Started |
| 5 | Bulk Operations | Not Started |
| 6 | Trust & Visibility | Not Started |
| 7 | Reporting | Not Started |
| 8 | Business Types | Not Started |

## Summary Statistics

### SEO Execution Layer (v7)
- **Total Journeys Mapped**: 200
- **Implemented**: 125 (63%)
- **Gaps Identified**: 75
- **Components Needed**: 38 (14 P0, 10 P1, 14 P2+)
- **Design System Score**: v6 achieves 5.6/10 (up from 3.8/10)
- **Estimated Implementation**: 8 sprints (17 weeks)

### Agency Pipeline Layer (v8)
- **Pipeline Stages**: 6 (Lead → Proposal → Contract → Payment → Onboarding → Active)
- **Critical Missing**: Proposal sending, view tracking, e-signature, Stripe invoicing, onboarding checklists
- **Data Model Additions**: 5 new tables, 4 new enums
- **Estimated Implementation**: 4 phases (8 sprints)

---

*Last updated: 2026-04-29*
