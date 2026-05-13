/**
 * Feasibility Executor
 * Phase 98-02: Tools & Executors
 *
 * Evidence-based feasibility formula from SPEC.md Section 5.3.
 * Calculates ranking feasibility using 9 factors with research backing.
 *
 * Research sources:
 * - Ahrefs: DA gap 0.85 correlation (primary factor)
 * - Semrush: Personalized KD with topical authority
 * - Backlinko: SERP features impact on CTR
 */

import type { FeasibilityResult } from '../types';

/**
 * Input data for feasibility calculation
 */
export interface FeasibilityInput {
  /** Keyword to assess */
  keyword: string;
  /** Monthly search volume */
  searchVolume: number;
  /** Base keyword difficulty (0-100) */
  keywordDifficulty: number;
  /** Current ranking position (null if not ranking) */
  currentPosition: number | null;
  /** Our domain authority */
  ourDA: number;
  /** Average DA of top 10 competitors */
  competitorAvgDA: number;
  /** Domain age in months */
  domainAgeMonths: number;
  /** Number of related keywords we already rank for */
  relatedKeywordsRanked: number;
  /** Total keywords in this topical cluster */
  totalClusterKeywords: number;
  /** SERP features present */
  serpFeatures: {
    featuredSnippet: boolean;
    localPack: boolean;
    peopleAlsoAsk: boolean;
    aiOverview: boolean;
    hasGiantCompetitors: boolean;
  };
  /** Search intent classification */
  searchIntent: 'informational' | 'navigational' | 'commercial' | 'transactional';
  /** Is this a YMYL (Your Money Your Life) topic? */
  isYMYL: boolean;
  /** Is this a local keyword? */
  isLocal: boolean;
}

/**
 * Calculate feasibility score and verdict
 *
 * Formula combines 9 factors with research-backed weights:
 * 1. Personalized KD (25%) - Adjusted for topical authority
 * 2. Domain Authority Gap (35%) - PRIMARY FACTOR (0.85 correlation)
 * 3. SERP Competitiveness (15%) - Featured snippets, AI Overview, etc.
 * 4. Search Intent (10%) - Informational easier than transactional
 * 5. YMYL Penalty - +25 for health/finance topics
 * 6. Local Bonus - -15 for local keywords (easier)
 * 7. Domain Age - Sandbox penalty for new domains
 * 8. Position Advantage - Already ranking helps
 * 9. Topical Authority - Related keywords ranked in cluster
 *
 * @param input - Keyword and domain data
 * @returns Feasibility assessment with verdict, timeline, and requirements
 */
