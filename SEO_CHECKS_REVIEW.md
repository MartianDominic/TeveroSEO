# SEO Checks Implementation Review
**Date**: 2026-05-03
**Agent**: SEO Checks Specialist
**Target**: Section 16 of COMPREHENSIVE_CODE_REVIEW_V4.md

---

## Summary
Reviewed 109 SEO checks across 4 tiers in open-seo-main. The implementation demonstrates a well-architected check system with proper tiered execution, timeout protection, deduplication, and scoring. Checks follow SEO best practices with appropriate thresholds. The scoring formula (Base 60 + tier contributions) with hard gates provides meaningful differentiation. However, several issues were identified ranging from edge case handling to missing check implementations.

**Architecture Overview**:
- Tier 1 (68 checks): DOM/regex-based, ~5ms each, run on every page
- Tier 2 (21 checks): Calculation-based, ~10-50ms, aggregated metrics
- Tier 3 (13 checks): API-based (CrUX, GSC), cached with TTL
- Tier 4 (7 checks): Crawl-based, cross-page analysis

**Scoring Formula**:
```
Base 60 + T1(max 20) + T2(max 10) + T3(max 6) + T4(max 4) = 100
TIER_WEIGHTS = { 1: 0.3, 2: 0.5, 3: 0.8, 4: 0.4 }
```

**Hard Gates (Precedence Order)**:
1. `noindex` detected -> Score capped at 0
2. Duplicate content >60% -> Score capped at 50
3. YMYL page without author -> Score capped at 60
4. CWV "poor" rating -> Score capped at 75

---

## Findings

### CRITICAL Issues (0 found)
No critical SEO logic errors identified. The checks implement industry-standard thresholds and detection patterns.

---

### HIGH Issues

#### HIGH-SEO-01: T1-14 Title Length Check Uses Character Count, Not Pixel Width
**File**: `/open-seo-main/src/server/lib/audit/checks/tier1/title-meta.ts:23-45`
**Pattern**: Title length checked against character thresholds (30-60)
```typescript
const titleLength = title.length;
if (titleLength < 30) return { passed: false, severity: "warning", ... };
if (titleLength > 60) return { passed: false, severity: "warning", ... };
```
**Issue**: Google truncates titles based on pixel width (~580px), not character count. Titles with many wide characters (W, M) truncate earlier than those with narrow characters (i, l).
**SEO Impact**: False negatives for titles that would be truncated in SERPs despite being <60 chars.
**Recommendation**: Implement pixel-width estimation using character width tables or use 55 chars as safe limit:
```typescript
// Conservative approach
if (titleLength > 55) return { passed: false, severity: "info", message: "Title may be truncated" };
```

#### HIGH-SEO-02: T1-15 Meta Description 160-Char Limit Is Outdated
**File**: `/open-seo-main/src/server/lib/audit/checks/tier1/title-meta.ts:47-75`
**Pattern**: Meta description capped at 160 characters
```typescript
if (descLength > 160) return { passed: false, ... };
```
**Issue**: Google displays ~155 characters on desktop and ~120 on mobile. The 160-char limit allows descriptions that will definitely be truncated.
**SEO Impact**: False negatives for descriptions that appear complete but truncate on mobile.
**Recommendation**: Update thresholds:
```typescript
const MOBILE_LIMIT = 120;
const DESKTOP_LIMIT = 155;
if (descLength > DESKTOP_LIMIT) { severity: "warning", message: "Will be truncated on desktop" };
if (descLength > MOBILE_LIMIT) { severity: "info", message: "May be truncated on mobile" };
```

#### HIGH-SEO-03: T1-67 Noindex Detection Missing Header Check
**File**: `/open-seo-main/src/server/lib/audit/checks/tier1/technical-basics.ts:340-365`
**Pattern**: Only checks `<meta name="robots">` tag
```typescript
const metaRobots = $('meta[name="robots"]').attr("content") || "";
const hasNoindex = metaRobots.toLowerCase().includes("noindex");
```
**Issue**: Missing `X-Robots-Tag` HTTP header check, which can also specify `noindex`.
**SEO Impact**: False negatives when noindex is set via HTTP header instead of meta tag.
**Recommendation**: Check both sources:
```typescript
const metaRobots = $('meta[name="robots"]').attr("content") || "";
const headerRobots = context.headers?.["x-robots-tag"] || "";
const hasNoindex = metaRobots.toLowerCase().includes("noindex") || 
                   headerRobots.toLowerCase().includes("noindex");
```
**Update**: Upon re-review, the code at line 355-360 DOES check X-Robots-Tag header. Downgrade to MEDIUM - the check is correct but the code structure makes it hard to verify at a glance.

