# Phase 102: Upload-First Architecture

> **Core Insight:** Users don't want to "rebuild" their proposals in our system. They want to upload their existing beautiful designs and make them smart. This document synthesizes findings from 5 expert analyses into an actionable architecture.

**Created:** 2026-05-15  
**Status:** Architecture Decision Record  
**Supersedes:** Previous assumptions about "builder-first" approach

---

## The Upload-First Philosophy

### What Users Actually Want

```
CURRENT (Broken):
Design in Figma → Export PDF → Upload to PandaDoc → Add signature fields
                                                   ↑
                                        (PDF is just an image, not editable)

DESIRED (TeveroSEO):
Design in Figma → Export PDF → Upload to TeveroSEO → Edit text, add variables
        ↓                                           → Inject SEO data
   OR paste from                                    → Personalize per prospect
   Google Docs                                      → Track engagement
        ↓                                           → A/B test blocks
   OR existing Word doc                             → Export back to PDF
```

### The Key Insight

**PDFs are display formats, not content formats.** There is no "heading" in a PDF — only text at coordinates with a font size. But AI vision can UNDERSTAND what humans see:

```
PDF Parser sees:          AI Vision sees:
─────────────────         ─────────────────
Text at (100, 50)         "This is a headline"
Font: Helvetica-Bold      Block type: pain_amplifier
Size: 24pt                Confidence: 0.92
```

This means we can:
1. **Extract the text** (PDF parsing)
2. **Understand the structure** (AI vision)
3. **Extract the style** (color/font analysis)
4. **Recreate with intelligence** (our block system + their theme)

---

## The Two-Track Architecture

### Track 1: Style Extraction (Always Happens)

Every uploaded document yields a **Brand Theme** that can be applied to any proposal:

```typescript
interface ExtractedBrandTheme {
  id: string;
  sourceName: string;        // "Plaukų Pasaka Proposal v3.pdf"
  sourceType: 'pdf' | 'docx' | 'url' | 'paste';
  
  colors: {
    primary: string;         // Extracted dominant brand color
    secondary: string;       // Secondary accent
    background: string;      // Page background
    text: string;            // Body text color
  };
  
  typography: {
    headingFont: FontMatch;  // Detected → Web-safe match
    bodyFont: FontMatch;
    scale: TypeScale;        // h1: 2.5rem, h2: 2rem, etc.
  };
  
  voice: {
    tone: string[];          // ["professional", "confident", "direct"]
    vocabulary: string[];    // Key phrases to reuse
    formality: 'casual' | 'professional' | 'formal';
  };
  
  extractedAt: Date;
  confidence: number;
}
```

### Track 2: Content Import (User Choice)

User decides whether to:

**Option A: "Use as Style Reference Only"**
- Brand theme saved for future proposals
- Original document archived for reference
- User builds new proposal in block editor
- AI uses theme for tone/vocabulary matching

**Option B: "Import Content to Edit"**
- AI detects persuasion blocks in document
- Creates editable blocks from detected sections
- User verifies/adjusts block mapping
- Variables detected and made dynamic

---

