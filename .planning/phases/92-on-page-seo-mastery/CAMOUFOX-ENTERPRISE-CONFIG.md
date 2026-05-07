# Camoufox Enterprise Configuration Guide

**Date:** 2026-05-07  
**Purpose:** World-class Camoufox configuration for anti-detection scraping at scale with Geonode residential proxies.

---

## Executive Summary

Camoufox is a Firefox fork that modifies fingerprint data at the **C++ implementation level**, making detection virtually impossible. Unlike Chrome-based stealth solutions that patch JavaScript after page load, Camoufox intercepts properties before they reach the page context.

**Key Advantages:**
- Passes CreepJS, Pixelscan, bot.sannysoft.com with 0% bot score
- ~200 MB RAM per instance (vs 400MB+ for standard Firefox)
- Built-in BrowserForge integration for statistically accurate fingerprints
- Playwright sandbox isolation (no `window.__playwright__` leaks)

**2026 Status Warning:** Camoufox v146.x releases are highly experimental after a year-long maintenance gap. Test thoroughly before production deployment.

---

## 1. Fingerprint Rotation Configuration

### 1.1 Automatic Fingerprint Generation (Recommended)

Camoufox uses BrowserForge to generate fingerprints matching real-world traffic distributions.

```python
from camoufox.async_api import AsyncCamoufox
from browserforge.fingerprints import FingerprintGenerator, Screen

# IMPORTANT: Fingerprints do NOT rotate between sessions
# Must restart browser instance for new fingerprint

async def create_stealth_browser(proxy_config: dict = None):
    """Create a maximally stealthy Camoufox instance."""
    
    # Constrain screen to common resolutions
    screen_constraints = Screen(
        min_width=1280,
        max_width=1920,
        min_height=720,
        max_height=1080
    )
    
    config = {
        # OS fingerprint - match proxy geo when possible
        "os": ["windows", "macos"],  # Exclude linux (less common)
        
        # Screen constraints for realistic fingerprints
        "screen": screen_constraints,
        
        # GeoIP auto-detection (matches timezone/locale to proxy IP)
        "geoip": True,  # Critical for residential proxies
        
        # Humanized cursor movement
        "humanize": 2.5,  # Max 2.5 seconds for cursor travel
        
        # Headless mode (use 'virtual' on Linux for Xvfb)
        "headless": "virtual",  # Safer than True
        
        # Block unnecessary resources
        "block_images": True,  # Speeds up scraping
        "block_webrtc": True,  # Prevents IP leaks
        
        # WebGL - disable unless needed (prevents GPU fingerprint leaks)
        "allow_webgl": False,
    }
    
    if proxy_config:
        config["proxy"] = proxy_config
    
    return AsyncCamoufox(**config)
```

### 1.2 Custom Fingerprint Injection

For maximum control over fingerprint properties:

```python
from browserforge.fingerprints import FingerprintGenerator

# Generate consistent fingerprint for session
fg = FingerprintGenerator(
    browser="firefox",
    os=["windows", "macos"],
    # Exclude rare/suspicious combinations
    device_category=["desktop"],
)

fingerprint = fg.generate()

async with AsyncCamoufox(fingerprint=fingerprint) as browser:
    page = await browser.new_page()
    # Session uses this specific fingerprint
```

### 1.3 Screen Resolution Rotation

```python
from browserforge.fingerprints import Screen

# Common screen resolutions (statistically weighted)
COMMON_SCREENS = [
    Screen(min_width=1920, max_width=1920, min_height=1080, max_height=1080),  # 1080p - 40%
    Screen(min_width=1366, max_width=1366, min_height=768, max_height=768),    # Laptop - 25%
    Screen(min_width=1536, max_width=1536, min_height=864, max_height=864),    # Scaled - 15%
    Screen(min_width=1440, max_width=1440, min_height=900, max_height=900),    # Mac - 10%
    Screen(min_width=2560, max_width=2560, min_height=1440, max_height=1440),  # 1440p - 10%
]

import random
screen = random.choice(COMMON_SCREENS)
```

### 1.4 WebGL/Canvas Configuration

