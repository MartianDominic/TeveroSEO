# Phase 91 Gap Inventory — SUPERSEDED

> **This document has been superseded by the deep audit findings.**
> 
> See: **[91-IMPLEMENTATION-DECISIONS.md](./91-IMPLEMENTATION-DECISIONS.md)** for the consolidated, actionable list.

---

## What Changed

The original 31 items were based on assumptions about what needed optimization. After running 10 Opus subagents to deeply analyze the codebase, we found:

### Many Items Not Needed
- **Prospect/SERP/Backlinks caching:** Already on-demand only, well-designed
- **Singleflight/SWR:** On-demand model eliminates these needs
- **Cache pre-warming:** Speculative spending
- **Deep normalization:** Hard effort, marginal gain

### Real Wastes Found
The actual wastes are **scheduled jobs**, not caching:
1. Daily ranking checks for ALL keywords ($100-300/mo)
2. Dashboard metrics every 5 min (288 useless runs/day)
3. Alerts + Aggregates every 5 min (576 useless runs/day)

### TTL Extensions Still Valid
Simple constant changes that help:
- Classification: 7d → 90d
- Backlinks: 6h → 24h
- Domain: 12h → 7d
- Research: 24h → 7d

---

## Documents

| Document | Purpose |
|----------|---------|
| [91-MASTER.md](./91-MASTER.md) | Original unified cost document |
| [91-RESEARCH.md](./91-RESEARCH.md) | Research findings |
| [91-DEEP-AUDIT-FINDINGS.md](./91-DEEP-AUDIT-FINDINGS.md) | Detailed audit from 10 Opus agents |
| **[91-IMPLEMENTATION-DECISIONS.md](./91-IMPLEMENTATION-DECISIONS.md)** | **← USE THIS** — Final decision checklist |
