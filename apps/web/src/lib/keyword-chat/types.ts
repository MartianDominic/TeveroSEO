/**
 * Keyword Analysis Chat Types
 * Phase 82: Chat Integration
 */

// Analysis stages match the pipeline phases 75-81
export type AnalysisStage =
  | 'idle'
  | 'extracting_constraints' // Phase 75
  | 'classifying_funnel' // Phase 76
  | 'classifying_geo' // Phase 77
  | 'scoring_relevance' // Phase 78
  | 'filtering' // Phase 79
  | 'selecting' // Phase 80
  | 'discovering_pseo' // Phase 81
  | 'discovering_side_keywords' // Phase 81
  | 'complete';

// Stage weights for progress calculation
export const STAGE_WEIGHTS: Record<AnalysisStage, number> = {
  idle: 0,
  extracting_constraints: 5,
  classifying_funnel: 25,
  classifying_geo: 35,
  scoring_relevance: 50,
  filtering: 65,
  selecting: 75,
  discovering_pseo: 85,
  discovering_side_keywords: 95,
  complete: 100,
};

// SSE event types
export interface ProgressEvent {
  type: 'progress';
  stage: AnalysisStage;
  progress: number;
  message?: string;
}

export interface PartialEvent {
  type: 'partial';
  data: Partial<AnalysisResult>;
}

export interface CompleteEvent {
  type: 'complete';
  data: AnalysisResult;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  stage?: AnalysisStage;
}

export type AnalysisEvent =
  | ProgressEvent
  | PartialEvent
  | CompleteEvent
  | ErrorEvent;

// Request/Response types
export interface AnalyzeRequest {
  clientId: string;
  conversation: string;
  keywords: string[];
  config?: AnalysisConfig;
}

export interface AnalysisConfig {
  targetCount?: number;
  cascadePreset?: 'default' | 'service' | 'ecommerce' | 'content';
  enablePSEODetection?: boolean;
  enableSideKeywords?: boolean;
  enableProductLinkage?: boolean;
}

// Constraint types (from Phase 75)
export interface AnalysisConstraints {
  businessType: string;
  coreOffering: string;
  problemsSolved: string[];
  categories: string[];
  geoConstraints: GeoConstraints;
  audienceType: 'B2B' | 'B2C' | 'both';
  funnelPreference: 'BOFU' | 'MOFU' | 'TOFU' | 'balanced';
  priorityCategories: string[];
  confidence: number;
}

export interface GeoConstraints {
  includeCities: string[];
  excludeCities: string[];
  scope: 'local' | 'regional' | 'national';
  allowGeneric: boolean;
}

// Result types
export interface AnalysisResult {
  sessionId: string;
  constraints: AnalysisConstraints;
  funnelBreakdown: FunnelBreakdown;
  geoBreakdown: GeoBreakdown;
  selection: SelectionResult;
  filtering: FilteringResult;
  pseoOpportunities: PSEOOpportunity[];
  sideKeywords: SideKeyword[];
  stats: AnalysisStats;
}

export interface FunnelBreakdown {
  bofu: number;
  mofu: number;
  tofu: number;
}

export interface GeoBreakdown {
  byCity: Record<string, number>;
  generic: number;
  nearMe: number;
}

export interface SelectionResult {
  selected: SelectedKeyword[];
  breakdown: SelectionBreakdown;
}

export interface SelectedKeyword {
  keyword: string;
  funnelStage: 'BOFU' | 'MOFU' | 'TOFU';
  metrics: KeywordMetrics;
  compositeScore: number;
  cascadePosition: number;
}

export interface KeywordMetrics {
  volume: number;
  difficulty: number;
  cpc?: number;
}

export interface SelectionBreakdown {
  total: number;
  byStage: FunnelBreakdown;
  averageScore: number;
}

export interface FilteringResult {
  passed: number;
  excluded: ExcludedKeyword[];
}

export interface ExcludedKeyword {
  keyword: string;
  exclusionReason: string;
  exclusionStage: string;
  humanReadable: string;
}

export interface PSEOOpportunity {
  pattern: string;
  template: string;
  keywords: string[];
  estimatedPages: number;
  totalVolume: number;
  opportunityScore: number;
}

export interface SideKeyword {
  keyword: string;
  sourceType: 'problem' | 'solution' | 'related';
  relevanceScore: number;
  volume?: number;
}

export interface AnalysisStats {
  totalKeywords: number;
  processedKeywords: number;
  selectedCount: number;
  excludedCount: number;
  processingTimeMs: number;
}
