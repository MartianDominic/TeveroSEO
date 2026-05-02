---
phase: 58-service-catalog
plan: 01
subsystem: service-catalog
tags: [drizzle, api, i18n, backend]
dependency_graph:
  requires: [proposal-schema, organization-schema]
  provides: [serviceTemplates, proposalServices, ServiceRepository, ServiceCatalogService, service-api]
  affects: [proposals, agreement-generation]
tech_stack:
  added: []
  patterns: [repository-pattern, service-layer, soft-delete, system-templates]
key_files:
  created:
    - open-seo-main/src/db/service-catalog-schema.ts
    - open-seo-main/src/server/features/services/repositories/service.repository.ts
    - open-seo-main/src/server/features/services/services/ServiceCatalogService.ts
    - open-seo-main/src/routes/api/services/index.ts
    - open-seo-main/src/routes/api/services/$serviceId.ts
    - open-seo-main/src/routes/api/services/$serviceId.duplicate.ts
    - open-seo-main/src/db/seeds/default-services.ts
  modified:
    - open-seo-main/src/db/schema.ts
    - apps/web/src/i18n/messages/en.json
    - apps/web/src/i18n/messages/lt.json
decisions:
  - Soft delete via isActive flag (not isArchived) for services
  - System templates use workspaceId=null pattern from proposal templates
  - Price validation capped at 100M cents (1M EUR)
  - 8 default service templates (3 SEO packages + 5 add-ons)
metrics:
  duration_seconds: 356
  completed_at: "2026-05-02T11:57:02Z"
---

# Phase 58 Plan 01: Service Catalog Schema + Backend Summary

Service catalog backend with Drizzle schema, repository, service layer, and REST API for managing service templates.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Service Catalog Schema | d5adbc5f3 | service-catalog-schema.ts, schema.ts |
| 2 | Repository + Service + API | 5594e9c74 | service.repository.ts, ServiceCatalogService.ts, /api/services/* |
| 3 | i18n Keys | 383eadb76 | en.json, lt.json |

## What Was Built

### Schema (Task 1)
- `serviceTemplates` table with full i18n support (nameEn/Lt, descriptionEn/Lt, termsTemplateEn/Lt)
- `proposalServices` junction table linking proposals to service templates
- `SERVICE_CATEGORIES` enum: seo_package, addon, one_time
- `PRICING_TYPES` enum: monthly, one_time, per_unit
- Indexes on workspace, category, and isActive
- Check constraints for category and pricingType enums

### Repository Layer (Task 2)
ServiceRepository with 7 methods:
- `findAllServices` - List workspace + system templates
- `findServiceById` - Get single service
- `createService` - Create new template
- `updateService` - Update template
- `deleteService` - Soft delete (isActive=false)
- `duplicateService` - Copy template to workspace
- `countServicesForWorkspace` - Count for seeding check

### Service Layer (Task 2)
ServiceCatalogService with business logic:
- Input validation (category, pricingType, prices)
- Price bounds: 0 to 100,000,000 cents (1M EUR max)
- System template protection (cannot delete)
- Workspace ownership verification
- Auto-seeding of defaults via `ensureDefaultServices`

### REST API (Task 2)
Five endpoints following TanStack Start patterns:
- `GET /api/services` - List services with optional category filter
- `POST /api/services` - Create new service template
- `GET /api/services/:serviceId` - Get service details
- `PUT /api/services/:serviceId` - Update service
- `DELETE /api/services/:serviceId` - Soft delete
- `POST /api/services/:serviceId/duplicate` - Duplicate service

### Default Services (Task 2)
8 system templates (workspaceId=null):
- **SEO Packages**: Starter (500/mo), Growth (1,500/mo), Enterprise (3,000/mo)
- **Add-ons**: GMB (200/mo), Reviews (150/mo), Website (2,000 one-time), CRM (500 one-time), Booking (100/mo)

### i18n Keys (Task 3)
40+ translation keys in `serviceCatalog` namespace:
- Category labels, pricing type labels
- Form fields and action buttons
- Service selector UI strings
- Full Lithuanian translations

## Deviations from Plan

None - plan executed exactly as written.

## Security Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-58-01 (Spoofing) | workspaceId from auth.organizationId, not request body |
| T-58-02 (Tampering) | Server-side price validation: 0 <= cents <= 100,000,000 |
| T-58-03 (Elevation) | Repository checks workspaceId != null before soft delete |
| T-58-04 (Disclosure) | All queries filter by workspaceId from session |

## Self-Check: PASSED

- [x] service-catalog-schema.ts exists with serviceTemplates and proposalServices
- [x] Commit d5adbc5f3 exists (Task 1)
- [x] Commit 5594e9c74 exists (Task 2)
- [x] Commit 383eadb76 exists (Task 3)
- [x] All API route files exist
- [x] i18n keys in both en.json and lt.json
- [x] JSON files are valid
