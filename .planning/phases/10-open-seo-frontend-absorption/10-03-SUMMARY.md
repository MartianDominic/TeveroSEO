---
phase: 10-open-seo-frontend-absorption
plan: 03
status: complete
completed_at: 2026-04-18T12:30:00Z
---

# Summary: Port Audit Page and [projectId] Layout

## What Was Built

Created the `[projectId]` layout with TanStack Query provider and ported the audit pages including the main audit page and Lighthouse issues detail page.

### Key Files Created

**Layout:**
- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/layout.tsx` - QueryClientProvider wrapper

**Audit Pages:**
- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/page.tsx` - Full audit page with:
  - LaunchView: Start new audits, view history
  - AuditDetail: View running/completed audit status
  - ProgressCard: Real-time crawl progress with polling
  - ResultsView: Summary cards and pages table
- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/issues/[resultId]/page.tsx` - Lighthouse issues detail

**Supporting Files:**
- `apps/web/src/lib/seo/shared.ts` - Utility functions (extractHostname, formatStartedAt, etc.)
- `apps/web/src/components/seo/audit/StatusBadge.tsx` - Status and HTTP status badge components

## Technical Approach

1. **TanStack Query Integration**: Layout provides QueryClientProvider with 30s staleTime and 1 retry
2. **Server Actions**: All data fetching uses server actions from `@/actions/seo/audit`
3. **Real-time Updates**: Audit status polling every 3s while running, crawl progress every 1.5s
4. **@tevero/ui Components**: Button, Card, Badge, Input, Select, Label, Tabs

## Verification

- `pnpm --filter web build` passes
- Routes render:
  - `/clients/[clientId]/seo/[projectId]/audit`
  - `/clients/[clientId]/seo/[projectId]/audit/issues/[resultId]`
- No TanStack Router imports in ported files

## Self-Check: PASSED

All must_haves verified:
- [x] GET /clients/[clientId]/seo/[projectId]/audit renders the site audit page
- [x] The audit page shows LaunchView when no auditId is in the URL
- [x] The audit page shows AuditDetail with polling when auditId is present
- [x] GET /clients/[clientId]/seo/[projectId]/audit/issues/[resultId] renders Lighthouse issues
- [x] A layout wraps all [projectId] routes providing TanStack Query context
