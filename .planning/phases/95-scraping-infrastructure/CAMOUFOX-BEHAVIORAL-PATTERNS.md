# Camoufox Behavioral Automation Patterns

> World-class behavioral evasion patterns for anti-detection scraping.
> Camoufox handles static fingerprints at C++ level - behavioral analysis is OUR responsibility.

## Research Summary

This document provides specific, actionable values based on research from:
- Ghost-cursor Bezier curve implementation
- Human-computer interaction research (136M keystroke study)
- Bot detection systems analysis (Google SearchGuard, DataDome)
- Web scraping industry best practices

---

## 1. Mouse Movement Patterns

### Camoufox `humanize` Parameter

```python
# humanize parameter: Optional[Union[bool, float]]
# Value: MAX duration in seconds for cursor movement
# Default cursor movement: ~1.5 seconds across full window

# RECOMMENDED: 2.0 seconds max movement time
with Camoufox(humanize=2.0) as browser:
    page = browser.new_page()
```

**Key insight**: The `humanize` parameter is NOT a 1-5 scale. It's the maximum duration in seconds for cursor movements. Typical values: 1.5-3.0 seconds.

### Bezier Curve Implementation

Camoufox uses cubic Bezier curves (rewritten from HumanCursor in C++):

```typescript
// Based on ghost-cursor math.ts implementation
interface Vector {
  x: number;
  y: number;
}

// Bezier anchor generation - control points on ONE side of the line
// to avoid wonky S-curves
function generateBezierAnchors(
  start: Vector,
  end: Vector,
  spread: number
): [Vector, Vector] {
  const MIN_SPREAD = 2;
  const MAX_SPREAD = 200;
  
  // Spread is clamped to distance between points
  const distance = Math.sqrt(
    Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
  );
  const actualSpread = Math.min(MAX_SPREAD, Math.max(MIN_SPREAD, spread ?? distance));
  
  // Pick ONE side (above or below the line) for both control points
  const side = Math.random() > 0.5 ? 1 : -1;
  
  // Generate two random points perpendicular to the line
  const anchor1 = randomPointOnPerpendicular(start, end, actualSpread, side);
  const anchor2 = randomPointOnPerpendicular(start, end, actualSpread, side);
  
  return [anchor1, anchor2].sort((a, b) => a.x - b.x) as [Vector, Vector];
}
```

### Movement Speed Distribution

**Fitts's Law calculation** (from ghost-cursor):

```typescript
// Steps calculated using Fitts's Law
// Distance + target size determines movement time
function calculateSteps(
  distance: number,
  targetWidth: number,
  moveSpeed?: number
): number {
  const fittsTime = Math.log2(distance / targetWidth + 1);
  const baseTime = 2; // minimum steps multiplier
  
  // Speed factor: lower moveSpeed = more steps = slower movement
  const speedFactor = moveSpeed ? 25 / moveSpeed : Math.random() * 25;
  
  return Math.ceil((Math.log2(fittsTime + 1) + baseTime) * 3 * speedFactor);
}

// RECOMMENDED VALUES:
// - Short distance (<100px): 15-25 steps over 200-400ms
// - Medium distance (100-500px): 40-80 steps over 400-800ms  
// - Long distance (>500px): 80-150 steps over 800-1500ms
```

### Overshoot Mechanics

```typescript
// Overshoot triggers for movements > 500px
const OVERSHOOT_THRESHOLD = 500; // pixels

function overshoot(target: Vector, radius: number): Vector {
  // Random point within radius of target
  const angle = Math.random() * 2 * Math.PI;
  const rad = radius * Math.sqrt(Math.random()); // sqrt for uniform distribution
  
  return {
    x: target.x + rad * Math.cos(angle),
    y: target.y + rad * Math.sin(angle)
  };
}

// RECOMMENDED: Overshoot radius 10-30px for distant targets
```

### MUST Move Before Click

