/**
 * SEO Chat Package Constants
 * Phase 98-07: Single source of truth for package pricing and details
 *
 * All package prices and metadata should import from this file to ensure
 * consistency across ProposalSlideOver, SeoChatProposalView, and proposal.ts.
 */

export const PACKAGES = {
  pamatas: {
    name: 'Pamatas',
    nameEn: 'Foundation',
    description: 'Essential SEO foundation for small businesses',
    price: 497,
    currency: 'EUR',
    period: 'mėn.',
    periodEn: '/mo',
    keywordLimit: 100,
    features: [
      'Technical SEO audit',
      'On-page optimization',
      'Monthly reporting',
      '5 target keywords',
    ],
  },
  augimas: {
    name: 'Augimas',
    nameEn: 'Growth',
    description: 'Growth-focused SEO for scaling businesses',
    price: 997,
    currency: 'EUR',
    period: 'mėn.',
    periodEn: '/mo',
    keywordLimit: 200,
    features: [
      'Everything in Pamatas',
      'Content strategy',
      'Link building (10/mo)',
      '15 target keywords',
    ],
  },
  autoritetas: {
    name: 'Autoritetas',
    nameEn: 'Authority',
    description: 'Authority building for market leaders',
    price: 1997,
    currency: 'EUR',
    period: 'mėn.',
    periodEn: '/mo',
    keywordLimit: 400,
    features: [
      'Everything in Augimas',
      'Digital PR',
      'Link building (25/mo)',
      '30 target keywords',
    ],
  },
} as const;

export type PackageType = keyof typeof PACKAGES;

export type PackageConfig = (typeof PACKAGES)[PackageType];

/**
 * Format price for display
 * @param packageType - The package type key
 * @param includeSymbol - Whether to include the Euro symbol (default: true)
 * @returns Formatted price string like "€497/mo" or "497/mo"
 */
export function formatPackagePrice(
  packageType: PackageType,
  includeSymbol = true
): string {
  const pkg = PACKAGES[packageType];
  const price = pkg.price.toLocaleString('lt-LT');
  const symbol = includeSymbol ? '€' : '';
  return `${symbol}${price}${pkg.periodEn}`;
}

/**
 * Get package price as number
 */
export function getPackagePrice(packageType: PackageType): number {
  return PACKAGES[packageType].price;
}

/**
 * Get keyword limit for a package
 */
export function getPackageKeywordLimit(packageType: PackageType): number {
  return PACKAGES[packageType].keywordLimit;
}
