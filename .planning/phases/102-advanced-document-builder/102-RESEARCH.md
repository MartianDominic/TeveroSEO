# Phase 102: Advanced Document Builder - Research

**Researched:** 2026-05-16
**Domain:** PDF manipulation, variable injection, drag-drop UI, serverless rendering
**Confidence:** HIGH

## Summary

Phase 102 implements a document generation system with three tracks: Template-First (pdf-lib variable injection at $0.001/doc), URL-to-PDF (Puppeteer capture at $0.003/doc), and AI-Enhanced (structure detection at $0.07 first, $0.002 reuse). The core value proposition is letting users keep existing PDF designs and make them data-driven, unlike competitors who force rebuilding.

The primary technical challenge is the click-to-place variable UI, which requires combining react-pdf for preview rendering with custom overlay positioning. PDF coordinate systems use bottom-left origin (unlike browser's top-left), requiring transformation. pdf-lib handles the actual PDF manipulation server-side, injecting text at stored coordinates.

**Primary recommendation:** Use pdf-lib 1.17.1 for server-side PDF manipulation (pure JavaScript, no native dependencies), react-pdf 10.4.1 for client-side preview/variable placement, and existing @aws-sdk/client-s3 pattern from L4Cache for R2 storage. Puppeteer for URL-to-PDF should run in a dedicated service with browser pooling due to resource constraints.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
1. **Block Data Architecture:** Extend EditorSection with `persuasionType` field
2. **A/B Testing Storage:** Separate `block_variants` table (normalized)
3. **Variant Assignment:** Deterministic hash assignment `Hash(prospect_id + block_id) % variant_count`
4. **Analytics Counters:** Real-time Redis counters + periodic Postgres sync (5-minute interval)
5. **AI Model Selection:** Gemini 3.1 Pro for all content generation ($1.25/1M tokens)
6. **Input Source Architecture:** 5 entry points feeding into unified editor
7. **Template Content Modes:** Three modes per block (Fixed, Variable, Regenerate)
8. **PDF Handling:** PDF as style reference only (not editable content)
9. **3-Layer Architecture:** Separate Structure, Content, and Context layers

### Claude's Discretion
- Implementation details for pdf-lib integration
- Click-to-place UI interaction patterns
- Storage bucket naming and lifecycle policies
- Error handling and retry strategies

### Deferred Ideas (OUT OF SCOPE)
- Real-time collaboration (co-editing, presence indicators)
- Multi-step approval workflows
- Scheduled sends
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-01 | Persuasion Block Types (8+) | EditorSection extension pattern + PersuasionBlockType union in CONTEXT.md |
| REQ-02 | Drag-Drop Block Reordering | Existing @dnd-kit patterns in SectionList.tsx |
| REQ-03 | Optional Framework Templates | Template system with Fixed/Variable/Regenerate modes |
| REQ-04 | Section Heatmaps | Redis counters + Postgres sync pattern |
| REQ-05 | Block to Close Correlation | Analytics pipeline with variant tracking |
| REQ-06 | A/B Testing UI | block_variants table + deterministic hash assignment |
| REQ-07 | AI Content Generation | Gemini 3.1 Pro integration pattern |
| REQ-08 | Side-by-Side Version Diff | Template versioning via document_template_versions table |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF preview/click-to-place UI | Browser/Client | -- | react-pdf renders canvas, user interactions captured client-side |
| Variable coordinate storage | API/Backend | Database | Coordinates stored in JSONB, validated server-side |
| PDF rendering with variables | API/Backend | -- | pdf-lib runs server-side (Node.js), no browser dependency |
| URL-to-PDF capture | Dedicated Service | API/Backend | Puppeteer requires isolated process due to memory constraints |
| Template/document storage | Database | R2/Storage | Metadata in Postgres, binary PDFs in R2 |
| Magic link validation | API/Backend | -- | Token lookup and expiration check |
| View tracking | API/Backend | Redis | Redis for high-frequency counters, Postgres for durability |
| A/B variant assignment | API/Backend | -- | Deterministic hash computed at render time |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | 1.17.1 | PDF manipulation | [VERIFIED: npm registry] Pure JS, no native deps, works in Node/browser/Deno/React Native |
| @pdf-lib/fontkit | 1.1.1 | Custom font embedding | [VERIFIED: npm registry] Required for non-standard fonts |
| react-pdf | 10.4.1 | PDF preview in React | [VERIFIED: npm registry] Most popular React PDF viewer, PDF.js wrapper |
| puppeteer | 25.0.2 | URL-to-PDF capture | [VERIFIED: npm registry] Official Chrome automation, best PDF rendering |
| pdfjs-dist | (bundled) | PDF.js worker | [CITED: react-pdf docs] Required worker for react-pdf |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/core | 6.3.1 | Drag-drop framework | [VERIFIED: apps/web/package.json] Already in codebase |
| @dnd-kit/sortable | 10.0.0 | Sortable lists | [VERIFIED: apps/web/package.json] Block reordering |
| @aws-sdk/client-s3 | 3.1045.0 | R2 storage | [VERIFIED: open-seo-main/package.json] Already in codebase |
| nanoid | (existing) | Token generation | [VERIFIED: seo-chat.ts] Already used for magic links |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdf-lib | pdfmake | pdfmake creates new PDFs only, cannot modify existing ones |
| react-pdf | @react-pdf/renderer | @react-pdf/renderer generates PDFs from React components, doesn't preview existing |
| puppeteer | playwright | Playwright has better API but larger bundle; Puppeteer has better serverless support |

**Installation:**
```bash
npm install pdf-lib @pdf-lib/fontkit react-pdf pdfjs-dist
# puppeteer-core for serverless (pair with @sparticuz/chromium)
npm install puppeteer-core @sparticuz/chromium
```

## Architecture Patterns

### System Architecture Diagram

```
                              ┌──────────────────────────────────────────┐
                              │           CLIENT (Browser)               │
                              ├──────────────────────────────────────────┤
                              │  VariableEditor Component                │
                              │  ├── react-pdf Document/Page             │
                              │  ├── Click overlay (absolute positioned) │
                              │  ├── Variable markers (scaled coords)    │
                              │  └── VariablePicker dropdown             │
                              └───────────────┬──────────────────────────┘
                                              │ Save variables
                                              │ (coordinates + variable keys)
                                              ▼
┌─────────────────┐    ┌──────────────────────────────────────────────────────────┐
│   R2 Storage    │◄───│                    API Layer (Next.js)                   │
│                 │    ├──────────────────────────────────────────────────────────┤
│ ├── templates/  │    │  /api/documents/templates      POST: Upload, save vars  │
│ │   {id}.pdf    │    │  /api/documents/templates/:id  PUT: Update variables    │
│ │               │    │  /api/documents/generate       POST: Render with values │
│ └── generated/  │    │  /api/p/:token                 GET: Public magic link   │
│     {id}.pdf    │    └───────────────┬──────────────────────────────────────────┘
└─────────────────┘                    │
                                       │ Template-First: pdf-lib inject
                                       │ URL-to-PDF: Puppeteer service call
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           Rendering Services                                      │
├─────────────────────────────────────┬────────────────────────────────────────────┤
│  pdf-lib Renderer (in-process)      │  Puppeteer Service (separate process)      │
│  ├── Load template from R2          │  ├── Browser pool (3 instances max)        │
│  ├── For each variable:             │  ├── Navigate to URL + query params        │
│  │   └── drawRectangle (white)      │  ├── Wait for selector                     │
│  │   └── drawText (injected value)  │  ├── page.pdf({format: 'A4'})              │
│  └── Return Uint8Array              │  └── Return buffer                         │
│                                     │                                            │
│  Cost: $0.001/doc                   │  Cost: $0.003/doc (compute-bound)          │
│  Latency: <200ms                    │  Latency: 2-5s                             │
└─────────────────────────────────────┴────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              PostgreSQL                                           │
├─────────────────────────────────────┬────────────────────────────────────────────┤
│  document_templates                 │  documents                                  │
│  ├── id, workspace_id, name         │  ├── id, template_id, prospect_id          │
│  ├── source_type, source_file_key   │  ├── file_key (R2 generated PDF)           │
│  ├── variables (JSONB)              │  ├── variable_values (JSONB snapshot)      │
│  └── thumbnail_url                  │  ├── magic_link_token (UNIQUE)             │
│                                     │  └── view_count, first_viewed_at           │
├─────────────────────────────────────┴────────────────────────────────────────────┤
│  document_template_versions         │  Redis (analytics counters)                │
│  ├── template_id, version_number    │  ├── doc:{id}:views → increment            │
│  ├── variables (JSONB snapshot)     │  └── Sync to Postgres every 5 min          │
│  └── change_summary                 │                                            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/web/src/
├── app/api/documents/
│   ├── templates/
│   │   ├── route.ts              # POST: create template, GET: list
│   │   ├── [id]/
│   │   │   ├── route.ts          # GET, PUT, DELETE template
│   │   │   └── variables/route.ts # PUT: update variables
│   │   └── upload/route.ts       # POST: multipart PDF upload
│   ├── generate/route.ts         # POST: render document
│   └── [id]/route.ts             # GET: document details
├── components/document-builder/
│   ├── VariableEditor.tsx        # PDF preview + click-to-place
│   ├── VariableMarker.tsx        # Positioned overlay marker
│   ├── VariablePicker.tsx        # Autocomplete dropdown
│   ├── TemplateLibrary.tsx       # Template grid view
│   └── PreviewPanel.tsx          # Live preview with sample data
├── lib/documents/
│   ├── pdf-renderer.ts           # pdf-lib wrapper
│   ├── variable-resolver.ts      # Resolve {{key}} to values
│   ├── coordinate-transform.ts   # PDF <-> screen coords
│   └── template-service.ts       # CRUD operations
└── db/schema/
    └── documents.ts              # Drizzle schema
```

### Pattern 1: PDF Coordinate Transformation
**What:** Convert between browser screen coordinates (top-left origin) and PDF coordinates (bottom-left origin).
**When to use:** Every click-to-place interaction.
**Example:**
```typescript
// Source: [ASSUMED] - Standard PDF coordinate transformation
interface PDFCoordinate {
  page: number;
  x: number;      // Points from left edge
  y: number;      // Points from BOTTOM edge (PDF convention)
  width: number;
  height: number;
}

interface ScreenCoordinate {
  x: number;      // Pixels from left
  y: number;      // Pixels from TOP (browser convention)
}

function screenToPdf(
  screen: ScreenCoordinate,
  pageHeight: number,
  scale: number
): { x: number; y: number } {
  // 1. Convert pixels to points (72 DPI standard for PDF)
  const pointsPerPixel = 72 / 96; // Assuming 96 DPI screen
  
  // 2. Account for scale factor from react-pdf zoom
  const x = (screen.x / scale) * pointsPerPixel;
  
  // 3. Flip Y axis (PDF Y=0 is at bottom, browser Y=0 is at top)
  const y = pageHeight - ((screen.y / scale) * pointsPerPixel);
  
  return { x, y };
}

function pdfToScreen(
  pdf: { x: number; y: number },
  pageHeight: number,
  scale: number
): ScreenCoordinate {
  const pixelsPerPoint = 96 / 72;
  return {
    x: pdf.x * pixelsPerPoint * scale,
    y: (pageHeight - pdf.y) * pixelsPerPoint * scale,
  };
}
```

### Pattern 2: pdf-lib Variable Injection
**What:** Inject text values into existing PDF at stored coordinates.
**When to use:** Document generation (Template-First track).
**Example:**
```typescript
// Source: [CITED: https://github.com/hopding/pdf-lib/blob/master/README.md]
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface TemplateVariable {
  key: string;
  position: { page: number; x: number; y: number; width: number; height: number };
  style?: { fontSize?: number; fontFamily?: string; color?: string };
}

export async function renderDocument(
  templateBytes: Uint8Array,
  variables: TemplateVariable[],
  values: Record<string, unknown>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  
  // Embed standard fonts (custom fonts require @pdf-lib/fontkit)
  const fonts = {
    helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    helveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
  
  for (const variable of variables) {
    const page = pdfDoc.getPages()[variable.position.page - 1];
    if (!page) continue;
    
    const value = resolveValue(variable.key, values);
    const fontSize = variable.style?.fontSize ?? 12;
    const font = fonts.helvetica;
    
    // Clear existing content with white rectangle
    page.drawRectangle({
      x: variable.position.x,
      y: variable.position.y,
      width: variable.position.width,
      height: variable.position.height,
      color: rgb(1, 1, 1),
    });
    
    // Draw new text
    page.drawText(String(value), {
      x: variable.position.x,
      y: variable.position.y + 4, // Baseline offset
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }
  
  return pdfDoc.save();
}
```

### Pattern 3: react-pdf with Click Overlay
**What:** Render PDF preview with clickable overlay for variable placement.
**When to use:** Variable editor component.
**Example:**
```tsx
// Source: [CITED: https://blog.react-pdf-kit.dev/understanding-pdfjs-layers-and-how-to-use-them-in-reactjs/]
import { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker (CRITICAL - without this, UI freezes)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Variable {
  id: string;
  key: string;
  position: { page: number; x: number; y: number; width: number; height: number };
}

export function VariableEditor({
  pdfUrl,
  variables,
  onVariablePlace,
  scale = 1.5,
}: {
  pdfUrl: string;
  variables: Variable[];
  onVariablePlace: (position: { page: number; x: number; y: number }) => void;
  scale?: number;
}) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Transform to PDF coordinates
    const pdfCoords = screenToPdf({ x: screenX, y: screenY }, pageHeight, scale);
    onVariablePlace({ page: currentPage, ...pdfCoords });
  };
  
  return (
    <div className="relative">
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
      >
        <div
          ref={containerRef}
          className="relative cursor-crosshair"
          onClick={handleClick}
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            onLoadSuccess={(page) => setPageHeight(page.height)}
          />
          
          {/* Render variable markers */}
          {variables
            .filter((v) => v.position.page === currentPage)
            .map((variable) => {
              const screen = pdfToScreen(
                { x: variable.position.x, y: variable.position.y },
                pageHeight,
                scale
              );
              return (
                <div
                  key={variable.id}
                  className="absolute border-2 border-blue-500 bg-blue-100/50 rounded"
                  style={{
                    left: screen.x,
                    top: screen.y,
                    width: variable.position.width * scale * (96/72),
                    height: variable.position.height * scale * (96/72),
                  }}
                >
                  <span className="text-xs text-blue-700">
                    {`{{${variable.key}}}`}
                  </span>
                </div>
              );
            })}
        </div>
      </Document>
    </div>
  );
}
```

### Pattern 4: Puppeteer URL-to-PDF (Serverless)
**What:** Capture URL as PDF with variable injection via query params.
**When to use:** URL-to-PDF track.
**Example:**
```typescript
// Source: [CITED: https://oneuptime.com/blog/post/2026-02-17-how-to-build-a-serverless-pdf-generation-service-using-cloud-run-and-puppeteer/view]
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

interface UrlToPdfOptions {
  url: string;
  variables: Record<string, string>;
  viewport?: { width: number; height: number };
  waitFor?: string;
}

export async function captureUrlAsPdf(options: UrlToPdfOptions): Promise<Uint8Array> {
  // Use @sparticuz/chromium for serverless environments
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  
  try {
    const page = await browser.newPage();
    
    await page.setViewport({
      width: options.viewport?.width ?? 1920,
      height: options.viewport?.height ?? 1080,
    });
    
    // Build URL with query params for variable injection
    const url = new URL(options.url);
    for (const [key, value] of Object.entries(options.variables)) {
      url.searchParams.set(key, value);
    }
    
    await page.goto(url.toString(), { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for specific selector if provided
    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: 10000 });
    }
    
    // Generate PDF in memory (no disk I/O)
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });
    
    return new Uint8Array(pdfBuffer);
  } finally {
    await browser.close();
  }
}
```

### Anti-Patterns to Avoid
- **Running Puppeteer in Next.js API routes:** Puppeteer is resource-intensive and can exhaust serverless function limits. Use a dedicated service or queue-based processing. [CITED: https://dev.to/iurii_rogulia/pdf-generation-on-the-server-puppeteer-vs-react-pdfrenderer-a-production-comparison-44cg]
- **Forgetting PDF.js worker configuration:** Without workers, text extraction and rendering freeze the UI. [CITED: https://blog.react-pdf-kit.dev/understanding-pdfjs-layers-and-how-to-use-them-in-reactjs/]
- **Not scaling overlay coordinates:** All overlay coordinates must be multiplied by the same scale factor, otherwise markers drift. [ASSUMED]
- **Using full puppeteer package in serverless:** Use puppeteer-core + @sparticuz/chromium to reduce bundle size under platform limits. [CITED: https://docupotion.com/blog/deploy-puppeteer-aws]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text injection | Custom PDF parser | pdf-lib | PDF format is complex (cross-references, streams, encryption); pdf-lib handles all edge cases |
| PDF preview rendering | Canvas-based PDF renderer | react-pdf + PDF.js | PDF.js is battle-tested, handles fonts/images/layers correctly |
| Headless browser | Chromium wrapper | puppeteer-core + @sparticuz/chromium | Browser automation is complex; serverless-optimized builds handle Lambda/Cloud Run constraints |
| Coordinate transformation | Manual math | Documented transform functions | PDF coordinate system (bottom-left, points) differs from browser (top-left, pixels); easy to get wrong |
| Magic link tokens | UUID + custom validation | nanoid + database lookup | 32-char nanoid is URL-safe and cryptographically secure; existing pattern in codebase |
| File upload to R2 | Custom S3 integration | Existing @aws-sdk/client-s3 pattern | L4Cache.ts already has working S3Client configuration for R2 |

**Key insight:** PDF manipulation libraries have years of edge case handling. PDF format includes cross-references, object streams, encryption, and font subsetting that are extremely error-prone to implement manually.

## Common Pitfalls

### Pitfall 1: PDF.js Worker Not Configured
**What goes wrong:** PDF preview renders blank or freezes browser tab.
**Why it happens:** react-pdf uses PDF.js which requires a web worker for parsing. Without explicit configuration, it fails silently.
**How to avoid:** Always configure worker in component or _app.tsx:
```typescript
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
```
**Warning signs:** Blank PDF preview, browser tab becomes unresponsive on large PDFs.

### Pitfall 2: Coordinate System Mismatch
**What goes wrong:** Variable markers appear in wrong positions, especially after zoom.
**Why it happens:** PDF uses bottom-left origin with points (72 DPI); browser uses top-left origin with pixels (96 DPI). Zoom/scale factor must be applied consistently.
**How to avoid:** Create dedicated transform functions and use them consistently. Test at multiple zoom levels.
**Warning signs:** Markers drift when zooming, markers appear inverted vertically.

### Pitfall 3: Puppeteer Memory Exhaustion in Serverless
**What goes wrong:** Function times out or crashes with OOM.
**Why it happens:** Each Puppeteer instance uses 100-200MB RAM. Serverless functions often have 256-512MB limits. Multiple concurrent requests exhaust memory.
**How to avoid:** 
- Use dedicated service with browser pooling (max 3 instances)
- Use @sparticuz/chromium-min for smaller footprint
- Allocate at least 1GB RAM per function
- Process via queue (BullMQ) rather than synchronous API
**Warning signs:** Random timeouts, intermittent 503 errors, high memory usage in logs.

### Pitfall 4: Font Rendering in pdf-lib
**What goes wrong:** Non-Latin characters (Lithuanian accents) render as squares or question marks.
**Why it happens:** PDF standard fonts (Helvetica, Times, Courier) don't support extended Latin. Custom fonts require fontkit registration.
**How to avoid:** 
- Register fontkit for custom fonts
- Embed Unicode-capable fonts (e.g., DejaVu, Noto Sans)
- Test with actual Lithuanian content
**Warning signs:** `a` with macron renders as `?`, Euro symbol missing.

### Pitfall 5: Magic Link Token Guessing
**What goes wrong:** Attackers enumerate document links and access sensitive proposals.
**Why it happens:** Short or predictable tokens can be brute-forced.
**How to avoid:**
- Use 32-character nanoid (existing pattern in codebase)
- Rate limit /api/p/ endpoint (already in rate-limit.ts)
- Optional password protection for high-value documents
- Track view attempts and alert on suspicious patterns
**Warning signs:** Many 404s on /api/p/ endpoints, sequential token attempts in logs.

## Code Examples

### Variable Resolution with Filters
```typescript
// Source: [ASSUMED] - Based on PRD variable system
type FilterFn = (value: unknown, ...args: string[]) => string;

const FILTERS: Record<string, FilterFn> = {
  truncate: (value, maxLength = '50') => {
    const str = String(value);
    const max = parseInt(maxLength, 10);
    return str.length > max ? str.slice(0, max - 3) + '...' : str;
  },
  
  uppercase: (value) => String(value).toUpperCase(),
  
  lowercase: (value) => String(value).toLowerCase(),
  
  currency: (value, currency = 'EUR') => {
    const locale = currency === 'EUR' ? 'lt-LT' : 'en-US';
    return new Intl.NumberFormat(locale, { 
      style: 'currency', 
      currency 
    }).format(Number(value));
  },
  
  date: (value, format = 'medium') => {
    const date = new Date(String(value));
    return date.toLocaleDateString('lt-LT', {
      dateStyle: format as 'short' | 'medium' | 'long',
    });
  },
};

export function resolveVariable(
  key: string,
  values: Record<string, unknown>
): string {
  // Parse key and filters: "price|currency:EUR|truncate:20"
  const [path, ...filterDefs] = key.split('|');
  
  // Resolve nested path: "prospect.company" -> values.prospect.company
  let value: unknown = values;
  for (const part of path.split('.')) {
    if (value === null || value === undefined) return '';
    value = (value as Record<string, unknown>)[part];
  }
  
  // Apply filters in order
  let result = String(value ?? '');
  for (const filterDef of filterDefs) {
    const [name, ...args] = filterDef.split(':');
    const filter = FILTERS[name];
    if (filter) {
      result = filter(result, ...args);
    }
  }
  
  return result;
}
```

### R2 Storage Integration
```typescript
// Source: [VERIFIED: open-seo-main/src/server/features/scraping/cache/L4Cache.ts pattern]
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function uploadTemplate(
  id: string,
  pdfBytes: Uint8Array
): Promise<string> {
  const key = `templates/${id}.pdf`;
  
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: pdfBytes,
    ContentType: 'application/pdf',
  }));
  
  return key;
}

export async function getTemplate(key: string): Promise<Uint8Array | null> {
  try {
    const response = await r2Client.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  } catch (error) {
    if ((error as Error).name === 'NoSuchKey') return null;
    throw error;
  }
}
```

### Deterministic A/B Variant Assignment
```typescript
// Source: [VERIFIED: 102-CONTEXT.md locked decision]
import { createHash } from 'crypto';

interface Variant {
  id: string;
  weight: number; // 0-100
}

export function getVariantIndex(
  prospectId: string,
  blockId: string,
  variants: Variant[]
): number {
  // Create deterministic hash
  const hash = createHash('sha256')
    .update(`${prospectId}:${blockId}`)
    .digest();
  
  // Convert first 4 bytes to number (0 to 2^32-1)
  const hashNum = hash.readUInt32BE(0);
  
  // Map to 0-99 range
  const bucket = hashNum % 100;
  
  // Find variant by cumulative weight
  let cumulative = 0;
  for (let i = 0; i < variants.length; i++) {
    cumulative += variants[i].weight;
    if (bucket < cumulative) {
      return i;
    }
  }
  
  // Fallback to last variant
  return variants.length - 1;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side PDF libs (PDFKit) | pdf-lib (pure JS, isomorphic) | 2020 | Can run in browser, serverless, no native deps |
| Full Puppeteer bundle | puppeteer-core + @sparticuz/chromium | 2023 | Serverless-friendly, <50MB bundle |
| Webpack PDF.js worker config | Native URL import for workers | react-pdf 10.x | Simpler configuration, better bundler support |
| AcroForm for variable injection | Direct text draw with coordinate storage | 2024 | More flexible, works with any PDF (not just forms) |

**Deprecated/outdated:**
- **pdfmake** for editing existing PDFs: pdfmake only creates new PDFs, cannot modify existing ones
- **jsPDF for form filling**: Security vulnerability disclosed Feb 2026 (GHSA-pqxr-3g65-p328) in AcroForm module [CITED: https://github.com/parallax/jsPDF/security/advisories/GHSA-pqxr-3g65-p328]
- **react-pdf v9 and below**: v10 introduced better worker handling and ESM support

## Integration Points

### Existing Codebase Integration

| Component | Location | Integration |
|-----------|----------|-------------|
| Magic link routing | `apps/web/src/app/p/[token]/page.tsx` | Add document check before SEO Chat fallback |
| Proposal service | `apps/web/src/lib/seo-chat/proposal.ts` | Attach documents to proposals |
| Variable extension | `apps/web/src/components/proposals/extensions/VariableExtension.ts` | Reuse variable resolution logic |
| dnd-kit patterns | `apps/web/src/components/proposals/SectionList.tsx` | Copy sortable context setup |
| S3/R2 client | `open-seo-main/src/server/features/scraping/cache/L4Cache.ts` | Reuse S3Client configuration |
| Rate limiting | `apps/web/src/lib/middleware/rate-limit.ts` | Apply to /api/documents endpoints |
| Drizzle schema | `apps/web/src/db/schema/seo-chat.ts` | Add document_templates, documents tables |

### Database Schema Addition
```typescript
// Add to apps/web/src/db/schema/documents.ts
import { pgTable, text, timestamp, jsonb, index, uniqueIndex, integer } from 'drizzle-orm/pg-core';

export const documentTemplates = pgTable('document_templates', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').default('uncategorized'),
  thumbnailUrl: text('thumbnail_url'),
  
  sourceType: text('source_type').notNull(), // 'pdf_upload' | 'url_capture' | 'ai_enhanced'
  sourceFileKey: text('source_file_key'),    // R2 key
  sourceUrl: text('source_url'),
  
  variables: jsonb('variables').$type<TemplateVariable[]>().default([]),
  
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete
}, (table) => [
  index('idx_document_templates_workspace').on(table.workspaceId),
  index('idx_document_templates_category').on(table.category),
]);

export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  templateId: text('template_id').notNull().references(() => documentTemplates.id),
  prospectId: text('prospect_id'),
  
  fileKey: text('file_key').notNull(), // R2 key for generated PDF
  variableValues: jsonb('variable_values').notNull(),
  
  magicLinkToken: text('magic_link_token').notNull().unique(),
  magicLinkExpiresAt: timestamp('magic_link_expires_at', { withTimezone: true }),
  passwordHash: text('password_hash'),
  
  firstViewedAt: timestamp('first_viewed_at', { withTimezone: true }),
  lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  viewCount: integer('view_count').default(0),
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
  viewAnalytics: jsonb('view_analytics').default({}),
  
  status: text('status').default('active'), // 'active' | 'expired' | 'revoked'
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_documents_prospect').on(table.prospectId),
  uniqueIndex('idx_documents_magic_link').on(table.magicLinkToken),
  index('idx_documents_workspace_created').on(table.workspaceId, table.createdAt),
]);
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 96 DPI is standard screen resolution for coordinate conversion | Architecture Patterns | Markers may be slightly offset on high-DPI displays |
| A2 | PDF standard is 72 DPI for points | Architecture Patterns | Coordinate math would be wrong (unlikely - this is PDF spec) |
| A3 | 3 concurrent Puppeteer instances is safe on 4-core system | Common Pitfalls | May need to reduce to 2, or increase memory allocation |
| A4 | DejaVu/Noto Sans fonts support Lithuanian characters | Common Pitfalls | May need to test specific fonts before recommending |

## Open Questions

1. **Font Strategy for Lithuanian**
   - What we know: pdf-lib supports custom font embedding via fontkit
   - What's unclear: Which specific font file to bundle for full Lithuanian support (a with macron, etc.)
   - Recommendation: Test with Noto Sans LT or DejaVu Sans; include in starter templates

2. **Puppeteer Service Architecture**
   - What we know: Can't run Puppeteer in Next.js API routes reliably
   - What's unclear: Should it be a separate BullMQ worker, Cloud Run service, or Cloudflare Browser Rendering?
   - Recommendation: Start with BullMQ worker in open-seo-main (already has queue infrastructure)

3. **Template Thumbnail Generation**
   - What we know: Users need visual preview of templates in library
   - What's unclear: Generate on upload (server cost) or on-demand (latency)?
   - Recommendation: Generate on upload using pdf-lib or Puppeteer; store in R2

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @aws-sdk/client-s3 | R2 storage | Yes | 3.1045.0 | -- |
| @dnd-kit/core | Block reordering | Yes | 6.3.1 | -- |
| @dnd-kit/sortable | Sortable lists | Yes | 10.0.0 | -- |
| TipTap | Rich text in blocks | Yes | 3.22.5 | -- |
| Redis | Analytics counters | Yes | (existing) | -- |
| BullMQ | Background jobs | Yes | (existing) | -- |
| PostgreSQL | Persistence | Yes | (existing) | -- |

**Missing dependencies (to install):**
- pdf-lib, @pdf-lib/fontkit (Template-First track)
- react-pdf, pdfjs-dist (Variable editor preview)
- puppeteer-core, @sparticuz/chromium (URL-to-PDF track)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + Testing Library |
| Config file | apps/web/vitest.config.ts |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-01 | Persuasion block types | unit | `npm run test -- --grep "persuasion"` | No - Wave 0 |
| REQ-02 | Drag-drop reordering | integration | `npm run test -- --grep "reorder"` | No - Wave 0 |
| REQ-03 | Framework templates | unit | `npm run test -- --grep "template"` | No - Wave 0 |
| REQ-04 | Section heatmaps | integration | `npm run test -- --grep "heatmap"` | No - Wave 0 |
| REQ-05 | Block correlation | integration | `npm run test -- --grep "correlation"` | No - Wave 0 |
| REQ-06 | A/B testing | unit | `npm run test -- --grep "variant"` | No - Wave 0 |
| REQ-07 | AI content generation | integration | `npm run test -- --grep "generate"` | No - Wave 0 |
| REQ-08 | Version diff | unit | `npm run test -- --grep "diff"` | No - Wave 0 |

### Wave 0 Gaps
- [ ] `apps/web/src/lib/documents/__tests__/pdf-renderer.test.ts` -- covers REQ-01, REQ-07
- [ ] `apps/web/src/lib/documents/__tests__/variable-resolver.test.ts` -- covers REQ-01
- [ ] `apps/web/src/lib/documents/__tests__/ab-testing.test.ts` -- covers REQ-05, REQ-06
- [ ] Install pdf-lib, react-pdf dev dependencies for testing

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | User already authenticated via Clerk |
| V3 Session Management | No | Existing session handling |
| V4 Access Control | Yes | Workspace-scoped document access |
| V5 Input Validation | Yes | Zod schema for variable values, file validation |
| V6 Cryptography | Yes | Magic link tokens (nanoid), optional password hashing |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Magic link enumeration | Information Disclosure | 32-char nanoid + rate limiting (existing) |
| PDF injection (malicious PDF upload) | Tampering | Validate PDF structure before storage |
| XSS via variable values | Tampering | Sanitize values before injection |
| IDOR (accessing other workspace docs) | Elevation of Privilege | Always filter by workspace_id |
| Resource exhaustion (large PDFs) | Denial of Service | 50-page, 25MB limit (per PRD) |

## Sources

### Primary (HIGH confidence)
- [pdf-lib GitHub README](https://github.com/hopding/pdf-lib/blob/master/README.md) - Font embedding, text drawing patterns
- [react-pdf GitHub](https://github.com/wojtekmaj/react-pdf) - Document/Page components, worker configuration
- [Puppeteer official docs](https://pptr.dev/) - page.pdf(), page.screenshot()
- [npm registry](https://www.npmjs.com/) - Version verification for all packages

### Secondary (MEDIUM confidence)
- [react-pdf-kit blog](https://blog.react-pdf-kit.dev/understanding-pdfjs-layers-and-how-to-use-them-in-reactjs/) - PDF.js layer architecture
- [OneUptime blog](https://oneuptime.com/blog/post/2026-02-17-how-to-build-a-serverless-pdf-generation-service-using-cloud-run-and-puppeteer/view) - Puppeteer serverless patterns
- [DocuPotion blog](https://docupotion.com/blog/deploy-puppeteer-aws) - Lambda Puppeteer deployment

### Tertiary (LOW confidence - needs validation)
- Coordinate transformation math (standard but not officially documented)
- 3 concurrent Puppeteer instances recommendation (based on community practices)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all versions verified via npm registry
- Architecture: HIGH - based on locked decisions in CONTEXT.md + official docs
- Pitfalls: MEDIUM - based on community articles and search results

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (stable libraries, 30 days)
