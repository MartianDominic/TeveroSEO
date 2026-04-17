---
phase: 7
title: AppShell SEO Integration
type: feature
discuss_skipped: true
discuss_skip_reason: All decisions are technical — React routing, iframe vs direct component, nav registration, X-Client-ID forwarding. Design tokens already established by existing shadcn/ui + Tailwind setup.
---

# Phase 7 Context: AppShell SEO Integration

## Goal

SEO audit and keyword tools appear as a nav section in the AI-Writer AppShell; active client context passes automatically to open-seo pages.

## Success Criteria

- "SEO Audit" nav item visible in AI-Writer sidebar; clicking it loads open-seo pages without a page reload (SHELL-01)
- `/seo/*` routes in AI-Writer React app proxy/redirect to open-seo-main via nginx (SHELL-02)
- open-seo pages render inside AI-Writer AppShell with same chrome + client context (SHELL-03)
- Active client `client_id` passed as `X-Client-ID` header to open-seo pages on navigation (SHELL-04)
- open-seo pages use same shadcn/ui + Tailwind design tokens: StatusChip, PageHeader, typography (SHELL-05)

## Requirements Addressed

SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05

## Key Decisions (Claude's Discretion)

### Integration Pattern (SHELL-02, SHELL-03)
- Use an `<iframe>` approach: AI-Writer AppShell renders an iframe pointing to `https://app.openseo.so/` for the `/seo/*` routes
- iframe src includes `?client_id=<uuid>` query param (or AI-Writer sets `X-Client-ID` header via a service worker / fetch proxy if same-origin, otherwise URL param)
- Alternative: direct React route in AI-Writer that proxies via API, but iframe is simpler and keeps apps fully independent
- **Decision: iframe** — keeps open-seo-main fully independent; no shared bundle; easy to update
- nginx config already routes `app.openseo.so` → `open-seo:3001`; iframe just points to that domain

### Client ID Passing (SHELL-04)
- Since open-seo and AI-Writer are on different origins (cross-origin iframe), headers cannot be set directly
- Pass `client_id` as URL query param: `https://app.openseo.so/?client_id=<uuid>`
- open-seo-main reads `client_id` from URL query param as fallback to `X-Client-ID` header
- AI-Writer posts message to iframe when client switches via `window.postMessage` + iframe `contentWindow.location.replace`

### Nav Registration (SHELL-01)
- Add "SEO Audit" item to AI-Writer's existing sidebar nav component
- Icon: `Search` from lucide-react (already installed in AI-Writer)
- Route: `/seo` → renders `SeoShell` component with iframe
- Use existing nav registration pattern (look for `navItems` or `routes` in AI-Writer AppShell code)

### Design Tokens (SHELL-05)
- open-seo pages are served from a different domain — full shadcn/ui token replication is not feasible across origins
- **Scope**: ensure the iframe container in AI-Writer uses correct border, padding, and height (fills available content area)
- open-seo-main already uses its own shadcn/ui + Tailwind setup (Phase 2 completed this)
- StatusChip and PageHeader are open-seo-internal components — no changes needed from AI-Writer side
- **Decision**: SHELL-05 is satisfied by: open-seo-main uses shadcn/ui (already true); iframe fills full content area with no border/scroll artifacts

### nginx Routing for /seo (SHELL-02)
- AI-Writer frontend is a React SPA served by nginx:alpine on port 80
- `/seo/*` routes are handled by React Router (client-side) — no nginx proxy needed for the AI-Writer shell itself
- nginx only needs to ensure the SPA fallback (`try_files $uri /index.html`) covers `/seo/*`
- This is already the standard SPA nginx config — likely already in place

### open-seo client_id Query Param Support
- Phase 6 implemented `X-Client-ID` header; need to also support `?client_id=` URL param as fallback
- Add to `resolveClientId()` in `open-seo-main/src/server/lib/client-context.ts`: if header absent, read from request URL query params
- This allows iframe `src="https://app.openseo.so/?client_id=abc"` to work without header injection

### Working Directory
- `AI-Writer/frontend/` — add SEO nav item + SeoShell iframe component
- `open-seo-main/src/server/lib/client-context.ts` — add query param fallback for client_id

### Existing Pattern Reference
- `AI-Writer/frontend/src/` — look for AppShell, sidebar nav, route registration
- `open-seo-main/src/server/lib/client-context.ts` — extend resolveClientId

### Wave Structure
- Wave 1: open-seo client_id query param support + SeoShell component
- Wave 2: Nav registration in AI-Writer AppShell + verification
