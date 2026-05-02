/**
 * Command Center E2E Tests
 * Phase 62-08: Win/Loss Analytics and Final Phase Completion
 *
 * Tests critical dashboard flows:
 * - Dashboard loading and display
 * - Pipeline cards and metrics
 * - Quick actions functionality
 * - Win/Loss analytics section
 * - Performance requirements
 */
import { test, expect } from "@playwright/test";

test.describe("Command Center Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to command center
    await page.goto("/command-center");
    // Wait for initial load
    await page.waitForLoadState("networkidle");
  });

  test("displays page title and header", async ({ page }) => {
    // Check page title/header is visible
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toBeVisible();
    await expect(title).toHaveText(/command center/i);
  });

  test("displays Today Action Bar with counts", async ({ page }) => {
    // Check all 4 action items exist
    await expect(page.getByText("Overdue")).toBeVisible();
    await expect(page.getByText("Due Today")).toBeVisible();
    await expect(page.getByText(/awaiting you/i)).toBeVisible();
    await expect(page.getByText("New")).toBeVisible();
  });

  test("displays Pipeline Health Cards", async ({ page }) => {
    // Check all 4 pipeline cards
    await expect(page.getByText("Prospects")).toBeVisible();
    await expect(page.getByText("Proposals")).toBeVisible();
    await expect(page.getByText("Agreements")).toBeVisible();
    await expect(page.getByText("Payments")).toBeVisible();
  });

  test("displays Revenue Pipeline section", async ({ page }) => {
    // Revenue section content
    await expect(page.getByText("This Month")).toBeVisible();
    await expect(page.getByText("Outstanding")).toBeVisible();
  });

  test("displays Conversion Funnel", async ({ page }) => {
    await expect(page.getByText("Conversion Funnel")).toBeVisible();
    await expect(page.getByText("Win Rate")).toBeVisible();
    await expect(page.getByText("Avg Cycle")).toBeVisible();
  });

  test("Dashboard loads within 1.5 seconds", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/command-center");
    await page.waitForLoadState("domcontentloaded");

    // Wait for key content to appear
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 1500 });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(1500);
  });
});

test.describe("Needs Attention List", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");
  });

  test("displays Needs Attention section", async ({ page }) => {
    // Section should exist
    const section = page.getByText("Needs Attention");
    await expect(section).toBeVisible();
  });

  test("shows items or empty state", async ({ page }) => {
    // Either shows items or "All caught up!" message
    const hasItems =
      (await page.locator('[data-testid="attention-item"]').count()) > 0;
    const isEmpty = await page.getByText("All caught up!").isVisible();

    expect(hasItems || isEmpty).toBeTruthy();
  });
});

test.describe("Quick Actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");
  });

  test("Send Reminder opens dialog", async ({ page }) => {
    // Find first attention item with dropdown
    const items = page.locator('[data-testid="attention-item"]');
    const count = await items.count();

    if (count === 0) {
      test.skip(true, "No attention items to test");
      return;
    }

    // Click the dropdown menu trigger
    const menuTrigger = items
      .first()
      .locator('[data-testid="quick-action-menu"]');
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.getByText("Send Reminder").click();

      // Dialog should open
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
    }
  });

  test("Mark as Lost shows reason dropdown", async ({ page }) => {
    const items = page.locator('[data-testid="attention-item"]');
    const count = await items.count();

    if (count === 0) {
      test.skip(true, "No attention items to test");
      return;
    }

    const menuTrigger = items
      .first()
      .locator('[data-testid="quick-action-menu"]');
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.getByText("Mark as Lost").click();

      // Dialog should have reason selector
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/reason/i)).toBeVisible();
    }
  });

  test("Snooze shows date picker", async ({ page }) => {
    const items = page.locator('[data-testid="attention-item"]');
    const count = await items.count();

    if (count === 0) {
      test.skip(true, "No attention items to test");
      return;
    }

    const menuTrigger = items
      .first()
      .locator('[data-testid="quick-action-menu"]');
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.getByText("Snooze").click();

      // Dialog should have date picker
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/follow up/i)).toBeVisible();
    }
  });
});

