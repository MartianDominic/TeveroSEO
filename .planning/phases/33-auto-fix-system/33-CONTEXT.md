# Phase 33: Auto-Fix System with Granular Revert - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via autonomous workflow)

## Phase Boundary

Apply safe SEO fixes automatically. Track all changes with before/after snapshots. Granular revert by: single item, field, page, category, batch, date range, full site.

## Success Criteria

1. `site_changes` table with: before_value, after_value, field, status, revertedAt
2. `change_backups` table stores full resource state for complex reverts
3. Edit recipes defined for each auto-fixable check
4. Safe fixes auto-applied: alt text, image dimensions, heading hierarchy, canonical, lazy loading
5. Complex fixes flagged for review: content expansion, title rewrites, H1 changes
6. Revert UI at `/clients/[id]/changes` with filter by category, date, status
7. One-click revert for: single change, page, category, batch, date range
8. Automatic revert triggers: traffic drop >20%, ranking drop >5 positions

## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per autonomous workflow. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

## Existing Code Insights

Codebase context will be gathered during plan-phase research.

**Design doc:** `.planning/design/site-connection-audit-autoedit-revert-system.md`
**Depends on:** Phase 31 (platform adapters), Phase 32 (check findings)
**Working directory:** `apps/web/`, `open-seo-main/`
**Current state:** 0% — Zero auto-fix implementation

## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

## Deferred Ideas

None — discuss phase skipped.
