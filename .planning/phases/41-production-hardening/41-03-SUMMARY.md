---
phase: 41
plan: "03"
subsystem: intelligence
tags: [autonomous-pipeline, gsc, content-generation, quality-gate]
dependency_graph:
  requires: [gsc_service, article_generation_service, quality_gate, open_seo_api]
  provides: [autonomous_seo_cycle, opportunity_detection]
  affects: [scheduled_jobs, publishing_pipeline]
tech_stack:
  added: []
  patterns: [async_pipeline, scheduled_job, service_orchestration]
key_files:
  created:
    - AI-Writer/backend/services/intelligence/autonomous_pipeline.py
  modified:
    - AI-Writer/backend/services/scheduler/__init__.py
decisions:
  - Use auto_publish flag as proxy for auto_optimize (clients who want auto-publish also want auto-optimization)
  - CTR opportunity threshold: 50% of expected CTR for position
  - Rate limit 5 seconds between clients in daily cycle
  - 3 AM UTC scheduled job (avoids peak hours)
metrics:
  duration: 4m 16s
  completed: 2026-04-25
---

# Phase 41 Plan 03: Autonomous Pipeline Wiring Summary

Wired autonomous_pipeline.py stub to use existing services (GSC, article generation, quality gate) to create a functional autonomous SEO cycle.

## One-liner

GSC opportunity detection with CTR analysis, brief creation, article generation, and quality gate validation at 3 AM daily.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement opportunity detection from GSC | 74ab7892 | autonomous_pipeline.py |
| 2 | Implement brief creation from opportunity | 74ab7892 | autonomous_pipeline.py |
| 3 | Implement article generation trigger | 74ab7892 | autonomous_pipeline.py |
| 4 | Implement quality gate check | 74ab7892 | autonomous_pipeline.py |
| 5 | Implement full autonomous cycle | 74ab7892 | autonomous_pipeline.py |
| 6 | Add scheduled job for autonomous cycle | 74ab7892 | scheduler/__init__.py |

## Implementation Details

### Opportunity Detection (`detect_opportunities`)

Uses GSC search analytics to find keywords where:
- Impressions > 100 (significant visibility)
- Position <= 20 (potentially rankable)
- CTR < 50% of expected CTR for position

Priority scoring combines:
- Impression score (log-scaled, 0-10)
- Position score (closer to position 1 = higher)
- CTR gap score (larger gap = more opportunity)

### CTR Curve

Industry standard expected CTR by position:
| Position | Expected CTR |
|----------|--------------|
| 1 | 28% |
| 2 | 15% |
| 3 | 11% |
| 4 | 8% |
| 5 | 6% |
| 6-10 | 2-5% |

### Full Cycle Steps

1. Get client site URL from database
2. Detect opportunities from GSC data (last 28 days)
3. Create content brief for top opportunity via open-seo API
4. Generate article with brief context (H2s, PAA questions)
5. Validate quality via open-seo quality gate
6. Auto-approve if score >= 80

### Scheduled Job

- **Trigger:** 3 AM UTC daily
- **ID:** `autonomous_seo_cycle`
- **Target:** All clients with `auto_publish=True`
- **Rate limit:** 5 seconds between clients
- **Grace time:** 1 hour (for server restarts)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Checklist

- [x] `detect_opportunities` returns real GSC-based opportunities
- [x] `create_brief_for_opportunity` calls open-seo API
- [x] `generate_article_from_brief` creates and generates article
- [x] `validate_article` checks quality gate score
- [x] `run_autonomous_cycle` executes full pipeline
- [x] Scheduled job runs at 3 AM daily

## Self-Check: PASSED

- [x] autonomous_pipeline.py exists and has valid syntax
- [x] scheduler/__init__.py imports and registers job
- [x] Commit 74ab7892 exists in AI-Writer repo
