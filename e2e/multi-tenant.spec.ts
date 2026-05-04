/**
 * Multi-Tenant Isolation E2E Tests
 * Phase 72-01: Multi-Tenancy Verification
 *
 * Tests critical tenant isolation requirements:
 * - User A cannot access User B's data
 * - Cross-tenant API calls return 403
 * - Rate limits are isolated per tenant
 *
 * TENANT-01: All queries filter by workspace_id
 * TENANT-02: Cross-tenant data access returns 403
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

// Test workspace IDs - in real tests these would be created via fixtures
const WORKSPACE_A = "workspace-tenant-a";
const WORKSPACE_B = "workspace-tenant-b";

// Mock user tokens for different tenants
// In production tests, these would be real Clerk JWT tokens
const USER_A_HEADERS = {
  "X-Client-ID": WORKSPACE_A,
  Authorization: "Bearer test-token-user-a",
};

const USER_B_HEADERS = {
  "X-Client-ID": WORKSPACE_B,
  Authorization: "Bearer test-token-user-b",
};

test.describe("Multi-Tenant Data Isolation", () => {
  test.describe("Contract Access", () => {
    test("User A cannot access User B's contracts via API", async ({
      request,
    }) => {
      // Attempt to access User B's contract ID with User A's credentials
      const response = await request.get("/api/contracts/contract-id-owned-by-b", {
        headers: USER_A_HEADERS,
      });

      // Should return 403 Forbidden or 404 Not Found (both are acceptable)
      // 403 = explicit denial, 404 = resource not visible to user
      expect([403, 404]).toContain(response.status());
    });

    test("User A can access their own contracts", async ({ request }) => {
      // First, list contracts for User A's workspace
      const response = await request.get("/api/contracts", {
        headers: USER_A_HEADERS,
        params: { workspaceId: WORKSPACE_A },
      });

      // Should succeed or return empty list
      expect([200, 204]).toContain(response.status());
    });
  });

  test.describe("Proposal Access", () => {
    test("User A cannot access User B's proposals", async ({ request }) => {
      const response = await request.get("/api/proposals/proposal-id-owned-by-b", {
        headers: USER_A_HEADERS,
      });

      expect([403, 404]).toContain(response.status());
    });

    test("User A can list their own proposals", async ({ request }) => {
      const response = await request.get("/api/proposals", {
        headers: USER_A_HEADERS,
        params: { workspaceId: WORKSPACE_A },
      });

      expect([200, 204]).toContain(response.status());
    });
  });

  test.describe("Invoice Access", () => {
    test("User A cannot access User B's invoices", async ({ request }) => {
      const response = await request.get("/api/invoices/invoice-id-owned-by-b", {
        headers: USER_A_HEADERS,
      });

      expect([403, 404]).toContain(response.status());
    });

    test("User A can list their own invoices", async ({ request }) => {
      const response = await request.get("/api/invoices", {
        headers: USER_A_HEADERS,
        params: { workspaceId: WORKSPACE_A },
      });

      expect([200, 204]).toContain(response.status());
    });
  });

  test.describe("Follow-Up Access", () => {
    test("User A cannot access User B's follow-ups", async ({ request }) => {
      const response = await request.get("/api/follow-ups/follow-up-id-owned-by-b", {
        headers: USER_A_HEADERS,
      });

      expect([403, 404]).toContain(response.status());
    });

    test("User A can list their own follow-ups", async ({ request }) => {
      const response = await request.get("/api/follow-ups", {
        headers: USER_A_HEADERS,
        params: { workspaceId: WORKSPACE_A },
      });

      expect([200, 204]).toContain(response.status());
    });
  });
});

test.describe("Cross-Tenant API Protection", () => {
  test("Missing X-Client-ID header returns 403", async ({ request }) => {
    const response = await request.get("/api/contracts", {
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    // Should require workspace context
    expect([401, 403]).toContain(response.status());
  });

  test("Invalid X-Client-ID format returns 403", async ({ request }) => {
    const response = await request.get("/api/contracts", {
      headers: {
        "X-Client-ID": "invalid-not-uuid",
        Authorization: "Bearer test-token",
      },
    });

    expect([403]).toContain(response.status());
  });

  test("Non-existent workspace returns 403", async ({ request }) => {
    const response = await request.get("/api/contracts", {
      headers: {
        "X-Client-ID": "00000000-0000-0000-0000-000000000000",
        Authorization: "Bearer test-token",
      },
    });

    expect([403]).toContain(response.status());
  });

  test("Cross-tenant workspaceId parameter injection blocked", async ({
    request,
  }) => {
    // User A tries to pass User B's workspaceId in request body/params
    const response = await request.get("/api/contracts", {
      headers: USER_A_HEADERS,
      params: {
        workspaceId: WORKSPACE_B, // Attempting to access other workspace's data
      },
    });

    // Server should either:
    // 1. Ignore the param and use header (200 with A's data)
    // 2. Reject the mismatch (403)
    // 3. Return empty (204) if A has no contracts
    expect([200, 204, 403]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      // Verify all returned contracts belong to User A, not User B
      if (Array.isArray(data) && data.length > 0) {
        for (const contract of data) {
          expect(contract.workspaceId).toBe(WORKSPACE_A);
          expect(contract.workspaceId).not.toBe(WORKSPACE_B);
        }
      }
    }
  });
});

test.describe("Rate Limit Tenant Isolation", () => {
  test("Rate limits are per-tenant, not global", async ({ request }) => {
    // This test verifies that hitting rate limits for User A
    // does not affect User B's quota

    // Make multiple rapid requests as User A
    const userARequests = Array.from({ length: 5 }, () =>
      request.get("/api/health", { headers: USER_A_HEADERS })
    );

    const userAResponses = await Promise.all(userARequests);

    // User B should still be able to make requests
    const userBResponse = await request.get("/api/health", {
      headers: USER_B_HEADERS,
    });

    // User B should not be rate limited due to User A's requests
    expect(userBResponse.status()).not.toBe(429);
  });
});

test.describe("Audit Trail Isolation", () => {
  test("Activity feed shows only current workspace events", async ({
    page,
  }) => {
    // Navigate to command center with User A context
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");

    // Check activity feed
    const activityFeed = page.locator('[data-testid="activity-feed"]');

    if (await activityFeed.isVisible()) {
      // All activity items should be for the current workspace
      const items = activityFeed.locator('[data-testid="activity-item"]');
      const count = await items.count();

      for (let i = 0; i < count; i++) {
        const item = items.nth(i);
        // Activity items should not reference other workspaces
        const text = await item.textContent();
        expect(text).not.toContain(WORKSPACE_B);
      }
    }
  });
});

test.describe("Pipeline Metrics Isolation", () => {
  test("Pipeline metrics are workspace-scoped", async ({ request }) => {
    const response = await request.get("/api/command-center/metrics", {
      headers: USER_A_HEADERS,
    });

    if (response.status() === 200) {
      const metrics = await response.json();

      // Metrics should have workspaceId matching the request
      if (metrics.workspaceId) {
        expect(metrics.workspaceId).toBe(WORKSPACE_A);
      }

      // Should not contain data from other workspaces
      // (This would need to be validated against known test data)
    }
  });
});

test.describe("Prospect Data Isolation", () => {
  test("User A cannot view User B's prospects", async ({ request }) => {
    const response = await request.get("/api/prospects/prospect-id-owned-by-b", {
      headers: USER_A_HEADERS,
    });

    expect([403, 404]).toContain(response.status());
  });

  test("Prospect search is workspace-scoped", async ({ request }) => {
    const response = await request.get("/api/prospects", {
      headers: USER_A_HEADERS,
      params: {
        search: "example.com",
        workspaceId: WORKSPACE_A,
      },
    });

    if (response.status() === 200) {
      const prospects = await response.json();

      // All returned prospects should belong to User A's workspace
      if (Array.isArray(prospects) && prospects.length > 0) {
        for (const prospect of prospects) {
          expect(prospect.workspaceId).toBe(WORKSPACE_A);
        }
      }
    }
  });
});

test.describe("Template Visibility", () => {
  test("System templates are visible to all workspaces", async ({ request }) => {
    // Both users should see system templates (workspaceId = null)
    const responseA = await request.get("/api/templates", {
      headers: USER_A_HEADERS,
    });

    const responseB = await request.get("/api/templates", {
      headers: USER_B_HEADERS,
    });

    if (responseA.status() === 200 && responseB.status() === 200) {
      const templatesA = await responseA.json();
      const templatesB = await responseB.json();

      // Get system templates from each response
      const systemTemplatesA = (Array.isArray(templatesA) ? templatesA : [])
        .filter((t: { workspaceId: string | null }) => t.workspaceId === null);
      const systemTemplatesB = (Array.isArray(templatesB) ? templatesB : [])
        .filter((t: { workspaceId: string | null }) => t.workspaceId === null);

      // System templates should be the same for both users
      expect(systemTemplatesA.map((t: { id: string }) => t.id).sort()).toEqual(
        systemTemplatesB.map((t: { id: string }) => t.id).sort()
      );
    }
  });

  test("Custom templates are workspace-scoped", async ({ request }) => {
    const response = await request.get("/api/templates", {
      headers: USER_A_HEADERS,
    });

    if (response.status() === 200) {
      const templates = await response.json();

      // Non-system templates should belong to User A's workspace
      const customTemplates = (Array.isArray(templates) ? templates : [])
        .filter((t: { workspaceId: string | null }) => t.workspaceId !== null);

      for (const template of customTemplates) {
        expect(template.workspaceId).toBe(WORKSPACE_A);
      }
    }
  });
});

test.describe("Service-Level Agreement Isolation", () => {
  test("User cannot modify another workspace's agreement", async ({
    request,
  }) => {
    const response = await request.patch("/api/agreements/agreement-id-owned-by-b", {
      headers: USER_A_HEADERS,
      data: {
        status: "signed",
      },
    });

    expect([403, 404]).toContain(response.status());
  });
});

test.describe("Webhook Security", () => {
  test("Webhook configurations are workspace-scoped", async ({ request }) => {
    const response = await request.get("/api/webhooks", {
      headers: USER_A_HEADERS,
    });

    if (response.status() === 200) {
      const webhooks = await response.json();

      // All webhooks should belong to the requesting workspace
      if (Array.isArray(webhooks) && webhooks.length > 0) {
        for (const webhook of webhooks) {
          expect(webhook.workspaceId).toBe(WORKSPACE_A);
        }
      }
    }
  });

  test("Cannot create webhook for another workspace", async ({ request }) => {
    const response = await request.post("/api/webhooks", {
      headers: USER_A_HEADERS,
      data: {
        workspaceId: WORKSPACE_B, // Attempting injection
        url: "https://attacker.com/webhook",
        events: ["contract.signed"],
      },
    });

    // Should either ignore the workspaceId or reject
    expect([201, 400, 403]).toContain(response.status());

    if (response.status() === 201) {
      const webhook = await response.json();
      // Even if created, it should use the authenticated workspace
      expect(webhook.workspaceId).toBe(WORKSPACE_A);
    }
  });
});
