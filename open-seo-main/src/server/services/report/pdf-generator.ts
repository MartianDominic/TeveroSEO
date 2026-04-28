/**
 * Puppeteer PDF generation service.
 *
 * Connects to an external Puppeteer container via WebSocket endpoint.
 * Converts HTML to PDF with a 60 second timeout.
 */
import puppeteer from "puppeteer";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "pdf-generator" });

const PDF_TIMEOUT_MS = 60_000; // 60 second timeout per CONTEXT.md

const PUPPETEER_WS_ENDPOINT = process.env.PUPPETEER_WS_ENDPOINT;

export interface PDFOptions {
  format?: "A4" | "Letter";
  printBackground?: boolean;
  margin?: { top: string; right: string; bottom: string; left: string };
}

const DEFAULT_OPTIONS: PDFOptions = {
  format: "A4",
  printBackground: true,
  margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
};

/**
 * Generate PDF from HTML string using Puppeteer.
 * Connects to external Puppeteer container via WebSocket.
 *
 * @param html - Full HTML document string
 * @param options - PDF generation options
 * @returns PDF as Buffer
 * @throws Error if generation times out or fails
 */
export async function generatePDF(
  html: string,
  options: PDFOptions = {},
): Promise<Buffer> {
  if (!PUPPETEER_WS_ENDPOINT) {
    throw new Error("PUPPETEER_WS_ENDPOINT not configured");
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  log.info("Connecting to Puppeteer", { endpoint: PUPPETEER_WS_ENDPOINT });

  const browser = await puppeteer.connect({
    browserWSEndpoint: PUPPETEER_WS_ENDPOINT,
  });

  const page = await browser.newPage();

  try {
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });

    // Load HTML content
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Generate PDF with timeout
    const pdfBuffer = await Promise.race([
      page.pdf({
        format: opts.format,
        printBackground: opts.printBackground,
        margin: opts.margin,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("PDF generation timed out")),
          PDF_TIMEOUT_MS,
        ),
      ),
    ]);

    log.info("PDF generated successfully", {
      sizeBytes: pdfBuffer.byteLength,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    // ALWAYS close page, even on timeout - prevents memory leaks
    await page.close().catch((err: Error) => {
      log.error("Failed to close page", err);
    });
    // Always disconnect (browser instance is shared/pooled)
    browser.disconnect();
  }
}
