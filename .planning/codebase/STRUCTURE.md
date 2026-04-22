# Codebase Structure

**Analysis Date:** 2026-04-22

## Directory Layout

```
TeveroSEO/
├── apps/
│   └── web/                    # Next.js 15 frontend application
├── packages/
│   ├── types/                  # Shared TypeScript interfaces (@tevero/types)
│   └── ui/                     # Shared design system (@tevero/ui)
├── docker/                     # Docker configuration files
│   ├── nginx/                  # Nginx reverse proxy config
│   ├── postgres/               # PostgreSQL initialization
│   ├── puppeteer/              # Puppeteer/Chrome for scraping
│   └── redis/                  # Redis configuration
├── .planning/                  # Planning documents
│   ├── codebase/               # Codebase analysis documents
│   ├── design/                 # Design documents
│   └── phases/                 # Phase-based implementation plans
├── AI-Writer/                  # External: Python FastAPI backend (submodule)
├── open-seo-main/              # External: Open-SEO backend service (submodule)
├── docs/                       # Project documentation
├── .github/workflows/          # CI/CD workflows
├── package.json                # Root workspace package.json
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── pnpm-lock.yaml              # Lock file
└── docker-compose.vps.yml      # VPS deployment compose file
```

## Directory Purposes

**`apps/web/`:**
- Purpose: Main Next.js frontend application
- Contains: React components, pages, API routes, server actions
- Key files: `package.json`, `next.config.ts`, `tsconfig.json`

