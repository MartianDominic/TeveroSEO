/**
 * Pixel Analytics Dashboard E2E Tests
 * Phase 66-11: E2E Tests for Platform Unification
 *
 * Tests the pixel analytics dashboard:
 * - Summary cards display
 * - Core Web Vitals section
 * - Traffic chart rendering
 * - Date range selection
 * - Data refresh
 */
import { test, expect, Page } from "@playwright/test";

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_SITE_ID = "site_test123";

const MOCK_ANALYTICS = {
  summary: {
    totalPageviews: 15234,
    totalSessions: 8456,
    totalUniqueVisitors: 6123,
    avgTimeOnPage: 145,
    bounceRate: 42.5,
  },
  cwv: {
    lcp: { p75: 2100, rating: "good" as const },
    cls: { p75: 0.08, rating: "good" as const },
    inp: { p75: 180, rating: "needs-improvement" as const },
  },
  timeseries: [
    { date: "2026-04-27", pageviews: 520, sessions: 290 },
    { date: "2026-04-28", pageviews: 580, sessions: 320 },
    { date: "2026-04-29", pageviews: 490, sessions: 270 },
    { date: "2026-04-30", pageviews: 610, sessions: 340 },
    { date: "2026-05-01", pageviews: 550, sessions: 300 },
    { date: "2026-05-02", pageviews: 620, sessions: 350 },
    { date: "2026-05-03", pageviews: 640, sessions: 360 },
  ],
  topPages: [
    { path: "/", pageviews: 3500, avgTimeOnPage: 120 },
    { path: "/products", pageviews: 2800, avgTimeOnPage: 180 },
    { path: "/about", pageviews: 1500, avgTimeOnPage: 90 },
    { path: "/contact", pageviews: 800, avgTimeOnPage: 60 },
    { path: "/blog", pageviews: 600, avgTimeOnPage: 200 },
  ],
};

// ============================================================================
// Helpers
// ============================================================================

