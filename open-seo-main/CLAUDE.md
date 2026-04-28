# open-seo-main

**This is a sub-project of TeveroSEO. For the main project context, see the root `/CLAUDE.md`.**

## Role

SEO audit platform within the TeveroSEO unified platform. Handles:
- 107 SEO checks (Tier 1-4)
- Internal linking with cannibalization detection
- Content briefs with SERP analysis
- Brand voice profiles and compliance scoring

## Tech Stack

- TanStack Start (Node.js target)
- Drizzle ORM + PostgreSQL
- BullMQ + Redis for job queues
- better-auth for sessions

## Planning

**Use the root `.planning/` directory, NOT `open-seo-main/.planning/`.**

The root `.planning/ROADMAP.md` contains the master roadmap for all TeveroSEO components.

This sub-project's `.planning/` directory is deprecated and may be removed.

## Key Files

- `src/db/` — Drizzle schemas (schema.ts, analytics-schema.ts, voice-schema.ts, linking-schema.ts)
- `src/server/features/` — Domain services (audit, briefs, linking, voice)
- `src/server/lib/audit/checks/` — 107 SEO check implementations
- `src/routes/` — TanStack Start routes and API handlers
