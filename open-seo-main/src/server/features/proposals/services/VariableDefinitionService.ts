/**
 * Variable Definition Service
 * Phase 57-02: Variable System + Resolution Service
 *
 * CRUD operations for custom variable definitions.
 * System variables are read-only; only workspace-specific variables can be modified.
 */
import { eq, and, isNull, or, desc } from "drizzle-orm";
import { db } from "@/db/index";
import {
  variableDefinitions,
  type VariableDefinitionSelect,
  type VariableDefinitionInsert,
  type VariableCategory,
  VARIABLE_CATEGORIES,
  CATEGORY_COLORS,
} from "@/db/variable-definitions-schema";
import { AppError } from "@/server/lib/errors";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "VariableDefinitionService" });

/**
 * Input for creating a custom variable.
 */
export interface CreateVariableInput {
  workspaceId: string;
  key: string;
  label: string;
  labelEn?: string;
  labelLt?: string;
  description?: string;
  descriptionEn?: string;
  descriptionLt?: string;
  category?: VariableCategory;
  sourceType?: "entity" | "computed" | "custom" | "input";
  sourcePath?: string;
  computation?: string;
  format?: "text" | "currency" | "date" | "number" | "percentage" | "list";
  formatOptions?: Record<string, unknown>;
  defaultValue?: string;
  isRequired?: boolean;
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    required?: boolean;
  };
  icon?: string;
  displayOrder?: number;
}

/**
 * Input for updating a custom variable.
 */
export interface UpdateVariableInput {
  label?: string;
  labelEn?: string;
  labelLt?: string;
  description?: string;
  descriptionEn?: string;
  descriptionLt?: string;
  format?: "text" | "currency" | "date" | "number" | "percentage" | "list";
  formatOptions?: Record<string, unknown>;
  defaultValue?: string;
  isRequired?: boolean;
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    required?: boolean;
  };
  icon?: string;
  displayOrder?: number;
}

/**
 * Variable with category color.
 */
export interface VariableWithColor extends VariableDefinitionSelect {
  color: string;
}

/**
 * Variables grouped by category.
 */
export interface VariablesByCategory {
  category: VariableCategory;
  color: string;
  label: string;
  variables: VariableWithColor[];
}

const CATEGORY_LABELS: Record<VariableCategory, { en: string; lt: string }> = {
  client: { en: "Client", lt: "Klientas" },
  provider: { en: "Provider", lt: "Teikėjas" },
  pricing: { en: "Pricing", lt: "Kainos" },
  audit: { en: "Audit Results", lt: "Audito rezultatai" },
  dates: { en: "Dates", lt: "Datos" },
  custom: { en: "Custom", lt: "Pasirinktiniai" },
};

