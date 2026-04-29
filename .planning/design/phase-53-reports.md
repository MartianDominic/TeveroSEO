# Phase 53: Reports System

> **Estimated Hours:** 44-52
> **Dependencies:** Phase 44 (components), Phase 45 (data), Phase 48 (client data)
> **Source of Truth:** [v7-master-design-architecture.md](./v7-master-design-architecture.md)

## Compliance Requirements

**MUST follow these documents:**
- [design-system-v6.md](./design-system-v6.md) — All UI uses v6 tokens
- [v7-master-design-architecture.md](./v7-master-design-architecture.md) — Journey 9.1, 9.2, 9.3

---

## Executive Summary

Reports is the **only domain with 0% journey coverage** (per journey-coverage-audit.md). This phase implements the full reporting workflow: generate on-demand reports, build custom templates, and schedule recurring delivery.

**Existing Infrastructure:**
- `reports` table in `open-seo-main/src/db/report-schema.ts` (stores generated report metadata)
- `report_schedules` table in `open-seo-main/src/db/schedule-schema.ts` (stores schedule configs)
- BullMQ queue + worker for PDF generation (`reportQueue.ts`, `report-processor.ts`)
- React components in `apps/web/src/components/reports/` (ReportTemplate, charts, header/footer)
- PDF generation via Puppeteer (`pdf-generator.ts`)

**Gaps to Fill:**
- No `report_templates` table for custom template storage
- No UI for template building (section picker)
- No v6 migration of report components
- No scheduled reports management UI
- Reports page has no v6 journey flow

---

## Journeys Covered

### Journey 9.1: Generate Report

**User Story:** As an agency user, I want to generate a PDF report for a client so that I can share performance data with stakeholders.

**Flow:**
```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Client Hub     │      │  Reports Page   │      │  Generation     │      │  Download/Send  │
│  (sidebar)      │ ──► │  (empty/list)   │ ──► │  Modal          │ ──► │  Complete       │
│  Click Reports  │      │  [Generate]     │      │  Progress bar   │      │  [Download PDF] │
└─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
```

**Detailed Steps:**

1. **Trigger:** User clicks "Reports" in sidebar under client
2. **Reports List:** Shows existing reports with status badges (complete/pending/failed)
3. **Generate CTA:** Primary button opens ReportGenerationModal
4. **Configuration:**
   - Select report type (Monthly SEO, Weekly Summary)
   - Select date range (preset or custom)
   - Select template (default or custom)
   - Toggle email delivery
5. **Generation:**
   - Modal shows progress stepper: Data Fetch → Render → PDF → Done
   - Job queued to BullMQ
   - Status updates via polling or WebSocket
6. **Completion:**
   - Download PDF button appears
   - Optional: Send to recipients immediately
   - Report added to list with "Complete" badge

**UI States:**
- Empty state: "No reports yet" with CTA to generate first
- List state: Grid/table of reports with status, date, type, actions
- Generating state: Progress overlay on card or modal
- Error state: Failed badge with "Retry" action

---

### Journey 9.2: Custom Report Builder

**User Story:** As an agency user, I want to customize which sections appear in my reports so that I can show clients only relevant data.

