# URL-to-Editable-Document Analysis (May 2026)

**Researched:** 2026-05-16
**Domain:** Browser Automation, AI Vision, HTML Parsing, Document Structure
**Confidence:** HIGH

---

## 1. Executive Summary

The user's vision is **"Pass in app URL and turn to editable document"** -- not just PDF capture, but truly EDITABLE blocks. This requires a multi-stage pipeline:

1. **Capture** -- Render the URL in a headless browser
2. **Extract** -- Parse DOM structure OR use AI vision on screenshot
3. **Transform** -- Convert extracted structure to TipTap-compatible blocks
4. **Detect Variables** -- AI identifies what content should become placeholders

**Key insight:** The 2026 state-of-the-art has diverged into two approaches:

| Approach | When to Use | Accuracy | Cost |
|----------|-------------|----------|------|
| **DOM-First** | Pages you control, simple layouts | 95%+ structure preservation | ~$0.001/page |
| **Vision-First** | Complex layouts, design-heavy pages, unknown sites | 80-90% layout understanding | ~$0.02-0.05/page |

**Primary recommendation:** Implement a **hybrid pipeline** that extracts DOM structure first, then uses AI vision to semantically classify blocks and detect variables. This combines the structural accuracy of DOM parsing with the semantic understanding of vision models.

---

## 2. True URL to Editable (Not Just PDF)

### The Problem with PDF Capture

PDF capture (Puppeteer `page.pdf()`) produces a static snapshot. The content is:
- Not editable without OCR + reconstruction
- Loses semantic structure (headings become just "big text")
- Cannot identify what should be variables

### The Solution: DOM Extraction + AI Enhancement

```
URL Input
    |
    v
+-------------------+
| Headless Browser  |  <-- Playwright/Puppeteer renders the page
| (Chromium)        |
+-------------------+
    |
    +---> Screenshot (backup for AI vision)
    |
    v
+-------------------+
| DOM Extraction    |  <-- Extract rendered HTML + computed styles
| (Readability +    |
|  Custom Rules)    |
+-------------------+
    |
    v
+-------------------+
| Structure         |  <-- Map HTML elements to TipTap nodes
| Transformation    |
+-------------------+
    |
    v
+-------------------+
| AI Variable       |  <-- GPT-5/Gemini 3 identifies placeholders
| Detection         |
+-------------------+
    |
    v
TipTap JSON (Editable Document)
```

### What Makes Content "Editable"

True editability requires:

| Requirement | How Achieved |
|-------------|--------------|
| Semantic structure | Map `<h1>` to heading block, `<p>` to paragraph, etc. |
| Rich text preserved | Extract bold, italic, links from inline elements |
| Images retained | Extract `<img>` src, optionally re-host |
| Tables supported | Parse `<table>` to table block structure |
| Variables identified | AI detects "Company Name Inc." should be `{{company_name}}` |

---

## 3. Browser Automation Options (2026)

### Playwright vs Puppeteer Verdict

[VERIFIED: Multiple 2026 benchmarks] [CITED: browserstack.com, firecrawl.dev, morphllm.com]

| Criterion | Playwright | Puppeteer |
|-----------|-----------|-----------|
| Browser support | Chromium, Firefox, WebKit | Chromium, Firefox (limited) |
| Language bindings | TS, Python, C#, Java | JavaScript/TypeScript only |
| Auto-waiting | Built-in | Manual `waitForSelector` |
| Parallel execution | Native browser contexts | Manual isolation |
| Debugging tools | Inspector, trace viewer, codegen | Chrome DevTools |
| Benchmark speed | 4.5s navigation-heavy | 4.8s (20-30% faster short scripts) |
| 2026 preference | **Default choice** | Chrome-only scraping with stealth |

**Recommendation:** Use **Playwright** for DOM extraction. It has better cross-browser support, auto-waiting, and is the industry standard for 2026.

### Managed Browser Services

[VERIFIED: Official docs, 2026 reviews] [CITED: browserbase.com, browserless.io, developers.cloudflare.com]

