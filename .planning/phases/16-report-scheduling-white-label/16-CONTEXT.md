# Phase 16: Report Scheduling & White-Label - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Schedule weekly/monthly reports via BullMQ. Email delivery via existing email service. White-label branding (logo, colors, footer) configurable per client.

</domain>

<decisions>
## Implementation Decisions

### Report Scheduling
- BullMQ repeatable jobs for scheduled report generation
- Cron expressions stored in `report_schedules` table
- Scheduler worker checks and enqueues report jobs at configured times
- Default schedules: weekly (Mondays 6am) and monthly (1st of month)
- Timezone-aware scheduling (stored per client)

### Email Delivery
- Use existing email service from AI-Writer backend
- Template for report delivery email (subject, body, attachment)
- Recipients configurable per schedule (multiple emails supported)
- PDF attached directly to email (< 10MB limit)
- Fallback to download link for large reports

### White-Label Branding
- `client_branding` table: logo_url, primary_color, secondary_color, footer_text
- Logo stored in /data/branding/{client_id}/logo.{ext} (PNG/JPG/SVG supported)
- Max logo size: 2MB, recommended dimensions: 200x60px
- Colors stored as hex values (e.g., #1a73e8)
- Footer text: configurable HTML for report footer
- Fallback to Tevero default branding when not configured

### Branding in Reports
- ReportHeader component accepts branding prop
- ReportFooter component accepts branding prop
- CSS custom properties injected for color theming
- Print stylesheet uses branding colors

### UI/UX
- `/clients/[id]/settings/reports` - Schedule configuration
- `/clients/[id]/settings/branding` - Branding configuration
- Logo upload with preview
- Color picker for primary/secondary colors
- Live preview of branded report header

### Claude's Discretion
- Specific cron expression validation library
- Email template styling details
- Logo resize/optimization approach
- Color contrast validation

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Report generation from Phase 15 (reportQueue, report-worker)
- Email service in AI-Writer backend
- File upload patterns from existing features
- shadcn/ui ColorPicker, FileUpload components

### Established Patterns
- BullMQ repeatable jobs for scheduling
- Server actions for form submissions
- Drizzle schema patterns from Phase 15
- API routes with Clerk auth

### Integration Points
- Route: `/clients/[clientId]/settings/reports` — schedule config
- Route: `/clients/[clientId]/settings/branding` — branding config
- BullMQ queue: `report-scheduler` (new queue)
- Storage: `/data/branding/` volume for logos

</code_context>

<specifics>
## Specific Ideas

### Schedule Schema
```typescript
interface ReportSchedule {
  id: string;
  clientId: string;
  cronExpression: string; // e.g., "0 6 * * 1" (Mondays 6am)
  timezone: string; // e.g., "Europe/Vilnius"
  reportType: string; // "monthly-seo"
  locale: string;
  recipients: string[]; // email addresses
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
}
```

### Branding Schema
```typescript
interface ClientBranding {
  clientId: string;
  logoUrl?: string;
  primaryColor: string; // hex
  secondaryColor: string; // hex
  footerText?: string; // HTML
  updatedAt: Date;
}
```

</specifics>

<deferred>
## Deferred Ideas

### Advanced Scheduling (Future)
- Custom report templates per schedule
- Multiple schedules per client
- Conditional scheduling (skip if no data changes)

### Advanced Branding (Future)
- Custom fonts
- Custom report layouts
- Full CSS override capability

</deferred>
