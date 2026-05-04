/**
 * POST /api/keywords/analyze
 * Phase 80-02: Cascade Selection Integration
 *
 * Accepts keywords and cascade configuration, runs BOFU-first selection,
 * returns selected/excluded keywords with breakdown.
 */
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  cascadeSelector,
  DEFAULT_CASCADE,
  SERVICE_CASCADE,
  ECOMMERCE_CASCADE,
  CONTENT_CASCADE,
  type CascadeConfig,
  type FunnelStage,
} from '@/server/features/keywords';

const PRESET_MAP: Record<string, CascadeConfig> = {
  default: DEFAULT_CASCADE,
  service: SERVICE_CASCADE,
  ecommerce: ECOMMERCE_CASCADE,
  content: CONTENT_CASCADE,
};

const AnalyzeRequestSchema = z.object({
  keywords: z
    .array(
      z.object({
        keyword: z.string(),
        funnelStage: z.enum(['bofu', 'mofu', 'tofu']).optional(),
        compositeScore: z.number().min(0).max(1).optional(),
        volume: z.number().optional(),
        difficulty: z.number().optional(),
        position: z.number().optional(),
      })
    )
    .min(1)
    .max(10000),
  config: z
    .object({
      targetCount: z.number().int().min(1).max(1000).optional(),
      cascadePreset: z.enum(['default', 'service', 'ecommerce', 'content']).optional(),
    })
    .optional(),
});

export const Route = createFileRoute('/api/keywords/analyze')({
  server: {
    handlers: {
      POST: async ({ request }) => {
      const body = await request.json();
      const parsed = AnalyzeRequestSchema.safeParse(body);

      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { keywords, config } = parsed.data;

      // Build cascade config from preset + overrides
      const preset = config?.cascadePreset || 'default';
      const baseConfig = PRESET_MAP[preset];
      const cascadeConfig: CascadeConfig = {
        ...baseConfig,
        targetCount: config?.targetCount || baseConfig.targetCount,
      };

      // Prepare keywords for selection
      const keywordsForSelection = keywords.map((kw) => ({
        keyword: kw.keyword,
        funnelStage: kw.funnelStage || inferFunnelStage(kw.keyword),
        compositeScore: kw.compositeScore || 0.5,
        metrics: {
          volume: kw.volume || 0,
          difficulty: kw.difficulty || 50,
          position: kw.position,
        },
      }));

      // Run cascade selection
      const selection = cascadeSelector.select(keywordsForSelection, cascadeConfig);

      return new Response(
        JSON.stringify({
          selection: {
            selected: selection.selected,
            excluded: selection.excluded,
            breakdown: selection.breakdown,
          },
          config: cascadeConfig,
          metadata: selection.metadata,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    },
    },
  },
});

/**
 * Infer funnel stage from keyword text.
 * Heuristic: commercial intent -> BOFU, informational -> TOFU.
 */
function inferFunnelStage(keyword: string): FunnelStage {
  const kw = keyword.toLowerCase();

  // BOFU indicators (commercial intent)
  if (
    kw.includes('buy') ||
    kw.includes('price') ||
    kw.includes('kaina') ||
    kw.includes('pirkti') ||
    kw.includes('įsigyti') ||
    kw.includes('užsakyti')
  ) {
    return 'bofu';
  }

  // TOFU indicators (informational)
  if (
    kw.includes('what') ||
    kw.includes('how') ||
    kw.includes('kas') ||
    kw.includes('kaip') ||
    kw.includes('kodėl') ||
    kw.includes('why')
  ) {
    return 'tofu';
  }

  // Default to MOFU (consideration)
  return 'mofu';
}
