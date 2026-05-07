/**
 * Ecommerce Vertical Rules
 * Phase 92-04: RuleEngineService
 *
 * Rules specific to ecommerce/product pages.
 * These rules enforce product schema, price transparency,
 * and shopping experience best practices.
 */

import type { RuleDefinition } from "./types";

/**
 * Ecommerce-specific rules.
 * Focus on product information and shopping experience.
 */
export const ecommerceRules: RuleDefinition[] = [
  {
    id: "R-EC-01",
    name: "Product schema present",
    description: "Product pages have Product schema with required properties",
    category: "schema",
    weight: 2.0,
    severity: "high",
    verticals: ["ecommerce"],
    evaluate: (ctx) => {
      const hasProductSchema = ctx.metadata.schemas.some(
        (s) =>
          s.includes('"@type":"Product"') || s.includes('"@type": "Product"')
      );
      return {
        passed: hasProductSchema,
        score: hasProductSchema ? 100 : 0,
        message: hasProductSchema
          ? "Product schema found"
          : "Missing Product schema",
      };
    },
  },
  {
    id: "R-EC-02",
    name: "Price visible",
    description: "Product price is clearly displayed",
    category: "content",
    weight: 2.0,
    severity: "high",
    verticals: ["ecommerce"],
    evaluate: (ctx) => {
      const pricePatterns = [
        /\$\d+(\.\d{2})?/,
        /\d+(\.\d{2})?\s*(USD|EUR|GBP)/i,
        /price:?\s*\$?\d+/i,
      ];
      const hasPriceText = pricePatterns.some((p) => p.test(ctx.text));
      const hasPriceElement =
        ctx.$('[itemprop="price"], .price, .product-price, [data-price]').length > 0;

      const hasPrice = hasPriceText || hasPriceElement;
      return {
        passed: hasPrice,
        score: hasPrice ? 100 : 0,
        message: hasPrice
          ? "Price information found"
          : "Missing visible price",
      };
    },
  },
  {
    id: "R-EC-03",
    name: "Product images present",
    description: "Product has multiple high-quality images",
    category: "content",
    weight: 1.5,
    severity: "high",
    verticals: ["ecommerce"],
    evaluate: (ctx) => {
      const productImages = ctx.$(
        '[itemprop="image"], .product-image, .gallery img, [data-product-image]'
      ).length;
      const allImages = ctx.metadata.images;

      // Product pages should have multiple images
      const passed = productImages >= 1 || allImages >= 3;
      return {
        passed,
        score: passed ? 100 : Math.min(100, allImages * 25),
        message: `${productImages || allImages} product images found`,
        details: { productImages, totalImages: allImages },
      };
    },
  },
  {
    id: "R-EC-04",
    name: "Add to cart functionality",
    description: "Product has clear add to cart/buy button",
    category: "structure",
    weight: 1.5,
    severity: "high",
    verticals: ["ecommerce"],
    evaluate: (ctx) => {
      const buyPatterns = [
        /add to (cart|bag|basket)/i,
        /buy now/i,
        /purchase/i,
        /checkout/i,
      ];
      const hasBuyText = buyPatterns.some((p) => p.test(ctx.text));
      const hasBuyButton =
        ctx.$(
          'button:contains("cart"), button:contains("buy"), .add-to-cart, [data-add-to-cart]'
        ).length > 0 ||
        ctx.$('input[type="submit"][value*="cart" i]').length > 0;

      const hasBuy = hasBuyText || hasBuyButton;
      return {
        passed: hasBuy,
        score: hasBuy ? 100 : 0,
        message: hasBuy
          ? "Add to cart functionality found"
          : "Missing add to cart button",
      };
    },
  },
  {
    id: "R-EC-05",
    name: "Product description",
    description: "Product has detailed description",
    category: "content",
    weight: 1.5,
    severity: "high",
    verticals: ["ecommerce"],
    evaluate: (ctx) => {
      const descElement = ctx.$(
        '[itemprop="description"], .product-description, .description'
      );
      const descText = descElement.length > 0 ? descElement.text().trim() : "";
      const wordCount = descText.split(/\s+/).filter(Boolean).length;

      const passed = wordCount >= 50;
      return {
        passed,
        score: passed ? 100 : Math.min(100, wordCount * 2),
        message: `${wordCount} words in product description`,
        details: { wordCount },
      };
    },
  },
  {
    id: "R-EC-06",
    name: "Reviews/ratings section",
    description: "Product has customer reviews or ratings",
    category: "trust",
    weight: 1.0,
    severity: "medium",
    verticals: ["ecommerce"],
    evaluate: (ctx) => {
      const hasReviews =
        ctx.$(
          '[itemprop="review"], [itemprop="aggregateRating"], .reviews, .rating, .stars'
        ).length > 0;
      const hasReviewText =
        /\d+\s*(review|rating|star)/i.test(ctx.text) ||
        /customer reviews/i.test(ctx.text);

      const found = hasReviews || hasReviewText;
      return {
        passed: found,
        score: found ? 100 : 50,
        message: found
          ? "Reviews/ratings section found"
          : "Consider adding customer reviews",
      };
    },
  },
  {
    id: "R-EC-07",
    name: "Shipping information",
    description: "Shipping details or policies are accessible",
    category: "content",
    weight: 1.0,
    severity: "medium",
    verticals: ["ecommerce"],
    evaluate: (ctx) => {
      const shippingPatterns = [
        /shipping/i,
        /delivery/i,
        /free shipping/i,
        /ships in/i,
        /arrives by/i,
      ];
      const hasShipping =
        shippingPatterns.some((p) => p.test(ctx.text)) ||
        ctx.$('a[href*="shipping"], .shipping-info').length > 0;

      return {
        passed: hasShipping,
        score: hasShipping ? 100 : 50,
        message: hasShipping
          ? "Shipping information found"
          : "Consider adding shipping details",
      };
    },
  },
  {
    id: "R-EC-08",
    name: "Offer schema with availability",
    description: "Product schema includes Offer with availability",
    category: "schema",
    weight: 1.0,
    severity: "medium",
    verticals: ["ecommerce"],
    evaluate: (ctx) => {
      const hasOffer = ctx.metadata.schemas.some(
        (s) =>
          (s.includes('"@type":"Offer"') || s.includes('"@type": "Offer"')) &&
          s.includes("availability")
      );
      return {
        passed: hasOffer,
        score: hasOffer ? 100 : 50,
        message: hasOffer
          ? "Offer schema with availability found"
          : "Consider adding Offer schema with availability",
      };
    },
  },
];
