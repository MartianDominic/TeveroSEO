/**
 * Contract PDF generator.
 * Phase 48-01: Contract Generation
 *
 * Generates contract PDFs using pdf-lib following the pattern
 * from proposals/signing/pdf.ts.
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { ContractContent } from "@/db/contract-schema";

export interface ContractPdfInput {
  title: string;
  content: ContractContent;
  workspaceName: string;
  clientName: string;
  createdAt: Date;
}

/**
 * Wraps text to fit within maxChars per line.
 * Simple word-based wrapping algorithm.
 */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxChars) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Generate a contract PDF from contract content.
 * Creates a professional-looking multi-page document with:
 * - Header with title and date
 * - Content sections
 * - Terms and conditions
 * - Signature placeholders
 */
export async function generateContractPdf(input: ContractPdfInput): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page setup: A4 size (595.28 x 841.89 points)
  let page = pdfDoc.addPage([595.28, 841.89]);
  let yPosition = 800;
  const margin = 50;
  const lineHeight = 18;
  const maxLineChars = 80;

  // Header with title
  page.drawText(input.title, {
    x: margin,
    y: yPosition,
    size: 24,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 40;

  // Metadata line
  page.drawText(`Date: ${input.createdAt.toLocaleDateString()}`, {
    x: margin,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
  yPosition -= 30;

  // Sections
  for (const section of input.content.sections) {
    // Check if need new page
    if (yPosition < 100) {
      page = pdfDoc.addPage([595.28, 841.89]);
      yPosition = 800;
    }

    // Section title
    page.drawText(section.title, {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 25;

    // Section body (wrap text at ~80 chars)
    const lines = wrapText(section.body, maxLineChars);
    for (const line of lines) {
      if (yPosition < 100) {
        page = pdfDoc.addPage([595.28, 841.89]);
        yPosition = 800;
      }
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: 11,
        font: helvetica,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= lineHeight;
    }
    yPosition -= 15; // Section spacing
  }

  // Terms section
  if (yPosition < 200) {
    page = pdfDoc.addPage([595.28, 841.89]);
    yPosition = 800;
  }
  page.drawText("Terms and Conditions", {
    x: margin,
    y: yPosition,
    size: 14,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 25;

  const termLines = wrapText(input.content.terms, maxLineChars);
  for (const line of termLines) {
    if (yPosition < 100) {
      page = pdfDoc.addPage([595.28, 841.89]);
      yPosition = 800;
    }
    page.drawText(line, {
      x: margin,
      y: yPosition,
      size: 10,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= lineHeight;
  }

  // Signature placeholders
  if (yPosition < 200) {
    page = pdfDoc.addPage([595.28, 841.89]);
    yPosition = 800;
  }
  yPosition -= 40;
  page.drawText("Signatures", {
    x: margin,
    y: yPosition,
    size: 14,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 30;

  for (const sig of input.content.signatures) {
    const sigName = sig.name ? `${sig.role} (${sig.name})` : sig.role;
    page.drawText(`${sigName}: ____________________`, {
      x: margin,
      y: yPosition,
      size: 11,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 40;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
