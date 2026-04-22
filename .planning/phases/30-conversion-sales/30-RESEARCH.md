# Phase 30: Prospect Conversion & Sales Tools - Research

**Researched:** 2026-04-22
**Domain:** Prospect conversion workflows, PDF generation, keyword import
**Confidence:** HIGH

## Summary

Phase 30 is 75% complete. Research focused on remaining gaps 30-04 (keyword import on conversion) and 30-05 (analysis PDF export). 

**Critical finding:** Gap 30-04 is ALREADY IMPLEMENTED. The `importKeywordsFromAnalysis()` function exists in `onboarding.ts` and is called during `createProjectFromAnalysisWithTx()`. No additional work needed for 30-04.

Gap 30-05 (PDF export) requires creating a new renderer for prospect analysis reports following the existing `report-renderer.ts` pattern. All infrastructure exists - only the renderer and API endpoint need to be created.

**Primary recommendation:** Skip 30-04 (already complete), execute 30-05-PLAN.md as documented.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Existing Infrastructure (Locked)
- PDF generation via Puppeteer WebSocket endpoint (PUPPETEER_WS_ENDPOINT)
- 60 second timeout for PDF generation
- A4 format with 1cm margins
- RGB colors required for Puppeteer compatibility

### Integration Points (Locked)
1. Reuse `generatePDF()` from pdf-generator.ts
2. Create renderer following report-renderer.ts pattern
3. API route for PDF download
4. Button on prospect detail page
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Keyword import on conversion | API / Backend | Database | Business logic during onboarding transaction |
| PDF HTML rendering | API / Backend | - | Server-side HTML generation for Puppeteer |
| PDF generation | API / Backend | External Service | Puppeteer container via WebSocket |
| PDF download | API / Backend | - | Binary file response |
| Export button UI | Frontend (Next.js) | - | User interaction trigger |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| puppeteer | (container) | PDF generation | Already deployed via PUPPETEER_WS_ENDPOINT |
| drizzle-orm | ^0.44.4 | Database operations | Project standard ORM |
| @tanstack/react-router | 1.x | API routes | Project routing framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | latest | ID generation | All new record creation |

**Installation:** No new packages required - all infrastructure exists.

## Gap Analysis

### 30-04: Import Opportunity Keywords on Conversion

**STATUS: ALREADY IMPLEMENTED** [VERIFIED: codebase]

The keyword import functionality already exists in:
- **File:** `open-seo-main/src/server/features/proposals/onboarding/onboarding.ts`
- **Function:** `importKeywordsFromAnalysis()` (lines 311-339)
- **Called from:** `createProjectFromAnalysisWithTx()` (lines 369-376)

Implementation details:
```typescript
// From onboarding.ts lines 311-339
async function importKeywordsFromAnalysis(
  tx: TxContext,
  projectId: string,
  keywords: OpportunityKeyword[]
): Promise<number> {
  if (!keywords || keywords.length === 0) {
    return 0;
  }

  const now = new Date();
  const keywordValues = keywords.map((kw) => ({
    id: nanoid(),
    projectId,
    keyword: kw.keyword,
    locationCode: 2840, // Default US
    languageCode: "en",
    trackingEnabled: true,
    dropAlertThreshold: 5,
    createdAt: now,
  }));

  await tx
    .insert(savedKeywords)
    .values(keywordValues)
    .onConflictDoNothing();

  return keywordValues.length;
}
```

The function is called during onboarding when a project is created:
```typescript
// From onboarding.ts lines 369-376
if (analysis?.opportunityKeywords && analysis.opportunityKeywords.length > 0) {
  importedKeywordsCount = await importKeywordsFromAnalysis(
    tx,
    project.id,
    analysis.opportunityKeywords
  );
}
```

**Conclusion:** No work required for 30-04. Mark as complete.

### 30-05: Analysis PDF Export

**STATUS: PENDING** [VERIFIED: codebase]

Existing plan at `30-05-PLAN.md` is accurate and ready for execution.

#### What Exists

1. **PDF Generator** (`open-seo-main/src/server/services/report/pdf-generator.ts`)
   - `generatePDF(html: string, options?: PDFOptions): Promise<Buffer>`
   - Connects to Puppeteer container via WebSocket
   - 60 second timeout
   - A4 format, 1cm margins, printBackground enabled

