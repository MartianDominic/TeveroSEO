/**
 * SchemaGenerator - Type-safe Schema.org JSON-LD Generation
 * Phase 92: On-Page SEO Mastery
 *
 * Generates Schema.org JSON-LD with TypeScript type safety using schema-dts types.
 * Supports vertical-specific schema selection for Article, Product, LocalBusiness,
 * Service, Course, and SoftwareApplication.
 */
import type {
  Article,
  Person,
  Organization,
  Product,
  Offer,
  LocalBusiness,
  Service,
  Course,
  SoftwareApplication,
  WithContext,
  OpeningHoursSpecification,
} from "schema-dts";
import type { Vertical } from "../types";

// =============================================================================
// Input Data Interfaces
// =============================================================================

/**
 * Data required to generate an Article schema.
 */
export interface ArticleData {
  headline: string;
  description?: string;
  author: string;
  authorUrl?: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  url: string;
  publisher?: string;
  publisherLogo?: string;
}

/**
 * Data required to generate a Product schema.
 */
export interface ProductData {
  name: string;
  description?: string;
  image?: string;
  brand?: string;
  sku?: string;
  price?: number;
  priceCurrency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  url: string;
  reviewCount?: number;
  ratingValue?: number;
}

/**
 * Data required to generate a LocalBusiness schema.
 */
export interface LocalBusinessData {
  name: string;
  description?: string;
  image?: string;
  telephone?: string;
  email?: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  geo?: { latitude: number; longitude: number };
  openingHours?: string[];
  priceRange?: string;
  url: string;
}

/**
 * Data required to generate a Service schema.
 */
export interface ServiceData {
  name: string;
  description?: string;
  provider: string;
  areaServed?: string[];
  serviceType?: string;
  url: string;
}

/**
 * Data required to generate a Course schema.
 */
export interface CourseData {
  name: string;
  description?: string;
  provider: string;
  duration?: string;
  educationalLevel?: string;
  url: string;
}

/**
 * Data required to generate a SoftwareApplication schema.
 */
export interface SoftwareData {
  name: string;
  description?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: { price: number; priceCurrency: string };
  url: string;
}

// =============================================================================
// Schema Generators
// =============================================================================

/**
 * Generate Article schema (for blog posts, news, healthcare content).
 *
 * @param data - Article data including headline, author, dates
 * @returns JSON-LD string with proper Schema.org context
 */
