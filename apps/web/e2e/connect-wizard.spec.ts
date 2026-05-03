/**
 * Connection Wizard E2E Tests
 * Phase 66-11: E2E Tests for Platform Unification
 *
 * Tests the complete connection wizard flow:
 * - URL entry and platform detection
 * - Path selection (DIY, Developer, OAuth)
 * - Guide navigation
 * - Code snippet copying
 * - Verification polling
 */
import { test, expect, Page } from "@playwright/test";

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_URLS = {
  shopify: "example.myshopify.com",
  wordpress: "example.wordpress.com",
  wix: "example.wixsite.com/site",
  custom: "custom-website.com",
};

// ============================================================================
// Helpers
// ============================================================================

async function navigateToConnect(page: Page) {
  await page.goto("/connect");
  await expect(page.getByText("Let's connect your website")).toBeVisible();
}

async function enterUrl(page: Page, url: string) {
  const urlInput = page.getByTestId("url-input");
  await urlInput.fill(url);
  await page.getByTestId("continue-btn").click();
}

// ============================================================================
// Connection Wizard Tests
// ============================================================================

test.describe("Connection Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToConnect(page);
  });

  test("displays URL input form on initial load", async ({ page }) => {
    // Verify initial state
    await expect(page.getByText("Let's connect your website")).toBeVisible();
    await expect(page.getByTestId("url-input")).toBeVisible();
    await expect(page.getByTestId("continue-btn")).toBeVisible();

    // Continue button should be disabled with empty input
    const continueBtn = page.getByTestId("continue-btn");
    await expect(continueBtn).toBeDisabled();
  });

  test("enables continue button when URL is entered", async ({ page }) => {
    const urlInput = page.getByTestId("url-input");
    const continueBtn = page.getByTestId("continue-btn");

    // Enter URL
    await urlInput.fill("example.com");

    // Button should now be enabled
    await expect(continueBtn).toBeEnabled();
  });

  test("shows loading state during platform detection", async ({ page }) => {
    // Mock the detection API to be slow
    await page.route("**/api/connect/detect", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "shopify",
          confidence: 100,
          features: ["ecommerce"],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        }),
      });
    });

    await enterUrl(page, TEST_URLS.shopify);

    // Should show loading indicator
    await expect(page.getByText("Checking...")).toBeVisible();
  });

  test("displays detection results for Shopify site", async ({ page }) => {
    // Mock detection API
    await page.route("**/api/connect/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "shopify",
          confidence: 100,
          features: ["ecommerce"],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        }),
      });
    });

    // Mock installation creation
    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_test123",
          status: "pending",
        }),
      });
    });

    await enterUrl(page, TEST_URLS.shopify);

    // Wait for detection results
    await expect(page.getByText("Shopify")).toBeVisible({ timeout: 10000 });

    // Should show connection options
    await expect(page.getByTestId("diy-option")).toBeVisible();
    await expect(page.getByTestId("developer-option")).toBeVisible();
  });

  test("displays detection results for WordPress site", async ({ page }) => {
    await page.route("**/api/connect/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "wordpress_com",
          confidence: 95,
          features: ["blog"],
          paidPlanRequired: true,
          estimatedTime: "3 min",
        }),
      });
    });

    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_wp123",
          status: "pending",
        }),
      });
    });

    await enterUrl(page, TEST_URLS.wordpress);

    await expect(page.getByText("WordPress.com")).toBeVisible({ timeout: 10000 });
  });

  test("shows all three connection options for supported platforms", async ({
    page,
  }) => {
    await page.route("**/api/connect/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "shopify",
          confidence: 100,
          features: ["ecommerce"],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        }),
      });
    });

    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_test123",
          status: "pending",
        }),
      });
    });

    await enterUrl(page, TEST_URLS.shopify);

    // Wait for choice screen
    await expect(page.getByText("How would you like to connect?")).toBeVisible({
      timeout: 10000,
    });

    // All options visible
    await expect(page.getByTestId("diy-option")).toBeVisible();
    await expect(page.getByTestId("developer-option")).toBeVisible();
    await expect(page.getByTestId("oauth-option")).toBeVisible();

    // Option content
    await expect(page.getByText("I'll do it myself")).toBeVisible();
    await expect(page.getByText("Send to my tech person")).toBeVisible();
    await expect(page.getByText("I have developer access (OAuth)")).toBeVisible();
  });

  test("navigates to DIY guide when selecting DIY option", async ({ page }) => {
    // Mock detection
    await page.route("**/api/connect/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "shopify",
          confidence: 100,
          features: ["ecommerce"],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        }),
      });
    });

    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_test123",
          status: "pending",
        }),
      });
    });

    // Mock guide API
    await page.route("**/api/connect/guide/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          guide: {
            platform: "shopify",
            name: "Shopify",
            steps: [
              {
                number: 1,
                title: "Go to Online Store",
                description: "In your Shopify admin, click Online Store > Themes",
                screenshot: null,
                code: null,
                helpLink: null,
              },
              {
                number: 2,
                title: "Edit Code",
                description: "Click Actions > Edit code",
                screenshot: null,
                code: null,
                helpLink: null,
              },
              {
                number: 3,
                title: "Add the Snippet",
                description: "Paste this code before </head>",
                screenshot: null,
                code: '<script src="https://pixel.tevero.io/t.js" data-site="site_test123"></script>',
                helpLink: "https://help.tevero.io/shopify",
              },
            ],
            estimatedTime: "2 min",
            difficulty: "easy",
            paidPlanRequired: false,
            fallbackToGtm: false,
          },
          snippet:
            '<script src="https://pixel.tevero.io/t.js" data-site="site_test123"></script>',
        }),
      });
    });

    await enterUrl(page, TEST_URLS.shopify);
    await expect(page.getByTestId("diy-option")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("diy-option").click();

    // Should show guide
    await expect(page.getByText("Add TeveroSEO to your Shopify")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
  });

  test("navigates through guide steps", async ({ page }) => {
    // Setup mocks
    await page.route("**/api/connect/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "shopify",
          confidence: 100,
          features: [],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        }),
      });
    });

    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_test123",
          status: "pending",
        }),
      });
    });

    await page.route("**/api/connect/guide/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          guide: {
            platform: "shopify",
            name: "Shopify",
            steps: [
              { number: 1, title: "Step One", description: "First step" },
              { number: 2, title: "Step Two", description: "Second step" },
              { number: 3, title: "Step Three", description: "Third step" },
            ],
            estimatedTime: "2 min",
            difficulty: "easy",
            paidPlanRequired: false,
            fallbackToGtm: false,
          },
          snippet: "<script>test</script>",
        }),
      });
    });

    await enterUrl(page, TEST_URLS.shopify);
    await page.getByTestId("diy-option").click();

    // Step 1
    await expect(page.getByText("Step 1 of 3")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Step One")).toBeVisible();

    // Navigate to step 2
    await page.getByTestId("next-step-btn").click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(page.getByText("Step Two")).toBeVisible();

    // Navigate to step 3
    await page.getByTestId("next-step-btn").click();
    await expect(page.getByText("Step 3 of 3")).toBeVisible();
    await expect(page.getByText("Step Three")).toBeVisible();

    // Final step should show verify button
    await expect(page.getByText("Verify Installation")).toBeVisible();
  });

  test("copies code snippet to clipboard", async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.route("**/api/connect/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "shopify",
          confidence: 100,
          features: [],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        }),
      });
    });

    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_test123",
          status: "pending",
        }),
      });
    });

    await page.route("**/api/connect/guide/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          guide: {
            platform: "shopify",
            name: "Shopify",
            steps: [
              {
                number: 1,
                title: "Add Code",
                description: "Copy and paste this code",
                code: '<script src="https://pixel.tevero.io/t.js"></script>',
              },
            ],
            estimatedTime: "2 min",
            difficulty: "easy",
            paidPlanRequired: false,
            fallbackToGtm: false,
          },
          snippet: '<script src="https://pixel.tevero.io/t.js"></script>',
        }),
      });
    });

    await enterUrl(page, TEST_URLS.shopify);
    await page.getByTestId("diy-option").click();

    // Wait for guide to load
    await expect(page.getByTestId("copy-btn")).toBeVisible({ timeout: 10000 });

    // Click copy button
    await page.getByTestId("copy-btn").click();

    // Should show "Copied!" feedback
    await expect(page.getByText("Copied!")).toBeVisible();
  });

  test("handles detection timeout gracefully", async ({ page }) => {
    // Mock slow/failing detection
    await page.route("**/api/connect/detect", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 35000));
      await route.abort("timedout");
    });

    // Set a shorter timeout for the test
    test.setTimeout(60000);

    await enterUrl(page, TEST_URLS.custom);

    // Should eventually show error state
    await expect(page.getByText("Something went wrong")).toBeVisible({
      timeout: 40000,
    });

    // Should have retry button
    await expect(page.getByText("Try Again")).toBeVisible();
  });

  test("retry button resets wizard", async ({ page }) => {
    let detectCount = 0;

    await page.route("**/api/connect/detect", async (route) => {
      detectCount++;
      if (detectCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Server error" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            platform: "shopify",
            confidence: 100,
            features: [],
            paidPlanRequired: false,
            estimatedTime: "2 min",
          }),
        });
      }
    });

    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_test123",
          status: "pending",
        }),
      });
    });

    // First attempt fails
    await enterUrl(page, TEST_URLS.shopify);
    await expect(page.getByText("Something went wrong")).toBeVisible({
      timeout: 10000,
    });

    // Click retry
    await page.getByText("Try Again").click();

    // Should return to URL input
    await expect(page.getByText("Let's connect your website")).toBeVisible();
  });
});