2. **Report Renderer Pattern** (`open-seo-main/src/server/services/report/report-renderer.ts`)
   - Static HTML generation (no React/client components)
   - RGB colors for Puppeteer compatibility
   - Locale-aware number/date formatting
   - White-label branding support
   - `escapeHtml()` for XSS prevention

3. **Prospect Analysis Data** (`open-seo-main/src/db/prospect-schema.ts`)
   - `domainMetrics`: domainRank, organicTraffic, organicKeywords, backlinks, referringDomains
   - `organicKeywords[]`: keyword, position, searchVolume, cpc, url
   - `keywordGaps[]`: keyword, competitorDomain, position, volume, cpc, difficulty, achievability
   - `opportunityKeywords[]`: keyword, category, searchVolume, cpc, difficulty, opportunityScore, classification
   - `scrapedContent.businessInfo`: products, brands, services, location, targetMarket, summary

4. **Download Route Pattern** (`open-seo-main/src/routes/api/reports/$id.download.ts`)
   - TanStack Router file-based routing
   - Auth via `requireApiAuth(request)`
   - PDF returned with `Content-Disposition: attachment`

5. **Frontend Actions** (`apps/web/src/app/(shell)/prospects/actions.ts`)
   - Server fetch helpers: `getOpenSeo`, `postOpenSeo`
   - Path revalidation pattern

#### What's Missing

1. **Prospect Report Renderer** (new file)
   - `open-seo-main/src/server/services/prospect-report/prospect-report-renderer.ts`
   - Renders analysis data to HTML following report-renderer.ts pattern

2. **PDF Download API** (new file)
   - `open-seo-main/src/routes/api/prospects/$id.report.ts`
   - GET endpoint returning PDF binary

3. **UI Export Button**
   - Add to `apps/web/src/app/(shell)/prospects/[prospectId]/page.tsx`
   - Server action in `actions.ts`

## Architecture Patterns

### PDF Generation Flow

```
[User clicks "Export PDF"]
       |
       v
[apps/web: Server Action]
       |
       v (POST /api/prospects/:id/report)
       |
       v
[open-seo API: Fetch prospect + analysis]
       |
       v
[prospect-report-renderer: Generate HTML]
       |
       v
[pdf-generator: generatePDF(html)]
       |
       v (WebSocket)
       |
       v
[Puppeteer Container: Render PDF]
       |
       v
[Return PDF buffer with Content-Disposition]
```

### Pattern 1: Server-Side HTML Renderer

**What:** Generate static HTML documents for PDF rendering
**When to use:** Any PDF generation requiring complex layouts

```typescript
// Source: open-seo-main/src/server/services/report/report-renderer.ts
const COLORS = {
  primary: "rgb(59, 130, 246)",
  text: "rgb(17, 24, 39)",
  textMuted: "rgb(107, 114, 128)",
  border: "rgb(229, 231, 235)",
  // ...
};

export function renderReportToHTML(
  data: ReportRenderData,
  labels: ReportLabels,
): string {
  return `<!DOCTYPE html>
<html lang="${data.metadata.locale}">
<head>
  <meta charset="UTF-8">
  <title>${labels.title}</title>
  <style>${getStyles()}</style>
</head>
<body>
  ${renderHeader(data, labels)}
  ${renderStats(data, labels)}
  ${renderFooter(data, labels)}
</body>
</html>`;
}
```

### Pattern 2: PDF Download API Route

**What:** TanStack Router API endpoint returning binary PDF
**When to use:** Any downloadable file response

```typescript
// Source: open-seo-main/src/routes/api/reports/$id.download.ts
export const Route = createFileRoute("/api/reports/$id/download" as any)({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        await requireApiAuth(request);
        
        // ... fetch data, generate PDF ...
        
        return new Response(new Uint8Array(pdfBuffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": String(pdfBuffer.length),
          },
        });
      },
    },
  },
});
```

### Anti-Patterns to Avoid

- **Client-side PDF generation:** The existing `apps/web/src/lib/export/pdf.ts` uses browser print-to-PDF which is not suitable for server-generated reports
- **CSS variables in PDF HTML:** Puppeteer doesn't reliably render CSS variables; use RGB colors directly
- **React components in renderer:** SSR of React components with Recharts/client directives fails; use plain string templates

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom PDF library | Existing generatePDF() | Already integrated with Puppeteer container |
| HTML escaping | Manual string replace | escapeHtml() from report-renderer | Prevents XSS |
| Number formatting | Manual formatting | Intl.NumberFormat | Locale-aware, handles edge cases |

