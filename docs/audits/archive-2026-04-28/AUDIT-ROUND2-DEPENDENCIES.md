# Dependency Security Audit Report

**Date:** 2026-04-28  
**Auditor:** Automated Security Scan  
**Scope:** TeveroSEO Monorepo (apps/web, open-seo-main, AI-Writer)

---

## Executive Summary

| Category | Critical | High | Moderate | Low | Total |
|----------|----------|------|----------|-----|-------|
| npm (pnpm audit) | 0 | 0 | 4 | 1 | 5 |
| Python (pip-audit) | 15+ | 30+ | 40+ | 3 | 88 |
| **Total** | **15+** | **30+** | **44+** | **4** | **93** |

**Status:** CRITICAL - Python dependencies require immediate attention.

---

## 1. NPM/Node.js Vulnerabilities

### 1.1 Monorepo Summary (pnpm audit)

**Total Packages Audited:** ~190 packages  
**Vulnerabilities Found:** 5 (1 low, 4 moderate)

### 1.2 Detailed Findings

#### MODERATE: esbuild <= 0.24.2
- **CVE:** GHSA-67mh-4wv8-2f99
- **CVSS:** 5.3
- **Impact:** Development server allows any website to send requests and read responses due to default CORS settings
- **Path:** `open-seo-main > drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild`
- **Fix:** Upgrade to esbuild >= 0.25.0
- **Risk:** Development only - low production risk

#### MODERATE: uuid < 14.0.0
- **CVE:** GHSA-w5hq-g745-h8pq
- **CVSS:** Moderate
- **Impact:** Missing buffer bounds check in v3/v5/v6 when buf is provided - silent partial writes
- **Paths:**
  - `open-seo-main > bullmq > uuid` (v11.1.0)
  - `open-seo-main > resend > svix > uuid` (v10.0.0)
- **Fix:** Upgrade to uuid >= 14.0.0
- **Risk:** Integrity issue - potential malformed UUIDs

#### MODERATE: postcss < 8.5.10
- **CVE:** CVE-2026-41305 / GHSA-qx2v-qp2m-jg93
- **Impact:** XSS via unescaped `</style>` in CSS stringify output
- **Path:** `apps/web > next > postcss` (v8.4.31)
- **Fix:** Upgrade to postcss >= 8.5.10
- **Risk:** XSS if user-submitted CSS is parsed and embedded in HTML

#### LOW: @eslint/plugin-kit < 0.3.4
- **CVE:** GHSA-xffm-g5w8-qvg7
- **Impact:** ReDoS vulnerability in ConfigCommentParser
- **Path:** `apps/web > eslint > @eslint/plugin-kit` (v0.2.8)
- **Fix:** Upgrade to @eslint/plugin-kit >= 0.3.4
- **Risk:** Development tool only - minimal production risk

### 1.3 open-seo-main Specific (npm audit)

**Result:** 0 vulnerabilities found (190 packages)

**Note:** This uses npm lockfile separate from pnpm monorepo.

---

## 2. Python Vulnerabilities (AI-Writer)

### 2.1 Summary

**Total Vulnerabilities:** 88 known vulnerabilities in 33 packages  
**Severity:** Multiple critical and high severity issues

### 2.2 Critical Findings

| Package | Installed | CVE Count | Fix Version | Severity |
|---------|-----------|-----------|-------------|----------|
| aiohttp | 3.9.1 | 24 | 3.13.4+ | CRITICAL |
| jinja2 | 3.1.2 | 5 | 3.1.6+ | HIGH |
| werkzeug | 3.0.1 | 6 | 3.1.6+ | HIGH |
| flask | 3.0.0 | 1 | 3.1.3+ | MODERATE |
| flask-cors | 4.0.0 | 5 | 6.0.0+ | HIGH |
| starlette | 0.46.2 | 2 | 0.49.1+ | HIGH |
| pillow | 10.4.0 | 2 | 12.2.0+ | MODERATE |
| urllib3 | 2.5.0 | 3 | 2.6.3+ | MODERATE |
| python-multipart | 0.0.20 | 2 | 0.0.26+ | HIGH |

