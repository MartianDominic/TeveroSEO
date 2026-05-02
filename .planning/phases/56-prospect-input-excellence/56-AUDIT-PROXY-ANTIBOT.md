# Proxy Infrastructure & Anti-Bot Audit

**Date:** 2026-05-01  
**Auditor:** Claude Opus 4.5  
**Reference:** `docs/infra-research/crawling-10-5000-tasks-day.md`

---

## Executive Summary

TeveroSEO **outsources all crawling to DataForSEO's OnPage API**, which handles proxy rotation, TLS fingerprinting, and bot evasion internally. This is appropriate for Phase 0-1 volumes (~$0.02/page) but creates gaps that affect audit accuracy in EU markets and prevents Phase 2 cost optimization.

### Overall Status: Managed Service (No Self-Hosted Infra)

---

## Requirements vs Implementation

| Requirement | Status | Notes |
|-------------|--------|-------|
| Tiered proxy (DC + residential) | NOT IMPLEMENTED | DataForSEO handles |
| curl_cffi for TLS fingerprint | NOT IMPLEMENTED | Native fetch() only |
| User-Agent + Accept-Language: lt-LT | NOT IMPLEMENTED | DataForSEO handles |
| Per-domain rate limit (0.5-1 req/s) | **PARTIAL** | 5 req/s global, 1s delay |
| Per-domain render mode cache | NOT IMPLEMENTED | Always JS rendering |
| GB tracking / bandwidth metering | NOT IMPLEMENTED | USD cost only |
| Consent wall detection | **NOT IMPLEMENTED** | **CRITICAL GAP** |
| HTML byte-size sanity check | NOT IMPLEMENTED | No validation |
| Cloudflare Bot Fight detection | NOT IMPLEMENTED | No detection |
| Playwright block_resources() | N/A | No Playwright for crawling |

---

## Critical Gap: Consent Wall Detection

**Infra Doc Warning (Trap Q1):**
> GDPR cookie-consent walls and Cloudflare bot-challenge pages return HTTP 200 with `<title>` and structured-looking HTML, but the body is a consent shell — not the page content. Your audit silently reports "thin content / missing schema / no internal links" for pages that are actually rich.

**Current Status:** No consent wall detection

**Impact for Lithuanian/EU Prospects:**
- GDPR consent walls are ubiquitous in EU
- Audits may report false negatives (thin content for rich pages)
- User sees incorrect audit results
- Platform trust eroded

**Common Consent Managers to Detect:**
- Cookiebot: `CookiebotWidget`, `CybotCookiebotDialog`
- OneTrust: `onetrust-banner`, `onetrust-consent`
- Iubenda: `iubenda-cs`, `iubenda-consent`

---

## Rate Limiting Assessment

**Current Implementation:**

```typescript
// redis-rate-limiter.ts - Global only
export const dataForSeoRateLimiter = new RedisRateLimiter("dataforseo", 5, 5);

// multiPageScraper.ts - Fixed delay
const SCRAPE_DELAY_MS = 1000;
await sleep(SCRAPE_DELAY_MS);
```

**Gap:** No per-domain tracking. 50 prospects hitting same domain share global limit.

**Infra Doc Requirement:**
> 0.5-1 req/s per domain. Per-site asyncio.Semaphore(8).

---

## Render Mode Cache

**Current Implementation:** None

```typescript
// dataforseoScraper.ts - Always enables JS
[{ url, enable_javascript: true, store_raw_html: true }]
```

**Infra Doc Warning:**
> enable_browser_rendering on OnPage raises per-page cost from $0.000125 to ~$0.001 (8x)

**Impact:** Paying 8x for JS rendering on static sites that don't need it.

---

## Current Architecture (Phase 0-1)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ TeveroSEO   │────▶│ DataForSEO API   │────▶│ Target Site │
│ Platform    │     │ (Managed Proxy)  │     │             │
└─────────────┘     └──────────────────┘     └─────────────┘
                    
                    DataForSEO handles:
                    ✓ Proxy rotation
                    ✓ TLS fingerprint
                    ✓ JS rendering
                    ✓ Bot evasion
                    
Cost: ~$0.02/page (JS-rendered)
Volume: <500 pages/day
```

---

## Target Architecture (Phase 2)

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│ TeveroSEO   │────▶│ Self-Hosted     │────▶│ Target Site │
│ Platform    │     │ Crawl4AI/Crawlee│     │             │
└─────────────┘     └─────────────────┘     └─────────────┘
                    │
                    ├── Hetzner DC IPs (unprotected LT)
                    ├── Webshare/SOAX Residential
                    ├── curl_cffi TLS fingerprint
                    ├── Per-domain rate limiting
                    ├── Consent wall detection
                    └── Resource blocking
                    
Cost: ~$0.01-0.02/task (blended)
Volume: 5,000 tasks/day
```

---

## Recommendations

### Priority 0: Consent Wall Detection (CRITICAL)

```typescript
// Proposed: server/lib/scraper/consentDetector.ts
const CONSENT_SIGNATURES = {
  cookiebot: ['CookiebotWidget', 'Cookiebot', 'CybotCookiebotDialog'],
  onetrust: ['onetrust-banner', 'onetrust-consent', 'optanon-'],
  iubenda: ['iubenda-cs', 'iubenda-consent'],
};

export function detectConsentWall(html: string): ConsentResult {
  for (const [provider, signatures] of Object.entries(CONSENT_SIGNATURES)) {
    if (signatures.some(sig => html.includes(sig))) {
      return { detected: true, provider, severity: 'blocking' };
    }
  }
  return { detected: false };
}
```

### Priority 1: HTML Size Sanity Check

```typescript
// Add after receiving HTML
const htmlSize = Buffer.byteLength(html, 'utf8');
if (htmlSize < 5000) {
  log.warn('Small HTML response, possible challenge page', { url, size: htmlSize });
  // Flag for manual review or retry
}
```

### Priority 2: Per-Domain Rate Limiting

```typescript
export function getDomainRateLimiter(domain: string): RedisRateLimiter {
  return new RedisRateLimiter(`domain:${domain}`, 1, 2); // 1 req/s, burst 2
}
```

### Priority 3: Render Mode Cache (Phase 2 Prep)

```
Redis key: domain:render_mode:{domain}
Values: "static" | "js_required" | "unknown"
TTL: 7 days
```

---

## Files Audited

| File | Status |
|------|--------|
| `open-seo-main/src/server/lib/scraper/dataforseoScraper.ts` | Delegates to DataForSEO |
| `open-seo-main/src/server/lib/scraper/multiPageScraper.ts` | 1s delay, no per-domain |
| `open-seo-main/src/server/lib/http-client.ts` | No proxy, no TLS |
| `open-seo-main/src/server/lib/redis-rate-limiter.ts` | Global limits only |
| `open-seo-main/.env.example` | No proxy credentials |

---

## Action Items

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Add consent wall detection | 4h | Prevents false audit results |
| **P0** | Add HTML size sanity check | 2h | Detects blocked pages |
| P1 | Add per-domain rate limiting | 4h | Prevents target abuse |
| P2 | Design proxy abstraction layer | 8h | Enables Phase 2 |
| P2 | Add render mode caching | 8h | 8x cost reduction |

**P0 fixes should be in Phase 56 scope** to ensure accurate audit results for EU prospects.