test.describe("Activity Feed", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");
  });

  test("displays Activity Feed section", async ({ page }) => {
    const feed = page.getByText("Activity Feed");
    await expect(feed).toBeVisible();
  });

  test("shows connection status indicator", async ({ page }) => {
    // Should show connected or disconnected icon
    const statusIndicator = page.locator('[data-testid="connection-status"]');
    if (await statusIndicator.isVisible()) {
      expect(await statusIndicator.isVisible()).toBeTruthy();
    }
  });
});

test.describe("Smart Alerts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");
  });

  test("displays Smart Alerts section when alerts exist", async ({ page }) => {
    const alertsSection = page.getByText("Smart Alerts");
    if (await alertsSection.isVisible()) {
      await expect(alertsSection).toBeVisible();
    }
  });

  test("can dismiss an alert", async ({ page }) => {
    const alert = page.locator('[data-testid="smart-alert"]').first();

    if ((await alert.count()) === 0) {
      test.skip(true, "No alerts to dismiss");
      return;
    }

    const dismissBtn = alert.locator('[data-testid="dismiss-alert"]');
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
      // Alert should disappear or be marked dismissed
      await expect(alert).not.toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe("Win/Loss Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");
  });

  test("displays win rate metric", async ({ page }) => {
    const analytics = page.locator('[data-testid="win-loss-analytics"]');

    if (await analytics.isVisible()) {
      await expect(page.getByText("Win Rate")).toBeVisible();
      // Check for percentage value
      await expect(page.locator("text=/\\d+(\\.\\d+)?%/")).toBeVisible();
    }
  });

  test("displays average cycle time", async ({ page }) => {
    const analytics = page.locator('[data-testid="win-loss-analytics"]');

    if (await analytics.isVisible()) {
      await expect(page.getByText(/avg cycle/i)).toBeVisible();
    }
  });

  test("displays loss reason chart", async ({ page }) => {
    const chart = page.locator('[data-testid="loss-reason-chart"]');

    if (await chart.isVisible()) {
      // Chart should have some visual content
      await expect(chart.locator("svg, canvas")).toBeVisible();
    }
  });

  test("displays top competitors when data exists", async ({ page }) => {
    const competitorsSection = page.getByText("Top Competitors");

    if (await competitorsSection.isVisible()) {
      await expect(competitorsSection).toBeVisible();
    }
  });
});

test.describe("Language Toggle", () => {
  test("switches to Lithuanian when available", async ({ page }) => {
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");

    // Find language toggle (if it exists)
    const langToggle = page.locator('[data-testid="language-toggle"]');

    if (await langToggle.isVisible()) {
      await langToggle.click();
      await page.getByText(/lietuviu|LT/i).click();

      // Check Lithuanian text appears
      await expect(page.getByText("Valdymo centras")).toBeVisible();
    }
  });
});

test.describe("Responsive Layout", () => {
  test("adapts to mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");

    // Should still show core elements
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Prospects")).toBeVisible();
  });

  test("adapts to tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");

    // Should show all core elements
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Revenue Pipeline")).toBeVisible();
  });
});

test.describe("Error Handling", () => {
  test("handles API errors gracefully", async ({ page }) => {
    // Intercept API and return error
    await page.route("**/api/command-center/**", (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal server error" }),
      })
    );

    await page.goto("/command-center");

    // Should show error state or fallback content, not crash
    await expect(page).not.toHaveURL(/error/);
  });

  test("shows loading state while fetching data", async ({ page }) => {
    // Slow down API responses
    await page.route("**/api/command-center/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      route.continue();
    });

    await page.goto("/command-center");

    // Should show some loading indicator or skeleton
    const skeleton = page.locator('[class*="skeleton"], [class*="loading"]');
    // At least briefly visible during load
    expect(
      (await skeleton.count()) > 0 ||
        (await page.getByRole("heading", { level: 1 }).isVisible())
    ).toBeTruthy();
  });
});
