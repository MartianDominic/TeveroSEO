/**
 * Anchor text selector for internal link recommendations.
 * Phase 35-03: Anchor Selection
 *
 * Selects optimal anchor text based on:
 * - Target distribution: ~50% exact / 25% branded / 25% misc
 * - Prefers wrapping existing text (confidence 0.9+)
 * - Falls back to insertion (confidence 0.6)
 */
import type {
  AnchorSelection,
  SelectAnchorParams,
  AnchorDistribution,
} from "./types";
import type { AnchorType } from "@/db/link-schema";

/**
 * Confidence scores for anchor placement strategies.
 */
const CONFIDENCE = {
  existingText: 0.95, // Wrapping existing text
  insertion: 0.6, // Inserting new text
} as const;

/**
 * Ideal anchor type distribution.
 */
const IDEAL_DISTRIBUTION = {
  exact: 0.50, // 50% exact match
  branded: 0.25, // 25% branded
  misc: 0.25, // 25% miscellaneous
} as const;

/**
 * Branded anchor templates.
 */
const BRANDED_TEMPLATES = [
  "{brand}'s {topic} guide",
  "{brand} {topic}",
  "by {brand}",
  "{brand}'s approach to {topic}",
  "learn from {brand}",
] as const;

/**
 * Misc anchor templates for when we need generic anchors.
 */
const MISC_TEMPLATES = [
  "learn more",
  "read more about this",
  "this guide",
  "our guide",
  "this resource",
  "here",
  "click here",
  "this article",
] as const;

/**
 * Normalize text for comparison (lowercase, trim, collapse spaces).
 *
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Find existing text in body that matches the target keyword.
 * Returns the original case version if found.
 *
 * @param bodyText - Source page body text
 * @param keyword - Keyword to find
 * @returns Matched text or null
 */
export function findExistingTextMatch(
  bodyText: string,
  keyword: string
): string | null {
  if (!bodyText || !keyword) {
    return null;
  }

  const normalizedBody = normalizeText(bodyText);
  const normalizedKeyword = normalizeText(keyword);

  // Check if keyword exists as a standalone phrase (word boundaries)
  const wordBoundaryRegex = new RegExp(
    `\\b${escapeRegex(normalizedKeyword)}\\b`,
    "i"
  );

  if (!wordBoundaryRegex.test(normalizedBody)) {
    return null;
  }

  // Find the original case version in the body text
  // Create a regex to find the match with original case
  const findOriginalRegex = new RegExp(
    `\\b(${escapeRegex(normalizedKeyword).replace(/ /g, "\\s+")})\\b`,
    "i"
  );
  const match = bodyText.match(findOriginalRegex);

  return match ? match[1] : normalizedKeyword;
}

/**
 * Escape special regex characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Determine which anchor type to use based on current distribution.
 * Goal: maintain ~50% exact / 25% branded / 25% misc
 *
 * @param distribution - Current anchor type distribution
 * @param hasKeyword - Whether target keyword is available
 * @param hasBrand - Whether brand name is available
 * @returns Recommended anchor type
 */
export function determineAnchorType(
  distribution: AnchorDistribution,
  hasKeyword: boolean,
  hasBrand: boolean
): AnchorType {
  const total = distribution.exact + distribution.branded + distribution.misc;

  // For empty distribution, prefer exact if available
  if (total === 0) {
    if (hasKeyword) return "exact";
    if (hasBrand) return "branded";
    return "misc";
  }

  // Calculate current percentages
  const exactPct = distribution.exact / total;
  const brandedPct = distribution.branded / total;
  // miscPct is implicitly calculated

  // Calculate deviation from ideal
  const exactDeviation = IDEAL_DISTRIBUTION.exact - exactPct;
  const brandedDeviation = IDEAL_DISTRIBUTION.branded - brandedPct;
  const miscDeviation = IDEAL_DISTRIBUTION.misc - (1 - exactPct - brandedPct);

  // Choose the type with the largest positive deviation (most needed)
  const deviations: Array<{ type: AnchorType; deviation: number; available: boolean }> = [
    { type: "exact", deviation: exactDeviation, available: hasKeyword },
    { type: "branded", deviation: brandedDeviation, available: hasBrand },
    { type: "misc", deviation: miscDeviation, available: true },
  ];

  // Sort by deviation descending, filter by availability
  const sorted = deviations
    .filter((d) => d.available)
    .sort((a, b) => b.deviation - a.deviation);

  return sorted[0]?.type || "misc";
}

