/**
 * ScoreExplanationTranslations
 * Phase 85-01 Task 1: Bilingual translation strings for score explanations
 *
 * Maps technical score terms to human-readable explanations in EN and LT.
 */

export type Locale = "en" | "lt";

export interface ScoreTranslations {
  title: string;
  factor: string;
  value: string;
  contribution: string;
  baseScore: string;
  finalScore: string;

  // Component explanations
  relevance: {
    label: string;
    high: string;
    medium: string;
    low: string;
  };
  funnel: {
    label: string;
    bofu: string;
    mofu: string;
    tofu: string;
  };
  geo: {
    label: string;
    exact: string;
    regional: string;
    national: string;
  };
  volume: {
    label: string;
    high: string;
    medium: string;
    low: string;
  };

  // Bonus explanations
  priorityBoost: {
    label: string;
    template: string; // e.g., "Matches priority category: {category}"
  };
  quickWin: {
    label: string;
    template: string; // e.g., "Striking distance opportunity (position {position})"
  };
}

export const translations: Record<Locale, ScoreTranslations> = {
  en: {
    title: "Why this score?",
    factor: "Factor",
    value: "Value",
    contribution: "Contribution",
    baseScore: "Base Score",
    finalScore: "Final Score",

    relevance: {
      label: "Relevance",
      high: "High semantic match to your business",
      medium: "Moderate relevance match",
      low: "Weak relevance match",
    },
    funnel: {
      label: "Funnel Stage",
      bofu: "Ready-to-buy intent",
      mofu: "Considering options",
      tofu: "Awareness stage",
    },
    geo: {
      label: "Geo Match",
      exact: "Exact city match",
      regional: "Regional match",
      national: "National/generic",
    },
    volume: {
      label: "Volume",
      high: "High traffic potential",
      medium: "Moderate traffic potential",
      low: "Low traffic potential",
    },
    priorityBoost: {
      label: "Priority Boost",
      template: "Matches priority category: {category}",
    },
    quickWin: {
      label: "Quick Win",
      template: "Striking distance opportunity (position {position})",
    },
  },
  lt: {
    title: "Kodėl toks balas?",
    factor: "Faktorius",
    value: "Reikšmė",
    contribution: "Indėlis",
    baseScore: "Bazinis balas",
    finalScore: "Galutinis balas",

    relevance: {
      label: "Aktualumas",
      high: "Aukštas semantinis atitikimas jūsų verslui",
      medium: "Vidutinis atitikimas",
      low: "Silpnas atitikimas",
    },
    funnel: {
      label: "Piltuvo etapas",
      bofu: "Pirkimo ketinimas",
      mofu: "Svarsto galimybes",
      tofu: "Sužinojimo etapas",
    },
    geo: {
      label: "Vietos atitikimas",
      exact: "Tikslus miesto atitikimas",
      regional: "Regioninis atitikimas",
      national: "Nacionalinis/bendras",
    },
    volume: {
      label: "Apimtis",
      high: "Didelis srauto potencialas",
      medium: "Vidutinis srauto potencialas",
      low: "Mažas srauto potencialas",
    },
    priorityBoost: {
      label: "Prioriteto padidėjimas",
      template: "Atitinka prioritetinę kategoriją: {category}",
    },
    quickWin: {
      label: "Greitas laimėjimas",
      template: "Galimybė greitai patekti į TOP (pozicija {position})",
    },
  },
};

/**
 * Get a simple translation string by key.
 */
export function getScoreExplanation(
  locale: Locale,
  key: "title" | "factor" | "value" | "contribution" | "baseScore" | "finalScore"
): string {
  return translations[locale][key];
}

/**
 * Get relevance level explanation based on score.
 * - >= 0.7: high
 * - 0.4-0.7: medium
 * - < 0.4: low
 */
export function getRelevanceLevel(locale: Locale, score: number): string {
  if (score >= 0.7) return translations[locale].relevance.high;
  if (score >= 0.4) return translations[locale].relevance.medium;
  return translations[locale].relevance.low;
}

/**
 * Get volume level explanation based on search volume.
 * - >= 1000: high
 * - 100-1000: medium
 * - < 100: low
 */
export function getVolumeLevel(locale: Locale, volume: number): string {
  if (volume >= 1000) return translations[locale].volume.high;
  if (volume >= 100) return translations[locale].volume.medium;
  return translations[locale].volume.low;
}

/**
 * Get geo level explanation based on geo score.
 * - >= 0.9: exact
 * - 0.5-0.9: regional
 * - < 0.5: national
 */
export function getGeoLevel(locale: Locale, geoScore: number): string {
  if (geoScore >= 0.9) return translations[locale].geo.exact;
  if (geoScore >= 0.5) return translations[locale].geo.regional;
  return translations[locale].geo.national;
}

/**
 * Get funnel stage explanation.
 */
export function getFunnelExplanation(
  locale: Locale,
  stage: "BOFU" | "MOFU" | "TOFU"
): string {
  const key = stage.toLowerCase() as "bofu" | "mofu" | "tofu";
  return translations[locale].funnel[key];
}

/**
 * Format priority boost explanation with category.
 */
export function formatPriorityBoost(locale: Locale, category: string): string {
  return translations[locale].priorityBoost.template.replace(
    "{category}",
    category
  );
}

/**
 * Format quick win explanation with position.
 */
export function formatQuickWin(locale: Locale, position: number): string {
  return translations[locale].quickWin.template.replace(
    "{position}",
    String(position)
  );
}
