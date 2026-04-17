# TeveroSEO Unified Platform

## What This Is

A unified agency SEO platform running on a single VPS. Two services — AI-Writer (content generation) and open-seo-main (SEO audits, keyword research) — share the same PostgreSQL, Redis, Docker Compose, Clerk auth, and per-client workspace model. The team uses one shell, one login, one client switcher.

## Sub-projects

- `AI-Writer/` — FastAPI + React content platform (phases 1–23 complete, fully operational; Phase 1 Platform Unification complete — legacy backend services cleaned)
- `open-seo-main/` — TanStack Start + Drizzle SEO audit platform (Phase 2 complete — Node.js/PostgreSQL, no CF deps; Phase 3 complete — BullMQ/Redis wired; Phase 4 complete — unified Docker infrastructure; Phase 5 complete — CI/CD GitHub Actions auto-deploy)

## Core Value

One platform. Switch to any client, generate content in their voice AND run SEO audits on their site — without leaving the shell or switching apps.

## Architecture

- **Frontend**: AI-Writer React shell (shadcn/ui + Tailwind) hosts both tools as nav sections
- **Backend**: AI-Writer FastAPI (port 8000) + open-seo-main Node.js (port 3001)
- **Database**: Shared PostgreSQL — `alwrity` db for AI-Writer, `open_seo` db for open-seo-main
- **Cache/Queue**: Shared Redis — AI-Writer APScheduler + open-seo-main BullMQ audit queue
- **Auth**: Clerk (shared tenant, same user pool)
- **Proxy**: nginx routes by domain/path, handles SSL

## Key Decisions

- Each app keeps its own database schema (no forced consolidation)
- Per-client workspaces use `client_id` from AI-Writer's `clients` table as the shared entity
- open-seo-main gets Clerk middleware added after Node.js migration complete
- SEO pages embedded in AI-Writer AppShell via iframe or direct React routing to `/seo/*`
