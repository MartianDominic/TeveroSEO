---
phase: 31-site-connection
plan: 02
subsystem: connections
tags: [platform-detection, fingerprinting, cheerio]
dependency_graph:
  requires: [cheerio]
  provides: [detectPlatform, DETECTION_PROBES]
  affects: []
tech_stack:
  added: []
  patterns: [multi-probe-fingerprinting, weighted-scoring]
key_files:
  created:
    - src/server/features/connections/services/PlatformDetector.ts
    - src/server/features/connections/services/PlatformDetector.test.ts
    - src/server/features/connections/index.ts
  modified:
    - src/server/features/connections/services/CredentialEncryption.ts
decisions:
  - "Weighted scoring: high >= 100, medium >= 50, low < 50"
  - "WordPress /wp-json/ API probe via HEAD request for efficiency"
  - "Return 'custom' platform for unknown sites instead of null"
metrics:
  duration_seconds: 286
  completed: "2026-04-22T14:00:18Z"
  tasks_completed: 2
  tests_added: 21
  lines_added: 859
---

# Phase 31 Plan 02: Platform Detection Service Summary

Multi-probe fingerprinting service detecting WordPress, Shopify, Wix, Squarespace, Webflow via weighted signal scoring.

## What Was Built

### Platform Detection Service (`PlatformDetector.ts`)

- **detectPlatform(url)**: Async function returning `{ platform, confidence, signals }`
- **DETECTION_PROBES**: Exported array of probe configurations for extensibility

Detection signals by platform:

| Platform    | Signal                              | Weight | Type |
|-------------|-------------------------------------|--------|------|
| WordPress   | /wp-json/ API exists                | 100    | api  |
| WordPress   | /wp-content/ in HTML                | 80     | cdn  |
| WordPress   | meta[generator*="WordPress"]        | 90     | meta |
| Shopify     | cdn.shopify.com in HTML             | 100    | cdn  |
| Shopify     | .myshopify.com in HTML              | 100    | cdn  |
| Wix         | wixstatic.com in HTML               | 100    | cdn  |
| Wix         | parastorage.com in HTML             | 90     | cdn  |
| Squarespace | static.squarespace.com in HTML      | 100    | cdn  |
| Squarespace | meta[generator*="Squarespace"]      | 90     | meta |
| Webflow     | webflow.io or website-files.com     | 100    | cdn  |
| Webflow     | meta[generator*="Webflow"]          | 90     | meta |

### Confidence Scoring

- **High**: Total score >= 100 (definitive platform indicator found)
- **Medium**: Total score >= 50 (partial indicators)
- **Low**: Total score < 50 (returned with platform="custom")

### Barrel Export (`index.ts`)

Exports all connections feature services and types:
- `detectPlatform`, `DETECTION_PROBES`
- `encryptCredential`, `decryptCredential`, `validateEncryptionKey`
- `PlatformType`, `ConnectionStatus`, `DetectionResult`, `DetectionSignal`
- `PLATFORM_TYPES`, `CONNECTION_STATUS`

## Tests

21 tests covering:
- WordPress detection (high/medium confidence scenarios)
- Shopify detection (cdn.shopify.com and .myshopify.com)
- Wix detection (wixstatic.com and parastorage.com)
- Squarespace detection (static.squarespace.com and generator meta)
- Webflow detection (webflow.io and generator meta)
- Unknown platforms return "custom" with "low" confidence
- Signal tracking with weights
- Network error handling (returns custom, doesn't crash)
- URL normalization (adds https:// if missing)

## Commits

| Hash      | Type     | Description                                |
|-----------|----------|--------------------------------------------|
| `d447b0b` | test     | Add failing tests for platform detection   |
| `d797b2f` | feat     | Implement platform detection service       |
| `7094c85` | feat     | Create barrel export + fix crypto import   |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed CredentialEncryption crypto import**
- **Found during:** Task 2 (barrel export)
- **Issue:** `import crypto from "node:crypto"` failed - crypto module has no default export
- **Fix:** Changed to `import * as crypto from "node:crypto"` (namespace import)
- **Files modified:** `src/server/features/connections/services/CredentialEncryption.ts`
- **Commit:** `7094c85`

## Success Criteria Verification

- [x] detectPlatform function implemented and exported
- [x] WordPress detection: /wp-json/ -> high, /wp-content/ only -> medium
- [x] Shopify detection: cdn.shopify.com or .myshopify.com -> high
- [x] Wix detection: wixstatic.com -> high
- [x] Squarespace detection: static.squarespace.com -> high
- [x] Webflow detection: webflow.io or assets-global.website-files.com -> high
- [x] Unknown sites: 'custom' with 'low' confidence
- [x] All tests pass: 21/21

## Self-Check: PASSED

**Created files exist:**
- FOUND: src/server/features/connections/services/PlatformDetector.ts (315 lines)
- FOUND: src/server/features/connections/services/PlatformDetector.test.ts (516 lines)
- FOUND: src/server/features/connections/index.ts (28 lines)

**Commits exist:**
- FOUND: d447b0b (test)
- FOUND: d797b2f (feat)
- FOUND: 7094c85 (feat)