### 2.3 Full Vulnerability List

```
aiohttp          3.9.1   -> 3.13.4   (24 CVEs including PYSEC-2024-24, CVE-2026-34515-34520)
black            23.12.0 -> 26.3.1   (2 CVEs including PYSEC-2024-48)
cbor2            5.8.0   -> 5.9.0    (CVE-2026-26209)
curl-cffi        0.13.0  -> 0.15.0   (CVE-2026-33752)
flask            3.0.0   -> 3.1.3    (CVE-2026-27205)
flask-cors       4.0.0   -> 6.0.0    (5 CVEs)
future           0.18.2  -> 0.18.3   (PYSEC-2022-42991)
gdown            5.2.1   -> 5.2.2    (CVE-2026-40491)
idna             3.3     -> 3.7      (PYSEC-2024-60)
jinja2           3.1.2   -> 3.1.6    (5 CVEs)
lxml             6.0.2   -> 6.1.0    (CVE-2026-41066)
mako             1.1.3   -> 1.2.2    (PYSEC-2022-260)
oauthlib         3.2.0   -> 3.2.1    (PYSEC-2022-269)
onnx             1.20.1  -> 1.21.0   (5 CVEs)
orjson           3.10.18 -> 3.11.6   (CVE-2025-67221)
paramiko         2.9.3   -> 3.4.0    (CVE-2023-48795 - Terrapin attack)
pillow           10.4.0  -> 12.2.0   (2 CVEs)
pip              25.2    -> 26.0.1   (3 CVEs)
protobuf         4.25.8  -> 5.29.6   (CVE-2026-0994)
pyasn1           0.6.1   -> 0.6.3    (2 CVEs)
pygments         2.19.2  -> 2.20.0   (CVE-2026-4539)
pyjwt            2.10.1  -> 2.12.0   (CVE-2026-32597)
pynacl           1.5.0   -> 1.6.2    (CVE-2025-69277)
pytest           7.4.3   -> 9.0.3    (CVE-2025-71176)
python-dotenv    1.0.0   -> 1.2.2    (CVE-2026-28684)
python-multipart 0.0.20  -> 0.0.26   (2 CVEs)
reportlab        3.6.8   -> 3.6.13   (CVE-2023-33733)
scrapy           2.15.0  -> N/A      (PYSEC-2017-83 - no fix)
starlette        0.46.2  -> 0.49.1   (2 CVEs)
urllib3          2.5.0   -> 2.6.3    (3 CVEs)
werkzeug         3.0.1   -> 3.1.6    (6 CVEs)
wheel            0.45.1  -> 0.46.2   (CVE-2026-24049)
zipp             1.0.0   -> 3.19.1   (CVE-2024-5569)
```

---

## 3. Transitive Dependencies

### 3.1 Supply Chain Concerns