// ============================================================================
// Platform Detection Tests
// ============================================================================

test.describe("Platform Detection", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToConnect(page);
  });

  const platforms = [
    { url: "example.myshopify.com", expected: "Shopify", platform: "shopify" },
    {
      url: "example.wordpress.com",
      expected: "WordPress.com",
      platform: "wordpress_com",
    },
    { url: "example.wixsite.com/site", expected: "Wix", platform: "wix" },
    {
      url: "example.squarespace.com",
      expected: "Squarespace",
      platform: "squarespace",
    },
  ];

  for (const { url, expected, platform } of platforms) {
    test(`detects ${expected} from URL pattern`, async ({ page }) => {
      await page.route("**/api/connect/detect", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            platform,
            confidence: 100,
            features: [],
            paidPlanRequired: false,
            estimatedTime: "2 min",
          }),
        });
      });

      await page.route("**/api/connect/installation", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            siteId: "site_test123",
            status: "pending",
          }),
        });
      });

      await enterUrl(page, url);
      await expect(page.getByText(expected)).toBeVisible({ timeout: 10000 });
    });
  }
});

// ============================================================================
// Verification Flow Tests
// ============================================================================

test.describe("Verification Flow", () => {
  test("shows verification screen after completing guide", async ({ page }) => {
    await navigateToConnect(page);

    await page.route("**/api/connect/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "shopify",
          confidence: 100,
          features: [],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        }),
      });
    });

    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_test123",
          status: "pending",
        }),
      });
    });

    await page.route("**/api/connect/guide/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          guide: {
            platform: "shopify",
            name: "Shopify",
            steps: [{ number: 1, title: "Final Step", description: "Done" }],
            estimatedTime: "2 min",
            difficulty: "easy",
            paidPlanRequired: false,
            fallbackToGtm: false,
          },
          snippet: "<script></script>",
        }),
      });
    });

    await enterUrl(page, TEST_URLS.shopify);
    await page.getByTestId("diy-option").click();

    // Click verify
    await expect(page.getByText("Verify Installation")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("next-step-btn").click();

    // Should show verification waiting screen
    await expect(
      page.getByText("Waiting for your website to say hello")
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows success screen when verification succeeds", async ({ page }) => {
    await navigateToConnect(page);

    await page.route("**/api/connect/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "shopify",
          confidence: 100,
          features: [],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        }),
      });
    });

    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_test123",
          status: "pending",
        }),
      });
    });

    await page.route("**/api/connect/guide/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          guide: {
            platform: "shopify",
            name: "Shopify",
            steps: [{ number: 1, title: "Final Step", description: "Done" }],
            estimatedTime: "2 min",
            difficulty: "easy",
            paidPlanRequired: false,
            fallbackToGtm: false,
          },
          snippet: "<script></script>",
        }),
      });
    });

    // Mock verification to succeed
    await page.route("**/api/connect/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "detected",
          firstPingAt: new Date().toISOString(),
        }),
      });
    });

    await enterUrl(page, TEST_URLS.shopify);
    await page.getByTestId("diy-option").click();
    await expect(page.getByText("Verify Installation")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("next-step-btn").click();

    // Should eventually show success
    await expect(page.getByText("You're connected!")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText("Your first SEO insights will be ready in 24 hours")
    ).toBeVisible();
  });
});