```typescript
// ALWAYS move to element before clicking
// Direct clicks without mouse movement = instant detection

async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.locator(selector);
  const box = await element.boundingBox();
  
  if (!box) throw new Error('Element not visible');
  
  // Random point within element (not center!)
  const paddingPct = 0.2; // 20% padding from edges
  const targetX = box.x + box.width * (paddingPct + Math.random() * (1 - 2 * paddingPct));
  const targetY = box.y + box.height * (paddingPct + Math.random() * (1 - 2 * paddingPct));
  
  // Move THEN click
  await moveMouse(page, { x: targetX, y: targetY });
  await randomDelay(50, 150); // Hesitation before click
  await page.mouse.down();
  await randomDelay(50, 120); // Hold duration
  await page.mouse.up();
}
```

---

## 2. Scrolling Behavior

### Scroll Increment Values

```typescript
// Human scrolling is NEVER uniform
// Google SearchGuard detects "scroll delta variance < 5px" as bot

interface ScrollConfig {
  // Single scroll increment
  minIncrement: 80;   // pixels
  maxIncrement: 180;  // pixels
  
  // Reading pause (content sections)
  sectionPause: {
    min: 1200,  // ms
    max: 3500   // ms
  };
  
  // Quick scan (not reading)
  scanPause: {
    min: 300,   // ms
    max: 800    // ms
  };
}

// RECOMMENDED scroll increment: 100-150px average with 30% variance
function getScrollIncrement(): number {
  const base = 120;
  const variance = 0.3;
  return Math.round(base * (1 + (Math.random() - 0.5) * 2 * variance));
}
```

### Variable Speed Scrolling Pattern

```typescript
async function humanScroll(
  page: Page,
  targetY: number,
  options: { reading?: boolean } = {}
): Promise<void> {
  const currentY = await page.evaluate(() => window.scrollY);
  const distance = targetY - currentY;
  const direction = distance > 0 ? 1 : -1;
  
  let scrolled = 0;
  const totalDistance = Math.abs(distance);
  
  while (scrolled < totalDistance) {
    // Variable increment (80-180px)
    const increment = 80 + Math.random() * 100;
    const actualIncrement = Math.min(increment, totalDistance - scrolled);
    
    // Acceleration curve: faster in middle, slower at start/end
    const progress = scrolled / totalDistance;
    const speedMultiplier = 1 - Math.pow(2 * progress - 1, 2); // Parabolic
    const delay = options.reading 
      ? 150 + (1 - speedMultiplier) * 200  // Slower when reading
      : 50 + (1 - speedMultiplier) * 100;   // Faster scan
    
    await page.evaluate((y) => window.scrollBy(0, y), actualIncrement * direction);
    scrolled += actualIncrement;
    
    // Random micro-pauses (10% chance)
    if (Math.random() < 0.1) {
      await randomDelay(200, 600);
    } else {
      await randomDelay(delay * 0.8, delay * 1.2);
    }
  }
}
```

### Momentum Scrolling Simulation

```typescript
// Simulates trackpad/touchscreen momentum
async function momentumScroll(page: Page, initialVelocity: number): Promise<void> {
  const friction = 0.92; // Deceleration factor
  let velocity = initialVelocity; // pixels per frame
  
  while (Math.abs(velocity) > 2) {
    await page.evaluate((y) => window.scrollBy(0, y), velocity);
    velocity *= friction;
    await randomDelay(14, 18); // ~60fps
  }
}

// Usage: momentumScroll(page, 25) for gentle flick
// Usage: momentumScroll(page, 60) for aggressive flick
```

### Reading Pause Durations

