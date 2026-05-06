---
phase: 92
slug: on-page-seo-mastery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 92 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `open-seo-main/vitest.config.ts` |
| **Quick run command** | `pnpm test -- src/server/features/onpage-mastery` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds (quick), ~2 minutes (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- src/server/features/onpage-mastery` (< 30s)
- **After every plan wave:** Run `pnpm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green + manual E2E verification (OPM-20)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 92-01-01 | 01 | 1 | OPM-01 | T-92-03 | Cache scoped by clientId | unit | `pnpm test -- VerticalClassifier.test.ts -t "heuristics"` | ❌ W0 | ⬜ pending |
| 92-01-02 | 01 | 1 | OPM-02 | T-92-01 | Sanitize HTML before LLM | integration | `pnpm test -- VerticalClassifier.test.ts -t "llm-fallback"` | ❌ W0 | ⬜ pending |
| 92-01-03 | 01 | 1 | OPM-03 | — | N/A | unit | `pnpm test -- VerticalClassifier.test.ts -t "ymyl"` | ❌ W0 | ⬜ pending |
| 92-02-01 | 02 | 1 | OPM-04 | — | N/A | unit | `pnpm test -- ChunkExtractor.test.ts -t "tokenization"` | ❌ W0 | ⬜ pending |
| 92-02-02 | 02 | 1 | OPM-05 | — | N/A | unit | `pnpm test -- ChunkExtractor.test.ts -t "boundaries"` | ❌ W0 | ⬜ pending |
| 92-02-03 | 02 | 1 | OPM-06 | T-92-04 | Chunk limit 100/page | unit | `pnpm test -- ChunkExtractor.test.ts -t "token-count"` | ❌ W0 | ⬜ pending |
| 92-03-01 | 03 | 2 | OPM-07 | T-92-01 | Sanitize before LLM | integration | `pnpm test -- QualityGateService.test.ts -t "reddit-test"` | ❌ W0 | ⬜ pending |
| 92-03-02 | 03 | 2 | OPM-08 | — | N/A | integration | `pnpm test -- QualityGateService.test.ts -t "info-gain"` | ❌ W0 | ⬜ pending |
| 92-03-03 | 03 | 2 | OPM-09 | T-92-01 | Validate LLM response (Zod) | integration | `pnpm test -- QualityGateService.test.ts -t "prove-it"` | ❌ W0 | ⬜ pending |
| 92-03-04 | 03 | 2 | OPM-10 | T-92-01 | Validate LLM response (Zod) | integration | `pnpm test -- QualityGateService.test.ts -t "llm-fallback"` | ❌ W0 | ⬜ pending |
| 92-04-01 | 04 | 2 | OPM-11 | — | N/A | unit | `pnpm test -- RuleEngineService.test.ts -t "rule-loading"` | ❌ W0 | ⬜ pending |
| 92-04-02 | 04 | 2 | OPM-12 | — | N/A | unit | `pnpm test -- RuleEngineService.test.ts -t "overrides"` | ❌ W0 | ⬜ pending |
| 92-04-03 | 04 | 2 | OPM-13 | — | N/A | integration | `pnpm test -- RuleEngineService.test.ts -t "scorecard"` | ❌ W0 | ⬜ pending |
| 92-05-01 | 05 | 2 | OPM-14 | — | N/A | unit | `pnpm test -- ReadabilityScorer.test.ts` | ❌ W0 | ⬜ pending |
| 92-05-02 | 05 | 2 | OPM-15 | T-92-05 | Strip PII before LLM | unit | `pnpm test -- EntityExtractor.test.ts` | ❌ W0 | ⬜ pending |
| 92-06-01 | 06 | 3 | OPM-16 | — | N/A | unit | `pnpm test -- InternalLinkGraph.test.ts -t "pagerank"` | ❌ W0 | ⬜ pending |
| 92-07-01 | 07 | 3 | OPM-17 | T-92-02 | Sanitize JSON-LD | unit | `pnpm test -- SchemaGenerator.test.ts` | ❌ W0 | ⬜ pending |
| 92-08-01 | 08 | 3 | OPM-18 | — | N/A | unit | `pnpm test -- tier1/T1-70-*.test.ts` | ❌ W0 | ⬜ pending |
| 92-09-01 | 09 | 4 | OPM-19 | T-92-01 | All LLM calls sanitized | integration | `pnpm test -- tier5/T5-*.test.ts` | ❌ W0 | ⬜ pending |
| 92-10-01 | 10 | 4 | OPM-20 | — | N/A | e2e | Manual verification | Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Threat Model Reference

| Threat ID | Pattern | STRIDE | Mitigation | Test Coverage |
|-----------|---------|--------|------------|---------------|
| T-92-01 | LLM prompt injection via page content | Tampering | Sanitize HTML before LLM input, validate Grok 4.1 response with Zod | OPM-07, OPM-09, OPM-10, OPM-19 |
| T-92-02 | Malicious Schema.org markup (XSS in JSON-LD) | Tampering | Parse Schema.org types only, sanitize before browser render | OPM-17 |
| T-92-03 | Cache poisoning (vertical classification) | Spoofing | Include domain+path+hash in cache key, validate cached data structure | OPM-01 |
| T-92-04 | Resource exhaustion (embedding generation) | DoS | Rate limit: max 50 pages/client/min, chunk limit 100/page | OPM-06 |
| T-92-05 | Sensitive data in LLM prompts (PII in content) | Info Disclosure | Strip emails/phone numbers before quality gate LLM calls | OPM-15 |
| T-92-06 | Unauthorized access to quality scores | Info Disclosure | Tenant isolation: all queries scoped by clientId | All |

---

## Wave 0 Requirements

- [ ] `src/server/features/onpage-mastery/services/VerticalClassifier.test.ts` — OPM-01, OPM-02, OPM-03
- [ ] `src/server/features/onpage-mastery/utils/ChunkExtractor.test.ts` — OPM-04, OPM-05, OPM-06
- [ ] `src/server/features/onpage-mastery/services/QualityGateService.test.ts` — OPM-07, OPM-08, OPM-09, OPM-10
- [ ] `src/server/features/onpage-mastery/services/RuleEngineService.test.ts` — OPM-11, OPM-12, OPM-13
- [ ] `src/server/features/onpage-mastery/utils/ReadabilityScorer.test.ts` — OPM-14
- [ ] `src/server/features/onpage-mastery/utils/EntityExtractor.test.ts` — OPM-15
- [ ] `src/server/features/linking/InternalLinkGraph.test.ts` — OPM-16 (extend existing)
- [ ] `src/server/features/onpage-mastery/utils/SchemaGenerator.test.ts` — OPM-17
- [ ] `src/server/lib/audit/checks/tier1/T1-70-*.test.ts` — OPM-18 (16 files)
- [ ] `src/server/lib/audit/checks/tier5/T5-*.test.ts` — OPM-19 (13 files)
- [ ] Vitest config: Add `coverage` section with 80% thresholds for new modules

*Test infrastructure status: Vitest configured and working (existing tests pass). All Phase 92 tests are net-new files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full E2E audit with Tier 5 | OPM-20 | Requires full page + embeddings + LLM + real SERP data | 1. Run full audit on test site 2. Verify Tier 5 checks execute 3. Confirm quality scores populate 4. Test sampling mode on 100+ pages |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
