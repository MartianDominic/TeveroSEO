/**
 * SchemaGenerator Tests
 * Phase 92: On-Page SEO Mastery
 *
 * Tests for type-safe Schema.org JSON-LD generation with vertical-specific schema selection.
 */
import { describe, it, expect } from "vitest";
import {
  generateArticleSchema,
  generateProductSchema,
  generateLocalBusinessSchema,
  generateServiceSchema,
  generateCourseSchema,
  generateSoftwareSchema,
  getSchemaTypesForVertical,
  validateJsonLd,
  type ArticleData,
  type ProductData,
  type LocalBusinessData,
  type ServiceData,
  type CourseData,
  type SoftwareData,
} from "./SchemaGenerator";

describe("SchemaGenerator", () => {
  describe("generateArticleSchema", () => {
    it("returns valid JSON-LD with @context and @type", () => {
      const data: ArticleData = {
        headline: "How to Improve SEO in 2026",
        author: "John Doe",
        datePublished: "2026-05-06",
        url: "https://example.com/seo-guide",
      };

      const result = generateArticleSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("Article");
      expect(parsed.headline).toBe("How to Improve SEO in 2026");
      expect(parsed.author["@type"]).toBe("Person");
      expect(parsed.author.name).toBe("John Doe");
    });

    it("includes dateModified when provided", () => {
      const data: ArticleData = {
        headline: "SEO Guide",
        author: "Jane Smith",
        datePublished: "2026-01-01",
        dateModified: "2026-05-06",
        url: "https://example.com/guide",
      };

      const result = generateArticleSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed.datePublished).toBe("2026-01-01");
      expect(parsed.dateModified).toBe("2026-05-06");
    });

    it("includes publisher organization when provided", () => {
      const data: ArticleData = {
        headline: "Test Article",
        author: "Author",
        datePublished: "2026-05-06",
        url: "https://example.com/test",
        publisher: "TeveroSEO",
        publisherLogo: "https://example.com/logo.png",
      };

      const result = generateArticleSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed.publisher["@type"]).toBe("Organization");
      expect(parsed.publisher.name).toBe("TeveroSEO");
      expect(parsed.publisher.logo["@type"]).toBe("ImageObject");
      expect(parsed.publisher.logo.url).toBe("https://example.com/logo.png");
    });

    it("defaults dateModified to datePublished when not provided", () => {
      const data: ArticleData = {
        headline: "Test",
        author: "Test Author",
        datePublished: "2026-05-06",
        url: "https://example.com/test",
      };

      const result = generateArticleSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed.dateModified).toBe("2026-05-06");
    });
  });

  describe("generateProductSchema", () => {
    it("includes price, availability, and brand", () => {
      const data: ProductData = {
        name: "SEO Audit Tool",
        description: "Professional SEO analysis software",
        price: 99.99,
        priceCurrency: "USD",
        availability: "InStock",
        brand: "TeveroSEO",
        url: "https://example.com/product",
      };

      const result = generateProductSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("Product");
      expect(parsed.name).toBe("SEO Audit Tool");
      expect(parsed.brand["@type"]).toBe("Brand");
      expect(parsed.brand.name).toBe("TeveroSEO");
      expect(parsed.offers["@type"]).toBe("Offer");
      expect(parsed.offers.price).toBe(99.99);
      expect(parsed.offers.priceCurrency).toBe("USD");
      expect(parsed.offers.availability).toBe("https://schema.org/InStock");
    });

    it("includes aggregate rating when review data provided", () => {
      const data: ProductData = {
        name: "Test Product",
        url: "https://example.com/product",
        ratingValue: 4.5,
        reviewCount: 120,
      };

      const result = generateProductSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed.aggregateRating["@type"]).toBe("AggregateRating");
      expect(parsed.aggregateRating.ratingValue).toBe(4.5);
      expect(parsed.aggregateRating.reviewCount).toBe(120);
    });

    it("omits offers when price not provided", () => {
      const data: ProductData = {
        name: "Free Product",
        url: "https://example.com/free",
      };

      const result = generateProductSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed.offers).toBeUndefined();
    });

    it("defaults priceCurrency to USD", () => {
      const data: ProductData = {
        name: "Test",
        url: "https://example.com/test",
        price: 50,
      };

      const result = generateProductSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed.offers.priceCurrency).toBe("USD");
    });
  });

  describe("generateLocalBusinessSchema", () => {
    it("includes name, address, and telephone", () => {
      const data: LocalBusinessData = {
        name: "TeveroSEO Agency",
        telephone: "+1-555-123-4567",
        address: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        url: "https://example.com",
      };

      const result = generateLocalBusinessSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("LocalBusiness");
      expect(parsed.name).toBe("TeveroSEO Agency");
      expect(parsed.telephone).toBe("+1-555-123-4567");
      expect(parsed.address["@type"]).toBe("PostalAddress");
      expect(parsed.address.streetAddress).toBe("123 Main St");
      expect(parsed.address.addressLocality).toBe("New York");
      expect(parsed.address.addressRegion).toBe("NY");
      expect(parsed.address.postalCode).toBe("10001");
      expect(parsed.address.addressCountry).toBe("US");
    });

    it("includes geo coordinates when provided", () => {
      const data: LocalBusinessData = {
        name: "Test Business",
        address: {
          street: "456 Oak Ave",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90001",
          country: "US",
        },
        geo: {
          latitude: 34.0522,
          longitude: -118.2437,
        },
        url: "https://example.com",
      };

      const result = generateLocalBusinessSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed.geo["@type"]).toBe("GeoCoordinates");
      expect(parsed.geo.latitude).toBe(34.0522);
      expect(parsed.geo.longitude).toBe(-118.2437);
    });

    it("includes opening hours specification", () => {
      const data: LocalBusinessData = {
        name: "Test",
        address: {
          street: "Test",
          city: "Test",
          state: "Test",
          postalCode: "12345",
          country: "US",
        },
        openingHours: ["Monday 09:00-17:00", "Tuesday 09:00-17:00"],
        url: "https://example.com",
      };

      const result = generateLocalBusinessSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed.openingHoursSpecification).toHaveLength(2);
      expect(parsed.openingHoursSpecification[0]["@type"]).toBe(
        "OpeningHoursSpecification"
      );
    });

    it("includes priceRange when provided", () => {
      const data: LocalBusinessData = {
        name: "Test",
        address: {
          street: "Test",
          city: "Test",
          state: "Test",
          postalCode: "12345",
          country: "US",
        },
        priceRange: "$$",
        url: "https://example.com",
      };

      const result = generateLocalBusinessSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed.priceRange).toBe("$$");
    });
  });

  describe("generateServiceSchema", () => {
    it("generates valid Service schema", () => {
      const data: ServiceData = {
        name: "SEO Consulting",
        description: "Professional SEO consulting services",
        provider: "TeveroSEO",
        areaServed: ["United States", "Canada"],
        serviceType: "Consulting",
        url: "https://example.com/services/seo",
      };

      const result = generateServiceSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("Service");
      expect(parsed.name).toBe("SEO Consulting");
      expect(parsed.provider["@type"]).toBe("Organization");
      expect(parsed.provider.name).toBe("TeveroSEO");
      expect(parsed.areaServed).toEqual(["United States", "Canada"]);
      expect(parsed.serviceType).toBe("Consulting");
    });
  });

  describe("generateCourseSchema", () => {
    it("generates valid Course schema", () => {
      const data: CourseData = {
        name: "SEO Mastery 101",
        description: "Learn SEO fundamentals",
        provider: "TeveroSEO Academy",
        duration: "PT10H",
        educationalLevel: "Beginner",
        url: "https://example.com/courses/seo",
      };

      const result = generateCourseSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("Course");
      expect(parsed.name).toBe("SEO Mastery 101");
      expect(parsed.provider["@type"]).toBe("Organization");
      expect(parsed.provider.name).toBe("TeveroSEO Academy");
      expect(parsed.timeRequired).toBe("PT10H");
      expect(parsed.educationalLevel).toBe("Beginner");
    });
  });

  describe("generateSoftwareSchema", () => {
    it("generates valid SoftwareApplication schema", () => {
      const data: SoftwareData = {
        name: "TeveroSEO Platform",
        description: "All-in-one SEO platform",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          price: 49,
          priceCurrency: "USD",
        },
        url: "https://teveroseo.com",
      };

      const result = generateSoftwareSchema(data);
      const parsed = JSON.parse(result);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("SoftwareApplication");
      expect(parsed.name).toBe("TeveroSEO Platform");
      expect(parsed.applicationCategory).toBe("BusinessApplication");
      expect(parsed.operatingSystem).toBe("Web");
      expect(parsed.offers["@type"]).toBe("Offer");
      expect(parsed.offers.price).toBe(49);
    });
  });

  describe("getSchemaTypesForVertical", () => {
    it("returns Article and MedicalOrganization for healthcare", () => {
      const schemas = getSchemaTypesForVertical("healthcare");
      expect(schemas).toContain("Article");
      expect(schemas).toContain("MedicalOrganization");
    });

    it("returns Product and ItemList for ecommerce", () => {
      const schemas = getSchemaTypesForVertical("ecommerce");
      expect(schemas).toContain("Product");
      expect(schemas).toContain("ItemList");
    });

    it("returns SoftwareApplication and Article for saas", () => {
      const schemas = getSchemaTypesForVertical("saas");
      expect(schemas).toContain("SoftwareApplication");
      expect(schemas).toContain("Article");
    });

    it("returns LocalBusiness and Service for home_services", () => {
      const schemas = getSchemaTypesForVertical("home_services");
      expect(schemas).toContain("LocalBusiness");
      expect(schemas).toContain("Service");
    });

    it("returns Course and EducationalOrganization for education", () => {
      const schemas = getSchemaTypesForVertical("education");
      expect(schemas).toContain("Course");
      expect(schemas).toContain("EducationalOrganization");
    });

    it("returns Article for legal vertical", () => {
      const schemas = getSchemaTypesForVertical("legal");
      expect(schemas).toContain("Article");
      expect(schemas).toContain("LegalService");
    });

    it("returns Article for financial vertical", () => {
      const schemas = getSchemaTypesForVertical("financial");
      expect(schemas).toContain("Article");
      expect(schemas).toContain("FinancialService");
    });

    it("maps all 13 verticals", () => {
      const verticals = [
        "healthcare",
        "legal",
        "financial",
        "ecommerce",
        "saas",
        "real_estate",
        "home_services",
        "hospitality",
        "education",
        "professional",
        "manufacturing",
        "nonprofit",
        "general",
      ] as const;

      for (const vertical of verticals) {
        const schemas = getSchemaTypesForVertical(vertical);
        expect(schemas.length).toBeGreaterThan(0);
        expect(Array.isArray(schemas)).toBe(true);
      }
    });
  });

  describe("validateJsonLd", () => {
    it("returns valid for properly structured JSON-LD", () => {
      const validJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Test",
      });

      const result = validateJsonLd(validJsonLd);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("catches missing @context", () => {
      const invalidJsonLd = JSON.stringify({
        "@type": "Article",
        headline: "Test",
      });

      const result = validateJsonLd(invalidJsonLd);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing @context");
    });

    it("catches missing @type", () => {
      const invalidJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        headline: "Test",
      });

      const result = validateJsonLd(invalidJsonLd);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing @type");
    });

    it("catches invalid @context (not schema.org)", () => {
      const invalidJsonLd = JSON.stringify({
        "@context": "https://invalid.org",
        "@type": "Article",
      });

      const result = validateJsonLd(invalidJsonLd);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("@context should reference schema.org");
    });

    it("catches invalid JSON", () => {
      const invalidJson = "{ invalid json }";

      const result = validateJsonLd(invalidJson);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid JSON");
    });
  });

  describe("JSON-LD validation roundtrip", () => {
    it("all generated schemas pass validation", () => {
      const articleSchema = generateArticleSchema({
        headline: "Test",
        author: "Author",
        datePublished: "2026-01-01",
        url: "https://example.com",
      });

      const productSchema = generateProductSchema({
        name: "Test",
        url: "https://example.com",
      });

      const localBusinessSchema = generateLocalBusinessSchema({
        name: "Test",
        address: {
          street: "123 Main",
          city: "City",
          state: "ST",
          postalCode: "12345",
          country: "US",
        },
        url: "https://example.com",
      });

      const serviceSchema = generateServiceSchema({
        name: "Test",
        provider: "Provider",
        url: "https://example.com",
      });

      const courseSchema = generateCourseSchema({
        name: "Test",
        provider: "Provider",
        url: "https://example.com",
      });

      const softwareSchema = generateSoftwareSchema({
        name: "Test",
        url: "https://example.com",
      });

      expect(validateJsonLd(articleSchema).valid).toBe(true);
      expect(validateJsonLd(productSchema).valid).toBe(true);
      expect(validateJsonLd(localBusinessSchema).valid).toBe(true);
      expect(validateJsonLd(serviceSchema).valid).toBe(true);
      expect(validateJsonLd(courseSchema).valid).toBe(true);
      expect(validateJsonLd(softwareSchema).valid).toBe(true);
    });
  });
});