**Flow:**
```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Reports Page   │      │  Template       │      │  Template       │
│  [Templates]    │ ──► │  Builder Modal  │ ──► │  Saved          │
│                 │      │  Drag sections  │      │  Ready to use   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

**Detailed Steps:**

1. **Trigger:** User clicks "Templates" tab or "Customize" on report
2. **Template List:** Shows default + custom templates with preview thumbnails
3. **Builder Modal:**
   - Left panel: Available sections (draggable)
   - Center panel: Template preview (live render)
   - Right panel: Section config (per-section options)
4. **Available Sections:**
   - Header (always first)
   - Summary Stats (KPIs)
   - GSC Chart (clicks/impressions over time)
   - GA4 Chart (sessions/users over time)
   - Top Queries Table
   - Audit Summary (new)
   - Keyword Rankings (new)
   - Article Performance (new)
   - Footer (always last)
5. **Save Template:**
   - Name template
   - Set as default for client (optional)
   - Template stored in `report_templates` table

**Section Configuration Options:**
| Section | Config Options |
|---------|----------------|
| Summary Stats | Show/hide individual KPIs |
| GSC Chart | Period comparison (show previous period) |
| Top Queries | Row limit (10/20/50) |
| Audit Summary | Tier filter (show only Tier 1-2) |
| Keyword Rankings | Position range filter |

---

### Journey 9.3: Scheduled Reports

**User Story:** As an agency user, I want to set up recurring reports so that clients receive updates automatically without manual work.

**Flow:**
```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Reports Page   │      │  Schedule Modal │      │  Schedule       │      │  Auto-delivery  │
│  [Schedule]     │ ──► │  Configure      │ ──► │  Active         │ ──► │  Email sent     │
│                 │      │  Recipients     │      │  (cron job)     │      │  (Loops)        │
└─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
```

**Detailed Steps:**

1. **Trigger:** User clicks "Schedule" button or accesses schedules tab
2. **Existing Schedule:** Shows current schedule if exists, with enable/disable toggle
3. **Schedule Modal:**
   - Frequency: Weekly (Monday) / Monthly (1st) / Custom (cron)
   - Time: Select time in client timezone
   - Report Type: Monthly SEO / Weekly Summary
   - Template: Select from saved templates
   - Recipients: Add email addresses (autocomplete from client contacts)
4. **Save Schedule:**
   - Creates/updates `report_schedules` row
   - Calculates `nextRun` timestamp
   - Activates cron worker polling
5. **Automatic Delivery:**
   - Worker checks `nextRun <= now()` every 5 minutes
   - Generates report using selected template
   - Sends via Loops transactional email
   - Updates `lastRun` and calculates next `nextRun`

**Schedule Management:**
- View all schedules across clients in agency settings
- Pause/resume individual schedules
- View delivery history (last 5 runs with status)

---

## Data Model

### Tables

#### report_templates (NEW)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| agency_id | uuid | FK to organizations (nullable = Tevero default) |
| client_id | uuid | FK to clients (nullable = agency-wide template) |
| name | varchar(255) | Template name (e.g., "Monthly Executive Summary") |
| sections | jsonb | Ordered array of section configs (see schema below) |
| is_default | boolean | Default template for new reports |
| report_type | text | "monthly-seo" / "weekly-summary" / "custom" |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last modified timestamp |
| created_by | uuid | FK to users who created template |

**Sections JSONB Schema:**
```typescript
interface TemplateSections {
  sections: Array<{
    type: ReportSectionType;
    order: number;
    enabled: boolean;
    config?: {
      // Section-specific config
      showPreviousPeriod?: boolean;    // GSC/GA4 charts
      rowLimit?: number;                // Tables
      tierFilter?: number[];            // Audit summary
      positionRange?: [number, number]; // Keywords
    };
  }>;
}
```

**Drizzle Schema:**
```typescript
// open-seo-main/src/db/template-schema.ts

export const reportTemplates = pgTable(
  "report_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sections: jsonb("sections").$type<TemplateSections>().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    reportType: text("report_type").notNull().default("monthly-seo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    index("ix_templates_agency_id").on(table.agencyId),
    index("ix_templates_client_id").on(table.clientId),
    // Only one default per client/type combination
    uniqueIndex("uq_templates_default").on(table.clientId, table.reportType)
      .where(sql`${table.isDefault} = true`),
  ],
);

export type ReportTemplateSelect = typeof reportTemplates.$inferSelect;
export type ReportTemplateInsert = typeof reportTemplates.$inferInsert;
```

#### report_schedules (EXISTS - minor updates)

Current schema in `schedule-schema.ts` is sufficient. Add one column:

| Column | Type | Description |
|--------|------|-------------|
| template_id | uuid | FK to report_templates (nullable = use default) |

**Migration:**
```sql
ALTER TABLE report_schedules 
ADD COLUMN template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL;
```

#### reports (EXISTS - no changes needed)

Current schema handles all metadata. No changes required.

---

## Services

### ReportGenerationService

**Location:** `open-seo-main/src/server/services/report/report-generation-service.ts`

```typescript
interface ReportGenerationService {
  /**
   * Generate a report for a client.
   * Creates report record, enqueues BullMQ job, returns report ID.
   */
  generateReport(params: {
    clientId: string;
    reportType: ReportType;
    dateRange: { start: string; end: string };
    templateId?: string;
    locale?: string;
    sendToRecipients?: string[];
  }): Promise<{ reportId: string; jobId: string }>;

