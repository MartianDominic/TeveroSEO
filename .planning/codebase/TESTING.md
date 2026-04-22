# Testing Patterns

**Analysis Date:** 2026-04-22

## Test Framework

**Runner:**
- Vitest (latest, v3.2.4 in open-seo-main, v4.1.4 in apps/web)
- Config: `vitest.config.ts` in each app

**Assertion Library:**
- Vitest built-in assertions (`expect`)
- `@testing-library/jest-dom` matchers for DOM assertions

**Run Commands:**
```bash
# open-seo-main
pnpm test              # Run all server tests
pnpm test:client       # Run client tests (vitest.client.config.ts)
pnpm test:watch        # Watch mode
pnpm test:ci           # CI mode with dot reporter

# apps/web
pnpm test              # Run all tests
```

## Test Configuration

**open-seo-main server tests** (`vitest.config.ts`):
```typescript
export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/client/**/*.test.ts", "src/client/**/*.test.tsx"],
    restoreMocks: true,
    clearMocks: true,
  },
});
```

**open-seo-main client tests** (`vitest.client.config.ts`):
```typescript
export default defineConfig({
  plugins: [tsConfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["src/client/**/*.test.ts", "src/client/**/*.test.tsx"],
    restoreMocks: true,
    clearMocks: true,
    globals: true,
  },
});
```

**apps/web tests** (`vitest.config.ts`):
```typescript
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tevero/types": path.resolve(__dirname, "../../packages/types/src"),
      "@tevero/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
});
```

## Test File Organization

**Location:**
- Co-located with source files (same directory)
- Pattern: `{filename}.test.ts` or `{filename}.test.tsx`

**Naming:**
- `component.test.tsx` for React components
- `module.test.ts` for utilities, hooks, services
- No separate `__tests__` directories

**Structure:**
```
src/
├── server/
│   ├── lib/
│   │   ├── errors.ts
│   │   └── errors.test.ts
│   ├── queues/
│   │   ├── rankingQueue.ts
│   │   └── rankingQueue.test.ts
├── client/
│   ├── hooks/
│   │   ├── useScrollSection.ts
│   │   └── useScrollSection.test.ts
│   ├── components/
│   │   └── proposals/
│   │       ├── AnimatedCounter.tsx
│   │       └── AnimatedCounter.test.tsx
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("ModuleName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("functionName", () => {
    it("should do expected behavior", () => {
      // Arrange
      // Act
      // Assert
    });

    it("handles edge case", () => { ... });
  });

  describe("another function", () => { ... });
});
```

**Patterns:**
- Nested `describe` blocks for grouping related tests
- `beforeEach` for mock clearing and setup
- `afterEach` for cleanup and mock restoration
- Descriptive test names starting with "should" or action verbs

## Mocking

**Framework:** Vitest `vi` module

**Module mocking pattern:**
```typescript
// Mock modules before imports
vi.mock("@/server/lib/redis", () => ({
  getSharedBullMQConnection: vi.fn().mockReturnValue({}),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));
```

**Hoisted mocks (for mocks used in module scope):**
```typescript
const { checkMock, trackMock, getOrCreateMock } = vi.hoisted(() => ({
  checkMock: vi.fn(),
  trackMock: vi.fn<(arg: TrackCallArg) => void>(),
  getOrCreateMock: vi.fn(),
}));

vi.mock("@/server/billing/autumn", () => ({
  autumn: {
    check: checkMock,
    track: trackMock,
  },
}));
```

**Dynamic imports after mocking:**
```typescript
// Import modules AFTER mocks are set up
import { db } from "@/db";
import { fetchLiveSerpItemsRaw } from "@/server/lib/dataforseo";
```

**What to Mock:**
- External services (DataForSEO, billing APIs)
- Database connections
- Redis/BullMQ queues
- Logger instances
- Browser APIs (IntersectionObserver, scrollIntoView)
- framer-motion for animation components

**What NOT to Mock:**
- The module under test
- Pure utility functions
- Zod schemas (test validation directly)

## Component Testing

**React Testing Library patterns:**
```typescript
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

describe("AnimatedCounter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render without crashing", () => {
    render(<AnimatedCounter value={1000} />);
    expect(document.body.querySelector("span")).toBeTruthy();
  });

  it("should apply custom className", () => {
    render(<AnimatedCounter value={100} className="custom-class" />);
    const span = document.body.querySelector("span.custom-class");
    expect(span).toBeTruthy();
  });
});
```

**Hook testing:**
```typescript
import { renderHook, act } from "@testing-library/react";

describe("useRoiCalculator", () => {
  it("should update conversion rate", async () => {
    const { useRoiCalculator } = await import("./useRoiCalculator");
    const { result } = renderHook(() => useRoiCalculator(defaultInitialData));

    act(() => {
      result.current.setConversionRate(3.5);
    });

    expect(result.current.conversionRate).toBe(3.5);
  });
});
```

## IntersectionObserver Mocking

**Pattern for scroll/visibility testing:**
```typescript
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
let observerCallback: IntersectionObserverCallback | null = null;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: readonly number[] = [];

  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }

  observe = mockObserve;
  unobserve = vi.fn();
  disconnect = mockDisconnect;
  takeRecords = (): IntersectionObserverEntry[] => [];
}

beforeEach(() => {
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
});
```