// ============================================================================
// Mobile Responsiveness Tests
// ============================================================================

test.describe("Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("displays correctly on mobile viewport", async ({ page }) => {
    await navigateToConnect(page);

    // Check mobile layout
    await expect(page.getByTestId("url-input")).toBeVisible();
    await expect(page.getByTestId("continue-btn")).toBeVisible();

    // Button should be full width on mobile
    const button = page.getByTestId("continue-btn");
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThan(300); // Should be nearly full width
  });

  test("connection options stack vertically on mobile", async ({ page }) => {
    await page.route("**/api/connect/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "shopify",
          confidence: 100,
          features: [],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        }),
      });
    });

    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_test123",
          status: "pending",
        }),
      });
    });

    await navigateToConnect(page);
    await enterUrl(page, TEST_URLS.shopify);

    await expect(page.getByTestId("diy-option")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("developer-option")).toBeVisible();

    // Options should be stacked (DIY above Developer)
    const diyBox = await page.getByTestId("diy-option").boundingBox();
    const devBox = await page.getByTestId("developer-option").boundingBox();

    expect(diyBox?.y).toBeLessThan(devBox?.y ?? 0);
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

test.describe("Accessibility", () => {
  test("URL input has proper aria labels", async ({ page }) => {
    await navigateToConnect(page);

    const urlInput = page.getByTestId("url-input");
    await expect(urlInput).toHaveAttribute("aria-label", "Website URL");
  });

  test("buttons have proper aria labels", async ({ page }) => {
    await page.route("**/api/connect/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "shopify",
          confidence: 100,
          features: [],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        }),
      });
    });

    await page.route("**/api/connect/installation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteId: "site_test123",
          status: "pending",
        }),
      });
    });

    await navigateToConnect(page);
    await enterUrl(page, TEST_URLS.shopify);

    await expect(page.getByTestId("diy-option")).toBeVisible({ timeout: 10000 });

    // Check button aria labels
    await expect(page.getByRole("button", { name: "Start setup" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send instructions" })
    ).toBeVisible();
  });

  test("can navigate with keyboard", async ({ page }) => {
    await navigateToConnect(page);

    // Tab to URL input
    await page.keyboard.press("Tab");
    const urlInput = page.getByTestId("url-input");
    await expect(urlInput).toBeFocused();

    // Type URL
    await urlInput.type("example.com");

    // Tab to button
    await page.keyboard.press("Tab");
    const continueBtn = page.getByTestId("continue-btn");
    await expect(continueBtn).toBeFocused();
  });
});
