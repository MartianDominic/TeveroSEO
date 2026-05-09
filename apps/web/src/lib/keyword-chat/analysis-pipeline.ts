/**
 * Analysis Pipeline Orchestrator
 * Phase 82: Chat Integration
 *
 * Orchestrates the full keyword analysis pipeline (Phases 75-81)
 * with progress streaming via StageEmitter.
 *
 * NOTE: This is a stub implementation. The actual service calls
 * to Phase 75-81 services will be wired when those phases complete.
 * For now, simulate the pipeline stages with realistic delays.
 */

import { nanoid } from 'nanoid';

import { StageEmitter } from './stage-emitter';

import type {
  AnalyzeRequest,
  AnalysisResult,
  AnalysisConstraints,
  FunnelBreakdown,
  GeoBreakdown,
  SelectionResult,
  FilteringResult,
  PSEOOpportunity,
  SideKeyword,
} from './types';

export interface AnalysisPipelineConfig {
  emitter: StageEmitter;
  // Future: inject actual services
  // conversationIntelligence?: ConversationIntelligenceService;
  // funnelClassifier?: FunnelClassifierService;
  // geoClassifier?: GeoClassifierService;
  // relevanceScorer?: RelevanceScorerService;
  // constraintFilter?: ConstraintFilterService;
  // cascadeSelector?: CascadeSelectorService;
  // pseoDetector?: PSEODetectorService;
  // sideKeywordExpander?: SideKeywordExpanderService;
}

export class AnalysisPipeline {
  private emitter: StageEmitter;
  private startTime: number = 0;

  constructor(config: AnalysisPipelineConfig) {
    this.emitter = config.emitter;
  }

  async run(request: AnalyzeRequest): Promise<AnalysisResult> {
    this.startTime = Date.now();
    const sessionId = nanoid();

    try {
      // Stage 1: Extract constraints (Phase 75)
      await this.emitter.progress(
        'extracting_constraints',
        'Analyzing conversation...'
      );
      const constraints = await this.extractConstraints(request.conversation);
      await this.emitter.partial({ constraints });

      // Stage 2: Classify funnel (Phase 76)
      await this.emitter.progress(
        'classifying_funnel',
        'Classifying funnel stages...'
      );
      const funnelBreakdown = await this.classifyFunnel(
        request.keywords,
        constraints
      );
      await this.emitter.partial({ funnelBreakdown });

      // Stage 3: Classify geo (Phase 77)
      await this.emitter.progress(
        'classifying_geo',
        'Extracting geographic signals...'
      );
      const geoBreakdown = await this.classifyGeo(
        request.keywords,
        constraints
      );
      await this.emitter.partial({ geoBreakdown });

      // Stage 4: Score relevance (Phase 78)
      await this.emitter.progress(
        'scoring_relevance',
        'Scoring keyword relevance...'
      );
      // Relevance scoring happens internally, no partial emit needed

      // Stage 5: Filter constraints (Phase 79)
      await this.emitter.progress('filtering', 'Applying filters...');
      const filtering = await this.filterConstraints(
        request.keywords,
        constraints
      );
      await this.emitter.partial({
        filtering: {
          passed: filtering.passed,
          excluded: filtering.excluded.slice(0, 10), // Preview first 10
        },
      });

      // Stage 6: Cascade selection (Phase 80)
      await this.emitter.progress('selecting', 'Selecting top keywords...');
      const selection = await this.cascadeSelect(
        filtering.passed,
        request.config?.targetCount ?? 100
      );
      await this.emitter.partial({
        selection: {
          selected: selection.selected.slice(0, 10), // Preview top 10
          breakdown: selection.breakdown,
        },
      });

      // Stage 7: pSEO detection (Phase 81)
      let pseoOpportunities: PSEOOpportunity[] = [];
      if (request.config?.enablePSEODetection !== false) {
        await this.emitter.progress(
          'discovering_pseo',
          'Detecting pSEO opportunities...'
        );
        pseoOpportunities = await this.detectPSEO(selection.selected);
        await this.emitter.partial({ pseoOpportunities });
      }

      // Stage 8: Side keyword discovery (Phase 81)
      let sideKeywords: SideKeyword[] = [];
      if (request.config?.enableSideKeywords !== false) {
        await this.emitter.progress(
          'discovering_side_keywords',
          'Discovering side keywords...'
        );
        sideKeywords = await this.discoverSideKeywords(constraints);
        await this.emitter.partial({ sideKeywords });
      }

      // Complete
      const processingTimeMs = Date.now() - this.startTime;
      const result: AnalysisResult = {
        sessionId,
        constraints,
        funnelBreakdown,
        geoBreakdown,
        selection,
        filtering,
        pseoOpportunities,
        sideKeywords,
        stats: {
          totalKeywords: request.keywords.length,
          processedKeywords: request.keywords.length,
          selectedCount: selection.selected.length,
          excludedCount: filtering.excluded.length,
          processingTimeMs,
        },
      };

      await this.emitter.complete(result);
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Analysis failed';
      await this.emitter.error(message);
      throw error;
    }
  }

