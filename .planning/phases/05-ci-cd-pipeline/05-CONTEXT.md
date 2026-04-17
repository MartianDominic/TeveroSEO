---
phase: 5
title: CI/CD Pipeline
type: infrastructure
discuss_skipped: true
discuss_skip_reason: All success criteria are technical (GitHub Actions, SSH deploy, migrations) — no user-facing behavior or UX decisions required
---

# Phase 5 Context: CI/CD Pipeline

## Goal

Both platforms auto-deploy to VPS on push to main with zero manual intervention; migrations run before new containers go live.

## Success Criteria

- Pushing to `main` triggers deploy workflow; VPS shows new container within 5 minutes
- GitHub Actions workflow completes green with migration step before container swap
- `KNOWN_HOSTS` used; no `StrictHostKeyChecking=no`
- AI-Writer auto-deploys via separate parallel workflow

## Requirements Addressed

CI-01, CI-02, CI-03, CI-04, CI-05, CI-06

## Key Decisions (Claude's Discretion)

### Deploy User Setup
- Dedicated `deploy` Linux user on VPS with `docker` group membership
- ed25519 SSH key pair: private key in GitHub Actions secret `VPS_SSH_PRIVATE_KEY`, public key in `/home/deploy/.ssh/authorized_keys` on VPS
- GitHub Actions secrets required: `VPS_HOST`, `VPS_USER` (= "deploy"), `VPS_SSH_PRIVATE_KEY`, `KNOWN_HOSTS`

### Workflow: open-seo deploy (`.github/workflows/deploy-vps.yml`)
- Trigger: `push` to `main` with path filter `open-seo-main/**`
- Steps:
  1. Checkout repo
  2. SSH to VPS (using `appleboy/ssh-action` or raw `ssh` with KNOWN_HOSTS)
  3. `git pull origin main` on VPS
  4. `docker compose -f docker-compose.vps.yml run --rm open-seo-migrate` (migrations before swap)
  5. `docker compose -f docker-compose.vps.yml up -d --build open-seo open-seo-worker`
- Zero-downtime: compose `up -d --build` for target services only (postgres/redis/nginx not restarted)
- Migration step: separate `open-seo-migrate` service in docker-compose.vps.yml that runs `drizzle-kit migrate` and exits

### Workflow: AI-Writer deploy (`.github/workflows/deploy-ai-writer.yml`)
- Trigger: `push` to `main` with path filter `AI-Writer/**`
- Runs in parallel with open-seo deploy (separate workflow file)
- Steps: SSH → git pull → `docker compose -f docker-compose.vps.yml up -d --build ai-writer-backend ai-writer-frontend`
- No migration step (AI-Writer uses Alembic; migrations are manual)

### SSH Security
- `KNOWN_HOSTS` secret contains output of `ssh-keyscan -H <VPS_HOST>` — added to `~/.ssh/known_hosts` before any SSH command
- NEVER use `StrictHostKeyChecking=no` (violates CI-03)
- Use `ssh -o StrictHostKeyChecking=yes -o UserKnownHostsFile=~/.ssh/known_hosts`

### Migration Service
- Add `open-seo-migrate` service to `docker-compose.vps.yml`:
  - Same image as `open-seo`, command: `["node", "-e", "require('./migrate.mjs')"]` or direct drizzle-kit call
  - `restart: no` — run once and exit
  - Depends on postgres healthy

### Working Directory
- `.github/workflows/` — workflow YAML files
- `docker-compose.vps.yml` — add migration service (patch from Phase 4)

### Secrets Documentation
- `.env.vps.example` already exists (from Phase 4) — add GitHub Actions secrets section comment
- Document setup steps in workflow file comments or README

### Port Allocation (unchanged from Phase 4)
- All internal; nginx handles 80/443 externally