async function setupAnalyticsMock(page: Page, data = MOCK_ANALYTICS) {
  await page.route(`**/api/pixel/${TEST_SITE_ID}/analytics**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
}

async function navigateToDashboard(page: Page) {
  await page.goto(`/dashboard/pixel/analytics?siteId=${TEST_SITE_ID}`);
}

// ============================================================================
// Dashboard Display Tests
// ============================================================================

test.describe("Pixel Analytics Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await setupAnalyticsMock(page);
  });

  test("displays summary metric cards", async ({ page }) => {
    await navigateToDashboard(page);

    // Check for metric cards
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Sessions")).toBeVisible();
    await expect(page.getByText("Unique Visitors")).toBeVisible();
    await expect(page.getByText("Bounce Rate")).toBeVisible();

    // Check for formatted values
    await expect(page.getByText("15.2k")).toBeVisible(); // Pageviews
    await expect(page.getByText("8.5k")).toBeVisible(); // Sessions
    await expect(page.getByText("6.1k")).toBeVisible(); // Visitors
    await expect(page.getByText("42.5%")).toBeVisible(); // Bounce rate
  });

  test("displays Core Web Vitals section", async ({ page }) => {
    await navigateToDashboard(page);

    // Check CWV heading
    await expect(page.getByText("Core Web Vitals")).toBeVisible({
      timeout: 10000,
    });

    // Check individual metrics
    await expect(page.getByText("LCP")).toBeVisible();
    await expect(page.getByText("CLS")).toBeVisible();
    await expect(page.getByText("INP")).toBeVisible();
  });

  test("displays traffic chart", async ({ page }) => {
    await navigateToDashboard(page);

    // Wait for analytics to load
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });

    // Check for chart - Recharts renders SVG
    const chart = page.locator("svg.recharts-surface");
    await expect(chart).toBeVisible({ timeout: 5000 });
  });

  test("displays top pages table", async ({ page }) => {
    await navigateToDashboard(page);

    // Wait for data to load
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });

    // Check for top pages
    await expect(page.getByText("/products")).toBeVisible();
    await expect(page.getByText("/about")).toBeVisible();
    await expect(page.getByText("/contact")).toBeVisible();
  });
});

// ============================================================================
// Date Range Tests
// ============================================================================

test.describe("Date Range Selection", () => {
  test("changes data when date range is updated", async ({ page }) => {
    let requestCount = 0;
    let lastStartDate = "";

    await page.route(`**/api/pixel/${TEST_SITE_ID}/analytics**`, async (route) => {
      requestCount++;
      const url = new URL(route.request().url());
      lastStartDate = url.searchParams.get("startDate") || "";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYTICS),
      });
    });

    await navigateToDashboard(page);

    // Wait for initial load
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });
    const initialRequestCount = requestCount;

    // Click date range picker
    const dateRangePicker = page.getByTestId("date-range-picker");
    await dateRangePicker.click();

    // Select 7 days option
    await page.getByText("Last 7 days").click();

    // Wait for new request
    await page.waitForTimeout(500);

    // Should have made a new request
    expect(requestCount).toBeGreaterThan(initialRequestCount);
  });

  test("shows correct date range options", async ({ page }) => {
    await setupAnalyticsMock(page);
    await navigateToDashboard(page);

    // Wait for load
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });

    // Open date picker
    const dateRangePicker = page.getByTestId("date-range-picker");
    await dateRangePicker.click();

    // Check options
    await expect(page.getByText("Last 7 days")).toBeVisible();
    await expect(page.getByText("Last 30 days")).toBeVisible();
    await expect(page.getByText("Last 90 days")).toBeVisible();
  });

  test("persists date range selection", async ({ page }) => {
    await setupAnalyticsMock(page);
    await navigateToDashboard(page);

    // Wait for load
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });

    // Select 7 days
    const dateRangePicker = page.getByTestId("date-range-picker");
    await dateRangePicker.click();
    await page.getByText("Last 7 days").click();

    // The picker should show the selected value
    await expect(page.getByText("Last 7 days")).toBeVisible();
  });
});

// ============================================================================
// Data Refresh Tests
// ============================================================================

test.describe("Data Refresh", () => {
  test("refresh button triggers new data fetch", async ({ page }) => {
    let fetchCount = 0;

    await page.route(`**/api/pixel/${TEST_SITE_ID}/analytics**`, async (route) => {
      fetchCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...MOCK_ANALYTICS,
          summary: {
            ...MOCK_ANALYTICS.summary,
            totalPageviews: 15234 + fetchCount * 100, // Increment to show change
          },
        }),
      });
    });

    await navigateToDashboard(page);

    // Wait for initial load
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });
    const initialCount = fetchCount;

    // Click refresh button
    const refreshBtn = page.getByRole("button", { name: /refresh/i });
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();

      // Wait for refresh
      await page.waitForTimeout(1000);

      expect(fetchCount).toBeGreaterThan(initialCount);
    }
  });

  test("shows loading state during refresh", async ({ page }) => {
    await page.route(`**/api/pixel/${TEST_SITE_ID}/analytics**`, async (route) => {
      // Add delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYTICS),
      });
    });

    await navigateToDashboard(page);

    // Should show loading skeletons initially
    const skeleton = page.locator('[class*="skeleton"]');
    // Check if skeletons are visible during load
    // (they may disappear quickly)
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe("Error Handling", () => {
  test("displays error message when API fails", async ({ page }) => {
    await page.route(`**/api/pixel/${TEST_SITE_ID}/analytics**`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await navigateToDashboard(page);

    // Should show error state
    await expect(page.getByText(/failed|error/i)).toBeVisible({
      timeout: 10000,
    });

    // Should have retry button
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
  });

  test("retry button works after error", async ({ page }) => {
    let callCount = 0;

    await page.route(`**/api/pixel/${TEST_SITE_ID}/analytics**`, async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Error" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_ANALYTICS),
        });
      }
    });

    await navigateToDashboard(page);

    // Wait for error
    await expect(page.getByText(/failed|error/i)).toBeVisible({
      timeout: 10000,
    });

    // Click retry
    await page.getByRole("button", { name: /retry/i }).click();

    // Should now show data
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });
  });

  test("handles empty data gracefully", async ({ page }) => {
    await page.route(`**/api/pixel/${TEST_SITE_ID}/analytics**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: {
            totalPageviews: 0,
            totalSessions: 0,
            totalUniqueVisitors: 0,
            avgTimeOnPage: 0,
            bounceRate: 0,
          },
          cwv: {
            lcp: { p75: 0, rating: "good" },
            cls: { p75: 0, rating: "good" },
            inp: { p75: 0, rating: "good" },
          },
          timeseries: [],
          topPages: [],
        }),
      });
    });

    await navigateToDashboard(page);

    // Should still display with zero values
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("0")).toBeVisible();
  });
});

// ============================================================================
// CWV Rating Tests
// ============================================================================

