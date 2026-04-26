# TeveroSEO Unified Platform

## Project Structure

This is a monorepo containing the complete TeveroSEO platform:

| Directory | Purpose | Stack |
|-----------|---------|-------|
| `apps/web/` | Next.js frontend (`@tevero/web`) | Next.js 15, shadcn/ui, Tailwind |
| `open-seo-main/` | SEO audit platform | TanStack Start, Drizzle, BullMQ |
| `AI-Writer/` | Content generation platform | FastAPI, React, PostgreSQL |
| `packages/` | Shared packages | TypeScript |

## Core Value

One platform. Switch to any client, generate content in their voice AND run SEO audits on their site — without leaving the shell or switching apps.

## Architecture

- **Frontend**: apps/web (Next.js) hosts unified shell with shadcn/ui + Tailwind
- **Backend**: AI-Writer FastAPI (port 8000) + open-seo-main Node.js (port 3001)
- **Database**: Shared PostgreSQL — `alwrity` db for AI-Writer, `open_seo` db for open-seo-main
- **Cache/Queue**: Shared Redis — AI-Writer APScheduler + open-seo-main BullMQ
- **Auth**: Clerk (shared tenant)
- **Proxy**: nginx routes by domain/path, handles SSL

## Planning & Roadmap

**All planning docs are at the root `.planning/` directory:**
- `.planning/ROADMAP.md` — Master roadmap (Phases 1-40, v1.0-v5.0 milestones)
- `.planning/STATE.md` — Current execution state
- `.planning/phases/` — Individual phase plans
- `.planning/keyword-intelligence/` — **Keyword Intelligence System** (14 docs, research complete)

**Infrastructure Research:**
- `docs/infra-research/cpu-only-rag-graph.md` — RAG + Graph stack for $50/mo VPS
- `docs/infra-research/crawling-10-5000-tasks-day.md` — Crawling infrastructure scaling

**Current Milestone:** v5.0 Autonomous SEO Pipeline

**Current Work:** Phase 40 (Gap Closure) — Closing implementation gaps across P32, P35, P36, P37, P39

**Do NOT use** `open-seo-main/.planning/` or `AI-Writer/.planning/` — these are sub-project archives.

## Tech Stack

### open-seo-main
- TanStack Start (Node.js target, not CF Workers)
- Drizzle ORM + PostgreSQL
- BullMQ + Redis for job queues
- better-auth for sessions

### AI-Writer
- FastAPI + Python 3.11
- React frontend (shadcn/ui)
- PostgreSQL + Redis

### apps/web
- Next.js 15 App Router
- Server Components + Server Actions
- Tailwind CSS + shadcn/ui

## Current Phase Plans (Phase 40: v5.0 Gap Closure)

| Plan | Focus | Status |
|------|-------|--------|
| 40-01 | Foundation: P32/P35/P37 basics | Ready |
| 40-02 | SERP & Content: P36, validation | Blocked on 40-01 |
| 40-03 | AI-Writer Core: voice, quality gate, GSC | Blocked on 40-02 |
| 40-04 | Links & Final: auto-insert, E2E | Blocked on 40-03 |

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

## Key Constraints

- Per-client workspaces use `client_id` from AI-Writer's `clients` table as shared entity
- Each app keeps its own database schema (no forced consolidation)
- SEO checks run against Tier 1-4 (107 checks total)
- Quality gate requires score >= 80 for auto-publish
- Brand voice uses 40+ field profiles with VoiceConstraintBuilder
