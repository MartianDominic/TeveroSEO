/**
 * Variable Resolution Service
 * Phase 57-02: Variable System + Resolution Service
 *
 * Resolves {{variable.key}} placeholders to actual values from proposal context.
 * Supports 6 categories: client, provider, pricing, audit, dates, custom.
 */
import { eq, and, isNull, or } from "drizzle-orm";
import { db } from "@/db/index";
import {
  variableDefinitions,
  type VariableDefinitionSelect,
  type VariableCategory,
  type SourceType,
  type FormatType,
  type FormatOptions,
} from "@/db/variable-definitions-schema";
import { proposals, type ProposalSelect } from "@/db/proposal-schema";
import { prospects, prospectAnalyses } from "@/db/prospect-schema";
import { organization } from "@/db/user-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "VariableResolutionService" });

/**
 * Context for variable resolution - all data sources needed.
 */
export interface ResolutionContext {
  proposal: ProposalSelect | null;
  prospect: {
    id: string;
    domain: string;
    companyName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    industry: string | null;
  } | null;
  workspace: {
    id: string;
    name: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    vatNumber?: string | null;
    address?: string | null;
  } | null;
  analysis: {
    domainMetrics?: {
      organicTraffic?: number;
      organicKeywords?: number;
    };
    opportunityKeywords?: Array<{ keyword: string }>;
  } | null;
  audit: {
    score?: number;
    issuesCount?: number;
  } | null;
  customValues: Record<string, string>;
  locale: "en" | "lt";
}

/**
 * Resolved variable result.
 */
export interface ResolvedVariable {
  key: string;
  value: string;
  category: VariableCategory;
  label: string;
  isEmpty: boolean;
}

/**
 * Map of all resolved variables.
 */
export type ResolvedVariables = Record<string, ResolvedVariable>;

/**
 * Get a nested property value from an object using dot notation.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Format a value based on format type and options.
 */
function formatValue(
  value: unknown,
  format: FormatType,
  options: FormatOptions | null,
  locale: "en" | "lt"
): string {
  if (value === null || value === undefined) {
    return "";
  }

  const localeStr = locale === "lt" ? "lt-LT" : "en-US";

  switch (format) {
    case "currency": {
      const amount = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(amount)) return "";

      // Assume cents, convert to full units
      const amountInUnits = amount / 100;
      const currency = options?.currency || "EUR";

      return new Intl.NumberFormat(localeStr, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amountInUnits);
    }

    case "date": {
      const date = value instanceof Date ? value : new Date(String(value));
      if (isNaN(date.getTime())) return "";

      const dateStyle = options?.dateFormat === "short" ? "short" : "long";
      if (options?.dateFormat === "iso") {
        return date.toISOString().split("T")[0];
      }

      return new Intl.DateTimeFormat(localeStr, {
        dateStyle,
      }).format(date);
    }

    case "number": {
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(num)) return "";

      return new Intl.NumberFormat(localeStr, {
        minimumFractionDigits: options?.decimals ?? 0,
        maximumFractionDigits: options?.decimals ?? 0,
      }).format(num);
    }

    case "percentage": {
      const pct = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(pct)) return "";

      return new Intl.NumberFormat(localeStr, {
        style: "percent",
        minimumFractionDigits: options?.percentDecimals ?? 0,
        maximumFractionDigits: options?.percentDecimals ?? 0,
      }).format(pct / 100);
    }

    case "list": {
      if (!Array.isArray(value)) return String(value);

      const listStyle = options?.listStyle || "bullet";

      switch (listStyle) {
        case "numbered":
          return value.map((item, i) => `${i + 1}. ${item}`).join("\n");
        case "comma":
          return value.join(", ");
        case "bullet":
        default:
          return value.map((item) => `- ${item}`).join("\n");
      }
    }

    case "text":
    default:
      return String(value);
  }
}

/**
 * Execute a computation function.
 */
function executeComputation(
  computation: string,
  context: ResolutionContext
): unknown {
  switch (computation) {
    case "getCurrentDate":
      return new Date();

    case "getCurrentYear":
      return new Date().getFullYear().toString();

    case "calculateStartDate": {
      // Estimate start date as 7 days from proposal acceptance
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      return startDate;
    }

    case "calculateAnnualTotal": {
      if (!context.proposal) return null;
      const setup = context.proposal.setupFeeCents ?? 0;
      const monthly = context.proposal.monthlyFeeCents ?? 0;
      return setup + monthly * 12;
    }

    case "countServices": {
      if (!context.proposal?.content?.investment?.inclusions) return 0;
      return context.proposal.content.investment.inclusions.length;
    }

    case "countOpportunities": {
      if (!context.analysis?.opportunityKeywords) return 0;
      return context.analysis.opportunityKeywords.length;
    }

    default:
      log.warn("Unknown computation", { computation });
      return null;
  }
}

