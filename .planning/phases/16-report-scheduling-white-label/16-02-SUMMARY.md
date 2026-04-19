---
phase: 16-report-scheduling-white-label
plan: 02
subsystem: report-delivery
tags: [email, resend, pdf, reports]
dependency_graph:
  requires: [15-report-generation-engine]
  provides: [email-delivery-service, report-email-templates]
  affects: [report-processor]
tech_stack:
  added: [resend@6.12.0]
  patterns: [non-blocking-email, attachment-size-threshold]
key_files:
  created:
    - open-seo-main/src/server/lib/email.ts
    - open-seo-main/src/server/lib/email.test.ts
    - open-seo-main/src/server/lib/email-templates.ts
  modified:
    - open-seo-main/src/server/workers/report-processor.ts
    - open-seo-main/package.json
decisions:
  - "Resend API for email delivery (not Loops.so which is used for auth emails)"
  - "10MB attachment threshold with download link fallback"
  - "Non-blocking email: failures logged but don't fail report job"
  - "Email sent only when schedule exists with recipients configured"
metrics:
  duration_seconds: 307
  completed_at: "2026-04-19T16:24:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 2
---

# Phase 16 Plan 02: Email Delivery Integration Summary

Resend-based email service for automated report delivery with PDF attachment and download link fallback.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `85660c6` | Email service with Resend API (TDD) |
| 2 | `3c374d0` | Email templates for report delivery |
| 3 | `ff3445b` | Integration with report-processor |

## Key Deliverables

### 1. Email Service (`email.ts`)

```typescript
export async function sendReportEmail(params: ReportEmailParams): Promise<void>
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
```

Features:
- PDF attachment for files under 10MB
- Download link fallback for larger files
- Multiple recipients support via Resend batch API
- Structured logging with context
- Error handling with descriptive messages

### 2. Email Templates (`email-templates.ts`)

```typescript
export function reportDeliveryTemplate(data: ReportEmailData): ReportEmailTemplate
```

Features:
- Locale-aware date formatting via `Intl.DateTimeFormat`
- Mobile-responsive HTML layout
- Tevero branding (blue #3b82f6 accent)
- XSS protection via HTML escaping
- Two variants: attachment note vs download button

### 3. Report Processor Integration

Added Step 10 to `report-processor.ts`:
- Queries `reportSchedules` for recipients by clientId + reportType
- Calls `sendReportEmail` with generated PDF
- Non-blocking: email failures logged but don't fail the job
- Graceful degradation: skips if no schedule/recipients configured

## Architecture

```
Report Generation Job
         |
         v
    [Steps 1-9: Generate PDF]
         |
         v
    [Step 10: Send Email]
         |
         +-- Query reportSchedules for recipients
         |
         +-- Generate email template
         |
         +-- Check PDF size
         |        |
         |   <10MB: attach PDF
         |   >=10MB: include download link
         |
         +-- Send via Resend API
         |
         v
    [Complete - email failure doesn't block]
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | Yes | - | Resend API key |
| `EMAIL_FROM` | No | `reports@tevero.io` | Sender address |
| `APP_URL` | No | `https://app.tevero.io` | Base URL for download links |

## Test Coverage

7 tests in `email.test.ts`:
- PDF attachment when file < 10MB
- Download link (no attachment) when file >= 10MB
- Error when RESEND_API_KEY missing
- Error handling for Resend API failures
- Multiple recipients in single call
- Default FROM address fallback
- MAX_ATTACHMENT_SIZE constant export

## Deviations from Plan

None - plan executed exactly as written.

## Security Considerations

- **T-16-07 (Spoofing):** FROM address from env var, verified domain in Resend
- **T-16-08 (Tampering):** Template server-generated, no user input in HTML
- **T-16-09 (Info Disclosure):** Download URLs use report UUID, require auth at endpoint
- **T-16-11 (Privilege):** Recipients from DB schedule, not user-provided at send time

## Self-Check: PASSED

Verified:
- [x] `email.ts` exists and exports `sendReportEmail`, `MAX_ATTACHMENT_SIZE`
- [x] `email-templates.ts` exists and exports `reportDeliveryTemplate`
- [x] `report-processor.ts` includes email delivery step
- [x] All commits present in git log
- [x] TypeScript compiles without errors
- [x] All 7 tests pass
