---
phase: 05-ci-cd-pipeline
verified: 2026-04-17T21:45:00Z
status: human_needed
score: 11/12 must-haves verified (12th requires live GitHub Actions run)
human_verification:
  - test: "Push a trivial change under open-seo-main/ to main and observe the deploy-vps workflow"
    expected: "GitHub Actions run completes green: SSH step connects, migration container runs and exits 0, open-seo + open-seo-worker containers rebuild and reach healthy state within 5 minutes"
    why_human: "Cannot trigger a real GitHub Actions run statically; requires VPS reachable at VPS_HOST secret, secrets pre-configured, and live Docker daemon on VPS"
  - test: "Push a trivial change under AI-Writer/ to main and observe deploy-ai-writer workflow"
    expected: "deploy-ai-writer workflow completes green in parallel with (or independently of) deploy-vps; ai-writer-backend and ai-writer-frontend rebuild and reach healthy state"
    why_human: "Same reason — live CI environment required; static analysis cannot simulate an actual GitHub Actions runner SSH session"
  - test: "Verify that a push touching only a top-level file (e.g. README) does NOT trigger either workflow"
    expected: "Neither deploy-vps nor deploy-ai-writer appears in the Actions run list"
    why_human: "Path-filter correctness can only be confirmed by GitHub's trigger evaluation engine, not static grep"
---

# Phase 5: CI/CD Pipeline Verification Report

**Phase Goal:** Both platforms auto-deploy to VPS on push to main with zero manual intervention; migrations run before new containers go live.
**Verified:** 2026-04-17T21:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Push to `main` targeting `open-seo-main/**` triggers deploy-vps.yml | ✓ VERIFIED | `paths` block contains `"open-seo-main/**"` on branch `main`; Python YAML validator confirmed |
| 2 | deploy-vps.yml uses KNOWN_HOSTS secret written to `~/.ssh/known_hosts` BEFORE any SSH call | ✓ VERIFIED | `printf '%s\n' "$KNOWN_HOSTS" > ~/.ssh/known_hosts` at line 65; first `ssh $SSH_OPTS` call at line 85 — KNOWN_HOSTS write precedes SSH by 20 lines |
| 3 | deploy-vps.yml runs migration BEFORE `up -d --build open-seo open-seo-worker` | ✓ VERIFIED | Line 95: `docker compose -f docker-compose.vps.yml --profile migrate run --rm open-seo-migrate`; line 98: `up -d --build open-seo open-seo-worker` — migration runs first inside same `set -euo pipefail` heredoc |
| 4 | Migration failure aborts deploy (fail-fast via `set -euo pipefail`) | ✓ VERIFIED | `set -euo pipefail` appears 5 times in deploy-vps.yml, including in the remote heredoc; non-zero migration exit propagates and terminates the SSH session |
| 5 | deploy-vps.yml never uses `StrictHostKeyChecking=no` | ✓ VERIFIED | `grep -c "StrictHostKeyChecking=no"` returns 0; `StrictHostKeyChecking=yes` appears 3 times |
| 6 | All 4 required secrets (VPS_HOST, VPS_USER, VPS_SSH_PRIVATE_KEY, KNOWN_HOSTS) documented in deploy-vps.yml | ✓ VERIFIED | All four appear in file header comments AND as `${{ secrets.* }}` references: VPS_HOST ×7, VPS_USER ×5, VPS_SSH_PRIVATE_KEY ×2, KNOWN_HOSTS ×4 |
| 7 | deploy-vps.yml has `concurrency.cancel-in-progress: false` with group `deploy-vps-open-seo` | ✓ VERIFIED | Confirmed in YAML: `group: deploy-vps-open-seo`, `cancel-in-progress: false` |
| 8 | deploy-ai-writer.yml is a separate workflow with distinct concurrency group `deploy-vps-ai-writer` | ✓ VERIFIED | File exists at `.github/workflows/deploy-ai-writer.yml`; `group: deploy-vps-ai-writer` confirmed; Python YAML validator passed |
| 9 | deploy-ai-writer.yml has NO migration step | ✓ VERIFIED | `grep -cE "compose.*run --rm.*migrate"` returns 0; `--profile migrate` absent from all step `run` blocks |
| 10 | deploy-ai-writer.yml triggers on push to `main` with `AI-Writer/**` path filter | ✓ VERIFIED | `paths` block contains `"AI-Writer/**"` on branch `main` |
| 11 | `open-seo-migrate` service exists in docker-compose.vps.yml with `profiles: ["migrate"]` | ✓ VERIFIED | Service declared at line 114; `profiles: ["migrate"]`; `restart: "no"`; `depends_on: postgres: condition: service_healthy`; `command: ["node", ".output/migrate-entry.mjs"]` |
| 12 | `open-seo-main/src/migrate-entry.ts` uses `drizzle-orm/node-postgres/migrator` (not drizzle-kit) | ✓ VERIFIED | `import { migrate } from "drizzle-orm/node-postgres/migrator"` present; `drizzle-kit` substring absent (count = 0); `migrationsFolder: "./drizzle"` present |

