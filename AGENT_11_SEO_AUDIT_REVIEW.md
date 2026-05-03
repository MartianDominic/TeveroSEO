# Agent 11: SEO Audit Engine Review

**Reviewer:** Agent 11 (SEO Audit Engine)
**Date:** 2026-05-03
**Scope:** Tier 1-4 check implementations, scoring algorithms, validation logic, result aggregation

---

## Findings

### Check Count Discrepancy

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-01 | **MEDIUM** | `checks/index.ts` | Check count mismatch: Documentation claims 107 checks but `TOTAL_CHECK_COUNT = 129` in code. Tier breakdown in code: T1=68, T2=21, T3=13, T4=7 = 109 total. The main index comment says "Tier 1: 77, Tier 2: 26, Tier 3: 17, Tier 4: 9 = 129 total" which contradicts both CLAUDE.md (107) and actual registered counts. |

**Impact:** Inconsistent documentation may cause confusion for maintainers; not a functional bug.

**Recommendation:** Audit all tier files and update `TOTAL_CHECK_COUNT` and tier comments to match actual registered check counts.

---

### Scoring Algorithm Issues

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-02 | **HIGH** | `checks/scoring.ts` | Maximum score exceeds 100: Base (60) + T1 (20) + T2 (10) + T3 (10) + T4 (4) = 104 points. The comment says "normalized to 100" but there is NO normalization in the code - score is returned as-is (capped by Math.round). A page passing all checks would score 104, not 100. |

**Impact:** Score can exceed 100, confusing users and breaking "score >= 80" quality gate assumptions.

**Recommendation:** Add normalization: `score = Math.min(100, Math.round((score / 104) * 100))` or adjust weights to sum to exactly 40 variable points.

---

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-03 | **MEDIUM** | `checks/scoring.ts` | Gate order precedence issue: The duplicate-content gate (Gate 2) caps at 50, but the YMYL-no-author gate (Gate 3) caps at 60. If both conditions are true, the score would be capped at 60 (last gate wins), not 50 (stricter gate). Gates should apply from strictest to least strict OR use `Math.min` accumulation. |

**Impact:** Duplicate content pages may get higher scores than intended when YMYL check also fails.

**Recommendation:** Reorder gates or accumulate with `score = Math.min(score, cap)` for each gate in a single pass, then return the final capped value.

---

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-04 | **MEDIUM** | `checks/scoring.ts` | CWV gate inconsistency: Gate 4 checks for CWV "critical" severity but T3-01/02/03 only return "critical" when the metric is in the "poor" range. However, when APIs are skipped (no API key), these checks return `passed: false, severity: "info"`. Skipped checks incorrectly affect scoring since they don't trigger the "critical" gate but also don't pass. |

**Impact:** Sites without CrUX API configured may get artificially lower scores without appropriate messaging.

**Recommendation:** When CWV checks are skipped, either: (1) exclude them from scoring entirely, or (2) mark them as `passed: true` with a "skipped" flag.

---

### Tier 3 & 4 Check Implementation Gaps

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-05 | **HIGH** | `checks/tier3/*.ts` | Multiple Tier 3 checks are non-functional stubs: T3-07 (semantic gap), T3-08/09/10 (backlinks), T3-11/12/13 (engagement) all return `passed: true` with `skipped: true` when APIs are not configured. This inflates scores since "passed" checks add points. |

**Impact:** Tier 3 contributes 10 points but most checks are effectively stubbed, causing inflated scores.

**Recommendation:** Skipped checks should return `passed: false` OR be excluded from scoring. Alternatively, add a `skipContributesToScore: false` flag.

---

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-06 | **HIGH** | `checks/tier4/*.ts` | Tier 4 checks T4-03, T4-04, T4-05 are all stubs returning `passed: true` with reason "Topic cluster data required". These checks inflate score by 1.2 points (3 * 0.4 weight) without performing actual validation. |

**Impact:** Pages incorrectly get credit for passing pillar/spoke checks that are never evaluated.

**Recommendation:** Return `passed: false` for skipped checks or exclude from scoring.

---

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-07 | **MEDIUM** | `checks/tier4/differentiation.ts` | T4-06 (duplicate content check) always returns `passed: true` because page fingerprinting comparison is not implemented. The check computes a fingerprint but does not compare against other pages in SiteContext. |

**Impact:** Duplicate content gate (50 cap) will never trigger since T4-06 never fails with `duplicatePercent > 60`.

**Recommendation:** Implement cross-page fingerprint comparison or mark as non-functional.

---

### Individual Check Logic Issues

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-08 | **MEDIUM** | `checks/tier1/heading-structure.ts` | T1-08 (H1 matches title) uses overly strict containment logic: `title.includes(h1) || h1.includes(title)`. This fails for "SEO Best Practices Guide" vs "Best SEO Guide 2026" which are semantically related but don't contain each other as substrings. |

**Impact:** False negatives for semantically matching H1/title pairs.

**Recommendation:** Implement keyword overlap check (e.g., 60%+ shared significant words).

---

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-09 | **LOW** | `checks/tier1/content-structure.ts` | T1-29 (short paragraphs) counts ALL paragraphs via `body p` selector including navigation, footer, and sidebar. This can cause false failures on pages with short navigation text or widget paragraphs. |

