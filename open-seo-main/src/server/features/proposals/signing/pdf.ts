/**
 * Contract PDF generation for proposal signing.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * Generates a legally binding contract PDF from proposal content
 * for digital signing via Smart-ID or Mobile-ID.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createHash } from "crypto";
import type { ProposalSelect, ProposalContent, BrandConfig } from "@/db/proposal-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ProposalPdf" });

/**
 * Contract sections included in the PDF.
 */
export const CONTRACT_SECTIONS = [
  "header",
  "parties",
  "services",
  "pricing",
  "terms",
  "signatures",
] as const;

/**
 * Formats amount from cents to display currency.
 *
 * @param cents - Amount in cents
 * @param currency - Currency code (EUR, USD, etc.)
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(250000, "EUR") // "2 500,00 EUR"
 */
export function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;

  if (currency === "EUR") {
    // Lithuanian/European format: 2 500,00 EUR
    return (
      amount.toLocaleString("lt-LT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " EUR"
    );
  }

  if (currency === "USD") {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }

  // Fallback for other currencies
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Formats date in ISO format (YYYY-MM-DD).
 *
 * @param date - Date to format
 * @returns Formatted date string or "-" if null
 */
export function formatDate(date: Date | null): string {
  if (!date) return "-";
  return date.toISOString().split("T")[0];
}

/**
 * Calculates SHA256 hash of a PDF buffer.
 * Used for Dokobit signing verification.
 *
 * @param pdfBuffer - PDF document as Buffer
 * @returns SHA256 hash as hex string (64 characters)
 */
export function calculateDocumentHash(pdfBuffer: Buffer): string {
  return createHash("sha256").update(pdfBuffer).digest("hex");
}

/**
 * Generates a contract PDF from proposal data.
 *
 * The PDF includes:
 * - Contract header with date and proposal ID
 * - Parties section (service provider details)
 * - Services section (SEO services included)
 * - Pricing section (setup fee, monthly fee)
 * - Terms and conditions
 * - Signature placeholders
 *
 * @param proposal - Proposal record with content
 * @returns PDF document as Buffer
 *
 * @example
 * const pdfBuffer = await generateContractPdf(proposal);
 * const hash = calculateDocumentHash(pdfBuffer);
 */
export async function generateContractPdf(
  proposal: ProposalSelect
): Promise<Buffer> {
  log.info("Generating contract PDF", { proposalId: proposal.id });

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // A4 size in points: 595.28 x 841.89
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const lineHeight = 14;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const content = proposal.content as ProposalContent;
  const currency = proposal.currency ?? "EUR";
  const setupFee = proposal.setupFeeCents ?? 0;
  const monthlyFee = proposal.monthlyFeeCents ?? 0;

  // Helper to add text
  const addText = (
    text: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: { r: number; g: number; b: number };
      indent?: number;
    } = {}
  ) => {
    const { size = 10, bold = false, color = { r: 0, g: 0, b: 0 }, indent = 0 } = options;
    const selectedFont = bold ? boldFont : font;

    // Check if we need a new page
    if (y < margin + lineHeight * 2) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    page.drawText(text, {
      x: margin + indent,
      y,
      size,
      font: selectedFont,
      color: rgb(color.r, color.g, color.b),
    });
    y -= lineHeight * (size / 10);
  };

  const addEmptyLine = (count = 1) => {
    y -= lineHeight * count;
  };

  // ============ HEADER ============
  addText("SEO PASLAUGU SUTARTIS", { size: 16, bold: true });
  addEmptyLine();
  addText(`Sutarties Nr.: ${proposal.id}`, { size: 9 });
  addText(`Data: ${formatDate(new Date())}`, { size: 9 });
  addEmptyLine(2);

  // ============ PARTIES ============
  addText("1. SALYS", { size: 12, bold: true });
  addEmptyLine();
  addText("1.1. Paslaugu teikejas:", { bold: true, indent: 10 });
  addText("     [Imones pavadinimas]", { indent: 10 });
  addText("     Imones kodas: [Imones kodas]", { indent: 10 });
  addText("     Adresas: [Imones adresas]", { indent: 10 });
  addEmptyLine();
  addText("1.2. Uzsakovas:", { bold: true, indent: 10 });
  addText(`     Domenas: ${content.hero?.headline ?? "N/A"}`, { indent: 10 });
  addEmptyLine(2);

  // ============ SERVICES ============
  addText("2. PASLAUGOS", { size: 12, bold: true });
  addEmptyLine();
  addText("2.1. Paslaugu teikejas isipareigoja teikti sias SEO paslaugas:", { indent: 10 });
  addEmptyLine();

  const inclusions = content.investment?.inclusions ?? [];
  inclusions.forEach((inclusion, index) => {
    addText(`     ${index + 1}. ${inclusion}`, { indent: 10 });
  });
  addEmptyLine(2);

  // ============ PRICING ============
  addText("3. KAINA IR ATSISKAITYMO TVARKA", { size: 12, bold: true });
  addEmptyLine();
  addText(`3.1. Pradinis mokestis (setup fee): ${formatCurrency(setupFee, currency)}`, {
    indent: 10,
  });
  addText(`3.2. Menesinis mokestis: ${formatCurrency(monthlyFee, currency)}`, {
    indent: 10,
  });
  addEmptyLine();
  addText("3.3. Atsiskaitymas atliekamas per 14 dienu nuo saskaitos gavimo.", {
    indent: 10,
  });
  addEmptyLine(2);

  // ============ TERMS ============
  addText("4. SUTARTIES GALIOJIMAS", { size: 12, bold: true });
  addEmptyLine();
  addText("4.1. Si sutartis isigalioja nuo pasirasymo dienos.", { indent: 10 });
  addText("4.2. Sutartis sudaroma 12 menesiu laikotarpiui.", { indent: 10 });
  addText(
    "4.3. Sutartis gali buti nutraukta abieju saliu susitarimu arba vienasaliskai,",
    { indent: 10 }
  );
  addText("     ispejus kita sali pries 30 dienu.", { indent: 10 });
  addEmptyLine(2);

  // ============ SIGNATURES ============
  addText("5. PARASAI", { size: 12, bold: true });
  addEmptyLine(2);

  addText("Paslaugu teikejas:", { bold: true, indent: 10 });
  addEmptyLine(3);
  addText("_______________________________", { indent: 10 });
  addText("(Parasas, data)", { size: 8, indent: 10 });
  addEmptyLine(2);

  addText("Uzsakovas:", { bold: true, indent: 10 });
  addEmptyLine(3);
  addText("_______________________________", { indent: 10 });
  addText("(Elektroninis parasas per Smart-ID/Mobile-ID)", { size: 8, indent: 10 });
  addEmptyLine(2);

  // Footer with document ID
  page.drawText(`Dokumento ID: ${proposal.id}`, {
    x: margin,
    y: 30,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  log.info("Contract PDF generated", {
    proposalId: proposal.id,
    sizeBytes: pdfBytes.length,
  });

  return Buffer.from(pdfBytes);
}
