/**
 * Document Builder Components
 * Phase 102-02: Block Palette and Canvas
 * Phase 102-03: AI Content Generation
 * Phase 102-04: Analytics and Heatmap
 * Phase 102-05: A/B Testing UI and Version Diff
 *
 * Public exports for the document builder feature.
 */

export { BlockPalette, type BlockPaletteProps } from "./BlockPalette";
export { BlockTypeBadge, type BlockTypeBadgeProps } from "./BlockTypeBadge";
export { DocumentCanvas, type DocumentCanvasProps } from "./DocumentCanvas";
export { DropZone, type DropZoneProps } from "./DropZone";
export { PersuasionBlock, type PersuasionBlockProps } from "./PersuasionBlock";

// Phase 102-03: AI Content Generation
export { BlockEditor, type BlockEditorProps } from "./BlockEditor";

// Lazy-loaded editor (recommended for better bundle splitting)
export { LazyBlockEditor, BlockEditorSkeleton } from "./LazyBlockEditor";

// Phase 102-04: Framework and Analytics
export { FrameworkSelector, type FrameworkSelectorProps } from "./FrameworkSelector";
export { HeatmapOverlay, type HeatmapOverlayProps } from "./HeatmapOverlay";

// Phase 102-05: A/B Testing
export { VariantCreator, type VariantCreatorProps } from "./VariantCreator";
export { VariantTabs, type VariantTabsProps } from "./VariantTabs";
export { VersionDiff, type VersionDiffProps, type VersionData, type VersionBlock } from "./VersionDiff";

// Error boundary wrapped components (recommended for production use)
// H-ERR-01: SafePersuasionBlock wraps individual blocks to prevent cascade failures
export {
  SafeDocumentCanvas,
  SafeBlockEditor,
  SafeVariantTabs,
  SafePersuasionBlock,
} from "./SafeComponents";