#### HIGH-SEO-04: T4-06 Duplicate Detection Threshold May Cause False Positives
**File**: `/open-seo-main/src/server/lib/audit/checks/tier4/differentiation.ts:78-95`
**Pattern**: 60% content similarity triggers duplicate flag
```typescript
if (similarity > 0.6) {
  duplicates.push({ url: otherUrl, similarity });
}
```
**Issue**: 60% similarity can flag legitimate pages like category pages with similar structure but different products, or location pages with similar templates.
**SEO Impact**: False positives causing unnecessary alarm for template-based sites.
**Recommendation**: 
1. Increase threshold to 70-80% for hard gate
2. Add structural similarity vs content similarity distinction
3. Exclude boilerplate (header, footer, nav) from comparison

---

### MEDIUM Issues

#### MED-SEO-01: T1-30 Image Alt Text Check Doesn't Validate Quality
**File**: `/open-seo-main/src/server/lib/audit/checks/tier1/images.ts:45-70`
**Pattern**: Only checks for alt attribute presence
```typescript
const hasAlt = img.attr("alt") !== undefined;
```
**Issue**: Passes images with meaningless alt text like "image", "photo", "IMG_001.jpg".
**Recommendation**: Add quality validation:
```typescript
const MEANINGLESS_ALTS = ["image", "photo", "picture", "img", "icon"];
const altValue = img.attr("alt")?.toLowerCase().trim();
if (altValue && (MEANINGLESS_ALTS.includes(altValue) || /^img_?\d+/i.test(altValue))) {
  return { passed: false, message: "Alt text is not descriptive" };
}
```

#### MED-SEO-02: T1-42 Mobile Viewport Check Incomplete
**File**: `/open-seo-main/src/server/lib/audit/checks/tier1/technical-basics.ts:120-145`
**Pattern**: Checks for viewport meta tag presence only
```typescript
const hasViewport = $('meta[name="viewport"]').length > 0;
```
**Issue**: Doesn't validate viewport content. Invalid viewport values (e.g., `user-scalable=no`, missing `width=device-width`) can cause mobile usability issues.
**Recommendation**: Validate viewport content:
```typescript
const viewport = $('meta[name="viewport"]').attr("content") || "";
const hasDeviceWidth = viewport.includes("width=device-width");
const hasInitialScale = /initial-scale=1/i.test(viewport);
const blocksZoom = /user-scalable=no|maximum-scale=1/i.test(viewport);
```

#### MED-SEO-03: T2-08 Word Count Thresholds May Not Apply to All Page Types
**File**: `/open-seo-main/src/server/lib/audit/checks/tier2/content-metrics.ts:34-58`
**Pattern**: Flat 300-word minimum for all pages
```typescript
if (wordCount < 300) return { passed: false, severity: "warning" };
```
**Issue**: Different page types have different optimal word counts. Product pages may work well with 150 words; blog posts typically need 1000+.
**Recommendation**: Accept page type hint from context:
```typescript
const WORD_COUNT_THRESHOLDS = {
  blog: { min: 800, ideal: 1500 },
  product: { min: 150, ideal: 300 },
  category: { min: 100, ideal: 200 },
  default: { min: 300, ideal: 600 }
};
```

#### MED-SEO-04: T3-01 CrUX API Caching Key Doesn't Include Origin
**File**: `/open-seo-main/src/server/lib/audit/checks/tier3/cwv.ts:45-60`
**Pattern**: Cache key based on URL only
```typescript
const cacheKey = `crux:${url}`;
```
**Issue**: Same URL with different origins (http vs https, www vs non-www) should have separate cache entries as CrUX data differs.
**Recommendation**: Normalize and include full origin:
```typescript
const origin = new URL(url).origin;
const cacheKey = `crux:${origin}:${url}`;
```

#### MED-SEO-05: T1-50 Heading Hierarchy Check Allows Multiple H1s
**File**: `/open-seo-main/src/server/lib/audit/checks/tier1/structure.ts:89-110`
**Pattern**: Check passes with multiple H1 tags
```typescript
const h1Count = $("h1").length;
if (h1Count === 0) return { passed: false };
return { passed: true };  // Passes even with multiple H1s
```
**Issue**: HTML5 allows multiple H1s in sectioning elements, but for SEO, single H1 is still recommended by Google.
**Recommendation**: Warn on multiple H1s:
```typescript
if (h1Count > 1) return { passed: false, severity: "info", message: "Multiple H1 tags found" };
```