  /**
   * Get report generation status.
   * Polls database for status updates.
   */
  getReportStatus(reportId: string): Promise<ReportStatus>;

  /**
   * Get PDF download URL (signed, expires in 1 hour).
   */
  getDownloadUrl(reportId: string): Promise<string>;

  /**
   * Retry a failed report generation.
   */
  retryReport(reportId: string): Promise<{ jobId: string }>;

  /**
   * Delete a report and its PDF file.
   */
  deleteReport(reportId: string): Promise<void>;
}
```

**Implementation Notes:**
- Uses existing `enqueueReportGeneration` from `reportQueue.ts`
- Extends processor to support custom templates
- Adds signed URL generation for secure downloads

### ReportTemplateService

**Location:** `open-seo-main/src/server/services/report/report-template-service.ts`

```typescript
interface ReportTemplateService {
  /**
   * List templates available for a client.
   * Returns: Tevero defaults + agency templates + client templates
   */
  listTemplates(params: {
    clientId: string;
    reportType?: ReportType;
  }): Promise<ReportTemplate[]>;

  /**
   * Get a specific template by ID.
   */
  getTemplate(templateId: string): Promise<ReportTemplate | null>;

  /**
   * Get the default template for a client/type combination.
   */
  getDefaultTemplate(params: {
    clientId: string;
    reportType: ReportType;
  }): Promise<ReportTemplate>;

  /**
   * Create a new custom template.
   */
  createTemplate(params: {
    clientId?: string;
    name: string;
    sections: TemplateSections;
    reportType: ReportType;
    isDefault?: boolean;
    createdBy: string;
  }): Promise<ReportTemplate>;

  /**
   * Update an existing template.
   */
  updateTemplate(
    templateId: string,
    params: Partial<{
      name: string;
      sections: TemplateSections;
      isDefault: boolean;
    }>
  ): Promise<ReportTemplate>;

  /**
   * Delete a custom template.
   * Cannot delete Tevero defaults.
   */
  deleteTemplate(templateId: string): Promise<void>;

  /**
   * Preview template render (returns HTML, not PDF).
   * Uses sample data for preview.
   */
  previewTemplate(params: {
    clientId: string;
    templateId: string;
    dateRange: { start: string; end: string };
  }): Promise<string>;
}
```

### ReportScheduleService

**Location:** `open-seo-main/src/server/services/report/report-schedule-service.ts`

```typescript
interface ReportScheduleService {
  /**
   * List all schedules for a client.
   */
  listSchedules(clientId: string): Promise<ReportSchedule[]>;

  /**
   * Get schedule details.
   */
  getSchedule(scheduleId: string): Promise<ReportSchedule | null>;

  /**
   * Create or update a schedule for a client/type.
   * Only one schedule per type per client allowed.
   */
  upsertSchedule(params: {
    clientId: string;
    reportType: ReportType;
    cronExpression: string;
    timezone: string;
    recipients: string[];
    templateId?: string;
    locale?: string;
  }): Promise<ReportSchedule>;

  /**
   * Enable or disable a schedule.
   */
  toggleSchedule(scheduleId: string, enabled: boolean): Promise<void>;

  /**
   * Delete a schedule.
   */
  deleteSchedule(scheduleId: string): Promise<void>;

  /**
   * Get delivery history for a schedule.
   * Returns last N generated reports with status.
   */
  getDeliveryHistory(scheduleId: string, limit?: number): Promise<Array<{
    reportId: string;
    generatedAt: string;
    status: ReportStatus;
    recipientCount: number;
  }>>;

  /**
   * Execute scheduled report (called by cron worker).
   * Generates report and sends to recipients.
   */
  executeSchedule(scheduleId: string): Promise<void>;
}
```

---

## API Routes

### Report Generation Routes

```
# List reports for a client
GET /api/clients/:clientId/reports
Query: ?type=monthly-seo&status=complete&limit=20&offset=0
Response: {
  reports: ReportMetadata[],
  total: number
}

# Get single report
GET /api/clients/:clientId/reports/:reportId
Response: ReportMetadata

# Generate new report
POST /api/clients/:clientId/reports
Body: {
  reportType: "monthly-seo" | "weekly-summary",
  dateRange: { start: "2026-04-01", end: "2026-04-30" },
  templateId?: string,
  sendToRecipients?: string[]
}
Response: { reportId: string, status: "pending" }

