---
phase: 05-ci-cd-pipeline
plan: "03"
subsystem: ci-cd
tags: [github-actions, deploy, ssh, ai-writer, docker-compose]
dependency_graph:
  requires: ["05-02"]
  provides: ["AI-Writer auto-deploy workflow"]
  affects: [".github/workflows/deploy-ai-writer.yml"]
tech_stack:
  added: []
  patterns: ["ssh-agent key injection", "KNOWN_HOSTS pinning", "docker compose selective rebuild", "concurrency group isolation"]
key_files:
  created:
    - .github/workflows/deploy-ai-writer.yml
  modified: []
decisions:
  - "No migration step — AI-Writer uses Alembic run manually by operator; CI should never run unsupervised schema changes"
  - "Distinct concurrency group deploy-vps-ai-writer allows AI-Writer and open-seo deploys to run in parallel"
  - "120s health poll (24x5s) vs 90s for open-seo because FastAPI has start_period: 60s"
metrics:
  duration: "5m"
  completed: "2026-04-17"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 05 Plan 03: AI-Writer Deploy Workflow Summary

## One-liner

GitHub Actions workflow that SSHes to VPS, pulls main, and rebuilds ai-writer-backend + ai-writer-frontend with StrictHostKeyChecking=yes and no migration step.

## What Was Built

Created `.github/workflows/deploy-ai-writer.yml` — the parallel sibling of `deploy-vps.yml` that auto-deploys AI-Writer to the VPS whenever `AI-Writer/**`, `docker-compose.vps.yml`, or the workflow file itself changes on `main`.

### Task 1: Create .github/workflows/deploy-ai-writer.yml

**Commit:** 29cdb21

**Files created:**
- `.github/workflows/deploy-ai-writer.yml` — 114-line GitHub Actions workflow

**Key properties:**
- Triggers: push to main with paths `AI-Writer/**`, `docker-compose.vps.yml`, `.github/workflows/deploy-ai-writer.yml`; also `workflow_dispatch`
- Same 4 secrets as deploy-vps.yml: `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`, `KNOWN_HOSTS`
- SSH security: KNOWN_HOSTS written before any SSH call, `StrictHostKeyChecking=yes` everywhere, ssh-agent for key injection
- Remote deploy: `git fetch/checkout/reset --hard origin/main` then `docker compose up -d --build ai-writer-backend ai-writer-frontend`
- Health verification: 24-attempt × 5s poll (120s total) for ai-writer-backend + ai-writer-frontend
- Concurrency group: `deploy-vps-ai-writer` (distinct from `deploy-vps-open-seo`)
- No migration step

## Decisions Made

1. **No migration step:** AI-Writer uses Alembic and the CONTEXT.md explicitly states migrations are manual (`docker compose exec ai-writer-backend alembic upgrade head`). Running schema changes unsupervised in CI is unsafe for this project.

2. **Parallel concurrency groups:** `deploy-vps-ai-writer` vs `deploy-vps-open-seo` allows an AI-Writer-only push and an open-seo-only push to deploy simultaneously. Docker daemon serializes compose operations on overlapping services, but these workflows target completely different services.

3. **120s health poll:** AI-Writer's FastAPI backend has `start_period: 60s` in docker-compose.vps.yml, so the poll needs to allow more time than open-seo's 90s.

## Deviations from Plan

None — plan executed exactly as written. The workflow content matches the plan's `<action>` block exactly.

Note: The PyYAML validator in the plan's `<verify>` block uses `d['on']` which fails because PyYAML 5.x parses `on` as boolean `True` per YAML 1.1 spec. The corrected validator using `d[True]` passes. This is a validator quirk, not a workflow issue — GitHub Actions parses `on:` correctly.

## Security Posture (Threat Model)

All T-05-12 through T-05-15 mitigations applied:
- T-05-12 (SSH MITM): KNOWN_HOSTS pinned + StrictHostKeyChecking=yes — confirmed by `grep -c "StrictHostKeyChecking=no"` returning 0
- T-05-13 (Compose tampering): Services named explicitly in `up -d --build ai-writer-backend ai-writer-frontend`
- T-05-14 (Concurrent deploys DoS): `concurrency.group: deploy-vps-ai-writer` with `cancel-in-progress: false`
- T-05-15 (Secret disclosure): All secrets via `env:` block; single-quoted heredoc prevents interpolation
- T-05-16 (Schema drift): Accepted — manual Alembic workflow per CONTEXT.md

## Known Stubs

None.

## Threat Flags

None — no new trust boundaries beyond what the plan's threat model covers.

## Self-Check: PASSED

- [x] `.github/workflows/deploy-ai-writer.yml` exists
- [x] `grep -c "StrictHostKeyChecking=no"` returns 0
- [x] `grep -c "StrictHostKeyChecking=yes"` returns 2
- [x] `grep -c "deploy-vps-ai-writer"` returns 1
- [x] `grep -cE "compose .*run --rm .*migrate"` returns 0
- [x] YAML parses successfully (python3 yaml.safe_load)
- [x] Python validator prints OK (using d[True] for on: block)
- [x] Commit 29cdb21 exists
