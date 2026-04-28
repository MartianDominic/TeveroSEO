/**
 * Tests for report_schedules Drizzle schema.
 * TDD RED phase: Write tests first, then implement.
 */
import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import {
  reportSchedules,
  type ReportScheduleSelect,
  type ReportScheduleInsert,
} from "./schedule-schema";

describe("schedule-schema", () => {
  describe("reportSchedules table", () => {
    it("should have table name 'report_schedules'", () => {
      expect(getTableName(reportSchedules)).toBe("report_schedules");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(reportSchedules);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("clientId");
      expect(columnNames).toContain("cronExpression");
      expect(columnNames).toContain("timezone");
      expect(columnNames).toContain("reportType");
      expect(columnNames).toContain("locale");
      expect(columnNames).toContain("recipients");
      expect(columnNames).toContain("enabled");
      expect(columnNames).toContain("lastRun");
      expect(columnNames).toContain("nextRun");
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });

    it("should have id as uuid primary key", () => {
      const columns = getTableColumns(reportSchedules);
      expect(columns.id.dataType).toBe("string");
      expect(columns.id.notNull).toBe(true);
    });

    it("should have clientId as non-null uuid", () => {
      const columns = getTableColumns(reportSchedules);
      expect(columns.clientId.dataType).toBe("string");
      expect(columns.clientId.notNull).toBe(true);
    });

    it("should have cronExpression as non-null text", () => {
      const columns = getTableColumns(reportSchedules);
      expect(columns.cronExpression.dataType).toBe("string");
      expect(columns.cronExpression.notNull).toBe(true);
    });

    it("should have timezone as non-null text", () => {
      const columns = getTableColumns(reportSchedules);
      expect(columns.timezone.dataType).toBe("string");
      expect(columns.timezone.notNull).toBe(true);
    });

    it("should have reportType as non-null text", () => {
      const columns = getTableColumns(reportSchedules);
      expect(columns.reportType.dataType).toBe("string");
      expect(columns.reportType.notNull).toBe(true);
    });

    it("should have locale with default 'en'", () => {
      const columns = getTableColumns(reportSchedules);
      expect(columns.locale.dataType).toBe("string");
      expect(columns.locale.notNull).toBe(true);
      expect(columns.locale.hasDefault).toBe(true);
    });

    it("should have recipients as jsonb", () => {
      const columns = getTableColumns(reportSchedules);
      expect(columns.recipients.dataType).toBe("json");
      expect(columns.recipients.notNull).toBe(true);
    });

    it("should have enabled with default true", () => {
      const columns = getTableColumns(reportSchedules);
      expect(columns.enabled.dataType).toBe("boolean");
      expect(columns.enabled.notNull).toBe(true);
      expect(columns.enabled.hasDefault).toBe(true);
    });

    it("should have lastRun as nullable timestamp", () => {
      const columns = getTableColumns(reportSchedules);
      expect(columns.lastRun.dataType).toBe("date");
      expect(columns.lastRun.notNull).toBe(false);
    });

    it("should have nextRun as non-null timestamp", () => {
      const columns = getTableColumns(reportSchedules);
      expect(columns.nextRun.dataType).toBe("date");
      expect(columns.nextRun.notNull).toBe(true);
    });
  });

  describe("Type exports", () => {
    it("should export ReportScheduleSelect type", () => {
      // Type-level test: if this compiles, the type exists
      const _typeCheck: ReportScheduleSelect = {
        id: "uuid",
        clientId: "uuid",
        cronExpression: "0 6 * * 1",
        timezone: "Europe/Vilnius",
        reportType: "monthly-seo",
        locale: "en",
        recipients: ["test@example.com"],
        enabled: true,
        lastRun: null,
        nextRun: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });

    it("should export ReportScheduleInsert type", () => {
      // Type-level test: if this compiles, the type exists
      // Insert type should allow optional fields with defaults
      const _typeCheck: ReportScheduleInsert = {
        clientId: "uuid",
        cronExpression: "0 6 * * 1",
        timezone: "Europe/Vilnius",
        reportType: "monthly-seo",
        recipients: ["test@example.com"],
        nextRun: new Date(),
        // id, locale, enabled, lastRun, createdAt, updatedAt should be optional
      };
      expect(_typeCheck).toBeDefined();
    });
  });
});
