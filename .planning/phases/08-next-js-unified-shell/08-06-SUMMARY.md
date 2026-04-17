---
phase: 08-next-js-unified-shell
plan: "06"
subsystem: apps/web
tags: [next-js, zustand, article-editor, settings, seo-iframe, proxy-routes]
dependency_graph:
  requires: [08-04]
  provides: [article-library-page, article-editor-page, article-new-page, seo-iframe-page, settings-page, article-stores, article-proxy-routes]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [zustand-persist, next-dynamic-ssr-false, sanitize-ai-html, clerk-iframe-handoff]
key_files:
  created:
    - apps/web/src/stores/articleEditorStore.ts
    - apps/web/src/stores/articleLibraryStore.ts
    - apps/web/src/app/api/articles/route.ts
    - apps/web/src/app/api/articles/[articleId]/route.ts
    - apps/web/src/app/api/global-settings/route.ts
    - apps/web/src/components/editor/ImageGenerationPanel.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/articles/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/articles/new/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/articles/[articleId]/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/page.tsx
    - apps/web/src/app/(shell)/settings/page.tsx
  modified:
    - apps/web/src/stores/index.ts
    - apps/web/.env.example
decisions:
  - "Article type defined inline in articleLibraryStore to avoid importing from CRA contentCalendarStore"
  - "New article page is standalone (static /articles/new takes priority over [articleId] dynamic segment)"
  - "ImageGenerationPanel loaded via next/dynamic with ssr:false to avoid browser-API SSR failures"
  - "sanitizeAiHtml strips script/iframe/inline-event-handlers before HTML rendering (AI content only)"
  - "SEO iframe passes clientId + Clerk JWT token as query params (cross-origin iframes cannot set headers)"
  - "SEO iframe URL confirmed as app.openseo.so from nginx.conf (not seo.tevero.lt)"
  - "NEXT_PUBLIC_OPEN_SEO_URL env var added, deleted in Phase 10 when open-seo absorbed"
  - "global-settings proxy route maps to /api/settings/global on FastAPI backend"
  - "[articleId]/route.ts includes POST handler for /approve and /generate sub-routes forwarded via query string"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 11
  files_modified: 2
---

# Phase 08 Plan 06: Article Pages + Settings + SEO Iframe Port Summary

Second batch of AI-Writer page ports: 5 pages (article library, article editor, new article, SEO iframe, global settings), 2 Zustand stores, 3 FastAPI proxy routes, and 1 editor component.

## Pages Ported

- [x] `GET /clients/[clientId]/articles` — ArticleLibraryPage with recharts sparkline, bulk actions, rank history expand/collapse
- [x] `GET /clients/[clientId]/articles/new` — NewArticlePage (standalone; static segment takes priority over [articleId])
- [x] `GET /clients/[clientId]/articles/[articleId]` — ArticleEditorPage with voice blend, generate/approve/publish flow
- [x] `GET /clients/[clientId]/seo` — SEO iframe stub pointing at app.openseo.so (Phase 10 replaces)
- [x] `GET /settings` — GlobalSettingsPage with API Integrations / Voice Templates / Model Defaults tabs

## Editor Sub-component Files Ported

1 file: `ImageGenerationPanel.tsx`

The CRA `AI-Writer/frontend/src/components/editor/` directory contained only `ImageGenerationPanel.tsx` at the time of execution. All other editor UI is embedded directly in the page components (ArticleEditorPage renders the form and preview inline).

## CopilotKit Integration Status

Not present in the CRA editor source at time of port. The `@copilotkit` packages were not installed and the ArticleEditorPage did not import any CopilotKit providers. No action required.

## SEO Iframe Behaviour Notes