export function generateArticleSchema(data: ArticleData): string {
  const schema: WithContext<Article> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.headline,
    description: data.description,
    author: {
      "@type": "Person",
      name: data.author,
      url: data.authorUrl,
    } as Person,
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    image: data.image,
    url: data.url,
    publisher: data.publisher
      ? ({
          "@type": "Organization",
          name: data.publisher,
          logo: data.publisherLogo
            ? {
                "@type": "ImageObject",
                url: data.publisherLogo,
              }
            : undefined,
        } as Organization)
      : undefined,
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * Generate Product schema (for e-commerce).
 *
 * @param data - Product data including name, price, availability
 * @returns JSON-LD string with proper Schema.org context
 */
export function generateProductSchema(data: ProductData): string {
  const schema: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: data.name,
    description: data.description,
    image: data.image,
    brand: data.brand
      ? {
          "@type": "Brand",
          name: data.brand,
        }
      : undefined,
    sku: data.sku,
    url: data.url,
    offers: data.price
      ? ({
          "@type": "Offer",
          price: data.price,
          priceCurrency: data.priceCurrency || "USD",
          availability: data.availability
            ? `https://schema.org/${data.availability}`
            : undefined,
        } as Offer)
      : undefined,
    aggregateRating:
      data.reviewCount && data.ratingValue
        ? {
            "@type": "AggregateRating",
            ratingValue: data.ratingValue,
            reviewCount: data.reviewCount,
          }
        : undefined,
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * Generate LocalBusiness schema (for home services, restaurants, etc.).
 *
 * @param data - LocalBusiness data including name, address, telephone
 * @returns JSON-LD string with proper Schema.org context
 */
export function generateLocalBusinessSchema(data: LocalBusinessData): string {
  const schema: WithContext<LocalBusiness> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: data.name,
    description: data.description,
    image: data.image,
    telephone: data.telephone,
    email: data.email,
    url: data.url,
    priceRange: data.priceRange,
    address: {
      "@type": "PostalAddress",
      streetAddress: data.address.street,
      addressLocality: data.address.city,
      addressRegion: data.address.state,
      postalCode: data.address.postalCode,
      addressCountry: data.address.country,
    },
    geo: data.geo
      ? {
          "@type": "GeoCoordinates",
          latitude: data.geo.latitude,
          longitude: data.geo.longitude,
        }
      : undefined,
    openingHoursSpecification: data.openingHours?.map(
      (hours) =>
        ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: hours.split(" ")[0],
          opens: hours.split(" ")[1]?.split("-")[0],
          closes: hours.split(" ")[1]?.split("-")[1],
        }) as OpeningHoursSpecification
    ),
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * Generate Service schema (for professional services).
 *
 * @param data - Service data including name, provider, area served
 * @returns JSON-LD string with proper Schema.org context
 */
export function generateServiceSchema(data: ServiceData): string {
  const schema: WithContext<Service> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: data.name,
    description: data.description,
    provider: {
      "@type": "Organization",
      name: data.provider,
    } as Organization,
    areaServed: data.areaServed,
    serviceType: data.serviceType,
    url: data.url,
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * Generate Course schema (for education).
 *
 * @param data - Course data including name, provider, duration
 * @returns JSON-LD string with proper Schema.org context
 */
export function generateCourseSchema(data: CourseData): string {
  const schema: WithContext<Course> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: data.name,
    description: data.description,
    provider: {
      "@type": "Organization",
      name: data.provider,
    } as Organization,
    timeRequired: data.duration,
    educationalLevel: data.educationalLevel,
    url: data.url,
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * Generate SoftwareApplication schema (for SaaS).
 *
 * @param data - Software data including name, category, offers
 * @returns JSON-LD string with proper Schema.org context
 */
export function generateSoftwareSchema(data: SoftwareData): string {
  const schema: WithContext<SoftwareApplication> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: data.name,
    description: data.description,
    applicationCategory: data.applicationCategory,
    operatingSystem: data.operatingSystem,
    url: data.url,
    offers: data.offers
      ? ({
          "@type": "Offer",
          price: data.offers.price,
          priceCurrency: data.offers.priceCurrency,
        } as Offer)
      : undefined,
  };

  return JSON.stringify(schema, null, 2);
}

// =============================================================================
// Vertical-Specific Schema Selection
// =============================================================================

/**
 * Vertical to recommended Schema.org type mapping.
 * Each vertical maps to 1-2 primary schema types for rich snippet eligibility.
 */
const VERTICAL_SCHEMAS: Record<Vertical, string[]> = {
  healthcare: ["Article", "MedicalOrganization"],
  legal: ["Article", "LegalService"],
  financial: ["Article", "FinancialService"],
  ecommerce: ["Product", "ItemList"],
  saas: ["SoftwareApplication", "Article"],
  real_estate: ["LocalBusiness", "RealEstateListing"],
  home_services: ["LocalBusiness", "Service"],
  hospitality: ["LocalBusiness", "Hotel", "Restaurant"],
  education: ["Course", "EducationalOrganization"],
  professional: ["Service", "LocalBusiness"],
  manufacturing: ["Product", "Organization"],
  nonprofit: ["Organization", "Article"],
  general: ["Article", "WebPage"],
};

/**
 * Get recommended schema type(s) for a vertical.
 *
 * @param vertical - The page vertical classification
 * @returns Array of recommended Schema.org types
 */
export function getSchemaTypesForVertical(vertical: Vertical): string[] {
  return VERTICAL_SCHEMAS[vertical] || ["Article"];
}

// =============================================================================
// JSON-LD Validation
// =============================================================================

/**
 * Validation result for JSON-LD structure.
 */
export interface JsonLdValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate generated JSON-LD structure.
 *
 * Checks for required fields (@context, @type) and proper schema.org reference.
 * This is a structural validation, not a full Schema.org spec validation.
 *
 * @param jsonLd - JSON-LD string to validate
 * @returns Validation result with errors if any
 */
export function validateJsonLd(jsonLd: string): JsonLdValidationResult {
  const errors: string[] = [];

  try {
    const parsed = JSON.parse(jsonLd);

    // Required fields
    if (!parsed["@context"]) {
      errors.push("Missing @context");
    }
    if (!parsed["@type"]) {
      errors.push("Missing @type");
    }

    // Context should be schema.org
    if (parsed["@context"] && !parsed["@context"].includes("schema.org")) {
      errors.push("@context should reference schema.org");
    }

    return { valid: errors.length === 0, errors };
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
}