export function calculateFeasibility(input: FeasibilityInput): FeasibilityResult {
  const factors = {
    personalizedKD: 0,
    serpDifficulty: 0,
    intentDifficulty: 0,
    domainGapPenalty: 0,
    topicalAuthorityBonus: 0,
    positionAdvantage: 0,
    ymylPenalty: 0,
    localBonus: 0,
    sandboxPenalty: 0,
  };

  // FACTOR 1: Personalized Keyword Difficulty (PKD)
  // Semrush research: Topical authority reduces KD by up to 30%
  const topicalAuthority = input.totalClusterKeywords > 0
    ? Math.min(100, (input.relatedKeywordsRanked / input.totalClusterKeywords) * 100)
    : 0;
  factors.topicalAuthorityBonus = topicalAuthority * 0.3;

  // Position advantage - already ranking gives huge boost
  if (input.currentPosition !== null) {
    if (input.currentPosition <= 10) factors.positionAdvantage = 25;
    else if (input.currentPosition <= 20) factors.positionAdvantage = 20;
    else if (input.currentPosition <= 50) factors.positionAdvantage = 10;
    else if (input.currentPosition <= 100) factors.positionAdvantage = 5;
  }

  factors.personalizedKD = Math.max(0,
    input.keywordDifficulty - factors.topicalAuthorityBonus - factors.positionAdvantage
  );

  // FACTOR 2: Domain Authority Gap (0.85 correlation - PRIMARY)
  // Ahrefs study: DA gap is the strongest predictor of ranking difficulty
  const daGap = input.competitorAvgDA - input.ourDA;
  if (daGap > 0) {
    factors.domainGapPenalty = Math.min(40, daGap * 0.8);
  }

  // FACTOR 3: SERP Competitiveness
  // Backlinko: SERP features reduce organic CTR significantly
  if (input.serpFeatures.featuredSnippet) factors.serpDifficulty += 15;
  if (input.serpFeatures.localPack && !input.isLocal) factors.serpDifficulty += 20;
  if (input.serpFeatures.peopleAlsoAsk) factors.serpDifficulty += 5;
  if (input.serpFeatures.aiOverview) factors.serpDifficulty += 10;
  if (input.serpFeatures.hasGiantCompetitors) factors.serpDifficulty += 25;

  // FACTOR 4: Search Intent
  // Informational easier than transactional (lower commercial intent)
  const intentDifficultyMap = {
    informational: 0,
    navigational: 10,
    commercial: 15,
    transactional: 20,
  };
  factors.intentDifficulty = intentDifficultyMap[input.searchIntent];

  // FACTOR 5: YMYL Penalty
  // Google prioritizes E-E-A-T for health, finance, legal topics
  if (input.isYMYL) factors.ymylPenalty = 25;

  // FACTOR 6: Local Bonus
  // Local keywords easier to rank (less competition)
  if (input.isLocal) factors.localBonus = 15;

  // FACTOR 7: Domain Age / Sandbox
  // New domains face Google sandbox (3-12 months)
  if (input.domainAgeMonths < 12) factors.sandboxPenalty = 20;
  else if (input.domainAgeMonths < 24) factors.sandboxPenalty = 10;

  // COMPOSITE SCORE (0-100, higher = harder)
  const compositeScore = Math.min(100, Math.max(0,
    factors.personalizedKD * 0.25 +
    factors.domainGapPenalty * 0.35 +
    factors.serpDifficulty * 0.15 +
    factors.intentDifficulty * 0.10 +
    factors.ymylPenalty +
    factors.sandboxPenalty -
    factors.localBonus
  ));

  // VERDICT (research-backed thresholds)
  let verdict: FeasibilityResult['verdict'];
  if (compositeScore <= 30) verdict = 'feasible';
  else if (compositeScore <= 50) verdict = 'challenging';
  else if (compositeScore <= 70) verdict = 'difficult';
  else verdict = 'unlikely';

  // TIMELINE ESTIMATION
  const baseTimelines = {
    feasible: { min: 3, max: 6 },
    challenging: { min: 6, max: 12 },
    difficult: { min: 9, max: 18 },
    unlikely: { min: 12, max: 24 },
  };
  const timeline = { ...baseTimelines[verdict] };
  const caveats: string[] = [];

  // Adjust timeline for special factors
  if (input.isYMYL) {
    timeline.min += 3;
    timeline.max += 6;
    caveats.push('YMYL niche requires additional E-E-A-T building time');
  }
  if (input.domainAgeMonths < 12) {
    timeline.min += 3;
    timeline.max += 6;
    caveats.push('New domain may face Google sandbox delay');
  }
  if (input.serpFeatures.aiOverview) {
    caveats.push('AI Overview may reduce organic CTR even if ranking');
  }

  // CONFIDENCE ASSESSMENT
  let confidenceScore = 100;
  if (input.currentPosition === null) confidenceScore -= 20; // No historical data
  if (input.relatedKeywordsRanked === 0) confidenceScore -= 15; // No topical authority
  if (input.domainAgeMonths < 6) confidenceScore -= 15; // Very new domain

  const confidence: FeasibilityResult['confidence'] =
    confidenceScore >= 70 ? 'high' : confidenceScore >= 50 ? 'medium' : 'low';

  // REQUIREMENTS ESTIMATION
  // Backlinks needed based on KD and DA gap
  const baseBacklinks = input.keywordDifficulty < 30 ? 10 : input.keywordDifficulty < 50 ? 30 : input.keywordDifficulty < 70 ? 75 : 150;
  const gapMultiplier = 1 + (Math.max(0, daGap) / 50);

  // Content word count based on KD
  const contentWordCount = input.keywordDifficulty < 30 ? 1500 : input.keywordDifficulty < 50 ? 2500 : 4000;

  return {
    keyword: input.keyword,
    score: Math.round(compositeScore),
    verdict,
    confidence,
    timeline: {
      minMonths: timeline.min,
      maxMonths: timeline.max,
      caveats,
    },
    requirements: {
      backlinksNeeded: Math.ceil(baseBacklinks * gapMultiplier),
      contentWordCount,
      technicalFixesFirst: factors.serpDifficulty > 30,
    },
    factors,
  };
}