# Get report status (polling)
GET /api/clients/:clientId/reports/:reportId/status
Response: {
  status: "pending" | "generating" | "complete" | "failed",
  progress?: number,
  errorMessage?: string
}

# Download report PDF
GET /api/clients/:clientId/reports/:reportId/download
Response: PDF file (application/pdf)
Headers: Content-Disposition: attachment; filename="report.pdf"

# Retry failed report
POST /api/clients/:clientId/reports/:reportId/retry
Response: { status: "pending" }

# Delete report
DELETE /api/clients/:clientId/reports/:reportId
Response: 204 No Content
```

### Template Routes

```
# List templates for client
GET /api/clients/:clientId/report-templates
Query: ?type=monthly-seo
Response: { templates: ReportTemplate[] }

# Get single template
GET /api/report-templates/:templateId
Response: ReportTemplate

# Get default template
GET /api/clients/:clientId/report-templates/default
Query: ?type=monthly-seo
Response: ReportTemplate

# Create template
POST /api/clients/:clientId/report-templates
Body: {
  name: string,
  sections: TemplateSections,
  reportType: string,
  isDefault?: boolean
}
Response: ReportTemplate

# Update template
PATCH /api/report-templates/:templateId
Body: Partial<{ name, sections, isDefault }>
Response: ReportTemplate

# Delete template
DELETE /api/report-templates/:templateId
Response: 204 No Content

# Preview template (live render)
POST /api/clients/:clientId/report-templates/:templateId/preview
Body: { dateRange: { start, end } }
Response: { html: string }
```

### Schedule Routes

```
# List schedules for client
GET /api/clients/:clientId/report-schedules
Response: { schedules: ReportSchedule[] }

# Get schedule
GET /api/report-schedules/:scheduleId
Response: ReportSchedule

# Create/update schedule
PUT /api/clients/:clientId/report-schedules/:reportType
Body: {
  cronExpression: string,
  timezone: string,
  recipients: string[],
  templateId?: string,
  locale?: string
}
Response: ReportSchedule

# Toggle schedule
PATCH /api/report-schedules/:scheduleId
Body: { enabled: boolean }
Response: ReportSchedule

# Delete schedule
DELETE /api/report-schedules/:scheduleId
Response: 204 No Content

# Get delivery history
GET /api/report-schedules/:scheduleId/history
Query: ?limit=5
Response: { deliveries: DeliveryHistoryItem[] }

# Manual trigger (for testing)
POST /api/report-schedules/:scheduleId/trigger
Response: { reportId: string }
```

---

## UI Components

### ReportCard

**Purpose:** Display a single report in the reports list.

**v6 Compliance:**
- Shadow: `--shadow-card` at rest, `--shadow-lift` on hover
- Typography: `--font-display` for report title (Newsreader)
- Status badge: `--success-soft`/`--error-soft`/`--warning-soft` backgrounds
- Transform: `translateY(-1px)` on hover

**Structure:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 📄  Monthly SEO Report                              ✓ COMPLETE      │
│                                                                     │
│     Apr 1 - Apr 30, 2026                                           │
│     Generated 2h ago                                                │
│                                                                     │
│     [Download PDF]  [Send]  [⋯]                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface ReportCardProps {
  report: ReportMetadata;
  onDownload: () => void;
  onSend: () => void;
  onRetry?: () => void;
  onDelete: () => void;
}
```

### ReportGenerationModal

**Purpose:** Configure and trigger report generation.

**v6 Compliance:**
- Modal: `--radius-modal` (14px), `--shadow-pop`
- Buttons: Primary uses `--shadow-cta` gradient
- Progress: Uses `--accent` fill with hatch pattern

