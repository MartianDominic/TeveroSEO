/**
 * Cascade Selection Module
 * Phase 80-01: BOFU-first keyword selection with configurable fallback
 *
 * Central export point for cascade selection functionality.
 */

// Types
export type {
  FunnelStage,
  StageConfig,
  CascadeConfig,
  SelectedKeyword,
  ExcludedKeyword,
  ExclusionReason,
  StageBreakdown,
  SelectionBreakdown,
  SelectionResult,
} from './types';

// Presets
export {
  DEFAULT_CASCADE,
  SERVICE_CASCADE,
  ECOMMERCE_CASCADE,
  CONTENT_CASCADE,
} from './presets';

// Cascade Selector
export { CascadeSelector, cascadeSelector } from './CascadeSelector';
