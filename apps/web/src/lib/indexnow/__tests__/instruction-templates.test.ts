/**
 * IndexNow Instruction Templates Tests
 */

import { describe, it, expect } from "vitest";

import {
  generateKeyFileName,
  generateKeyFileContent,
  generateVerificationUrl,
  interpolateVariables,
  generateInstructions,
  getSupportedPlatforms,
  PLATFORM_INSTRUCTIONS,
  type Platform,
  type InstructionVariables,
} from "../instruction-templates";

describe("IndexNow Instruction Templates", () => {
  const testApiKey = "abc123def456";
  const testDomain = "example.com";
  const testVariables: InstructionVariables = {
    apiKey: testApiKey,
    domain: testDomain,
    fullDomain: `https://${testDomain}`,
    clientName: "Test Client",
  };

  // ============================================================================
  // File Generation
  // ============================================================================

  describe("generateKeyFileName", () => {
    it("should generate correct filename with .txt extension", () => {
      const fileName = generateKeyFileName(testApiKey);
      expect(fileName).toBe(`${testApiKey}.txt`);
    });

    it("should handle UUID-style keys", () => {
      const uuidKey = "550e8400-e29b-41d4-a716-446655440000";
      const fileName = generateKeyFileName(uuidKey);
      expect(fileName).toBe(`${uuidKey}.txt`);
    });
  });

  describe("generateKeyFileContent", () => {
    it("should return the API key as-is", () => {
      const content = generateKeyFileContent(testApiKey);
      expect(content).toBe(testApiKey);
    });

    it("should not add any extra characters", () => {
      const content = generateKeyFileContent(testApiKey);
      expect(content).not.toContain("\n");
      expect(content).not.toContain(" ");
      expect(content.length).toBe(testApiKey.length);
    });
  });

  describe("generateVerificationUrl", () => {
    it("should generate correct URL", () => {
      const url = generateVerificationUrl(testDomain, testApiKey);
      expect(url).toBe(`https://${testDomain}/${testApiKey}.txt`);
    });

    it("should handle domain with protocol", () => {
      const url = generateVerificationUrl(`https://${testDomain}`, testApiKey);
      expect(url).toBe(`https://${testDomain}/${testApiKey}.txt`);
    });

    it("should handle domain with trailing slash", () => {
      const url = generateVerificationUrl(`${testDomain}/`, testApiKey);
      expect(url).toBe(`https://${testDomain}/${testApiKey}.txt`);
    });

    it("should handle domain with http protocol", () => {
      const url = generateVerificationUrl(`http://${testDomain}`, testApiKey);
      expect(url).toBe(`https://${testDomain}/${testApiKey}.txt`);
    });
  });

  // ============================================================================
  // Variable Interpolation
  // ============================================================================

  describe("interpolateVariables", () => {
    it("should replace {apiKey} placeholder", () => {
      const template = "Key: {apiKey}";
      const result = interpolateVariables(template, testVariables);
      expect(result).toBe(`Key: ${testApiKey}`);
    });

    it("should replace {domain} placeholder", () => {
      const template = "Domain: {domain}";
      const result = interpolateVariables(template, testVariables);
      expect(result).toBe(`Domain: ${testDomain}`);
    });

    it("should replace {fullDomain} placeholder", () => {
      const template = "URL: {fullDomain}";
      const result = interpolateVariables(template, testVariables);
      expect(result).toBe(`URL: https://${testDomain}`);
    });

    it("should replace {clientName} placeholder", () => {
      const template = "Client: {clientName}";
      const result = interpolateVariables(template, testVariables);
      expect(result).toBe("Client: Test Client");
    });

    it("should handle multiple placeholders", () => {
      const template = "https://{domain}/{apiKey}.txt";
      const result = interpolateVariables(template, testVariables);
      expect(result).toBe(`https://${testDomain}/${testApiKey}.txt`);
    });

    it("should handle missing clientName gracefully", () => {
      const variablesNoClient: InstructionVariables = {
        ...testVariables,
        clientName: undefined,
      };
      const template = "Client: {clientName}";
      const result = interpolateVariables(template, variablesNoClient);
      expect(result).toBe("Client: ");
    });
  });

  // ============================================================================
  // Platform Instructions
  // ============================================================================

  describe("PLATFORM_INSTRUCTIONS", () => {
    const platforms: Platform[] = [
      "wordpress",
      "shopify",
      "wix",
      "squarespace",
      "webflow",
      "vercel",
      "netlify",
      "cpanel",
      "ftp",
      "cloudflare",
    ];

    it("should have instructions for all 10 platforms", () => {
      // 9 manual platforms + 1 cloudflare (zero-touch)
      expect(Object.keys(PLATFORM_INSTRUCTIONS)).toHaveLength(10);
    });

    platforms.forEach((platform) => {
      describe(`${platform} instructions`, () => {
        const instructions = PLATFORM_INSTRUCTIONS[platform];

        it("should have required fields", () => {
          expect(instructions.platform).toBe(platform);
          expect(instructions.nameKey).toBeDefined();
          expect(typeof instructions.estimatedMinutes).toBe("number");
          expect(["easy", "medium", "hard"]).toContain(instructions.difficulty);
          expect(typeof instructions.paidPlanRequired).toBe("boolean");
        });

        it("should have at least one prerequisite", () => {
          expect(instructions.prerequisiteKeys.length).toBeGreaterThan(0);
        });

        it("should have at least one step", () => {
          expect(instructions.steps.length).toBeGreaterThan(0);
        });

        it("should have numbered steps starting from 1", () => {
          instructions.steps.forEach((step, index) => {
            expect(step.number).toBe(index + 1);
          });
        });

        it("should have i18n keys for all step titles", () => {
          instructions.steps.forEach((step) => {
            expect(step.titleKey).toBeDefined();
            expect(step.titleKey.startsWith("indexnow.")).toBe(true);
          });
        });

        it("should have i18n keys for all step descriptions", () => {
          instructions.steps.forEach((step) => {
            expect(step.descriptionKey).toBeDefined();
            expect(step.descriptionKey.startsWith("indexnow.")).toBe(true);
          });
        });

        it("should have at least one verification step", () => {
          expect(instructions.verification.length).toBeGreaterThan(0);
        });

        it("should have common errors defined", () => {
          expect(Array.isArray(instructions.commonErrors)).toBe(true);
        });
      });
    });
  });

  // ============================================================================
  // Instruction Generation
  // ============================================================================

  describe("generateInstructions", () => {
    it("should generate instructions with interpolated steps", () => {
      const result = generateInstructions("wordpress", testVariables);

      expect(result.platform).toBe("wordpress");
      expect(result.interpolatedSteps).toBeDefined();
      expect(result.interpolatedSteps.length).toBe(result.steps.length);
    });

    it("should interpolate code snippets", () => {
      const result = generateInstructions("wordpress", testVariables);

      // Find a step with code
      const stepWithCode = result.interpolatedSteps.find((s) => s.code);
      if (stepWithCode) {
        expect(stepWithCode.code).toContain(testApiKey);
        expect(stepWithCode.code).not.toContain("{apiKey}");
      }
    });

    it("should interpolate verification URLs", () => {
      const result = generateInstructions("wordpress", testVariables);

      result.verification.forEach((v) => {
        expect(v.checkUrl).toContain(testDomain);
        expect(v.checkUrl).toContain(testApiKey);
        expect(v.checkUrl).not.toContain("{domain}");
        expect(v.checkUrl).not.toContain("{apiKey}");
      });
    });

    it("should throw for unknown platform", () => {
      expect(() => {
        generateInstructions("unknown" as Platform, testVariables);
      }).toThrow("Unknown platform: unknown");
    });
  });

  // ============================================================================
  // Platform List
  // ============================================================================

  describe("getSupportedPlatforms", () => {
    it("should return all supported platforms", () => {
      const platforms = getSupportedPlatforms();
      // 9 manual platforms + 1 cloudflare (zero-touch)
      expect(platforms).toHaveLength(10);
    });

    it("should return platform info with required fields", () => {
      const platforms = getSupportedPlatforms();

      platforms.forEach((p) => {
        expect(p.platform).toBeDefined();
        expect(p.nameKey).toBeDefined();
        expect(["easy", "medium", "hard"]).toContain(p.difficulty);
        expect(typeof p.estimatedMinutes).toBe("number");
        expect(typeof p.paidPlanRequired).toBe("boolean");
      });
    });

    it("should include expected platforms", () => {
      const platforms = getSupportedPlatforms();
      const platformNames = platforms.map((p) => p.platform);

      expect(platformNames).toContain("wordpress");
      expect(platformNames).toContain("shopify");
      expect(platformNames).toContain("vercel");
      expect(platformNames).toContain("netlify");
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle special characters in API key", () => {
      const specialKey = "abc-123_def";
      const fileName = generateKeyFileName(specialKey);
      expect(fileName).toBe(`${specialKey}.txt`);
    });

    it("should handle subdomains", () => {
      const subdomain = "blog.example.com";
      const url = generateVerificationUrl(subdomain, testApiKey);
      expect(url).toBe(`https://${subdomain}/${testApiKey}.txt`);
    });

    it("should handle international domains", () => {
      const intlDomain = "example.co.uk";
      const url = generateVerificationUrl(intlDomain, testApiKey);
      expect(url).toBe(`https://${intlDomain}/${testApiKey}.txt`);
    });

    it("should preserve step properties during interpolation", () => {
      const result = generateInstructions("wordpress", testVariables);

      result.interpolatedSteps.forEach((step, index) => {
        const original = PLATFORM_INSTRUCTIONS.wordpress.steps[index];
        expect(step.number).toBe(original.number);
        expect(step.titleKey).toBe(original.titleKey);
        expect(step.screenshot).toBe(original.screenshot);
        expect(step.hasCopyButton).toBe(original.hasCopyButton);
      });
    });
  });
});