**Structure:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Generate Report                                               [×]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Report Type                                                        │
│  ○ Monthly SEO Report                                              │
│  ○ Weekly Summary                                                  │
│                                                                     │
│  Date Range                                                         │
│  [Last 30 days ▼]  or  [Apr 1, 2026] to [Apr 30, 2026]            │
│                                                                     │
│  Template                                                           │
│  [Default Template ▼]   [Customize →]                              │
│                                                                     │
│  ☐ Send to recipients after generation                             │
│     [client@acme.com, marketing@acme.com]                          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                            [Cancel]  [Generate]     │
└─────────────────────────────────────────────────────────────────────┘
```

**Generating State:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Generating Report                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [███████████████░░░░░░░░░░]  62%                                  │
│                                                                     │
│  ✓ Fetching data                                                   │
│  ✓ Rendering charts                                                │
│  ◐ Generating PDF...                                               │
│  ○ Finalizing                                                      │
│                                                                     │
│  This may take 30-60 seconds                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### ReportSectionPicker

**Purpose:** Drag-and-drop section ordering for template builder.

**v6 Compliance:**
- Cards: Section items use `--shadow-card`
- Drag handles: `--text-3` color, hover to `--text-1`
- Active drag: `--accent-soft` background

**Structure:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ AVAILABLE SECTIONS          │  YOUR TEMPLATE                       │
├─────────────────────────────│─────────────────────────────────────│─
│                             │                                       │
│  ┌───────────────────────┐  │  ┌───────────────────────┐           │
│  │ ⋮⋮ Audit Summary     │  │  │ 1. Header        [✓] │           │
│  │    Site health + tier │  │  ├───────────────────────┤           │
│  └───────────────────────┘  │  │ 2. Summary Stats [✓] │           │
│                             │  ├───────────────────────┤           │
│  ┌───────────────────────┐  │  │ 3. GSC Chart     [✓] │           │
│  │ ⋮⋮ Keyword Rankings  │  │  ├───────────────────────┤           │
│  │    Position changes   │  │  │ 4. Top Queries   [✓] │           │
│  └───────────────────────┘  │  ├───────────────────────┤           │
│                             │  │ 5. Footer        [✓] │           │
│  ┌───────────────────────┐  │  └───────────────────────┘           │
│  │ ⋮⋮ Article Perf.     │  │                                       │
│  │    Content metrics    │  │  Drag sections to reorder            │
│  └───────────────────────┘  │                                       │
│                             │                                       │
└─────────────────────────────┴───────────────────────────────────────┘
```

**Props:**
```typescript
interface ReportSectionPickerProps {
  availableSections: SectionDefinition[];
  selectedSections: TemplateSection[];
  onSectionsChange: (sections: TemplateSection[]) => void;
}
```

### ReportTemplateBuilder

**Purpose:** Full template builder page/modal with live preview.

**Layout:**
- Left: Available sections (25%)
- Center: Selected sections (25%)
- Right: Live preview (50%)

**Features:**
- Drag-and-drop from available to selected
- Reorder within selected
- Section config panel on click
- Live preview updates on change

### ScheduleReportModal

**Purpose:** Configure recurring report delivery.