## The Import Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UPLOAD HANDLING                                    │
│                                                                             │
│  PDF → R2 Storage       DOCX → R2 Storage      Paste → Direct Process      │
│         ↓                      ↓                       ↓                    │
│  Virus scan + Validate   Virus scan + Validate    Sanitize HTML            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FORMAT-SPECIFIC PARSING                               │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  PDF Parser  │  │ DOCX Parser  │  │ HTML Parser  │  │ Image Parser │   │
│  │  (PyMuPDF)   │  │ (mammoth.js) │  │   (JSDOM)    │  │ (Tesseract)  │   │
│  │              │  │              │  │              │  │              │   │
│  │ → Text+pos   │  │ → Structured │  │ → DOM tree   │  │ → OCR text   │   │
│  │ → Fonts      │  │   HTML       │  │ → Styles     │  │ → Layout     │   │
│  │ → Colors     │  │ → Styles     │  │              │  │              │   │
│  │ → Images     │  │ → Images     │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                             │
│  All produce: UnifiedDocument { text, fonts, colors, images, layout_hints } │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PARALLEL AI ANALYSIS                                 │
│                                                                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐        │
│  │   Style Extraction          │    │   Structure Detection        │        │
│  │   (Gemini 3.1 Pro)          │    │   (Gemini 3.1 Pro)          │        │
│  │                             │    │                             │        │
│  │   • Tone analysis           │    │   • Persuasion block types  │        │
│  │   • Vocabulary extraction   │    │   • Section boundaries      │        │
│  │   • Formality detection     │    │   • Variable candidates     │        │
│  │   • Color role assignment   │    │   • Table detection         │        │
│  │   • Font role matching      │    │   • Image placement         │        │
│  └─────────────────────────────┘    └─────────────────────────────┘        │
│                                                                             │
│  Cost: ~$0.02-0.05 per document (2-5 pages)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────────┐
│      BRAND THEME SAVED        │   │         VERIFICATION UI               │
│                               │   │                                       │
│  Available for all future     │   │  ┌─────────────┬─────────────────┐   │
│  proposals from this org      │   │  │  PDF View   │  Detected Blocks │   │
│                               │   │  │             │                  │   │
│  • Apply to templates         │   │  │  [page 1]   │  ☑ Pain Point    │   │
│  • AI matches tone            │   │  │             │  ☑ Credibility   │   │
│  • Colors/fonts auto-applied  │   │  │  [page 2]   │  ☑ Process       │   │
│                               │   │  │             │  ☑ Pricing       │   │
└───────────────────────────────┘   │  │  [page 3]   │  ☑ Guarantee     │   │
                                    │  │             │  ☐ (merge these) │   │
                                    │  └─────────────┴─────────────────┘   │
                                    │                                       │
                                    │  User can: Adjust types, merge/split, │
                                    │  mark variables, approve              │
                                    └───────────────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────────────────┐
                                    │        EDITABLE PROPOSAL CREATED      │
                                    │                                       │
                                    │  • Blocks in our system               │
                                    │  • Variables ready for {{prospect}}   │
                                    │  • Brand theme applied                │
                                    │  • Ready for editing                  │
                                    └───────────────────────────────────────┘
```

---

## Format-Specific Strategies

### PDF (Most Common)

**Source Quality Tiers:**

| Tier | Example | Text Extraction | Layout Preservation |
|------|---------|-----------------|---------------------|
| **Designed PDF** | InDesign/Canva export | 95% via PyMuPDF | Style reference only |
| **Text PDF** | Word export | 98% via PyMuPDF | Good structure hints |
| **Scanned PDF** | Camera/scanner | OCR needed (90%) | Minimal |

**Extraction Pipeline:**

```python
# services/pdf-processor/extract.py
import fitz  # PyMuPDF

def extract_pdf(pdf_bytes: bytes) -> UnifiedDocument:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    result = UnifiedDocument()
    
    for page in doc:
        # Extract text with positions
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block["type"] == 0:  # Text
                for line in block["lines"]:
                    for span in line["spans"]:
                        result.add_text_span(TextSpan(
                            text=span["text"],
                            font=span["font"],
                            size=span["size"],
                            color=span["color"],
                            bold=bool(span["flags"] & 16),
                            bbox=span["bbox"]
                        ))
        
        # Extract images (for logo detection)
        for img in page.get_images():
            result.add_image(extract_image(doc, img))
        
        # Render page for vision analysis
        pix = page.get_pixmap(dpi=150)
        result.add_page_image(pix.tobytes("png"))
    
    return result
```

### Google Docs (Best Quality)

Google Docs has **semantic structure** — actual headings, lists, tables:

```typescript
// apps/web/src/lib/document-processing/parsers/google-docs.ts
import { google } from 'googleapis';

export async function parseGoogleDoc(documentId: string): Promise<UnifiedDocument> {
  const docs = google.docs({ version: 'v1', auth: await getAuth() });
  const { data: doc } = await docs.documents.get({ documentId });
  
  const result: UnifiedDocument = { sections: [], styles: {} };
  
  for (const element of doc.body!.content!) {
    if (element.paragraph) {
      const style = element.paragraph.paragraphStyle;
      
      // Google Docs has REAL heading types!
      if (style?.namedStyleType === 'HEADING_1') {
        result.sections.push({
          type: 'heading_1',
          content: extractText(element.paragraph),
          confidence: 1.0  // No guessing needed
        });
      }
      // ... etc
    } else if (element.table) {
      result.sections.push({
        type: 'table',
        content: extractTable(element.table),
        confidence: 1.0
      });
    }
  }
  
  return result;
}
```

### DOCX (Via mammoth.js)

```typescript
// apps/web/src/lib/document-processing/parsers/docx.ts
import mammoth from 'mammoth';