**WARNING:** Do NOT randomly assign WebGL values. WAFs hash fingerprints against known device datasets.

```python
# Disable WebGL entirely (safest for scraping)
async with AsyncCamoufox(allow_webgl=False) as browser:
    ...

# If WebGL required, use validated vendor/renderer pairs
VALID_WEBGL_CONFIGS = [
    # Windows + Intel
    ("Intel Inc.", "Intel(R) UHD Graphics 620"),
    ("Intel Inc.", "Intel(R) UHD Graphics 630"),
    # Windows + NVIDIA
    ("NVIDIA Corporation", "NVIDIA GeForce GTX 1060/PCIe/SSE2"),
    ("NVIDIA Corporation", "NVIDIA GeForce RTX 2060/PCIe/SSE2"),
    # Mac + Apple
    ("Apple Inc.", "Apple M1"),
    ("Apple Inc.", "Apple M2"),
]

vendor, renderer = random.choice(VALID_WEBGL_CONFIGS)

async with AsyncCamoufox(
    allow_webgl=True,
    config={
        "webGl:vendor": vendor,
        "webGl:renderer": renderer,
    }
) as browser:
    ...
```

---

## 2. Behavioral Patterns (Human-Like Behavior)

### 2.1 Built-in Humanized Cursor

Camoufox includes C++ rewritten HumanCursor algorithm:

```python
# Enable humanized cursor (max duration in seconds)
async with AsyncCamoufox(humanize=2.0) as browser:
    page = await browser.new_page()
    
    # All click/hover operations now use natural curves
    await page.click("button#submit")  # Natural mouse movement
```

### 2.2 Custom Behavioral Simulation

Camoufox handles static fingerprints; behavioral patterns are YOUR responsibility:

```python
import asyncio
import random

class HumanBehavior:
    """Simulate human-like browsing patterns."""
    
    @staticmethod
    async def random_delay(min_s: float = 0.5, max_s: float = 3.0):
        """Gaussian-distributed delays (not uniform!)"""
        mean = (min_s + max_s) / 2
        std = (max_s - min_s) / 4
        delay = max(min_s, min(max_s, random.gauss(mean, std)))
        await asyncio.sleep(delay)
    
    @staticmethod
    async def scroll_naturally(page, target_pct: float = 0.8):
        """Scroll with variable speed and pauses."""
        viewport_height = await page.evaluate("window.innerHeight")
        page_height = await page.evaluate("document.body.scrollHeight")
        target_scroll = page_height * target_pct
        
        current = 0
        while current < target_scroll:
            # Variable scroll distance (100-400px)
            scroll_dist = random.randint(100, 400)
            current += scroll_dist
            
            await page.evaluate(f"window.scrollBy(0, {scroll_dist})")
            
            # Random pause while "reading"
            if random.random() < 0.3:  # 30% chance to pause
                await asyncio.sleep(random.uniform(0.5, 2.0))
            else:
                await asyncio.sleep(random.uniform(0.05, 0.15))
    
    @staticmethod
    async def move_mouse_randomly(page):
        """Random mouse movements to simulate idle behavior."""
        viewport = await page.evaluate("""
            () => ({width: window.innerWidth, height: window.innerHeight})
        """)
        
        # Move to 2-4 random positions
        for _ in range(random.randint(2, 4)):
            x = random.randint(100, viewport['width'] - 100)
            y = random.randint(100, viewport['height'] - 100)
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.1, 0.3))


async def scrape_with_behavior(page, url: str):
    """Scrape with human-like behavior patterns."""
    await page.goto(url)
    
    # Wait for content + simulate "page load reaction time"
    await HumanBehavior.random_delay(1.0, 3.0)
    
    # Random mouse movement (shows "engagement")
    await HumanBehavior.move_mouse_randomly(page)
    
    # Scroll before extraction (simulates reading)
    await HumanBehavior.scroll_naturally(page, target_pct=0.6)
    
    # Small delay before extraction
    await HumanBehavior.random_delay(0.5, 1.5)
    
    # Extract content
    return await page.content()
```

### 2.3 Timing Randomization Guidelines

