import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DiscountCodeSelect } from "@/db/discount-code-schema";

// Mock database - using a factory function to create fresh mocks per select
let selectCallCount = 0;
const mockSelectResults: unknown[][] = [];

const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();
const mockDbInsert = vi.fn();
const mockDbValues = vi.fn();
const mockDbReturning = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbSet = vi.fn();
const mockDbOrderBy = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (_projection?: unknown) => {
      return {
        from: mockDbFrom,
      };
    },
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("DiscountCodeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    mockSelectResults.length = 0;

    // Setup default mock chain for db queries
    mockDbFrom.mockImplementation(() => ({ where: mockDbWhere }));
    mockDbWhere.mockImplementation(() => {
      const result = mockSelectResults[selectCallCount] || [];
      selectCallCount++;
      // Return a thenable that also has limit/orderBy/returning for chaining
      const thenable = Promise.resolve(result);
      return Object.assign(thenable, {
        limit: vi.fn().mockResolvedValue(result),
        orderBy: vi.fn().mockResolvedValue(result),
        returning: vi.fn().mockResolvedValue(result),
        then: thenable.then.bind(thenable),
      });
    });
    mockDbLimit.mockResolvedValue([]);
    mockDbOrderBy.mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: mockDbValues });
    mockDbValues.mockReturnValue({ returning: mockDbReturning });
    mockDbReturning.mockResolvedValue([]);
    mockDbUpdate.mockReturnValue({ set: mockDbSet });
    mockDbSet.mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockResolvedValue(mockSelectResults[selectCallCount] || []),
      })),
    }));
  });

  describe("validateCode", () => {
    it("should return valid=true for active, unexpired code", async () => {
      const mockCode: Partial<DiscountCodeSelect> = {
        id: "dc_123",
        workspaceId: "ws_123",
        code: "WELCOME20",
        discountType: "percentage",
        discountValue: 2000,
        isActive: true,
        usedCount: 0,
        maxUses: 100,
        maxUsesPerCustomer: null,
        minAmountCents: null,
        validFrom: new Date(Date.now() - 86400000), // Yesterday
        validUntil: new Date(Date.now() + 86400000), // Tomorrow
      };

      mockSelectResults.push([mockCode]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.validateCode("welcome20", "ws_123");

      expect(result.valid).toBe(true);
      expect(result.discountCode?.code).toBe("WELCOME20");
    });

    it("should return NOT_FOUND for non-existent code", async () => {
      mockSelectResults.push([]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.validateCode("INVALID", "ws_123");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("NOT_FOUND");
    });

    it("should return INACTIVE for deactivated code", async () => {
      const mockCode: Partial<DiscountCodeSelect> = {
        id: "dc_123",
        code: "EXPIRED20",
        isActive: false,
      };

      mockSelectResults.push([mockCode]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.validateCode("EXPIRED20", "ws_123");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("INACTIVE");
    });

    it("should return EXPIRED for past validity window", async () => {
      const mockCode: Partial<DiscountCodeSelect> = {
        id: "dc_123",
        code: "OLDCODE",
        isActive: true,
        maxUses: null,
        maxUsesPerCustomer: null,
        minAmountCents: null,
        validUntil: new Date(Date.now() - 86400000), // Yesterday
      };

      mockSelectResults.push([mockCode]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.validateCode("OLDCODE", "ws_123");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("EXPIRED");
    });

    it("should return NOT_YET_VALID for future validity window", async () => {
      const mockCode: Partial<DiscountCodeSelect> = {
        id: "dc_123",
        code: "FUTURECODE",
        isActive: true,
        maxUses: null,
        maxUsesPerCustomer: null,
        minAmountCents: null,
        validFrom: new Date(Date.now() + 86400000), // Tomorrow
      };

      mockSelectResults.push([mockCode]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.validateCode("FUTURECODE", "ws_123");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("NOT_YET_VALID");
    });

    it("should return MAX_USES_REACHED when limit exceeded", async () => {
      const mockCode: Partial<DiscountCodeSelect> = {
        id: "dc_123",
        code: "LIMITED",
        isActive: true,
        maxUses: 10,
        usedCount: 10,
        maxUsesPerCustomer: null,
        minAmountCents: null,
      };

      mockSelectResults.push([mockCode]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.validateCode("LIMITED", "ws_123");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("MAX_USES_REACHED");
    });

    it("should return MINIMUM_NOT_MET when order amount too low", async () => {
      const mockCode: Partial<DiscountCodeSelect> = {
        id: "dc_123",
        code: "BIGORDER",
        isActive: true,
        maxUses: null,
        maxUsesPerCustomer: null,
        minAmountCents: 10000, // 100 EUR minimum
      };

      mockSelectResults.push([mockCode]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.validateCode(
        "BIGORDER",
        "ws_123",
        5000 // 50 EUR order
      );

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("MINIMUM_NOT_MET");
      expect(result.errorMessage).toContain("100.00");
    });

    it("should check per-customer usage limit", async () => {
      const mockCode: Partial<DiscountCodeSelect> = {
        id: "dc_123",
        code: "ONCEONLY",
        isActive: true,
        maxUses: null,
        maxUsesPerCustomer: 1,
        minAmountCents: null,
      };

      // First query returns the discount code
      mockSelectResults.push([mockCode]);
      // Second query returns customer usage count
      mockSelectResults.push([{ count: 1 }]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.validateCode(
        "ONCEONLY",
        "ws_123",
        undefined,
        "client_123"
      );

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("CUSTOMER_LIMIT_REACHED");
    });
  });

  describe("calculateDiscount", () => {
    it("should calculate percentage discount correctly", async () => {
      const mockCode: DiscountCodeSelect = {
        id: "dc_123",
        workspaceId: "ws_123",
        code: "SAVE20",
        discountType: "percentage",
        discountValue: 2000, // 20%
        description: null,
        maxUses: null,
        maxUsesPerCustomer: null,
        usedCount: 0,
        minAmountCents: null,
        maxDiscountCents: null,
        validFrom: null,
        validUntil: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = DiscountCodeService.calculateDiscount(mockCode, 10000); // 100 EUR

      expect(result.originalAmountCents).toBe(10000);
      expect(result.discountAmountCents).toBe(2000); // 20% of 100 = 20 EUR
      expect(result.finalAmountCents).toBe(8000);
      expect(result.discountDescription).toBe("20% off");
    });

    it("should calculate fixed discount correctly", async () => {
      const mockCode: DiscountCodeSelect = {
        id: "dc_123",
        workspaceId: "ws_123",
        code: "SAVE50",
        discountType: "fixed",
        discountValue: 5000, // 50 EUR
        description: null,
        maxUses: null,
        maxUsesPerCustomer: null,
        usedCount: 0,
        minAmountCents: null,
        maxDiscountCents: null,
        validFrom: null,
        validUntil: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = DiscountCodeService.calculateDiscount(mockCode, 10000); // 100 EUR

      expect(result.originalAmountCents).toBe(10000);
      expect(result.discountAmountCents).toBe(5000); // 50 EUR
      expect(result.finalAmountCents).toBe(5000);
      expect(result.discountDescription).toBe("50.00 off");
    });

    it("should cap fixed discount at order total", async () => {
      const mockCode: DiscountCodeSelect = {
        id: "dc_123",
        workspaceId: "ws_123",
        code: "BIGDISCOUNT",
        discountType: "fixed",
        discountValue: 20000, // 200 EUR
        description: null,
        maxUses: null,
        maxUsesPerCustomer: null,
        usedCount: 0,
        minAmountCents: null,
        maxDiscountCents: null,
        validFrom: null,
        validUntil: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = DiscountCodeService.calculateDiscount(mockCode, 10000); // 100 EUR

      expect(result.discountAmountCents).toBe(10000); // Capped at order total
      expect(result.finalAmountCents).toBe(0);
    });

    it("should apply max discount cap for percentage discounts", async () => {
      const mockCode: DiscountCodeSelect = {
        id: "dc_123",
        workspaceId: "ws_123",
        code: "HALFOFF",
        discountType: "percentage",
        discountValue: 5000, // 50%
        description: null,
        maxUses: null,
        maxUsesPerCustomer: null,
        usedCount: 0,
        minAmountCents: null,
        maxDiscountCents: 5000, // Max 50 EUR
        validFrom: null,
        validUntil: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = DiscountCodeService.calculateDiscount(mockCode, 20000); // 200 EUR

      // 50% of 200 = 100 EUR, but capped at 50 EUR
      expect(result.discountAmountCents).toBe(5000);
      expect(result.finalAmountCents).toBe(15000);
    });

    it("should handle fractional percentage correctly (floor)", async () => {
      const mockCode: DiscountCodeSelect = {
        id: "dc_123",
        workspaceId: "ws_123",
        code: "SAVE15",
        discountType: "percentage",
        discountValue: 1500, // 15%
        description: null,
        maxUses: null,
        maxUsesPerCustomer: null,
        usedCount: 0,
        minAmountCents: null,
        maxDiscountCents: null,
        validFrom: null,
        validUntil: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = DiscountCodeService.calculateDiscount(mockCode, 9999); // 99.99 EUR

      // 15% of 9999 = 1499.85, floored to 1499
      expect(result.discountAmountCents).toBe(1499);
      expect(result.finalAmountCents).toBe(8500);
    });
  });

  describe("validateAndCalculate", () => {
    it("should return validation and calculation together", async () => {
      const mockCode: DiscountCodeSelect = {
        id: "dc_123",
        workspaceId: "ws_123",
        code: "COMBO20",
        discountType: "percentage",
        discountValue: 2000,
        isActive: true,
        usedCount: 0,
        maxUses: null,
        maxUsesPerCustomer: null,
        minAmountCents: null,
        maxDiscountCents: null,
        validFrom: null,
        validUntil: null,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSelectResults.push([mockCode]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.validateAndCalculate(
        "COMBO20",
        "ws_123",
        10000
      );

      expect(result.valid).toBe(true);
      expect(result.calculation).toBeDefined();
      expect(result.calculation?.discountAmountCents).toBe(2000);
      expect(result.calculation?.finalAmountCents).toBe(8000);
    });

    it("should not include calculation when validation fails", async () => {
      mockSelectResults.push([]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.validateAndCalculate(
        "INVALID",
        "ws_123",
        10000
      );

      expect(result.valid).toBe(false);
      expect(result.calculation).toBeUndefined();
    });
  });

  describe("createDiscountCode", () => {
    it("should create a new discount code with normalized uppercase", async () => {
      mockSelectResults.push([]); // No existing code

      const mockCreated: DiscountCodeSelect = {
        id: "dc_new",
        workspaceId: "ws_123",
        code: "NEWCODE",
        discountType: "percentage",
        discountValue: 1000,
        isActive: true,
        usedCount: 0,
        maxUses: null,
        maxUsesPerCustomer: null,
        minAmountCents: null,
        maxDiscountCents: null,
        validFrom: null,
        validUntil: null,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDbReturning.mockResolvedValueOnce([mockCreated]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.createDiscountCode({
        workspaceId: "ws_123",
        code: "newcode", // lowercase input
        discountType: "percentage",
        discountValue: 1000,
      });

      expect(result.code).toBe("NEWCODE");
      expect(mockDbValues).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "NEWCODE",
          workspaceId: "ws_123",
        })
      );
    });

    it("should throw CONFLICT for duplicate code in same workspace", async () => {
      const existingCode: Partial<DiscountCodeSelect> = {
        id: "dc_existing",
        code: "DUPLICATE",
      };

      mockSelectResults.push([existingCode]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      await expect(
        DiscountCodeService.createDiscountCode({
          workspaceId: "ws_123",
          code: "duplicate",
          discountType: "percentage",
          discountValue: 1000,
        })
      ).rejects.toThrow("already exists");
    });
  });

  describe("applyToInvoice", () => {
    it("should record usage and increment counter", async () => {
      mockDbReturning.mockResolvedValueOnce([{ id: "usage_123" }]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      await DiscountCodeService.applyToInvoice(
        "dc_123",
        "inv_123",
        2000,
        "client_123"
      );

      // Verify insert was called
      expect(mockDbInsert).toHaveBeenCalled();
      expect(mockDbValues).toHaveBeenCalledWith(
        expect.objectContaining({
          discountCodeId: "dc_123",
          invoiceId: "inv_123",
          discountAmountCents: 2000,
          clientId: "client_123",
        })
      );

      // Verify update was called
      expect(mockDbUpdate).toHaveBeenCalled();
    });
  });

  describe("deactivateCode", () => {
    it("should set isActive to false and return true", async () => {
      mockSelectResults.push([{ id: "dc_123" }]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.deactivateCode("dc_123", "ws_123");

      expect(result).toBe(true);
      expect(mockDbSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        })
      );
    });

    it("should return false if code not found", async () => {
      mockSelectResults.push([]);

      const { DiscountCodeService } = await import("./DiscountCodeService.js");
      const result = await DiscountCodeService.deactivateCode("dc_unknown", "ws_123");

      expect(result).toBe(false);
    });
  });
});
