---
phase: 07-appshell-seo-integration
plan: "07-02"
subsystem: ui
tags: [react, iframe, zustand, tailwind, shadcn]

requires:
  - phase: 06-clerk-per-client-workspace-integration
    provides: useClientStore with activeClientId selector

provides:
  - SeoAuditPage React component rendering open-seo via full-bleed iframe
  - REACT_APP_SEO_AUDIT_URL env var documented in env_template.txt

affects:
  - 07-03 (App.tsx route wiring will import SeoAuditPage)

tech-stack:
  added: []
  patterns:
    - "iframe integration: cross-origin app embedded via full-bleed iframe with React key re-mount on client switch"
    - "env var override: REACT_APP_SEO_AUDIT_URL=<url> at build time replaces default https://app.openseo.so"

key-files:
  created:
    - AI-Writer/frontend/src/pages/SeoAuditPage.tsx
    - AI-Writer/frontend/env_template.txt
  modified: []

key-decisions:
  - "Use React key=activeClientId on <iframe> to force re-mount (not just src update) when client switches — guarantees open-seo re-initializes its own client context"
  - "Pass client_id as URL query param (?client_id=<uuid>) since cross-origin iframes cannot set custom request headers"
  - "wrapper div uses flex-1 h-full w-full overflow-hidden to prevent double scrollbars inside AppShell <main>"

patterns-established:
  - "SeoAuditPage: useClientStore selector pattern — (s) => s.activeClientId for single-field reactive subscription"
  - "useMemo for URL construction — iframeSrc recomputes only when activeClientId changes"

requirements-completed: [SHELL-02, SHELL-03, SHELL-05]

duration: 8min
completed: 2026-04-17
---

# Phase 7 Plan 02: SeoAuditPage iframe component Summary

**Full-bleed iframe component embedding open-seo via `?client_id=<uuid>` with React key re-mount on active client switch, ready for App.tsx route wiring in plan 07-03**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-17T22:15:00Z
- **Completed:** 2026-04-17T22:23:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `SeoAuditPage.tsx` — standalone React page component that embeds the open-seo app in a borderless full-bleed iframe
- Active client UUID is passed as `?client_id=<uuid>` URL query param, computed via `useMemo` from `useClientStore`'s `activeClientId`
- React `key={activeClientId}` forces a full iframe re-mount (not just `src` attribute update) on client switch, guaranteeing open-seo re-initializes with the new client context
- `REACT_APP_SEO_AUDIT_URL` env var documented in `env_template.txt` so operators can point the iframe at staging or prod deployments

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SeoAuditPage with iframe + activeClientId query param** - `1ca6c08` (feat)
2. **Task 2: Document REACT_APP_SEO_AUDIT_URL in env_template.txt** - `464aec3` (chore)

## Files Created/Modified

- `AI-Writer/frontend/src/pages/SeoAuditPage.tsx` — React FC: reads `activeClientId` from `useClientStore`, builds `iframeSrc` via `useMemo`, renders `<iframe key={activeClientId} src={iframeSrc} title="SEO Audit" className="w-full h-full border-0 block" />`
- `AI-Writer/frontend/env_template.txt` — Added `REACT_APP_SEO_AUDIT_URL=https://app.openseo.so` under new "SEO Audit" section

## Decisions Made

- **React key re-mount strategy:** Using `key={activeClientId ?? 'no-client'}` forces React to unmount and remount the `<iframe>` element on client switch. This is preferable to just updating `src` because open-seo may retain stale in-memory state (WebSocket connections, route state, local component state) from the previous client if the DOM element is reused.
- **URL query param over postMessage:** Cross-origin iframes cannot receive custom HTTP headers set by the parent. The `?client_id=` query param approach is simpler and does not require a service worker or postMessage listener. The open-seo `resolveClientId()` function (plan 07-01) reads this param as a fallback.
- **`overflow-hidden` on wrapper:** The AppShell `<main>` has `overflow-y-auto`, so setting `overflow-hidden` on the wrapper div prevents the outer container from growing to the iframe's content height, which would create a double scrollbar.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The worktree's `.gitignore` excludes `AI-Writer/` and `open-seo-main/`, so `git add` failed initially. Applied `git add -f` to force-add source files — consistent with how other phase worktrees handle cross-repository commits in this project.

## Known Stubs

None — `SeoAuditPage` always renders the iframe (using the `base` URL when no client is active), and the `iframeSrc` is always a real URL derived from `REACT_APP_SEO_AUDIT_URL` or the default `https://app.openseo.so`.

## Threat Surface

| Flag | File | Description |
|------|------|-------------|
| T-07-05 (accepted) | SeoAuditPage.tsx | `client_id` UUID appears in iframe `src` URL — in browser history and network logs. Accepted per plan threat model: UUID is not PII. |
| T-07-06 (mitigated by 07-01) | SeoAuditPage.tsx | User can edit iframe URL to spoof a different `client_id`. Mitigated server-side by `resolveClientId()` (plan 07-01) validating UUID and `ensureUserMiddleware` scoping by Clerk session. |

## Next Phase Readiness

- `SeoAuditPage` is a standalone, default-exported React component ready for import in `App.tsx`
- Plan 07-03 can directly `import SeoAuditPage from './pages/SeoAuditPage'` and add the `/clients/:clientId/seo` route
- `env_template.txt` documents the override for staging/prod deployments

---
*Phase: 07-appshell-seo-integration*
*Completed: 2026-04-17*
