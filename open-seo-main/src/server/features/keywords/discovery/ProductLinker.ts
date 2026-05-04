/**
 * ProductLinker
 *
 * Links discovered keywords to client products/services based on direct matches,
 * problem-solution mapping, and category matching.
 */

/**
 * Normalize Lithuanian text by removing diacritics
 */
function normalizeLithuanian(text: string): string {
  return text
    .toLowerCase()
    .replace(/ą/g, 'a')
    .replace(/č/g, 'c')
    .replace(/ę/g, 'e')
    .replace(/ė/g, 'e')
    .replace(/į/g, 'i')
    .replace(/š/g, 's')
    .replace(/ų/g, 'u')
    .replace(/ū/g, 'u')
    .replace(/ž/g, 'z');
}

export interface Product {
  name: string;
  category: string;
  solvedProblems: string[];
}

export interface LinkedProduct {
  productName: string;
  category: string;
  matchReason: string;  // "direct_match", "solves_problem", "category_match", "direct_match+solves_problem"
}

export interface ProductLinkage {
  keyword: string;
  linkedProducts: LinkedProduct[];
  linkageConfidence: number;
  suggestedLandingPage: string;
}

interface KeywordInput {
  keyword: string;
  volume: number;
  difficulty: number;
}

/**
 * Link keywords to products/services
 *
 * Matching logic:
 * 1. Direct product name match (keyword contains product name)
 * 2. Problem-solution match (keyword problem → product.solvedProblems)
 * 3. Category match (keyword contains category)
 *
 * Confidence scoring:
 * - Direct match only: 0.8
 * - Problem match only: 0.7
 * - Direct + problem: 0.9
 * - Category match: 0.6
 * - No match: 0.3
 */
export function linkKeywordsToProducts(
  keywords: KeywordInput[],
  products: Product[],
): ProductLinkage[] {
  const linkages: ProductLinkage[] = [];

  for (const kw of keywords) {
    const keywordNormalized = normalizeLithuanian(kw.keyword);
    const matches: LinkedProduct[] = [];
    let hasDirectMatch = false;
    let hasProblemMatch = false;

    // 1. Direct product name match
    for (const product of products) {
      const productNameNormalized = normalizeLithuanian(product.name);
      // Match core product word (e.g., "serumas" from "Hialurono serumas")
      const productCoreWords = productNameNormalized.split(' ');

      const directMatch = productCoreWords.some(word =>
        word.length > 3 && keywordNormalized.includes(word)
      );

      if (directMatch) {
        hasDirectMatch = true;

        // Also check if keyword mentions the problem this product solves
        const problemMatch = product.solvedProblems.some(problem => {
          const problemWords = normalizeLithuanian(problem).split(' ');
          return problemWords.some(word =>
            word.length > 3 && keywordNormalized.includes(word)
          );
        });

        if (problemMatch) {
          hasProblemMatch = true;
          matches.push({
            productName: product.name,
            category: product.category,
            matchReason: 'direct_match+solves_problem',
          });
        } else {
          matches.push({
            productName: product.name,
            category: product.category,
            matchReason: 'direct_match',
          });
        }
      }
    }

    // 2. Problem-solution match (if no direct match found)
    if (!hasDirectMatch) {
      for (const product of products) {
        const problemMatch = product.solvedProblems.some(problem => {
          const problemWords = normalizeLithuanian(problem).split(' ');
          return problemWords.some(word =>
            word.length > 3 && keywordNormalized.includes(word)
          );
        });

        if (problemMatch) {
          hasProblemMatch = true;
          matches.push({
            productName: product.name,
            category: product.category,
            matchReason: 'solves_problem',
          });
        }
      }
    }

    // Compute confidence
    let confidence = 0.3; // Default for no matches
    if (hasDirectMatch && hasProblemMatch) {
      confidence = 0.9;
    } else if (hasDirectMatch) {
      confidence = 0.8;
    } else if (hasProblemMatch) {
      confidence = 0.7;
    }

    // Determine landing page
    let landingPage = '/products';
    if (matches.length > 0) {
      // Use first match category
      const firstMatch = matches[0];
      landingPage = `/products/${firstMatch.category}`;
    }

    linkages.push({
      keyword: kw.keyword,
      linkedProducts: matches,
      linkageConfidence: confidence,
      suggestedLandingPage: landingPage,
    });
  }

  return linkages;
}