| Service | Best For | Pricing | Key Feature |
|---------|----------|---------|-------------|
| **Browserbase** | AI agents, session persistence | $0.10-0.12/browser-hour | SOC-2 compliant, Stagehand SDK |
| **Browserless** | High-volume scraping, self-hosted | $0.001-0.005/unit | BrowserQL stealth automation |
| **Cloudflare Browser Run** | Edge execution, Workers integration | Free 10min/day, then $$ | 4x concurrency (120 browsers) |

**Recommendation:** For TeveroSEO's use case (capturing prospect/proposal URLs), self-hosted Playwright is sufficient. Use Browserbase only if needing to bypass anti-bot protection on third-party sites.

### Stagehand SDK (AI-Native Browser Control)

[VERIFIED: GitHub, Browserbase docs] [CITED: github.com/browserbase/stagehand]

Stagehand provides three AI primitives for browser automation:

```typescript
// Natural language browser control
await stagehand.act("click the Sign Up button");

// Structured data extraction with Zod schema
const products = await stagehand.extract({
  schema: z.object({
    name: z.string(),
    price: z.number()
  })
});

// Understand page state
const actions = await stagehand.observe();
```

**When to use:** When extracting from unknown page structures where CSS selectors would be brittle. Falls back to AI understanding of the page.

---

## 4. AI-Powered Layout Extraction

### Vision Model Capabilities (2026)

[VERIFIED: OpenAI docs, Google AI docs] [CITED: developers.openai.com, blog.google]

| Model | Strength | Document F1 | Cost |
|-------|----------|-------------|------|
| **GPT-5.4** | Native computer use, million-token context | 94% (structured JSON) | $2.00/1M |
| **Gemini 3 Pro** | Best document understanding, 1M tokens | 86% MMMU benchmark | $1.25/1M |
| **Claude Sonnet 4** | Charts, diagrams, visual instructions | Excellent | $3.00/1M |

**Key capability:** GPT-5.4's "native computer use" means it can interpret screenshots as actionable UI, identifying clickable elements, form fields, and content regions without explicit training.

### Screenshot to Structured Data Flow

[CITED: developers.openai.com/cookbook]

```typescript
// 1. Capture screenshot
const screenshot = await page.screenshot({ fullPage: true });

// 2. Send to vision model with extraction schema
const response = await openai.chat.completions.create({
  model: "gpt-5.4-vision",
  messages: [{
    role: "user",
    content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${screenshot}` }},
      { type: "text", text: `Analyze this webpage and extract content blocks as JSON:
        {
          blocks: [{
            type: "heading" | "paragraph" | "list" | "image" | "table",
            content: "...",
            level?: 1-6,
            suggestedVariable?: "{{variable_name}}" | null
          }]
        }`
      }
    ]
  }],
  response_format: { type: "json_object" }
});
```

### Accuracy Expectations

[CITED: brightdata.com, Medium research]

| Extraction Method | Structured Data Accuracy | Layout Preservation |
|-------------------|-------------------------|---------------------|
| Raw HTML to LLM | 71% | Poor |
| Clean Markdown | 85% | Good |
| **Flat JSON (structured)** | **94%** | Excellent |
| Vision + DOM hybrid | 90%+ | Excellent |

**Critical insight:** Feeding raw HTML to an LLM is both expensive (~$0.11/page for 150KB) and inaccurate. Pre-processing with Mozilla Readability or Firecrawl reduces tokens 7x while improving accuracy.

---

## 5. HTML to Block Conversion

### TipTap's Native HTML Parsing

[VERIFIED: Context7] [CITED: tiptap.dev/docs]

TipTap provides `generateJSON` for server-side HTML to ProseMirror JSON conversion:

```typescript
import { generateJSON } from '@tiptap/html';
import { Document, Paragraph, Text, Bold, Heading, BulletList, ListItem } from '@tiptap/starter-kit';

const json = generateJSON(
  '<h1>Welcome</h1><p>Hello <strong>world</strong></p>',
  [Document, Paragraph, Text, Bold, Heading, BulletList, ListItem]
);

