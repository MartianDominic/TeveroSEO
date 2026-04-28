/**
 * Prospect PDF Generation Service.
 * Phase 30-05: Analysis PDF Export
 *
 * Generates PDF reports from prospect analysis data.
 * Uses the existing Puppeteer PDF infrastructure.
 *
 * Memory safety: PDF generation includes size limits to prevent
 * unbounded memory growth from large reports.
 */
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/index";
import { prospects, prospectAnalyses } from "@/db/prospect-schema";
import { generatePDF } from "@/server/services/report/pdf-generator";
import { renderProspectReportToHTML } from "./prospect-report-renderer";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ProspectPdfService" });

// Maximum PDF size in bytes (10MB)
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

export interface GeneratePdfResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export const ProspectPdfService = {
  /**
   * Generate a PDF report for a prospect analysis.
   *
   * @param prospectId - The prospect ID
   * @param analysisId - Optional specific analysis ID. If not provided, uses the latest completed analysis.
   * @param workspaceId - The workspace ID for authorization
   * @returns PDF buffer with metadata
   * @throws NOT_FOUND if prospect or analysis doesn't exist
   * @throws BAD_REQUEST if no completed analysis available
   */
  async generateProspectPDF(
    prospectId: string,
    analysisId?: string,
    workspaceId?: string,
  ): Promise<GeneratePdfResult> {
    log.info("Generating prospect PDF", { prospectId, analysisId, workspaceId });

    // Fetch prospect with workspace validation if provided
    let whereClause = eq(prospects.id, prospectId);
    if (workspaceId) {
      whereClause = and(
        eq(prospects.id, prospectId),
        eq(prospects.workspaceId, workspaceId),
      )!;
    }

    const [prospect] = await db
      .select()
      .from(prospects)
      .where(whereClause)
      .limit(1);

    if (!prospect) {
      throw new AppError("NOT_FOUND", `Prospect not found: ${prospectId}`);
    }

    // Fetch analysis
    let analysis;
    if (analysisId) {
      // Fetch specific analysis
      const [foundAnalysis] = await db
        .select()
        .from(prospectAnalyses)
        .where(
          and(
            eq(prospectAnalyses.id, analysisId),
            eq(prospectAnalyses.prospectId, prospectId),
          ),
        )
        .limit(1);

      if (!foundAnalysis) {
        throw new AppError(
          "NOT_FOUND",
          `Analysis not found: ${analysisId} for prospect ${prospectId}`,
        );
      }
      analysis = foundAnalysis;
    } else {
      // Fetch latest completed analysis
      const [latestAnalysis] = await db
        .select()
        .from(prospectAnalyses)
        .where(
          and(
            eq(prospectAnalyses.prospectId, prospectId),
            eq(prospectAnalyses.status, "completed"),
          ),
        )
        .orderBy(desc(prospectAnalyses.completedAt))
        .limit(1);

      if (!latestAnalysis) {
        throw new AppError(
          "VALIDATION_ERROR",
          `No completed analysis available for prospect: ${prospectId}`,
        );
      }
      analysis = latestAnalysis;
    }

    // Validate analysis is completed
    if (analysis.status !== "completed") {
      throw new AppError(
        "VALIDATION_ERROR",
        `Analysis is not completed (status: ${analysis.status})`,
      );
    }

    // Generate HTML from analysis data
    const generatedAt = new Date().toISOString();
    const html = renderProspectReportToHTML({
      prospect,
      analysis,
      generatedAt,
    });

    // Generate PDF using Puppeteer
    const pdfBuffer = await generatePDF(html, {
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
    });

    // Validate PDF size to prevent memory issues
    if (pdfBuffer.length > MAX_PDF_SIZE_BYTES) {
      log.warn("PDF exceeds maximum size limit", {
        prospectId,
        sizeBytes: pdfBuffer.length,
        maxSizeBytes: MAX_PDF_SIZE_BYTES,
      });
      throw new AppError(
        "VALIDATION_ERROR",
        `Generated PDF exceeds maximum size of ${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }

    // Generate filename
    const sanitizedDomain = prospect.domain
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .toLowerCase();
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `seo-report-${sanitizedDomain}-${dateStr}.pdf`;

    log.info("PDF generated successfully", {
      prospectId,
      analysisId: analysis.id,
      sizeBytes: pdfBuffer.length,
      filename,
    });

    return {
      buffer: pdfBuffer,
      filename,
      contentType: "application/pdf",
    };
  },

  /**
   * Check if a prospect has a completed analysis available for PDF generation.
   *
   * @param prospectId - The prospect ID
   * @returns True if PDF can be generated
   */
  async canGeneratePDF(prospectId: string): Promise<boolean> {
    const [analysis] = await db
      .select({ id: prospectAnalyses.id })
      .from(prospectAnalyses)
      .where(
        and(
          eq(prospectAnalyses.prospectId, prospectId),
          eq(prospectAnalyses.status, "completed"),
        ),
      )
      .limit(1);

    return analysis !== undefined;
  },
};
