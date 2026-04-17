# TeveroSEO v2.0 — Unified Product Overview

**Scoped:** 2026-04-17  
**Milestone:** v2.0 Unified Product (Phases 8–14)  
**Estimated total effort:** ~14–17 weeks

---

## The Problem v2.0 Solves

v1.0 unified the infrastructure: one VPS, one Docker compose, shared Postgres/Redis, CI/CD. But users still experience two separate products:

- Two logins (Clerk for AI-Writer, better-auth for open-seo)
- An iframe at `/clients/:id/seo` that loads a different domain
- Credentials (GSC, GA4) stored per-user in SQLite — not shareable across team
- No cross-client analytics view — managing 100 clients requires clicking into each one

v2.0 collapses this into one product.

---

## What Users Experience After v2.0

1. Visit `app.tevero.lt` — one login via Clerk
2. See a unified sidebar: Content, SEO Audit, Keywords, Backlinks, Analytics, Settings — all first-class routes, no iframes
3. Switch client from the header switcher — all tools update instantly
4. On the agency dashboard, see all 100 clients' organic traffic at a glance — anomalies flagged automatically
5. Send a client a magic link — they click it, authorize Google in one step, done — GSC + GA4 data flows in within 2 hours

---

## Architecture After v2.0

```
Browser → app.tevero.lt (nginx :443)
           └── apps/web (Next.js 15, :3000)
                ├── /                   → Agency dashboard (all clients)
                ├── /clients/[id]/*     → AI-Writer features (server actions → FastAPI)
                ├── /clients/[id]/seo/* → SEO features (server actions → open-seo API)
                ├── /clients/[id]/analytics → GSC + GA4 charts
                ├── /clients/[id]/connections → OAuth connection manager
                └── /connect/[token]    → Client self-service OAuth invite page

Internal (Docker network, no external ports):
  ai-writer-backend:8000  — FastAPI (Python) — unchanged
  open-seo-api:3001       — Node.js/Nitro — unchanged except auth
  postgres:5432           — shared DB
  redis:6379              — BullMQ + KV
```

`seo.tevero.lt` DNS record retired after Phase 10.  
`ai-writer-frontend` Docker container retired after Phase 8.  
`open-seo` Docker container becomes pure API after Phase 10 (no frontend routes).

---

## Phase Summary

### Phase 8 — Next.js Unified Shell (3 weeks)
Scaffold `apps/web` with Next.js 15 App Router. Port all 10 AI-Writer pages as App Router routes. `@clerk/nextjs` middleware protects `/clients/*`. Server actions call FastAPI internally. Replace `ai-writer-frontend` Docker container. nginx simplified to one server block.

**Key decisions:**
- Monorepo layout: `apps/web/`, `apps/ai-writer-backend/` (rename), `apps/open-seo-api/` (rename), `packages/ui/`, `packages/types/`
- pnpm workspaces
- Next.js 15 App Router (RSC by default, client components opt-in)
- `@clerk/nextjs` — first-class Clerk integration, middleware-based route protection

---

### Phase 9 — Shared UI Package + Design System (1 week)
Extract ~50 duplicated shadcn/ui components from AI-Writer frontend and open-seo into `packages/ui`. Single Tailwind config. Both `apps/web` (all routes) import from `@tevero/ui`. Consistent design tokens, spacing, colour palette across the entire product.

**Key decisions:**
- shadcn/ui components copied once into `packages/ui`, not re-generated per app
- Tailwind v4 (open-seo already on v4; upgrade apps/web at scaffold time)
- No Storybook required for v2.0 (can add later); basic component exports sufficient

---

### Phase 10 — open-seo Frontend Absorption (2–3 weeks)
Port open-seo's 7 project-scoped routes into `apps/web` as Next.js pages under `/clients/[id]/seo/*`. Each page calls open-seo Node.js API via server actions — no browser-to-open-seo direct calls. Delete open-seo's `_auth.*`, `_app/*`, `__root.tsx` frontend shell. open-seo becomes a pure API server. Remove iframe from `SeoAuditPage.tsx`. Retire `seo.tevero.lt`.

**Routes ported:**
| open-seo route | Next.js route |
|---|---|
| `/p/$projectId/audit` | `/clients/[id]/seo/[projectId]/audit` |
| `/p/$projectId/keywords` | `/clients/[id]/seo/[projectId]/keywords` |
| `/p/$projectId/backlinks` | `/clients/[id]/seo/[projectId]/backlinks` |
| `/p/$projectId/domain` | `/clients/[id]/seo/[projectId]/domain` |
| `/p/$projectId/saved` | `/clients/[id]/seo/[projectId]/saved` |
| `/p/$projectId/ai` | `/clients/[id]/seo/[projectId]/ai` |
| `/billing` | `/settings/billing` |

---

