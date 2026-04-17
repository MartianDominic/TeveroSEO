---
phase: 05-ci-cd-pipeline
plan: "02"
subsystem: ci-cd
tags: [github-actions, ssh, deploy, docker-compose, migrations]
dependency_graph:
  requires: ["05-01"]
  provides: ["CI-01", "CI-02", "CI-03", "CI-04", "CI-05"]
  affects: [".github/workflows/deploy-vps.yml"]
tech_stack:
  added: ["github-actions/checkout@v4", "ssh-agent", "ed25519-ssh"]
  patterns: ["pinned-known-hosts-ssh", "ssh-agent-no-disk-key", "migrate-before-swap", "serial-concurrency-group"]
key_files:
  created:
    - .github/workflows/deploy-vps.yml
  modified: []
decisions:
  - "Used raw ssh heredoc over appleboy/ssh-action — avoids third-party action trust risk, gives full control over SSH options"
  - "Two SSH invocations (deploy + verify) — isolates exit codes so GitHub UI shows which phase failed"
  - "cancel-in-progress: false on concurrency group — never cancel a mid-flight deploy that may have partially swapped containers"
  - "ssh-agent loaded via eval, key via ssh-add — private key is never persisted to disk on the Actions runner"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-17T18:23:04Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 05 Plan 02: GitHub Actions VPS Deploy Workflow Summary

GitHub Actions workflow that SSH-deploys open-seo + open-seo-worker to VPS on every push to main, with KNOWN_HOSTS-pinned host key, ssh-agent key loading, fail-fast migration-before-swap, and health verification.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create .github/workflows/deploy-vps.yml | 5b8fd9e | .github/workflows/deploy-vps.yml |

## What Was Built

`.github/workflows/deploy-vps.yml` — a single-job GitHub Actions workflow implementing the full CI-01..CI-05 contract:

**Trigger (CI-01):** Push to `main` with path filter `open-seo-main/**`, `docker-compose.vps.yml`, `docker/**`, and the workflow file itself. Also supports `workflow_dispatch` for manual redeploys.

**Concurrency:** `group: deploy-vps-open-seo`, `cancel-in-progress: false` — serial deploys only, never mid-flight cancellation that could leave containers in a half-swapped state.

**SSH Security (CI-03):**
- Step 1 writes `KNOWN_HOSTS` secret to `~/.ssh/known_hosts` BEFORE any SSH invocation
- `StrictHostKeyChecking=yes` used on every `ssh` call — `StrictHostKeyChecking=no` appears zero times
- Private key loaded into `ssh-agent` via `ssh-add` and never written to the filesystem

**Deploy Sequence (CI-02):**
1. `git fetch && git reset --hard origin/main` on VPS
2. `docker compose -f docker-compose.vps.yml --profile migrate run --rm open-seo-migrate` — migrations run BEFORE any container swap; `set -euo pipefail` ensures the remote script fails fast if migrations fail, preventing a half-deployed state
3. `docker compose -f docker-compose.vps.yml up -d --build open-seo open-seo-worker` — only these two services rebuilt; postgres/redis/nginx/ai-writer-* untouched
4. `docker image prune -f` — prevents VPS disk fill from accumulated image layers

**Health Verify:** Separate SSH step polls `docker inspect` health status for both `open-seo` and `open-seo-worker` up to 90 seconds (18 x 5s). On timeout, dumps last 100 log lines and exits 1.

**Secrets documented (CI-05):** All four required secrets enumerated in workflow file header comments:
- `VPS_HOST` — VPS IP or hostname
- `VPS_USER` — dedicated `deploy` Linux user
- `VPS_SSH_PRIVATE_KEY` — ed25519 private key
- `KNOWN_HOSTS` — output of `ssh-keyscan -H <VPS_HOST>`

**Deploy user setup documented (CI-04):** VPS prerequisite commands in workflow comments: `useradd`, `usermod -aG docker`, `.ssh` directory setup, `git clone` to `/home/deploy/TeveroSEO`.

## Acceptance Criteria Verification

| Check | Result |
|-------|--------|
| `grep -c "StrictHostKeyChecking=no"` = 0 | 0 (PASS) |
| `grep -c "StrictHostKeyChecking=yes"` >= 2 | 3 (PASS) |
| `grep -c "KNOWN_HOSTS"` >= 3 | 4 (PASS) |
| `grep -c "VPS_SSH_PRIVATE_KEY"` >= 2 | 2 (PASS) |
| `grep -c "VPS_HOST"` >= 3 | 7 (PASS) |
| `grep -c "VPS_USER"` >= 3 | 5 (PASS) |
| `open-seo-main/**` path filter present | 1 (PASS) |
| `--profile migrate run --rm open-seo-migrate` present | 2 (PASS) |
| `up -d --build open-seo open-seo-worker` present | 2 (PASS) |
| `ssh-agent` present | 2 (PASS) |
| KNOWN_HOSTS write (line 65) before first SSH call (line 85) | PASS |
| Python YAML validator: all assertions pass | OK (PASS) |

## Deviations from Plan

None — plan executed exactly as written.

The plan provided complete YAML to write verbatim. The one structural note: PyYAML parses YAML `on:` key as Python boolean `True` (a known quirk) — this is a validator issue only, not a file issue. The workflow YAML itself is correct and GitHub Actions will parse it properly.

## Known Stubs

None — this is a workflow definition file. No data flows through it at rest.

## Threat Flags

None — all new SSH surface is covered by the plan's existing threat model (T-05-05 through T-05-11). No surface outside the threat model was introduced.

## Self-Check: PASSED

- `.github/workflows/deploy-vps.yml` exists: FOUND
- Commit 5b8fd9e exists: FOUND (`feat(05-02): add GitHub Actions deploy-vps.yml workflow`)
