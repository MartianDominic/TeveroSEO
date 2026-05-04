/**
 * Stage Emitter for Analysis Pipeline
 * Phase 82: Chat Integration
 *
 * Provides progress callback mechanism for streaming updates.
 */

import type { AnalysisStage, AnalysisEvent, AnalysisResult } from './types';
import { STAGE_WEIGHTS } from './types';

export type EventCallback = (event: AnalysisEvent) => Promise<void>;

export class StageEmitter {
  private callback: EventCallback;
  private currentStage: AnalysisStage = 'idle';
  private currentProgress = 0;

  constructor(callback: EventCallback) {
    this.callback = callback;
  }

  async progress(stage: AnalysisStage, message?: string): Promise<void> {
    this.currentStage = stage;
    this.currentProgress = STAGE_WEIGHTS[stage];

    await this.callback({
      type: 'progress',
      stage,
      progress: this.currentProgress,
      message,
    });
  }

  async partial(data: Partial<AnalysisResult>): Promise<void> {
    await this.callback({
      type: 'partial',
      data,
    });
  }

  async complete(data: AnalysisResult): Promise<void> {
    this.currentStage = 'complete';
    this.currentProgress = 100;

    await this.callback({
      type: 'complete',
      data,
    });
  }

  async error(message: string): Promise<void> {
    await this.callback({
      type: 'error',
      message,
      stage: this.currentStage,
    });
  }

  getState(): { stage: AnalysisStage; progress: number } {
    return {
      stage: this.currentStage,
      progress: this.currentProgress,
    };
  }
}