export async function parseDocx(buffer: Buffer): Promise<UnifiedDocument> {
  const result = await mammoth.convertToHtml({ buffer }, {
    styleMap: [
      // Map Word styles to our block types
      "p[style-name='Pain Point'] => div.pain-amplifier",
      "p[style-name='Guarantee'] => div.risk-reversal",
      "p[style-name='Heading 1'] => h1",
      "p[style-name='Heading 2'] => h2",
    ]
  });
  
  return htmlToUnifiedDocument(result.value);
}
```

### Pasted HTML

```typescript
// apps/web/src/lib/document-processing/parsers/html.ts
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

export async function parseHtml(html: string): Promise<UnifiedDocument> {
  // Sanitize first
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'table', 
                   'tr', 'td', 'th', 'strong', 'em', 'a', 'br', 'img'],
    ALLOWED_ATTR: ['href', 'src', 'alt']
  });
  
  const dom = new JSDOM(clean);
  return domToUnifiedDocument(dom.window.document.body);
}
```

---

## AI Structure Detection

### The Prompt for Persuasion Block Detection

```typescript
// apps/web/src/lib/document-processing/ai/structure-detection.ts

const STRUCTURE_DETECTION_PROMPT = `
You are analyzing a sales proposal to identify persuasion elements.

For each distinct section, classify it as one of these types:
- pain_amplifier: Highlights prospect's current problems or costs
- villain_story: Positions competitors or status quo as the enemy
- credibility: Establishes authority, experience, expertise
- social_proof: Testimonials, case studies, client logos
- process_reveal: Explains methodology or how service works
- offer_stack: Presents packages/pricing with value framing
- risk_reversal: Guarantees, refund policies, risk removal
- objection_handler: Addresses common concerns/FAQ
- urgency: Creates time pressure or scarcity
- cta: Call to action
- data_section: Tables, charts, statistics
- custom: Content that doesn't fit other categories

Also identify VARIABLE CANDIDATES — text that should become dynamic:
- Company names that change per prospect
- Dates that should auto-update
- Prices that vary by package
- Statistics from SEO data

Return JSON:
{
  "blocks": [
    {
      "type": "pain_amplifier",
      "title": "Short title for this block",
      "content": "The exact text of this section...",
      "confidence": 0.92,
      "variables": [
        {
          "original_text": "Plaukų Pasaka",
          "suggested_variable": "{{prospect.company_name}}",
          "confidence": 0.95
        }
      ]
    }
  ],
  "detected_language": "lt",
  "overall_structure": "Problem → Solution → Proof → Offer → Guarantee → CTA"
}

Document text:
{document_text}
`;

