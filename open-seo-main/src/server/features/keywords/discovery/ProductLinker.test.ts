/**
 * ProductLinker Tests
 *
 * Tests for keyword-to-product matching with confidence scoring.
 */

import { describe, it, expect } from 'vitest';
import { linkKeywordsToProducts, type Product } from './ProductLinker';

describe('ProductLinker', () => {
  const mockProducts: Product[] = [
    {
      name: 'Hialurono serumas',
      category: 'veido-serumai',
      solvedProblems: ['sausa oda', 'raukšlės'],
    },
    {
      name: 'Keratino šampūnas',
      category: 'sampunai',
      solvedProblems: ['plaukų slinkimas', 'plonų plaukų'],
    },
  ];

  it('Test 1: matches via direct_match + solves_problem', () => {
    const keywords = [
      { keyword: 'serumas sausai odai', volume: 180, difficulty: 42 },
    ];

    const result = linkKeywordsToProducts(keywords, mockProducts);

    expect(result).toHaveLength(1);
    expect(result[0].keyword).toBe('serumas sausai odai');
    expect(result[0].linkedProducts).toHaveLength(1);
    expect(result[0].linkedProducts[0].productName).toBe('Hialurono serumas');
    expect(result[0].linkedProducts[0].matchReason).toContain('direct_match');
    expect(result[0].linkageConfidence).toBeGreaterThanOrEqual(0.8);
  });

  it('Test 2: matches via problem only (solves_problem)', () => {
    const keywords = [
      { keyword: 'kaip sustabdyti plauku slinkima', volume: 320, difficulty: 38 },
    ];

    const result = linkKeywordsToProducts(keywords, mockProducts);

    expect(result).toHaveLength(1);
    expect(result[0].linkedProducts).toHaveLength(1);
    expect(result[0].linkedProducts[0].productName).toBe('Keratino šampūnas');
    expect(result[0].linkedProducts[0].matchReason).toBe('solves_problem');
    expect(result[0].linkageConfidence).toBeGreaterThanOrEqual(0.6);
  });

  it('Test 3: no matches have low confidence and generic landing page', () => {
    const keywords = [
      { keyword: 'nuotykių turizmas lietuvoje', volume: 450, difficulty: 55 },
    ];

    const result = linkKeywordsToProducts(keywords, mockProducts);

    expect(result).toHaveLength(1);
    expect(result[0].linkedProducts).toHaveLength(0);
    expect(result[0].linkageConfidence).toBeLessThanOrEqual(0.3);
    expect(result[0].suggestedLandingPage).toBe('/products');
  });

  it('Test 4: suggestedLandingPage uses product category when matched', () => {
    const keywords = [
      { keyword: 'veido serumas', volume: 210, difficulty: 40 },
    ];

    const result = linkKeywordsToProducts(keywords, mockProducts);

    expect(result).toHaveLength(1);
    expect(result[0].linkedProducts.length).toBeGreaterThan(0);
    expect(result[0].suggestedLandingPage).toContain('veido-serumai');
  });
});
