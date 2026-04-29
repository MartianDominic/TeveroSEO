/**
 * Protection Rules Service
 * Phase 37-03: Voice Profile Management
 *
 * CRUD for content protection rules with bulk CSV import.
 * Rules protect specific pages, sections, or text patterns from SEO changes.
 *
 * Security:
 * - T-37-06: Validates regex patterns to prevent ReDoS
 * - T-37-07: Requires created_by for audit trail
 * - T-37-08: Limits CSV import to 500 rows max
 */
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  contentProtectionRules,
  type ContentProtectionRuleSelect,
  type ProtectionRuleType,
  PROTECTION_RULE_TYPES,
} from "@/db/voice-schema";

/**
 * Input for creating a protection rule.
 */
export interface CreateRuleInput {
  ruleType: ProtectionRuleType;
  target: string;
  reason: string;
  createdBy: string;
  expiresAt?: Date;
}

/**
 * Result from bulk CSV import.
 */
export interface BulkImportResult {
  imported: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Maximum rows allowed in CSV import (T-37-08 DoS mitigation).
 */
const MAX_CSV_ROWS = 500;

/**
 * Service for managing content protection rules.
 *
 * @example
 * ```typescript
 * // Create a page protection rule
 * const rule = await protectionRulesService.create("profile-123", {
 *   ruleType: "page",
 *   target: "https://example.com/about",
 *   reason: "Brand messaging page",
 *   createdBy: "user-1",
 * });
 *
 * // Bulk import from CSV
 * const result = await protectionRulesService.bulkImportCsv(
 *   "profile-123",
 *   csvContent,
 *   "user-1"
 * );
 * ```
 */
export class ProtectionRulesService {
  /**
   * Create a new protection rule.
   *
   * @param profileId - Voice profile ID
   * @param input - Rule details
   * @returns Created rule
   * @throws Error if target validation fails
   */
  async create(
    profileId: string,
    input: CreateRuleInput
  ): Promise<ContentProtectionRuleSelect> {
    // Validate target based on rule type
    this.validateTarget(input.ruleType, input.target);

    const id = nanoid();
    const now = new Date();

    const [rule] = await db
      .insert(contentProtectionRules)
      .values({
        id,
        profileId,
        ruleType: input.ruleType,
        target: input.target,
        reason: input.reason,
        createdBy: input.createdBy,
        expiresAt: input.expiresAt ?? null,
        createdAt: now,
      })
      .returning();

    return rule;
  }

  /**
   * Validate target value based on rule type.
   *
   * @param ruleType - Type of rule (page, section, pattern)
   * @param target - Target value to validate
   * @throws Error if validation fails
   */
  validateTarget(ruleType: string, target: string): void {
    switch (ruleType) {
      case "page":
        // Accept full URLs or relative paths
        if (!target || target.trim() === "") {
          throw new Error("Invalid URL or path: target cannot be empty");
        }
        // If it looks like a URL, validate it
        if (target.startsWith("http://") || target.startsWith("https://")) {
          try {
            new URL(target);
          } catch {
            throw new Error("Invalid URL");
          }
        }
        // Relative paths starting with / are valid
        break;

      case "section":
        // Validate CSS selector syntax
        // We can't use document.querySelector in Node.js, so we do basic validation
        if (!target || target.trim() === "") {
          throw new Error("Invalid CSS selector: target cannot be empty");
        }
        // Basic CSS selector validation - check for obvious errors
        if (/[{}]/.test(target)) {
          throw new Error("Invalid CSS selector: contains invalid characters");
        }
        break;

      case "pattern":
        // Validate regex pattern
        try {
          new RegExp(target);
          // Check for ReDoS patterns (T-37-06)
          this.checkReDoS(target);
        } catch (e) {
          throw new Error(
            `Invalid regex pattern: ${e instanceof Error ? e.message : "unknown error"}`
          );
        }
        break;

      default:
        throw new Error(`Invalid rule type: ${ruleType}`);
    }
  }

  /**
   * Check for ReDoS (Regular Expression Denial of Service) patterns.
   * Rejects patterns with nested quantifiers that could cause catastrophic backtracking.
   *
   * @param pattern - Regex pattern to check
   * @throws Error if pattern is potentially dangerous
   */
  private checkReDoS(pattern: string): void {
    // Detect nested quantifiers: (a+)+ or (a*)* or similar
    const nestedQuantifiers = /(\([^)]*[+*]\)[+*])|([+*][+*])/;
    if (nestedQuantifiers.test(pattern)) {
      throw new Error("Regex pattern rejected: potential ReDoS vulnerability");
    }
  }