| Action | Suspicious Pattern | Recommended Pattern |
|--------|-------------------|---------------------|
| Page load delay | Fixed 1s | Gaussian 2-8s |
| Inter-request | Fixed intervals | 2-10s random |
| Scroll speed | Instant/uniform | Variable 100-400px/scroll |
| Form submission | <500ms | 5-15s (simulate typing) |
| Click accuracy | Exact center | Offset +/-5px random |

---

## 3. Browser Pool Management

### 3.1 Capacity Planning (8 vCPU / 24GB RAM)

| Configuration | Instances | Pages/Hour | Notes |
|--------------|-----------|------------|-------|
| Conservative | 8-10 | 2,400-3,000 | Stable, low risk |
| Standard | 15-20 | 4,500-6,000 | Recommended |
| Aggressive | 25-30 | 7,500-9,000 | Monitor closely |

**Memory Formula:**
```
Max Instances = (Available RAM - 4GB OS reserve) / 250MB per instance
               = (24GB - 4GB) / 250MB
               = 80 instances (theoretical max)
               
Practical Max = 80 * 0.4 = ~32 instances (40% utilization target)
```

### 3.2 Instance Lifecycle Management

```python
import asyncio
from typing import Dict, Optional
from datetime import datetime, timedelta
from camoufox.async_api import AsyncCamoufox

class CamoufoxPool:
    """Manages browser instance pool with fingerprint rotation."""
    
    def __init__(
        self,
        pool_size: int = 10,
        max_requests_per_instance: int = 100,
        max_instance_age_minutes: int = 30,
        proxy_config: Optional[dict] = None,
    ):
        self.pool_size = pool_size
        self.max_requests = max_requests_per_instance
        self.max_age = timedelta(minutes=max_instance_age_minutes)
        self.proxy_config = proxy_config
        
        self.instances: Dict[int, dict] = {}
        self.semaphore = asyncio.Semaphore(pool_size)
        self._lock = asyncio.Lock()
    
    async def _create_instance(self, instance_id: int) -> dict:
        """Create fresh browser instance with new fingerprint."""
        config = {
            "os": ["windows", "macos"],
            "geoip": True,
            "humanize": 2.0,
            "headless": "virtual",
            "block_images": True,
            "block_webrtc": True,
            "allow_webgl": False,
        }
        
        if self.proxy_config:
            config["proxy"] = self.proxy_config
        
        browser = await AsyncCamoufox(**config).__aenter__()
        
        return {
            "browser": browser,
            "created_at": datetime.now(),
            "request_count": 0,
            "instance_id": instance_id,
        }
    
    def _should_recycle(self, instance: dict) -> bool:
        """Check if instance needs recycling for fresh fingerprint."""
        # Recycle after max requests
        if instance["request_count"] >= self.max_requests:
            return True
        
        # Recycle after max age
        if datetime.now() - instance["created_at"] > self.max_age:
            return True
        
        return False
    
    async def acquire(self) -> dict:
        """Get a browser instance from pool."""
        await self.semaphore.acquire()
        
        async with self._lock:
            # Find available instance
            for instance_id, instance in self.instances.items():
                if self._should_recycle(instance):
                    # Recycle: close old, create new
                    await instance["browser"].__aexit__(None, None, None)
                    self.instances[instance_id] = await self._create_instance(instance_id)
                    return self.instances[instance_id]
            
            # Create new instance if pool not full
            if len(self.instances) < self.pool_size:
                instance_id = len(self.instances)
                self.instances[instance_id] = await self._create_instance(instance_id)
                return self.instances[instance_id]
            
            # Return least-used instance
            return min(self.instances.values(), key=lambda x: x["request_count"])
    
    async def release(self, instance: dict):
        """Return instance to pool."""
        instance["request_count"] += 1
        self.semaphore.release()
    
    async def shutdown(self):
        """Close all browser instances."""
        for instance in self.instances.values():
            try:
                await instance["browser"].__aexit__(None, None, None)
            except Exception:
                pass
        self.instances.clear()


# Usage
async def main():
    pool = CamoufoxPool(
        pool_size=10,
        max_requests_per_instance=100,  # Fresh fingerprint every 100 requests
        max_instance_age_minutes=30,     # Or every 30 minutes
        proxy_config={
            "server": "http://rotating.geonode.com:9000",
            "username": "your_username",
            "password": "your_password",
        }
    )
    
    try:
        instance = await pool.acquire()
        page = await instance["browser"].new_page()
        await page.goto("https://example.com")
        content = await page.content()
        await pool.release(instance)
    finally:
        await pool.shutdown()
```