/**
 * Resolve a single variable to its value.
 */
function resolveVariable(
  definition: VariableDefinitionSelect,
  context: ResolutionContext
): string {
  const sourceType = definition.sourceType as SourceType;
  const format = definition.format as FormatType;
  const formatOptions = definition.formatOptions as FormatOptions | null;

  let rawValue: unknown;

  switch (sourceType) {
    case "entity": {
      if (!definition.sourcePath) {
        rawValue = null;
        break;
      }

      // Parse source path: "prospect.companyName" -> get from context.prospect.companyName
      const [entity, ...pathParts] = definition.sourcePath.split(".");
      const entityPath = pathParts.join(".");

      switch (entity) {
        case "prospect":
          rawValue = getNestedValue(context.prospect, entityPath);
          break;
        case "workspace":
          rawValue = getNestedValue(context.workspace, entityPath);
          break;
        case "proposal":
          rawValue = getNestedValue(context.proposal, entityPath);
          break;
        case "analysis":
          rawValue = getNestedValue(context.analysis, entityPath);
          break;
        case "audit":
          rawValue = getNestedValue(context.audit, entityPath);
          break;
        default:
          rawValue = null;
      }
      break;
    }

    case "computed": {
      if (!definition.computation) {
        rawValue = null;
        break;
      }
      rawValue = executeComputation(definition.computation, context);
      break;
    }

    case "custom": {
      rawValue = context.customValues[definition.key] ?? definition.defaultValue;
      break;
    }

    case "input": {
      // Input variables use custom values or default
      rawValue = context.customValues[definition.key] ?? definition.defaultValue;
      break;
    }

    default:
      rawValue = null;
  }

  // Apply formatting
  const formatted = formatValue(rawValue, format, formatOptions, context.locale);

  // Return default value if empty and default exists
  if (!formatted && definition.defaultValue) {
    return definition.defaultValue;
  }

  return formatted;
}

/**
 * Get the localized label for a variable.
 */
function getLocalizedLabel(
  definition: VariableDefinitionSelect,
  locale: "en" | "lt"
): string {
  if (locale === "lt" && definition.labelLt) {
    return definition.labelLt;
  }
  if (locale === "en" && definition.labelEn) {
    return definition.labelEn;
  }
  return definition.label;
}

