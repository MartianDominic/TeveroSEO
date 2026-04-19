---
phase: 16-report-scheduling-white-label
plan: 03
subsystem: white-label-branding
tags: [drizzle, api, file-storage, branding, white-label]
dependency_graph:
  requires: [16-01]
  provides: [clientBranding table, branding API, logo storage]
  affects: [report-processor (future Plan 04)]
tech_stack:
  added: []
  patterns: [file-storage, multipart-upload, upsert-api]
key_files:
  created:
    - open-seo-main/src/db/branding-schema.ts
    - open-seo-main/src/db/branding-schema.test.ts
    - open-seo-main/src/server/lib/storage.ts
    - open-seo-main/src/server/lib/storage.test.ts
    - open-seo-main/src/routes/api/branding/index.ts
    - open-seo-main/src/routes/api/branding/$clientId.logo.ts
    - apps/web/src/app/api/clients/[clientId]/branding/route.ts
    - apps/web/src/app/api/clients/[clientId]/branding/logo/route.ts
  modified:
    - open-seo-main/src/db/schema.ts
    - docker-compose.vps.yml
decisions:
  - "Tevero default colors: primary #3b82f6 (blue), secondary #10b981 (green)"
  - "Logo max size 2MB, allowed types PNG/JPG/SVG only"
  - "Branding stored in Docker volume branding_data at /data/branding"
  - "One branding record per client (unique constraint)"
  - "Footer HTML sanitized: scripts and event handlers stripped"
key_links_verified:
  - branding/index.ts -> clientBranding (db/branding-schema.ts)
  - branding/$clientId.logo.ts -> saveBrandingLogo (storage.ts)
  - branding/$clientId.logo.ts -> deleteBrandingLogo (storage.ts)
metrics:
  duration_minutes: 7
  completed: 2026-04-19T16:38:30Z
  tasks_completed: 3
  tasks_total: 3
  files_created: 8
  files_modified: 2
  tests_added: 25
---

# Phase 16 Plan 03: Client Branding Schema & API Summary

Drizzle schema, file storage, and API for white-label branding (logo, colors, footer text).

## One-Liner

Client branding table with file storage for logos and upsert API with hex color validation.

## What Was Built

### 1. Drizzle Schema (`branding-schema.ts`)
- `client_branding` table with all required columns per CONTEXT.md
- UUID primary key with unique constraint on clientId
- Columns: logoUrl, primaryColor, secondaryColor, footerText
- Default colors: #3b82f6 (Tevero blue), #10b981 (Tevero green)
- Timestamp columns: createdAt, updatedAt
- Type exports: `ClientBrandingSelect`, `ClientBrandingInsert`

### 2. File Storage (`storage.ts`)
- `saveBrandingLogo(clientId, buffer, mimeType)` - saves to /data/branding/{clientId}/
- `deleteBrandingLogo(clientId)` - removes all logo variants
- `getBrandingLogoPath(clientId)` - finds existing logo path
- Validates: 2MB max size, PNG/JPG/SVG only
- Path traversal prevention via clientId sanitization

### 3. Branding CRUD API (open-seo-main)
- `GET /api/branding?client_id={id}` - Get branding or Tevero defaults
- `PUT /api/branding` - Upsert branding with color/footer validation
- `DELETE /api/branding?client_id={id}` - Delete branding record
- `POST /api/branding/:clientId/logo` - Upload logo (multipart)
- `DELETE /api/branding/:clientId/logo` - Delete logo file

### 4. Branding API Proxy (apps/web)
- `GET/PUT/DELETE /api/clients/:clientId/branding`
- `POST/DELETE /api/clients/:clientId/branding/logo`
- Multipart form data forwarding for logo upload

### 5. Docker Configuration
- Added `branding_data` named volume
- Mounted to open-seo-worker at `/data/branding`
- Added `BRANDING_DIR` environment variable

## Validation Implemented

1. **Hex color format** - `/^#[0-9A-Fa-f]{6}$/`
2. **Footer text** - Max 500 chars, scripts/event handlers stripped
3. **Logo file type** - PNG, JPG, SVG only
4. **Logo file size** - Max 2MB
5. **UUID format** - Validated on all clientId params

## Threat Mitigations

| Threat ID | Mitigation |
|-----------|------------|
| T-16-12 | Client ownership validated via Clerk JWT auth |
| T-16-13 | MIME type validation for logo uploads |
| T-16-14 | Footer HTML sanitized, scripts stripped |
| T-16-15 | API scoped to authenticated client only |
| T-16-16 | 2MB file size limit enforced early |
| T-16-17 | One logo per client (replaces old on upload) |
| T-16-18 | ClientId sanitization prevents path traversal |

## Commits

| Repo | Hash | Message |
|------|------|---------|
| open-seo-main | b35480e | feat(16-03): add client_branding Drizzle schema |
| open-seo-main | a83985b | feat(16-03): add branding file storage utilities |
| TeveroSEO | 536cd9b2 | chore(16-03): add branding_data volume to docker-compose |
| open-seo-main | ac62041 | feat(16-03): add branding API endpoints |
| TeveroSEO | f752965a | feat(16-03): add branding API proxy routes in apps/web |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] All 25 tests pass (12 schema + 13 storage)
- [x] TypeScript compiles for open-seo-main
- [x] TypeScript compiles for apps/web
- [x] Docker compose validates successfully
- [x] Branding schema exports correct types
- [x] Storage utilities handle all file operations
- [x] API validates colors and sanitizes footer HTML

## Known Stubs

None - all functionality is fully implemented.

## Self-Check: PASSED

Verified:
- [x] `branding-schema.ts` exists and exports clientBranding, types
- [x] `storage.ts` exists and exports saveBrandingLogo, deleteBrandingLogo, getBrandingLogoPath
- [x] `branding/index.ts` exists with GET/PUT/DELETE handlers
- [x] `branding/$clientId.logo.ts` exists with POST/DELETE handlers
- [x] `apps/web/.../branding/route.ts` exists
- [x] `apps/web/.../branding/logo/route.ts` exists
- [x] All commits present in git log
- [x] docker-compose.vps.yml includes branding_data volume
