---
phase: 58
plan: 02
subsystem: apps/web
tags: [ui, settings, service-catalog, crud]
dependency_graph:
  requires: [58-01-schema]
  provides: [service-settings-page, service-crud-ui]
  affects: [settings-page]
tech_stack:
  added: []
  patterns: [server-actions, react-suspense, shadcn-dialog]
key_files:
  created:
    - apps/web/src/app/(shell)/settings/services/page.tsx
    - apps/web/src/app/(shell)/settings/services/actions.ts
    - apps/web/src/app/(shell)/settings/services/components/ServiceTable.tsx
    - apps/web/src/app/(shell)/settings/services/components/ServiceCard.tsx
    - apps/web/src/app/(shell)/settings/services/components/ServiceFormModal.tsx
  modified:
    - apps/web/src/app/(shell)/settings/page.tsx
decisions:
  - Used server actions with Zod validation for CRUD operations
  - Grouped services by category (seo_package, addon, one_time)
  - System templates marked read-only with lock icon
  - i18n support via nameEn/nameLt, descriptionEn/descriptionLt fields
metrics:
  duration_minutes: 4
  completed: "2026-05-02T11:56:00Z"
---

# Phase 58 Plan 02: Service Settings UI Summary

Settings > Services page with full CRUD operations for service catalog templates.

## One-Liner

Service settings page with grouped table view, create/edit modal, and CRUD server actions for managing proposal service templates.

## What Was Built

### Server Actions (actions.ts)
- `getServices()` - Fetch all services for workspace
- `getService(id)` - Fetch single service by ID
- `createService(data)` - Create new service template
- `updateService(id, data)` - Update existing service
- `deleteService(id)` - Soft delete via isActive=false
- `duplicateService(id)` - Clone service with "(Copy)" suffix

### UI Components
- **ServiceTable**: Groups services by category with empty states
- **ServiceCard**: Individual service row with dropdown actions
- **ServiceFormModal**: Full form with all fields for create/edit

### Features
- Breadcrumb navigation (Settings > Services)
- Three category groups: SEO Packages, Add-Ons, One-Time
- System templates show lock icon, disable edit/delete
- Price formatting with currency support
- Dynamic inclusions list (add/remove items)
- Agreement terms template field
- Icon selection from predefined set

## Commits

| Hash | Message |
|------|---------|
| 0b4361f52 | feat(58-02): add services settings page with server actions |
| b8b0946a2 | feat(58-02): add ServiceTable and ServiceCard components |
| 267d1b6ce | feat(58-02): add ServiceFormModal with full i18n support |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

### Server Actions Pattern
Used existing patterns from `prospects/actions.ts`:
- Zod schema validation with detailed error messages
- `requireActionAuth()` for authentication
- `sanitizeErrorForClient()` for safe error display
- `revalidatePath()` after mutations

### Form Modal Design
- Modal resets state based on mode (create vs edit)
- Effect hook populates form when editing existing service
- Validation runs before submit with user-friendly errors
- Inclusions managed as string array with add/remove UI

### Integration Points
- ServiceTable imports ServiceFormModal for create flow
- ServiceCard imports ServiceFormModal for edit flow
- Actions integrate with open-seo-main backend `/api/services` endpoints

## Self-Check: PASSED

All files verified:
- [x] apps/web/src/app/(shell)/settings/services/page.tsx exists
- [x] apps/web/src/app/(shell)/settings/services/actions.ts exists
- [x] apps/web/src/app/(shell)/settings/services/components/ServiceTable.tsx exists
- [x] apps/web/src/app/(shell)/settings/services/components/ServiceCard.tsx exists
- [x] apps/web/src/app/(shell)/settings/services/components/ServiceFormModal.tsx exists
- [x] Settings page has link to /settings/services
- [x] All commits exist in git history