**`apps/web/src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components, layouts, route handlers
- Key files: `layout.tsx`, `page.tsx`, route group folders

**`apps/web/src/app/(shell)/`:**
- Purpose: Authenticated application routes within AppShell
- Contains: Dashboard, clients, prospects, settings pages
- Key files: `layout.tsx` (wraps with AppShell)

**`apps/web/src/app/api/`:**
- Purpose: BFF API endpoints proxying to backend services
- Contains: REST route handlers (`route.ts`)
- Key files: `clients/route.ts`, `dashboard/*/route.ts`

**`apps/web/src/components/`:**
- Purpose: Reusable React components by feature domain
- Contains: Feature-specific components
- Key files: Component `.tsx` files organized by folder

**`apps/web/src/actions/`:**
- Purpose: Server Actions for SSR data fetching
- Contains: `"use server"` functions
- Key files: `analytics/*.ts`, `dashboard/*.ts`, `seo/*.ts`

**`apps/web/src/lib/`:**
- Purpose: Shared utilities and business logic
- Contains: API clients, caching, WebSocket, helpers
- Key files: `server-fetch.ts`, `api-client.ts`, `cache/`, `websocket/`

**`apps/web/src/stores/`:**
- Purpose: Zustand state management stores
- Contains: Client-side global state
- Key files: `clientStore.ts`, `analyticsStore.ts`, `index.ts`

**`apps/web/src/hooks/`:**
- Purpose: Custom React hooks
- Contains: Data fetching, UI behavior hooks
- Key files: `usePaginatedClients.ts`, `useGoalMutations.ts`

**`apps/web/src/types/`:**
- Purpose: App-specific TypeScript interfaces
- Contains: Types not shared with other packages
- Key files: `pagination.ts`, `goals.ts`, `patterns.ts`

**`packages/types/`:**
- Purpose: Shared TypeScript interfaces across packages
- Contains: Domain entity types
- Key files: `src/client.ts`, `src/oauth.ts`, `src/reports.ts`

**`packages/ui/`:**
- Purpose: Shared design system components
- Contains: Radix-based UI primitives
- Key files: `src/components/*.tsx`, `src/index.ts` (barrel export)

## Key File Locations

**Entry Points:**
- `apps/web/src/app/layout.tsx`: Root layout with ClerkProvider
- `apps/web/src/app/(shell)/layout.tsx`: Authenticated shell layout
- `apps/web/src/app/page.tsx`: Landing/redirect page

**Configuration:**
- `apps/web/package.json`: Web app dependencies
- `apps/web/tsconfig.json`: TypeScript configuration with `@/*` path alias
- `apps/web/next.config.ts`: Next.js configuration
- `apps/web/vitest.config.ts`: Test configuration

**Core Logic:**
- `apps/web/src/lib/server-fetch.ts`: Backend API communication
- `apps/web/src/lib/cache/redis-cache.ts`: Redis caching utilities
- `apps/web/src/stores/clientStore.ts`: Active client state management

**Shell/Navigation:**
- `apps/web/src/components/shell/AppShell.tsx`: Main application shell (636 lines)
- `apps/web/src/components/shell/TopBar.tsx`: Header navigation
- `apps/web/src/components/shell/CommandPalette.tsx`: Cmd+K search

**Dashboard:**
- `apps/web/src/app/(shell)/dashboard/page.tsx`: Agency command center
- `apps/web/src/app/(shell)/dashboard/actions.ts`: Dashboard server actions
- `apps/web/src/lib/dashboard/types.ts`: Dashboard type definitions

**Testing:**
- `apps/web/src/components/reports/__tests__/`: Report component tests
- `apps/web/vitest.setup.ts`: Test setup file

## Naming Conventions

**Files:**
- Components: PascalCase (`ClientPortfolioTable.tsx`)
- Hooks: camelCase with `use` prefix (`useGoalMutations.ts`)
- Server Actions: kebab-case (`get-clients-paginated.ts`)
- Types: camelCase (`pagination.ts`)
- Stores: camelCase with `Store` suffix (`clientStore.ts`)

**Directories:**
- Feature folders: lowercase (`dashboard/`, `analytics/`)
- Route groups: parentheses (`(shell)/`)
- Dynamic routes: brackets (`[clientId]/`, `[...slug]/`)

**Exports:**
- Components: Named exports (`export const Button`)
- Hooks: Named exports (`export function useClientStore`)
- Types: Type exports (`export type { Client }`)

## Where to Add New Code

**New Feature:**
- Primary code: `apps/web/src/components/{feature}/`
- Server Actions: `apps/web/src/actions/{feature}/`
- API Routes: `apps/web/src/app/api/{feature}/route.ts`
- Tests: `apps/web/src/components/{feature}/__tests__/`

**New Page/Route:**
- Page: `apps/web/src/app/(shell)/{route}/page.tsx`
- Layout (if needed): `apps/web/src/app/(shell)/{route}/layout.tsx`
- Actions: `apps/web/src/app/(shell)/{route}/actions.ts`

**New Component:**
- Feature-specific: `apps/web/src/components/{feature}/{ComponentName}.tsx`
- Shared UI primitive: `packages/ui/src/components/{component}.tsx`
- Add to barrel: Update `packages/ui/src/index.ts`

**New Hook:**
- App-level: `apps/web/src/hooks/use{HookName}.ts`
- Feature-specific: `apps/web/src/lib/hooks/use{HookName}.ts`

**New Shared Type:**
- Cross-package: `packages/types/src/{domain}.ts` + export in `index.ts`
- App-only: `apps/web/src/types/{domain}.ts`

**Utilities:**
- Shared helpers: `apps/web/src/lib/{utility}.ts`
- Feature helpers: `apps/web/src/lib/{feature}/{utility}.ts`

## Special Directories

**`apps/web/.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

**`node_modules/`:**
- Purpose: Dependencies
- Generated: Yes (pnpm)
- Committed: No

**`.planning/`:**
- Purpose: Implementation planning and codebase analysis
- Generated: No (manually maintained)
- Committed: Yes

**`AI-Writer/` and `open-seo-main/`:**
- Purpose: External backend services (likely git submodules)
- Generated: No
- Committed: As submodule references

**`apps/web/src/i18n/messages/`:**
- Purpose: Internationalization message files
- Generated: No
- Committed: Yes

## Component Organization by Feature

```
components/
├── alerts/           # Alert display and management
├── analytics/        # GA4/GSC charts and tables
├── App/              # App-level wrappers
├── brand/            # Brand assets (logos)
├── ClientSwitcher/   # Client selection dropdown
├── dashboard/        # Agency dashboard widgets
├── editor/           # Article/content editor
├── goals/            # Goal setting and tracking
├── keywords/         # Keyword research UI
├── onboarding/       # First-run experience
├── prospects/        # Lead/prospect management
├── reports/          # Report generation and preview
├── seo/              # SEO audit components
│   └── audit/        # Detailed audit views
├── settings/         # Settings forms
├── shell/            # App shell (sidebar, topbar)
├── team/             # Team management
└── webhooks/         # Webhook configuration
```

## API Route Organization

```
app/api/
├── analytics/[clientId]/           # Analytics data per client
├── articles/[articleId]/           # Article CRUD
├── client-intelligence/[clientId]/ # AI-powered insights
├── client-settings/[clientId]/     # Per-client settings
├── clients/[clientId]/             # Client CRUD
├── content-calendar/[eventId]/     # Calendar events
├── dashboard/                      # Dashboard aggregates
├── global-settings/                # Platform settings
├── health/                         # Health check
├── platform-secrets/status/        # API key status
├── reports/[id]/                   # Report CRUD
├── sparkline/[clientId]/           # Trend data
└── voice-templates/                # Content voice config
```

---

*Structure analysis: 2026-04-22*
