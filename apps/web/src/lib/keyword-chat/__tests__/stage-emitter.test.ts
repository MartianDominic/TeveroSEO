/**
 * Tests for StageEmitter
 * Phase 82: Chat Integration - RED phase
 */

import { describe, it, expect, vi } from 'vitest';
import { StageEmitter, type EventCallback } from '../stage-emitter';
import type { AnalysisEvent, AnalysisResult } from '../types';

describe('StageEmitter', () => {
  const createMockCallback = (): {
    callback: EventCallback;
    events: AnalysisEvent[];
  } => {
    const events: AnalysisEvent[] = [];
    const callback: EventCallback = async (event) => {
      events.push(event);
    };
    return { callback, events };
  };

  describe('constructor', () => {
    it('should accept a callback', () => {
      const { callback } = createMockCallback();
      const emitter = new StageEmitter(callback);
      expect(emitter).toBeInstanceOf(StageEmitter);
    });
  });

  describe('progress()', () => {
    it('should emit progress event via callback', async () => {
      const { callback, events } = createMockCallback();
      const emitter = new StageEmitter(callback);

      await emitter.progress('extracting_constraints', 'Analyzing...');

      expect(events.length).toBe(1);
      expect(events[0]).toEqual({
        type: 'progress',
        stage: 'extracting_constraints',
        progress: 5, // STAGE_WEIGHTS['extracting_constraints']
        message: 'Analyzing...',
      });
    });

    it('should track current stage and progress', async () => {
      const { callback } = createMockCallback();
      const emitter = new StageEmitter(callback);

      await emitter.progress('filtering');

      const state = emitter.getState();
      expect(state.stage).toBe('filtering');
      expect(state.progress).toBe(65); // STAGE_WEIGHTS['filtering']
    });

    it('should emit correct progress percentage for each stage', async () => {
      const { callback, events } = createMockCallback();
      const emitter = new StageEmitter(callback);

      await emitter.progress('idle');
      await emitter.progress('extracting_constraints');
      await emitter.progress('classifying_funnel');
      await emitter.progress('complete');

      expect(events.map(e => (e as { progress: number }).progress)).toEqual([0, 5, 25, 100]);
    });
  });

  describe('partial()', () => {
    it('should emit partial event with data', async () => {
      const { callback, events } = createMockCallback();
      const emitter = new StageEmitter(callback);

      const partialData = { constraints: { businessType: 'service' } };
      await emitter.partial(partialData as Partial<AnalysisResult>);

      expect(events.length).toBe(1);
      expect(events[0]).toEqual({
        type: 'partial',
        data: partialData,
      });
    });
  });

  describe('complete()', () => {
    it('should emit complete event with full result', async () => {
      const { callback, events } = createMockCallback();
      const emitter = new StageEmitter(callback);

      const result = {
        sessionId: 'test-123',
        constraints: {} as never,
        funnelBreakdown: { bofu: 10, mofu: 20, tofu: 5 },
        geoBreakdown: { byCity: {}, generic: 0, nearMe: 0 },
        selection: {} as never,
        filtering: {} as never,
        pseoOpportunities: [],
        sideKeywords: [],
        stats: {} as never,
      } as AnalysisResult;

      await emitter.complete(result);

      expect(events.length).toBe(1);
      expect(events[0]).toEqual({
        type: 'complete',
        data: result,
      });
    });

    it('should set stage to complete and progress to 100', async () => {
      const { callback } = createMockCallback();
      const emitter = new StageEmitter(callback);

      await emitter.complete({} as AnalysisResult);

      const state = emitter.getState();
      expect(state.stage).toBe('complete');
      expect(state.progress).toBe(100);
    });
  });

  describe('error()', () => {
    it('should emit error event with message', async () => {
      const { callback, events } = createMockCallback();
      const emitter = new StageEmitter(callback);

      await emitter.error('Something went wrong');

      expect(events.length).toBe(1);
      expect(events[0]).toEqual({
        type: 'error',
        message: 'Something went wrong',
        stage: 'idle', // Default stage if no progress called
      });
    });

    it('should include current stage in error', async () => {
      const { callback, events } = createMockCallback();
      const emitter = new StageEmitter(callback);

      await emitter.progress('filtering');
      await emitter.error('Filter failed');

      expect(events[1]).toEqual({
        type: 'error',
        message: 'Filter failed',
        stage: 'filtering',
      });
    });
  });

  describe('getState()', () => {
    it('should return initial state', () => {
      const { callback } = createMockCallback();
      const emitter = new StageEmitter(callback);

      const state = emitter.getState();
      expect(state).toEqual({
        stage: 'idle',
        progress: 0,
      });
    });

    it('should return current state after progress', async () => {
      const { callback } = createMockCallback();
      const emitter = new StageEmitter(callback);

      await emitter.progress('scoring_relevance');

      const state = emitter.getState();
      expect(state).toEqual({
        stage: 'scoring_relevance',
        progress: 50,
      });
    });
  });
});