**Structure:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Schedule Reports                                              [×]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Frequency                                                          │
│  ○ Weekly (every Monday)                                           │
│  ● Monthly (1st of month)                                          │
│  ○ Custom...                                                       │
│                                                                     │
│  Time                                                               │
│  [09:00 ▼]  [Europe/Vilnius ▼]                                     │
│                                                                     │
│  Report Type                                                        │
│  [Monthly SEO Report ▼]                                            │
│                                                                     │
│  Template                                                           │
│  [Default Template ▼]                                              │
│                                                                     │
│  Recipients                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ client@acme.com  ×  │  marketing@acme.com  ×  │  + Add     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Next delivery: May 1, 2026 at 09:00 Europe/Vilnius                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [Delete Schedule]                       [Cancel]  [Save Schedule]  │
└─────────────────────────────────────────────────────────────────────┘
```

### ReportPreviewPane

**Purpose:** Live preview of report template (HTML, not PDF).

**v6 Compliance:**
- Container: `--surface-2` background
- Scale: 75% zoom to fit modal
- Loading: Skeleton while fetching

---

## Implementation Tasks

### Sprint 1: Data Layer & Core Services (16h)

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 1.1 | Create `report_templates` Drizzle schema + migration | 2 | — |
| 1.2 | Add `template_id` to `report_schedules` migration | 1 | — |
| 1.3 | Implement ReportTemplateService (CRUD) | 4 | 1.1 |
| 1.4 | Implement ReportGenerationService (wraps existing queue) | 3 | — |
| 1.5 | Implement ReportScheduleService | 3 | 1.2 |
| 1.6 | Add template support to report-processor.ts | 2 | 1.3 |
| 1.7 | Create default templates (seed data) | 1 | 1.1 |

### Sprint 2: API Layer (8h)

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 2.1 | Report generation API routes | 2 | 1.4 |
| 2.2 | Template CRUD API routes | 2 | 1.3 |
| 2.3 | Schedule CRUD API routes | 2 | 1.5 |
| 2.4 | Signed download URL generation | 1 | 2.1 |
| 2.5 | Input validation schemas (Zod) | 1 | 2.1-2.3 |

### Sprint 3: Reports Page UI (12h)

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 3.1 | ReportCard component (v6 tokens) | 2 | — |
| 3.2 | Reports list page with empty state | 3 | 3.1 |
| 3.3 | ReportGenerationModal (config + progress) | 3 | 2.1 |
| 3.4 | Report status polling hook | 1 | 2.1 |
| 3.5 | Download/send actions | 2 | 3.1 |
| 3.6 | Delete confirmation modal | 1 | 3.1 |

### Sprint 4: Template Builder UI (10h)

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 4.1 | ReportSectionPicker (drag-and-drop) | 3 | — |
| 4.2 | Section config panel | 2 | 4.1 |
| 4.3 | ReportPreviewPane (live preview) | 2 | 2.2 |
| 4.4 | ReportTemplateBuilder page/modal | 2 | 4.1-4.3 |
| 4.5 | Template save/load actions | 1 | 4.4, 2.2 |

### Sprint 5: Scheduled Reports UI (6h)

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 5.1 | ScheduleReportModal | 2 | — |
| 5.2 | Schedule list/management view | 2 | 5.1 |
| 5.3 | Delivery history display | 1 | 2.3 |
| 5.4 | Schedule enable/disable toggle | 1 | 5.2 |

### Sprint 6: Email Delivery & Polish (4h)

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 6.1 | Loops email template for scheduled reports | 1 | — |
| 6.2 | Recipient management (autocomplete from contacts) | 1 | — |
| 6.3 | Error handling + retry UI | 1 | 3.3 |
| 6.4 | E2E tests for report generation flow | 1 | All |

---

## Sprint Summary

| Sprint | Focus | Hours |
|--------|-------|-------|
| 1 | Data Layer & Core Services | 16h |
| 2 | API Layer | 8h |
| 3 | Reports Page UI | 12h |
| 4 | Template Builder UI | 10h |
| 5 | Scheduled Reports UI | 6h |
| 6 | Email Delivery & Polish | 4h |
| **Total** | | **56h** (estimate range: 44-52h with variance) |

---

## Success Criteria

- [ ] Can generate an on-demand report for any client
- [ ] Reports list shows all generated reports with status badges
- [ ] Can download PDF for any completed report
- [ ] Can retry failed report generation
- [ ] Can create custom templates with drag-and-drop section ordering
- [ ] Templates save and load correctly
- [ ] Live preview updates as sections are changed
- [ ] Can set up recurring weekly/monthly reports
- [ ] Scheduled reports auto-generate and email to recipients
- [ ] Schedule enable/disable works correctly
- [ ] All UI matches v6 design system (shadows, typography, colors)
- [ ] Empty states are editorial (Newsreader serif sentence)
- [ ] Error states provide clear recovery actions

---

## V2 Backlog (Not in V1)

- [ ] White-label PDF branding (logo, colors) from client_branding
- [ ] Comparison reports (this month vs last month)
- [ ] PDF export for specific sections only
- [ ] Shareable report links (public, expiring)
- [ ] Report comments/annotations
- [ ] Multi-client portfolio report (all clients in one PDF)
- [ ] Custom section types (markdown blocks)
- [ ] Report scheduling across all agency clients

---

## Open Questions for Review

1. **Template Ownership:** Should templates be owned at agency level (shared across clients) or client level (isolated)? Current design supports both via nullable `client_id`.

2. **Section Extensibility:** Are the 9 proposed section types sufficient for V1? Should we add "Custom Markdown" or "Image/Logo" sections?

3. **Cron Precision:** Current worker polls every 5 minutes. Is this granularity sufficient for scheduled reports?

4. **PDF Size Limits:** Large reports with many charts may exceed email attachment limits. Current fallback is download link in email. Is this acceptable UX?

5. **Preview Performance:** Live preview renders HTML on every section change. Should we debounce or add explicit "Refresh Preview" button?

---

*Created: 2026-04-30*
*Companion docs: v7-master-design-architecture.md, journey-coverage-audit.md, design-system-v6.md*
