/**
 * Tests for Keyword Analysis Chat Types
 * Phase 82: Chat Integration - RED phase
 */

import { describe, it, expect } from 'vitest';

// Import types and constants
import {
  STAGE_WEIGHTS,
  type AnalysisStage,
  type AnalysisEvent,
  type ProgressEvent,
  type PartialEvent,
  type CompleteEvent,
  type ErrorEvent,
} from '../types';

describe('AnalysisStage', () => {
  it('should include all 10 stages', () => {
    // Verify type covers all expected stages
    const stages: AnalysisStage[] = [
      'idle',
      'extracting_constraints',
      'classifying_funnel',
      'classifying_geo',
      'scoring_relevance',
      'filtering',
      'selecting',
      'discovering_pseo',
      'discovering_side_keywords',
      'complete',
    ];

    expect(stages.length).toBe(10);
    // Type checking ensures all values are valid AnalysisStage
    stages.forEach(stage => {
      expect(typeof stage).toBe('string');
    });
  });
});

describe('AnalysisEvent discriminated union', () => {
  it('should have type: progress', () => {
    const event: ProgressEvent = {
      type: 'progress',
      stage: 'extracting_constraints',
      progress: 5,
      message: 'Analyzing...',
    };

    expect(event.type).toBe('progress');
    expect(event.stage).toBe('extracting_constraints');
    expect(event.progress).toBe(5);
  });

  it('should have type: partial', () => {
    const event: PartialEvent = {
      type: 'partial',
      data: { constraints: {} as never },
    };

    expect(event.type).toBe('partial');
    expect(event.data).toBeDefined();
  });

  it('should have type: complete', () => {
    const event: CompleteEvent = {
      type: 'complete',
      data: {} as never,
    };

    expect(event.type).toBe('complete');
  });

  it('should have type: error', () => {
    const event: ErrorEvent = {
      type: 'error',
      message: 'Something went wrong',
      stage: 'filtering',
    };

    expect(event.type).toBe('error');
    expect(event.message).toBe('Something went wrong');
    expect(event.stage).toBe('filtering');
  });

  it('should support all event types in union', () => {
    const events: AnalysisEvent[] = [
      { type: 'progress', stage: 'idle', progress: 0 },
      { type: 'partial', data: {} },
      { type: 'complete', data: {} as never },
      { type: 'error', message: 'error' },
    ];

    expect(events.length).toBe(4);
    expect(events.map(e => e.type)).toEqual(['progress', 'partial', 'complete', 'error']);
  });
});

describe('STAGE_WEIGHTS', () => {
  it('should have weights for all stages', () => {
    expect(STAGE_WEIGHTS.idle).toBe(0);
    expect(STAGE_WEIGHTS.extracting_constraints).toBe(5);
    expect(STAGE_WEIGHTS.classifying_funnel).toBe(25);
    expect(STAGE_WEIGHTS.classifying_geo).toBe(35);
    expect(STAGE_WEIGHTS.scoring_relevance).toBe(50);
    expect(STAGE_WEIGHTS.filtering).toBe(65);
    expect(STAGE_WEIGHTS.selecting).toBe(75);
    expect(STAGE_WEIGHTS.discovering_pseo).toBe(85);
    expect(STAGE_WEIGHTS.discovering_side_keywords).toBe(95);
    expect(STAGE_WEIGHTS.complete).toBe(100);
  });

  it('should have monotonically increasing weights', () => {
    const stages: AnalysisStage[] = [
      'idle',
      'extracting_constraints',
      'classifying_funnel',
      'classifying_geo',
      'scoring_relevance',
      'filtering',
      'selecting',
      'discovering_pseo',
      'discovering_side_keywords',
      'complete',
    ];

    for (let i = 1; i < stages.length; i++) {
      expect(STAGE_WEIGHTS[stages[i]]).toBeGreaterThan(STAGE_WEIGHTS[stages[i - 1]]);
    }
  });
});