// Result:
// {
//   type: 'doc',
//   content: [
//     { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome' }] },
//     { type: 'paragraph', content: [
//       { type: 'text', text: 'Hello ' },
//       { type: 'text', marks: [{ type: 'bold' }], text: 'world' }
//     ]}
//   ]
// }
```

**Limitation:** TipTap parses according to its schema -- content that doesn't conform is LOST. This means:
- Complex CSS layouts don't map to semantic structure
- Unknown HTML elements are stripped
- Custom data attributes may be ignored

### Pre-Processing Pipeline

To maximize extraction quality, pre-process HTML before TipTap:

```typescript
// 1. Extract main content (remove nav, ads, footer)
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(rawHtml, { url: sourceUrl });
const reader = new Readability(dom.window.document);
const article = reader.parse();

// article.content = clean HTML of main content
// article.title = extracted title
// article.byline = author if detected

// 2. Convert to TipTap JSON
const tiptapJson = generateJSON(article.content, extensions);

// 3. Add persuasion type classification via AI
const classified = await classifyBlocks(tiptapJson);
```

### Custom Extensions for Persuasion Blocks

[VERIFIED: Context7] [CITED: tiptap.dev/docs/extensions]

Extend TipTap to parse custom HTML into persuasion-aware blocks:

```typescript
import { Node } from '@tiptap/core';

const PersuasionBlock = Node.create({
  name: 'persuasionBlock',
  group: 'block',
  content: 'inline*',
  
  addAttributes() {
    return {
      persuasionType: {
        default: 'custom',
        parseHTML: el => el.getAttribute('data-persuasion-type'),
        renderHTML: attrs => ({ 'data-persuasion-type': attrs.persuasionType })
      }
    };
  },
  
  parseHTML() {
    return [
      { tag: 'div[data-persuasion-type]' },
      { tag: 'section', getAttrs: el => inferPersuasionType(el) }
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, class: 'persuasion-block' }, 0];
  }
});
```

### Content Extraction Libraries Comparison

[VERIFIED: npm, GitHub] [CITED: cheerio.js.org, jsdom docs]

| Library | Speed | Memory | JavaScript Execution | Best For |
|---------|-------|--------|---------------------|----------|
| **Cheerio** | Fastest | Low (5x less than JSDOM) | No | Static HTML parsing |
| **JSDOM** | Slower | High | Yes | Dynamic content, testing |
| **Mozilla Readability** | Fast | Low | No | Article extraction |
| **Unfluff** | Fast | Low | No | News/blog content |

**Recommendation:** Use **Mozilla Readability** for initial content extraction, then **TipTap generateJSON** for conversion. Avoid JSDOM unless JavaScript execution is required.

---

## 6. Variable Auto-Detection

### The Challenge

Given extracted content like:

> "Plaukų Pasaka currently ranks #47 for 'plaukų priežiūra' with monthly traffic of 2,400 visits."

The AI must identify:
- `Plaukų Pasaka` -> `{{prospect.company}}`
- `#47` -> `{{seo_data.main_keyword_rank}}`
- `plaukų priežiūra` -> `{{seo_data.main_keyword}}`
- `2,400` -> `{{seo_data.monthly_traffic}}`

### Detection Approach

[ASSUMED] This approach is based on LLM capabilities, not a specific 2026 tool.

```typescript
interface VariableDetectionResult {
  originalText: string;
  suggestedVariable: string;
  variableType: 'prospect' | 'seo_data' | 'user_input' | 'ai_generated';
  confidence: number;
  sourceField?: string; // e.g., "prospect.company"
}

async function detectVariables(
  content: TipTapJSON,
  context: {
    prospect?: ProspectContext;
    seoData?: SEOData;
    knownVariables: string[]; // Existing variable patterns
  }
): Promise<VariableDetectionResult[]> {
  const prompt = `
Analyze this document content and identify text that should become template variables.

