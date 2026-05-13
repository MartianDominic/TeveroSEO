/**
 * Domain Health Executor
 * Phase 98-02: Tools & Executors
 *
 * Calls DataForSEO Domain Analytics API to get DA, DR, traffic, and keywords.
 * Returns structured DomainHealthResult for display in chat.
 */

import type { DomainHealthResult } from '../types';

/**
 * Run domain health analysis using DataForSEO API
 *
 * @param domain - Domain to analyze (e.g., 'groziosalon.lt')
 * @returns Domain health metrics with summary
 */
export async function runDomainHealthAnalysis(domain: string): Promise<DomainHealthResult> {
  // DataForSEO credentials from environment
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    throw new Error('DataForSEO credentials not configured');
  }

  // Call DataForSEO Domain Analytics Overview API
  const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/domain_overview/live', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        target: domain,
        language_code: 'lt',
        location_code: 2440, // Lithuania
      }
    ]),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const result = data.tasks?.[0]?.result?.[0];

  if (!result) {
    throw new Error('No data returned from DataForSEO API');
  }

  // Extract metrics
  const da = result.domain_rank || 0;
  const dr = result.backlinks_rank || 0;
  const traffic = result.organic_etv || 0; // Estimated traffic value
  const rankedKeywords = result.organic_keywords_count || 0;

  // Generate human-readable summary
  const summary = generateSummary({ da, dr, traffic, rankedKeywords });

  return {
    domain,
    da,
    dr,
    traffic,
    rankedKeywords,
    summary,
  };
}

/**
 * Generate human-readable summary from metrics
 */
function generateSummary(metrics: { da: number; dr: number; traffic: number; rankedKeywords: number }): string {
  const { da, dr, traffic, rankedKeywords } = metrics;

  // Authority assessment
  let authorityLevel: string;
  if (da >= 50 || dr >= 50) {
    authorityLevel = 'Strong authority';
  } else if (da >= 30 || dr >= 30) {
    authorityLevel = 'Moderate authority';
  } else if (da >= 10 || dr >= 10) {
    authorityLevel = 'Growing authority';
  } else {
    authorityLevel = 'New domain';
  }

  // Traffic assessment
  let trafficLevel: string;
  if (traffic >= 1000) {
    trafficLevel = 'significant traffic';
  } else if (traffic >= 300) {
    trafficLevel = 'moderate traffic';
  } else if (traffic >= 50) {
    trafficLevel = 'low traffic';
  } else {
    trafficLevel = 'minimal traffic';
  }

  // Keyword assessment
  let keywordLevel: string;
  if (rankedKeywords >= 1000) {
    keywordLevel = 'extensive keyword portfolio';
  } else if (rankedKeywords >= 100) {
    keywordLevel = 'solid keyword base';
  } else if (rankedKeywords >= 20) {
    keywordLevel = 'small keyword presence';
  } else {
    keywordLevel = 'very few keywords';
  }

  return `${authorityLevel} with ${trafficLevel} and ${keywordLevel}. ${da < 30 && rankedKeywords < 100 ? 'Good foundation for SEO growth.' : 'Room for optimization.'}`;
}