```typescript
// Based on 250 WPM average reading speed
// Average viewport shows ~200-400 words

const READING_PAUSES = {
  // Short content (< 100 words): 1.5-3 seconds
  short: { min: 1500, max: 3000 },
  
  // Medium content (100-300 words): 3-8 seconds
  medium: { min: 3000, max: 8000 },
  
  // Long content (> 300 words): 8-15 seconds
  long: { min: 8000, max: 15000 },
  
  // Skimming (not actually reading): 0.5-1.5 seconds
  skim: { min: 500, max: 1500 }
};

function getReadingPause(wordCount: number): number {
  // 250 WPM = 4.17 words per second
  // Add 20-50% variance for human behavior
  const baseTime = (wordCount / 4.17) * 1000;
  const variance = 0.35;
  return baseTime * (1 + (Math.random() - 0.5) * 2 * variance);
}
```

---

## 3. Timing Patterns

### Inter-Request Delay Distribution

```typescript
// Google SearchGuard uses Welford's algorithm to detect
// near-zero variance in timing = bot

// USE: Log-normal distribution (NOT Gaussian for inter-request)
// Log-normal naturally has a long right tail like human behavior

function logNormalDelay(
  medianMs: number,  // Median delay
  sigma: number = 0.5 // Shape parameter (higher = more variance)
): number {
  // Box-Muller transform for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  
  // Transform to log-normal
  const mu = Math.log(medianMs);
  return Math.exp(mu + sigma * z);
}

// RECOMMENDED VALUES:
// - Page navigation: median 3500ms, sigma 0.6 (range: ~1s to 15s)
// - API requests: median 800ms, sigma 0.4 (range: ~300ms to 3s)
// - Resource loads: median 200ms, sigma 0.3 (range: ~100ms to 500ms)

const REQUEST_DELAYS = {
  navigation: { median: 3500, sigma: 0.6 },
  apiCall: { median: 800, sigma: 0.4 },
  resourceLoad: { median: 200, sigma: 0.3 }
};
```

### Page Dwell Time Before Extraction

```typescript
// MINIMUM dwell time before any extraction
// Bot detection checks for "load then immediately extract"

const DWELL_TIMES = {
  // Minimum before ANY action
  absolute_minimum: 2000, // 2 seconds
  
  // Typical page load + orient
  initial_dwell: {
    min: 3000,  // 3 seconds
    max: 6000   // 6 seconds
  },
  
  // Before form submission (typing + review)
  form_minimum: 8000, // 8 seconds
  
  // Before data extraction
  extraction_dwell: {
    min: 5000,  // 5 seconds minimum
    max: 12000  // 12 seconds
  }
};

async function pageLoadSequence(page: Page): Promise<void> {
  // 1. Wait for load
  await page.waitForLoadState('domcontentloaded');
  
  // 2. Initial dwell (user orienting)
  await randomDelay(3000, 6000);
  
  // 3. Small mouse movement (user is "looking")
  await smallRandomMouseMove(page);
  
  // 4. Scroll to show interest
  await humanScroll(page, 300, { reading: false });
  
  // 5. Reading pause
  await randomDelay(2000, 5000);
  
  // NOW safe to extract
}
```

### Typing Simulation Speed

```typescript
// Average human: 40-50 WPM (research: 51.56 WPM average)
// 50 WPM = 250 characters/minute = 4.17 chars/second
// = 240ms per character average

const TYPING_CONFIG = {
  // Characters per minute (40-60 WPM range)
  cpm: {
    slow: 180,    // ~36 WPM (hunt and peck)
    average: 250, // ~50 WPM (typical user)
    fast: 350     // ~70 WPM (proficient typist)
  },
  
  // Inter-key interval (milliseconds)
  iki: {
    min: 80,   // Fastest reasonable
    max: 400,  // Slow/thinking
    avg: 240   // 50 WPM equivalent
  },
  
  // Pause patterns
  wordPause: { min: 100, max: 300 },    // Between words
  thinkPause: { min: 500, max: 2000 },  // Occasional thinking
  errorRate: 0.02  // 2% typo rate
};

async function humanType(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  await page.click(selector);
  await randomDelay(200, 500); // Focus delay
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Occasional typo (2% chance)
    if (Math.random() < 0.02) {
      const typo = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
      await page.keyboard.type(typo);
      await randomDelay(100, 300);
      await page.keyboard.press('Backspace');
      await randomDelay(80, 150);
    }
    
    await page.keyboard.type(char);
    
    // Inter-key interval with variance
    let delay = 150 + Math.random() * 150; // 150-300ms base
    
    // Longer pause after space (word boundary)
    if (char === ' ') {
      delay += 50 + Math.random() * 100;
    }
    
    // Occasional think pause (5% chance)
    if (Math.random() < 0.05) {
      delay += 500 + Math.random() * 1000;
    }
    
    await randomDelay(delay * 0.8, delay * 1.2);
  }
}
```

