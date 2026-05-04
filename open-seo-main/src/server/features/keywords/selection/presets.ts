/**
 * Cascade Selection Presets
 * Phase 80-01: Pre-configured cascade strategies for different business types
 */

import type { CascadeConfig } from './types';

/**
 * Default balanced cascade configuration
 *
 * Target: 100 keywords
 * Distribution: Balanced across funnel with BOFU preference
 * - BOFU: 20-60 (focus on conversion intent)
 * - MOFU: 15-40 (consideration stage)
 * - TOFU: 5-30 (awareness)
 *
 * Use for: General SEO campaigns, mixed intent portfolios
 */
export const DEFAULT_CASCADE: CascadeConfig = {
  targetCount: 100,
  stages: {
    bofu: { min: 20, max: 60, priority: 1 },
    mofu: { min: 15, max: 40, priority: 2 },
    tofu: { min: 5, max: 30, priority: 3 },
  },
  allowOverflow: false,
  strictMax: true,
};

/**
 * Service business cascade (BOFU-heavy)
 *
 * Target: 100 keywords
 * Distribution: Heavy BOFU emphasis for conversion-focused businesses
 * - BOFU: 40-80 (80% focus on high-intent keywords)
 * - MOFU: 10-30 (light consideration content)
 * - TOFU: 5-15 (minimal awareness)
 *
 * Use for: Local services, B2B services, professional services
 */
export const SERVICE_CASCADE: CascadeConfig = {
  targetCount: 100,
  stages: {
    bofu: { min: 40, max: 80, priority: 1 },
    mofu: { min: 10, max: 30, priority: 2 },
    tofu: { min: 5, max: 15, priority: 3 },
  },
  allowOverflow: false,
  strictMax: true,
};

/**
 * E-commerce cascade (Balanced, higher volume)
 *
 * Target: 150 keywords
 * Distribution: Balanced for product catalog coverage
 * - BOFU: 40-90 (product/buying intent)
 * - MOFU: 30-60 (comparison/research)
 * - TOFU: 20-50 (category/educational)
 *
 * Use for: E-commerce, SaaS with multiple products, marketplaces
 */
export const ECOMMERCE_CASCADE: CascadeConfig = {
  targetCount: 150,
  stages: {
    bofu: { min: 40, max: 90, priority: 1 },
    mofu: { min: 30, max: 60, priority: 2 },
    tofu: { min: 20, max: 50, priority: 3 },
  },
  allowOverflow: false,
  strictMax: true,
};

/**
 * Content/Blog cascade (TOFU-heavy)
 *
 * Target: 100 keywords
 * Distribution: Heavy awareness focus for content marketing
 * - BOFU: 10-30 (minimal conversion content)
 * - MOFU: 20-40 (consideration topics)
 * - TOFU: 40-60 (educational/awareness)
 *
 * Use for: Blogs, publishers, content marketing, brand awareness campaigns
 */
export const CONTENT_CASCADE: CascadeConfig = {
  targetCount: 100,
  stages: {
    bofu: { min: 10, max: 30, priority: 1 },
    mofu: { min: 20, max: 40, priority: 2 },
    tofu: { min: 40, max: 60, priority: 3 },
  },
  allowOverflow: false,
  strictMax: true,
};
