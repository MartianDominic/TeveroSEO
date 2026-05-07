# Camoufox Detection Testing and Verification Guide

> World-class detection testing and verification for Camoufox anti-bot evasion
> Created: 2026-05-07

---

## Table of Contents

1. [Detection Test Sites](#1-detection-test-sites)
2. [Anti-Bot Vendors](#2-anti-bot-vendors-to-test-against)
3. [Automated Verification Scripts](#3-automated-verification-scripts)
4. [Common Detection Failures](#4-common-detection-failures)
5. [Regression Testing](#5-regression-testing)
6. [Production Monitoring](#6-production-monitoring)
7. [Verification Checklist](#7-verification-checklist)

---

## 1. Detection Test Sites

### 1.1 bot.sannysoft.com

**What it tests:**
- WebDriver property detection (`navigator.webdriver`)
- User-Agent header analysis (HeadlessChrome flag)
- API-level inconsistencies (Canvas/GPU mismatch)
- WebGL and AudioContext checks
- JavaScript prototype pollution/patching detection
- Browser tampering artifacts

**Test categories:**
- Intoli.com tests + additions
- Fingerprint Scanner tests
- Fp-collect info

**Current status:** Somewhat outdated (focuses on Selenium/PhantomJS), but useful for quick visual feedback.

**Target score:** Pass 95%+ of 20+ fingerprint tests (vanilla Puppeteer scores 10-20%)

**URL:** https://bot.sannysoft.com/

---

### 1.2 pixelscan.net

**What it checks:**
- IP address exposure and geolocation
- WebRTC leak detection
- JavaScript settings and capabilities
- Canvas fingerprinting
- Audio context fingerprinting
- Font enumeration
- WebGL rendering
- HTTP headers analysis
- DNS leak testing
- VPN/proxy detection

**Key features:**
- Combines IP detection, bot detection, DNS leak testing, and full fingerprint analysis
- Supports both mobile and desktop browsers
- No registration required

**Target:** No inconsistencies flagged, clean fingerprint report

**URL:** https://pixelscan.net/

---

### 1.3 browserleaks.com

**Critical pages to test:**

| Page | What It Reveals |
|------|-----------------|
| `/webgl` | WebGL fingerprint, GPU vendor/renderer, unique identifier |
| `/webrtc` | Real local/public IP even behind VPN |
| `/canvas` | Canvas fingerprint uniqueness |
| `/fonts` | System font enumeration |
| `/javascript` | User agent, screen resolution, battery status, OS, plugins |
| `/geo` | Geolocation accuracy |

**Target:** No IP leaks via WebRTC, consistent fingerprint components

**URL:** https://browserleaks.com/

---

### 1.4 CreepJS

**Scoring system:**
- **Trust Score:** 0-100%
- **Above 90%:** Convincing human-like fingerprint
- **50-90%:** Potential issues but may pass
- **Below 50%:** Obvious automation or spoofing

**What makes a "good" score:**
- Consistency across all browser properties
- No "lies" detected (property mismatches)
- Natural entropy in fingerprint components
- Matching iframe behavior with main window
- Consistent worker thread values

**What makes a "bad" score:**
- Iframe inconsistency (different API responses in iframe vs main window)
- Suspicious behavior patterns (excessive fingerprinting, worker scope tampering)
- Mismatched request headers
- Patched native objects detected
- Prototype chain anomalies

**Baseline benchmark:** Standard Chrome typically scores ~66% trust

**Camoufox target:** 0% headless detection, 90%+ trust score

**URL:** https://abrahamjuliot.github.io/creepjs/

---

### 1.5 bot.incolumitas.com

**What it tests:**
- IP Timezone vs Browser Timezone comparison
- HTTP Proxy Headers detection
- TCP/IP Fingerprinting (TCP Options, Window Size, IP Fragment Flag)
- TLS Fingerprinting (JA3/JA4)
- Behavioral score (0-1, where <0.5 = likely bot)
- WebGL cube render timing
- CPU/GPU latency measurement (virtual GPU detection)

**Unique features:**
- Real-world challenge-based testing
- Behavioral scoring system
- Actively maintained with latest detection techniques

**Target score:** Behavioral classification > 0.5

**URL:** https://bot.incolumitas.com/

---

### 1.6 fingerprintjs.com (FingerprintJS/BotD)

**Detection signals (30+ attributes):**
- Installed fonts
- CPU core count
- Device memory
- Browser languages
- WebGL renderer
- Audio fingerprint
- Canvas fingerprint
- Plugin list

**Bot detection result values:**
- `Good bot` - Known search engine crawler
- `Bad bot` - Automation tool detected
- `Bot not detected` - Likely human

**Camoufox target:** "Bot not detected" result

**URL:** https://fingerprintjs.github.io/BotD/main/

---

## 2. Anti-Bot Vendors to Test Against

### 2.1 Cloudflare

**Detection triggers:**
- TLS fingerprinting (JA3/JA4) mismatch
- HTTP/2 or HTTP/3 header anomalies
- Missing or invalid browser fingerprints
- `navigator.webdriver = true`
- Default viewport sizes (800x600, 1280x720)
- Rapid/repetitive requests
- Datacenter IP ranges (AWS, GCP)
- Incomplete JavaScript execution
- Cookie/session inconsistencies

**Bot score threshold:** Scores above 30 get challenged/blocked (0-99 scale)

**Challenge types:**
- 5-second JavaScript challenge
- Turnstile (invisible, managed, non-interactive modes)
- Error 1020 blocks

**Key insight:** Turnstile tokens valid for 300 seconds, single-use only

**Bypass requirements:**
- Match TLS fingerprint to real browser
- Execute JavaScript challenges natively
- Use residential proxy rotation
- Implement natural behavioral patterns

---

### 2.2 Akamai Bot Manager

**Detection layers (5 simultaneous):**
1. IP reputation
2. TLS fingerprinting (JA3/JA4)
3. JavaScript challenges
4. Behavior analysis
5. Session monitoring

**Known signatures:**
- 3,000+ categorized bot signatures
- `bmak.js` sensor payload fingerprinting
- `_abck` cookie carries bot score
- JA3 hash mismatch detection
- Missing HTTP/2 pseudo-headers
- Unusual header ordering
- WebGL vendor mismatches

**2026 updates:**
- AI-powered bot detection
- 300%+ increase in AI bot traffic detection
- Continuous ML model updates

**Key challenge:** JavaScript detection logic regenerates on each page load

---

### 2.3 PerimeterX/HUMAN

**Detection methods:**
- Multi-layer system: IP, TLS, headers, fingerprint, session, behavior
- Behavioral biometrics (mouse movements, keystroke speeds, scroll behavior)
- Browser fingerprinting (Canvas, WebGL, fonts, screen resolution)
- Request/navigation patterns
- Session duration analysis
- Page interaction timing

**HUMAN Challenge:**
- Press-and-hold CAPTCHA with behavioral biometric validation
- Telemetry payload required before and during interaction

**Key insight:** Even clean residential proxies fail if other signals are off

---

### 2.4 DataDome

**Two-pronged approach:**

| Method | Details |
|--------|---------|
| **Fingerprinting** | Canvas hash, WebGL renderer, AudioContext, screen metrics, font enumeration, Navigator plugins |
| **Behavioral** | Mouse movement patterns, scroll behavior, typing rhythm, click precision, dwell time |

**Picasso technique:**
- Device class fingerprinting using pixel rendering differences
- Detects OS/browser misrepresentation via graphical hardware differences

**Key insight:** Behavioral analysis harder to spoof than static fingerprints

**Detection signals:**
- Linear/jittery cursor paths
- Uniform typing speed
- Fixed scroll intervals
- No user hesitation or dwell time

---

### 2.5 Imperva/Incapsula

**Detection approach:**
- 700+ dimensions analyzed
- Direct client interrogation
- Behavior analysis (server-side and client-side)
- Machine learning models
- Connection characteristics
- Threat intelligence feeds

**Key techniques:**
- JA3/JA4 TLS fingerprinting
- Obfuscated JavaScript challenges for real-time behavioral data
- Continuous trust score adjustment
- Page navigation timing checks
- Mouse clicks, movements, keyboard inputs, scrolling patterns

**2025-2026 advancements:**
- AI-aware protection
- AI tool fingerprinting
- Multilayered detection with real-time policy-based response

---

### 2.6 Kasada

**Detection methods:**
- Trust score calculation (multi-stage, weighted average)
- Negative scores for cloud hosting IPs (AWS, GCP)
- JavaScript fingerprinting (navigator, device specs, runtime, hardware)
- Behavioral telemetry (mouse coordinates, scroll acceleration, click timing, keyboard sequences)

**Known bypass techniques (2026):**
- Resistant JA3 fingerprint
- Residential proxy rotation
- HTTP2 with browser-like headers
- Session warm-up before targeting data pages

**Detection indicators in response:**
- `x-kpsdk-ct` header
- `x-kpsdk-r` header
- `x-kpsdk-c` header

**Key challenge:** JavaScript detection logic regenerates per page load (similar to Akamai)

---

## 3. Automated Verification Scripts

### 3.1 Programmatic Detection Score Testing

```python
#!/usr/bin/env python3
"""
Camoufox Detection Test Suite
Automated verification against major detection test sites
"""

import asyncio
import json
from datetime import datetime
from dataclasses import dataclass
from typing import Optional
from camoufox.async_api import AsyncCamoufox

@dataclass
class DetectionResult:
    site: str
    passed: bool
    score: Optional[float]
    details: dict
    timestamp: str

class CamoufoxDetectionTester:
    """Automated detection testing for Camoufox configurations"""
    
    TEST_SITES = {
        "sannysoft": "https://bot.sannysoft.com/",
        "pixelscan": "https://pixelscan.net/",
        "creepjs": "https://abrahamjuliot.github.io/creepjs/",
        "incolumitas": "https://bot.incolumitas.com/",
        "browserleaks_webgl": "https://browserleaks.com/webgl",
        "browserleaks_webrtc": "https://browserleaks.com/webrtc",
        "browserleaks_canvas": "https://browserleaks.com/canvas",
    }
    
    THRESHOLDS = {
        "sannysoft_pass_rate": 0.95,  # 95% of tests should pass
        "creepjs_trust_score": 0.90,  # 90%+ trust score
        "incolumitas_behavioral": 0.5,  # Above 0.5 = likely human
        "pixelscan_inconsistencies": 0,  # Zero inconsistencies
    }
    
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.results: list[DetectionResult] = []
    
    async def test_sannysoft(self, page) -> DetectionResult:
        """Test against bot.sannysoft.com"""
        await page.goto(self.TEST_SITES["sannysoft"], wait_until="networkidle")
        await asyncio.sleep(3)  # Allow all tests to complete
        
        # Extract test results
        results = await page.evaluate("""
            () => {
                const rows = document.querySelectorAll('table tr');
                let passed = 0;
                let failed = 0;
                const details = {};
                
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const testName = cells[0].textContent.trim();
                        const result = cells[1].textContent.trim();
                        const isPassed = cells[1].classList.contains('passed') || 
                                        result.toLowerCase().includes('ok') ||
                                        !cells[1].classList.contains('failed');
                        details[testName] = { result, passed: isPassed };
                        if (isPassed) passed++;
                        else failed++;
                    }
                });
                
                return { passed, failed, total: passed + failed, details };
            }
        """)
        
        pass_rate = results["passed"] / max(results["total"], 1)
        
        return DetectionResult(
            site="sannysoft",
            passed=pass_rate >= self.THRESHOLDS["sannysoft_pass_rate"],
            score=pass_rate,
            details=results,
            timestamp=datetime.now().isoformat()
        )
    
    async def test_creepjs(self, page) -> DetectionResult:
        """Test against CreepJS"""
        await page.goto(self.TEST_SITES["creepjs"], wait_until="networkidle")
        await asyncio.sleep(10)  # CreepJS needs time for all tests
        
        # Extract trust score and lie detection
        results = await page.evaluate("""
            () => {
                // Look for trust score element
                const trustElement = document.querySelector('[class*="trust"]');
                const liesElement = document.querySelector('[class*="lies"]');
                
                let trustScore = null;
                let lies = [];
                
                if (trustElement) {
                    const match = trustElement.textContent.match(/([0-9.]+)%/);
                    if (match) trustScore = parseFloat(match[1]) / 100;
                }
                
                // Check for detected lies
                const lieElements = document.querySelectorAll('.lies li, [class*="lie"]');
                lieElements.forEach(el => lies.push(el.textContent.trim()));
                
                return { trustScore, lies, lieCount: lies.length };
            }
        """)
        
        trust_score = results.get("trustScore") or 0
        
        return DetectionResult(
            site="creepjs",
            passed=trust_score >= self.THRESHOLDS["creepjs_trust_score"],
            score=trust_score,
            details=results,
            timestamp=datetime.now().isoformat()
        )
    
    async def test_incolumitas(self, page) -> DetectionResult:
        """Test against bot.incolumitas.com"""
        await page.goto(self.TEST_SITES["incolumitas"], wait_until="networkidle")
        await asyncio.sleep(5)
        
        results = await page.evaluate("""
            () => {
                const data = {};
                
                // Look for behavioral score
                const scoreElements = document.querySelectorAll('[class*="score"], [id*="score"]');
                scoreElements.forEach(el => {
                    const match = el.textContent.match(/([0-9.]+)/);
                    if (match) data.behavioralScore = parseFloat(match[1]);
                });
                
                // Check detection results
                const resultElements = document.querySelectorAll('.result, .test-result');
                data.tests = [];
                resultElements.forEach(el => {
                    data.tests.push({
                        name: el.querySelector('.name')?.textContent || '',
                        result: el.querySelector('.value')?.textContent || ''
                    });
                });
                
                return data;
            }
        """)
        
        behavioral_score = results.get("behavioralScore", 0)
        
        return DetectionResult(
            site="incolumitas",
            passed=behavioral_score >= self.THRESHOLDS["incolumitas_behavioral"],
            score=behavioral_score,
            details=results,
            timestamp=datetime.now().isoformat()
        )
    
    async def test_browserleaks_webrtc(self, page) -> DetectionResult:
        """Test for WebRTC IP leaks"""
        await page.goto(self.TEST_SITES["browserleaks_webrtc"], wait_until="networkidle")
        await asyncio.sleep(3)
        
        results = await page.evaluate("""
            () => {
                const localIP = document.querySelector('#rtc-local-ip, .local-ip');
                const publicIP = document.querySelector('#rtc-public-ip, .public-ip');
                
                return {
                    localIPLeaked: localIP && localIP.textContent.trim() !== 'n/a',
                    publicIPLeaked: publicIP && publicIP.textContent.trim() !== 'n/a',
                    localIP: localIP?.textContent.trim() || 'n/a',
                    publicIP: publicIP?.textContent.trim() || 'n/a'
                };
            }
        """)
        
        # No IP leaks = passed
        no_leaks = not results.get("localIPLeaked") and not results.get("publicIPLeaked")
        
        return DetectionResult(
            site="browserleaks_webrtc",
            passed=no_leaks,
            score=1.0 if no_leaks else 0.0,
            details=results,
            timestamp=datetime.now().isoformat()
        )
    
    async def run_all_tests(self, os_config: str = "windows") -> dict:
        """Run all detection tests with specified OS configuration"""
        async with AsyncCamoufox(
            os=os_config,
            headless=True,
            config={
                "webgl.disabled": False,
                "media.peerconnection.enabled": False,  # Disable WebRTC
            }
        ) as browser:
            page = await browser.new_page()
            
            # Run tests
            self.results = []
            
            for test_name, test_method in [
                ("sannysoft", self.test_sannysoft),
                ("creepjs", self.test_creepjs),
                ("incolumitas", self.test_incolumitas),
                ("browserleaks_webrtc", self.test_browserleaks_webrtc),
            ]:
                try:
                    result = await test_method(page)
                    self.results.append(result)
                    print(f"[{'PASS' if result.passed else 'FAIL'}] {test_name}: {result.score}")
                except Exception as e:
                    print(f"[ERROR] {test_name}: {e}")
                    self.results.append(DetectionResult(
                        site=test_name,
                        passed=False,
                        score=0,
                        details={"error": str(e)},
                        timestamp=datetime.now().isoformat()
                    ))
        
        return self.generate_report()
    
    def generate_report(self) -> dict:
        """Generate summary report"""
        passed = sum(1 for r in self.results if r.passed)
        total = len(self.results)
        
        return {
            "summary": {
                "passed": passed,
                "failed": total - passed,
                "total": total,
                "pass_rate": passed / max(total, 1),
                "timestamp": datetime.now().isoformat()
            },
            "results": [
                {
                    "site": r.site,
                    "passed": r.passed,
                    "score": r.score,
                    "details": r.details
                }
                for r in self.results
            ],
            "recommendation": "PRODUCTION_READY" if passed == total else "NEEDS_REVIEW"
        }

# CLI entry point
async def main():
    tester = CamoufoxDetectionTester()
    report = await tester.run_all_tests(os_config="windows")
    
    print("\n" + "="*60)
    print("DETECTION TEST REPORT")
    print("="*60)
    print(json.dumps(report, indent=2))
    
    # Save report
    with open("detection_test_report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    return report["summary"]["pass_rate"] >= 1.0

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
```

### 3.2 Headless vs Headed Detection Comparison

```python
"""
Compare detection rates between headless and headed modes
"""

import asyncio
from camoufox.async_api import AsyncCamoufox

async def compare_modes():
    """Test detection in both headless and headed modes"""
    
    test_url = "https://abrahamjuliot.github.io/creepjs/"
    results = {}
    
    for mode, headless in [("headed", False), ("headless", True)]:
        async with AsyncCamoufox(headless=headless, os="windows") as browser:
            page = await browser.new_page()
            await page.goto(test_url, wait_until="networkidle")
            await asyncio.sleep(10)
            
            # Extract headless detection score
            score = await page.evaluate("""
                () => {
                    const el = document.querySelector('[class*="headless"]');
                    return el ? el.textContent : 'not found';
                }
            """)
            
            results[mode] = {
                "headless_detection": score,
                "mode": mode
            }
            
            print(f"{mode.upper()}: Headless detection = {score}")
    
    return results

if __name__ == "__main__":
    asyncio.run(compare_modes())
```

### 3.3 Configuration A/B Testing

```python
"""
A/B test different Camoufox configurations
"""

import asyncio
import json
from camoufox.async_api import AsyncCamoufox

CONFIGURATIONS = {
    "baseline": {},
    "windows_spoofed": {
        "os": "windows"
    },
    "macos_spoofed": {
        "os": "macos"
    },
    "webrtc_disabled": {
        "media.peerconnection.enabled": False
    },
    "full_stealth": {
        "os": "windows",
        "media.peerconnection.enabled": False,
        "webgl.disabled": False,
    }
}

async def test_configuration(name: str, config: dict) -> dict:
    """Test a specific configuration against CreepJS"""
    try:
        async with AsyncCamoufox(
            headless=True,
            config=config,
            os=config.get("os", "windows")
        ) as browser:
            page = await browser.new_page()
            await page.goto("https://abrahamjuliot.github.io/creepjs/", 
                          wait_until="networkidle")
            await asyncio.sleep(10)
            
            # Extract scores
            scores = await page.evaluate("""
                () => {
                    const results = {};
                    document.querySelectorAll('[class*="score"]').forEach(el => {
                        const key = el.className;
                        const match = el.textContent.match(/([0-9.]+)/);
                        if (match) results[key] = parseFloat(match[1]);
                    });
                    return results;
                }
            """)
            
            return {
                "config": name,
                "passed": True,
                "scores": scores
            }
    except Exception as e:
        return {
            "config": name,
            "passed": False,
            "error": str(e)
        }

async def run_ab_tests():
    """Run A/B tests across all configurations"""
    results = []
    
    for name, config in CONFIGURATIONS.items():
        print(f"Testing configuration: {name}")
        result = await test_configuration(name, config)
        results.append(result)
        print(f"  Result: {'PASS' if result['passed'] else 'FAIL'}")
    
    # Find best configuration
    best = max(
        [r for r in results if r.get("scores")],
        key=lambda x: sum(x.get("scores", {}).values()),
        default=None
    )
    
    return {
        "results": results,
        "best_config": best["config"] if best else None
    }

if __name__ == "__main__":
    report = asyncio.run(run_ab_tests())
    print(json.dumps(report, indent=2))
```

---

## 4. Common Detection Failures

### 4.1 What Makes Camoufox Detectable

| Issue | Description | Fix |
|-------|-------------|-----|
| **Fingerprint Inconsistencies** | Mismatched Canvas/WebGL outputs, AudioContext signatures, timezone settings | Ensure geo-consistency across all signals |
| **Proxy/Browser Mismatch** | IP exits from one region, browser signals another | Match proxy region to browser timezone/locale |
| **Maintenance Gap (2026)** | Year gap in Camoufox maintenance led to newly discovered inconsistencies | Use latest preview releases, test thoroughly |
| **Behavioral Detection** | Linear mouse movements, uniform timing | Use human-like mouse movement algorithms |

### 4.2 WebDriver Property Leaks

**The problem:**
- `navigator.webdriver = true` exposes automation
- Even when patched via `Object.defineProperty`, detection scripts check:
  - Property descriptor inspection
  - Prototype chain checking
  - Iframe leaks (new iframes get original value)
  - Worker thread checks (inherit unpatched value)

**Camoufox solution:**
- C++ level interception - no JavaScript patching needed
- Gecko engine source code modified directly
- SpiderMonkey returns spoofed values natively

**Still detectable via:**
- `document.$cdc_asdjflasutopfhvcZLmcfl_` (ChromeDriver markers)
- Inconsistent responses in different contexts

### 4.3 Automation Timing Patterns

**Detectable patterns:**
- Constant velocity mouse movements
- Perfectly straight lines
- Uniform click intervals
- Zero hesitation or dwell time
- Fixed scroll intervals
- Perfect event sequence timing

**Human characteristics to emulate:**
- Non-linear curves with variable acceleration
- Micro-corrections and slight tremors
- Natural hesitations and pauses
- Variable scroll patterns
- Gaussian-distributed delays between actions

### 4.4 Missing Browser Features

| Missing Feature | Detection Impact |
|-----------------|------------------|
| Empty plugins array | Immediate bot signal |
| Default viewport (800x600, 1280x720) | Known automation defaults |
| Missing fonts | Fingerprint mismatch |
| Disabled WebGL | Suspicious gap in fingerprint |
| No AudioContext | Missing fingerprint component |
| Virtual GPU latency | Cloud infrastructure detection |

### 4.5 Inconsistent Fingerprint Components

**Cross-component consistency required:**

```
OS (Windows) -> Fonts (Windows fonts) -> User-Agent (Windows UA)
            -> Screen metrics (typical Windows resolutions)
            -> Timezone (consistent with IP geolocation)
            -> Language (consistent with locale)
            -> WebGL renderer (realistic GPU for platform)
```

**Common inconsistencies:**
- Linux OS with Windows fonts
- macOS User-Agent with Windows GPU
- Datacenter IP with residential browser fingerprint
- Timezone mismatch with IP geolocation

---

## 5. Regression Testing

### 5.1 Ensuring Config Changes Don't Break Stealth

```python
"""
Regression test suite for Camoufox configuration changes
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime

BASELINE_FILE = Path("detection_baseline.json")

class RegressionTester:
    def __init__(self):
        self.baseline = self.load_baseline()
    
    def load_baseline(self) -> dict:
        """Load baseline scores from previous run"""
        if BASELINE_FILE.exists():
            with open(BASELINE_FILE) as f:
                return json.load(f)
        return {}
    
    def save_baseline(self, results: dict):
        """Save current results as new baseline"""
        with open(BASELINE_FILE, "w") as f:
            json.dump(results, f, indent=2)
    
    async def run_regression_tests(self) -> dict:
        """Run tests and compare against baseline"""
        from detection_tester import CamoufoxDetectionTester
        
        tester = CamoufoxDetectionTester()
        current = await tester.run_all_tests()
        
        regressions = []
        improvements = []
        
        for result in current["results"]:
            site = result["site"]
            current_score = result["score"] or 0
            baseline_score = self.baseline.get(site, {}).get("score", 0)
            
            if current_score < baseline_score - 0.05:  # 5% tolerance
                regressions.append({
                    "site": site,
                    "baseline": baseline_score,
                    "current": current_score,
                    "delta": current_score - baseline_score
                })
            elif current_score > baseline_score + 0.05:
                improvements.append({
                    "site": site,
                    "baseline": baseline_score,
                    "current": current_score,
                    "delta": current_score - baseline_score
                })
        
        return {
            "status": "FAIL" if regressions else "PASS",
            "regressions": regressions,
            "improvements": improvements,
            "timestamp": datetime.now().isoformat()
        }
```

### 5.2 CI/CD Integration

```yaml
# .github/workflows/detection-tests.yml
name: Camoufox Detection Tests

on:
  push:
    paths:
      - 'src/scraping/**'
      - 'config/camoufox/**'
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6am
  workflow_dispatch:

jobs:
  detection-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install camoufox playwright
          playwright install firefox
      
      - name: Run detection tests
        run: |
          python scripts/detection_test.py
        env:
          DISPLAY: ':99'
      
      - name: Check for regressions
        run: |
          python scripts/regression_check.py
      
      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: detection-report
          path: detection_test_report.json
      
      - name: Fail on regressions
        run: |
          if grep -q '"status": "FAIL"' regression_report.json; then
            echo "Detection regressions found!"
            cat regression_report.json
            exit 1
          fi
```

### 5.3 Baseline Scores to Maintain

| Test Site | Minimum Acceptable Score | Target Score |
|-----------|--------------------------|--------------|
| bot.sannysoft.com | 90% pass rate | 95%+ pass rate |
| CreepJS trust | 80% | 90%+ |
| CreepJS headless detection | 10% | 0% |
| bot.incolumitas.com behavioral | 0.4 | 0.6+ |
| pixelscan inconsistencies | < 3 | 0 |
| browserleaks WebRTC leak | No IP leak | No IP leak |

---

## 6. Production Monitoring

### 6.1 Detecting When Blocks Start Occurring

```python
"""
Production monitoring for scraping success rates
"""

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional

@dataclass
class ScrapeResult:
    url: str
    domain: str
    status: str  # success, blocked, challenged, error
    status_code: Optional[int]
    block_type: Optional[str]  # cloudflare, akamai, datadome, etc.
    timestamp: datetime

class ProductionMonitor:
    """Monitor scraping success rates and detect blocks"""
    
    # Challenge page detection patterns
    CHALLENGE_PATTERNS = {
        "cloudflare": [
            "Checking your browser",
            "Just a moment",
            "cf-browser-verification",
            "cf_chl_opt",
            "__cf_bm",
            "Attention Required! | Cloudflare",
        ],
        "akamai": [
            "Access Denied",
            "_abck",
            "bmak",
            "ak_bmsc",
        ],
        "datadome": [
            "datadome",
            "dd_s",
            "DataDome",
        ],
        "perimeterx": [
            "_px",
            "human challenge",
            "Press and hold",
        ],
        "imperva": [
            "incap_ses",
            "visid_incap",
            "Incapsula",
        ],
        "kasada": [
            "x-kpsdk",
            "Kasada",
        ],
    }
    
    # HTTP status codes indicating blocks
    BLOCK_STATUS_CODES = {403, 429, 503, 520, 521, 522, 523, 524}
    
    def __init__(self):
        self.results: list[ScrapeResult] = []
        self.domain_stats = defaultdict(lambda: {"success": 0, "blocked": 0})
        self.alert_threshold = 0.7  # Alert if success rate drops below 70%
    
    def detect_challenge(self, html: str, headers: dict) -> Optional[str]:
        """Detect which anti-bot vendor challenged us"""
        html_lower = html.lower()
        
        for vendor, patterns in self.CHALLENGE_PATTERNS.items():
            for pattern in patterns:
                if pattern.lower() in html_lower:
                    return vendor
                if any(pattern.lower() in str(v).lower() for v in headers.values()):
                    return vendor
        
        return None
    
    def record_result(self, url: str, status_code: int, 
                     html: str = "", headers: dict = None):
        """Record a scrape result"""
        from urllib.parse import urlparse
        
        domain = urlparse(url).netloc
        headers = headers or {}
        
        # Determine status
        if status_code in self.BLOCK_STATUS_CODES:
            status = "blocked"
            block_type = self.detect_challenge(html, headers)
        elif self.detect_challenge(html, headers):
            status = "challenged"
            block_type = self.detect_challenge(html, headers)
        elif 200 <= status_code < 300:
            status = "success"
            block_type = None
        else:
            status = "error"
            block_type = None
        
        result = ScrapeResult(
            url=url,
            domain=domain,
            status=status,
            status_code=status_code,
            block_type=block_type,
            timestamp=datetime.now()
        )
        
        self.results.append(result)
        self.domain_stats[domain][status] = self.domain_stats[domain].get(status, 0) + 1
        
        # Check for alerts
        self._check_alerts(domain)
        
        return result
    
    def _check_alerts(self, domain: str):
        """Check if we need to alert on this domain"""
        stats = self.domain_stats[domain]
        total = sum(stats.values())
        
        if total < 10:  # Not enough data
            return
        
        success_rate = stats.get("success", 0) / total
        
        if success_rate < self.alert_threshold:
            self._send_alert(domain, success_rate, stats)
    
    def _send_alert(self, domain: str, success_rate: float, stats: dict):
        """Send alert about declining success rate"""
        print(f"""
        === ALERT: Detection Issues on {domain} ===
        Success Rate: {success_rate:.1%}
        Stats: {dict(stats)}
        
        Recommended Actions:
        1. Review Camoufox configuration
        2. Check proxy rotation
        3. Analyze recent blocks for patterns
        4. Consider config review
        """)
    
    def get_domain_report(self, domain: str, 
                          hours: int = 24) -> dict:
        """Get success rate report for a domain"""
        cutoff = datetime.now() - timedelta(hours=hours)
        
        recent = [r for r in self.results 
                  if r.domain == domain and r.timestamp > cutoff]
        
        if not recent:
            return {"domain": domain, "no_data": True}
        
        by_status = defaultdict(int)
        by_block_type = defaultdict(int)
        
        for r in recent:
            by_status[r.status] += 1
            if r.block_type:
                by_block_type[r.block_type] += 1
        
        total = len(recent)
        
        return {
            "domain": domain,
            "period_hours": hours,
            "total_requests": total,
            "success_rate": by_status["success"] / total,
            "block_rate": by_status["blocked"] / total,
            "challenge_rate": by_status["challenged"] / total,
            "by_status": dict(by_status),
            "by_block_type": dict(by_block_type),
            "needs_review": by_status["success"] / total < self.alert_threshold
        }
    
    def when_to_trigger_config_review(self) -> list[str]:
        """Identify domains that need configuration review"""
        domains_needing_review = []
        
        for domain in self.domain_stats:
            report = self.get_domain_report(domain, hours=24)
            
            if report.get("needs_review"):
                domains_needing_review.append(domain)
        
        return domains_needing_review
```

### 6.2 Challenge Page Detection Patterns

```python
# Comprehensive challenge page detection
CHALLENGE_INDICATORS = {
    # Response headers
    "headers": {
        "cloudflare": ["cf-ray", "cf-cache-status", "__cf_bm"],
        "akamai": ["x-akamai-session-info", "_abck"],
        "datadome": ["x-dd-b", "x-dd-type"],
        "perimeterx": ["x-px-cd"],
        "imperva": ["x-cdn", "incap"],
        "kasada": ["x-kpsdk-ct", "x-kpsdk-r"],
    },
    
    # HTML content patterns
    "html": {
        "cloudflare": [
            "<title>Just a moment...</title>",
            "cf-browser-verification",
            "Checking your browser before accessing",
            "DDoS protection by Cloudflare",
        ],
        "akamai": [
            "Access Denied",
            "Reference&#32;&#35;",
            "akamai",
        ],
        "datadome": [
            "geo.captcha-delivery.com",
            "DataDome",
        ],
        "perimeterx": [
            "blocked by px",
            "human challenge",
        ],
        "imperva": [
            "Request unsuccessful. Incapsula incident",
            "Access denied",
        ],
    },
    
    # Status code patterns
    "status_codes": {
        "rate_limited": [429],
        "blocked": [403, 406],
        "cloudflare_error": [520, 521, 522, 523, 524, 525, 526],
        "challenge": [503],
    }
}
```

### 6.3 Success Rate Tracking by Domain

```python
"""
Domain-level success rate tracking with alerting
"""

from prometheus_client import Counter, Gauge, Histogram

# Prometheus metrics
SCRAPE_REQUESTS = Counter(
    'scrape_requests_total',
    'Total scrape requests',
    ['domain', 'status', 'block_type']
)

SUCCESS_RATE = Gauge(
    'scrape_success_rate',
    'Current success rate by domain',
    ['domain']
)

RESPONSE_TIME = Histogram(
    'scrape_response_time_seconds',
    'Response time distribution',
    ['domain', 'status']
)

class MetricsCollector:
    """Collect and expose scraping metrics"""
    
    def record_scrape(self, domain: str, status: str, 
                     block_type: str = "", duration: float = 0):
        """Record a scrape attempt"""
        SCRAPE_REQUESTS.labels(
            domain=domain,
            status=status,
            block_type=block_type or "none"
        ).inc()
        
        RESPONSE_TIME.labels(
            domain=domain,
            status=status
        ).observe(duration)
    
    def update_success_rate(self, domain: str, rate: float):
        """Update the success rate gauge"""
        SUCCESS_RATE.labels(domain=domain).set(rate)
```

### 6.4 When to Trigger Config Review

**Automatic triggers:**

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Success rate drop | < 70% over 1 hour | Alert + review |
| New block type detected | Any new vendor | Investigate |
| Challenge rate spike | > 20% increase | Review config |
| Consistent blocks | Same domain 5x | Domain-specific review |
| Mass failure | > 50% domains affected | Emergency review |

**Review checklist when triggered:**
1. Check if anti-bot vendor updated their detection
2. Verify proxy IP reputation hasn't degraded
3. Test with detection test sites
4. Compare current vs baseline fingerprints
5. Review recent configuration changes
6. Check for Camoufox updates

---

## 7. Verification Checklist

### 7.1 Pre-Production Checklist

```markdown
## Pre-Production Verification Checklist

### Detection Test Sites
- [ ] bot.sannysoft.com: 95%+ pass rate
- [ ] CreepJS trust score: 90%+
- [ ] CreepJS headless detection: 0%
- [ ] bot.incolumitas.com behavioral: > 0.5
- [ ] pixelscan.net: 0 inconsistencies
- [ ] browserleaks.com/webrtc: No IP leaks
- [ ] browserleaks.com/canvas: Consistent hash
- [ ] browserleaks.com/webgl: Realistic GPU

### Anti-Bot Vendor Testing
- [ ] Cloudflare-protected site accessible
- [ ] No Turnstile challenges triggered
- [ ] Akamai-protected site accessible (if targeting)
- [ ] DataDome sites work (if targeting)

### Configuration Verification
- [ ] OS fingerprint matches proxy region
- [ ] Timezone matches IP geolocation
- [ ] Language/locale consistent
- [ ] WebRTC disabled or properly spoofed
- [ ] User-Agent matches OS fingerprint
- [ ] Viewport not default (800x600 or 1280x720)

### Behavioral Verification
- [ ] Mouse movements non-linear
- [ ] Click timing varies naturally
- [ ] Scroll patterns randomized
- [ ] Navigation timing realistic

### Infrastructure
- [ ] Proxy rotation working
- [ ] Residential proxies for sensitive targets
- [ ] Session persistence configured
- [ ] Rate limiting implemented
```

### 7.2 Ongoing Monitoring Checklist

```markdown
## Weekly Monitoring Checklist

### Success Rates
- [ ] Overall success rate > 85%
- [ ] No domain below 70% success rate
- [ ] No new block types detected
- [ ] Challenge rate < 10%

### Regression Tests
- [ ] CI/CD detection tests passing
- [ ] No score regressions vs baseline
- [ ] All target sites accessible

### Configuration
- [ ] Camoufox version current
- [ ] Proxy pool healthy
- [ ] No IP reputation issues

### Documentation
- [ ] Block patterns documented
- [ ] New vendor detections logged
- [ ] Configuration changes tracked
```

### 7.3 Emergency Response Checklist

```markdown
## Emergency Response (Mass Blocking)

### Immediate Actions
1. [ ] Pause all scraping to affected domains
2. [ ] Identify blocking vendor (Cloudflare/Akamai/etc)
3. [ ] Run full detection test suite
4. [ ] Check for Camoufox/stealth library updates

### Diagnosis
5. [ ] Compare current vs baseline fingerprints
6. [ ] Review recent configuration changes
7. [ ] Check proxy IP reputation
8. [ ] Test with fresh browser profile

### Resolution
9. [ ] Apply necessary configuration fixes
10. [ ] Test on detection sites
11. [ ] Gradually resume scraping (10% -> 50% -> 100%)
12. [ ] Monitor success rates closely for 24h

### Post-Incident
13. [ ] Document root cause
14. [ ] Update baseline scores
15. [ ] Add regression test for this case
16. [ ] Update configuration docs
```

---

## Quick Reference: Target Scores

| Test | Minimum | Target | Camoufox Claimed |
|------|---------|--------|------------------|
| Sannysoft pass rate | 90% | 95% | 95%+ |
| CreepJS trust | 80% | 90% | 90%+ |
| CreepJS headless | < 10% | 0% | 0% |
| Incolumitas behavioral | 0.4 | 0.6 | 0.6+ |
| Pixelscan inconsistencies | < 3 | 0 | 0 |
| Production success rate | 70% | 85% | 85%+ |

---

## References

- [Camoufox Documentation](https://camoufox.com/)
- [Camoufox GitHub](https://github.com/daijro/camoufox)
- [CreepJS GitHub](https://github.com/abrahamjuliot/creepjs)
- [Browser Fingerprinting Analysis](https://github.com/niespodd/browser-fingerprinting)
- [Rebrowser Bot Detector](https://github.com/rebrowser/rebrowser-bot-detector)
