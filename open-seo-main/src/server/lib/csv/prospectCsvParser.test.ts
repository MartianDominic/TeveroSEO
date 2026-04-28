/**
 * Tests for CSV validation schema and parser.
 * Phase 30.5: CSV Import for Prospects
 *
 * TDD RED phase: Tests written first to define expected behavior.
 */
import { describe, it, expect } from "vitest";
import {
  csvRowSchema,
  validateCsvRows,
  type CsvRow,
  type ValidationResult,
} from "./prospectCsvSchema";
import { parseProspectCsv, type ParseResult } from "./prospectCsvParser";

describe("csvRowSchema", () => {
  it("validates domain as required, rejects empty", () => {
    // Valid domain passes
    const validResult = csvRowSchema.safeParse({ domain: "example.com" });
    expect(validResult.success).toBe(true);

    // Empty domain fails
    const emptyResult = csvRowSchema.safeParse({ domain: "" });
    expect(emptyResult.success).toBe(false);

    // Missing domain fails
    const missingResult = csvRowSchema.safeParse({});
    expect(missingResult.success).toBe(false);
  });

  it("accepts valid email, rejects malformed email", () => {
    // Valid email passes
    const validEmail = csvRowSchema.safeParse({
      domain: "example.com",
      contactEmail: "test@example.com",
    });
    expect(validEmail.success).toBe(true);

    // Empty email is allowed (optional)
    const emptyEmail = csvRowSchema.safeParse({
      domain: "example.com",
      contactEmail: "",
    });
    expect(emptyEmail.success).toBe(true);

    // Malformed email fails
    const badEmail = csvRowSchema.safeParse({
      domain: "example.com",
      contactEmail: "not-an-email",
    });
    expect(badEmail.success).toBe(false);

    // Missing @ symbol fails
    const noAtEmail = csvRowSchema.safeParse({
      domain: "example.com",
      contactEmail: "testexample.com",
    });
    expect(noAtEmail.success).toBe(false);
  });

  it("transforms domain (strips protocol, www, path)", () => {
    // With https protocol
    const https = csvRowSchema.parse({ domain: "https://example.com" });
    expect(https.domain).toBe("example.com");

    // With http protocol
    const http = csvRowSchema.parse({ domain: "http://example.com" });
    expect(http.domain).toBe("example.com");

    // With www prefix
    const www = csvRowSchema.parse({ domain: "www.example.com" });
    expect(www.domain).toBe("example.com");

    // With path
    const withPath = csvRowSchema.parse({ domain: "example.com/page/subpage" });
    expect(withPath.domain).toBe("example.com");

    // With port
    const withPort = csvRowSchema.parse({ domain: "example.com:8080" });
    expect(withPort.domain).toBe("example.com");

    // Full URL with everything
    const full = csvRowSchema.parse({
      domain: "https://www.example.com:443/path?query=1",
    });
    expect(full.domain).toBe("example.com");

    // Uppercase becomes lowercase
    const uppercase = csvRowSchema.parse({ domain: "EXAMPLE.COM" });
    expect(uppercase.domain).toBe("example.com");
  });
});

describe("validateCsvRows", () => {
  it("returns { valid: CsvRow[], invalid: { row, errors }[] }", () => {
    const rows = [
      { domain: "example.com", companyName: "Example Inc" },
      { domain: "", companyName: "No Domain Co" },
      { domain: "valid.org", contactEmail: "bad-email" },
    ];

    const result = validateCsvRows(rows);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].domain).toBe("example.com");

    expect(result.invalid).toHaveLength(2);
    expect(result.invalid[0].rowIndex).toBe(2); // 1-indexed
    expect(result.invalid[0].errors.length).toBeGreaterThan(0);
    expect(result.invalid[1].rowIndex).toBe(3);
    expect(result.invalid[1].errors.some((e) => e.includes("email"))).toBe(
      true
    );
  });

  it("deduplicates by domain (keeps first occurrence)", () => {
    const rows = [
      { domain: "example.com", companyName: "First" },
      { domain: "example.com", companyName: "Second" },
      { domain: "https://example.com", companyName: "Third with protocol" },
      { domain: "other.com", companyName: "Different" },
    ];

    const result = validateCsvRows(rows);

    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].companyName).toBe("First"); // First occurrence kept
    expect(result.valid[1].domain).toBe("other.com");
  });
});

describe("CSV injection sanitization", () => {
  it("sanitizes formula injection chars (=, +, -, @) with single quote prefix", () => {
    const rows = [
      { domain: "example.com", companyName: "=HYPERLINK('http://evil.com')" },
      { domain: "test.com", companyName: "+1-800-555-1234" },
      { domain: "safe.com", contactName: "-SUM(A1:A10)" },
      { domain: "mail.com", notes: "@mention someone" },
      { domain: "normal.com", companyName: "Normal Company" },
    ];

    const result = validateCsvRows(rows);

    expect(result.valid).toHaveLength(5);

    // Dangerous chars should be prefixed with single quote
    expect(result.valid[0].companyName).toBe(
      "'=HYPERLINK('http://evil.com')"
    );
    expect(result.valid[1].companyName).toBe("'+1-800-555-1234");
    expect(result.valid[2].contactName).toBe("'-SUM(A1:A10)");
    expect(result.valid[3].notes).toBe("'@mention someone");

    // Normal values unchanged
    expect(result.valid[4].companyName).toBe("Normal Company");
  });
});

describe("parseProspectCsv", () => {
  it("parses CSV content and returns ParseResult with totalRows and duplicatesRemoved", () => {
    const csv = `domain,companyName,contactEmail
example.com,Example Inc,test@example.com
other.com,Other LLC,
example.com,Duplicate,dupe@example.com`;

    const result = parseProspectCsv(csv);

    expect(result.totalRows).toBe(3);
    expect(result.valid).toHaveLength(2); // example.com and other.com
    expect(result.duplicatesRemoved).toBe(1);
  });

  it("normalizes common header variations", () => {
    const csv = `domain,company,email,name
example.com,Example Inc,test@example.com,John Doe`;

    const result = parseProspectCsv(csv);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].companyName).toBe("Example Inc");
    expect(result.valid[0].contactEmail).toBe("test@example.com");
    expect(result.valid[0].contactName).toBe("John Doe");
  });

  it("handles company_name, contact_email, contact_name variations", () => {
    const csv = `domain,company_name,contact_email,contact_name
example.com,Example Inc,test@example.com,Jane Doe`;

    const result = parseProspectCsv(csv);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].companyName).toBe("Example Inc");
    expect(result.valid[0].contactEmail).toBe("test@example.com");
    expect(result.valid[0].contactName).toBe("Jane Doe");
  });

  it("skips empty lines", () => {
    const csv = `domain,companyName
example.com,Example

other.com,Other

`;

    const result = parseProspectCsv(csv);
    expect(result.totalRows).toBe(2);
    expect(result.valid).toHaveLength(2);
  });
});