### 3.3 Memory Leak Mitigation

Known issue: Node processes may not terminate correctly, causing memory bloat.

```python
import psutil
import os

class MemoryGuard:
    """Monitor and prevent memory leaks."""
    
    def __init__(self, threshold_gb: float = 20.0):
        self.threshold_bytes = threshold_gb * 1024 * 1024 * 1024
    
    def get_memory_usage(self) -> float:
        """Get current process memory in GB."""
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / (1024 * 1024 * 1024)
    
    def should_force_gc(self) -> bool:
        """Check if memory pressure requires garbage collection."""
        return psutil.virtual_memory().available < self.threshold_bytes * 0.2
    
    def kill_orphan_processes(self):
        """Kill orphaned playwright/node processes."""
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['name'] in ['node', 'firefox', 'playwright']:
                    # Check if process is orphaned (no parent in our tree)
                    if proc.parent() is None or proc.parent().pid == 1:
                        proc.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
```

---

## 4. Geonode Residential Proxy Integration

### 4.1 Authentication Configuration

```python
# Method 1: Username/Password (Recommended)
GEONODE_PROXY = {
    "server": "http://rotating.geonode.com:9000",
    "username": os.environ["GEONODE_USERNAME"],
    "password": os.environ["GEONODE_PASSWORD"],
}

# Method 2: IP Whitelist (for static IPs)
# Whitelist your server IP in Geonode dashboard
GEONODE_PROXY_WHITELISTED = {
    "server": "http://rotating.geonode.com:9000",
    # No auth needed if IP whitelisted
}
```

### 4.2 Session Stickiness for Multi-Page Crawls

```python
import hashlib

def get_sticky_session_proxy(domain: str, duration_minutes: int = 10) -> dict:
    """Get sticky session proxy for consistent IP across pages."""
    
    # Generate deterministic session ID from domain
    session_id = hashlib.md5(domain.encode()).hexdigest()[:16]
    
    return {
        "server": f"http://rotating.geonode.com:9001",  # Sticky port
        "username": f"{os.environ['GEONODE_USERNAME']}-session-{session_id}-duration-{duration_minutes}",
        "password": os.environ["GEONODE_PASSWORD"],
    }


# For multi-page crawl of single domain
async def crawl_domain_with_sticky_ip(domain: str, urls: list[str]):
    """Crawl multiple pages from same domain with consistent IP."""
    
    proxy = get_sticky_session_proxy(domain, duration_minutes=30)
    
    async with AsyncCamoufox(
        proxy=proxy,
        geoip=True,  # Auto-match timezone/locale to proxy IP
    ) as browser:
        for url in urls:
            page = await browser.new_page()
            await page.goto(url)
            # Extract content
            await page.close()
            
            # Rate limit within session
            await asyncio.sleep(random.uniform(2, 5))
```

### 4.3 Geo-Targeting Configuration

```python
def get_geo_targeted_proxy(country: str = "US", city: str = None) -> dict:
    """Get geo-targeted residential proxy."""
    
    username = os.environ["GEONODE_USERNAME"]
    
    # Add geo-targeting to username
    if city:
        username = f"{username}-country-{country.lower()}-city-{city.lower()}"
    else:
        username = f"{username}-country-{country.lower()}"
    
    return {
        "server": "http://rotating.geonode.com:9000",
        "username": username,
        "password": os.environ["GEONODE_PASSWORD"],
    }


# Example: US-based proxy
us_proxy = get_geo_targeted_proxy(country="US")

# Example: UK London proxy
uk_proxy = get_geo_targeted_proxy(country="GB", city="london")
```

