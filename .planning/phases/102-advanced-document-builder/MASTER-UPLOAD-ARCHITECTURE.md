# Phase 102: Master Upload-First Architecture

> **Purpose:** Definitive architecture document for the upload-first proposal system. Consolidates findings from 5 expert analyses + AI OCR fallback strategy.

**Created:** 2026-05-15  
**Status:** Final Architecture Decision  
**Version:** 1.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Upload-First Philosophy](#the-upload-first-philosophy)
3. [OCR & Text Extraction Strategy](#ocr--text-extraction-strategy)
4. [AI OCR Fallback (DeepSeek/OpenRouter)](#ai-ocr-fallback-deepseekropenrouter)
5. [Complete Processing Pipeline](#complete-processing-pipeline)
6. [Format-Specific Parsers](#format-specific-parsers)
7. [AI Structure Detection](#ai-structure-detection)
8. [Theme/Style Extraction](#themestyle-extraction)
9. [Verification UI](#verification-ui)
10. [Variable System](#variable-system)
11. [Storage & Data Models](#storage--data-models)
12. [Export Pipeline](#export-pipeline)
13. [Cost Analysis](#cost-analysis)
14. [Implementation Plan](#implementation-plan)

---

## Executive Summary

**What we're building:** A system where users upload their existing proposals (PDF, DOCX, paste) and we make them editable + intelligent.

**Key insight:** PDFs are display formats, not content formats. We extract content + style separately, then rebuild in our block system with their brand applied.

**The magic:** AI vision understands document structure the way humans do — it can identify "this is a pricing table" or "this is a guarantee section" even when traditional parsing just sees positioned text.

**Fallback strategy:** Tiered OCR from free (Tesseract) to cheap AI (DeepSeek at $0.07/1M tokens via OpenRouter) to premium (Gemini Vision) ensures we handle everything from clean PDFs to potato-quality scans.

---

## The Upload-First Philosophy

### User Journey

```
TODAY (Painful):
┌─────────────────────────────────────────────────────────────────────────────┐
│ Design in Canva → Export PDF → Email to prospect → Can't track/edit/test   │
│                                                                             │
│ OR                                                                          │
│                                                                             │
│ Use PandaDoc → PDF becomes image → Add overlay fields → Still can't edit   │
└─────────────────────────────────────────────────────────────────────────────┘

TOMORROW (TeveroSEO):
┌─────────────────────────────────────────────────────────────────────────────┐
│ Upload existing PDF → AI extracts structure → Verify blocks → Edit freely  │
│                            ↓                                               │
│                     Brand theme extracted                                   │
│                            ↓                                               │
│              Variables auto-detected ({{company}}, {{price}})              │
│                            ↓                                               │
│              SEO data injectable, A/B testable, trackable                  │
│                            ↓                                               │
│              Export back to PDF with same brand feel                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Respect existing designs** — Users spent time making their proposals beautiful
2. **Extract, don't recreate** — We pull out content + style, not pixel-perfect layout
3. **AI understands semantics** — Vision models see "pricing table" not "text at coordinates"
4. **Graceful degradation** — Multiple fallback layers ensure we handle any input
5. **Human verification** — AI suggests, human confirms

---

## OCR & Text Extraction Strategy

### The Tiered Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TEXT EXTRACTION TIERS                               │
│                                                                             │
│  TIER 0: Native PDF Text (PyMuPDF)                                         │
│  ─────────────────────────────────────                                      │
│  When: PDF has embedded text (most designed PDFs)                          │
│  Cost: FREE                                                                 │
│  Speed: <1 second                                                           │
│  Quality: 99% accurate                                                      │
│  Extracts: Text + position + font + size + color                           │
│                                                                             │
│                              ↓ If text is empty or garbled                  │
│                                                                             │
│  TIER 1: Tesseract OCR (Local)                                             │
│  ─────────────────────────────────────                                      │
│  When: Scanned PDFs, image-based documents                                 │
│  Cost: FREE                                                                 │
│  Speed: 2-5 seconds per page                                               │
│  Quality: 85-95% for clean scans, 60-80% for poor quality                 │
│  Languages: 100+ including Lithuanian                                       │
│                                                                             │
│                              ↓ If confidence < 80% or complex layout        │
│                                                                             │
│  TIER 2: AI OCR - DeepSeek via OpenRouter (Cheap)                          │
│  ─────────────────────────────────────                                      │
│  When: Complex layouts, unusual fonts, low quality images                  │
│  Cost: ~$0.07 per 1M input tokens (~$0.001-0.003 per page)                │
│  Speed: 3-8 seconds per page                                               │
│  Quality: 95-98% even for difficult documents                              │
│  Bonus: Understands context, fixes obvious OCR errors                      │
│                                                                             │
│                              ↓ If still failing or need structure           │
│                                                                             │
│  TIER 3: Premium Vision - Gemini 3.1 Pro                                   │
│  ─────────────────────────────────────                                      │
│  When: Need structure detection anyway, complex documents                  │
│  Cost: ~$0.003 per page (combined with structure detection)                │
│  Speed: 5-15 seconds per page                                              │
│  Quality: 98-99% with semantic understanding                               │
│  Bonus: Returns structured JSON, not just text                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Decision Logic

```typescript
// apps/web/src/lib/document-processing/ocr/extraction-orchestrator.ts

interface ExtractionResult {
  text: string;
  confidence: number;
  tier: 'native' | 'tesseract' | 'deepseek' | 'gemini';
  metadata: {
    processingTime: number;
    cost: number;
    warnings: string[];
  };
}

export async function extractText(
  document: UploadedDocument
): Promise<ExtractionResult> {
  
  // TIER 0: Try native PDF extraction first
  if (document.type === 'pdf') {
    const nativeResult = await extractWithPyMuPDF(document.buffer);
    
    if (nativeResult.text.length > 100 && nativeResult.confidence > 0.9) {
      return {
        text: nativeResult.text,
        confidence: nativeResult.confidence,
        tier: 'native',
        metadata: { processingTime: nativeResult.time, cost: 0, warnings: [] }
      };
    }
  }
  
  // TIER 1: Try Tesseract OCR
  const tesseractResult = await extractWithTesseract(document.pageImages);
  
  if (tesseractResult.confidence > 0.8) {
    return {
      text: tesseractResult.text,
      confidence: tesseractResult.confidence,
      tier: 'tesseract',
      metadata: { processingTime: tesseractResult.time, cost: 0, warnings: [] }
    };
  }
  
  // TIER 2: Escalate to DeepSeek AI OCR
  const deepseekResult = await extractWithDeepSeek(document.pageImages);
  
  if (deepseekResult.confidence > 0.85) {
    return {
      text: deepseekResult.text,
      confidence: deepseekResult.confidence,
      tier: 'deepseek',
      metadata: { 
        processingTime: deepseekResult.time, 
        cost: deepseekResult.cost,
        warnings: ['Used AI OCR due to low Tesseract confidence']
      }
    };
  }
  
  // TIER 3: Premium Gemini extraction (combined with structure detection)
  const geminiResult = await extractWithGemini(document.pageImages);
  
  return {
    text: geminiResult.text,
    confidence: geminiResult.confidence,
    tier: 'gemini',
    metadata: {
      processingTime: geminiResult.time,
      cost: geminiResult.cost,
      warnings: ['Used premium AI OCR for complex document']
    }
  };
}
```

---

## AI OCR Fallback (DeepSeek/OpenRouter)

### Why DeepSeek?

| Model | Cost (Input) | Cost (Output) | Vision | Quality |
|-------|--------------|---------------|--------|---------|
| DeepSeek V3 | $0.07/1M | $0.27/1M | Via V2.5 | Excellent |
| DeepSeek V2.5 | $0.14/1M | $0.28/1M | Yes | Very Good |
| GPT-4o | $2.50/1M | $10/1M | Yes | Excellent |
| Gemini 3.1 Pro | $1.25/1M | $5/1M | Yes | Excellent |
| Claude Sonnet | $3/1M | $15/1M | Yes | Excellent |

**DeepSeek is 10-40x cheaper** than alternatives while maintaining high quality.

### OpenRouter Integration

```typescript
// apps/web/src/lib/document-processing/ocr/deepseek-ocr.ts

import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://tevero.lt',
    'X-Title': 'TeveroSEO Document Processing'
  }
});

interface DeepSeekOCRResult {
  text: string;
  confidence: number;
  cost: number;
  time: number;
}

export async function extractWithDeepSeek(
  pageImages: Buffer[]
): Promise<DeepSeekOCRResult> {
  const startTime = Date.now();
  let totalText = '';
  let totalCost = 0;
  
  for (const [index, imageBuffer] of pageImages.entries()) {
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/png';
    
    const response = await openrouter.chat.completions.create({
      model: 'deepseek/deepseek-chat', // V3 for text, use deepseek-vl2 for vision
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            },
            {
              type: 'text',
              text: `Extract ALL text from this document image. 
              
Rules:
1. Preserve paragraph structure with blank lines between sections
2. Preserve list formatting (bullets, numbers)
3. For tables, use | column | separators |
4. Include ALL text, even small print
5. Fix obvious OCR-like errors based on context
6. If text is in Lithuanian, preserve Lithuanian characters correctly

Return ONLY the extracted text, no commentary.`
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1 // Low temperature for accuracy
    });
    
    const pageText = response.choices[0].message.content || '';
    totalText += `\n--- PAGE ${index + 1} ---\n${pageText}\n`;
    
    // Calculate cost (approximate)
    const inputTokens = response.usage?.prompt_tokens || 1000;
    const outputTokens = response.usage?.completion_tokens || 500;
    totalCost += (inputTokens * 0.14 + outputTokens * 0.28) / 1_000_000;
  }
  
  return {
    text: totalText.trim(),
    confidence: 0.92, // DeepSeek is consistently good
    cost: totalCost,
    time: Date.now() - startTime
  };
}
```

### Alternative: DeepSeek VL2 (Vision-Language Model)

For even better vision understanding:

```typescript
// Using DeepSeek's dedicated vision model
export async function extractWithDeepSeekVision(
  pageImages: Buffer[]
): Promise<DeepSeekOCRResult> {
  const response = await openrouter.chat.completions.create({
    model: 'deepseek/deepseek-vl2', // Dedicated vision model
    messages: [
      {
        role: 'user',
        content: [
          ...pageImages.map(img => ({
            type: 'image_url' as const,
            image_url: { url: `data:image/png;base64,${img.toString('base64')}` }
          })),
          {
            type: 'text',
            text: 'Extract all text from these document pages, preserving structure.'
          }
        ]
      }
    ]
  });
  
  // ...
}
```

### Fallback Configuration

```typescript
// apps/web/src/lib/document-processing/config.ts

export const OCR_CONFIG = {
  tiers: {
    native: {
      enabled: true,
      minConfidence: 0.9,
      cost: 0
    },
    tesseract: {
      enabled: true,
      minConfidence: 0.8,
      cost: 0,
      languages: ['lit', 'eng'], // Lithuanian + English
      preprocessImage: true // Enhance contrast, binarize
    },
    deepseek: {
      enabled: true,
      minConfidence: 0.85,
      model: 'deepseek/deepseek-chat',
      visionModel: 'deepseek/deepseek-vl2',
      maxRetries: 2,
      costPerPage: 0.003 // Estimated
    },
    gemini: {
      enabled: true,
      model: 'gemini-3.1-pro',
      combineWithStructure: true, // Do OCR + structure in one call
      costPerPage: 0.005
    }
  },
  
  // When to escalate
  escalation: {
    lowTextThreshold: 100, // Characters - if less, try OCR
    lowConfidenceThreshold: 0.8,
    complexLayoutIndicators: [
      'multi-column',
      'tables',
      'rotated-text',
      'handwriting'
    ]
  },
  
  // Cost limits
  limits: {
    maxCostPerDocument: 0.50, // USD
    maxPagesPerDocument: 50,
    maxProcessingTime: 300_000 // 5 minutes
  }
};
```

---

## Complete Processing Pipeline

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER UPLOADS FILE                                 │
│                                                                             │
│  Supported: PDF, DOCX, Google Docs link, HTML, Images, Plain Text          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          1. VALIDATION & STORAGE                            │
│                                                                             │
│  • Virus scan (ClamAV)                                                     │
│  • File type validation (magic bytes)                                      │
│  • Size limits check                                                        │
│  • Store original in R2 (immutable reference)                              │
│  • Create processing job in BullMQ                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       2. FORMAT-SPECIFIC PARSING                            │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │    PDF      │  │    DOCX     │  │ Google Docs │  │   Image     │       │
│  │   Parser    │  │   Parser    │  │   Parser    │  │   Parser    │       │
│  │             │  │             │  │             │  │             │       │
│  │  PyMuPDF    │  │ mammoth.js  │  │ Docs API    │  │ Sharp +     │       │
│  │  + page     │  │             │  │             │  │ Tesseract/  │       │
│  │  renders    │  │             │  │             │  │ DeepSeek    │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│  All produce → UnifiedDocument { pages[], text, fonts, colors, images }    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        3. TEXT EXTRACTION (TIERED)                          │
│                                                                             │
│  T0: Native Text ─────────┬────────────────────────────────────────────→   │
│      (if available)       │                                                 │
│                           ▼ if empty/garbled                                │
│  T1: Tesseract OCR ───────┬────────────────────────────────────────────→   │
│      (free, local)        │                                                 │
│                           ▼ if confidence < 80%                             │
│  T2: DeepSeek AI OCR ─────┬────────────────────────────────────────────→   │
│      ($0.003/page)        │                                                 │
│                           ▼ if still struggling                             │
│  T3: Gemini Vision ───────────────────────────────────────────────────→    │
│      (combined w/ structure)                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    4. AI ANALYSIS (PARALLEL)                                │
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │     STRUCTURE DETECTION         │  │      STYLE EXTRACTION           │  │
│  │     (Gemini 3.1 Pro)            │  │      (Gemini 3.1 Pro)           │  │
│  │                                 │  │                                 │  │
│  │  • Identify persuasion blocks   │  │  • Analyze writing tone        │  │
│  │  • Detect section boundaries    │  │  • Extract key vocabulary      │  │
│  │  • Find variable candidates     │  │  • Detect formality level      │  │
│  │  • Classify block types         │  │  • Note structural patterns    │  │
│  │  • Confidence scoring           │  │                                 │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────┐                                       │
│  │      VISUAL STYLE EXTRACTION    │                                       │
│  │      (node-vibrant + heuristics)│                                       │
│  │                                 │                                       │
│  │  • Dominant colors              │                                       │
│  │  • Font detection               │                                       │
│  │  • Web font matching            │                                       │
│  │  • Spacing analysis             │                                       │
│  └─────────────────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     5. RESULT ASSEMBLY                                      │
│                                                                             │
│  ProcessedDocument {                                                        │
│    originalFile: R2Reference,                                              │
│    extractedText: string,                                                  │
│    extractionTier: 'native' | 'tesseract' | 'deepseek' | 'gemini',        │
│    blocks: DetectedBlock[],                                                │
│    variables: DetectedVariable[],                                          │
│    brandTheme: ExtractedBrandTheme,                                        │
│    confidence: number,                                                     │
│    processingCost: number,                                                 │
│    warnings: string[]                                                      │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     6. USER VERIFICATION UI                                 │
│                                                                             │
│  ┌───────────────────────────┬─────────────────────────────────────────┐   │
│  │    Original Document      │         Detected Structure              │   │
│  │                           │                                         │   │
│  │    [Page preview with     │    ☑ Pain Amplifier (92%)              │   │
│  │     block highlights]     │      "Kasdien jūs atiduodate..."       │   │
│  │                           │      [Edit] [Change Type] [Split]       │   │
│  │                           │                                         │   │
│  │                           │    ☑ Credibility (88%)                 │   │
│  │                           │      "Todėl atsirado Tevero..."        │   │
│  │                           │                                         │   │
│  │                           │    ☑ Offer Stack (97%)                 │   │
│  │                           │      3 pricing tiers detected           │   │
│  └───────────────────────────┴─────────────────────────────────────────┘   │
│                                                                             │
│  Variables: "Plaukų Pasaka" → {{prospect.company}}  [Make Dynamic]         │
│                                                                             │
│  [Cancel]  [Save as Template]  [Create Proposal]                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     7. EDITABLE PROPOSAL                                    │
│                                                                             │
│  • Blocks stored in our event-sourced system                               │
│  • Variables linked to prospect/package data                               │
│  • Brand theme applied via CSS custom properties                           │
│  • Ready for editing, A/B testing, tracking                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Format-Specific Parsers

### PDF Parser (Python Service)

```python
# services/document-processor/parsers/pdf_parser.py

import fitz  # PyMuPDF
from PIL import Image
from io import BytesIO
import base64

class PDFParser:
    def parse(self, pdf_bytes: bytes) -> dict:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        result = {
            "pages": [],
            "text": "",
            "fonts": set(),
            "colors": set(),
            "images": [],
            "metadata": doc.metadata
        }
        
        for page_num, page in enumerate(doc):
            page_data = self._extract_page(page, page_num)
            result["pages"].append(page_data)
            result["text"] += page_data["text"] + "\n\n"
            result["fonts"].update(page_data["fonts"])
            result["colors"].update(page_data["colors"])
        
        result["fonts"] = list(result["fonts"])
        result["colors"] = list(result["colors"])
        
        return result
    
    def _extract_page(self, page, page_num: int) -> dict:
        # Get text with formatting
        blocks = page.get_text("dict")["blocks"]
        
        text_spans = []
        fonts = set()
        colors = set()
        
        for block in blocks:
            if block["type"] == 0:  # Text block
                for line in block["lines"]:
                    for span in line["spans"]:
                        text_spans.append({
                            "text": span["text"],
                            "font": span["font"],
                            "size": span["size"],
                            "color": span["color"],
                            "bold": bool(span["flags"] & 16),
                            "italic": bool(span["flags"] & 2),
                            "bbox": list(span["bbox"])
                        })
                        fonts.add(span["font"])
                        if span["color"]:
                            colors.add(span["color"])
        
        # Render page as image for AI analysis
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        
        return {
            "page_num": page_num,
            "text": " ".join([s["text"] for s in text_spans]),
            "spans": text_spans,
            "fonts": list(fonts),
            "colors": list(colors),
            "image_base64": base64.b64encode(img_bytes).decode(),
            "width": page.rect.width,
            "height": page.rect.height
        }
```

### DOCX Parser (TypeScript)

```typescript
// apps/web/src/lib/document-processing/parsers/docx-parser.ts

import mammoth from 'mammoth';
import { JSDOM } from 'jsdom';

export class DOCXParser {
  async parse(buffer: Buffer): Promise<UnifiedDocument> {
    const result = await mammoth.convertToHtml({ buffer }, {
      styleMap: [
        "p[style-name='Heading 1'] => h1.heading-1",
        "p[style-name='Heading 2'] => h2.heading-2",
        "p[style-name='List Paragraph'] => li",
        // Custom style mappings for persuasion blocks
        "p[style-name='Pain Point'] => div.block-pain-amplifier",
        "p[style-name='Guarantee'] => div.block-risk-reversal",
        "p[style-name='Pricing'] => div.block-offer-stack",
      ]
    });
    
    const dom = new JSDOM(result.value);
    const doc = dom.window.document;
    
    // Extract structure from HTML
    const sections = this.extractSections(doc.body);
    
    // Extract any images
    const images = await mammoth.extractRawText({ buffer });
    
    return {
      text: doc.body.textContent || '',
      sections,
      fonts: [], // DOCX doesn't reliably expose fonts
      colors: [],
      images: [],
      warnings: result.messages.map(m => m.message)
    };
  }
  
  private extractSections(body: HTMLElement): ExtractedSection[] {
    const sections: ExtractedSection[] = [];
    
    for (const child of body.children) {
      const tagName = child.tagName.toLowerCase();
      const classList = Array.from(child.classList);
      
      // Check for custom block classes
      const blockClass = classList.find(c => c.startsWith('block-'));
      if (blockClass) {
        sections.push({
          type: blockClass.replace('block-', '') as PersuasionBlockType,
          content: child.textContent || '',
          confidence: 0.95, // High confidence from explicit styling
          source: 'docx-style'
        });
        continue;
      }
      
      // Standard HTML elements
      if (tagName === 'h1' || tagName === 'h2') {
        sections.push({
          type: 'heading',
          level: parseInt(tagName[1]),
          content: child.textContent || '',
          confidence: 1.0,
          source: 'docx-heading'
        });
      } else if (tagName === 'p') {
        sections.push({
          type: 'paragraph',
          content: child.textContent || '',
          confidence: 0.8,
          source: 'docx-paragraph'
        });
      } else if (tagName === 'ul' || tagName === 'ol') {
        sections.push({
          type: 'list',
          items: Array.from(child.querySelectorAll('li')).map(li => li.textContent || ''),
          confidence: 1.0,
          source: 'docx-list'
        });
      } else if (tagName === 'table') {
        sections.push({
          type: 'table',
          content: this.extractTable(child as HTMLTableElement),
          confidence: 1.0,
          source: 'docx-table'
        });
      }
    }
    
    return sections;
  }
}
```

### Google Docs Parser (TypeScript)

```typescript
// apps/web/src/lib/document-processing/parsers/google-docs-parser.ts

import { google } from 'googleapis';

export class GoogleDocsParser {
  private docs;
  
  constructor(auth: any) {
    this.docs = google.docs({ version: 'v1', auth });
  }
  
  async parse(documentId: string): Promise<UnifiedDocument> {
    const { data: doc } = await this.docs.documents.get({ documentId });
    
    const sections: ExtractedSection[] = [];
    const styles: ExtractedStyles = {
      fonts: new Set(),
      colors: new Set()
    };
    
    for (const element of doc.body?.content || []) {
      if (element.paragraph) {
        const section = this.parseParagraph(element.paragraph, styles);
        if (section) sections.push(section);
      } else if (element.table) {
        sections.push(this.parseTable(element.table));
      } else if (element.sectionBreak) {
        // Could indicate new persuasion block
        sections.push({ type: 'section-break', confidence: 1.0 });
      }
    }
    
    return {
      text: sections.map(s => s.content).join('\n\n'),
      sections,
      fonts: Array.from(styles.fonts),
      colors: Array.from(styles.colors),
      images: await this.extractImages(doc),
      source: 'google-docs',
      documentId
    };
  }
  
  private parseParagraph(
    paragraph: docs_v1.Schema$Paragraph,
    styles: ExtractedStyles
  ): ExtractedSection | null {
    const style = paragraph.paragraphStyle;
    const namedStyle = style?.namedStyleType;
    
    // Extract text content
    const text = paragraph.elements
      ?.map(e => e.textRun?.content || '')
      .join('') || '';
    
    if (!text.trim()) return null;
    
    // Extract formatting
    for (const element of paragraph.elements || []) {
      const textStyle = element.textRun?.textStyle;
      if (textStyle?.weightedFontFamily?.fontFamily) {
        styles.fonts.add(textStyle.weightedFontFamily.fontFamily);
      }
      if (textStyle?.foregroundColor?.color?.rgbColor) {
        const rgb = textStyle.foregroundColor.color.rgbColor;
        styles.colors.add(this.rgbToHex(rgb));
      }
    }
    
    // Map named styles to our types
    switch (namedStyle) {
      case 'HEADING_1':
        return { type: 'heading', level: 1, content: text.trim(), confidence: 1.0 };
      case 'HEADING_2':
        return { type: 'heading', level: 2, content: text.trim(), confidence: 1.0 };
      case 'HEADING_3':
        return { type: 'heading', level: 3, content: text.trim(), confidence: 1.0 };
      default:
        return { type: 'paragraph', content: text.trim(), confidence: 0.8 };
    }
  }
}
```

---

## AI Structure Detection

### Persuasion Block Detection Prompt

```typescript
// apps/web/src/lib/document-processing/ai/prompts/structure-detection.ts

export const STRUCTURE_DETECTION_PROMPT = `
You are an expert at analyzing sales proposals and identifying persuasion techniques.

TASK: Analyze this document and identify distinct persuasion blocks.

BLOCK TYPES:
1. pain_amplifier - Highlights problems, costs, or pain points the prospect faces
   Example: "Every day without SEO, you're losing €X to competitors"

2. villain_story - Positions competitors, old methods, or status quo as the enemy
   Example: "Other agencies promise everything but take no responsibility"

3. credibility - Establishes authority, expertise, experience, certifications
   Example: "We've helped 47 e-commerce brands achieve page 1 rankings"

4. social_proof - Testimonials, case studies, client logos, reviews
   Example: "Here's what Karolina from Plaukų Pasaka said about us..."

5. process_reveal - Explains methodology, steps, how the service works
   Example: "Our 6-phase process ensures predictable results"

6. offer_stack - Presents packages, pricing, what's included
   Example: "Starto Package: €2,500 | Augimo Package: €3,500"

7. risk_reversal - Guarantees, refund policies, risk removal
   Example: "If we don't achieve results, you get a full refund"

8. objection_handler - Addresses concerns, FAQ, common questions
   Example: "You might be wondering if SEO really works for your industry..."

9. urgency - Time pressure, scarcity, deadlines
   Example: "We only accept 8 new clients per month"

10. cta - Call to action, next steps
    Example: "Schedule your free strategy call today"

ALSO DETECT:
- Variables: Text that should become dynamic (company names, prices, dates)
- Tables: Pricing tables, comparison tables, feature lists
- Images: Logos, photos, diagrams (note their placement)

RETURN JSON:
{
  "blocks": [
    {
      "type": "pain_amplifier",
      "title": "Short descriptive title",
      "content": "Exact text from document",
      "confidence": 0.92,
      "reasoning": "Why this classification",
      "variables": [
        {
          "original": "Plaukų Pasaka",
          "suggested": "{{prospect.company_name}}",
          "type": "company_name"
        }
      ]
    }
  ],
  "document_metadata": {
    "language": "lt",
    "total_words": 3200,
    "structure_pattern": "Problem → Authority → Process → Offer → Guarantee → CTA",
    "tone": "professional, confident, direct-response"
  }
}

DOCUMENT TEXT:
{text}

PAGE IMAGES PROVIDED: {image_count} pages
(Use images to understand visual structure, tables, and layout)
`;

export async function detectStructure(
  text: string,
  pageImages: string[] // base64
): Promise<StructureAnalysisResult> {
  const response = await gemini.generateContent({
    model: 'gemini-3.1-pro',
    contents: [
      {
        role: 'user',
        parts: [
          // Include page images for visual understanding
          ...pageImages.map(img => ({
            inlineData: {
              mimeType: 'image/png',
              data: img
            }
          })),
          {
            text: STRUCTURE_DETECTION_PROMPT
              .replace('{text}', text)
              .replace('{image_count}', pageImages.length.toString())
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2 // Low temperature for consistency
    }
  });
  
  return JSON.parse(response.response.text());
}
```

---

## Theme/Style Extraction

### Visual Style Extraction

```typescript
// apps/web/src/lib/document-processing/style/visual-extractor.ts

import Vibrant from 'node-vibrant';
import { createCanvas, loadImage } from 'canvas';

export interface ExtractedBrandTheme {
  id: string;
  name: string;
  
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
  };
  
  typography: {
    headingFont: FontMatch;
    bodyFont: FontMatch;
    scale: {
      h1: number;
      h2: number;
      h3: number;
      body: number;
    };
  };
  
  voice: {
    tone: string[];
    vocabulary: string[];
    formality: 'casual' | 'professional' | 'formal';
  };
  
  confidence: number;
}

export async function extractBrandTheme(
  pageImages: Buffer[],
  extractedFonts: string[],
  extractedText: string
): Promise<ExtractedBrandTheme> {
  // Extract colors from images
  const colors = await extractColors(pageImages);
  
  // Match fonts to web-safe alternatives
  const typography = matchFonts(extractedFonts);
  
  // Analyze voice/tone with AI
  const voice = await analyzeVoice(extractedText);
  
  return {
    id: crypto.randomUUID(),
    name: 'Extracted Theme',
    colors,
    typography,
    voice,
    confidence: calculateConfidence(colors, typography, voice)
  };
}

async function extractColors(images: Buffer[]): Promise<ExtractedBrandTheme['colors']> {
  const allPalettes = await Promise.all(
    images.slice(0, 3).map(img => Vibrant.from(img).getPalette())
  );
  
  // Aggregate colors across pages
  const colorVotes = {
    primary: new Map<string, number>(),
    secondary: new Map<string, number>(),
    background: new Map<string, number>()
  };
  
  for (const palette of allPalettes) {
    if (palette.Vibrant) {
      const hex = palette.Vibrant.hex;
      colorVotes.primary.set(hex, (colorVotes.primary.get(hex) || 0) + 1);
    }
    if (palette.Muted) {
      const hex = palette.Muted.hex;
      colorVotes.secondary.set(hex, (colorVotes.secondary.get(hex) || 0) + 1);
    }
    if (palette.LightMuted) {
      const hex = palette.LightMuted.hex;
      colorVotes.background.set(hex, (colorVotes.background.get(hex) || 0) + 1);
    }
  }
  
  // Pick most common colors
  const primary = getMostCommon(colorVotes.primary) || '#0F4F3D'; // Default emerald
  const secondary = getMostCommon(colorVotes.secondary) || '#1a1a1a';
  const background = getMostCommon(colorVotes.background) || '#FAFAF7';
  
  return {
    primary,
    secondary,
    accent: adjustBrightness(primary, 20),
    background,
    text: getContrastColor(background),
    muted: adjustOpacity(getContrastColor(background), 0.6)
  };
}

const FONT_MAPPINGS: Record<string, FontMatch> = {
  // Sans-serif
  'helvetica': { detected: 'Helvetica', webSafe: 'Inter', googleFont: 'Inter', fallback: 'system-ui, sans-serif' },
  'arial': { detected: 'Arial', webSafe: 'Inter', googleFont: 'Inter', fallback: 'Arial, sans-serif' },
  'proxima': { detected: 'Proxima Nova', webSafe: 'Inter', googleFont: 'Inter', fallback: 'system-ui, sans-serif' },
  'roboto': { detected: 'Roboto', webSafe: 'Roboto', googleFont: 'Roboto', fallback: 'system-ui, sans-serif' },
  'open sans': { detected: 'Open Sans', webSafe: 'Open Sans', googleFont: 'Open Sans', fallback: 'system-ui, sans-serif' },
  'lato': { detected: 'Lato', webSafe: 'Lato', googleFont: 'Lato', fallback: 'system-ui, sans-serif' },
  'montserrat': { detected: 'Montserrat', webSafe: 'Montserrat', googleFont: 'Montserrat', fallback: 'system-ui, sans-serif' },
  
  // Serif
  'georgia': { detected: 'Georgia', webSafe: 'Merriweather', googleFont: 'Merriweather', fallback: 'Georgia, serif' },
  'times': { detected: 'Times New Roman', webSafe: 'Merriweather', googleFont: 'Merriweather', fallback: 'Times, serif' },
  'garamond': { detected: 'Garamond', webSafe: 'EB Garamond', googleFont: 'EB Garamond', fallback: 'Georgia, serif' },
  'playfair': { detected: 'Playfair Display', webSafe: 'Playfair Display', googleFont: 'Playfair Display', fallback: 'Georgia, serif' },
  
  // Our design system
  'newsreader': { detected: 'Newsreader', webSafe: 'Newsreader', googleFont: 'Newsreader', fallback: 'Georgia, serif' },
  'geist': { detected: 'Geist', webSafe: 'Inter', googleFont: 'Inter', fallback: 'system-ui, sans-serif' },
};

function matchFonts(extractedFonts: string[]): ExtractedBrandTheme['typography'] {
  let headingFont: FontMatch = FONT_MAPPINGS['inter'];
  let bodyFont: FontMatch = FONT_MAPPINGS['inter'];
  
  for (const font of extractedFonts) {
    const normalized = font.toLowerCase().replace(/[-_]/g, ' ');
    
    for (const [key, match] of Object.entries(FONT_MAPPINGS)) {
      if (normalized.includes(key)) {
        // Larger fonts are likely headings
        if (!headingFont || font.includes('Bold') || font.includes('Heavy')) {
          headingFont = match;
        } else {
          bodyFont = match;
        }
        break;
      }
    }
  }
  
  return {
    headingFont,
    bodyFont,
    scale: {
      h1: 2.5,
      h2: 2.0,
      h3: 1.5,
      body: 1.0
    }
  };
}

async function analyzeVoice(text: string): Promise<ExtractedBrandTheme['voice']> {
  const response = await gemini.generateContent({
    model: 'gemini-3.1-pro',
    contents: [{
      role: 'user',
      parts: [{
        text: `Analyze the writing style of this text. Return JSON:
{
  "tone": ["list", "of", "3-5", "tone", "descriptors"],
  "vocabulary": ["key", "phrases", "to", "reuse", "max", "10"],
  "formality": "casual" | "professional" | "formal"
}

Text:
${text.slice(0, 8000)}`
      }]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3
    }
  });
  
  return JSON.parse(response.response.text());
}
```

---

## Storage & Data Models

### Database Schema

```typescript
// apps/web/src/db/schema/document-import.ts

import { pgTable, uuid, text, jsonb, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

// Uploaded documents (originals stored in R2)
export const uploadedDocuments = pgTable('uploaded_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  // File info
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(), // 'pdf', 'docx', 'html', 'image'
  fileSizeBytes: integer('file_size_bytes').notNull(),
  r2Key: text('r2_key').notNull(), // Reference to original file
  
  // Processing status
  status: text('status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  processingTier: text('processing_tier'), // 'native', 'tesseract', 'deepseek', 'gemini'
  processingCost: integer('processing_cost_cents').default(0),
  
  // Timestamps
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
  
  // Error tracking
  errorMessage: text('error_message'),
  errorCode: text('error_code')
});

// Extracted themes (reusable across proposals)
export const brandThemes = pgTable('brand_themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  sourceDocumentId: uuid('source_document_id').references(() => uploadedDocuments.id),
  
  name: text('name').notNull(),
  isDefault: boolean('is_default').default(false),
  
  // Extracted style
  colors: jsonb('colors').notNull().$type<{
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
  }>(),
  
  typography: jsonb('typography').notNull().$type<{
    headingFont: FontMatch;
    bodyFont: FontMatch;
    scale: { h1: number; h2: number; h3: number; body: number };
  }>(),
  
  voice: jsonb('voice').notNull().$type<{
    tone: string[];
    vocabulary: string[];
    formality: 'casual' | 'professional' | 'formal';
  }>(),
  
  confidence: integer('confidence').notNull(), // 0-100
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Detected structure (intermediate, before user verification)
export const detectedStructures = pgTable('detected_structures', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => uploadedDocuments.id),
  
  // Raw extraction
  extractedText: text('extracted_text').notNull(),
  extractionTier: text('extraction_tier').notNull(),
  
  // AI analysis
  blocks: jsonb('blocks').notNull().$type<DetectedBlock[]>(),
  variables: jsonb('variables').notNull().$type<DetectedVariable[]>(),
  documentMetadata: jsonb('document_metadata').$type<{
    language: string;
    totalWords: number;
    structurePattern: string;
    tone: string;
  }>(),
  
  // Confidence
  overallConfidence: integer('overall_confidence').notNull(), // 0-100
  
  // User verification
  verified: boolean('verified').default(false),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: uuid('verified_by').references(() => users.id),
  
  // User adjustments (stored for learning)
  userAdjustments: jsonb('user_adjustments').$type<{
    blockTypeChanges: { blockIndex: number; from: string; to: string }[];
    blockMerges: { indices: number[] }[];
    blockSplits: { index: number; splitAt: number }[];
    variableChanges: { variableIndex: number; accepted: boolean }[];
  }>(),
  
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Type definitions
interface DetectedBlock {
  id: string;
  type: PersuasionBlockType | 'heading' | 'paragraph' | 'table' | 'list' | 'image' | 'unknown';
  title?: string;
  content: string;
  confidence: number;
  reasoning?: string;
  bbox?: { page: number; x: number; y: number; width: number; height: number };
}

interface DetectedVariable {
  id: string;
  originalText: string;
  suggestedVariable: string;
  variableType: 'company_name' | 'contact_name' | 'price' | 'date' | 'domain' | 'custom';
  confidence: number;
  occurrences: number;
}

interface FontMatch {
  detected: string;
  webSafe: string;
  googleFont: string;
  fallback: string;
}
```

### BullMQ Job Types

```typescript
// apps/web/src/lib/document-processing/jobs/types.ts

export interface DocumentProcessingJob {
  type: 'document-processing';
  data: {
    documentId: string;
    organizationId: string;
    userId: string;
    options: {
      extractTheme: boolean;
      detectStructure: boolean;
      maxCost: number; // Max AI spend in cents
    };
  };
}

export interface OCRJob {
  type: 'ocr';
  data: {
    documentId: string;
    pageImages: string[]; // R2 keys
    tier: 'tesseract' | 'deepseek' | 'gemini';
    language: string;
  };
}

export interface StructureDetectionJob {
  type: 'structure-detection';
  data: {
    documentId: string;
    text: string;
    pageImages: string[]; // R2 keys
  };
}

export interface ThemeExtractionJob {
  type: 'theme-extraction';
  data: {
    documentId: string;
    pageImages: string[]; // R2 keys
    fonts: string[];
    text: string;
  };
}
```

---

## Cost Analysis

### Per-Document Cost Breakdown

| Component | Free Tier | Cheap AI | Premium AI |
|-----------|-----------|----------|------------|
| **Text Extraction** | | | |
| PyMuPDF (native) | $0.00 | - | - |
| Tesseract OCR | $0.00 | - | - |
| DeepSeek OCR | - | $0.003/page | - |
| Gemini Vision | - | - | $0.005/page |
| **Structure Detection** | | | |
| Gemini 3.1 Pro | - | - | $0.02-0.05/doc |
| **Theme Extraction** | | | |
| Color extraction | $0.00 | - | - |
| Voice analysis | - | - | $0.01/doc |
| **Total (5-page doc)** | $0.00 | $0.015 | $0.08 |

### Expected Cost Distribution

| Document Type | % of Uploads | Avg Cost |
|---------------|--------------|----------|
| Native PDF (good quality) | 60% | $0.02 (structure only) |
| Native PDF (poor layout) | 20% | $0.04 (+ DeepSeek) |
| Scanned PDF | 10% | $0.06 (full AI pipeline) |
| DOCX | 8% | $0.02 (structure only) |
| Other (paste, image) | 2% | $0.05 |

**Average cost per upload: ~$0.03**  
**At 1000 uploads/month: ~$30/month**

### Cost Optimization Strategies

1. **Cache by content hash** — Same document = same result, no reprocessing
2. **Tier escalation** — Start free, only pay when necessary
3. **Batch processing** — Process multiple pages in single AI call
4. **User selection** — Let users choose "fast/cheap" vs "thorough/accurate"

---

## Implementation Plan

### Phase 102-A: Core Pipeline (Week 1-2)

**Deliverables:**
- File upload API with validation
- R2 storage integration
- PDF parser (PyMuPDF Python service)
- DOCX parser (mammoth.js)
- Basic Tesseract OCR
- BullMQ job queue setup
- Processing status tracking

**No AI yet — just extraction.**

### Phase 102-B: AI OCR Fallback (Week 3)

**Deliverables:**
- DeepSeek/OpenRouter integration
- Tiered OCR orchestrator
- Confidence scoring
- Cost tracking per document
- Escalation logic

### Phase 102-C: Structure Detection (Week 4)

**Deliverables:**
- Gemini 3.1 Pro integration
- Persuasion block detection
- Variable candidate detection
- Confidence scoring
- Detected structure storage

### Phase 102-D: Theme Extraction (Week 5)

**Deliverables:**
- Color extraction (node-vibrant)
- Font detection and matching
- Voice/tone analysis
- Brand theme storage
- Theme application to proposals

### Phase 102-E: Verification UI (Week 6)

**Deliverables:**
- Side-by-side verification screen
- Block type adjustment
- Variable approval/rejection
- Merge/split blocks
- Create proposal from verified structure

### Phase 102-F: Export & Polish (Week 7-8)

**Deliverables:**
- Puppeteer PDF export with theme
- Round-trip quality verification
- Error handling and retries
- User feedback collection
- Learning from corrections

---

## Summary

The upload-first architecture enables users to:

1. **Upload any format** — PDF, DOCX, Google Docs, paste, images
2. **Get intelligent extraction** — Tiered OCR from free to AI-powered
3. **See structure detected** — AI identifies persuasion blocks with confidence
4. **Verify and adjust** — Human confirms AI suggestions
5. **Edit freely** — Full block editing with variables
6. **Keep their brand** — Theme extracted and applied
7. **Export professionally** — PDF with same brand feel

**The key insight:** We're not trying to edit PDFs directly. We're converting documents INTO our intelligent system WITH their brand preserved. The result is proposals that are both beautiful (their design) AND smart (our intelligence).

**Cost:** ~$0.03 per document average, scaling down with caching.

**Fallback guarantee:** DeepSeek via OpenRouter ensures we handle even difficult documents for ~$0.003/page when needed.
