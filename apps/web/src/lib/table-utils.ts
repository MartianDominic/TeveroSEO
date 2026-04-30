/**
 * Table Utilities for i18n
 *
 * Provides Lithuanian-specific column widths and abbreviations
 * for data tables to handle longer translation strings.
 */

/**
 * Column widths optimized for Lithuanian text
 * Values in pixels, can be used with style={{ width: LT_COLUMN_WIDTHS.status }}
 */
export const LT_COLUMN_WIDTHS: Record<string, number> = {
  // Status columns
  status: 100,
  state: 100,

  // Date columns
  date: 120,
  createdAt: 120,
  updatedAt: 120,
  dueDate: 130,

  // Name columns
  name: 180,
  title: 180,
  company: 160,

  // Contact columns
  email: 200,
  phone: 120,

  // Numeric columns
  amount: 100,
  total: 100,
  count: 80,

  // Action columns
  actions: 80,
  menu: 50,

  // Common columns
  type: 100,
  source: 120,
  priority: 100,
};

/**
 * Lithuanian column header abbreviations
 * Maps full header text to shorter versions for narrow viewports
 */
export const LT_COLUMN_ABBREVIATIONS: Record<string, string> = {
  // Status
  Busena: "Bust.",
  Status: "Bust.",

  // Dates
  Sukurta: "Sukr.",
  "Sukurimo data": "Sukr.",
  Atnaujinta: "Atn.",
  "Atnaujinimo data": "Atn.",
  "Mokejimo terminas": "Mok. term.",
  Data: "Data",

  // Amounts
  Suma: "Sum.",
  Viso: "Viso",
  Mokestis: "Mok.",

  // Contact
  "El. pastas": "El.p.",
  Telefonas: "Tel.",
  Adresas: "Adr.",

  // Names
  Pavadinimas: "Pav.",
  Imone: "Imone",

  // Status values
  Juodrastis: "Juodr.",
  Issiusta: "Issiust.",
  Apmoketa: "Apmok.",
  Veluoja: "Veluo.",
  Atsaukta: "Atsauk.",
  Laukia: "Lauk.",

  // Actions
  Veiksmai: "Veik.",
  Redaguoti: "Red.",
  Istrinti: "Istr.",
};

/**
 * Get abbreviated column header for narrow viewports
 */
export function getAbbreviatedHeader(
  header: string,
  maxLength = 8
): string {
  // Check if we have a predefined abbreviation
  if (LT_COLUMN_ABBREVIATIONS[header]) {
    return LT_COLUMN_ABBREVIATIONS[header];
  }

  // If header is short enough, return as-is
  if (header.length <= maxLength) {
    return header;
  }

  // Otherwise truncate with ellipsis
  return header.substring(0, maxLength - 1) + ".";
}

/**
 * Get column width for a given column type
 */
export function getColumnWidth(
  columnType: string,
  locale: string = "en"
): number {
  // Lithuanian columns need ~20% more width on average
  const baseWidth = LT_COLUMN_WIDTHS[columnType] || 120;
  return locale === "lt" ? Math.ceil(baseWidth * 1.2) : baseWidth;
}

/**
 * Responsive column visibility helper
 * Returns which columns should be visible at different breakpoints
 */
export interface ColumnVisibility {
  alwaysVisible: string[];
  hideOnMobile: string[];
  hideOnTablet: string[];
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  alwaysVisible: ["name", "status", "actions"],
  hideOnMobile: ["email", "phone", "date", "createdAt", "source"],
  hideOnTablet: ["updatedAt", "notes", "type"],
};

/**
 * Get column class based on visibility rules
 */
export function getColumnVisibilityClass(
  column: string,
  visibility: ColumnVisibility = DEFAULT_COLUMN_VISIBILITY
): string {
  if (visibility.alwaysVisible.includes(column)) {
    return "";
  }
  if (visibility.hideOnMobile.includes(column)) {
    return "hidden sm:table-cell";
  }
  if (visibility.hideOnTablet.includes(column)) {
    return "hidden md:table-cell";
  }
  return "";
}
