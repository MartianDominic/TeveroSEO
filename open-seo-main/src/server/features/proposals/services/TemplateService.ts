/**
 * Template Service
 * Phase 57-01: Proposal Editor Revolution - Template System Foundation
 *
 * Business logic layer for proposal templates.
 * Handles validation, default template selection, system template seeding,
 * and workspace template inheritance.
 */
import { TemplateRepository } from "../repositories/template.repository";
import {
  type ProposalTemplateInsert,
  type ProposalTemplateSelect,
  type TemplateSectionInsert,
  type TemplateSectionSelect,
  type ProposalTemplateType,
  type ProposalTemplateCategory,
  type VariableDefinition,
  type BrandingSettings,
  PROPOSAL_TEMPLATE_TYPES,
  PROPOSAL_TEMPLATE_CATEGORIES,
  TEMPLATE_SECTION_TYPES,
} from "@/db/proposal-template-schema";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "TemplateService" });

/**
 * Input for creating a template.
 */
export interface CreateTemplateInput {
  workspaceId: string;
  name: string;
  nameEn?: string;
  nameLt?: string;
  description?: string;
  descriptionEn?: string;
  descriptionLt?: string;
  type?: ProposalTemplateType;
  category?: ProposalTemplateCategory;
  variables?: VariableDefinition[];
  brandingSettings?: BrandingSettings;
  isDefault?: boolean;
  sections?: CreateSectionInput[];
  createdBy?: string;
}

/**
 * Input for creating a section.
 */
export interface CreateSectionInput {
  key: string;
  title: string;
  titleEn?: string;
  titleLt?: string;
  content?: string;
  contentEn?: string;
  contentLt?: string;
  sectionType?: string;
  isRequired?: boolean;
  isEditable?: boolean;
  position?: number;
  aiPromptHint?: string;
}

/**
 * Input for updating a template.
 */
export interface UpdateTemplateInput {
  name?: string;
  nameEn?: string | null;
  nameLt?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  descriptionLt?: string | null;
  type?: ProposalTemplateType;
  category?: ProposalTemplateCategory;
  variables?: VariableDefinition[];
  brandingSettings?: BrandingSettings | null;
  isDefault?: boolean;
  isPublished?: boolean;
}

/**
 * Input for updating a section.
 */
export interface UpdateSectionInput {
  title?: string;
  titleEn?: string;
  titleLt?: string;
  content?: string;
  contentEn?: string;
  contentLt?: string;
  sectionType?: string;
  isRequired?: boolean;
  isEditable?: boolean;
  aiPromptHint?: string;
}

/**
 * Template with sections for API responses.
 */
export type TemplateWithSections = ProposalTemplateSelect & {
  sections: TemplateSectionSelect[];
};

/**
 * Validate template type.
 */
function validateTemplateType(type: string): ProposalTemplateType {
  if (!PROPOSAL_TEMPLATE_TYPES.includes(type as ProposalTemplateType)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid template type: ${type}. Valid types: ${PROPOSAL_TEMPLATE_TYPES.join(", ")}`
    );
  }
  return type as ProposalTemplateType;
}

/**
 * Validate template category.
 */
function validateTemplateCategory(category: string): ProposalTemplateCategory {
  if (
    !PROPOSAL_TEMPLATE_CATEGORIES.includes(category as ProposalTemplateCategory)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid template category: ${category}. Valid categories: ${PROPOSAL_TEMPLATE_CATEGORIES.join(", ")}`
    );
  }
  return category as ProposalTemplateCategory;
}

/**
 * Validate section type.
 */
function validateSectionType(sectionType: string): string {
  if (
    !TEMPLATE_SECTION_TYPES.includes(
      sectionType as (typeof TEMPLATE_SECTION_TYPES)[number]
    )
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid section type: ${sectionType}. Valid types: ${TEMPLATE_SECTION_TYPES.join(", ")}`
    );
  }
  return sectionType;
}

/**
 * Validate variable definitions.
 */
function validateVariables(variables: VariableDefinition[]): void {
  const keys = new Set<string>();
  for (const variable of variables) {
    if (!variable.key || variable.key.trim() === "") {
      throw new AppError("VALIDATION_ERROR", "Variable key is required");
    }
    if (keys.has(variable.key)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Duplicate variable key: ${variable.key}`
      );
    }
    keys.add(variable.key);

    const validTypes = [
      "text",
      "number",
      "currency",
      "date",
      "list",
      "rich_text",
    ];
    if (!validTypes.includes(variable.type)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Invalid variable type: ${variable.type}. Valid types: ${validTypes.join(", ")}`
      );
    }

    const validCategories = [
      "client",
      "provider",
      "pricing",
      "audit",
      "dates",
      "custom",
    ];
    if (!validCategories.includes(variable.category)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Invalid variable category: ${variable.category}. Valid categories: ${validCategories.join(", ")}`
      );
    }
  }
}

/**
 * Template Service class with business logic methods.
 */
