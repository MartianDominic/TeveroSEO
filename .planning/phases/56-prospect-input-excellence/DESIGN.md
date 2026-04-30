# Phase 56: Prospect Input Excellence

**Goal:** Make the core value proposition real — "paste anything, get brilliant insights"

**Depends on:** Phase 55 (i18n complete)

**Estimated effort:** 40-50 hours

---

## Problem Statement

The prospect creation and analysis flow has critical gaps:

1. **Add Prospect button is DISABLED** — cannot create prospects at all
2. **Only website URL input works** — no conversation dump mode
3. **No confirmation flow** — AI extractions cannot be verified/corrected
4. **Notes field ignored** — user context not used by AI
5. **No progress feedback** — users don't know what's happening during analysis

The "paste a sales call transcript and get keyword insights" value prop is completely unrealized.

---

## User Journey (Target State)

```
Agency User adds prospect:
1. Click "Add Prospect" → Modal opens
2. Choose input mode:
   a) Website URL only
   b) Website URL + context notes
   c) Conversation/transcript only (paste text)
3. Enter data based on mode
4. Click "Analyze"
5. See real-time progress: "Crawling site... Extracting business info... Analyzing keywords..."
6. **Confirmation screen:** "Here's what I understood about this business"
   - Business name, industry, services, target audience
   - Key topics/themes extracted
   - Suggested keywords
   - Edit any field before proceeding
7. Click "Confirm & Continue" or "Re-analyze"
8. Analysis runs with confirmed context
9. Results appear in prospect detail
```

---

## Input Modes

### Mode 1: Website URL Only
- Enter domain (e.g., `example.com`)
- System crawls: robots.txt → sitemap.xml → homepage → business pages
- AI extracts: business name, industry, services, contact info
- Presents confirmation before keyword analysis

### Mode 2: Website URL + Context
- Enter domain + free-text notes
- Notes contain: prospect goals, pain points, conversation context
- AI uses BOTH scraped content AND notes for extraction
- Higher quality extraction due to user-provided context

### Mode 3: Conversation Dump Only (No Website)
- Paste sales call transcript, email thread, or notes
- AI extracts:
  - Business name and type
  - Industry/vertical
  - Services they offer
  - Target audience
  - Goals and pain points
  - Suggested keywords
- **Must have confirmation flow** — user verifies extraction accuracy
- Optional: add website URL later for deeper analysis

---

## Confirmation Flow (Critical)

After initial extraction, ALWAYS show:

```
┌─────────────────────────────────────────────────────────┐
│ Here's what I understood about this prospect            │
├─────────────────────────────────────────────────────────┤
│ Business Name:    [Acme Consulting      ] [Edit]        │
│ Industry:         [Business Consulting  ▾]              │
│ Services:         [Strategy, Operations, HR] [Edit]     │
│ Target Audience:  [SMBs in manufacturing] [Edit]        │
│ Key Topics:       [lean manufacturing, efficiency] [+]  │
│ Suggested Keywords:                                     │
│   ☑ business consulting services                        │
│   ☑ manufacturing consultant                            │
│   ☐ hr consulting (remove?)                             │
│   [+ Add keyword]                                       │
├─────────────────────────────────────────────────────────┤
│ [Re-analyze with corrections]  [Confirm & Continue →]   │
└─────────────────────────────────────────────────────────┘
```

User can:
- Edit any extracted field inline
- Remove incorrect keywords
- Add missing keywords
- Re-run extraction with corrections
- Confirm and proceed to full analysis

---

## Site Crawling Improvements

### Layered Discovery (Priority Order)
1. Check `robots.txt` for sitemap location
2. Try `/sitemap.xml`, `/sitemap_index.xml`
3. Parse sitemap for key pages (about, services, products, contact)
4. Scrape homepage
5. Scrape 3-5 business-critical pages
6. Rate limit: 1 req/second, max 10 pages

### Platform Detection (Already Exists)
- WordPress: wp-json, wp-content patterns
- Shopify: cdn.shopify.com, myshopify.com
- Wix: wixstatic.com, parastorage.com
- Squarespace: squarespace.com patterns
- Webflow: webflow.io patterns

### Progress Feedback
- SSE (Server-Sent Events) or polling for real-time updates
- Stages: Connecting → Crawling → Extracting → Analyzing → Complete
- Show current page being crawled
- Estimated time remaining

---

## Technical Implementation

### Schema Changes

```typescript
// Extend prospects table
prospects.inputMode: text("input_mode"), // 'website' | 'website_with_context' | 'conversation'
prospects.rawInput: text("raw_input"), // Original conversation/notes text
prospects.extractedData: jsonb("extracted_data"), // AI extraction before confirmation
prospects.confirmedData: jsonb("confirmed_data"), // User-verified extraction
prospects.confirmationStatus: text("confirmation_status"), // 'pending' | 'confirmed' | 'skipped'
```

### New Components

```
apps/web/src/components/prospects/
├── AddProspectModal.tsx        # Main modal with mode selector
├── WebsiteInputForm.tsx        # Mode 1: URL only
├── WebsiteContextForm.tsx      # Mode 2: URL + notes
├── ConversationInputForm.tsx   # Mode 3: Paste text
├── AnalysisProgress.tsx        # Real-time progress display
├── ExtractionConfirmation.tsx  # Confirmation/edit screen
└── KeywordSelector.tsx         # Checkbox keyword list
```

### New Services

```
open-seo-main/src/server/features/prospects/services/
├── ConversationExtractor.ts    # AI extraction from text
├── ExtractionConfirmationService.ts  # Manage confirmation flow
└── ProgressBroadcaster.ts      # SSE progress updates
```

### API Endpoints

```
POST /api/prospects/create          # Create with input mode
POST /api/prospects/:id/extract     # Run AI extraction
GET  /api/prospects/:id/extraction  # Get extraction for confirmation
PUT  /api/prospects/:id/confirm     # Confirm/edit extraction
GET  /api/prospects/:id/progress    # SSE progress stream
POST /api/prospects/:id/analyze     # Run full analysis with confirmed data
```

---

## UI Components (v6 Design System)

### Add Prospect Modal
- Use `Dialog` from @tevero/ui
- Tab selector for input modes (SegmentedControl pattern)
- Clean form with proper spacing (--space-4, --space-6)
- Primary action button: "Analyze" (--accent background)

### Progress Display
- Vertical stepper with stages
- Current stage highlighted with --accent
- Spinner on active stage
- Checkmarks on completed stages
- Time elapsed / estimated

### Confirmation Screen
- Card-based layout (ghost-edge shadows per v6)
- Inline editable fields (contentEditable or controlled inputs)
- Keyword list with checkboxes
- Two-button footer: secondary "Re-analyze", primary "Confirm"

---

## Success Criteria

1. Add Prospect button is ENABLED and functional
2. All 3 input modes work correctly
3. Conversation dump extracts: business name, industry, services, keywords
4. Confirmation screen shows before analysis proceeds
5. User can edit any extracted field
6. User can add/remove keywords
7. Re-analyze uses corrected data
8. Progress feedback shows real-time stages
9. Full analysis uses confirmed context

---

## Plans

| Plan | Focus | Wave |
|------|-------|------|
| 56-01 | Schema + Add Prospect Modal + Website Input | 1 |
| 56-02 | Conversation Extractor + AI Integration | 1 |
| 56-03 | Confirmation Flow UI + Edit Capabilities | 2 |
| 56-04 | Progress Feedback (SSE) + Polish | 2 |

---

## Out of Scope

- Manual competitor input (defer to later phase)
- Advanced scraping retry logic
- Multiple contacts per prospect
- CRM features (using GHL)