### 4.4 Bandwidth Optimization

```python
async def bandwidth_optimized_scrape(page, url: str) -> str:
    """Minimize bandwidth usage with selective loading."""
    
    # Block unnecessary resources
    await page.route("**/*", lambda route: (
        route.abort() if route.request.resource_type in [
            "image", "media", "font", "stylesheet"
        ] else route.continue_()
    ))
    
    await page.goto(url, wait_until="domcontentloaded")  # Don't wait for images
    
    return await page.content()
```

---

## 5. Detection Evasion Checklist

### 5.1 Testing Sites

| Test Site | What It Checks | Target Score |
|-----------|---------------|--------------|
| [bot.sannysoft.com](https://bot.sannysoft.com) | WebDriver, CDP leaks | All green |
| [pixelscan.net](https://pixelscan.net) | Fingerprint consistency | "Consistent" |
| [browserleaks.com](https://browserleaks.com) | WebGL, Canvas, WebRTC | No anomalies |
| [CreepJS](https://abrahamjuliot.github.io/creepjs/) | Deep JS inspection | 70%+ trust score |
| [Fingerprint.com](https://fingerprint.com) | Commercial detection | "Not detected" |

### 5.2 Automated Testing Script

```python
async def run_detection_tests(browser_config: dict) -> dict:
    """Run browser through detection tests."""
    
    results = {}
    
    async with AsyncCamoufox(**browser_config) as browser:
        page = await browser.new_page()
        
        # Test 1: bot.sannysoft.com
        await page.goto("https://bot.sannysoft.com")
        await asyncio.sleep(3)
        results["sannysoft"] = await page.evaluate("""
            () => {
                const rows = document.querySelectorAll('table tr');
                return Array.from(rows).map(r => ({
                    test: r.cells[0]?.textContent,
                    result: r.cells[1]?.textContent
                })).filter(r => r.test);
            }
        """)
        
        # Test 2: CreepJS
        await page.goto("https://abrahamjuliot.github.io/creepjs/")
        await asyncio.sleep(5)  # CreepJS needs time
        results["creepjs"] = await page.evaluate("""
            () => document.querySelector('.trust-score')?.textContent || 'N/A'
        """)
        
        # Test 3: Pixelscan
        await page.goto("https://pixelscan.net")
        await asyncio.sleep(3)
        results["pixelscan"] = await page.evaluate("""
            () => document.querySelector('.result-status')?.textContent || 'N/A'
        """)
    
    return results
```

### 5.3 What Each Test Catches

| Detection Vector | Camoufox Handling | Manual Action Needed |
|-----------------|-------------------|---------------------|
| `navigator.webdriver` | Patched in C++ | None |
| CDP artifacts | Sandboxed | None |
| Canvas fingerprint | Random offsets | None |
| WebGL fingerprint | Disabled/spoofed | Validate vendor/renderer |
| WebRTC IP leak | Blocked | Verify `block_webrtc=True` |
| Timezone mismatch | `geoip=True` | Verify proxy geo |
| Locale mismatch | `geoip=True` | Verify proxy geo |
| Automation timing | **NOT handled** | Implement behavioral patterns |
| Mouse patterns | `humanize=True` | Verify enabled |

---

## 6. Critical Configuration Settings

### 6.1 Non-Obvious Dangerous Defaults

```python
# DANGEROUS: Default settings that can leak
DANGEROUS_DEFAULTS = {
    "headless": True,           # Can leak via missing window dimensions
    "allow_webgl": True,        # GPU fingerprint inconsistencies
    "block_webrtc": False,      # WebRTC can leak real IP
    "geoip": False,             # Timezone/locale won't match proxy
}

# SAFE: Recommended production defaults
SAFE_PRODUCTION_CONFIG = {
    "headless": "virtual",      # Use Xvfb on Linux
    "allow_webgl": False,       # Disable unless absolutely needed
    "block_webrtc": True,       # Always block
    "block_images": True,       # Faster + less bandwidth
    "geoip": True,              # Auto-match locale to proxy IP
    "humanize": 2.0,            # Enable cursor simulation
    "os": ["windows", "macos"], # Exclude linux (uncommon)
}
```

### 6.2 Headers That Expose Automation

Camoufox automatically handles these, but verify:

```python
# Camoufox auto-spoofs these to match fingerprint:
# - User-Agent (matches navigator.userAgent)
# - Accept-Language (matches navigator.language)
# - Sec-CH-UA headers (matches browser version)

# You should NOT manually set these unless you know what you're doing
# Mismatches between headers and JS properties are instant detection
```

### 6.3 Firefox Preferences Override

```python
# Custom Firefox preferences for extra stealth
async with AsyncCamoufox(
    firefox_user_prefs={
        # Disable telemetry
        "toolkit.telemetry.enabled": False,
        "datareporting.healthreport.uploadEnabled": False,
        
        # Disable features that can fingerprint
        "dom.battery.enabled": False,
        "media.navigator.enabled": False,
        "dom.gamepad.enabled": False,
        
        # Stricter privacy
        "privacy.trackingprotection.enabled": True,
        "privacy.donottrackheader.enabled": True,
        
        # Performance
        "network.http.pipelining": True,
        "network.http.proxy.pipelining": True,
    }
) as browser:
    ...
```

### 6.4 Addon Configuration

```python
from camoufox import DefaultAddons

# Default: uBlock Origin with privacy filters (recommended)
async with AsyncCamoufox() as browser:
    ...

# Exclude uBlock if it interferes with target site
async with AsyncCamoufox(
    exclude_addons=[DefaultAddons.UBO]
) as browser:
    ...

# Add custom addons (must be extracted, not .xpi)
async with AsyncCamoufox(
    addons=["/path/to/extracted/addon"]
) as browser:
    ...
```

---

## 7. Production-Ready Configuration

### 7.1 Complete Stealth Configuration

```python
import os
import asyncio
import random
from typing import Optional
from camoufox.async_api import AsyncCamoufox
from browserforge.fingerprints import Screen

class ProductionCamoufox:
    """Production-ready Camoufox configuration for Geonode + DataForSEO fallback."""
    
    SCREEN_CONSTRAINTS = Screen(
        min_width=1280, max_width=1920,
        min_height=720, max_height=1080
    )
    
    @classmethod
    def get_geonode_proxy(
        cls,
        sticky_session: Optional[str] = None,
        duration_minutes: int = 10,
        country: str = "US",
    ) -> dict:
        """Configure Geonode residential proxy."""
        
        username = os.environ["GEONODE_USERNAME"]
        password = os.environ["GEONODE_PASSWORD"]
        
        # Add options to username
        username_parts = [username]
        
        if sticky_session:
            username_parts.append(f"session-{sticky_session}")
            username_parts.append(f"lifetime-{duration_minutes}")
        
        username_parts.append(f"country-{country.lower()}")
        
        return {
            "server": "http://rotating.geonode.com:9000",
            "username": "-".join(username_parts),
            "password": password,
        }
    
    @classmethod
    async def create_browser(
        cls,
        proxy: Optional[dict] = None,
        block_images: bool = True,
    ) -> AsyncCamoufox:
        """Create maximally stealthy browser instance."""
        
        config = {
            # Fingerprint
            "os": ["windows", "macos"],
            "screen": cls.SCREEN_CONSTRAINTS,
            
            # GeoIP matching
            "geoip": True,
            
            # Behavior
            "humanize": 2.5,
            
            # Headless (virtual display on Linux)
            "headless": "virtual",
            
            # Resource blocking
            "block_images": block_images,
            "block_webrtc": True,
            "allow_webgl": False,
            
            # Firefox preferences
            "firefox_user_prefs": {
                "dom.battery.enabled": False,
                "media.navigator.enabled": False,
                "dom.gamepad.enabled": False,
                "privacy.trackingprotection.enabled": True,
            }
        }
        
        if proxy:
            config["proxy"] = proxy
        
        return AsyncCamoufox(**config)
    
    @classmethod
    async def scrape_with_behavior(
        cls,
        url: str,
        proxy: Optional[dict] = None,
        scroll_depth: float = 0.6,
    ) -> str:
        """Scrape URL with full human-like behavior."""
        
        async with await cls.create_browser(proxy=proxy) as browser:
            page = await browser.new_page()
            
            # Navigate
            await page.goto(url, wait_until="domcontentloaded")
            
            # Initial delay (page load reaction time)
            await asyncio.sleep(random.gauss(2.0, 0.5))
            
            # Mouse movement
            viewport = await page.evaluate(
                "() => ({w: window.innerWidth, h: window.innerHeight})"
            )
            for _ in range(random.randint(2, 4)):
                x = random.randint(100, viewport['w'] - 100)
                y = random.randint(100, viewport['h'] - 100)
                await page.mouse.move(x, y)
                await asyncio.sleep(random.uniform(0.1, 0.3))
            
            # Scroll naturally
            page_height = await page.evaluate("document.body.scrollHeight")
            target_scroll = int(page_height * scroll_depth)
            current_scroll = 0
            
            while current_scroll < target_scroll:
                scroll_amt = random.randint(150, 350)
                await page.evaluate(f"window.scrollBy(0, {scroll_amt})")
                current_scroll += scroll_amt
                
                if random.random() < 0.25:
                    await asyncio.sleep(random.uniform(0.5, 1.5))
                else:
                    await asyncio.sleep(random.uniform(0.05, 0.15))
            
            # Final delay before extraction
            await asyncio.sleep(random.uniform(0.5, 1.0))
            
            return await page.content()


# Usage example
async def main():
    # Get Geonode proxy
    proxy = ProductionCamoufox.get_geonode_proxy(
        sticky_session="example_com_crawl",
        duration_minutes=30,
        country="US"
    )
    
    # Scrape with full stealth
    html = await ProductionCamoufox.scrape_with_behavior(
        url="https://example.com",
        proxy=proxy,
        scroll_depth=0.7
    )
    
    print(f"Scraped {len(html)} bytes")


if __name__ == "__main__":
    asyncio.run(main())
```

### 7.2 Integration with Tiered Architecture

```python
from enum import IntEnum

class FetchTier(IntEnum):
    DIRECT = 0
    WEBSHARE_DC = 1
    GEONODE_RESIDENTIAL = 2
    CAMOUFOX_GEONODE = 3  # New tier: Browser + Residential
    DATAFORSEO = 4

async def tiered_fetch_with_camoufox(url: str, domain_tier_cache: dict) -> tuple[str, FetchTier]:
    """Fetch with tiered escalation including Camoufox."""
    
    domain = extract_domain(url)
    starting_tier = domain_tier_cache.get(domain, FetchTier.DIRECT)
    
    # Try each tier
    for tier in range(starting_tier, FetchTier.DATAFORSEO + 1):
        try:
            if tier == FetchTier.DIRECT:
                html = await direct_fetch(url)
            
            elif tier == FetchTier.WEBSHARE_DC:
                html = await fetch_with_webshare(url)
            
            elif tier == FetchTier.GEONODE_RESIDENTIAL:
                html = await fetch_with_geonode(url)
            
            elif tier == FetchTier.CAMOUFOX_GEONODE:
                # Browser rendering with residential proxy
                proxy = ProductionCamoufox.get_geonode_proxy(
                    sticky_session=domain,
                    country="US"
                )
                html = await ProductionCamoufox.scrape_with_behavior(url, proxy=proxy)
            
            elif tier == FetchTier.DATAFORSEO:
                html = await fetch_with_dataforseo(url)
            
            # Check if response is valid
            if is_valid_response(html):
                domain_tier_cache[domain] = tier
                return html, tier
        
        except Exception as e:
            continue
    
    raise Exception(f"All tiers failed for {url}")
```

### 7.3 Environment Variables

```env
# Geonode Residential
GEONODE_USERNAME=your_geonode_username
GEONODE_PASSWORD=your_geonode_password

# Camoufox Pool Settings
CAMOUFOX_POOL_SIZE=10
CAMOUFOX_MAX_REQUESTS_PER_INSTANCE=100
CAMOUFOX_MAX_INSTANCE_AGE_MINUTES=30

# Behavioral Settings
CAMOUFOX_HUMANIZE_MAX_SECONDS=2.5
CAMOUFOX_SCROLL_DEPTH=0.6
CAMOUFOX_MIN_DELAY_SECONDS=2.0
CAMOUFOX_MAX_DELAY_SECONDS=8.0

# Resource Limits
CAMOUFOX_MEMORY_LIMIT_GB=20
CAMOUFOX_BLOCK_IMAGES=true
CAMOUFOX_BLOCK_WEBRTC=true
CAMOUFOX_ALLOW_WEBGL=false
```

---

## 8. Monitoring and Alerting

### 8.1 Key Metrics to Track

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass
class CamoufoxMetrics:
    """Metrics for Camoufox pool monitoring."""
    
    # Success rates
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    
    # Detection events
    captcha_encounters: int = 0
    bot_detection_encounters: int = 0
    
    # Resource usage
    avg_memory_per_instance_mb: float = 0.0
    total_memory_usage_gb: float = 0.0
    active_instances: int = 0
    
    # Timing
    avg_response_time_ms: float = 0.0
    
    # Costs (estimated)
    bandwidth_used_gb: float = 0.0
    estimated_proxy_cost: float = 0.0
    
    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.successful_requests / self.total_requests * 100
    
    @property
    def detection_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return (self.captcha_encounters + self.bot_detection_encounters) / self.total_requests * 100
```

### 8.2 Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Success Rate | <90% | <80% | Review fingerprint config |
| Detection Rate | >5% | >10% | Increase behavioral delays |
| Memory Usage | >16GB | >20GB | Force instance recycling |
| Avg Response Time | >10s | >20s | Check proxy latency |

---

## Sources

- [Camoufox GitHub Repository](https://github.com/daijro/camoufox)
- [Camoufox Official Documentation](https://camoufox.com/)
- [Camoufox Python Usage](https://camoufox.com/python/usage/)
- [Camoufox Stealth Overview](https://camoufox.com/stealth/)
- [Camoufox Fingerprint Cursor Movement](https://camoufox.com/fingerprint/cursor-movement/)
- [Camoufox WebGL Configuration](https://camoufox.com/fingerprint/webgl/)
- [Camoufox WebRTC Configuration](https://camoufox.com/fingerprint/webrtc/)
- [Camoufox HTTP Headers](https://camoufox.com/fingerprint/headers/)
- [Camoufox Addons](https://camoufox.com/fingerprint/addons/)
- [BrightData Camoufox Guide 2026](https://brightdata.com/blog/web-data/web-scraping-with-camoufox)
- [ScrapingBee Camoufox Tutorial](https://www.scrapingbee.com/blog/how-to-scrape-with-camoufox-to-bypass-antibot-technology/)
- [Decodo Camoufox Developer Guide](https://decodo.com/blog/web-scraping-guide-with-camoufox)
- [Geonode Session Types](https://docs.geonode.com/docs/guides/proxy-service-guide/session-type)
- [Geonode Proxy Authentication](https://docs.geonode.com/docs/guides/proxy-service-guide/proxy-authentication)
- [Geonode Proxy Configuration](https://docs.geonode.com/docs/guides/advance-configuration/proxy-configuration)
- [Geonode Sticky Proxies Guide](https://geonode.com/blog/what-are-sticky-proxies)
- [Camoufox Connector PyPI](https://pypi.org/project/camoufox-connector/1.0.1/)
- [Crawlee Playwright Camoufox Integration](https://crawlee.dev/python/docs/examples/playwright-crawler-with-camoufox)
- [DataDome Camoufox Detection Analysis](https://datadome.co/anti-detect-tools/camoufox/)
- [Octo Browser Anti-Bot Systems](https://blog.octobrowser.net/anti-bot-systems)
- [Octo Browser Bot Detection Traps](https://blog.octobrowser.net/how-to-spot-bot-detection-traps-and-avoid-them)
- [BrowserStack Playwright Bot Detection](https://www.browserstack.com/guide/playwright-bot-detection)