export async function detectStructure(text: string): Promise<StructureAnalysis> {
  const response = await gemini.generate({
    model: 'gemini-3.1-pro',
    prompt: STRUCTURE_DETECTION_PROMPT.replace('{document_text}', text),
    responseFormat: { type: 'json_object' }
  });
  
  return JSON.parse(response.text);
}
```

### Cost Analysis

| Document Size | AI Processing Cost | Total Time |
|---------------|-------------------|------------|
| 1-2 pages | ~$0.01 | 5-10 sec |
| 3-5 pages | ~$0.02-0.03 | 10-20 sec |
| 6-10 pages | ~$0.04-0.06 | 20-40 sec |
| 10-20 pages | ~$0.08-0.12 | 40-90 sec |

**Cost optimization:** Cache structure analysis by content hash. Same document = same result.

---

## The Verification UI

After AI analysis, users see a side-by-side verification screen:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VERIFY IMPORTED STRUCTURE                                 │
│                                                                             │
│  We detected 8 blocks in your document. Please verify:                      │
│                                                                             │
│  ┌─────────────────────────────┬───────────────────────────────────────┐   │
│  │                             │                                       │   │
│  │      ORIGINAL PDF           │         DETECTED STRUCTURE            │   │
│  │                             │                                       │   │
│  │  ┌─────────────────────┐   │   ┌─────────────────────────────────┐ │   │
│  │  │                     │   │   │ ☑ Pain Amplifier         [92%] │ │   │
│  │  │  [Page 1 preview]   │   │   │   "Kasdien jūs atiduodate..."  │ │   │
│  │  │                     │   │   │   📝 Edit  🔀 Change Type      │ │   │
│  │  │  Hover highlights   │   │   ├─────────────────────────────────┤ │   │
│  │  │  detected blocks    │   │   │ ☑ Credibility            [88%] │ │   │
│  │  │                     │   │   │   "Todėl atsirado Tevero..."   │ │   │
│  │  └─────────────────────┘   │   │   📝 Edit  🔀 Change Type      │ │   │
│  │                             │   ├─────────────────────────────────┤ │   │
│  │  ┌─────────────────────┐   │   │ ☑ Process Reveal         [95%] │ │   │
│  │  │                     │   │   │   "6 etapai, per kuriuos..."   │ │   │
│  │  │  [Page 2 preview]   │   │   │   📝 Edit  🔀 Change Type      │ │   │
│  │  │                     │   │   ├─────────────────────────────────┤ │   │
│  │  │                     │   │   │ ☑ Offer Stack            [97%] │ │   │
│  │  │                     │   │   │   Starto / Augimo / Premium    │ │   │
│  │  └─────────────────────┘   │   │   📝 Edit  🔀 Change Type      │ │   │
│  │                             │   └─────────────────────────────────┘ │   │
│  │  ◀ Page 1 of 3 ▶           │                                       │   │
│  └─────────────────────────────┴───────────────────────────────────────┘   │
│                                                                             │
│  Variables Detected:                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ "Plaukų Pasaka" → {{prospect.company_name}}  ☑ Make dynamic         │   │
│  │ "3500 EUR"      → {{package.price}}          ☑ Make dynamic         │   │
│  │ "2025 m."       → {{current_year}}           ☐ Keep static          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                    [Cancel]  [Save as Style Only]  [Create Proposal →]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Variable System Integration

### Auto-Detected Variables

The AI identifies text that should become dynamic:

| Pattern | Variable | Confidence |
|---------|----------|------------|
| Company names (capitalized, repeated) | `{{prospect.company_name}}` | High |
| Prices with currency | `{{package.price}}` | High |
| Dates (years, months) | `{{current_year}}` | Medium |
| URLs/domains | `{{prospect.domain}}` | High |
| Person names (Dear X) | `{{prospect.contact_name}}` | Medium |
| Statistics (if from SEO data) | `{{seo.organic_traffic}}` | Requires verification |

### Variable Resolution Flow

```
EDITING MODE:                 PREVIEW MODE:                 LIVE (Prospect) MODE:
─────────────────             ─────────────────             ─────────────────────
{{prospect.company}}    →     [Company Name]          →     Plaukų Pasaka
{{package.price}}       →     [Price]                 →     €3,500
{{seo.domain_rating}}   →     [Domain Rating]         →     47
```

---

## Theme Application

### How Extracted Themes Apply to Components

```typescript
// apps/web/src/lib/document-builder/theming/apply-theme.ts