Known data context:
- Prospect company: ${context.prospect?.companyName || 'unknown'}
- Industry: ${context.prospect?.industry || 'unknown'}
- Main keyword: ${context.seoData?.mainKeyword || 'unknown'}

Common variable patterns:
${context.knownVariables.map(v => `- ${v}`).join('\n')}

Content to analyze:
${JSON.stringify(content)}

For each identified variable, return:
1. The original text span
2. Suggested variable name (e.g., {{prospect.company}})
3. Variable type (prospect, seo_data, user_input, ai_generated)
4. Confidence score (0-1)

Return JSON array of detections.
`;

  const result = await gemini.generateContent(prompt);
  return JSON.parse(result);
}
```

### Variable Patterns to Detect

| Pattern Type | Examples | Detection Signal |
|--------------|----------|------------------|
| **Company names** | "Acme Corp", "TechStartup.lt" | Capitalized, matches known prospect |
| **Numbers with context** | "#47", "2,400 visits", "$5,000" | Numeric + SEO/business context |
| **Industry terms** | "e-commerce brands", "plaukų priežiūra" | Matches prospect.industry |
| **Proper nouns** | Person names, locations | Named entity recognition |
| **Date references** | "Q2 2026", "next 90 days" | Date patterns, relative time |
| **Contact info** | Emails, phone numbers | Regex patterns |

### Integration with Template System

Once variables are detected, integrate with Phase 102's template content modes:

```typescript
interface DetectedBlock {
  id: string;
  content: TipTapContent;
  detectedVariables: VariableDetectionResult[];
  suggestedMode: 'fixed' | 'variable' | 'regenerate';
}

function suggestContentMode(block: DetectedBlock): TemplateContentMode {
  const highConfidenceVars = block.detectedVariables.filter(v => v.confidence > 0.8);
  
  if (highConfidenceVars.length === 0) {
    return 'fixed'; // No variables detected -- keep as-is
  }
  
  if (highConfidenceVars.length > 3) {
    return 'regenerate'; // Too many variables -- let AI regenerate
  }
  
  return 'variable'; // Some variables -- use placeholder substitution
}
```

---

## 7. Recommended Architecture

### Full Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     URL INPUT                                    │
│                  (prospect proposal, competitor page, etc.)      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: BROWSER CAPTURE                                        │
│  ─────────────────────────                                       │
│  Tool: Playwright (self-hosted) or Browserbase (anti-bot)       │
│                                                                  │
│  Outputs:                                                        │
│  • Rendered DOM (page.content())                                │
│  • Full-page screenshot (backup for AI vision)                  │
│  • Computed styles for key elements                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2: CONTENT EXTRACTION                                     │
│  ──────────────────────────                                      │
│  Tool: Mozilla Readability                                       │
│                                                                  │
│  Outputs:                                                        │
│  • Clean HTML (main content only)                               │
│  • Title, byline, excerpt                                       │
│  • Site name                                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3: STRUCTURE TRANSFORMATION                               │
│  ─────────────────────────────────                               │
│  Tool: TipTap generateJSON + custom extensions                   │
│                                                                  │
│  Outputs:                                                        │
│  • TipTap JSON document                                         │
│  • Block array with types (heading, paragraph, list, etc.)      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 4: AI ENHANCEMENT                                         │
│  ────────────────────────                                        │
│  Tool: Gemini 3.1 Pro (per CLAUDE.md model guidance)            │
│                                                                  │
│  Tasks:                                                          │
│  a) Classify blocks by persuasion type (pain_amplifier, etc.)   │
│  b) Detect variables (company names, numbers, keywords)         │
│  c) Suggest content modes (fixed/variable/regenerate)           │
│                                                                  │
│  Outputs:                                                        │
│  • Persuasion-typed blocks                                      │
│  • Variable detection results                                   │
│  • Content mode recommendations                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 5: USER REVIEW                                            │
│  ─────────────────────────                                       │
│  UI: Review & adjust screen (similar to Paste Import flow)      │
│                                                                  │
│  User can:                                                       │
│  • Confirm/reject block classifications                         │
│  • Accept/modify variable detections                            │
│  • Change content modes                                          │
│  • Edit block content directly                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────────┐
│  OUTPUT: EDITABLE DOCUMENT                                       │
│  ─────────────────────────                                       │
│  • TipTap editor with persuasion blocks                         │
│  • Variables highlighted and editable                           │
│  • Ready for proposal generation workflow                       │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Stage | Technology | Rationale |
|-------|------------|-----------|
| Browser | Playwright | Best 2026 default, cross-browser, auto-waiting |
| Extraction | Mozilla Readability | Battle-tested, Firefox Reader View algorithm |
| Transformation | TipTap `@tiptap/html` | Native server-side HTML to JSON |
| AI Enhancement | Gemini 3.1 Pro | Best content generation per CLAUDE.md |
| Variable detection | Gemini 3.1 Pro | Same model, structured JSON output |

