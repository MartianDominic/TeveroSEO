/**
 * Tiered Fetcher Type Definitions
 *
 * 3-tier escalation: Direct → Webshare DC → Geonode Residential → DataForSEO
 */

export const FETCH_TIERS = {
  DIRECT: 0,
  WEBSHARE_DC: 1,
  GEONODE_RESIDENTIAL: 2,
  DATAFORSEO: 3,
} as const;

export type FetchTier = (typeof FETCH_TIERS)[keyof typeof FETCH_TIERS];

export interface FetchResult {
  success: boolean;
  tier: FetchTier;
  html?: string;
  statusCode?: number;
  error?: string;
  errorType?: EscalationReason;
  latencyMs: number;
  bytesTransferred: number;
  proxyUsed?: string;
}

export interface TierConfig {
  tier: FetchTier;
  name: string;
  costPerRequest: number; // USD
  costPerGB: number; // USD (for bandwidth-based pricing)
  maxRetries: number;
  timeoutMs: number;
  enabled: boolean;
}

export const TIER_CONFIGS: Record<FetchTier, TierConfig> = {
  [FETCH_TIERS.DIRECT]: {
    tier: FETCH_TIERS.DIRECT,
    name: 'Direct',
    costPerRequest: 0,
    costPerGB: 0,
    maxRetries: 1,
    timeoutMs: 15000,
    enabled: true,
  },
  [FETCH_TIERS.WEBSHARE_DC]: {
    tier: FETCH_TIERS.WEBSHARE_DC,
    name: 'Webshare DC',
    costPerRequest: 0, // Free tier
    costPerGB: 0, // 1GB/mo included
    maxRetries: 2,
    timeoutMs: 20000,
    enabled: true,
  },
  [FETCH_TIERS.GEONODE_RESIDENTIAL]: {
    tier: FETCH_TIERS.GEONODE_RESIDENTIAL,
    name: 'Geonode Residential',
    costPerRequest: 0,
    costPerGB: 1.0, // $1/GB starter plan
    maxRetries: 2,
    timeoutMs: 25000,
    enabled: true,
  },
  [FETCH_TIERS.DATAFORSEO]: {
    tier: FETCH_TIERS.DATAFORSEO,
    name: 'DataForSEO',
    costPerRequest: 0.02, // $0.02 per page
    costPerGB: 0,
    maxRetries: 1,
    timeoutMs: 60000,
    enabled: true,
  },
};

export type EscalationReason =
  | 'rate_limited' // 429
  | 'ip_blocked' // 403 with block indicators
  | 'dc_detected' // Cloudflare/PerimeterX DC detection
  | 'js_required' // SPA detected, needs rendering
  | 'captcha' // CAPTCHA challenge
  | 'timeout' // Request timed out
  | 'connection_refused' // Server refused connection
  | 'empty_response' // Got HTML but no content
  | 'bot_detected'; // Generic bot detection page

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason?: EscalationReason;
  nextTier?: FetchTier;
  skipToTier?: FetchTier; // Jump directly (e.g., DC detected → skip to residential)
}

export interface DomainTierEntry {
  domain: string;
  minimumTier: FetchTier;
  lastSuccess: Date;
  failureCount: Record<FetchTier, number>;
  successCount: Record<FetchTier, number>;
}

export interface CrawlStats {
  domain: string;
  totalRequests: number;
  byTier: Record<FetchTier, number>;
  totalBytesTransferred: number;
  estimatedCostUsd: number;
  averageLatencyMs: number;
}