## Common Pitfalls

### Pitfall 1: Hex Colors in PDF HTML
**What goes wrong:** PDF renders with incorrect or missing colors
**Why it happens:** Puppeteer PDF renderer has inconsistent hex color support
**How to avoid:** Use `rgb(r, g, b)` format exclusively
**Warning signs:** Colors look different in PDF vs browser preview

### Pitfall 2: Missing PUPPETEER_WS_ENDPOINT
**What goes wrong:** PDF generation throws "PUPPETEER_WS_ENDPOINT not configured"
**Why it happens:** Environment variable not set in deployment
**How to avoid:** Check env var at startup, provide clear error message
**Warning signs:** PDF works locally but fails in production

### Pitfall 3: Large Analysis Data Timeout
**What goes wrong:** PDF generation times out after 60 seconds
**Why it happens:** Rendering HTML with many keyword rows is slow
**How to avoid:** Limit data (e.g., top 20 keyword gaps)
**Warning signs:** PDFs for prospects with many keywords fail

## Code Examples

### Prospect Report Data Interface

```typescript
// Pattern for prospect-report-renderer.ts
export interface ProspectReportData {
  prospect: {
    domain: string;
    companyName: string | null;
  };
  analysis: {
    domainMetrics: DomainMetrics | null;
    keywordGaps: KeywordGap[] | null;
    opportunityKeywords: OpportunityKeyword[] | null;
    scrapedContent: ScrapedContent | null;
    completedAt: Date | null;
  };
  locale: string;
  generatedAt: string;
}

export interface ProspectReportLabels {
  title: string;
  domainMetricsTitle: string;
  keywordGapsTitle: string;
  opportunitiesTitle: string;
  executiveSummary: string;
  // ...
}
```

### Export Button Pattern

```typescript
// apps/web server action pattern
export async function downloadAnalysisPDF(prospectId: string): Promise<Blob> {
  const response = await fetch(
    `${OPEN_SEO_URL}/api/prospects/${prospectId}/report`,
    { headers: await getAuthHeaders() }
  );
  
  if (!response.ok) {
    throw new Error("Failed to generate PDF");
  }
  
  return response.blob();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side PDF (print) | Server-side Puppeteer | Phase 15 | Professional quality, consistent output |
| React SSR for PDFs | Plain HTML templates | Phase 15 | Avoids hydration/client directive issues |

## Open Questions

1. **Localization scope**
   - What we know: Report labels support Lithuanian (existing pattern)
   - What's unclear: Should prospect PDFs be multi-language?
   - Recommendation: Start with English labels, extend later

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | open-seo-main/vitest.config.ts |
| Quick run command | `cd open-seo-main && pnpm test prospect-report-renderer` |
| Full suite command | `cd open-seo-main && pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROSP-25 | PDF contains domain metrics | unit | `pnpm test prospect-report-renderer` | Wave 0 |
| PROSP-25 | PDF shows keyword gaps | unit | `pnpm test prospect-report-renderer` | Wave 0 |
| PROSP-25 | PDF includes opportunities | unit | `pnpm test prospect-report-renderer` | Wave 0 |
| PROSP-25 | HTML escapes user content | unit | `pnpm test prospect-report-renderer` | Wave 0 |

### Wave 0 Gaps
- [ ] `open-seo-main/src/server/services/prospect-report/prospect-report-renderer.test.ts` - covers PROSP-25

## Sources

### Primary (HIGH confidence)
- Codebase audit of `open-seo-main/src/server/features/proposals/onboarding/onboarding.ts`
- Codebase audit of `open-seo-main/src/server/services/report/`
- Codebase audit of `open-seo-main/src/db/prospect-schema.ts`

### Secondary (MEDIUM confidence)
- Existing 30-05-PLAN.md review
- 30-CONTEXT.md constraints

## Metadata

**Confidence breakdown:**
- 30-04 status: HIGH - verified implementation exists in codebase
- 30-05 requirements: HIGH - verified existing patterns to follow
- PDF infrastructure: HIGH - verified working implementation

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable infrastructure)

## Action Summary

| Gap | Status | Action Required |
|-----|--------|-----------------|
| 30-04 | COMPLETE | None - keyword import already implemented in onboarding.ts |
| 30-05 | PENDING | Execute 30-05-PLAN.md as documented |
