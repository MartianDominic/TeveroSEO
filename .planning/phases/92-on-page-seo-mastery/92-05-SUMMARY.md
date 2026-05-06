---
phase: 92-on-page-seo-mastery
plan: 05
subsystem: onpage-mastery
tags: [schema-org, json-ld, seo, type-safety, structured-data]
dependency_graph:
  requires: [92-01, 92-02]
  provides: [schema-generator, vertical-schema-mapping, json-ld-validation]
  affects: [content-generation, audit-checks]
tech_stack:
  added: [schema-dts@2.0.0]
  patterns: [type-safe-json-ld, vertical-specific-schemas]
key_files:
  created:
    - src/server/features/onpage-mastery/utils/SchemaGenerator.ts
    - src/server/features/onpage-mastery/utils/SchemaGenerator.test.ts
  modified:
    - src/server/features/onpage-mastery/utils/index.ts
    - package.json
decisions:
  - Use schema-dts WithContext<T> for type-safe JSON-LD generation
  - Map all 13 verticals to 1-3 recommended Schema.org types
  - OpeningHoursSpecification requires explicit type cast for compatibility
metrics:
  duration: 702s
  completed: 2026-05-06T20:06:26Z
  tasks: 1
  tests: 29
---

# Phase 92 Plan 05: SchemaGenerator Summary

Type-safe Schema.org JSON-LD generation with vertical-specific schema selection using schema-dts TypeScript types.

## One-liner

SchemaGenerator with 6 schema types (Article, Product, LocalBusiness, Service, Course, SoftwareApplication) and vertical-to-schema mapping for all 13 industry verticals.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 13d638f | feat | SchemaGenerator with type-safe Schema.org JSON-LD generation |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OpeningHoursSpecification TypeScript compatibility**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** schema-dts OpeningHoursSpecification type required explicit cast for array mapping
- **Fix:** Added `as OpeningHoursSpecification` cast to opening hours map result
- **Files modified:** SchemaGenerator.ts
- **Commit:** 13d638f

## Key Deliverables

### Schema Generators (6 types)

| Generator | Schema Type | Use Case |
|-----------|-------------|----------|
| `generateArticleSchema()` | Article | Blog posts, news, healthcare content |
| `generateProductSchema()` | Product | E-commerce products |
| `generateLocalBusinessSchema()` | LocalBusiness | Home services, restaurants, local businesses |
| `generateServiceSchema()` | Service | Professional services |
| `generateCourseSchema()` | Course | Education, training |
| `generateSoftwareSchema()` | SoftwareApplication | SaaS products |

### Vertical Schema Mapping (13 verticals)

| Vertical | Primary Schema | Secondary Schema |
|----------|----------------|------------------|
| healthcare | Article | MedicalOrganization |
| legal | Article | LegalService |
| financial | Article | FinancialService |
| ecommerce | Product | ItemList |
| saas | SoftwareApplication | Article |
| real_estate | LocalBusiness | RealEstateListing |
| home_services | LocalBusiness | Service |
| hospitality | LocalBusiness | Hotel/Restaurant |
| education | Course | EducationalOrganization |
| professional | Service | LocalBusiness |
| manufacturing | Product | Organization |
| nonprofit | Organization | Article |
| general | Article | WebPage |

### Validation

`validateJsonLd()` checks:
- Required `@context` field
- Required `@type` field
- `@context` references schema.org
- Valid JSON structure

## Test Coverage

29 tests covering:
- Article schema generation with all optional fields
- Product schema with price, availability, ratings
- LocalBusiness schema with address, geo, opening hours
- Service, Course, SoftwareApplication schemas
- Vertical-to-schema mapping for all 13 verticals
- JSON-LD validation (valid, missing @context, missing @type, invalid context, invalid JSON)
- Roundtrip validation (all generated schemas pass validation)

## API Reference

```typescript
// Generate schema JSON-LD strings
generateArticleSchema(data: ArticleData): string
generateProductSchema(data: ProductData): string
generateLocalBusinessSchema(data: LocalBusinessData): string
generateServiceSchema(data: ServiceData): string
generateCourseSchema(data: CourseData): string
generateSoftwareSchema(data: SoftwareData): string

// Get recommended schemas for vertical
getSchemaTypesForVertical(vertical: Vertical): string[]

// Validate generated JSON-LD
validateJsonLd(jsonLd: string): JsonLdValidationResult
```

## Usage Example

```typescript
import { 
  generateArticleSchema, 
  getSchemaTypesForVertical,
  validateJsonLd 
} from "@/server/features/onpage-mastery/utils";

// Get recommended schemas for healthcare
const schemas = getSchemaTypesForVertical("healthcare");
// Returns: ["Article", "MedicalOrganization"]

// Generate Article schema
const jsonLd = generateArticleSchema({
  headline: "Understanding Heart Health",
  author: "Dr. Jane Smith",
  datePublished: "2026-05-06",
  url: "https://example.com/heart-health",
  publisher: "Health News",
});

// Validate the output
const { valid, errors } = validateJsonLd(jsonLd);
// valid: true, errors: []
```

## Self-Check: PASSED

- [x] SchemaGenerator.ts exists at expected path
- [x] SchemaGenerator.test.ts exists at expected path
- [x] Commit 13d638f verified in git log
- [x] All 29 tests pass
- [x] TypeScript compiles without errors
- [x] Exports added to utils/index.ts