## API Route Testing

**TanStack Start route handler testing:**
```typescript
describe("GET /api/admin/dlq", () => {
  it("returns 401 when X-Internal-Api-Key header is missing", async () => {
    const { Route } = await import("@/routes/api/admin/dlq");
    const handlers = (Route.options.server as any)?.handlers;

    const request = new Request("http://localhost/api/admin/dlq", {
      method: "GET",
    });

    const response: Response = await handlers.GET({ request });
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Unauthorized");
  });
});
```

## Async Testing

**Pattern:**
```typescript
it("checks both monthly and topup balances in parallel", async () => {
  setupBillingMocks();
  mockBalances(5000, 3000);
  mockDataforseoResult(0.05);

  const client = createDataforseoClient(billingCustomer);
  await client.backlinks.summary(backlinksInput);

  expect(checkMock).toHaveBeenCalledTimes(2);
});
```

**Error testing:**
```typescript
it("throws PAYMENT_REQUIRED when combined balance is below minimum", async () => {
  setupBillingMocks();
  mockBalances(50, 50);

  const client = createDataforseoClient(billingCustomer);
  await expect(
    client.backlinks.summary(backlinksInput),
  ).rejects.toMatchObject({ code: "PAYMENT_REQUIRED" });

  expect(trackMock).not.toHaveBeenCalled();
});
```

## Timer Testing

**Fake timers for animations:**
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("should animate to target value when in view", async () => {
  render(<AnimatedCounter value={100} duration={100} />);

  act(() => {
    vi.advanceTimersByTime(150);
  });

  expect(screen.getByText("100")).toBeTruthy();
});
```

## Test Data Factories

**Helper functions for test data:**
```typescript
function setupBillingMocks() {
  getOrCreateMock.mockResolvedValue({ id: "org_123" });
}

function mockBalances(monthly: number, topup: number) {
  checkMock.mockImplementation(async (args: { featureId: string }) => {
    if (args.featureId === AUTUMN_SEO_DATA_BALANCE_FEATURE_ID) {
      return { allowed: true, balance: { remaining: monthly } };
    }
    return { allowed: false, balance: null };
  });
}

function mockDataforseoResult(costUsd: number) {
  vi.mocked(fetchBacklinksSummaryRaw).mockResolvedValue({
    data: { rank: 42 },
    billing: { costUsd, path: ["backlinks", "summary"], resultCount: 1 },
  });
}
```

**IntersectionObserver entry factory:**
```typescript
function createIntersectionEntry(
  target: Element,
  isIntersecting: boolean,
  ratio: number = 0,
): IntersectionObserverEntry {
  return {
    target,
    isIntersecting,
    intersectionRatio: ratio,
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRect: {} as DOMRectReadOnly,
    rootBounds: null,
    time: Date.now(),
  };
}
```

## Coverage

**Requirements:** Not enforced in CI configuration, but 80% target per project guidelines

**View Coverage:**
```bash
pnpm test -- --coverage
```

## Test Types

**Unit Tests:**
- Isolated function testing
- Schema validation tests
- Hook behavior tests
- Component rendering tests
- Located alongside source files

**Integration Tests:**
- API route handler tests
- Database query tests (with mocked db)
- Queue/worker tests
- Service layer tests with mocked dependencies

**E2E Tests:**
- Framework: Playwright (per project guidelines)
- Not extensively set up in current codebase
- Critical user flows should have E2E coverage

## TDD Markers

**Tests written first include header comment:**
```typescript
/**
 * Tests for useScrollSection hook.
 * Phase 30: Interactive Proposal Page
 *
 * TDD: Tests written FIRST before implementation.
 * Tests intersection observer behavior for scroll-triggered animations.
 */
```

## Common Patterns

**Type validation tests:**
```typescript
describe("KeywordGap", () => {
  it("should accept valid keyword gap object", () => {
    const validGap: KeywordGap = {
      keyword: "seo tools",
      competitorPosition: 3,
      searchVolume: 5000,
    };

    expect(validGap.keyword).toBe("seo tools");
    expect(validGap.competitorPosition).toBeGreaterThan(0);
  });
});
```

**Zod schema tests:**
```typescript
describe("search param boolean parsing", () => {
  it("parses backlinks search params with target and tab", () => {
    const parsed = backlinksSearchSchema.parse({
      target: "example.com",
      tab: "domains",
    });

    expect(parsed).toEqual({
      target: "example.com",
      tab: "domains",
    });
  });
});
```

**Error message mapping tests:**
```typescript
describe("getStandardErrorMessage", () => {
  it("maps known error codes to standard copy", () => {
    expect(getStandardErrorMessage(new Error("PAYMENT_REQUIRED"))).toBe(
      "An active hosted subscription is required before you can use OpenSEO.",
    );
  });

  it("returns custom messages when the error is not a shared code", () => {
    expect(
      getStandardErrorMessage(new Error("Custom error message")),
    ).toBe("Custom error message");
  });
});
```

## Setup Files

**apps/web vitest.setup.ts:**
```typescript
/// <reference types="@testing-library/jest-dom" />
import "@testing-library/jest-dom/vitest";
```

---

*Testing analysis: 2026-04-22*
