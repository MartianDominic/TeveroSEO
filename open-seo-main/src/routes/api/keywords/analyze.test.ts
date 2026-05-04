/**
 * Tests for /api/keywords/analyze endpoint
 * Phase 80-02: Cascade Selection Integration
 */
import { describe, it, expect } from 'vitest';

describe('POST /api/keywords/analyze', () => {
  const validKeywords = [
    {
      keyword: 'buy shoes online',
      funnelStage: 'bofu' as const,
      compositeScore: 0.9,
      volume: 1000,
      difficulty: 45,
    },
    {
      keyword: 'best running shoes',
      funnelStage: 'mofu' as const,
      compositeScore: 0.7,
      volume: 2000,
      difficulty: 55,
    },
    {
      keyword: 'what are running shoes',
      funnelStage: 'tofu' as const,
      compositeScore: 0.5,
      volume: 500,
      difficulty: 30,
    },
  ];

  it('should return selection with breakdown for valid keywords', async () => {
    const { Route } = await import('./analyze');
    const handler = Route.options.server?.handlers?.POST;

    const request = new Request('http://localhost/api/keywords/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: validKeywords }),
    });

    const response = await handler!({ request });
    const data = await response.json();

    expect(data).toHaveProperty('selection');
    expect(data.selection).toHaveProperty('selected');
    expect(data.selection).toHaveProperty('excluded');
    expect(data.selection).toHaveProperty('breakdown');
    expect(data).toHaveProperty('config');
    expect(data).toHaveProperty('metadata');

    // Verify breakdown structure
    expect(data.selection.breakdown).toHaveProperty('total');
    expect(data.selection.breakdown).toHaveProperty('bofu');
    expect(data.selection.breakdown).toHaveProperty('mofu');
    expect(data.selection.breakdown).toHaveProperty('tofu');
    expect(data.selection.breakdown).toHaveProperty('meetsTarget');
  });

  it('should use SERVICE_CASCADE when cascadePreset=service', async () => {
    const { Route } = await import('./analyze');
    const handler = Route.options.server?.handlers?.POST;

    const request = new Request('http://localhost/api/keywords/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: validKeywords,
        config: { cascadePreset: 'service' },
      }),
    });

    const response = await handler!({ request });
    const data = await response.json();

    // SERVICE_CASCADE has higher BOFU minimums
    expect(data.config.stages.bofu.min).toBeGreaterThanOrEqual(40);
  });

  it('should allow targetCount override', async () => {
    const { Route } = await import('./analyze');
    const handler = Route.options.server?.handlers?.POST;

    const request = new Request('http://localhost/api/keywords/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: validKeywords,
        config: { targetCount: 5 },
      }),
    });

    const response = await handler!({ request });
    const data = await response.json();

    expect(data.config.targetCount).toBe(5);
  });

  it('should return 400 for empty keywords array', async () => {
    const { Route } = await import('./analyze');
    const handler = Route.options.server?.handlers?.POST;

    const request = new Request('http://localhost/api/keywords/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: [] }),
    });

    const response = await handler!({ request });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for invalid cascadePreset', async () => {
    const { Route } = await import('./analyze');
    const handler = Route.options.server?.handlers?.POST;

    const request = new Request('http://localhost/api/keywords/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: validKeywords,
        config: { cascadePreset: 'invalid' },
      }),
    });

    const response = await handler!({ request });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for >10000 keywords (DoS protection)', async () => {
    const { Route } = await import('./analyze');
    const handler = Route.options.server?.handlers?.POST;

    const manyKeywords = Array.from({ length: 10001 }, (_, i) => ({
      keyword: `keyword-${i}`,
      volume: 100,
      difficulty: 50,
    }));

    const request = new Request('http://localhost/api/keywords/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: manyKeywords }),
    });

    const response = await handler!({ request });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });
});
