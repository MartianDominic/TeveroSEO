/**
 * Proposal editor components.
 * Phase 57: Proposal Editor Revolution
 */

// Core components
export { ProposalInlineEditor } from "./ProposalInlineEditor";
export type { ProposalInlineEditorProps } from "./ProposalInlineEditor";

export { ProposalPreview } from "./ProposalPreview";

// Variable system (57-02, 57-03)
export { VariablePalette } from "./VariablePalette";
export type { VariableItem, VariableCategory } from "./VariablePalette";

export { VariableChip, VariableChipDisplay } from "./VariableChip";
export type { VariableChipDisplayProps } from "./VariableChip";

// Drag-and-drop sections (57-04)
export { SectionList } from "./SectionList";
export type { SectionListProps } from "./SectionList";

export { SortableSection } from "./SortableSection";
export type { SortableSectionProps } from "./SortableSection";

export { SectionHandle, GripIcon } from "./SectionHandle";
export type { SectionHandleProps } from "./SectionHandle";

// Hooks
export { useSectionOrder } from "./useSectionOrder";
export type {
  UseSectionOrderProps,
  UseSectionOrderReturn,
  SaveStatus,
} from "./useSectionOrder";

// Types
export type {
  EditorSection,
  SectionReorderEvent,
  SectionUpdateEvent,
  TemplateSectionType,
  TEMPLATE_SECTION_TYPES,
} from "./types";
