/**
 * Tests for Analysis Pipeline Orchestrator
 * Phase 82: Chat Integration - RED phase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisPipeline, runAnalysisPipeline } from '../analysis-pipeline';
import { StageEmitter, type EventCallback } from '../stage-emitter';
import type { AnalysisEvent, AnalyzeRequest, AnalysisStage } from '../types';

describe('AnalysisPipeline', () => {
  let events: AnalysisEvent[];
  let callback: EventCallback;
  let emitter: StageEmitter;

  beforeEach(() => {
    events = [];
    callback = vi.fn(async (event: AnalysisEvent) => {
      events.push(event);
    });
    emitter = new StageEmitter(callback);
  });

  const createRequest = (overrides?: Partial<AnalyzeRequest>): AnalyzeRequest => ({
    clientId: 'test-client-id',
    conversation: 'We are a car wash in Siauliai serving B2B clients',
    keywords: ['automobiliu plovykla', 'car wash siauliai'],
    ...overrides,
  });

  describe('constructor', () => {
    it('should accept StageEmitter', () => {
      const pipeline = new AnalysisPipeline({ emitter });
      expect(pipeline).toBeInstanceOf(AnalysisPipeline);
    });
  });

  describe('run()', () => {
    it('should call each stage in order', async () => {
      const pipeline = new AnalysisPipeline({ emitter });
      const request = createRequest();

      await pipeline.run(request);

      // Extract progress events and their stages
      const progressEvents = events.filter(
        (e): e is Extract<AnalysisEvent, { type: 'progress' }> => e.type === 'progress'
      );
      const stages = progressEvents.map(e => e.stage);

      // Verify all stages are called in order
      expect(stages).toContain('extracting_constraints');
      expect(stages).toContain('classifying_funnel');
      expect(stages).toContain('classifying_geo');
      expect(stages).toContain('scoring_relevance');
      expect(stages).toContain('filtering');
      expect(stages).toContain('selecting');
    });

    it('should emit progress events at correct percentages', async () => {
      const pipeline = new AnalysisPipeline({ emitter });
      const request = createRequest();

      await pipeline.run(request);

      const progressEvents = events.filter(
        (e): e is Extract<AnalysisEvent, { type: 'progress' }> => e.type === 'progress'
      );

      // Verify progress increases
      let lastProgress = 0;
      for (const event of progressEvents) {
        expect(event.progress).toBeGreaterThanOrEqual(lastProgress);
        lastProgress = event.progress;
      }

      // Verify specific stage weights
      const extractConstraints = progressEvents.find(
        e => e.stage === 'extracting_constraints'
      );
      expect(extractConstraints?.progress).toBe(5);

      const filtering = progressEvents.find(e => e.stage === 'filtering');
      expect(filtering?.progress).toBe(65);
    });

    it('should emit partial results after each major stage', async () => {
      const pipeline = new AnalysisPipeline({ emitter });
      const request = createRequest();

      await pipeline.run(request);

      const partialEvents = events.filter(
        (e): e is Extract<AnalysisEvent, { type: 'partial' }> => e.type === 'partial'
      );

      // Should have multiple partial events
      expect(partialEvents.length).toBeGreaterThan(3);

      // Verify constraints are in first partial
      const constraintsPartial = partialEvents.find(e => e.data.constraints);
      expect(constraintsPartial).toBeDefined();
      expect(constraintsPartial?.data.constraints?.businessType).toBeDefined();

      // Verify funnel breakdown in a partial
      const funnelPartial = partialEvents.find(e => e.data.funnelBreakdown);
      expect(funnelPartial).toBeDefined();

      // Verify selection in a partial
      const selectionPartial = partialEvents.find(e => e.data.selection);
      expect(selectionPartial).toBeDefined();
    });

    it('should emit complete event with full result', async () => {
      const pipeline = new AnalysisPipeline({ emitter });
      const request = createRequest();

      const result = await pipeline.run(request);

      const completeEvent = events.find(
        (e): e is Extract<AnalysisEvent, { type: 'complete' }> => e.type === 'complete'
      );

      expect(completeEvent).toBeDefined();
      expect(completeEvent?.data).toEqual(result);
      expect(result.sessionId).toBeDefined();
      expect(result.constraints).toBeDefined();
      expect(result.funnelBreakdown).toBeDefined();
      expect(result.geoBreakdown).toBeDefined();
      expect(result.selection).toBeDefined();
      expect(result.filtering).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('should include processing stats in result', async () => {
      const pipeline = new AnalysisPipeline({ emitter });
      const request = createRequest({ keywords: ['kw1', 'kw2', 'kw3'] });

      const result = await pipeline.run(request);

      expect(result.stats.totalKeywords).toBe(3);
      expect(result.stats.processedKeywords).toBe(3);
      expect(result.stats.processingTimeMs).toBeGreaterThan(0);
    });

    it('should skip pSEO detection when disabled', async () => {
      const pipeline = new AnalysisPipeline({ emitter });
      const request = createRequest({
        config: { enablePSEODetection: false },
      });

      const result = await pipeline.run(request);

      // pSEO opportunities should be empty when disabled
      expect(result.pseoOpportunities).toEqual([]);

      // Should not emit discovering_pseo stage
      const progressEvents = events.filter(
        (e): e is Extract<AnalysisEvent, { type: 'progress' }> => e.type === 'progress'
      );
      const pseoStage = progressEvents.find(e => e.stage === 'discovering_pseo');
      expect(pseoStage).toBeUndefined();
    });

    it('should skip side keywords when disabled', async () => {
      const pipeline = new AnalysisPipeline({ emitter });
      const request = createRequest({
        config: { enableSideKeywords: false },
      });

      const result = await pipeline.run(request);

      expect(result.sideKeywords).toEqual([]);

      const progressEvents = events.filter(
        (e): e is Extract<AnalysisEvent, { type: 'progress' }> => e.type === 'progress'
      );
      const sideKwStage = progressEvents.find(
        e => e.stage === 'discovering_side_keywords'
      );
      expect(sideKwStage).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should emit error event on failure', async () => {
      const brokenCallback: EventCallback = async (event) => {
        events.push(event);
        if (
          event.type === 'progress' &&
          event.stage === 'classifying_funnel'
        ) {
          throw new Error('Funnel classification failed');
        }
      };
      const brokenEmitter = new StageEmitter(brokenCallback);
      const pipeline = new AnalysisPipeline({ emitter: brokenEmitter });

      await expect(pipeline.run(createRequest())).rejects.toThrow(
        'Funnel classification failed'
      );

      const errorEvent = events.find(
        (e): e is Extract<AnalysisEvent, { type: 'error' }> => e.type === 'error'
      );
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.message).toContain('Funnel classification failed');
    });
  });
});

describe('runAnalysisPipeline', () => {
  it('should be a factory function that runs the pipeline', async () => {
    const events: AnalysisEvent[] = [];
    const callback: EventCallback = async (event) => {
      events.push(event);
    };
    const emitter = new StageEmitter(callback);

    const request: AnalyzeRequest = {
      clientId: 'test-client',
      conversation: 'Test conversation',
      keywords: ['test keyword'],
    };

    const result = await runAnalysisPipeline(request, emitter);

    expect(result).toBeDefined();
    expect(result.sessionId).toBeDefined();
    expect(events.length).toBeGreaterThan(0);
  });
});