export class TemplateService {
  /**
   * List all templates available to a workspace.
   */
  static async listTemplates(
    workspaceId: string,
    options?: {
      type?: ProposalTemplateType;
      category?: ProposalTemplateCategory;
      includeArchived?: boolean;
    }
  ): Promise<ProposalTemplateSelect[]> {
    log.debug("Listing templates", { workspaceId, options });
    return await TemplateRepository.findAllTemplates(workspaceId, options);
  }

  /**
   * Get a template by ID with sections.
   */
  static async getTemplate(templateId: string): Promise<TemplateWithSections> {
    log.debug("Getting template", { templateId });

    const template = await TemplateRepository.findTemplateById(templateId);
    if (!template) {
      throw new AppError("NOT_FOUND", `Template not found: ${templateId}`);
    }

    return template;
  }

  /**
   * Get the default template for a workspace.
   */
  static async getDefaultTemplate(
    workspaceId: string,
    type: ProposalTemplateType = "proposal"
  ): Promise<TemplateWithSections | undefined> {
    log.debug("Getting default template", { workspaceId, type });
    return await TemplateRepository.findDefaultTemplate(workspaceId, type);
  }

  /**
   * Create a new template.
   */
  static async createTemplate(
    input: CreateTemplateInput
  ): Promise<TemplateWithSections> {
    log.info("Creating template", {
      workspaceId: input.workspaceId,
      name: input.name,
    });

    // Validate inputs
    const type = input.type
      ? validateTemplateType(input.type)
      : ("proposal" as ProposalTemplateType);
    const category = input.category
      ? validateTemplateCategory(input.category)
      : ("seo" as ProposalTemplateCategory);

    if (input.variables) {
      validateVariables(input.variables);
    }

    // Validate sections if provided
    const validatedSections = input.sections?.map((section, index) => {
      const sectionType = section.sectionType
        ? validateSectionType(section.sectionType)
        : "custom";
      return {
        id: crypto.randomUUID(),
        key: section.key,
        title: section.title,
        titleEn: section.titleEn,
        titleLt: section.titleLt,
        content: section.content ?? "",
        contentEn: section.contentEn,
        contentLt: section.contentLt,
        sectionType,
        isRequired: section.isRequired ?? false,
        isEditable: section.isEditable ?? true,
        position: section.position ?? index,
        aiPromptHint: section.aiPromptHint,
      };
    });

    // If setting as default, unset any existing defaults
    if (input.isDefault) {
      await this.clearDefaultTemplates(input.workspaceId, type);
    }

    const templateInsert: ProposalTemplateInsert = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      nameEn: input.nameEn,
      nameLt: input.nameLt,
      description: input.description,
      descriptionEn: input.descriptionEn,
      descriptionLt: input.descriptionLt,
      type,
      category,
      variables: input.variables ?? [],
      brandingSettings: input.brandingSettings,
      isDefault: input.isDefault ?? false,
      createdBy: input.createdBy,
    };

    const template = await TemplateRepository.createTemplate(
      templateInsert,
      validatedSections
    );

