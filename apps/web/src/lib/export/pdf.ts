/**
 * PDF Export Utility
 *
 * Creates a printable HTML view that can be converted to PDF via browser print.
 * This approach avoids heavy dependencies like jspdf while providing good results.
 */

export interface PDFColumn<T> {
  key: keyof T | string;
  header: string;
  /** Width percentage (optional, defaults to auto) */
  width?: number;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Optional formatter for the cell value */
  format?: (value: unknown, row: T) => string;
}

export interface PDFOptions {
  /** Document title (shown in header) */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Date to show in header (defaults to current date) */
  date?: Date;
  /** Page orientation */
  orientation?: "portrait" | "landscape";
  /** Include page numbers */
  showPageNumbers?: boolean;
  /** Custom footer text */
  footerText?: string;
}

/**
 * Gets a nested value from an object using dot notation.
 */
function getNestedValue<T>(obj: T, path: string): unknown {
  return path.split(".").reduce((current: unknown, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Escapes HTML special characters to prevent XSS.
 */
function escapeHTML(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

/**
 * Generates the print-friendly HTML document as a data URL.
 */
function generatePrintHTML<T extends object>(
  data: T[],
  columns: PDFColumn<T>[],
  options: PDFOptions
): string {
  const {
    title,
    subtitle,
    date = new Date(),
    orientation = "portrait",
    showPageNumbers = true,
    footerText,
  } = options;

  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Generate table rows
  const tableRows = data
    .map(
      (row) => `
    <tr>
      ${columns
        .map((col) => {
          const rawValue = getNestedValue(row, col.key as string);
          const formattedValue = col.format
            ? col.format(rawValue, row)
            : String(rawValue ?? "");
          const align = col.align || "left";
          const width = col.width ? `width: ${col.width}%;` : "";
          return `<td style="text-align: ${align}; ${width}">${escapeHTML(formattedValue)}</td>`;
        })
        .join("")}
    </tr>
  `
    )
    .join("");

  // Generate header row
  const headerRow = columns
    .map((col) => {
      const align = col.align || "left";
      const width = col.width ? `width: ${col.width}%;` : "";
      return `<th style="text-align: ${align}; ${width}">${escapeHTML(col.header)}</th>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(title)}</title>
  <style>
    @media print {
      @page {
        size: ${orientation === "landscape" ? "landscape" : "portrait"};
        margin: 1cm;
      }

      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .no-print {
        display: none !important;
      }

      thead {
        display: table-header-group;
      }

      tr {
        page-break-inside: avoid;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #1a1a1a;
      padding: 20px;
    }

    .header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }

    .header .subtitle {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .header .date {
      font-size: 12px;
      color: #9ca3af;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }

    th, td {
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
    }

    th {
      background-color: #f9fafb;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
      color: #6b7280;
    }

    tr:nth-child(even) {
      background-color: #f9fafb;
    }

    tr:hover {
      background-color: #f3f4f6;
    }

    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #9ca3af;
      text-align: center;
    }

    .print-controls {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 8px;
      z-index: 1000;
    }

    .print-controls button {
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .print-btn {
      background-color: #2563eb;
      color: white;
    }

    .print-btn:hover {
      background-color: #1d4ed8;
    }

    .close-btn {
      background-color: #f3f4f6;
      color: #374151;
    }

    .close-btn:hover {
      background-color: #e5e7eb;
    }

    ${showPageNumbers ? `
    @media print {
      .footer::after {
        content: counter(page);
      }
    }
    ` : ""}
  </style>
</head>
<body>
  <div class="print-controls no-print">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    <button class="close-btn" onclick="window.close()">Close</button>
  </div>

  <div class="header">
    <h1>${escapeHTML(title)}</h1>
    ${subtitle ? `<div class="subtitle">${escapeHTML(subtitle)}</div>` : ""}
    <div class="date">Generated on ${formattedDate}</div>
  </div>

  <table>
    <thead>
      <tr>
        ${headerRow}
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  ${footerText ? `<div class="footer">${escapeHTML(footerText)}</div>` : ""}

  <script>
    // Auto-focus print button for keyboard accessibility
    document.querySelector('.print-btn').focus();

    // Handle keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        window.close();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    });
  </script>
</body>
</html>
`;
}

/**
 * Generates a PDF by opening a printable HTML view in a new window.
 * The user can then use the browser's print dialog to save as PDF.
 *
 * Uses data URL instead of document.write() for security.
 */
export function generatePDF<T extends object>(
  data: T[],
  columns: PDFColumn<T>[],
  options: PDFOptions
): void {
  const html = generatePrintHTML(data, columns, options);

  // Create a blob and open via URL - safer than document.write()
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // Open in new window
  const printWindow = window.open(url, "_blank", "width=900,height=700");

  if (!printWindow) {
    // Popup blocked - fallback to download as HTML
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFilename(options.title)}.html`;
    link.click();
  }

  // Cleanup URL after a delay to allow window to load
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Sanitizes a string for use as a filename.
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Creates a PDF export options object with defaults.
 */
export function createPDFOptions(
  title: string,
  overrides?: Partial<PDFOptions>
): PDFOptions {
  return {
    title,
    date: new Date(),
    orientation: "portrait",
    showPageNumbers: true,
    ...overrides,
  };
}
