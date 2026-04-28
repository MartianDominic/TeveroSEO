import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/features/audit/repositories/AuditRepository", () => ({
  AuditRepository: {
    createAudit: vi.fn().mockResolvedValue(undefined),
    deleteAuditForProject: vi.fn().mockResolvedValue(undefined),
    getAuditCapacityUsageForUser: vi.fn().mockResolvedValue(0),
    getAuditsByProject: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/server/queues/auditQueue", () => ({
  auditQueue: { add: vi.fn().mockResolvedValue(undefined), getJob: vi.fn() },
  AUDIT_STEP: { DISCOVER: "discover" },
}));

vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: vi
    .fn()
    .mockImplementation(async (u: string) => u),
}));

vi.mock("@/server/lib/audit/progress-kv", () => ({
  AuditProgressKV: {
    getCrawledUrls: vi.fn().mockResolvedValue([]),
    setCrawledUrls: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/server/lib/redis", () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

import { AuditRepository } from "@/server/features/audit/repositories/AuditRepository";
import { AuditService } from "@/server/features/audit/services/AuditService";

const baseInput = {
  actorUserId: "user-1",
  billingCustomer: {
    organizationId: "org-1",
    userEmail: "u@example.com",
    userId: "user-1",
  },
  projectId: "proj-1",
  startUrl: "https://example.com",
};

const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("AuditService.startAudit — client_id persistence (AUTH-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (AuditRepository.getAuditCapacityUsageForUser as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  });

  it("persists clientId when provided", async () => {
    await AuditService.startAudit({ ...baseInput, clientId: CLIENT_A });
    expect(AuditRepository.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: CLIENT_A }),
    );
  });

  it("persists null when clientId is omitted", async () => {
    await AuditService.startAudit(baseInput);
    expect(AuditRepository.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: null }),
    );
  });
});

describe("AuditService.getHistory — client_id filter (AUTH-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (AuditRepository.getAuditsByProject as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("passes clientId filter to the repository when provided", async () => {
    await AuditService.getHistory("proj-1", { clientId: CLIENT_A });
    expect(AuditRepository.getAuditsByProject).toHaveBeenCalledWith(
      "proj-1",
      { clientId: CLIENT_A },
    );
  });

  it("passes no filter when clientId is omitted", async () => {
    await AuditService.getHistory("proj-1");
    expect(AuditRepository.getAuditsByProject).toHaveBeenCalledWith(
      "proj-1",
      undefined,
    );
  });
});