/**
 * Generate a branded anchor text.
 *
 * @param keyword - Target keyword (optional)
 * @param brandName - Brand name
 * @returns Generated anchor text
 */
export function generateBrandedAnchor(
  keyword: string | null,
  brandName: string
): string {
  const topic = keyword || "solutions";

  // Pick a template
  const template = BRANDED_TEMPLATES[Math.floor(Math.random() * BRANDED_TEMPLATES.length)];

  return template
    .replace("{brand}", brandName)
    .replace("{topic}", topic);
}

/**
 * Generate a miscellaneous anchor text.
 *
 * @param title - Page title (optional)
 * @param keyword - Target keyword (optional)
 * @returns Generated anchor text
 */
export function generateMiscAnchor(
  title: string | null,
  keyword: string | null
): string {
  // If title is available and reasonable length, use a shortened version
  if (title && title.length > 0 && title.length <= 60) {
    // Remove common suffixes like " | Brand" or " - Site Name"
    const cleanTitle = title.split(/\s*[|\-–]\s*/)[0].trim();
    if (cleanTitle.length > 0 && cleanTitle.length <= 50) {
      return cleanTitle;
    }
  }

  // If keyword available, create a phrase
  if (keyword) {
    const phrases = [
      `this ${keyword} guide`,
      `learn about ${keyword}`,
      `our ${keyword} resource`,
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  // Fall back to generic
  return MISC_TEMPLATES[Math.floor(Math.random() * MISC_TEMPLATES.length)];
}

/**
 * Extract insertion context from source page body.
 * Returns a short excerpt indicating where the link could be inserted.
 *
 * @param bodyText - Source page body text
 * @returns Insertion context hint
 */
function getInsertionContext(bodyText: string): string {
  // Split into paragraphs
  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 50); // Only substantial paragraphs

  if (paragraphs.length === 0) {
    return "No suitable insertion point found";
  }

  // Prefer second paragraph for natural link placement
  const targetParagraph = paragraphs.length > 1 ? paragraphs[1] : paragraphs[0];

  // Return first 100 chars as context
  const truncated = targetParagraph.slice(0, 100);
  return truncated.length < targetParagraph.length
    ? `${truncated}...`
    : truncated;
}

/**
 * Select optimal anchor text for a link suggestion.
 *
 * @param params - Selection parameters
 * @returns Anchor selection result
 */
export function selectAnchorText(params: SelectAnchorParams): AnchorSelection {
  const {
    sourcePage,
    targetKeyword,
    targetTitle,
    anchorDistribution,
  } = params;

  const hasBrand = Boolean(sourcePage.brandName);
  const hasKeyword = Boolean(targetKeyword);

  // Determine anchor type based on distribution
  const anchorType = determineAnchorType(
    anchorDistribution,
    hasKeyword,
    hasBrand
  );

  // Try to find existing text match for exact anchors
  let existingTextMatch: string | null = null;
  let anchorText: string;
  let confidence: number;

  if (anchorType === "exact" && targetKeyword) {
    // Try to find the keyword in source text
    existingTextMatch = findExistingTextMatch(sourcePage.bodyText, targetKeyword);

    if (existingTextMatch) {
      anchorText = existingTextMatch;
      confidence = CONFIDENCE.existingText;
    } else {
      // Use keyword directly, lower confidence
      anchorText = targetKeyword;
      confidence = CONFIDENCE.insertion;
    }
  } else if (anchorType === "branded" && sourcePage.brandName) {
    anchorText = generateBrandedAnchor(targetKeyword, sourcePage.brandName);
    confidence = CONFIDENCE.insertion;
  } else {
    // Misc anchor
    anchorText = generateMiscAnchor(targetTitle, targetKeyword);
    confidence = CONFIDENCE.insertion;
  }

  // Get insertion context if no existing match
  const insertionContext = existingTextMatch
    ? null
    : getInsertionContext(sourcePage.bodyText);

  return {
    anchorText,
    anchorType,
    confidence,
    existingTextMatch,
    insertionContext,
  };
}