### Think Time After Page Load

```typescript
// Time before first interaction after page loads

async function thinkTimeAfterLoad(page: Page): Promise<void> {
  // Humans need time to:
  // 1. Visual processing: 200-500ms
  // 2. Cognitive processing: 500-1500ms
  // 3. Motor planning: 200-500ms
  
  const visualProcess = 200 + Math.random() * 300;
  const cognitiveProcess = 500 + Math.random() * 1000;
  const motorPlan = 200 + Math.random() * 300;
  
  const totalThinkTime = visualProcess + cognitiveProcess + motorPlan;
  
  // Add variance (some pages need more thought)
  const variance = totalThinkTime * (0.3 + Math.random() * 0.4);
  
  await randomDelay(totalThinkTime, totalThinkTime + variance);
}

// RECOMMENDED: 1000-2500ms before first interaction
```

---

## 4. Navigation Patterns

### Link Click vs Direct Navigation

```typescript
// ALWAYS prefer link clicks over direct navigation when possible
// Direct URL entry has NO referer - suspicious for internal pages

interface NavigationStrategy {
  // Internal pages: ALWAYS click links
  internal: 'click';
  
  // External entry points: direct navigation OK
  entryPoint: 'direct';
  
  // Search results: must have search engine referer
  searchResult: 'direct_with_referer';
}

async function navigateHumanLike(
  page: Page,
  targetUrl: string,
  options: { fromSearch?: boolean; internal?: boolean } = {}
): Promise<void> {
  if (options.internal) {
    // Find and click link to target
    const link = page.locator(`a[href*="${new URL(targetUrl).pathname}"]`).first();
    if (await link.isVisible()) {
      await humanClick(page, `a[href*="${new URL(targetUrl).pathname}"]`);
      return;
    }
  }
  
  if (options.fromSearch) {
    // Set appropriate referer
    await page.setExtraHTTPHeaders({
      'Referer': 'https://www.google.com/'
    });
  }
  
  await page.goto(targetUrl);
}
```

### Referer Header Consistency

```typescript
// Headers must form consistent profile
// Detection systems check for header order consistency

const HEADER_PROFILES = {
  chrome_desktop: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin', // or 'cross-site' for external
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1'
  }
};

// Referer rules:
// - Internal navigation: previous page URL
// - External entry: search engine or empty
// - NEVER: inconsistent referer (e.g., page B as referer when visiting page A)
```

### Back Button Usage Patterns

```typescript
// 15-25% of navigations use back button (research)
// Random back button usage looks human

async function maybeGoBack(page: Page, probability: number = 0.18): Promise<boolean> {
  if (Math.random() < probability) {
    await randomDelay(500, 1500); // Think before going back
    await page.goBack();
    await randomDelay(1000, 3000); // Orient on previous page
    return true;
  }
  return false;
}

// Usage pattern for multi-page scraping:
// Visit page -> extract -> 18% chance go back -> continue
```

### Tab/Window Behavior