- **URL confirmed:** `app.openseo.so` (from `docker/nginx/nginx.conf` line 43)
- **Auth handoff:** Clerk JWT token passed as `?token=<jwt>` query param; clientId passed as `?client_id=<uuid>`
- **Why query params:** Cross-origin iframes cannot set custom request headers; query params are the only reliable handoff mechanism
- **Cross-frame postMessage sync** (nav events, theme, etc.) is deferred to Phase 10 — Phase 8 provides raw embed only
- **TEMPORARY:** `NEXT_PUBLIC_OPEN_SEO_URL` env var and `/clients/[clientId]/seo/page.tsx` both deleted in Phase 10

## Proxy Routes Added

| Route | Methods | FastAPI target |
|-------|---------|----------------|
| `/api/articles` | GET, POST | `/api/articles` (with query forwarding) |
| `/api/articles/[articleId]` | GET, PATCH, DELETE, POST | `/api/articles/:id` (POST covers /approve, /generate sub-routes) |
| `/api/global-settings` | GET, PATCH | `/api/settings/global` |

## Outstanding Proxy Routes (Deferred to Plan 08-08)

The following routes are called by the ported pages at runtime but not yet proxied:

- `/api/clients/[clientId]/articles/[articleId]/rank-history` — called by ArticleLibraryPage rank history
- `/api/article-images/generate` — called by ImageGenerationPanel
- `/api/voice-templates` — GET/POST/PATCH/DELETE (GlobalSettings + ArticleEditor)
- `/api/platform-secrets/*` — GET/PUT/DELETE/POST (GlobalSettings API integrations tab)
- `/api/clients/[clientId]/intelligence` — called by ArticleEditorPage for keyword suggestions

These routes all go through the same FastAPI backend. Plan 08-08 should add their proxy handlers if not already added by plan 08-05.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] HTML sanitization in ArticleHtmlPreview**
- **Found during:** Task 2
- **Issue:** Rendering AI-generated HTML needed explicit client-side sanitization function in addition to server-side stripping
- **Fix:** Added `sanitizeAiHtml()` function that strips script, iframe, and inline event handlers before rendering; defence-in-depth (backend also sanitises)
- **Files modified:** `[articleId]/page.tsx`, `articles/new/page.tsx`

**2. [Rule 1 - Bug] New article page route priority**
- **Found during:** Task 2
- **Issue:** In Next.js App Router, static segments take priority over dynamic segments. `/articles/new` hits `new/page.tsx` before `[articleId]/page.tsx`. The original plan assumed the CRA pattern of `articleId="new"` would work.
- **Fix:** Created `new/page.tsx` as a full standalone new-article creation page. After generation, navigates to `/articles/[newArticleId]`.
- **Files modified:** `articles/new/page.tsx`

## Known Stubs

None — all pages wire real data from the article stores and proxy routes.

## Threat Flags

None — no new network endpoints beyond documented proxy routes. SEO iframe passes Clerk JWT as a query parameter only to our own controlled service (app.openseo.so), consistent with Phase 7 design.

## Self-Check: PASSED

Files verified present:
- `apps/web/src/stores/articleEditorStore.ts` — FOUND
- `apps/web/src/stores/articleLibraryStore.ts` — FOUND
- `apps/web/src/app/api/articles/route.ts` — FOUND
- `apps/web/src/app/api/articles/[articleId]/route.ts` — FOUND
- `apps/web/src/app/api/global-settings/route.ts` — FOUND
- `apps/web/src/components/editor/ImageGenerationPanel.tsx` — FOUND
- `apps/web/src/app/(shell)/clients/[clientId]/articles/page.tsx` — FOUND
- `apps/web/src/app/(shell)/clients/[clientId]/articles/new/page.tsx` — FOUND
- `apps/web/src/app/(shell)/clients/[clientId]/articles/[articleId]/page.tsx` — FOUND
- `apps/web/src/app/(shell)/clients/[clientId]/seo/page.tsx` — FOUND
- `apps/web/src/app/(shell)/settings/page.tsx` — FOUND

Commits present in git log: 6f101ce, 78b7bbe, 13fae6d

TypeScript: `tsc --noEmit` exits 0
Build: `pnpm --filter @tevero/web build` exits 0
