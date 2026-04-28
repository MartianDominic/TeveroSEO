/**
 * ProtectionEnforcementService Tests
 * Phase 37-05: Gap Closure - Protection Enforcement
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProtectionEnforcementService, protectionEnforcementService } from "./ProtectionEnforcementService";

// Mock ProtectionRulesService
vi.mock("./ProtectionRulesService", () => ({
  protectionRulesService: {
    getActiveRules: vi.fn(),
  },
}));

import { protectionRulesService } from "./ProtectionRulesService";

describe("ProtectionEnforcementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isContentProtected", () => {
    it("should return true for protected page URL", async () => {
      // Arrange
      const profileId = "profile-123";
      const url = "https://example.com/about";

      vi.mocked(protectionRulesService.getActiveRules).mockResolvedValue([
        {
          id: "rule-1",
          profileId,
          ruleType: "page",
          target: "/about",
          reason: "Brand messaging",
          createdBy: "user-1",
          expiresAt: null,
          createdAt: new Date(),
        },
      ]);

      const service = new ProtectionEnforcementService();

      // Act
      const result = await service.isContentProtected(profileId, url);

      // Assert
      expect(result).toBe(true);
    });

    it("should return true for content with voice:protected tag", async () => {
      // Arrange
      const profileId = "profile-123";
      const url = "https://example.com/page";
      const html = `
        <div>
          <p>Regular content</p>
          <!-- voice:protected -->
          <p>This is protected brand messaging</p>
          <!-- /voice:protected -->
        </div>
      `;

      vi.mocked(protectionRulesService.getActiveRules).mockResolvedValue([]);

      const service = new ProtectionEnforcementService();

      // Act
      const result = await service.isContentProtected(profileId, url, html);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false for non-protected page", async () => {
      // Arrange
      const profileId = "profile-123";
      const url = "https://example.com/blog/post-1";

      vi.mocked(protectionRulesService.getActiveRules).mockResolvedValue([
        {
          id: "rule-1",
          profileId,
          ruleType: "page",
          target: "/about",
          reason: "Brand messaging",
          createdBy: "user-1",
          expiresAt: null,
          createdAt: new Date(),
        },
      ]);

      const service = new ProtectionEnforcementService();

      // Act
      const result = await service.isContentProtected(profileId, url);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("extractProtectedSections", () => {
    it("should find all HTML comment tags", () => {
      // Arrange
      const html = `
        <div>
          <p>Regular content</p>
          <!-- voice:protected -->
          <h2>Protected Heading</h2>
          <p>Protected paragraph</p>
          <!-- /voice:protected -->
          <p>More regular content</p>
          <!-- voice:protected -->
          <p>Another protected section</p>
          <!-- /voice:protected -->
        </div>
      `;

      const service = new ProtectionEnforcementService();

      // Act
      const sections = service.extractProtectedSections(html);

      // Assert
      expect(sections).toHaveLength(2);
      expect(sections[0]).toContain("Protected Heading");
      expect(sections[0]).toContain("Protected paragraph");
      expect(sections[1]).toContain("Another protected section");
    });

    it("should return empty array when no protected sections", () => {
      // Arrange
      const html = `
        <div>
          <p>Regular content</p>
          <p>More regular content</p>
        </div>
      `;

      const service = new ProtectionEnforcementService();

      // Act
      const sections = service.extractProtectedSections(html);

      // Assert
      expect(sections).toHaveLength(0);
    });

    it("should handle nested protected tags", () => {
      // Arrange
      const html = `
        <!-- voice:protected -->
        <div>
          <p>Outer protected</p>
          <!-- voice:protected -->
          <p>Inner protected</p>
          <!-- /voice:protected -->
        </div>
        <!-- /voice:protected -->
      `;

      const service = new ProtectionEnforcementService();

      // Act
      const sections = service.extractProtectedSections(html);

      // Assert
      expect(sections.length).toBeGreaterThan(0);
      expect(sections[0]).toContain("Outer protected");
    });
  });

  describe("shouldPreserveContent", () => {
    it("should check both URL rules and inline tags", async () => {
      // Arrange
      const profileId = "profile-123";
      const url = "https://example.com/page";
      const html = `
        <p>Regular content</p>
        <!-- voice:protected -->
        <p>Protected section</p>
        <!-- /voice:protected -->
      `;

      vi.mocked(protectionRulesService.getActiveRules).mockResolvedValue([]);

      const service = new ProtectionEnforcementService();

      // Act
      const result = await service.shouldPreserveContent(profileId, url, html);

      // Assert
      expect(result.preserveEntirePage).toBe(false); // No URL rule
      expect(result.protectedSections).toHaveLength(1); // Has inline tag
      expect(result.protectedSections[0]).toContain("Protected section");
    });

    it("should return preserveEntirePage=true when URL matches page rule", async () => {
      // Arrange
      const profileId = "profile-123";
      const url = "https://example.com/about";

      vi.mocked(protectionRulesService.getActiveRules).mockResolvedValue([
        {
          id: "rule-1",
          profileId,
          ruleType: "page",
          target: "/about",
          reason: "Brand messaging",
          createdBy: "user-1",
          expiresAt: null,
          createdAt: new Date(),
        },
      ]);

      const service = new ProtectionEnforcementService();

      // Act
      const result = await service.shouldPreserveContent(profileId, url);

      // Assert
      expect(result.preserveEntirePage).toBe(true);
      expect(result.protectedSections).toHaveLength(0);
    });

    it("should handle wildcard URL patterns", async () => {
      // Arrange
      const profileId = "profile-123";
      const url = "https://example.com/blog/post-1";

      vi.mocked(protectionRulesService.getActiveRules).mockResolvedValue([
        {
          id: "rule-1",
          profileId,
          ruleType: "page",
          target: "/blog/*",
          reason: "All blog posts",
          createdBy: "user-1",
          expiresAt: null,
          createdAt: new Date(),
        },
      ]);

      const service = new ProtectionEnforcementService();

      // Act
      const result = await service.shouldPreserveContent(profileId, url);

      // Assert
      expect(result.preserveEntirePage).toBe(true);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(protectionEnforcementService).toBeInstanceOf(ProtectionEnforcementService);
    });
  });
});