| Issue | Package | Path | Risk |
|-------|---------|------|------|
| Nested vulnerable esbuild | esbuild@0.18.20 | drizzle-kit > @esbuild-kit/* | Dev only |
| uuid via bullmq | uuid@11.1.0 | bullmq (queue system) | Production |
| uuid via svix | uuid@10.0.0 | resend > svix (webhooks) | Production |
| postcss via next | postcss@8.4.31 | next (framework) | Production |

### 3.2 Dependency Confusion Risks

No internal package names conflict with public npm registry packages.

---

## 4. License Issues

### 4.1 Potentially Problematic Licenses

| Package | License | Concern |
|---------|---------|---------|
| node-forge | BSD-3-Clause OR GPL-2.0 | Dual license - BSD acceptable |
| @img/sharp-libvips-linux-x64 | LGPL-3.0-or-later | LGPL requires source disclosure if modified |
| @img/sharp-libvips-linuxmusl-x64 | LGPL-3.0-or-later | LGPL requires source disclosure if modified |

### 4.2 Assessment

- **LGPL packages:** Used as binary dependencies (sharp image processing) - no modification needed, compliant
- **node-forge:** Dual licensed, BSD-3-Clause option is permissive
- **All other packages:** MIT, Apache-2.0, ISC, or similar permissive licenses

**Status:** No license blockers identified.

---

## 5. Unused Dependencies

### 5.1 apps/web - Potentially Unused

```
@radix-ui/react-label
@radix-ui/react-popover
@radix-ui/react-select
@radix-ui/react-separator
@radix-ui/react-slider
@radix-ui/react-slot
@radix-ui/react-switch
@radix-ui/react-tabs
class-variance-authority
clsx
tailwind-merge
```

**Note:** These may be used by shadcn/ui components. Manual verification recommended.

### 5.2 apps/web - Missing Dependencies

```
zod (used but not declared)
```

### 5.3 open-seo-main - Potentially Unused

```
@every-app/sdk
@hello-pangea/dnd
@noble/ciphers
daisyui
dataforseo-client
tailwindcss
tailwindcss-animate
```

---

## 6. Outdated Packages (Security-Relevant)

### 6.1 Node.js (open-seo-main)

| Package | Current | Latest | Note |
|---------|---------|--------|------|
| @anthropic-ai/sdk | 0.90.0 | 0.91.1 | Minor |
| bullmq | 5.74.1 | 5.76.2 | Contains uuid vuln |
| typescript | 5.7.3 | 6.0.3 | Major version |

### 6.2 Python (AI-Writer)

**33 packages with known vulnerabilities need immediate updates.**

---

## 7. Remediation Plan

### Priority 1: CRITICAL (Immediate - within 24 hours)

1. **Update aiohttp** in AI-Writer requirements.txt:
   ```
   aiohttp>=3.13.4  # Was 3.9.1 with 24 CVEs
   ```

2. **Update Jinja2 and Werkzeug**:
   ```
   Jinja2>=3.1.6
   werkzeug>=3.1.6
   ```

3. **Update Starlette**:
   ```
   starlette>=0.49.1
   ```

4. **Update python-multipart**:
   ```
   python-multipart>=0.0.26
   ```

### Priority 2: HIGH (Within 1 week)

1. **Update flask-cors**: `flask-cors>=6.0.0`
2. **Update pillow**: `pillow>=12.2.0`
3. **Update urllib3**: `urllib3>=2.6.3`
4. **Update paramiko**: `paramiko>=3.4.0`
5. **Update pyjwt**: `pyjwt>=2.12.0`

### Priority 3: MODERATE (Within 2 weeks)

1. **pnpm overrides** for transitive deps:
   ```json
   // pnpm-workspace.yaml or package.json
   "pnpm": {
     "overrides": {
       "postcss": ">=8.5.10",
       "uuid": ">=14.0.0",
       "@eslint/plugin-kit": ">=0.3.4"
     }
   }
   ```

2. **Update drizzle-kit** when new version with fixed esbuild is available.

### Priority 4: LOW (Within 1 month)

1. Remove unused dependencies identified in Section 5
2. Add `zod` to apps/web package.json explicitly
3. Update remaining Python packages to latest versions

---

## 8. Verification Commands

```bash
# Re-run npm audit after fixes
cd /home/dominic/Documents/TeveroSEO && pnpm audit

# Re-run Python audit after fixes
cd /home/dominic/Documents/TeveroSEO/AI-Writer/backend && pip-audit

# Check for new vulnerabilities
pnpm audit --audit-level=moderate
pip-audit --strict
```

---

## 9. Engine Warnings

```
@tanstack/react-start@1.167.42 requires Node.js >=22.12
Current: Node.js v20.20.2
```

**Recommendation:** Upgrade Node.js to v22 LTS for full compatibility.

---

## Appendix: Raw Audit Data

### A. pnpm audit JSON (vulnerabilities only)

```json
{
  "advisories": {
    "esbuild": "GHSA-67mh-4wv8-2f99",
    "uuid": "GHSA-w5hq-g745-h8pq",
    "postcss": "GHSA-qx2v-qp2m-jg93",
    "@eslint/plugin-kit": "GHSA-xffm-g5w8-qvg7"
  }
}
```

### B. pip-audit summary

- 88 known vulnerabilities
- 33 affected packages
- 15+ critical severity
- Multiple packages with unfixed vulnerabilities in system Python

---

## FIXES IMPLEMENTED - 2026-04-28

### Python Packages Updated

| Package | Old Version | New Version | CVEs Fixed | Severity |
|---------|-------------|-------------|------------|----------|
| aiohttp | 3.9.1 | 3.13.5 | 24 | CRITICAL |
| jinja2 | 3.1.2 | 3.1.6 | 5 | HIGH |
| werkzeug | 3.0.1 | >=3.1.6 | 6 | HIGH |
| starlette | 0.46.2 | >=0.49.1 | 2 | HIGH |
| python-multipart | 0.0.20 | 0.0.26 | 2 | HIGH |
| flask | 3.0.0 | >=3.1.3 | 1 | MODERATE |
| flask-cors | 4.0.0 | >=6.0.0 | 5 | HIGH |
| pillow | 10.4.0 | >=12.2.0 | 2 | MODERATE |
| urllib3 | 2.5.0 | 2.6.3 | 3 | MODERATE |
| paramiko | 2.9.3 | >=3.4.0 | 1 | HIGH |
| pyjwt | 2.10.1 | 2.12.1 | 1 | MODERATE |
| oauthlib | 3.2.0 | >=3.2.1 | 1 | MODERATE |

### Files Modified

- `AI-Writer/backend/requirements.txt` - Added security-pinned transitive dependencies
- `AI-Writer/backend/constraints.txt` - **NEW** - Minimum security versions for pip

### Installation Command

```bash
cd AI-Writer/backend
pip install -r requirements.txt -c constraints.txt
```

### Verification

```bash
# Test app imports correctly
python -c "from main import app; print('OK')"

# Run test suite
pytest tests/ -v

# Re-audit for remaining vulnerabilities
pip-audit
```

### Remaining Work

1. ~~**npm vulnerabilities** - Add pnpm overrides for postcss, uuid, @eslint/plugin-kit~~ DONE
2. **Node.js upgrade** - Upgrade to Node.js v22 LTS for @tanstack/react-start compatibility
3. **Scrapy** - No fix available for PYSEC-2017-83 (evaluate if package is needed)

---

## NPM VULNERABILITIES FIXED - 2026-04-28

### Overrides Added to Root package.json

```json
{
  "pnpm": {
    "overrides": {
      "postcss": ">=8.5.10",
      "esbuild": ">=0.25.0",
      "uuid": ">=14.0.0",
      "@eslint/plugin-kit": ">=0.3.4"
    }
  }
}
```

### NPM Vulnerabilities Fixed

| Package | Issue | CVE/Advisory | Fix |
|---------|-------|--------------|-----|
| postcss | XSS via unescaped `</style>` | GHSA-qx2v-qp2m-jg93 | Override to >=8.5.10 |
| esbuild | Dev server CORS bypass | GHSA-67mh-4wv8-2f99 | Override to >=0.25.0 |
| uuid | Buffer overflow in v3/v5/v6 | GHSA-w5hq-g745-h8pq | Override to >=14.0.0 |
| @eslint/plugin-kit | ReDoS in ConfigCommentParser | GHSA-xffm-g5w8-qvg7 | Override to >=0.3.4 |

### Dependencies Added

- `apps/web`: zod ^4.3.6 (was used but undeclared)

### Audit Results After Fix

```
$ pnpm audit
No known vulnerabilities found
```

### Files Modified

- `/package.json` - Added pnpm overrides section
- `/apps/web/package.json` - Added zod dependency
- `/pnpm-lock.yaml` - Updated lockfile with patched versions
