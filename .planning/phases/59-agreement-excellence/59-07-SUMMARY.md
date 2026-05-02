---
phase: 59-agreement-excellence
plan: 07
subsystem: agreements
tags: [pdf, fonts, branding, api]
dependency_graph:
  requires:
    - open-seo-main agreements API (not yet implemented)
  provides:
    - PDF generation service with Inter fonts
    - PDF branding service for workspace customization
    - Agreement PDF download API endpoint
  affects:
    - apps/web public fonts directory
    - apps/web server services directory
    - apps/web API routes
tech_stack:
  added:
    - pdf-lib: ^1.17.1
    - "@pdf-lib/fontkit": ^1.1.1
    - "@fontsource/inter": ^5.2.8
  patterns:
    - Service singleton pattern
    - Next.js API route with authentication
    - PDF text wrapping and pagination
key_files:
  created:
    - apps/web/src/server/services/pdf-branding-service.ts
    - apps/web/src/server/services/pdf-generation-service.ts
    - apps/web/src/app/api/agreements/[agreementId]/pdf/route.ts
    - apps/web/public/fonts/Inter-Regular.ttf
    - apps/web/public/fonts/Inter-Bold.ttf
  modified:
    - apps/web/package.json
decisions:
  - D-26: Use pdf-lib for PDF generation (already in open-seo-main stack)
  - D-27: Embed Inter fonts (Regular, Bold) for professional typography
  - D-28: Include agency logo from workspace settings
  - D-29: Signature section shows signed/pending status with date and method
  - D-30: Page numbers in footer on all pages
metrics:
  duration: 8 minutes
  completed_date: 2026-05-02
  tasks_completed: 3
  tasks_total: 3
---

# Phase 59 Plan 07: PDF Generation with Custom Fonts Summary

PDF generation service using pdf-lib with fontkit for Inter fonts, workspace branding, and authenticated API endpoint.

## One-liner

PDF generation service with Inter custom fonts, workspace branding (logo/colors), signature status sections, and authenticated download API.

## Tasks Completed

| Task | Name | Status | Files |
|------|------|--------|-------|
| 1 | PDF Branding Service | Done | pdf-branding-service.ts |
| 2 | PDF Generation Service | Done | pdf-generation-service.ts, Inter fonts |
| 3 | PDF Download API Route | Done | route.ts |

## Implementation Details

### Task 1: PDF Branding Service

Created `PdfBrandingService` class with:
- `getBrandingConfig(workspaceId)` - Fetches workspace branding from open-seo-main API
- `hexToRgb(hex)` - Converts hex colors to 0-1 RGB values for pdf-lib
- `fetchLogoBytes(logoUrl)` - Fetches logo image as Uint8Array for embedding
- `getImageType(logoUrl)` - Detects PNG vs JPG for correct embedding method
- Default branding fallback when workspace not found

### Task 2: PDF Generation Service

Created `PdfGenerationService` class with:
- `generateAgreementPdf(agreementId, options)` - Main PDF generation method
- Custom Inter fonts (Regular, Bold) embedded via fontkit
- Helvetica fallback if custom fonts unavailable
- A4 page format (595.28 x 841.89 points)
- Workspace branding (logo, colors, company name)
- Variable resolution in clause content ({{variable.path}} syntax)
- HTML stripping for clean text rendering
- Text wrapping to fit page width
- Signature section with signed/pending status
- Localization support (en/lt) for date formats
- Page numbers in footer

### Task 3: PDF Download API Route

Created `GET /api/agreements/:agreementId/pdf` with:
- Authentication required via Clerk
- Query parameters: `?signatures=false`, `?locale=lt`
- Agreement existence verification via open-seo-main API
- Sanitized filename from agreement title
- Proper PDF headers (Content-Type, Content-Disposition)
- Cache-Control: no-store for sensitive documents
- Comprehensive error handling (401, 404, 500)

## Dependencies Added

```json
{
  "@fontsource/inter": "^5.2.8",
  "@pdf-lib/fontkit": "^1.1.1",
  "pdf-lib": "^1.17.1"
}
```

## Font Files

Downloaded Inter v4.0 fonts from rsms/inter GitHub release:
- `apps/web/public/fonts/Inter-Regular.ttf` (407 KB)
- `apps/web/public/fonts/Inter-Bold.ttf` (415 KB)

## API Usage

```typescript
// Download agreement PDF
GET /api/agreements/{agreementId}/pdf

// Without signatures
GET /api/agreements/{agreementId}/pdf?signatures=false

// Lithuanian locale
GET /api/agreements/{agreementId}/pdf?locale=lt
```

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Issues

**Build failure in unrelated file:**
- File: `apps/web/src/app/(shell)/clients/[clientId]/articles/[articleId]/page.tsx`
- Error: `Property 'backHref' does not exist on type 'unknown'`
- Impact: Full build fails, but new PDF code has no errors
- Resolution: Out of scope for Plan 59-07, requires separate fix

## Known Stubs

None - all functionality is fully implemented.

## Threat Flags

None - no new security surfaces beyond those documented in the plan's threat model.

## Dependencies Not Yet Available

The PDF generation service depends on open-seo-main APIs that are not yet implemented:
- `GET /api/agreements/:agreementId` - Agreement data with template and client
- `GET /api/agreements/:agreementId/signers` - Signer list with status
- `GET /api/organizations/:id` - Workspace data
- `GET /api/organizations/:id/branding` - Workspace branding config

These will be implemented in Plans 59-01 through 59-06. The PDF service includes graceful fallbacks when APIs return errors.

## Self-Check: PASSED

- [x] pdf-branding-service.ts exists and compiles
- [x] pdf-generation-service.ts exists and compiles  
- [x] route.ts exists and compiles
- [x] Inter-Regular.ttf exists (407 KB TrueType font)
- [x] Inter-Bold.ttf exists (415 KB TrueType font)
- [x] pdf-lib and fontkit installed in package.json
