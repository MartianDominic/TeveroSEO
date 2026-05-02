/**
 * Types for proposal editor components.
 * Phase 57-04: Drag-and-Drop Sections
 *
 * Shared type definitions for the proposal editor system.
 */

/**
 * Template section types.
 * Mirrors open-seo-main/src/db/proposal-template-schema.ts TEMPLATE_SECTION_TYPES.
 */
export const TEMPLATE_SECTION_TYPES = [
  "hero",
  "introduction",
  "current_state",
  "opportunities",
  "methodology",
  "timeline",
  "pricing",
  "case_studies",
  "team",
  "next_steps",
  "terms",
  "custom",
] as const;

export type TemplateSectionType = (typeof TEMPLATE_SECTION_TYPES)[number];

/**
 * Editor section representation.
 * Used in the UI for drag-and-drop reordering.
 */
export interface EditorSection {
  /** Unique section identifier */
  id: string;
  /** Section key (e.g., 'hero', 'opportunities', 'custom_1') */
  key: string;
  /** Display title (localized) */
  title: string;
  /** Rich text content (HTML with variable placeholders) */
  content: string;
  /** Section type for styling and behavior */
  sectionType: TemplateSectionType;
  /** Whether this section can be deleted */
  isRequired?: boolean;
  /** Whether this section can be edited */
  isEditable?: boolean;
  /** Position in the section order */
  position?: number;
}

/**
 * Section reorder event payload.
 */
export interface SectionReorderEvent {
  /** Section that was moved */
  sectionId: string;
  /** Previous index */
  fromIndex: number;
  /** New index */
  toIndex: number;
  /** New order of all section IDs */
  newOrder: string[];
}

/**
 * Section update event payload.
 */
export interface SectionUpdateEvent {
  /** Section that was updated */
  sectionId: string;
  /** New content */
  content: string;
  /** Change description for version history */
  changeDescription?: string;
}