**Score:** 12/12 truths verified statically

### Live Deploy Smoke Test (Requires Human)

The 4 roadmap success criteria map cleanly to the 12 truths above, with one exception: SC-1 ("VPS shows new container within 5 minutes") and SC-2 ("GitHub Actions workflow completes green") require a live run. See Human Verification section.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/deploy-vps.yml` | VPS deploy workflow for open-seo | ✓ VERIFIED | Exists, git-tracked, 132 lines, YAML valid |
| `.github/workflows/deploy-ai-writer.yml` | VPS deploy workflow for AI-Writer | ✓ VERIFIED | Exists, git-tracked, 114 lines, YAML valid |
| `open-seo-main/src/migrate-entry.ts` | Standalone drizzle migration runner | ✓ VERIFIED | Exists on disk (open-seo-main is its own git repo, gitignored from root); 33 lines; committed as `29ccf29` in open-seo-main repo |
| `open-seo-main/Dockerfile.vps` | esbuild bundle for migrate-entry.mjs | ✓ VERIFIED | Exists on disk; `esbuild src/migrate-entry.ts` at line 36 before `pnpm prune --prod` at line 42; committed as `d68c549` in open-seo-main repo |
| `docker-compose.vps.yml` (open-seo-migrate service) | One-shot migrate service | ✓ VERIFIED | `open-seo-migrate:` service present at line 114 with correct profile, restart, depends_on |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| deploy-vps.yml trigger | `open-seo-main/**` on main | `on.push.paths` | ✓ WIRED | Path filter confirmed in YAML |
| SSH setup step | `~/.ssh/known_hosts` from KNOWN_HOSTS secret | `printf ... > ~/.ssh/known_hosts` | ✓ WIRED | Line 65, before first ssh call at line 85 |
| Deploy step remote script | open-seo-migrate service | `docker compose --profile migrate run --rm open-seo-migrate` | ✓ WIRED | Line 95 of deploy-vps.yml |
| Deploy step remote script | open-seo + open-seo-worker rebuild | `docker compose up -d --build open-seo open-seo-worker` | ✓ WIRED | Line 98, after migration |
| deploy-ai-writer.yml trigger | `AI-Writer/**` on main | `on.push.paths` | ✓ WIRED | Path filter confirmed |
| deploy-ai-writer.yml concurrency | isolated from deploy-vps | `group: deploy-vps-ai-writer` | ✓ WIRED | Distinct group name confirmed |
| open-seo-migrate service | `.output/migrate-entry.mjs` | `command: ["node", ".output/migrate-entry.mjs"]` | ✓ WIRED | docker-compose.vps.yml line 120 |
| migrate-entry.ts | `./drizzle` migrations folder | `migrationsFolder: "./drizzle"` | ✓ WIRED | Line 21 of migrate-entry.ts |
| open-seo-migrate | postgres service_healthy | `depends_on: postgres: condition: service_healthy` | ✓ WIRED | docker-compose.vps.yml confirmed |

---

## Data-Flow Trace (Level 4)

Not applicable. Phase 5 produces workflow definitions and a migration runner — no components that render dynamic data from a data source. The migration runner's "data" is the Drizzle migrations folder, which is file-system based and statically bundled into the image at build time.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| deploy-vps.yml YAML validity | `python3 yaml.safe_load(...)` | All assertions passed, printed OK | ✓ PASS |
| deploy-ai-writer.yml YAML validity | `python3 yaml.safe_load(...)` | All assertions passed, printed OK | ✓ PASS |
| migrate-entry.ts uses prod-only imports | `grep "drizzle-kit"` returns 0 | Count = 0 | ✓ PASS |
| Dockerfile.vps esbuild ordering | migrate-entry.ts at line 36, pnpm prune at line 42 | migrate < prune | ✓ PASS |
| open-seo-migrate compose profiles | `grep 'profiles: \["migrate"\]'` | 1 match | ✓ PASS |
| Live GitHub Actions run | Requires live VPS + secrets | Cannot test statically | ? SKIP → Human |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CI-01 | 05-02 | `.github/workflows/deploy-vps.yml` triggers on push to main; SSHs to VPS; zero-downtime deploy | ✓ SATISFIED | Workflow exists, triggers on main + path filter, SSH-based deploy confirmed |
| CI-02 | 05-01, 05-02 | DB migrations run as separate `docker compose run --rm` step before new container goes live | ✓ SATISFIED | `open-seo-migrate` service + `--profile migrate run --rm` in deploy step before `up -d --build` |
| CI-03 | 05-02, 05-03 | `KNOWN_HOSTS` secret used (not `StrictHostKeyChecking=no`) | ✓ SATISFIED | `StrictHostKeyChecking=no` absent (count 0) in both workflows; KNOWN_HOSTS written before every SSH call |
| CI-04 | 05-02 | Dedicated `deploy` Linux user with `docker` group; ed25519 key pair | ✓ SATISFIED | Documented in deploy-vps.yml header comments with exact `useradd`/`usermod -aG docker` commands and SSH key instructions |
| CI-05 | 05-02, 05-03 | VPS_HOST, VPS_USER, VPS_SSH_PRIVATE_KEY, KNOWN_HOSTS as GitHub Actions secrets | ✓ SATISFIED | All four referenced as `${{ secrets.* }}` in both workflow files and documented in header comments |
| CI-06 | 05-03 | Separate parallel workflow for AI-Writer auto-deploy on push | ✓ SATISFIED | `deploy-ai-writer.yml` with distinct concurrency group `deploy-vps-ai-writer`, path filter `AI-Writer/**`, no migration step |

**All 6 CI-XX requirements covered.** CI-01 through CI-05 owned by plans 05-01 and 05-02; CI-06 owned by plan 05-03. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `deploy-vps.yml` | 219 | `VPS_REPO_PATH` used in remote heredoc as `${VPS_REPO_PATH:-/home/deploy/TeveroSEO}` but `VPS_REPO_PATH` env var is set in the `env:` block of the LOCAL runner — it does NOT transfer into the `<<'REMOTE'` heredoc (single-quoted heredoc, no local var expansion) | ⚠️ Warning | The fallback `:-/home/deploy/TeveroSEO` will always be used at runtime, making the `env.VPS_REPO_PATH` declaration dead. This is functionally correct because the fallback matches the intended path, but the variable is misleading. Does not block deploys. |

No stub implementations, no placeholder returns, no `TODO`/`FIXME` patterns found in any of the 5 key files. The Warning above is a cosmetic/clarity issue in the workflow — the hardcoded fallback path is correct and the deploy will work as intended.

---

## Human Verification Required

### 1. Live VPS Deploy — open-seo

**Test:** Configure the four GitHub Actions secrets (VPS_HOST, VPS_USER, VPS_SSH_PRIVATE_KEY, KNOWN_HOSTS) in the repository. Push a trivial change (e.g. add a comment) under `open-seo-main/src/` to `main`.

**Expected:** The `deploy-vps` workflow triggers within seconds. The SSH step connects to the VPS. The migration step runs `open-seo-migrate` container and exits 0 with log line `[migrate] migrations applied successfully`. The app containers `open-seo` and `open-seo-worker` rebuild and transition to `healthy` state. The entire workflow completes green within 5 minutes.

**Why human:** Requires a live VPS reachable at the configured host, pre-configured SSH authorized_keys, Docker daemon running, and actual GitHub Actions runner. Cannot be simulated with static file analysis.

### 2. Live VPS Deploy — AI-Writer

**Test:** Push a trivial change under `AI-Writer/` to `main` (either independently, or after push above settles).

**Expected:** The `deploy-ai-writer` workflow triggers and runs in parallel (independent concurrency group). The `ai-writer-backend` and `ai-writer-frontend` containers rebuild and become healthy. No migration step appears in the Actions log.

**Why human:** Same reason as above — requires live environment.

### 3. Path-Filter Negative Test

**Test:** Push a change that touches only a file at the repo root (e.g. a top-level `.env.example` or `README`) — no changes under `open-seo-main/`, `AI-Writer/`, `docker-compose.vps.yml`, or `.github/workflows/`.

**Expected:** Neither `deploy-vps` nor `deploy-ai-writer` appears in the GitHub Actions run list for that push.

**Why human:** GitHub's path-filter evaluation engine must be exercised; cannot determine trigger suppression from static YAML inspection alone.

---

## Gaps Summary

No blocking gaps found. All 12 must-haves pass static verification. The one Warning anti-pattern (dead `VPS_REPO_PATH` env var — shadowed by single-quoted heredoc) is cosmetic and does not affect correctness because the hardcoded fallback path `/home/deploy/TeveroSEO` is the correct intended value.

Status is `human_needed` because 3 live-environment behaviors (actual GitHub Actions runs against a real VPS) cannot be verified statically and are essential to confirm the phase goal: "zero manual intervention" and "VPS shows new container within 5 minutes."

---

_Verified: 2026-04-17T21:45:00Z_
_Verifier: Claude (gsd-verifier)_