```typescript
// Humans open links in new tabs frequently
// Single-tab behavior can be suspicious for heavy browsing

interface TabBehavior {
  // Probability of opening link in new tab
  newTabProbability: 0.25;  // 25%
  
  // Max concurrent tabs before closing old ones
  maxTabs: 5;
  
  // Time before switching back to original tab
  tabSwitchDelay: {
    min: 3000,   // 3 seconds
    max: 30000   // 30 seconds
  };
}

async function openInNewTabMaybe(
  page: Page,
  selector: string,
  probability: number = 0.25
): Promise<Page> {
  if (Math.random() < probability) {
    // Ctrl+Click to open in new tab
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.click(selector, { modifiers: ['Control'] })
    ]);
    return newPage;
  }
  
  await humanClick(page, selector);
  return page;
}
```

---

## 5. Interaction Before Extraction

### Pre-Extraction Scroll Requirement

```typescript
// ALWAYS scroll before extracting content below the fold
// Lazy-loaded content won't exist otherwise
// Also signals human-like behavior

async function prepareForExtraction(page: Page): Promise<void> {
  // 1. Get page height
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  
  // 2. Calculate scroll positions (every ~1.5 viewport heights)
  const scrollPositions: number[] = [];
  for (let pos = 0; pos < pageHeight; pos += viewportHeight * 1.5) {
    scrollPositions.push(pos);
  }
  
  // 3. Scroll through page with reading behavior
  for (const pos of scrollPositions) {
    await humanScroll(page, pos, { reading: true });
    
    // Pause to "read" (based on visible content)
    const wordsVisible = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.split(/\s+/).length / 3; // Rough estimate of viewport
    });
    
    await randomDelay(
      Math.min(getReadingPause(wordsVisible / 3), 5000),
      Math.min(getReadingPause(wordsVisible / 3) * 1.5, 8000)
    );
  }
  
  // 4. Scroll back to top (or target section)
  await humanScroll(page, 0, { reading: false });
  await randomDelay(500, 1500);
}
```

### Random Mouse Movement While Waiting

```typescript
// Keep mouse "alive" during long operations
// Stationary mouse for >10 seconds is suspicious

async function idleMouseMovement(
  page: Page,
  durationMs: number
): Promise<void> {
  const startTime = Date.now();
  const viewport = await page.viewportSize();
  
  if (!viewport) return;
  
  while (Date.now() - startTime < durationMs) {
    // Small, subtle movement (not erratic)
    const currentPos = await page.evaluate(() => ({
      x: (window as any).__mouseX || window.innerWidth / 2,
      y: (window as any).__mouseY || window.innerHeight / 2
    }));
    
    // Move 20-100px in random direction
    const distance = 20 + Math.random() * 80;
    const angle = Math.random() * 2 * Math.PI;
    
    const newX = Math.max(50, Math.min(viewport.width - 50, 
      currentPos.x + distance * Math.cos(angle)));
    const newY = Math.max(50, Math.min(viewport.height - 50,
      currentPos.y + distance * Math.sin(angle)));
    
    await page.mouse.move(newX, newY, { steps: 10 + Math.floor(Math.random() * 20) });
    
    // Wait 2-8 seconds before next movement
    await randomDelay(2000, 8000);
  }
}
```

### Reading Behavior Simulation

```typescript
// Full reading simulation before extraction

async function simulateReading(page: Page): Promise<void> {
  const viewport = await page.viewportSize();
  if (!viewport) return;
  
  // 1. Eye-tracking simulation (mouse follows reading pattern)
  // Humans scan in F-pattern or Z-pattern
  const scanPattern = [
    { x: 0.1, y: 0.15 },  // Top-left
    { x: 0.8, y: 0.15 },  // Top-right
    { x: 0.1, y: 0.35 },  // Mid-left
    { x: 0.5, y: 0.35 },  // Mid-center
    { x: 0.1, y: 0.55 },  // Lower-left
    { x: 0.6, y: 0.55 },  // Lower-center
  ];
  
  for (const point of scanPattern) {
    const targetX = viewport.width * point.x;
    const targetY = viewport.height * point.y;
    
    await page.mouse.move(targetX, targetY, { 
      steps: 15 + Math.floor(Math.random() * 15) 
    });
    
    // Pause at each "fixation point"
    await randomDelay(200, 800);
  }
  
  // 2. Occasional text selection (humans do this)
  if (Math.random() < 0.15) { // 15% chance
    const textElement = page.locator('p, h1, h2, h3').first();
    if (await textElement.isVisible()) {
      const box = await textElement.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 10, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 100, box.y + box.height / 2, { steps: 20 });
        await page.mouse.up();
        await randomDelay(300, 800);
        // Click to deselect
        await page.mouse.click(box.x + 150, box.y + box.height / 2);
      }
    }
  }
}
```