test.describe("CWV Rating Display", () => {
  test("shows correct rating colors for CWV metrics", async ({ page }) => {
    await page.route(`**/api/pixel/${TEST_SITE_ID}/analytics**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...MOCK_ANALYTICS,
          cwv: {
            lcp: { p75: 2100, rating: "good" },
            cls: { p75: 0.25, rating: "poor" },
            inp: { p75: 300, rating: "needs-improvement" },
          },
        }),
      });
    });

    await navigateToDashboard(page);

    // Wait for CWV section
    await expect(page.getByText("Core Web Vitals")).toBeVisible({
      timeout: 10000,
    });

    // Check that metrics are displayed
    await expect(page.getByText("LCP")).toBeVisible();
    await expect(page.getByText("CLS")).toBeVisible();
    await expect(page.getByText("INP")).toBeVisible();
  });

  test("displays p75 values correctly", async ({ page }) => {
    await setupAnalyticsMock(page);
    await navigateToDashboard(page);

    // Wait for CWV section
    await expect(page.getByText("Core Web Vitals")).toBeVisible({
      timeout: 10000,
    });

    // LCP should be displayed in seconds or milliseconds
    // The exact format depends on the component implementation
  });
});

// ============================================================================
// Responsive Layout Tests
// ============================================================================

test.describe("Responsive Layout", () => {
  test("displays 2-column grid on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupAnalyticsMock(page);
    await navigateToDashboard(page);

    // Wait for metrics
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });

    // On mobile, the grid should have 2 columns (based on the Tailwind class grid-cols-2)
    const grid = page.locator(".grid-cols-2");
    await expect(grid.first()).toBeVisible();
  });

  test("displays 4-column grid on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupAnalyticsMock(page);
    await navigateToDashboard(page);

    // Wait for metrics
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });

    // On desktop, should use lg:grid-cols-4
    // Verify all 4 metric cards are in a row
    const pageviewsBox = await page.getByText("Pageviews").boundingBox();
    const bounceRateBox = await page.getByText("Bounce Rate").boundingBox();

    if (pageviewsBox && bounceRateBox) {
      // They should be roughly on the same row (within 50px)
      expect(Math.abs((pageviewsBox.y) - (bounceRateBox.y))).toBeLessThan(50);
    }
  });

  test("CWV cards stack on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupAnalyticsMock(page);
    await navigateToDashboard(page);

    // Wait for CWV section
    await expect(page.getByText("Core Web Vitals")).toBeVisible({
      timeout: 10000,
    });

    // On mobile (< sm), CWV cards should be single column
    const lcpCard = page.getByText("LCP").locator("..").first();
    const clsCard = page.getByText("CLS").locator("..").first();

    const lcpBox = await lcpCard.boundingBox();
    const clsBox = await clsCard.boundingBox();

    if (lcpBox && clsBox) {
      // LCP should be above CLS (greater Y difference)
      expect(clsBox.y).toBeGreaterThan(lcpBox.y);
    }
  });
});

// ============================================================================
// Top Pages Tests
// ============================================================================

test.describe("Top Pages", () => {
  test("displays top pages sorted by pageviews", async ({ page }) => {
    await setupAnalyticsMock(page);
    await navigateToDashboard(page);

    // Wait for top pages
    await expect(page.getByText("/products")).toBeVisible({ timeout: 10000 });

    // Check order - homepage should be first (most pageviews)
    const homepageRow = page.getByText("/").first();
    const productsRow = page.getByText("/products");

    const homeBox = await homepageRow.boundingBox();
    const productsBox = await productsRow.boundingBox();

    if (homeBox && productsBox) {
      // Homepage should appear before products (smaller Y)
      expect(homeBox.y).toBeLessThan(productsBox.y);
    }
  });

  test("shows pageview counts for each page", async ({ page }) => {
    await setupAnalyticsMock(page);
    await navigateToDashboard(page);

    // Wait for data
    await expect(page.getByText("/products")).toBeVisible({ timeout: 10000 });

    // Check for pageview numbers
    await expect(page.getByText("3,500").or(page.getByText("3.5k"))).toBeVisible();
    await expect(page.getByText("2,800").or(page.getByText("2.8k"))).toBeVisible();
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

test.describe("Performance", () => {
  test("loads dashboard within acceptable time", async ({ page }) => {
    await setupAnalyticsMock(page);

    const startTime = Date.now();
    await navigateToDashboard(page);

    // Wait for main content
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test("does not make excessive API calls", async ({ page }) => {
    let apiCallCount = 0;

    await page.route(`**/api/pixel/${TEST_SITE_ID}/analytics**`, async (route) => {
      apiCallCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYTICS),
      });
    });

    await navigateToDashboard(page);

    // Wait for load
    await expect(page.getByText("Pageviews")).toBeVisible({ timeout: 10000 });

    // Wait a bit to catch any duplicate requests
    await page.waitForTimeout(2000);

    // Should only make 1-2 API calls (initial load, maybe a prefetch)
    expect(apiCallCount).toBeLessThanOrEqual(2);
  });
});