    log.info("Template created", { templateId: template.id });
    return template;
  }

  /**
   * Update a template.
   */
  static async updateTemplate(
    templateId: string,
    workspaceId: string,
    input: UpdateTemplateInput
  ): Promise<ProposalTemplateSelect> {
    log.info("Updating template", { templateId, workspaceId });

    // Verify ownership
    const existing = await TemplateRepository.findTemplateById(templateId);
    if (!existing) {
      throw new AppError("NOT_FOUND", `Template not found: ${templateId}`);
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AppError(
        "FORBIDDEN",
        "Cannot update template from another workspace"
      );
    }

    // Validate inputs
    if (input.type) {
      validateTemplateType(input.type);
    }
    if (input.category) {
      validateTemplateCategory(input.category);
    }
    if (input.variables) {
      validateVariables(input.variables);
    }

    // If setting as default, unset any existing defaults
    if (input.isDefault) {
      const type = input.type ?? (existing.type as ProposalTemplateType);
      await this.clearDefaultTemplates(workspaceId, type, templateId);
    }

    const updated = await TemplateRepository.updateTemplate(templateId, input);
    if (!updated) {
      throw new AppError("INTERNAL_ERROR", "Failed to update template");
    }

    log.info("Template updated", { templateId });
    return updated;
  }

  /**
   * Delete a template (soft delete).
   */
  static async deleteTemplate(
    templateId: string,
    workspaceId: string
  ): Promise<void> {
    log.info("Deleting template", { templateId, workspaceId });

    // Verify ownership
    const existing = await TemplateRepository.findTemplateById(templateId);
    if (!existing) {
      throw new AppError("NOT_FOUND", `Template not found: ${templateId}`);
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AppError(
        "FORBIDDEN",
        "Cannot delete template from another workspace"
      );
    }
    if (existing.workspaceId === null) {
      throw new AppError("FORBIDDEN", "Cannot delete system templates");
    }

    const success = await TemplateRepository.deleteTemplate(
      templateId,
      workspaceId
    );
    if (!success) {
      throw new AppError("INTERNAL_ERROR", "Failed to delete template");
    }

    log.info("Template deleted", { templateId });
  }

  /**
   * Duplicate a template to a workspace.
   */
  static async duplicateTemplate(
    templateId: string,
    targetWorkspaceId: string,
    newName?: string
  ): Promise<TemplateWithSections> {
    log.info("Duplicating template", { templateId, targetWorkspaceId });

    const duplicated = await TemplateRepository.duplicateTemplate(
      templateId,
      targetWorkspaceId,
      newName
    );
    if (!duplicated) {
      throw new AppError("NOT_FOUND", `Source template not found: ${templateId}`);
    }

    log.info("Template duplicated", {
      sourceId: templateId,
      newId: duplicated.id,
    });
    return duplicated;
  }

  /**
   * Add a section to a template.
   */
  static async addSection(
    templateId: string,
    workspaceId: string,
    input: CreateSectionInput
  ): Promise<TemplateSectionSelect> {
    log.info("Adding section to template", { templateId });

    // Verify ownership
    const existing = await TemplateRepository.findTemplateById(templateId);
    if (!existing) {
      throw new AppError("NOT_FOUND", `Template not found: ${templateId}`);
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AppError(
        "FORBIDDEN",
        "Cannot modify template from another workspace"
      );
    }

    const sectionType = input.sectionType
      ? validateSectionType(input.sectionType)
      : "custom";

    const sectionInsert: TemplateSectionInsert = {
      id: crypto.randomUUID(),
      templateId,
      key: input.key,
      title: input.title,
      titleEn: input.titleEn,
      titleLt: input.titleLt,
      content: input.content ?? "",
      contentEn: input.contentEn,
      contentLt: input.contentLt,
      sectionType,
      isRequired: input.isRequired ?? false,
      isEditable: input.isEditable ?? true,
      position: input.position ?? existing.sections.length,
      aiPromptHint: input.aiPromptHint,
    };

    const section = await TemplateRepository.createSection(sectionInsert);
    log.info("Section added", { sectionId: section.id, templateId });
    return section;
  }

  /**
   * Update a section.
   */
  static async updateSection(
    sectionId: string,
    templateId: string,
    workspaceId: string,
    input: UpdateSectionInput
  ): Promise<TemplateSectionSelect> {
    log.info("Updating section", { sectionId, templateId });

    // Verify ownership
    const existing = await TemplateRepository.findTemplateById(templateId);
    if (!existing) {
      throw new AppError("NOT_FOUND", `Template not found: ${templateId}`);
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AppError(
        "FORBIDDEN",
        "Cannot modify template from another workspace"
      );
    }

    if (input.sectionType) {
      validateSectionType(input.sectionType);
    }

    const updated = await TemplateRepository.updateSection(sectionId, input);
    if (!updated) {
      throw new AppError("NOT_FOUND", `Section not found: ${sectionId}`);
    }

    log.info("Section updated", { sectionId, templateId });
    return updated;
  }

  /**
   * Delete a section from a template.
   */
  static async deleteSection(
    sectionId: string,
    templateId: string,
    workspaceId: string
  ): Promise<void> {
    log.info("Deleting section", { sectionId, templateId });

    // Verify ownership
    const existing = await TemplateRepository.findTemplateById(templateId);
    if (!existing) {
      throw new AppError("NOT_FOUND", `Template not found: ${templateId}`);
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AppError(
        "FORBIDDEN",
        "Cannot modify template from another workspace"
      );
    }

    const success = await TemplateRepository.deleteSection(
      sectionId,
      templateId
    );
    if (!success) {
      throw new AppError("NOT_FOUND", `Section not found: ${sectionId}`);
    }

    log.info("Section deleted", { sectionId, templateId });
  }

  /**
   * Reorder sections in a template.
   */
  static async reorderSections(
    templateId: string,
    workspaceId: string,
    sectionOrder: string[]
  ): Promise<ProposalTemplateSelect> {
    log.info("Reordering sections", { templateId });

    // Verify ownership
    const existing = await TemplateRepository.findTemplateById(templateId);
    if (!existing) {
      throw new AppError("NOT_FOUND", `Template not found: ${templateId}`);
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AppError(
        "FORBIDDEN",
        "Cannot modify template from another workspace"
      );
    }

    // Validate all section IDs exist in the template
    const existingSectionIds = new Set(existing.sections.map((s) => s.id));
    for (const id of sectionOrder) {
      if (!existingSectionIds.has(id)) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Section ${id} does not belong to template ${templateId}`
        );
      }
    }

    const updated = await TemplateRepository.updateSectionOrder(
      templateId,
      sectionOrder
    );
    if (!updated) {
      throw new AppError("INTERNAL_ERROR", "Failed to reorder sections");
    }

    log.info("Sections reordered", { templateId });
    return updated;
  }

  /**
   * Clear default flag from all templates of a given type in a workspace.
   */
  private static async clearDefaultTemplates(
    workspaceId: string,
    type: ProposalTemplateType,
    exceptTemplateId?: string
  ): Promise<void> {
    const templates = await TemplateRepository.findAllTemplates(workspaceId, {
      type,
    });
    for (const template of templates) {
      if (template.isDefault && template.id !== exceptTemplateId) {
        await TemplateRepository.updateTemplate(template.id, {
          isDefault: false,
        });
      }
    }
  }
}