### API Design

```typescript
// POST /api/documents/import-url
interface ImportUrlRequest {
  url: string;
  prospect?: {
    id: string;
    company: string;
    industry: string;
  };
  options?: {
    extractStyle: boolean; // Also extract style reference
    detectVariables: boolean; // Run variable detection
    classifyBlocks: boolean; // Classify persuasion types
  };
}

interface ImportUrlResponse {
  success: boolean;
  document: {
    title: string;
    blocks: TipTapBlock[];
    detectedVariables: VariableDetectionResult[];
    suggestedFramework?: string;
    styleReference?: ExtractedStyle;
  };
  screenshot?: string; // Base64 for preview
  processingTimeMs: number;
  tokensUsed: number;
  estimatedCost: number;
}
```

### Cost Estimation

| Component | Cost per URL | Notes |
|-----------|-------------|-------|
| Playwright rendering | ~$0.001 | Self-hosted, compute only |
| Screenshot storage | ~$0.0001 | S3/R2 temporary |
| Gemini 3.1 Pro (classification + variables) | ~$0.02-0.05 | ~20K tokens avg |
| **Total** | **~$0.02-0.05/URL** | |

---

## 8. Integration with Phase 102 Architecture

### Fitting into 5 Entry Points

The URL import becomes a **6th entry point** or enhances Flow 2 (Paste Import):

| Entry Point | Source | Flow |
|-------------|--------|------|
| Blank Canvas | None | Framework selection -> Prospect -> Empty editor |
| Paste Import | Text | AI structure detection -> Review -> Editor |
| **URL Import** | URL | Browser capture -> DOM extract -> AI enhance -> Review -> Editor |
| Template Selection | Gallery | Preview -> Prospect -> Pre-populated editor |
| PDF Upload | PDF | Style extraction only -> Context reference |
| Clone Existing | Proposal | Select what to copy -> Editor |

### Data Model Extension

```typescript
interface ImportSession {
  id: string;
  userId: string;
  
  // Extended for URL import
  sourceType: 'paste' | 'pdf' | 'url';
  sourceContent: string; // Raw text, file ref, or URL
  sourceUrl?: string; // Original URL for 'url' type
  
  // Capture artifacts
  screenshotUrl?: string;
  renderedHtml?: string;
  
  // Detection results (same as existing)
  detectedBlocks: DetectedBlock[];
  suggestedFramework?: string;
  frameworkConfidence?: number;
  extractedStyle?: ExtractedStyle;
  
  // Variable detection (new)
  detectedVariables: VariableDetectionResult[];
  
  // User decisions
  acceptedMappings: BlockMapping[];
  acceptedVariables: VariableMapping[];
  
  status: 'capturing' | 'extracting' | 'analyzing' | 'review' | 'imported' | 'cancelled';
  
  resultProposalId?: string;
  createdAt: Date;
}
```

### UI Flow for URL Import