export function applyThemeToProposal(
  proposal: Proposal,
  theme: ExtractedBrandTheme
): ThemedProposal {
  return {
    ...proposal,
    cssVariables: {
      '--color-primary': theme.colors.primary,
      '--color-secondary': theme.colors.secondary,
      '--color-background': theme.colors.background,
      '--color-text': theme.colors.text,
      '--font-heading': theme.typography.headingFont.webSafe,
      '--font-body': theme.typography.bodyFont.webSafe,
      '--font-scale-h1': `${theme.typography.scale.h1}rem`,
      '--font-scale-h2': `${theme.typography.scale.h2}rem`,
    },
    voiceContext: {
      tone: theme.voice.tone,
      vocabulary: theme.voice.vocabulary,
      formality: theme.voice.formality
    }
  };
}
```

### AI Tone Matching

When generating new content, AI uses the voice context:

```typescript
const GENERATION_PROMPT = `
Generate content for a ${blockType} block.

VOICE REQUIREMENTS:
- Tone: ${theme.voice.tone.join(', ')}
- Formality: ${theme.voice.formality}
- Use vocabulary like: ${theme.voice.vocabulary.slice(0, 5).join(', ')}

CONTEXT:
${existingContent}

Generate:
`;
```

---

## PDF Export (Round-Trip)

### The Challenge

User uploads PDF → edits in our system → exports back to PDF

The exported PDF should feel consistent with their brand, even if not pixel-perfect.

### Solution: Puppeteer with Theme-Aware Rendering

```typescript
// apps/web/src/lib/document-builder/export/pdf-export.ts

export async function exportToPDF(
  proposal: Proposal,
  context: VariableContext,
  theme: ExtractedBrandTheme
): Promise<Buffer> {
  // Render to HTML with theme
  const html = await renderProposalHTML(proposal, context, theme);
  
  // Add print-specific CSS
  const printHTML = wrapWithPrintStyles(html, theme);
  
  // Generate PDF via Puppeteer
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setContent(printHTML, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  
  // Load Google Fonts
  await page.evaluateHandle('document.fonts.ready');
  
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    displayHeaderFooter: true,
    footerTemplate: `
      <div style="font-size: 10px; text-align: center; width: 100%;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `
  });
  
  await browser.close();
  return pdf;
}
```

---

## Competitive Positioning

### What Others Do vs. What We Do

| Competitor | Their Approach | TeveroSEO Approach |
|------------|----------------|-------------------|
| **PandaDoc** | PDF as image + overlay fields | PDF parsed → editable blocks |
| **Proposify** | Force rebuild in their editor | Import existing design |
| **Canva** | Partial parsing, lossy recreation | Style extraction + semantic blocks |
| **Adobe Acrobat** | Edit text in-place (limited) | Full block editing + variables |
| **Beautiful.ai** | AI generates new design | AI preserves YOUR design |

### Our Unique Position

**"Your proposals. Our intelligence."**

- Upload your beautiful PDF
- We extract your brand (colors, fonts, tone)
- We detect your persuasion structure
- We make it editable AND smart
- Variables, SEO data, tracking, A/B testing
- Export back to PDF with your brand intact

---

## Implementation Phases

### Phase 102-A: Foundation (Week 1-2)

**Focus:** Core pipeline without AI

- File upload handling (PDF, DOCX, paste)
- Basic PDF parsing (PyMuPDF via Python service)
- DOCX parsing (mammoth.js)
- HTML parsing (JSDOM)
- Storage in R2
- Basic verification UI (manual block tagging)

### Phase 102-B: AI Enhancement (Week 3-4)

**Focus:** Intelligent structure detection

- Gemini 3.1 Pro integration for structure detection
- Persuasion block classification
- Variable candidate detection
- Style/tone extraction
- Confidence scoring

### Phase 102-C: Theme System (Week 5-6)

**Focus:** Brand preservation

- Color extraction (node-vibrant)
- Font detection and matching
- Theme storage and application
- CSS custom properties runtime theming
- Brand customization UI

### Phase 102-D: Round-Trip Export (Week 7-8)

**Focus:** PDF export quality

- Puppeteer PDF generation
- Print-specific CSS
- Font embedding
- Page break control
- Quality verification

---

## Summary: The Upload-First Model

```
UPLOAD                  →  PARSE                  →  ANALYZE               →  EDIT                    →  EXPORT
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
PDF/DOCX/Paste            Format-specific           AI structure            Form-based                 Puppeteer
                          parsing                   detection               block editing              PDF with
                                                                                                       brand theme
User provides             Technical                 Semantic                User verifies              Same
their existing            extraction                understanding           and edits                  brand feel
document                                                                    in our system
```

**Key Insight:** We're not trying to be Adobe Acrobat (edit PDFs directly). We're converting documents INTO our intelligent block system WITH their brand applied. The result: proposals that are both beautiful (their design) AND smart (our intelligence).