---

## Complete Integration Example

```typescript
import { Camoufox } from 'camoufox';

interface ScrapingSession {
  maxPagesPerSession: number;
  sessionDurationMinutes: number;
}

async function humanLikeScrape(
  urls: string[],
  config: ScrapingSession = { maxPagesPerSession: 15, sessionDurationMinutes: 20 }
): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  // Camoufox with humanization enabled
  const browser = await Camoufox({ humanize: 2.0 });
  const page = await browser.newPage();
  
  for (let i = 0; i < urls.length && i < config.maxPagesPerSession; i++) {
    const url = urls[i];
    
    // 1. Navigate (with inter-request delay)
    if (i > 0) {
      await logNormalDelay(3500, 0.6); // Median 3.5s between pages
    }
    
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // 2. Think time after load
    await thinkTimeAfterLoad(page);
    
    // 3. Prepare for extraction (scroll through page)
    await prepareForExtraction(page);
    
    // 4. Simulate reading
    await simulateReading(page);
    
    // 5. Extract data
    const data = await extractPageData(page);
    results.set(url, data);
    
    // 6. Maybe go back (18% chance)
    await maybeGoBack(page, 0.18);
    
    // 7. Idle mouse movement during processing
    await idleMouseMovement(page, 1500);
  }
  
  await browser.close();
  return results;
}

// Utility function
function randomDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  return new Promise(resolve => setTimeout(resolve, delay));
}
```

---

## Detection Thresholds to Avoid

| Metric | Bot Threshold | Human Range | Our Target |
|--------|--------------|-------------|------------|
| Events per second | >200 | 10-50 | 15-35 |
| Scroll delta variance | <5px | 20-100px | 30-80px |
| Inter-request variance | Near-zero | High | Log-normal distribution |
| Page dwell time | <2s | 5-300s | 5-30s |
| Mouse stationary | >30s | Random movement | <10s stationary |
| Click-to-element precision | Exact center | Random within bounds | 20% padding from edges |
| Typing speed variance | None | High | 30% variance |

---

## Sources

- [Camoufox Documentation - Cursor Movement](https://camoufox.com/fingerprint/cursor-movement/)
- [Camoufox Python Usage](https://camoufox.com/python/usage/)
- [Ghost-cursor GitHub](https://github.com/Xetera/ghost-cursor)
- [Ghost-cursor math.ts (Bezier implementation)](https://github.com/Xetera/ghost-cursor/blob/master/src/math.ts)
- [136 Million Keystrokes Study](https://userinterfaces.aalto.fi/136Mkeystrokes/)
- [Google SearchGuard Analysis](https://searchengineland.com/inside-google-searchguard-467676)
- [Human-Like Browsing Patterns - ScrapingAnt](https://scrapingant.com/blog/human-like-browsing-patterns)
- [Referer Header for Bot Detection](https://medium.com/@agrawal.adarsh3004/understanding-the-referer-header-the-silent-signal-that-outsmarts-bots-80253e3df680)
- [Reading Speed Statistics](https://wordsrated.com/reading-speed-statistics/)
- [Keystroke Dynamics for Bot Detection](https://link.springer.com/chapter/10.1007/978-3-031-65175-5_30)
