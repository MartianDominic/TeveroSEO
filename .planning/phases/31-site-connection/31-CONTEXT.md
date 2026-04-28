# Phase 31: Site Connection & Platform Detection - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

## Phase Boundary

Unified site connection model with platform auto-detection. Connects to WordPress, Shopify, Wix, Squarespace, Webflow, custom sites. Write permission verification. Encrypted credential storage.

## Success Criteria

1. `site_connections` table with: clientId, platform, credentials (encrypted), capabilities, status
2. `detectPlatform(domain)` auto-detects WordPress, Shopify, Wix from headers/HTML
3. Connection wizard guides user through OAuth or API key setup per platform
4. Write permission verified before marking connection as active
5. `/clients/[id]/connections` shows all connected platforms with status
6. Platform adapters support: read content, write content, read meta, write meta

## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

## Existing Code Insights

Codebase context will be gathered during plan-phase research.

**Design doc:** `.planning/design/site-connection-audit-autoedit-revert-system.md`
**Depends on:** Phase 12 (per-client credentials system exists)
**Working directory:** `apps/web/`, `open-seo-main/`
**Current state:** 20% — WordPress adapter exists for publishing only, no unified model

## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

## Deferred Ideas

None — discuss phase skipped.
