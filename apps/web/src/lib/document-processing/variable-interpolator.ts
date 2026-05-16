/**
 * Variable Interpolation Service
 * Phase 102-10: Task 4 - Variable interpolator
 *
 * Resolves variable placeholders ({{path.to.value}}) from
 * prospect data, SEO data, pricing, and other context sources.
 *
 * Features:
 * - Nested path resolution (prospect.contact.email)
 * - Default value support (prospect.company|Unknown)
 * - Unresolved variable highlighting
 * - Variable catalog for UI picker
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Context object for variable resolution.
 * Contains all available data sources for variable interpolation.
 */
export interface VariableContext {
  prospect?: {
    company?: string;
    domain?: string;
    website?: string;
    industry?: string;
    niche?: string;
    contact_name?: string;
    contact?: {
      name?: string;
      email?: string;
      phone?: string;
      title?: string;
    };
    email?: string;
    phone?: string;
    [key: string]: unknown;
  };
  seo_data?: {
    rank?: number;
    traffic?: number;
    keywords?: number;
    backlinks?: number;
    domain_authority?: number;
    page_authority?: number;
    organic_keywords?: number;
    competitors?: string[];
    growth_percent?: number;
    ctr?: number;
    [key: string]: unknown;
  };
  pricing?: {
    basic?: string;
    premium?: string;
    enterprise?: string;
    amount?: string;
    currency?: string;
    [key: string]: unknown;
  };
  dates?: {
    proposal_date?: string;
    expiration?: string;
    start_date?: string;
    valid_until?: string;
    [key: string]: unknown;
  };
  custom?: {
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Single variable definition for the UI picker.
 */
export interface VariableDefinition {
  path: string;
  label: string;
  description: string;
  example?: string;
}

/**
 * Variable category for grouping in UI.
 */
export interface VariableCategory {
  category: string;
  label: string;
  icon: string;
  variables: VariableDefinition[];
}

/**
 * Result of variable interpolation.
 */
export interface InterpolationResult {
  /** Text with resolved variables */
  text: string;
  /** Number of variables successfully resolved */
  resolvedCount: number;
  /** List of variable paths that could not be resolved */
  unresolvedVariables: string[];
}

// ---------------------------------------------------------------------------
// Available Variables Catalog
// ---------------------------------------------------------------------------

/**
 * Complete catalog of available variables for UI picker.
 * Grouped by category with labels and descriptions.
 */
export const AVAILABLE_VARIABLES: VariableCategory[] = [
  {
    category: "prospect",
    label: "Prospect",
    icon: "Building2",
    variables: [
      { path: "prospect.company", label: "Company Name", description: "Prospect's company name", example: "TeveroSEO" },
      { path: "prospect.domain", label: "Domain", description: "Prospect's website domain", example: "tevero.lt" },
      { path: "prospect.website", label: "Website URL", description: "Full website URL", example: "https://tevero.lt" },
      { path: "prospect.industry", label: "Industry", description: "Business industry", example: "E-commerce" },
      { path: "prospect.niche", label: "Niche", description: "Specific market niche", example: "Fashion retail" },
      { path: "prospect.contact_name", label: "Contact Name", description: "Primary contact name", example: "Jonas Jonaitis" },
      { path: "prospect.contact.name", label: "Contact Full Name", description: "Contact's full name", example: "Jonas Jonaitis" },
      { path: "prospect.contact.email", label: "Contact Email", description: "Contact's email address", example: "jonas@company.lt" },
      { path: "prospect.contact.phone", label: "Contact Phone", description: "Contact's phone number", example: "+370 600 12345" },
      { path: "prospect.contact.title", label: "Contact Title", description: "Contact's job title", example: "Marketing Director" },
      { path: "prospect.email", label: "Email", description: "Primary email address", example: "info@company.lt" },
      { path: "prospect.phone", label: "Phone", description: "Primary phone number", example: "+370 600 12345" },
    ],
  },
  {
    category: "seo_data",
    label: "SEO Data",
    icon: "BarChart3",
    variables: [
      { path: "seo_data.rank", label: "Current Rank", description: "Average keyword ranking position", example: "47" },
      { path: "seo_data.traffic", label: "Monthly Traffic", description: "Estimated monthly organic traffic", example: "5,000" },
      { path: "seo_data.keywords", label: "Ranking Keywords", description: "Number of ranking keywords", example: "150" },
      { path: "seo_data.backlinks", label: "Backlinks", description: "Total backlink count", example: "1,234" },
      { path: "seo_data.domain_authority", label: "Domain Authority", description: "DA score (0-100)", example: "35" },
      { path: "seo_data.page_authority", label: "Page Authority", description: "PA score (0-100)", example: "28" },
      { path: "seo_data.organic_keywords", label: "Organic Keywords", description: "Keywords driving traffic", example: "89" },
      { path: "seo_data.growth_percent", label: "Growth %", description: "Traffic growth percentage", example: "340%" },
      { path: "seo_data.ctr", label: "CTR", description: "Click-through rate", example: "3.2%" },
    ],
  },
  {
    category: "pricing",
    label: "Pricing",
    icon: "CreditCard",
    variables: [
      { path: "pricing.basic", label: "Basic Package", description: "Basic package price", example: "2,500 EUR" },
      { path: "pricing.premium", label: "Premium Package", description: "Premium package price", example: "3,500 EUR" },
      { path: "pricing.enterprise", label: "Enterprise Package", description: "Enterprise package price", example: "5,000 EUR" },
      { path: "pricing.amount", label: "Amount", description: "Custom pricing amount", example: "1,000 EUR" },
      { path: "pricing.currency", label: "Currency", description: "Currency code", example: "EUR" },
    ],
  },
  {
    category: "dates",
    label: "Dates",
    icon: "Calendar",
    variables: [
      { path: "dates.proposal_date", label: "Proposal Date", description: "Date proposal was created", example: "May 16, 2026" },
      { path: "dates.expiration", label: "Expiration Date", description: "Proposal expiration date", example: "June 30, 2026" },
      { path: "dates.valid_until", label: "Valid Until", description: "Offer validity date", example: "December 31, 2026" },
      { path: "dates.start_date", label: "Start Date", description: "Project start date", example: "July 1, 2026" },
    ],
  },
  {
    category: "custom",
    label: "Custom",
    icon: "Settings",
    variables: [
      { path: "custom.value", label: "Custom Value", description: "Custom variable value", example: "Any custom data" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Regex pattern for variables with optional default: {{path.to.value|default}}
 */
const VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\|([^}]*))?\}\}/g;

/**
 * Resolve a nested path from an object.
 *
 * @param obj - The object to resolve from
 * @param path - Dot-separated path (e.g., "prospect.contact.email")
 * @returns The resolved value or undefined if not found
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Format a value for display in text.
 *
 * @param value - The value to format
 * @returns Formatted string representation
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    // Format numbers with locale-appropriate separators
    return value.toLocaleString();
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  return String(value);
}

// ---------------------------------------------------------------------------
// Main Interpolation Function
// ---------------------------------------------------------------------------

/**
 * Interpolate variables in text from context data.
 *
 * Resolves {{path.to.value}} placeholders from the provided context.
 * Supports:
 * - Nested paths: {{prospect.contact.email}}
 * - Default values: {{prospect.company|Unknown Company}}
 * - Unresolved tracking: returns list of unresolved variable paths
 *
 * @param text - Text containing variable placeholders
 * @param context - Context object with values to resolve
 * @returns Interpolation result with resolved text and metadata
 */
export function interpolateVariables(
  text: string,
  context: VariableContext
): InterpolationResult {
  if (!text) {
    return {
      text: "",
      resolvedCount: 0,
      unresolvedVariables: [],
    };
  }

  const unresolvedVariables: string[] = [];
  let resolvedCount = 0;

  const resultText = text.replace(VARIABLE_PATTERN, (match, path, defaultValue) => {
    // Try to resolve the value from context
    const value = resolvePath(context as Record<string, unknown>, path);

    if (value !== undefined && value !== null && value !== "") {
      resolvedCount++;
      return formatValue(value);
    }

    // Value not found - use default or keep placeholder
    if (defaultValue !== undefined) {
      resolvedCount++;
      return defaultValue;
    }

    // Track unresolved variable
    unresolvedVariables.push(path);
    return match; // Keep original {{variable}} syntax for highlighting
  });

  return {
    text: resultText,
    resolvedCount,
    unresolvedVariables,
  };
}

/**
 * Get all variable paths from text.
 *
 * @param text - Text to scan for variables
 * @returns Array of variable paths found
 */
export function extractVariablePaths(text: string): string[] {
  const paths: string[] = [];
  let match;

  const regex = new RegExp(VARIABLE_PATTERN.source, "g");
  while ((match = regex.exec(text)) !== null) {
    paths.push(match[1]);
  }

  return paths;
}

/**
 * Get variable definition by path.
 *
 * @param path - Variable path (e.g., "prospect.company")
 * @returns Variable definition or undefined if not found
 */
export function getVariableDefinition(path: string): VariableDefinition | undefined {
  for (const category of AVAILABLE_VARIABLES) {
    const variable = category.variables.find((v) => v.path === path);
    if (variable) {
      return variable;
    }
  }
  return undefined;
}

/**
 * Check if a variable path is valid (exists in catalog).
 *
 * @param path - Variable path to check
 * @returns true if variable exists in catalog
 */
export function isValidVariablePath(path: string): boolean {
  return getVariableDefinition(path) !== undefined;
}
