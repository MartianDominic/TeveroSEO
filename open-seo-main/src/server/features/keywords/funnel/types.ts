import { z } from "zod";

// Funnel stages - purchase journey position
export const FunnelStageEnum = z.enum(["bofu", "mofu", "tofu"]);
export type FunnelStage = z.infer<typeof FunnelStageEnum>;

// Classification result for a single keyword
export const FunnelClassificationSchema = z.object({
  keyword: z.string(),
  stage: FunnelStageEnum,
  confidence: z.number().min(0).max(1),
  signals: z.object({
    patternMatch: z.boolean(),
    patternType: z.string().nullable(),  // e.g., "purchase", "comparison", "learning"
    dataForSeoIntent: z.string().nullable(),  // Original intent from DataForSEO
    businessContextBoost: z.boolean(),  // true if city+service combo detected
  }),
  reasoning: z.string(),
});
export type FunnelClassification = z.infer<typeof FunnelClassificationSchema>;

// Batch classification result
export interface FunnelClassificationResult {
  classifications: FunnelClassification[];
  stats: {
    total: number;
    bofu: number;
    mofu: number;
    tofu: number;
    highConfidence: number;  // >= 0.80
    lowConfidence: number;   // < 0.60, candidates for LLM review
  };
}

// Business context for classification decisions
export interface FunnelBusinessContext {
  services: string[];           // What the business sells/provides
  cities?: string[];            // Target cities (city + service = BOFU boost)
  isServiceBusiness: boolean;   // Service businesses have stronger BOFU signals
}
