import { describe, expect, it } from "vitest";
import { getBacklinksAccessStatus } from "@/server/features/backlinks/backlinksAccess";

describe("backlinksAccess", () => {
  it("returns hosted status with backlinks enabled", async () => {
    // Clerk auth is always hosted - backlinks are platform-managed
    await expect(getBacklinksAccessStatus()).resolves.toMatchObject({
      enabled: true,
      verifiedAt: null,
      lastCheckedAt: null,
    });
  });
});
