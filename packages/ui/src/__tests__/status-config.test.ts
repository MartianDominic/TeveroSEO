import { describe, it, expect } from 'vitest';
import {
  PROSPECT_STATUS,
  CLIENT_STATUS,
  ARTICLE_STATUS,
  PIPELINE_STAGE,
  getStatusConfig,
  type StatusConfig,
} from '../lib/status-config';

describe('PROSPECT_STATUS', () => {
  it('has all expected keys', () => {
    expect(Object.keys(PROSPECT_STATUS)).toEqual([
      'new',
      'analyzing',
      'analyzed',
      'converted',
      'archived',
    ]);
  });

  it('has required properties for each status', () => {
    Object.values(PROSPECT_STATUS).forEach((status) => {
      expect(status).toHaveProperty('label');
      expect(status).toHaveProperty('color');
      expect(status).toHaveProperty('bgColor');
      expect(status).toHaveProperty('textColor');
    });
  });

  it('analyzing status has pulse property', () => {
    expect(PROSPECT_STATUS.analyzing.pulse).toBe(true);
  });
});

describe('CLIENT_STATUS', () => {
  it('has all expected keys', () => {
    expect(Object.keys(CLIENT_STATUS)).toEqual(['good', 'drop', 'no_gsc', 'stale']);
  });

  it('has icons defined', () => {
    expect(CLIENT_STATUS.good.icon).toBeDefined();
    expect(CLIENT_STATUS.drop.icon).toBeDefined();
    expect(CLIENT_STATUS.no_gsc.icon).toBeDefined();
    expect(CLIENT_STATUS.stale.icon).toBeDefined();
  });
});

describe('ARTICLE_STATUS', () => {
  it('has all expected keys', () => {
    expect(Object.keys(ARTICLE_STATUS)).toEqual([
      'draft',
      'planned',
      'writing',
      'review',
      'published',
      'archived',
    ]);
  });

  it('uses v6 token classes', () => {
    expect(ARTICLE_STATUS.published.color).toBe('bg-success');
    expect(ARTICLE_STATUS.published.bgColor).toBe('bg-success-soft');
    expect(ARTICLE_STATUS.draft.bgColor).toBe('bg-surface-2');
  });
});

describe('PIPELINE_STAGE', () => {
  it('has all expected keys', () => {
    expect(Object.keys(PIPELINE_STAGE)).toEqual([
      'idea',
      'outline',
      'draft',
      'review',
      'published',
    ]);
  });
});

describe('getStatusConfig', () => {
  it('returns config for valid status', () => {
    const config = getStatusConfig(PROSPECT_STATUS, 'new');
    expect(config.label).toBe('New');
    expect(config.color).toBe('bg-info');
  });

  it('returns default config for unknown status', () => {
    const config = getStatusConfig(PROSPECT_STATUS, 'unknown');
    expect(config.label).toBe('unknown');
    expect(config.color).toBe('bg-text-4');
    expect(config.bgColor).toBe('bg-surface-2');
    expect(config.textColor).toBe('text-text-3');
  });

  it('works with all status maps', () => {
    expect(getStatusConfig(CLIENT_STATUS, 'good').label).toBe('Healthy');
    expect(getStatusConfig(ARTICLE_STATUS, 'draft').label).toBe('Draft');
    expect(getStatusConfig(PIPELINE_STAGE, 'idea').label).toBe('Idea');
  });
});
