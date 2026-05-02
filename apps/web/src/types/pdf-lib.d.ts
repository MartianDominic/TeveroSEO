/**
 * Minimal type declarations for pdf-lib
 * To fix build errors when package is not installed
 */

declare module "pdf-lib" {
  export interface RGB {
    type: "RGB";
    red: number;
    green: number;
    blue: number;
  }

  export function rgb(r: number, g: number, b: number): RGB;

  export enum StandardFonts {
    Helvetica = "Helvetica",
    HelveticaBold = "Helvetica-Bold",
    TimesRoman = "Times-Roman",
    TimesRomanBold = "Times-Roman-Bold",
    Courier = "Courier",
    CourierBold = "Courier-Bold",
  }

  export interface PDFFont {
    name: string;
    widthOfTextAtSize(text: string, size: number): number;
  }

  export interface PDFImage {
    width: number;
    height: number;
  }

  export interface PDFPage {
    getWidth(): number;
    getHeight(): number;
    drawText(text: string, options?: {
      x?: number;
      y?: number;
      size?: number;
      font?: PDFFont;
      color?: RGB;
      lineHeight?: number;
      maxWidth?: number;
    }): void;
    drawRectangle(options?: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      color?: RGB;
      borderColor?: RGB;
      borderWidth?: number;
    }): void;
    drawImage(image: PDFImage, options?: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }): void;
    drawLine(options?: {
      start?: { x: number; y: number };
      end?: { x: number; y: number };
      thickness?: number;
      color?: RGB;
    }): void;
  }

  export interface PDFDocument {
    addPage(size?: [number, number]): PDFPage;
    embedFont(font: StandardFonts | Uint8Array | ArrayBuffer): Promise<PDFFont>;
    embedJpg(bytes: Uint8Array | ArrayBuffer): Promise<PDFImage>;
    embedPng(bytes: Uint8Array | ArrayBuffer): Promise<PDFImage>;
    registerFontkit(fontkit: any): void;
    save(): Promise<Uint8Array>;
    getPages(): PDFPage[];
  }

  export const PDFDocument: {
    create(): Promise<PDFDocument>;
    load(data: Uint8Array | ArrayBuffer): Promise<PDFDocument>;
  };
}