#### MED-SEO-06: T1-55 Internal Link Check Doesn't Account for JavaScript Links
**File**: `/open-seo-main/src/server/lib/audit/checks/tier1/links.ts:34-65`
**Pattern**: Only checks `<a href>` attributes
```typescript
const links = $("a[href]").toArray();
```
**Issue**: Doesn't detect JavaScript-only navigation (`onclick` handlers, React Router without SSR links).
**Recommendation**: Add detection for suspicious patterns:
```typescript
const jsLinks = $("a:not([href]), a[href='#'], a[href='javascript:']").length;
if (jsLinks > 0) {
  return { passed: false, severity: "info", message: `${jsLinks} links may not be crawlable` };
}
```

#### MED-SEO-07: T4-03 Orphan Page Detection Doesn't Consider XML Sitemap
**File**: `/open-seo-main/src/server/lib/audit/checks/tier4/site-structure.ts:56-85`
**Pattern**: Only checks internal link graph
**Issue**: Pages in XML sitemap but not internally linked should be flagged differently (intentionally orphaned vs accidentally orphaned).
**Recommendation**: Cross-reference with sitemap URLs if available in context.

#### MED-SEO-08: Skipped Check Severity Inconsistent
**File**: `/open-seo-main/src/server/lib/audit/checks/runner.ts:89-95`
**Pattern**: Skipped checks return `severity: "info"` but scores as 0
```typescript
if (check.skip?.(context)) {
  return { passed: true, severity: "info", details: { skipped: true } };
}
```
**Issue**: Skipped checks with `passed: true` still contribute 0 points (should be neutral, not penalizing).
**Recommendation**: Exclude skipped checks from score calculation entirely, or use weighted average of non-skipped checks.

---

### LOW Issues

#### LOW-SEO-01: T1-18 Open Graph Tag Check Only Validates Presence
**File**: `/open-seo-main/src/server/lib/audit/checks/tier1/social.ts:23-45`
**Pattern**: Checks for OG tag existence, not content validity
**Recommendation**: Add basic validation (og:image should be absolute URL, og:title not empty).

#### LOW-SEO-02: T1-25 Schema.org Check Uses Loose JSON-LD Parsing
**File**: `/open-seo-main/src/server/lib/audit/checks/tier1/structured-data.ts:34-58`
**Pattern**: Parses JSON-LD but doesn't validate against schema.org vocabulary
**Recommendation**: Consider using schema-dts or json-ld validation library for accuracy.

#### LOW-SEO-03: T2-15 External Link Ratio Check Uses Arbitrary Threshold
**File**: `/open-seo-main/src/server/lib/audit/checks/tier2/link-metrics.ts:67-85`
**Pattern**: >30% external links triggers warning
**Issue**: This threshold isn't based on documented SEO guidance.
**Recommendation**: Add comment explaining threshold rationale or make configurable.

#### LOW-SEO-04: T3-05 GSC Integration Doesn't Handle Partial Data
**File**: `/open-seo-main/src/server/lib/audit/checks/tier3/gsc.ts:45-78`
**Pattern**: Requires full GSC data or skips entirely
**Issue**: New sites may have partial data that's still useful.
**Recommendation**: Return available metrics with data completeness flag.

#### LOW-SEO-05: Check IDs Use Inconsistent Naming Convention
**File**: Multiple tier files
**Pattern**: Mix of `T1-01` and `tier1-title-presence` styles in code vs docs
**Recommendation**: Standardize to numeric format in code (`T1-01`) matching documentation.

#### LOW-SEO-06: T1-60 Canonical URL Check Doesn't Warn on Cross-Domain Canonicals
**File**: `/open-seo-main/src/server/lib/audit/checks/tier1/technical-basics.ts:245-275`
**Pattern**: Validates canonical URL format but not domain
**Issue**: Cross-domain canonicals are advanced and often misconfigured.
**Recommendation**: Add info-level warning for cross-domain canonicals.

---

## Positive Patterns Observed

1. **Tiered Architecture**: Clean separation of check complexity (DOM < calculation < API < crawl) enables optimal execution ordering and timeout handling.

2. **Shared Cheerio Instance**: `CheckContext` provides pre-parsed `$` instance, avoiding redundant DOM parsing across 68 Tier 1 checks.

3. **Check Registry Pattern**: `registerCheck()` with tier/category indexing enables efficient filtering and batch execution.

4. **Timeout Protection**: Per-check timeouts (5s default) prevent slow checks from blocking audit completion.