  /**
   * Get a single rule by ID.
   *
   * @param ruleId - Rule ID
   * @returns Rule if found, null otherwise
   */
  async getById(ruleId: string): Promise<ContentProtectionRuleSelect | null> {
    const [rule] = await db
      .select()
      .from(contentProtectionRules)
      .where(eq(contentProtectionRules.id, ruleId))
      .limit(1);

    return rule ?? null;
  }

  /**
   * Get all rules for a profile.
   *
   * @param profileId - Voice profile ID
   * @returns All rules (including expired)
   */
  async getByProfileId(
    profileId: string
  ): Promise<ContentProtectionRuleSelect[]> {
    return db
      .select()
      .from(contentProtectionRules)
      .where(eq(contentProtectionRules.profileId, profileId));
  }

  /**
   * Get only active (non-expired) rules for a profile.
   *
   * @param profileId - Voice profile ID
   * @returns Rules that are not expired
   */
  async getActiveRules(
    profileId: string
  ): Promise<ContentProtectionRuleSelect[]> {
    return db
      .select()
      .from(contentProtectionRules)
      .where(
        and(
          eq(contentProtectionRules.profileId, profileId),
          or(
            isNull(contentProtectionRules.expiresAt),
            gt(contentProtectionRules.expiresAt, new Date())
          )
        )
      );
  }

  /**
   * Delete a protection rule.
   *
   * @param ruleId - Rule ID to delete
   */
  async delete(ruleId: string): Promise<void> {
    await db
      .delete(contentProtectionRules)
      .where(eq(contentProtectionRules.id, ruleId));
  }

  /**
   * Bulk import rules from CSV content.
   * CSV format: rule_type,target,reason,expires_at
   *
   * @param profileId - Voice profile ID
   * @param csvContent - CSV string content
   * @param userId - User performing the import (for audit)
   * @returns Import result with count and errors
   * @throws Error if CSV exceeds 500 rows (T-37-08)
   */
  async bulkImportCsv(
    profileId: string,
    csvContent: string,
    userId: string
  ): Promise<BulkImportResult> {
    const lines = csvContent.trim().split("\n");

    // Bounds check: ensure CSV has at least header row
    if (lines.length === 0) {
      throw new Error("CSV content is empty");
    }

    const header = lines[0];
    const dataLines = lines.slice(1);

    // T-37-08: Limit CSV rows to prevent DoS
    if (dataLines.length > MAX_CSV_ROWS) {
      throw new Error(`CSV exceeds maximum ${MAX_CSV_ROWS} rows`);
    }

    // Validate header
    const expectedHeader = "rule_type,target,reason,expires_at";
    if (header.trim().toLowerCase() !== expectedHeader) {
      throw new Error(
        `Invalid CSV header. Expected: ${expectedHeader}`
      );
    }

    const result: BulkImportResult = {
      imported: 0,
      errors: [],
    };

    for (let i = 0; i < dataLines.length; i++) {
      const rowNumber = i + 2; // 1-indexed, +1 for header
      const line = dataLines[i].trim();

      if (!line) continue; // Skip empty lines

      try {
        const parsed = this.parseCsvLine(line);

        // Validate rule_type
        if (!PROTECTION_RULE_TYPES.includes(parsed.ruleType as ProtectionRuleType)) {
          throw new Error(`Invalid rule_type: ${parsed.ruleType}`);
        }

        // Create the rule
        await this.create(profileId, {
          ruleType: parsed.ruleType as ProtectionRuleType,
          target: parsed.target,
          reason: parsed.reason,
          createdBy: userId,
          expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
        });

        result.imported++;
      } catch (e) {
        result.errors.push({
          row: rowNumber,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return result;
  }

  /**
   * Parse a single CSV line into fields.
   * Handles basic CSV parsing (no quoted fields with commas).
   */
  private parseCsvLine(line: string): {
    ruleType: string;
    target: string;
    reason: string;
    expiresAt: string;
  } {
    const parts = line.split(",");

    if (parts.length < 3) {
      throw new Error("Invalid CSV row: expected at least 3 columns");
    }

    return {
      ruleType: parts[0].trim(),
      target: parts[1].trim(),
      reason: parts[2].trim(),
      expiresAt: parts[3]?.trim() || "",
    };
  }
}

/**
 * Singleton instance for use in server functions.
 */
export const protectionRulesService = new ProtectionRulesService();