```
┌─────────────────────────────────────────────────────────────────┐
│  URL IMPORT                                                      │
│                                                                  │
│  Enter URL to import:                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ https://example.com/our-seo-proposal                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ☑ Detect variables automatically                               │
│  ☑ Classify persuasion blocks                                  │
│  ☐ Also extract as style reference                              │
│                                                                  │
│  [Import URL]                                                    │
└─────────────────────────────────────────────────────────────────┘
        │
        v (Loading: Capturing page...)
        v (Loading: Extracting content...)
        v (Loading: Analyzing structure...)
        │
        v
┌─────────────────────────────────────────────────────────────────┐
│  REVIEW IMPORT                                                   │
│                                                                  │
│  Extracted 8 blocks, detected 12 variables                      │
│                                                                  │
│  ┌─────────────────────────┐   ┌─────────────────────────────┐ │
│  │ Preview                 │   │ Detected Blocks             │ │
│  │ (Screenshot)            │   │                             │ │
│  │                         │   │ 1. [Pain Amplifier] 92%     │ │
│  │                         │   │    "Your SEO is..."         │ │
│  │                         │   │                             │ │
│  │                         │   │ 2. [Credibility] 88%        │ │
│  │                         │   │    "47 brands helped..."    │ │
│  │                         │   │                             │ │
│  └─────────────────────────┘   │ Variables detected:         │ │
│                                 │ • "Plaukų Pasaka" ->        │ │
│                                 │   {{prospect.company}}      │ │
│                                 │ • "#47" ->                  │ │
│                                 │   {{seo_data.rank}}         │ │
│                                 └─────────────────────────────┘ │
│                                                                  │
│  [Accept All] [Edit Mappings] [Cancel]                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Variable detection via LLM prompt achieves >80% accuracy | Section 6 | May need additional training/fine-tuning |
| A2 | Mozilla Readability handles most modern page layouts | Section 5 | Complex SPAs may need fallback to AI vision |
| A3 | Self-hosted Playwright sufficient for TeveroSEO use cases | Section 3 | May need Browserbase for anti-bot scenarios |

---

## 10. Sources

### Primary (HIGH confidence)
- [TipTap Docs - HTML Utility](https://tiptap.dev/docs/editor/api/utilities/html) - generateJSON function
- [TipTap Docs - Custom Extensions](https://tiptap.dev/docs/editor/extensions/custom-extensions) - parseHTML patterns
- [Mozilla Readability GitHub](https://github.com/mozilla/readability) - Content extraction
- [Playwright Docs](https://playwright.dev/docs/intro) - Browser automation
- [OpenAI Cookbook - Document Understanding](https://developers.openai.com/cookbook/examples/multimodal/document_and_multimodal_understanding_tips) - GPT-5 vision

### Secondary (MEDIUM confidence)
- [BrowserStack - Playwright vs Puppeteer 2026](https://www.browserstack.com/guide/playwright-vs-puppeteer) - Comparison benchmarks
- [Browserbase](https://www.browserbase.com/stagehand) - Stagehand SDK documentation
- [Cloudflare Browser Run](https://developers.cloudflare.com/browser-run/) - Edge browser service
- [Firecrawl - Web Extraction](https://www.firecrawl.dev/blog/best-web-extraction-tools) - Structured extraction patterns
- [Google - Gemini 3 Pro Vision](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-3-pro-vision/) - Document understanding

### Tertiary (LOW confidence)
- [Medium - Web Scraping 2026](https://medium.com/@yash.dubey803at/web-scraping-for-ai-in-2026-what-works-whats-broken-and-what-it-actually-costs-e8d824d54395) - Cost estimates
- Various benchmark comparisons - Performance numbers

---

## 11. Open Questions

1. **Anti-bot handling:** What percentage of prospect/competitor URLs will require Browserbase vs self-hosted Playwright?

2. **Variable detection accuracy:** Should we build a training dataset of correctly-identified variables to fine-tune the detection model?

3. **User expectations:** Should URL import produce a ready-to-send proposal, or always require review/editing?

4. **Style extraction:** Should URL import automatically extract style references for tone matching, or keep that separate?

---

*Research completed: 2026-05-16*
*Next step: Integrate with Phase 102 planning as optional Feature 9 or enhancement to Flow 2*