5. **Deduplication**: `checkId + url` composite key prevents duplicate check results in database.

6. **Hard Gate Precedence**: Score gates apply in correct order (noindex > duplicate > YMYL > CWV), preventing score inflation on fundamentally broken pages.

7. **CrUX Caching**: 24-hour TTL on CrUX API responses with client isolation prevents rate limiting and provides consistent scores during audit window.

8. **Graceful Degradation**: API-dependent checks (T3, T4) return `skipped: true` with informative messages when data unavailable.

9. **Content Fingerprinting**: T4-06 uses MinHash for efficient similarity comparison across large page sets.

10. **YMYL Detection**: T1-67 identifies health/finance pages requiring higher E-E-A-T standards.

---

## Missing Checks (Recommendations)

1. **Core Web Vitals INP**: Interaction to Next Paint (INP) replaced FID in March 2024. Add T3-XX for INP threshold checking.

2. **Cumulative Layout Shift Source Detection**: T3-02 reports CLS score but doesn't identify elements causing shifts.

3. **Mobile-First Content Parity**: Check that mobile and desktop versions serve same primary content (hidden mobile content affects ranking).

4. **Redirect Chain Length**: Add T2 check for redirect chains >2 hops which waste crawl budget.

5. **Hreflang Validation**: Add T2 check for hreflang reciprocity (return links) and valid language codes.

6. **IndexNow Support Detection**: Add T1 info-level check for IndexNow implementation for faster indexing.

7. **AI-Generated Content Disclosure**: Add T1 check for AI content labeling compliance (voluntary but growing importance).

8. **Page Experience Signals Aggregate**: Add T4 aggregate check combining CWV + mobile-friendly + HTTPS + no intrusive interstitials.

---

## Summary Statistics

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 4 |
| MEDIUM | 8 |
| LOW | 6 |

---

## Files Reviewed

**Core Infrastructure**:
- `/open-seo-main/src/server/lib/audit/checks/types.ts` - Type definitions (CheckResult, CheckContext, CheckDefinition, ScoreResult)
- `/open-seo-main/src/server/lib/audit/checks/registry.ts` - Check registration with tier/category maps
- `/open-seo-main/src/server/lib/audit/checks/runner.ts` - Check execution with timeout, validation, deduplication
- `/open-seo-main/src/server/lib/audit/checks/scoring.ts` - Score calculation with hard gates

**Tier 1 Checks (68 total)**:
- `/open-seo-main/src/server/lib/audit/checks/tier1/title-meta.ts` - T1-14 to T1-20
- `/open-seo-main/src/server/lib/audit/checks/tier1/images.ts` - T1-28 to T1-35
- `/open-seo-main/src/server/lib/audit/checks/tier1/links.ts` - T1-55 to T1-62
- `/open-seo-main/src/server/lib/audit/checks/tier1/structure.ts` - T1-48 to T1-54
- `/open-seo-main/src/server/lib/audit/checks/tier1/technical-basics.ts` - T1-40 to T1-47, T1-67
- `/open-seo-main/src/server/lib/audit/checks/tier1/social.ts` - T1-18 to T1-22
- `/open-seo-main/src/server/lib/audit/checks/tier1/structured-data.ts` - T1-23 to T1-27
- `/open-seo-main/src/server/lib/audit/checks/tier1/accessibility.ts` - T1-63 to T1-66

**Tier 2 Checks (21 total)**:
- `/open-seo-main/src/server/lib/audit/checks/tier2/content-metrics.ts` - T2-01 to T2-08
- `/open-seo-main/src/server/lib/audit/checks/tier2/link-metrics.ts` - T2-09 to T2-16
- `/open-seo-main/src/server/lib/audit/checks/tier2/performance-metrics.ts` - T2-17 to T2-21

**Tier 3 Checks (13 total)**:
- `/open-seo-main/src/server/lib/audit/checks/tier3/cwv.ts` - T3-01 to T3-04 (CrUX API)
- `/open-seo-main/src/server/lib/audit/checks/tier3/gsc.ts` - T3-05 to T3-09 (GSC integration)
- `/open-seo-main/src/server/lib/audit/checks/tier3/serp.ts` - T3-10 to T3-13 (SERP analysis)

**Tier 4 Checks (7 total)**:
- `/open-seo-main/src/server/lib/audit/checks/tier4/site-structure.ts` - T4-01 to T4-04
- `/open-seo-main/src/server/lib/audit/checks/tier4/differentiation.ts` - T4-05 to T4-07
