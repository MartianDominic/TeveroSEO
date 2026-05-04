---
phase: 71-security-configuration
plan: 02
subsystem: security
tags: [secret-detection, csp, dependency-pinning, ci-cd, pre-commit]
dependency_graph:
  requires: [71-01]
  provides: [secret-detection, csp-nonces, security-headers]
  affects: [apps/web, .github/workflows, .husky]
tech_stack:
  added: [gitleaks, husky]
  patterns: [pre-commit-hooks, csp-nonce, security-headers]
key_files:
  created:
    - .husky/pre-commit
  modified:
    - .github/workflows/security-audit.yml
    - apps/web/package.json
    - open-seo-main/package.json
    - apps/web/middleware.ts
decisions:
  - "Pre-commit hook uses regex patterns for common secret formats (OpenAI, Stripe, GitHub, AWS, Slack, Google)"
  - "Gitleaks runs with full git history scan on push/PR to main"
  - "CSP uses strict-dynamic with nonce for inline scripts (Next.js compatible)"
  - "Nonce passed via x-nonce header for layout/document consumption"
  - "ToBeMigrated folder was untracked, no git commit needed for removal"
metrics:
  duration: 241s
  completed: "2026-05-04T11:09:00Z"
  tasks_completed: 5
  files_modified: 5
---

# Phase 71 Plan 02: Security Hardening Summary

Pre-commit secret detection, CI Gitleaks scanning, pinned security dependencies, and CSP nonces.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pre-commit Secret Detection | 644e164dc | .husky/pre-commit |
| 2 | CI Secret Scanning | cb910b3c2 | .github/workflows/security-audit.yml |
| 3 | Pin Security Dependencies | 19ce33f60 | apps/web/package.json, open-seo-main/package.json |
| 4 | CSP Nonces | 3223ca073 | apps/web/middleware.ts |
| 5 | Delete ToBeMigrated | n/a (untracked) | AI-Writer/ToBeMigrated/ |

## Key Deliverables

### Pre-commit Secret Detection (.husky/pre-commit)

- Blocks .env file commits (allows .env.example)
- Regex patterns detect hardcoded secrets:
  - OpenAI keys (sk-...)
  - Stripe keys (sk_live_, sk_test_, pk_live_, pk_test_)
  - GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  - AWS access keys (AKIA...)
  - Slack tokens (xox...)
  - Google API keys (AIza...)
  - Generic password/api_key/secret/token assignments
- Optional gitleaks integration when installed locally

### CI Secret Scanning (.github/workflows/security-audit.yml)

- Added gitleaks job to existing security-audit workflow
- Full git history scan (fetch-depth: 0)
- Uses gitleaks/gitleaks-action@v2
- Uploads SARIF report on failure for review
- Runs on push/PR to main and weekly schedule

### Pinned Security Dependencies

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| @clerk/nextjs | 6.39.2 | apps/web | Authentication |
| dompurify | 3.4.1 | apps/web | XSS sanitization |
| jose | 6.0.12 | open-seo-main | JWT handling |

Removed caret (^) prefix to prevent automatic updates that could introduce security regressions.

### CSP Nonces (apps/web/middleware.ts)

- `generateNonce()`: 16 random bytes via crypto.getRandomValues, base64 encoded
- `buildCSPHeader()`: Constructs CSP with directives:
  - `script-src 'self' 'nonce-{nonce}' 'strict-dynamic'`
  - Allows Clerk domains for auth UI
  - `frame-ancestors 'none'` (clickjacking protection)
  - `object-src 'none'` (plugin protection)
- `applyCSPHeaders()`: Sets CSP + security headers on response
- Nonce passed via `x-nonce` header for consumption in layout.tsx

Additional security headers applied:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

### ToBeMigrated Cleanup

- Verified no imports from AI-Writer/ToBeMigrated in active codebase
- Folder was untracked in git (no commit needed)
- Contained legacy AI writer modules (YouTube, marketing, SEO tools)
- Deletion completed, reduces codebase noise

## Verification

- TypeScript: `pnpm typecheck` passes
- Build: `pnpm build` completes successfully
- Middleware: 149 kB (includes CSP logic)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] .husky/pre-commit exists and is executable
- [x] .github/workflows/security-audit.yml contains gitleaks job
- [x] apps/web/package.json has pinned @clerk/nextjs and dompurify
- [x] open-seo-main/package.json has pinned jose
- [x] apps/web/middleware.ts contains CSP nonce generation
- [x] AI-Writer/ToBeMigrated does not exist
- [x] All commits verified in git log
