/**
 * PDF Generation Service
 * Phase 59-07: Agreement PDF generation with custom fonts and branding
 *
 * Generates professional branded PDF documents from agreement templates.
 * Uses pdf-lib with fontkit for custom Inter font embedding.
 *
 * Features:
 * - Custom Inter fonts (Regular, Bold) with Helvetica fallback
 * - Workspace branding (logo, colors, company info)
 * - Variable resolution in clause content
 * - Signature section with signed/pending status
 * - Page numbers in footer
 * - A4 page format
 */
import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "fs/promises";
import * as path from "path";
import { getOpenSeo } from "@/lib/server-fetch";
import { PdfBrandingService, type BrandingConfig, type RgbColor } from "./pdf-branding-service";

/**
 * Clause structure from agreement template
 */
interface TemplateClause {
  id: string;
  title: string;
  content: string;
  order: number;
}

/**
 * Signer data from API
 */
interface SignerData {
  id: string;
  name: string;
  email: string;
  role: string | null;
  status: "pending" | "invited" | "viewed" | "signing" | "signed" | "declined";
  signingOrder: number;
  signedAt: string | null;
  signatureData: {
    method?: string;
    sessionId?: string;
    certificateData?: unknown;
  } | null;
}

/**
 * Agreement data from API
 */
interface AgreementData {
  id: string;
  title: string;
  workspaceId: string;
  clientId: string | null;
  status: string;
  template: {
    id: string;
    name: string;
    content: {
      clauses: TemplateClause[];
    };
    clauseOrder?: string[];
  };
  client: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  variableValues?: Record<string, string | number | string[]>;
}

/**
 * Variable context for resolution
 */
export interface VariableContext {
  client: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  agreement: {
    title: string;
    date: string;
  };
  provider: {
    name: string;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  custom: Record<string, string | number | string[]>;
}

/**
 * Options for PDF generation
 */
export interface PdfGenerationOptions {
  includeSignatures?: boolean;
  locale?: "en" | "lt";
}

/**
 * PDF page layout constants
 */
const PAGE = {
  WIDTH: 595.28, // A4 width in points
  HEIGHT: 841.89, // A4 height in points
  MARGIN: 50,
  LINE_HEIGHT: 14,
  TITLE_SIZE: 18,
  HEADING_SIZE: 14,
  BODY_SIZE: 11,
  FOOTER_SIZE: 9,
  FOOTER_Y: 30,
} as const;

export class PdfGenerationService {
  private brandingService: PdfBrandingService;

  constructor() {
    this.brandingService = new PdfBrandingService();
  }