  // Stub implementations - will be replaced with actual service calls

  private async extractConstraints(
    _conversation: string
  ): Promise<AnalysisConstraints> {
    // TODO: Wire to Phase 75 ConversationIntelligenceService
    await this.delay(100);
    return {
      businessType: 'service',
      coreOffering: 'car wash',
      problemsSolved: ['dirty vehicles', 'time saving'],
      categories: ['car wash', 'auto detailing'],
      geoConstraints: {
        includeCities: ['siauliai'],
        excludeCities: [],
        scope: 'local',
        allowGeneric: false,
      },
      audienceType: 'B2B',
      funnelPreference: 'BOFU',
      priorityCategories: ['fleet services'],
      confidence: 0.85,
    };
  }

  private async classifyFunnel(
    keywords: string[],
    _constraints: AnalysisConstraints
  ): Promise<FunnelBreakdown> {
    // TODO: Wire to Phase 76 FunnelClassifierService
    await this.delay(80);
    const total = keywords.length;
    return {
      bofu: Math.floor(total * 0.3),
      mofu: Math.floor(total * 0.45),
      tofu: Math.floor(total * 0.25),
    };
  }

  private async classifyGeo(
    keywords: string[],
    _constraints: AnalysisConstraints
  ): Promise<GeoBreakdown> {
    // TODO: Wire to Phase 77 GeoClassifierService
    await this.delay(60);
    return {
      byCity: { siauliai: Math.floor(keywords.length * 0.4) },
      generic: Math.floor(keywords.length * 0.5),
      nearMe: Math.floor(keywords.length * 0.1),
    };
  }

  private async filterConstraints(
    keywords: string[],
    _constraints: AnalysisConstraints
  ): Promise<FilteringResult> {
    // TODO: Wire to Phase 79 ConstraintFilterService
    await this.delay(70);
    const passed = Math.floor(keywords.length * 0.6);
    const excluded = keywords.length - passed;

    return {
      passed,
      excluded: Array.from({ length: Math.min(excluded, 50) }, (_, i) => ({
        keyword: `excluded_keyword_${i}`,
        exclusionReason: 'wrong_city',
        exclusionStage: 'geo_filter',
        humanReadable: 'Keyword targets wrong geographic area',
      })),
    };
  }

  private async cascadeSelect(
    passedCount: number,
    targetCount: number
  ): Promise<SelectionResult> {
    // TODO: Wire to Phase 80 CascadeSelectorService
    await this.delay(60);
    const selected = Math.min(passedCount, targetCount);

    return {
      selected: Array.from({ length: selected }, (_, i) => ({
        keyword: `selected_keyword_${i}`,
        funnelStage:
          i < selected * 0.6 ? 'BOFU' : i < selected * 0.9 ? 'MOFU' : 'TOFU',
        metrics: { volume: 1000 - i * 10, difficulty: 30 + i * 0.5 },
        compositeScore: 0.9 - i * 0.005,
        cascadePosition: i + 1,
      })),
      breakdown: {
        total: selected,
        byStage: {
          bofu: Math.floor(selected * 0.6),
          mofu: Math.floor(selected * 0.3),
          tofu: Math.floor(selected * 0.1),
        },
        averageScore: 0.75,
      },
    };
  }

  private async detectPSEO(
    _selected: SelectionResult['selected']
  ): Promise<PSEOOpportunity[]> {
    // TODO: Wire to Phase 81 PSEODetectorService
    await this.delay(80);
    return [
      {
        pattern: '[service] [CITY]',
        template: 'Location-based service pages',
        keywords: [
          'automobiliu plovykla siauliuose',
          'automobiliu plovykla kaune',
        ],
        estimatedPages: 50,
        totalVolume: 5000,
        opportunityScore: 0.85,
      },
    ];
  }

  private async discoverSideKeywords(
    _constraints: AnalysisConstraints
  ): Promise<SideKeyword[]> {
    // TODO: Wire to Phase 81 SideKeywordExpanderService
    await this.delay(60);
    return [
      {
        keyword: 'kaip isvalyti automobili',
        sourceType: 'problem',
        relevanceScore: 0.7,
        volume: 500,
      },
      {
        keyword: 'automobilio valymo paslaugos',
        sourceType: 'solution',
        relevanceScore: 0.8,
        volume: 300,
      },
    ];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function for running analysis pipeline.
 * Use this in the API route.
 */
export async function runAnalysisPipeline(
  request: AnalyzeRequest,
  emitter: StageEmitter
): Promise<AnalysisResult> {
  const pipeline = new AnalysisPipeline({ emitter });
  return pipeline.run(request);
}
