---
phase: 31
plan: 03
subsystem: site-connection
tags: [ui, wizard, connections, cms]
dependency-graph:
  requires:
    - 31-01 (platform adapters)
    - 31-02 (API routes, siteConnections.ts client library)
  provides:
    - ConnectionWizard component
    - PlatformCredentialsForm component
    - SiteConnectionList component
    - Integrated connections page with CMS section
  affects:
    - apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx
tech-stack:
  added: []
  patterns:
    - 3-step wizard flow (detect -> credentials -> verify)
    - Platform-specific form configuration
    - Dialog overlay for modal wizard
key-files:
  created:
    - apps/web/src/components/connections/ConnectionWizard.tsx
    - apps/web/src/components/connections/PlatformCredentialsForm.tsx
    - apps/web/src/components/connections/SiteConnectionList.tsx
    - apps/web/src/components/connections/index.ts
  modified:
    - apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx
decisions:
  - Used modal overlay instead of Dialog component for simpler integration
  - Platform fields configured as static object rather than fetched from API
  - Silent fail on CMS connection load to not break OAuth section
metrics:
  duration: 213s
  completed: 2026-04-22T19:50:37Z
---

# Phase 31 Plan 03: Connection Wizard UI Summary

3-step wizard for CMS connections with platform-specific credential forms, integrated into existing connections page alongside OAuth providers.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 4067c324f | ConnectionWizard with detect/credentials/verify steps |
| 2 | fcbbd90fd | PlatformCredentialsForm with 5 platform field configs |
| 3 | 29c120156 | SiteConnectionList and page integration |

## Implementation Details

### ConnectionWizard.tsx
- 3-step flow: detect -> credentials -> verify
- Step indicator with progress visualization
- Calls detectPlatform, createSiteConnection, verifySiteConnection from siteConnections.ts
- Auto-verify on connection creation
- Error handling with retry option

### PlatformCredentialsForm.tsx
- Platform-specific field configurations for:
  - WordPress: username + appPassword
  - Shopify: accessToken
  - Wix: siteId + accessToken
  - Squarespace: siteId + apiKey
  - Webflow: siteId + accessToken
- Help links with rel="noopener noreferrer" (T-31-08 mitigation)
- All credential fields use type="password" (T-31-07 mitigation)
- Custom/pixel platforms show "coming soon" message

### SiteConnectionList.tsx
- Displays connections with status icon, platform, verification date
- Verify and delete action buttons with loading states
- Confirm dialog before delete (T-31-09 mitigation)
- Empty state with icon when no connections

### Page Integration
- New "CMS Connections" section at top of page
- "Add CMS Connection" button opens wizard modal
- Visual separator between CMS and OAuth sections
- Preserved existing OAuth providers section unchanged
- loadSiteConnections callback with silent fail

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Description | Mitigation |
|-----------|-------------|------------|
| T-31-07 | Information Disclosure - Form fields | type="password" on all credential inputs |
| T-31-08 | Spoofing - Help links | rel="noopener noreferrer" on external links |
| T-31-09 | Tampering - Delete action | Confirm dialog before delete operation |

## Verification

- Build check: `pnpm --filter web build` passed
- All 3 new components export correctly via index.ts barrel
- Page integrates both new components

## Self-Check: PASSED

- [x] apps/web/src/components/connections/ConnectionWizard.tsx exists
- [x] apps/web/src/components/connections/PlatformCredentialsForm.tsx exists
- [x] apps/web/src/components/connections/SiteConnectionList.tsx exists
- [x] apps/web/src/components/connections/index.ts exists
- [x] Commit 4067c324f exists
- [x] Commit fcbbd90fd exists
- [x] Commit 29c120156 exists