export const VariableResolutionService = {
  /**
   * Load resolution context for a proposal.
   */
  async loadContext(
    proposalId: string,
    locale: "en" | "lt" = "en",
    customValues: Record<string, string> = {}
  ): Promise<ResolutionContext> {
    // Load proposal with prospect
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      return {
        proposal: null,
        prospect: null,
        workspace: null,
        analysis: null,
        audit: null,
        customValues,
        locale,
      };
    }

    // Load prospect
    let prospect = null;
    if (proposal.prospectId) {
      const [prospectRow] = await db
        .select({
          id: prospects.id,
          domain: prospects.domain,
          companyName: prospects.companyName,
          contactName: prospects.contactName,
          contactEmail: prospects.contactEmail,
          industry: prospects.industry,
        })
        .from(prospects)
        .where(eq(prospects.id, proposal.prospectId))
        .limit(1);

      prospect = prospectRow ?? null;
    }

    // Load workspace
    const [workspace] = await db
      .select({
        id: organization.id,
        name: organization.name,
      })
      .from(organization)
      .where(eq(organization.id, proposal.workspaceId))
      .limit(1);

    // Load latest analysis
    let analysis: ResolutionContext["analysis"] = null;
    if (proposal.prospectId) {
      const [analysisRow] = await db
        .select({
          domainMetrics: prospectAnalyses.domainMetrics,
          opportunityKeywords: prospectAnalyses.opportunityKeywords,
        })
        .from(prospectAnalyses)
        .where(eq(prospectAnalyses.prospectId, proposal.prospectId))
        .orderBy(prospectAnalyses.createdAt)
        .limit(1);

      if (analysisRow) {
        analysis = {
          domainMetrics: analysisRow.domainMetrics
            ? {
                organicTraffic: analysisRow.domainMetrics.organicTraffic,
                organicKeywords: analysisRow.domainMetrics.organicKeywords,
              }
            : undefined,
          opportunityKeywords: analysisRow.opportunityKeywords?.map((k) => ({
            keyword: typeof k === "string" ? k : k.keyword,
          })),
        };
      }
    }

    return {
      proposal,
      prospect,
      workspace: workspace ?? null,
      analysis,
      audit: null, // Audit data loaded separately if needed
      customValues,
      locale,
    };
  },

  /**
   * Resolve all variables for a proposal.
   *
   * @param proposalId - The proposal ID
   * @param locale - Target locale ('en' or 'lt')
   * @param customValues - Custom/input variable values
   * @returns Map of variable key to resolved value
   */
  async resolveVariables(
    proposalId: string,
    locale: "en" | "lt" = "en",
    customValues: Record<string, string> = {}
  ): Promise<ResolvedVariables> {
    // Load context
    const context = await this.loadContext(proposalId, locale, customValues);

    // Load variable definitions (system + workspace) with safety limit
    const workspaceId = context.proposal?.workspaceId;
    const definitions = await db
      .select()
      .from(variableDefinitions)
      .where(
        or(
          isNull(variableDefinitions.workspaceId), // System variables
          workspaceId
            ? eq(variableDefinitions.workspaceId, workspaceId) // Workspace variables
            : isNull(variableDefinitions.workspaceId)
        )
      )
      .orderBy(variableDefinitions.displayOrder)
      .limit(500); // Safety limit to prevent unbounded queries

    // Resolve each variable
    const resolved: ResolvedVariables = {};

    for (const definition of definitions) {
      const value = resolveVariable(definition, context);
      const label = getLocalizedLabel(definition, locale);

      resolved[definition.key] = {
        key: definition.key,
        value,
        category: definition.category as VariableCategory,
        label,
        isEmpty: !value || value.trim() === "",
      };
    }

    log.info("Variables resolved", {
      proposalId,
      locale,
      count: Object.keys(resolved).length,
    });

    return resolved;
  },

  /**
   * Resolve variables with a provided context (useful for previews).
   */
  async resolveWithContext(
    context: ResolutionContext,
    workspaceId?: string
  ): Promise<ResolvedVariables> {
    // Load variable definitions
    const definitions = await db
      .select()
      .from(variableDefinitions)
      .where(
        or(
          isNull(variableDefinitions.workspaceId),
          workspaceId
            ? eq(variableDefinitions.workspaceId, workspaceId)
            : isNull(variableDefinitions.workspaceId)
        )
      )
      .orderBy(variableDefinitions.displayOrder);

    const resolved: ResolvedVariables = {};

    for (const definition of definitions) {
      const value = resolveVariable(definition, context);
      const label = getLocalizedLabel(definition, context.locale);

      resolved[definition.key] = {
        key: definition.key,
        value,
        category: definition.category as VariableCategory,
        label,
        isEmpty: !value || value.trim() === "",
      };
    }

    return resolved;
  },

  /**
   * Replace variable placeholders in text.
   *
   * @param text - Text with {{variable.key}} placeholders
   * @param resolved - Resolved variables map
   * @returns Text with placeholders replaced
   */
  replaceInText(text: string, resolved: ResolvedVariables): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
      const trimmedKey = key.trim();
      const variable = resolved[trimmedKey];

      if (!variable) {
        log.warn("Unknown variable in text", { key: trimmedKey });
        return match; // Keep original if not found
      }

      return variable.value;
    });
  },

  /**
   * Get all available variables for a workspace (for palette UI).
   */
  async getAvailableVariables(
    workspaceId: string,
    locale: "en" | "lt" = "en"
  ): Promise<
    Array<{
      key: string;
      label: string;
      description: string;
      category: VariableCategory;
      icon: string | null;
      isSystem: boolean;
    }>
  > {
    const definitions = await db
      .select()
      .from(variableDefinitions)
      .where(
        or(
          isNull(variableDefinitions.workspaceId),
          eq(variableDefinitions.workspaceId, workspaceId)
        )
      )
      .orderBy(variableDefinitions.category, variableDefinitions.displayOrder);

    return definitions.map((def) => ({
      key: def.key,
      label: getLocalizedLabel(def, locale),
      description:
        locale === "lt" && def.descriptionLt
          ? def.descriptionLt
          : locale === "en" && def.descriptionEn
            ? def.descriptionEn
            : def.description ?? "",
      category: def.category as VariableCategory,
      icon: def.icon,
      isSystem: def.workspaceId === null,
    }));
  },
};