**Impact:** Minor false positives on sites with complex layouts.

**Recommendation:** Scope to `article p, main p, .content p` only.

---

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-10 | **LOW** | `checks/tier1/eeat-signals.ts` | T1-68 (YMYL author check) requires 2+ YMYL keywords to classify as YMYL, but common pages mentioning "safety" once or "money" once won't trigger the check. The threshold may be too high for edge cases. |

**Impact:** Some YMYL pages may not be flagged due to keyword threshold.

**Recommendation:** Consider weighting by keyword prominence (e.g., in H1/title counts as 2x).

---

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-11 | **LOW** | `checks/tier2/content-quality.ts` | T2-01 (reading level) uses Flesch-Kincaid formula which has known limitations for technical content. Syllable counting heuristics may miscount compound words and technical terms. |

**Impact:** Technical articles may get false negatives for "high reading level".

**Recommendation:** Consider adding domain-specific exceptions or alternative readability metrics.

---

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-12 | **MEDIUM** | `checks/tier2/content-quality.ts` | `extractText()` function mutates the shared Cheerio instance by calling `$("script, style, noscript").remove()` directly. This permanently removes these elements from the DOM, affecting subsequent checks in the same tier. |

**Impact:** Checks running after T2-01 won't see script/style/noscript elements.

**Recommendation:** Clone the DOM before mutation: `const $clone = $.root().clone(); const $cloned = $.load($clone.html());`

---

### Validation & Error Handling

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-13 | **MEDIUM** | `checks/runner.ts` | Error handling returns `severity: "high"` for all check errors regardless of the check's actual severity. A low-severity check that throws should not be reported as high severity. |

**Impact:** Minor check errors appear as severe issues.

**Recommendation:** Preserve the check's defined severity on error: `severity: check.severity`.

---

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-14 | **LOW** | `checks/tier1/technical-basics.ts` | T1-55 (canonical) does not handle query parameters correctly. A canonical of `https://example.com/page?ref=123` vs current URL `https://example.com/page` would fail the "self-referencing" check even though canonicals often intentionally exclude query params. |

**Impact:** False negatives for pages with query parameters.

**Recommendation:** Compare without query parameters OR make the comparison configurable.

---

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-15 | **LOW** | `checks/tier1/technical-basics.ts` | T1-67 (noindex check) does not check X-Robots-Tag HTTP header - only meta tags in HTML. Comment says "This would require headers to be passed in context" but CheckContext has no headers field. |

**Impact:** Pages with noindex via HTTP header may be incorrectly marked as indexable.

**Recommendation:** Add `responseHeaders` to CheckContext and check X-Robots-Tag.

---

### Result Aggregation

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-16 | **LOW** | `checks/registry.ts` | No deduplication of checks with the same ID. If a check file is accidentally imported twice, the check would be registered twice, causing duplicate results. |

**Impact:** Potential for duplicate check results in edge cases.

**Recommendation:** Add ID uniqueness check: `if (checksById.has(check.id)) throw new Error(...)`.

---

### Quality Gate Implementation

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEO-17 | **HIGH** | Various | The 80 score quality gate for auto-publish is referenced in CLAUDE.md but NO actual implementation exists in the audit engine. The `calculateOnPageScore` function returns a score but there's no gate check like `if (score >= 80) { autoPublish() }`. |

**Impact:** Auto-publish quality gate may not be enforced.

**Recommendation:** Implement quality gate check in AuditService or content pipeline.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 4 |
| MEDIUM | 7 |
| LOW | 6 |

**Key Issues:**
1. Score can exceed 100 (no normalization)
2. Skipped Tier 3/4 checks inflate scores by returning `passed: true`
3. Tier 2 content-quality.ts mutates shared Cheerio DOM
4. Quality gate (score >= 80) is documented but not implemented

**Recommended Priority Fixes:**
1. Fix scoring normalization to cap at 100
2. Change skipped checks to return `passed: false` or exclude from scoring
3. Clone Cheerio DOM before mutation in extractText()
4. Implement quality gate enforcement in content pipeline

---

## Files Reviewed

- `/open-seo-main/src/server/lib/audit/checks/index.ts`
- `/open-seo-main/src/server/lib/audit/checks/scoring.ts`
- `/open-seo-main/src/server/lib/audit/checks/scoring.test.ts`
- `/open-seo-main/src/server/lib/audit/checks/registry.ts`
- `/open-seo-main/src/server/lib/audit/checks/runner.ts`
- `/open-seo-main/src/server/lib/audit/checks/types.ts`
- `/open-seo-main/src/server/lib/audit/checks/tier1/*.ts` (14 files)
- `/open-seo-main/src/server/lib/audit/checks/tier2/*.ts` (7 files)
- `/open-seo-main/src/server/lib/audit/checks/tier3/*.ts` (5 files)
- `/open-seo-main/src/server/lib/audit/checks/tier4/*.ts` (3 files)
- `/open-seo-main/src/server/lib/audit/url-policy.ts`
- `/open-seo-main/src/server/features/audit/services/AuditService.ts`
- `/open-seo-main/src/routes/api/audit/run-checks.ts`
- `/open-seo-main/src/serverFunctions/audit.ts`