export const VariableDefinitionService = {
  /**
   * List all variables available to a workspace (system + custom).
   */
  async listAll(
    workspaceId: string,
    locale: "en" | "lt" = "en"
  ): Promise<VariableWithColor[]> {
    const definitions = await db
      .select()
      .from(variableDefinitions)
      .where(
        or(
          isNull(variableDefinitions.workspaceId), // System variables
          eq(variableDefinitions.workspaceId, workspaceId) // Workspace variables
        )
      )
      .orderBy(variableDefinitions.category, variableDefinitions.displayOrder);

    return definitions.map((def) => ({
      ...def,
      color: CATEGORY_COLORS[def.category as VariableCategory] ?? "#6B7280",
    }));
  },

  /**
   * List variables grouped by category.
   */
  async listByCategory(
    workspaceId: string,
    locale: "en" | "lt" = "en"
  ): Promise<VariablesByCategory[]> {
    const all = await this.listAll(workspaceId, locale);

    // Group by category
    const grouped = new Map<VariableCategory, VariableWithColor[]>();

    for (const variable of all) {
      const category = variable.category as VariableCategory;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(variable);
    }

    // Convert to array with category metadata
    const result: VariablesByCategory[] = [];

    for (const category of VARIABLE_CATEGORIES) {
      const variables = grouped.get(category) ?? [];
      if (variables.length > 0) {
        result.push({
          category,
          color: CATEGORY_COLORS[category],
          label: locale === "lt"
            ? CATEGORY_LABELS[category].lt
            : CATEGORY_LABELS[category].en,
          variables,
        });
      }
    }

    return result;
  },

  /**
   * Get a single variable by ID.
   */
  async findById(id: string): Promise<VariableWithColor | null> {
    const [definition] = await db
      .select()
      .from(variableDefinitions)
      .where(eq(variableDefinitions.id, id))
      .limit(1);

    if (!definition) return null;

    return {
      ...definition,
      color: CATEGORY_COLORS[definition.category as VariableCategory] ?? "#6B7280",
    };
  },

  /**
   * Get a variable by key within a workspace scope.
   */
  async findByKey(
    key: string,
    workspaceId: string
  ): Promise<VariableWithColor | null> {
    // First check workspace-specific variable
    const [workspaceVar] = await db
      .select()
      .from(variableDefinitions)
      .where(
        and(
          eq(variableDefinitions.key, key),
          eq(variableDefinitions.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (workspaceVar) {
      return {
        ...workspaceVar,
        color: CATEGORY_COLORS[workspaceVar.category as VariableCategory] ?? "#6B7280",
      };
    }

    // Fall back to system variable
    const [systemVar] = await db
      .select()
      .from(variableDefinitions)
      .where(
        and(
          eq(variableDefinitions.key, key),
          isNull(variableDefinitions.workspaceId)
        )
      )
      .limit(1);

    if (!systemVar) return null;

    return {
      ...systemVar,
      color: CATEGORY_COLORS[systemVar.category as VariableCategory] ?? "#6B7280",
    };
  },

  /**
   * Create a custom variable for a workspace.
   */
  async create(input: CreateVariableInput): Promise<VariableWithColor> {
    // Validate key format (category.name)
    if (!input.key.includes(".")) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Variable key must be in format 'category.name'"
      );
    }

    // Check for duplicate key in workspace
    const existing = await this.findByKey(input.key, input.workspaceId);
    if (existing && existing.workspaceId === input.workspaceId) {
      throw new AppError(
        "CONFLICT",
        `Variable with key '${input.key}' already exists in this workspace`
      );
    }

    // Determine category from key if not provided
    const keyCategory = input.key.split(".")[0] as VariableCategory;
    const category = input.category ??
      (VARIABLE_CATEGORIES.includes(keyCategory) ? keyCategory : "custom");

    const id = nanoid();
    const now = new Date();

    const [created] = await db
      .insert(variableDefinitions)
      .values({
        id,
        workspaceId: input.workspaceId,
        key: input.key,
        label: input.label,
        labelEn: input.labelEn ?? input.label,
        labelLt: input.labelLt,
        description: input.description,
        descriptionEn: input.descriptionEn ?? input.description,
        descriptionLt: input.descriptionLt,
        category,
        sourceType: input.sourceType ?? "custom",
        sourcePath: input.sourcePath,
        computation: input.computation,
        format: input.format ?? "text",
        formatOptions: input.formatOptions,
        defaultValue: input.defaultValue,
        isRequired: input.isRequired ?? false,
        validationRules: input.validationRules,
        icon: input.icon,
        displayOrder: input.displayOrder ?? 100,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    log.info("Custom variable created", { id, key: input.key, workspaceId: input.workspaceId });

    return {
      ...created,
      color: CATEGORY_COLORS[created.category as VariableCategory] ?? "#6B7280",
    };
  },

  /**
   * Update a custom variable.
   * System variables (workspaceId = null) cannot be updated.
   */
  async update(
    id: string,
    workspaceId: string,
    input: UpdateVariableInput
  ): Promise<VariableWithColor> {
    // Verify variable exists and belongs to workspace
    const existing = await this.findById(id);

    if (!existing) {
      throw new AppError("NOT_FOUND", "Variable not found");
    }

    if (existing.workspaceId === null) {
      throw new AppError(
        "FORBIDDEN",
        "System variables cannot be modified"
      );
    }

    if (existing.workspaceId !== workspaceId) {
      throw new AppError("NOT_FOUND", "Variable not found");
    }

    const [updated] = await db
      .update(variableDefinitions)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(variableDefinitions.id, id))
      .returning();

    log.info("Custom variable updated", { id, workspaceId });

    return {
      ...updated,
      color: CATEGORY_COLORS[updated.category as VariableCategory] ?? "#6B7280",
    };
  },

  /**
   * Delete a custom variable.
   * System variables (workspaceId = null) cannot be deleted.
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    // Verify variable exists and belongs to workspace
    const existing = await this.findById(id);

    if (!existing) {
      throw new AppError("NOT_FOUND", "Variable not found");
    }

    if (existing.workspaceId === null) {
      throw new AppError(
        "FORBIDDEN",
        "System variables cannot be deleted"
      );
    }

    if (existing.workspaceId !== workspaceId) {
      throw new AppError("NOT_FOUND", "Variable not found");
    }

    await db
      .delete(variableDefinitions)
      .where(eq(variableDefinitions.id, id));

    log.info("Custom variable deleted", { id, workspaceId });
  },

  /**
   * List all categories with metadata.
   */
  getCategories(locale: "en" | "lt" = "en"): Array<{
    category: VariableCategory;
    color: string;
    label: string;
  }> {
    return VARIABLE_CATEGORIES.map((category) => ({
      category,
      color: CATEGORY_COLORS[category],
      label: locale === "lt"
        ? CATEGORY_LABELS[category].lt
        : CATEGORY_LABELS[category].en,
    }));
  },

  /**
   * Bulk update display order for variables.
   */
  async updateDisplayOrder(
    workspaceId: string,
    updates: Array<{ id: string; displayOrder: number }>
  ): Promise<void> {
    // Use transaction for atomic update
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(variableDefinitions)
          .set({ displayOrder: update.displayOrder, updatedAt: new Date() })
          .where(
            and(
              eq(variableDefinitions.id, update.id),
              eq(variableDefinitions.workspaceId, workspaceId)
            )
          );
      }
    });

    log.info("Variable display order updated", {
      workspaceId,
      count: updates.length
    });
  },
};
