---
phase: 36
slug: content-brief
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | open-seo-main/vitest.config.ts |
| **Quick run command** | `npx vitest run src/server/features/briefs/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/server/features/briefs/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 36-01-01 | 01 | 1 | Schema | — | N/A | unit | `npx vitest run src/db/brief-schema.test.ts` | ❌ W0 | ⬜ pending |
| 36-01-02 | 01 | 1 | SERP analysis | — | N/A | unit | `npx vitest run src/server/features/briefs/services/SerpAnalyzer.test.ts` | ❌ W0 | ⬜ pending |
| 36-01-03 | 01 | 1 | SERP caching | — | N/A | unit | `npx vitest run src/server/lib/cache/serp-cache.test.ts` | ❌ W0 | ⬜ pending |
| 36-02-01 | 02 | 2 | Brief generator | — | N/A | unit | `npx vitest run src/server/features/briefs/services/BriefGenerator.test.ts` | ❌ W0 | ⬜ pending |
| 36-03-01 | 03 | 2 | Wizard UI | — | N/A | integration | `npx playwright test content-briefs` | ❌ W0 | ⬜ pending |
| 36-04-01 | 04 | 3 | AI-Writer integration | — | N/A | integration | `npx vitest run src/server/features/briefs/services/AIWriterClient.test.ts` | ❌ W0 | ⬜ pending |
| 36-04-02 | 04 | 3 | 107 checks validation | — | N/A | integration | `npx vitest run src/server/features/briefs/services/ContentValidator.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/brief-schema.test.ts` — schema validation tests
- [ ] `src/server/features/briefs/services/SerpAnalyzer.test.ts` — SERP extraction tests
- [ ] `src/server/features/briefs/services/BriefGenerator.test.ts` — brief generation tests
- [ ] `src/server/features/briefs/services/AIWriterClient.test.ts` — AI-Writer integration tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wizard UI flow | SC-6 | Visual interaction flow | Click through wizard: keyword → SERP preview → save |
| Voice mode tooltips | SC-4 | Tooltip content review | Verify tooltip text explains each mode |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