  /**
   * Generate PDF for an agreement
   *
   * @param agreementId - Agreement ID to generate PDF for
   * @param options - Generation options (signatures, locale)
   * @returns PDF bytes as Uint8Array
   */
  async generateAgreementPdf(
    agreementId: string,
    options: PdfGenerationOptions = {}
  ): Promise<Uint8Array> {
    const { includeSignatures = true, locale = "en" } = options;

    // Fetch agreement data from open-seo-main API
    const agreement = await this.fetchAgreementData(agreementId);

    // Fetch signers if including signatures
    const signers = includeSignatures
      ? await this.fetchSigners(agreementId)
      : [];

    // Build variable context for resolution
    const variableContext = this.buildVariableContext(agreement);

    // Get workspace branding
    const branding = await this.brandingService.getBrandingConfig(
      agreement.workspaceId
    );

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Load fonts with fallback
    const { regularFont, boldFont } = await this.loadFonts(pdfDoc);

    // Parse and order clauses
    const clauses = this.orderClauses(agreement.template);

    // Initialize drawing state
    let currentPage = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
    let yPosition = PAGE.HEIGHT - PAGE.MARGIN;

    // Get color values
    const primaryRgb = this.brandingService.hexToRgb(branding.primaryColor);
    const secondaryRgb = this.brandingService.hexToRgb(branding.secondaryColor);

    // Draw header with logo and company info
    yPosition = await this.drawHeader(
      currentPage,
      branding,
      agreement.title,
      boldFont,
      primaryRgb,
      secondaryRgb,
      yPosition,
      pdfDoc
    );

    // Draw clauses
    for (const clause of clauses) {
      // Check if we need a new page
      if (yPosition < PAGE.MARGIN + 100) {
        currentPage = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
        yPosition = PAGE.HEIGHT - PAGE.MARGIN;
      }

      // Draw clause title
      currentPage.drawText(clause.title, {
        x: PAGE.MARGIN,
        y: yPosition,
        size: PAGE.HEADING_SIZE,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= PAGE.LINE_HEIGHT * 1.5;

      // Resolve variables in content
      const resolvedContent = this.replaceVariables(
        clause.content,
        variableContext
      );

      // Strip HTML and wrap text
      const plainText = this.stripHtml(resolvedContent);
      const lines = this.wrapText(
        plainText,
        PAGE.WIDTH - PAGE.MARGIN * 2,
        regularFont,
        PAGE.BODY_SIZE
      );

      // Draw text lines
      for (const line of lines) {
        if (yPosition < PAGE.MARGIN + 20) {
          currentPage = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
          yPosition = PAGE.HEIGHT - PAGE.MARGIN;
        }

        currentPage.drawText(line, {
          x: PAGE.MARGIN,
          y: yPosition,
          size: PAGE.BODY_SIZE,
          font: regularFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= PAGE.LINE_HEIGHT;
      }

      yPosition -= PAGE.LINE_HEIGHT; // Extra space between clauses
    }

    // Draw signature section
    if (includeSignatures && signers.length > 0) {
      // Check if we need a new page for signatures
      if (yPosition < PAGE.MARGIN + 150) {
        currentPage = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
        yPosition = PAGE.HEIGHT - PAGE.MARGIN;
      }

      yPosition = this.drawSignatures(
        currentPage,
        pdfDoc,
        signers,
        boldFont,
        regularFont,
        secondaryRgb,
        locale,
        yPosition
      );
    }

    // Add page numbers to all pages
    this.addPageNumbers(
      pdfDoc,
      branding,
      regularFont,
      secondaryRgb
    );

    // Save and return PDF bytes
    return pdfDoc.save();
  }

  /**
   * Fetch agreement data from open-seo-main API
   */
  private async fetchAgreementData(agreementId: string): Promise<AgreementData> {
    return getOpenSeo<AgreementData>(`/api/agreements/${agreementId}`);
  }

  /**
   * Fetch signers for an agreement
   */
  private async fetchSigners(agreementId: string): Promise<SignerData[]> {
    try {
      return await getOpenSeo<SignerData[]>(
        `/api/agreements/${agreementId}/signers`
      );
    } catch {
      // If endpoint doesn't exist or fails, return empty
      return [];
    }
  }

  /**
   * Build variable context from agreement data
   */
  private buildVariableContext(agreement: AgreementData): VariableContext {
    return {
      client: agreement.client
        ? {
            name: agreement.client.name,
            email: agreement.client.email ?? null,
            phone: agreement.client.phone ?? null,
            address: agreement.client.address ?? null,
          }
        : null,
      agreement: {
        title: agreement.title,
        date: new Date().toISOString().split("T")[0],
      },
      provider: {
        name: "TeveroSEO", // Will be overridden by branding
        address: null,
        email: null,
        phone: null,
      },
      custom: (agreement.variableValues ?? {}) as Record<string, string | number | string[]>,
    };
  }

  /**
   * Load Inter fonts with Helvetica fallback
   */
  private async loadFonts(
    pdfDoc: PDFDocument
  ): Promise<{ regularFont: PDFFont; boldFont: PDFFont }> {
    try {
      // Try to load custom Inter fonts
      const fontDir = path.join(process.cwd(), "public/fonts");
      const regularFontPath = path.join(fontDir, "Inter-Regular.ttf");
      const boldFontPath = path.join(fontDir, "Inter-Bold.ttf");

      const regularFontBytes = await fs.readFile(regularFontPath);
      const boldFontBytes = await fs.readFile(boldFontPath);

      const regularFont = await pdfDoc.embedFont(regularFontBytes);
      const boldFont = await pdfDoc.embedFont(boldFontBytes);

      return { regularFont, boldFont };
    } catch {
      // Fallback to standard Helvetica fonts
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      return { regularFont, boldFont };
    }
  }

  /**
   * Order clauses according to template clauseOrder
   */
  private orderClauses(template: AgreementData["template"]): TemplateClause[] {
    const clauses = template.content.clauses || [];
    const clauseOrder = template.clauseOrder || clauses.map((c) => c.id);

    return clauseOrder
      .map((id) => clauses.find((c) => c.id === id))
      .filter((c): c is TemplateClause => c !== undefined);
  }

  /**
   * Draw PDF header with logo, company name, and title
   */
  private async drawHeader(
    page: PDFPage,
    branding: BrandingConfig,
    agreementTitle: string,
    boldFont: PDFFont,
    primaryRgb: RgbColor,
    secondaryRgb: RgbColor,
    yPosition: number,
    pdfDoc: PDFDocument
  ): Promise<number> {
    // Try to draw logo if available
    if (branding.logoUrl) {
      const logoBytes = await this.brandingService.fetchLogoBytes(
        branding.logoUrl
      );
      if (logoBytes) {
        try {
          const imageType = this.brandingService.getImageType(branding.logoUrl);
          const logoImage =
            imageType === "jpg"
              ? await pdfDoc.embedJpg(logoBytes)
              : await pdfDoc.embedPng(logoBytes);

          // Scale logo to reasonable size (max 100px height)
          const maxHeight = 60;
          const scale = Math.min(1, maxHeight / logoImage.height);
          const logoDims = {
            width: logoImage.width * scale,
            height: logoImage.height * scale,
          };

          page.drawImage(logoImage, {
            x: PAGE.MARGIN,
            y: yPosition - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
          });
          yPosition -= logoDims.height + 20;
        } catch {
          // Logo embed failed, continue without
        }
      }
    }

    // Company name
    page.drawText(branding.companyName, {
      x: PAGE.MARGIN,
      y: yPosition,
      size: PAGE.TITLE_SIZE,
      font: boldFont,
      color: rgb(primaryRgb.r, primaryRgb.g, primaryRgb.b),
    });
    yPosition -= PAGE.LINE_HEIGHT * 2;

    // Agreement title
    page.drawText(agreementTitle, {
      x: PAGE.MARGIN,
      y: yPosition,
      size: PAGE.HEADING_SIZE,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= PAGE.LINE_HEIGHT * 2;

    // Horizontal line
    page.drawLine({
      start: { x: PAGE.MARGIN, y: yPosition },
      end: { x: PAGE.WIDTH - PAGE.MARGIN, y: yPosition },
      thickness: 1,
      color: rgb(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b),
    });
    yPosition -= PAGE.LINE_HEIGHT * 2;

    return yPosition;
  }

  /**
   * Draw signature section with signed/pending status
   */
  private drawSignatures(
    page: PDFPage,
    pdfDoc: PDFDocument,
    signers: SignerData[],
    boldFont: PDFFont,
    regularFont: PDFFont,
    secondaryRgb: RgbColor,
    locale: "en" | "lt",
    yPosition: number
  ): number {
    let currentPage = page;
    let y = yPosition;

    y -= PAGE.LINE_HEIGHT * 2;

    // Signatures heading
    const signaturesLabel = locale === "lt" ? "Parasai" : "Signatures";
    currentPage.drawText(signaturesLabel, {
      x: PAGE.MARGIN,
      y,
      size: PAGE.HEADING_SIZE,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    y -= PAGE.LINE_HEIGHT * 2;

    // Draw each signer
    for (const signer of signers) {
      // Check if we need a new page
      if (y < PAGE.MARGIN + 60) {
        currentPage = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
        y = PAGE.HEIGHT - PAGE.MARGIN;
      }

      if (signer.status === "signed" && signer.signedAt) {
        // Signed signer
        const nameAndRole = `${signer.name} (${signer.role || "Signer"})`;
        currentPage.drawText(nameAndRole, {
          x: PAGE.MARGIN,
          y,
          size: PAGE.BODY_SIZE,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        y -= PAGE.LINE_HEIGHT;

        // Signed date
        const signedDate = new Date(signer.signedAt).toLocaleDateString(
          locale === "lt" ? "lt-LT" : "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }
        );
        const signedLabel = locale === "lt" ? "Pasirasymo data: " : "Signed: ";
        currentPage.drawText(signedLabel + signedDate, {
          x: PAGE.MARGIN,
          y,
          size: PAGE.BODY_SIZE - 1,
          font: regularFont,
          color: rgb(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b),
        });
        y -= PAGE.LINE_HEIGHT;

        // Signing method if available
        if (signer.signatureData?.method) {
          const methodLabel = locale === "lt" ? "Budas: " : "Method: ";
          currentPage.drawText(methodLabel + signer.signatureData.method, {
            x: PAGE.MARGIN,
            y,
            size: PAGE.BODY_SIZE - 2,
            font: regularFont,
            color: rgb(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b),
          });
          y -= PAGE.LINE_HEIGHT;
        }

        y -= PAGE.LINE_HEIGHT; // Space between signers
      } else {
        // Pending signature placeholder
        const pendingLabel =
          locale === "lt" ? " - Laukiama paraso" : " - Awaiting signature";
        currentPage.drawText(signer.name + pendingLabel, {
          x: PAGE.MARGIN,
          y,
          size: PAGE.BODY_SIZE,
          font: regularFont,
          color: rgb(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b),
        });
        y -= PAGE.LINE_HEIGHT * 2;
      }
    }

    return y;
  }

  /**
   * Add page numbers to all pages in footer
   */
  private addPageNumbers(
    pdfDoc: PDFDocument,
    branding: BrandingConfig,
    regularFont: PDFFont,
    secondaryRgb: RgbColor
  ): void {
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const pageNum = i + 1;

      // Page number on the right
      page.drawText(`${pageNum} / ${totalPages}`, {
        x: PAGE.WIDTH - PAGE.MARGIN - 30,
        y: PAGE.FOOTER_Y,
        size: PAGE.FOOTER_SIZE,
        font: regularFont,
        color: rgb(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b),
      });

      // Footer text on the left if configured
      if (branding.footerText) {
        page.drawText(branding.footerText, {
          x: PAGE.MARGIN,
          y: PAGE.FOOTER_Y,
          size: PAGE.FOOTER_SIZE,
          font: regularFont,
          color: rgb(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b),
        });
      }
    }
  }

  /**
   * Replace variable placeholders with values
   */
  private replaceVariables(
    text: string,
    context: VariableContext
  ): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
      const trimmedKey = key.trim();
      const parts = trimmedKey.split(".");

      // Navigate through context
      let value: unknown = context;
      for (const part of parts) {
        if (value && typeof value === "object" && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          // Key not found, return original placeholder
          return match;
        }
      }

      // Convert value to string
      if (value === null || value === undefined) {
        return "";
      }
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return String(value);
    });
  }

  /**
   * Strip HTML tags and convert to plain text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Wrap text to fit within maxWidth
   */
  private wrapText(
    text: string,
    maxWidth: number,
    font: PDFFont,
    fontSize: number
  ): string[] {
    const lines: string[] = [];
    const paragraphs = text.split("\n");

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        lines.push("");
        continue;
      }

      const words = paragraph.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  }
}

/**
 * Singleton instance for service reuse
 */
let _instance: PdfGenerationService | null = null;

export function getPdfGenerationService(): PdfGenerationService {
  if (!_instance) {
    _instance = new PdfGenerationService();
  }
  return _instance;
}