### Phase 11 — Clerk Auth Unified: open-seo Backend (1–2 weeks)
Replace better-auth in open-seo Node.js backend with Clerk JWT verification using `jose` (already a dependency). Drop `session`, `account`, `verification` tables. Add `clerk_user_id` to `user` table. All server functions pass `Authorization: Bearer <clerk_jwt>` from Next.js server actions. No user-facing change (Phase 10 already removed the auth UI).

**What's removed:** `better-auth` package, `src/server/lib/auth.ts` (better-auth init), `src/middleware/ensure-user/hosted.ts`, better-auth DB tables  
**What's added:** `src/server/lib/clerk-jwt.ts` (~60 lines, JWKS caching + verify), updated middleware

---

### Phase 12 — Per-Client Credentials System (3 weeks)
Credentials moved from per-user SQLite to per-client PostgreSQL. One Google OAuth covers GSC + GA4 + GBP. Magic-link invite page at `/connect/[token]` — clients authorize without an account. Connection status at `/clients/[id]/connections`.

**New tables (Alembic migration on AI-Writer backend):**
```sql
client_oauth_tokens      -- encrypted tokens per client per provider
client_oauth_properties  -- provider-specific metadata (site_url, property_id)
client_connect_invites   -- magic link tokens (7-day TTL, single-use)
```

**Providers in v2.0:**
- Google (GSC + GA4 + GBP) — one OAuth flow, three scopes
- Bing Webmaster Tools
- WordPress / Shopify / Wix (already exist, migrate to per-client storage)

**Migration:** existing per-user GSC/Bing SQLite credentials backfilled to `client_oauth_tokens` matched by user→client relationship where deterministic.

---

### Phase 13 — Analytics Data Layer (2 weeks)
BullMQ workers sync GSC and GA4 nightly for all clients with active tokens. 90-day backfill on first connect. Token refresh automated; failures flagged per client in connection status. Data cached in PostgreSQL — dashboard queries hit DB, not Google API.

**New tables:**
```sql
gsc_snapshots        -- daily aggregates per client (clicks, impressions, ctr, position)
gsc_query_snapshots  -- top 50 queries per client per day
ga4_snapshots        -- daily aggregates per client (sessions, users, conversions, revenue)
```

**Worker:** `sync-client-analytics` BullMQ job, runs 02:00 UTC, iterates all active `client_oauth_tokens` where `provider = 'google'`. Handles token refresh inline. Dead-letter queue for persistent failures.

---

### Phase 14 — Analytics UX: Agency Dashboard + Per-Client Views (2 weeks)
`/dashboard` — all clients, traffic health, anomaly flags, inline CTAs for unconnected clients.  
`/clients/[id]/analytics` — GSC + GA4 side by side, trend charts, top queries, position movement.

**Anomaly detection rules (v1):**
- Clicks down >20% week-over-week → "Drop" badge
- No sync in >48h → "Stale" badge  
- No Google connection → "Not connected" + inline invite CTA
- Token refresh failed → "Reconnect" badge

**Cross-feature insight (stretch):**  
Correlate article published date → ranking change 7/14/30 days later. Possible because content calendar, audit, and analytics are all in the same Next.js app hitting the same PostgreSQL.

---

## Dependencies Between Phases

```
08 (Next.js shell)
 └── 09 (Shared UI)
      └── 10 (Absorb open-seo frontend)
           └── 11 (Clerk auth in open-seo backend)
                └── 12 (Credentials system)
                     └── 13 (Analytics data layer)
                          └── 14 (Analytics UX)
```

Each phase is a shippable increment. After Phase 8 the product is usable (just no SEO integration yet). After Phase 10 the iframe is gone. After Phase 12 client onboarding is self-service. After Phase 14 the 100-client agency use case is fully supported.

---

## What Does NOT Change in v2.0

- AI-Writer FastAPI backend — zero changes
- open-seo Node.js crawler, BullMQ audit workers, DataForSEO integration — zero changes
- PostgreSQL schema for existing data (clients, audits, keywords) — additive only
- Docker VPS deployment model — extended, not replaced
- CI/CD GitHub Actions workflows — updated to build apps/web instead of CRA

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Next.js App Router learning curve | Low (well-documented) | Use server actions pattern throughout; avoid client components unless necessary |
| CRA → Next.js routing edge cases | Medium | Map all 30 routes before starting Phase 08; test each before retiring CRA |
| open-seo TanStack Router → Next.js port complexity | Medium | 7 routes only; mostly data-display pages with server function calls |
| Google OAuth scope approval | Low | GSC + GA4 scopes are standard; no sensitive scopes requiring Google review |
| Per-client credential migration | Medium | Run backfill in read-only mode first; validate before dropping SQLite tables |
| Token refresh failures at scale (100 clients) | Medium | Dead-letter queue + per-client `is_active` flag + dashboard surfacing |
