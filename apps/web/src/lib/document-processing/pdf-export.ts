/**
 * PDF Export Service
 * Phase 102-11: Task 6 - PDF generation with Puppeteer
 *
 * Generates styled PDF proposals from persuasion blocks
 * with brand theme application and variable interpolation.
 */

import puppeteer from "puppeteer";
import { db } from "@/db";
import { persuasionBlocks, brandThemes } from "@/db/schema/document-builder";
import { eq } from "drizzle-orm";
import {
  interpolateVariables,
  type VariableContext,
} from "./variable-interpolator";
import type { TipTapContent } from "@/lib/document-builder/types";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default timeout for Puppeteer page operations in milliseconds (30 seconds) */
const PUPPETEER_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PdfExportOptions {
  /** Proposal ID to export */
  proposalId: string;
  /** Variable context for interpolation */
  variableContext: VariableContext;
  /** Whether to apply brand theme (default: true) */
  includeTheme?: boolean;
}

interface BrandThemeData {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  headingFont?: string | null;
  bodyFont?: string | null;
}

interface BlockData {
  id: string;
  type: string;
  position: number;
  content: TipTapContent;
  workspaceId: string;
}

// ---------------------------------------------------------------------------
// Main Export Function
// ---------------------------------------------------------------------------

/**
 * Export a proposal to PDF.
 *
 * @param options - Export options
 * @returns PDF buffer
 */
export async function exportToPdf(options: PdfExportOptions): Promise<Buffer> {
  const { proposalId, variableContext, includeTheme = true } = options;

  logger.info("[pdf-export] Starting export", { proposalId, includeTheme });

  // Get blocks
  const blocks = await db.query.persuasionBlocks.findMany({
    where: eq(persuasionBlocks.proposalId, proposalId),
    orderBy: (blocks, { asc }) => [asc(blocks.position)],
  });

  if (blocks.length === 0) {
    throw new Error(`No blocks found for proposal: ${proposalId}`);
  }

  // Get theme if available
  let theme: BrandThemeData | null = null;
  if (includeTheme && blocks[0]) {
    theme = await db.query.brandThemes.findFirst({
      where: eq(brandThemes.workspaceId, blocks[0].workspaceId),
    });
  }

  // Generate HTML
  const html = generateProposalHtml(
    blocks as BlockData[],
    theme,
    variableContext
  );

  // Render to PDF with Puppeteer
  // --no-sandbox and --disable-setuid-sandbox required for Docker environments
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Set default timeout for all page operations to prevent hanging
    page.setDefaultTimeout(PUPPETEER_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT_MS);

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "1in", right: "1in", bottom: "1in", left: "1in" },
      printBackground: true,
      timeout: PUPPETEER_TIMEOUT_MS,
    });

    logger.info("[pdf-export] Export complete", {
      proposalId,
      blocks: blocks.length,
      pdfSize: pdf.length,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// HTML Generation (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Generate HTML for proposal PDF rendering.
 *
 * @param blocks - Proposal blocks
 * @param theme - Brand theme (optional)
 * @param variableContext - Variables for interpolation
 * @returns HTML string
 */
export function generateProposalHtml(
  blocks: BlockData[],
  theme: BrandThemeData | null,
  variableContext: VariableContext
): string {
  // CSS variables from theme
  // Font fallback includes Noto Sans/Serif for Lithuanian diacritics (ą, č, ę, ė, į, š, ų, ū, ž)
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Serif:wght@400;700&display=swap');

    :root {
      --primary-color: ${theme?.primaryColor || "#1a1a1a"};
      --secondary-color: ${theme?.secondaryColor || "#666666"};
      --heading-font: ${theme?.headingFont || "Georgia, 'Noto Serif', serif"};
      --body-font: ${theme?.bodyFont || "Arial, 'Noto Sans', sans-serif"};
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      font-family: var(--body-font);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--secondary-color);
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: var(--heading-font);
      color: var(--primary-color);
      margin-bottom: 0.5em;
    }

    h1 { font-size: 24pt; }
    h2 { font-size: 18pt; }
    h3 { font-size: 14pt; }

    p {
      margin-bottom: 1em;
    }

    ul, ol {
      margin-left: 1.5em;
      margin-bottom: 1em;
    }

    li {
      margin-bottom: 0.25em;
    }

    .block {
      margin-bottom: 1.5em;
      page-break-inside: avoid;
    }

    .block-pain_amplifier {
      border-left: 3px solid #dc2626;
      padding-left: 1em;
    }

    .block-credibility {
      border-left: 3px solid #2563eb;
      padding-left: 1em;
    }

    .block-social_proof {
      background: #f8fafc;
      padding: 1em;
      border-radius: 4px;
    }

    .block-offer_stack {
      background: #fefce8;
      padding: 1em;
      border-radius: 4px;
    }

    .block-risk_reversal {
      border-left: 3px solid #16a34a;
      padding-left: 1em;
    }

    .block-cta {
      text-align: center;
      padding: 2em 1em;
      background: var(--primary-color);
      color: white;
      border-radius: 4px;
    }
  `;

  // Convert blocks to HTML
  const blockHtml = blocks
    .map((block) => {
      const textContent = extractTextFromTipTap(block.content);
      const { text: interpolatedText } = interpolateVariables(
        textContent,
        variableContext
      );

      return `<div class="block block-${block.type}">${formatTextAsHtml(interpolatedText)}</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${styles}
  </style>
</head>
<body>
  ${blockHtml}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Extract plain text from TipTap JSON content.
 */
function extractTextFromTipTap(content: TipTapContent): string {
  if (!content) return "";

  const parts: string[] = [];

  function traverse(node: TipTapContent) {
    if (node.text) {
      parts.push(node.text);
    }

    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        traverse(child);
      }
      // Add newline between paragraphs
      if (node.type === "paragraph") {
        parts.push("\n\n");
      }
    }
  }

  traverse(content);

  return parts.join("").trim();
}

/**
 * Format plain text as HTML (handle newlines).
 */
function formatTextAsHtml(text: string): string {
  return text
    .split("\n\n")
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}
