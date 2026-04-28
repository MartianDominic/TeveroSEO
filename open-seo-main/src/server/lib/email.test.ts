/**
 * Tests for email service with Resend integration.
 *
 * These tests verify:
 * - PDF attachment when file < 10MB
 * - Download link email when file >= 10MB
 * - API key validation
 * - Error handling for Resend API failures
 * - Multiple recipient handling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

// Mock resend - use hoisted variable
const mockSend = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

// Import after mocks are set up
import { sendReportEmail, MAX_ATTACHMENT_SIZE } from "./email";
import { stat, readFile } from "node:fs/promises";

describe("sendReportEmail", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = "re_test_key_12345";
    process.env.EMAIL_FROM = "reports@tevero.io";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("sends email with PDF attachment when file < 10MB", async () => {
    // Arrange
    const smallFileSize = 5 * 1024 * 1024; // 5MB
    vi.mocked(stat).mockResolvedValue({ size: smallFileSize } as never);
    vi.mocked(readFile).mockResolvedValue(Buffer.from("PDF content"));
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });

    // Act
    await sendReportEmail({
      to: ["client@example.com"],
      subject: "Monthly SEO Report",
      html: "<h1>Report</h1>",
      pdfPath: "/data/reports/client1/2026-04-01_monthly-seo.pdf",
      downloadUrl: "https://app.tevero.io/reports/123/download",
    });

    // Assert
    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.attachments).toBeDefined();
    expect(callArgs.attachments).toHaveLength(1);
    expect(callArgs.attachments[0].filename).toBe(
      "2026-04-01_monthly-seo.pdf",
    );
    expect(callArgs.to).toEqual(["client@example.com"]);
    expect(callArgs.subject).toBe("Monthly SEO Report");
  });

  it("sends email with download link (no attachment) when file >= 10MB", async () => {
    // Arrange
    const largeFileSize = 15 * 1024 * 1024; // 15MB
    vi.mocked(stat).mockResolvedValue({ size: largeFileSize } as never);
    mockSend.mockResolvedValue({ data: { id: "email-456" }, error: null });

    // Act
    await sendReportEmail({
      to: ["client@example.com"],
      subject: "Monthly SEO Report",
      html: "<h1>Report</h1>",
      pdfPath: "/data/reports/client1/2026-04-01_monthly-seo.pdf",
      downloadUrl: "https://app.tevero.io/reports/123/download",
    });

    // Assert
    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.attachments).toBeUndefined();
    // readFile should NOT be called for large files
    expect(readFile).not.toHaveBeenCalled();
  });

  it("throws error when RESEND_API_KEY is not configured", async () => {
    // Arrange
    delete process.env.RESEND_API_KEY;

    // Act & Assert
    await expect(
      sendReportEmail({
        to: ["client@example.com"],
        subject: "Test Report",
        html: "<h1>Report</h1>",
        pdfPath: "/data/reports/test.pdf",
      }),
    ).rejects.toThrow("RESEND_API_KEY not configured");
  });

  it("throws error when Resend API returns an error", async () => {
    // Arrange
    const smallFileSize = 1 * 1024 * 1024; // 1MB
    vi.mocked(stat).mockResolvedValue({ size: smallFileSize } as never);
    vi.mocked(readFile).mockResolvedValue(Buffer.from("PDF content"));
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Rate limit exceeded" },
    });

    // Act & Assert
    await expect(
      sendReportEmail({
        to: ["client@example.com"],
        subject: "Test Report",
        html: "<h1>Report</h1>",
        pdfPath: "/data/reports/test.pdf",
      }),
    ).rejects.toThrow("Email delivery failed: Rate limit exceeded");
  });

  it("sends to multiple recipients in a single call", async () => {
    // Arrange
    const smallFileSize = 2 * 1024 * 1024; // 2MB
    vi.mocked(stat).mockResolvedValue({ size: smallFileSize } as never);
    vi.mocked(readFile).mockResolvedValue(Buffer.from("PDF content"));
    mockSend.mockResolvedValue({ data: { id: "email-789" }, error: null });

    const recipients = [
      "client1@example.com",
      "client2@example.com",
      "manager@example.com",
    ];

    // Act
    await sendReportEmail({
      to: recipients,
      subject: "Team Report",
      html: "<h1>Report</h1>",
      pdfPath: "/data/reports/team-report.pdf",
    });

    // Assert
    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toEqual(recipients);
  });

  it("uses default FROM address when EMAIL_FROM is not set", async () => {
    // Arrange
    delete process.env.EMAIL_FROM;
    const smallFileSize = 1 * 1024 * 1024;
    vi.mocked(stat).mockResolvedValue({ size: smallFileSize } as never);
    vi.mocked(readFile).mockResolvedValue(Buffer.from("PDF"));
    mockSend.mockResolvedValue({ data: { id: "email-default" }, error: null });

    // Act
    await sendReportEmail({
      to: ["client@example.com"],
      subject: "Report",
      html: "<h1>Report</h1>",
      pdfPath: "/data/reports/test.pdf",
    });

    // Assert
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.from).toBe("reports@tevero.io");
  });

  it("exports MAX_ATTACHMENT_SIZE constant", () => {
    expect(MAX_ATTACHMENT_SIZE).toBe(10 * 1024 * 1024);
  });
});
