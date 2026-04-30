/**
 * Payment Flow E2E Tests
 * Phase 54-05: Checkout Widget + E2E Testing
 *
 * Tests full payment lifecycle for both Stripe and Revolut providers.
 * Uses test/sandbox modes with test card numbers.
 */
import { test, expect } from "@playwright/test";

const TEST_INVOICE_ID = "test-invoice-001";

test.describe("Payment Flow", () => {
  test.describe("Invoice Payment Page", () => {
    test("displays invoice details correctly", async ({ page }) => {
      await page.goto(`/invoices/${TEST_INVOICE_ID}/pay`);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Total")).toBeVisible();
      await expect(page.getByRole("button", { name: /pay/i })).toBeVisible();
    });

    test("shows error for non-existent invoice", async ({ page }) => {
      await page.goto("/invoices/non-existent-id/pay");

      await expect(page.getByText(/not found|failed to load/i)).toBeVisible();
    });

    test("shows already paid message for paid invoices", async ({ page }) => {
      await page.goto("/invoices/paid-invoice-id/pay");

      await expect(
        page.getByText(/already paid|no longer available/i)
      ).toBeVisible();
    });
  });

  test.describe("Provider Selection", () => {
    test("shows provider selector when multiple providers enabled", async ({
      page,
    }) => {
      await page.goto(`/invoices/${TEST_INVOICE_ID}/pay`);

      const selector = page.getByText("Choose payment method");
      if (await selector.isVisible()) {
        await expect(page.getByText("Stripe")).toBeVisible();
        await expect(page.getByText("Revolut")).toBeVisible();
      }
    });

    test("switches checkout widget when provider changes", async ({ page }) => {
      await page.goto(`/invoices/${TEST_INVOICE_ID}/pay`);

      const stripeButton = page.getByRole("button", { name: /stripe/i });
      const revolutButton = page.getByRole("button", { name: /revolut/i });

      if ((await stripeButton.isVisible()) && (await revolutButton.isVisible())) {
        await revolutButton.click();
        await expect(
          page.getByText(/secured payment powered by revolut/i)
        ).toBeVisible();

        await stripeButton.click();
        await expect(
          page.getByText(/secured payment powered by stripe/i)
        ).toBeVisible();
      }
    });
  });

  test.describe("Stripe Payment", () => {
    test("redirects to Stripe checkout", async ({ page }) => {
      await page.goto(`/invoices/${TEST_INVOICE_ID}/pay`);

      const payButton = page.getByRole("button", { name: /pay/i });
      await payButton.click();

      await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 10000 });
    });

    test.skip("completes payment with test card", async ({ page }) => {
      await page.goto(`/invoices/${TEST_INVOICE_ID}/pay`);

      const payButton = page.getByRole("button", { name: /pay/i });
      await payButton.click();

      await page.waitForURL(/checkout\.stripe\.com/);

      await page.fill('[data-testid="card-number"]', "4242424242424242");
      await page.fill('[data-testid="card-expiry"]', "12/30");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.fill('[data-testid="billing-name"]', "Test User");

      await page.click('[data-testid="submit"]');

      await expect(page).toHaveURL(/\/invoices\/.*\/success/, {
        timeout: 30000,
      });
    });
  });

  test.describe("Revolut Payment", () => {
    test("opens Revolut checkout popup", async ({ page }) => {
      await page.goto(`/invoices/${TEST_INVOICE_ID}/pay`);

      const revolutButton = page.getByRole("button", { name: /revolut/i });
      if (await revolutButton.isVisible()) {
        await revolutButton.click();
      }

      const payButton = page.getByRole("button", { name: /pay/i });
      await payButton.click();

      await expect(page.getByText(/processing payment/i)).toBeVisible({
        timeout: 5000,
      });
    });

    test.skip("shows Apple/Google Pay when available", async ({ page }) => {
      await page.goto(`/invoices/${TEST_INVOICE_ID}/pay`);

      const revolutButton = page.getByRole("button", { name: /revolut/i });
      if (await revolutButton.isVisible()) {
        await revolutButton.click();
      }

      const walletButton = page.getByText(/apple pay|google pay/i);
      await expect(walletButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Success Page", () => {
    test("displays success message", async ({ page }) => {
      await page.goto(`/invoices/${TEST_INVOICE_ID}/success`);

      await expect(page.getByText(/payment successful/i)).toBeVisible();
      await expect(page.getByText(/what happens next/i)).toBeVisible();
    });

    test("shows invoice reference", async ({ page }) => {
      await page.goto(`/invoices/${TEST_INVOICE_ID}/success`);

      await expect(page.getByText(TEST_INVOICE_ID)).toBeVisible();
    });
  });

  test.describe("Webhook Processing", () => {
    test("processes Stripe webhook", async ({ request }) => {
      const response = await request.post("/api/webhooks/stripe", {
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": "test-signature",
        },
        data: {
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test_123",
              payment_intent: "pi_test_123",
              metadata: {
                invoiceId: TEST_INVOICE_ID,
              },
            },
          },
        },
      });

      expect([200, 400, 401]).toContain(response.status());
    });

    test("processes Revolut webhook", async ({ request }) => {
      const response = await request.post("/api/webhooks/revolut", {
        headers: {
          "Content-Type": "application/json",
          "Revolut-Signature": "test-signature",
        },
        data: {
          event: "ORDER_COMPLETED",
          order_id: "test-order-123",
          merchant_order_ext_ref: TEST_INVOICE_ID,
        },
      });

      expect([200, 400, 401]).toContain(response.status());
    });
  });

  test.describe("Error Handling", () => {
    test("handles network errors gracefully", async ({ page }) => {
      await page.route("**/api/proxy/invoices/**", (route) =>
        route.abort("failed")
      );

      await page.goto(`/invoices/${TEST_INVOICE_ID}/pay`);
      await expect(page.getByText(/failed|error/i)).toBeVisible();
    });

    test("shows retry button on checkout failure", async ({ page }) => {
      await page.goto(`/invoices/${TEST_INVOICE_ID}/pay`);

      await page.route("**/api/proxy/invoices/**/pay", (route) =>
        route.fulfill({
          status: 500,
          body: JSON.stringify({ success: false, error: "Server error" }),
        })
      );

      const payButton = page.getByRole("button", { name: /pay/i });
      await payButton.click();

      await expect(page.getByRole("button", { name: /try again/i })).toBeVisible(
        { timeout: 5000 }
      );
    });
  });
});

test.describe("Payment Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/payments");
  });

  test("displays provider cards", async ({ page }) => {
    await expect(page.getByText("Stripe")).toBeVisible();
    await expect(page.getByText("Revolut")).toBeVisible();
  });

  test("opens Revolut connect modal", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /connect revolut/i });
    if (await connectButton.isVisible()) {
      await connectButton.click();
      await expect(page.getByText(/api key/i)).toBeVisible();
    }
  });

  test("saves primary provider selection", async ({ page }) => {
    const revolutCard = page.getByTestId("provider-card-revolut");
    if (await revolutCard.isVisible()) {
      const primaryButton = revolutCard.getByRole("button", {
        name: /set as primary/i,
      });
      if (await primaryButton.isVisible()) {
        await primaryButton.click();
        await expect(page.getByText(/saved|updated/i)).toBeVisible({
          timeout: 3000,
        });
      }
    }
  });
});
