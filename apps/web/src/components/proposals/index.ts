/**
 * Proposal editor components.
 * Phase 57: Proposal Editor Revolution
 */

// Core components
export { ProposalInlineEditor } from "./ProposalInlineEditor";
export type { ProposalInlineEditorProps } from "./ProposalInlineEditor";

// Lazy-loaded editor (recommended for better bundle splitting)
export { LazyProposalInlineEditor, ProposalEditorSkeleton } from "./LazyProposalInlineEditor";

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

// Add Section Menu (57-05)
export { AddSectionMenu } from "./AddSectionMenu";
export type { AddSectionMenuProps, CustomSectionType } from "./AddSectionMenu";
export { CUSTOM_SECTION_TYPES, SECTION_TYPE_CONFIGS } from "./AddSectionMenu";

// Custom Section Components (57-05)
export {
  TextSection,
  ImageSection,
  TestimonialSection,
  CaseStudySection,
  VideoSection,
  ComparisonSection,
  TimelineSection,
  DEFAULT_SECTION_DATA,
} from "./sections";
export type {
  TextSectionData,
  ImageSectionData,
  TestimonialSectionData,
  CaseStudyMetric,
  CaseStudySectionData,
  VideoPlatform,
  VideoSectionData,
  ComparisonItem,
  ComparisonSectionData,
  TimelinePhase,
  TimelineSectionData,
  CustomSectionData,
} from "./sections";

// Delete Confirmation Dialog (57-05)
export { DeleteSectionDialog } from "./DeleteSectionDialog";
export type { DeleteSectionDialogProps } from "./DeleteSectionDialog";

// Undo/Redo Buttons (57-08)
export { UndoRedoButtons } from "./UndoRedoButtons";
export type { UndoRedoButtonsProps } from "./UndoRedoButtons";

// Duplicate Button (57-08)
export { DuplicateButton } from "./DuplicateButton";
export type { DuplicateButtonProps } from "./DuplicateButton";

// Share Modal (57-08)
export { ShareModal } from "./ShareModal";
export type { ShareModalProps } from "./ShareModal";

// AI Generation Modal (57-07) - Decomposed
export { AIGenerationModal } from "./AIGenerationModal";
export type {
  AIGenerationModalProps,
  GenerationRequest,
  ContextType,
  GeneratableSectionType,
  TonePreset,
  GenerationLanguage,
} from "./AIGenerationModal";

// AI Generation sub-components
export { ContextSelectionGrid, type ContextItem } from "./ContextSelectionGrid";
export { SectionSelectionList } from "./SectionSelectionList";
export { ToneLanguageSelectors } from "./ToneLanguageSelectors";
export {
  CONTEXT_CONFIGS,
  SECTION_CONFIGS,
  TONE_CONFIGS,
  LANGUAGE_OPTIONS,
  getLocalizedLabel,
  getLocalizedDescription,
  getUILabels,
} from "./ai-generation-config";

// Tiered AI Proposal Generation (101-06)
export { ProposalModeSelector, ProposalGenerationMode } from "./ProposalModeSelector";
export type { ProposalGenerationModeType } from "./ProposalModeSelector";

export { TemplateSelector } from "./TemplateSelector";
export type {
  ProposalTemplate,
  TemplatePackage,
} from "./TemplateSelector";
