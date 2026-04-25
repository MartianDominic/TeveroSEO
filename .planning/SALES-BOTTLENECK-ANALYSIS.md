# Sales Bottleneck Analysis & Solution Architecture

> **Generated:** 2026-04-26
> **Context:** 10 Opus subagent deep dive into TeveroSEO codebase
> **Purpose:** Document what exists, what's missing, and how to solve 3 critical sales bottlenecks

---

## Executive Summary

| Bottleneck | Current State | Gap Severity | Est. Fix Time |
|------------|---------------|--------------|---------------|
| **1. Smart Keyword Analysis** | 60% built | HIGH | 2-3 weeks |
| **2. Commercial Proposals** | 85% built | MEDIUM | 1 week |
| **3. Contracts + Payment** | 95% built | LOW | 2-3 days |

**Key Finding:** The platform has more infrastructure than expected. The main gaps are:
1. **AI keyword filtering** - DataForSEO returns 3000 keywords but no relevance filtering
2. **Template variants** - Only 3 templates, need Kern+Boron style variants
3. **Automation activation** - Follow-up automations exist but aren't tested/enabled

---

## Bottleneck 1: Smart Keyword Analysis (RAG/Graphify)

### The Problem (plaukupasaka.lt Example)

User analyzes prospect → gets 3000 keywords → many are:
- Random/irrelevant to actual products
- Multiple keywords mapping to same category page (Kyle Roof violation)
- No way to guide AI ("focus on categories, need 200 keywords")

### What Already Exists

| Component | Location | Status |
|-----------|----------|--------|
| **DataForSEO Integration** | `open-seo-main/src/server/lib/dataforseoProspect.ts` | COMPLETE |
| **Website Scraping** | `open-seo-main/src/server/lib/scraper/multiPageScraper.ts` | COMPLETE |
| **Business Extractor (AI)** | `open-seo-main/src/server/lib/scraper/businessExtractor.ts` | COMPLETE |
| **AI Keyword Generator** | `open-seo-main/src/server/lib/opportunity/keywordGenerator.ts` | COMPLETE |
| **Txtai Embeddings** | `AI-Writer/backend/services/txtai_service.py` | COMPLETE |
| **Voice Profiles (40+ fields)** | `open-seo-main/src/db/voice-schema.ts` | COMPLETE |
| **Keyword Mapping Service** | `open-seo-main/src/server/features/mapping/services/MappingService.ts` | COMPLETE |
| **Relevance Scoring** | `open-seo-main/src/server/features/mapping/services/relevance.ts` | COMPLETE |

### What's Missing

| Gap | Priority | Description |
|-----|----------|-------------|
| **AI Keyword Relevance Filter** | CRITICAL | DataForSEO keywords not filtered against business products/services |
| **1:1 Keyword-Page Enforcement** | HIGH | Multiple keywords can map to same page (violates Kyle Roof) |
| **Page Type Classification** | HIGH | No category vs product vs blog detection |
| **User Guidance Interface** | MEDIUM | No chat/prompt to guide keyword selection |
| **Entity/Product Extraction** | MEDIUM | No structured product catalog from scraped pages |

### Current Flow vs Desired Flow

```
CURRENT:
DataForSEO (3000 kw) → Store All → Show All → Manual filtering

DESIRED:
DataForSEO (3000 kw) → Pre-filter (embeddings) → AI Classify (batch)
                                                        ↓
                    User guides: "focus on categories, 200 keywords"
                                                        ↓
                    1:1 mapping with page type awareness
                                                        ↓
                    Clean, relevant keyword set
```

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: Business Understanding Context                        │
│ - Extract products/services from scraped pages                 │
│ - Build category taxonomy from URL patterns + schema.org       │
│ - Store as BusinessContext per client                          │
│ - Generate embeddings via txtai                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: Embedding Pre-Filter (Fast, Free)                     │
│ - Compare each keyword embedding to business embedding         │
│ - Filter out keywords with similarity < 0.4                    │
│ - Reduces 3000 → ~500-800 candidates                           │
│ - Uses existing txtai service                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: AI Batch Classification (Accurate)                    │
│ - Claude Batch API (50% cheaper than real-time)                │
│ - Classify: RELEVANT | TANGENTIAL | IRRELEVANT | COMPETITOR    │
│ - Cache business context in system prompt (95% token savings)  │
│ - Cost: ~$0.25 per 2000 keywords                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 4: User Guidance (Chat Interface)                        │
│ - Natural language: "focus on categories, 200 keywords"        │
│ - Translates to structured filters                             │
│ - Side panel next to keyword table                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 5: 1:1 Mapping with Cannibalization Prevention           │
│ - Greedy assignment: highest volume keyword gets page first    │
│ - Page type awareness (category pages get category keywords)   │
│ - Conflict detection + resolution UI                           │
└─────────────────────────────────────────────────────────────────┘
```

### Cost Analysis

| Step | Cost per Prospect |
|------|-------------------|
| DataForSEO keywords_for_site | $0.10 |
| Website scraping (4 pages) | $0.08 |
| AI business extraction | $0.005 |
| Embedding pre-filter | $0.00 (local) |
| AI batch classification (Haiku) | $0.25 |
| **Total** | **~$0.45** |

### Implementation Plan

**Phase 1: Business Context (3 days)**
- Add `BusinessContext` to client model
- Extract products/categories from scraped pages
- Store embeddings per client

**Phase 2: Pre-Filter (2 days)**
- Integrate txtai similarity scoring
- Add relevance score to keyword results
- Filter low-relevance keywords

**Phase 3: AI Classification (3 days)**
- Build batch classification service
- Design classification prompt
- Store results in database

**Phase 4: User Guidance (4 days)**
- Build chat sidebar component
- Natural language → filter translation
- Suggestion system

**Phase 5: 1:1 Mapping (3 days)**
- Add page type classification
- Implement greedy assignment
- Build conflict UI

### Key Files to Create/Modify

```
NEW FILES:
- open-seo-main/src/server/features/keywords/services/KeywordRelevanceService.ts
- open-seo-main/src/server/features/keywords/services/BusinessContextService.ts
- apps/web/src/components/keywords/KeywordChatSidebar.tsx

MODIFY:
- open-seo-main/src/server/workers/prospect-analysis-processor.ts (add filter step)
- open-seo-main/src/server/features/mapping/services/MappingService.ts (1:1 enforcement)
- open-seo-main/src/db/prospect-schema.ts (add relevantKeywords field)
```

---

## Bottleneck 2: Commercial Proposals (Komerciniai Pasiulymai)

### The Problem

Need beautiful templates with variants:
- Kern + Boron style (full, visual)
- Specific with keywords (technical focus)
- Slim with keywords (quick quote)

AI should customize per client while keeping consistent language.

### What Already Exists

| Component | Location | Status |
|-----------|----------|--------|
| **Proposal Schema** | `open-seo-main/src/db/proposal-schema.ts` | COMPLETE |
| **3 Templates** | standard, premium, enterprise | COMPLETE |
| **AI Content Gen (Lithuanian)** | `open-seo-main/src/server/lib/proposals/gemini.ts` | COMPLETE |
| **Puppeteer PDF** | `open-seo-main/src/server/services/report/pdf-generator.ts` | COMPLETE |
| **Brand Config** | logoUrl, primaryColor, secondaryColor, fontFamily | COMPLETE |
| **Template Selector UI** | `open-seo-main/src/client/components/proposals/TemplateSelector.tsx` | COMPLETE |
| **Proposal Preview** | `open-seo-main/src/client/components/proposals/ProposalPreview.tsx` | COMPLETE |
| **White-Label Branding** | `open-seo-main/src/db/branding-schema.ts` | COMPLETE |
| **View Tracking** | Duration, sections viewed, ROI calculator usage | COMPLETE |

### What's Missing

| Gap | Priority | Description |
|-----|----------|-------------|
| **Template Variants** | HIGH | Only 3 templates, need Kern+Boron/specific/slim |
| **Proposal PDF Export** | MEDIUM | PDF works for contracts, not proposals |
| **Template File Separation** | MEDIUM | All in one React component |
| **AI Locked Fields** | LOW | Prevent AI from modifying pricing/legal |

### Current Templates vs Desired

```
CURRENT:
- Standard (basic)
- Premium (+ ROI calculator, competitor comparison)
- Enterprise (+ multi-location, custom sections)

DESIRED:
- Full (Kern+Boron) — 8-12 pages, visual, case studies
- Specific — 4-6 pages, keyword tables, technical detail
- Slim — 2-3 pages, executive summary, quick quote
```

### Template System Design

```typescript
interface ProposalTemplate {
  id: 'full' | 'specific' | 'slim';
  name: string;
  sections: TemplateSectionConfig[];
  defaultBranding: BrandConfig;
  aiCustomization: {
    allowedFields: string[];  // AI can modify
    lockedFields: string[];   // AI cannot modify (pricing, legal)
    toneGuidelines: string;
  };
}

interface TemplateSectionConfig {
  id: 'hero' | 'current_state' | 'opportunities' | 'roi' | 'investment' | 'next_steps';
  order: number;
  required: boolean;
  aiPromptTemplate?: string;
}
```

### AI Customization Strategy

```
LAYER 1: Data Injection (no AI)
- Client name, domain, keywords, audit results
- Pricing, legal terms, company info

LAYER 2: AI Personalization (controlled)
- Headlines, subheadlines (can rephrase with constraints)
- Opportunity summaries (max 200 chars)
- Tone matches brand voice profile

LAYER 3: Locked Content (never AI-modified)
- Legal terms
- Pricing table
- Company contact info
```

### Implementation Plan

**Phase 1: Template Files (3 days)**
- Create `templates/full/`, `templates/specific/`, `templates/slim/`
- React components for each variant
- CSS styling per variant

**Phase 2: PDF Export (2 days)**
- Route proposals through existing Puppeteer pipeline
- Add PDF download button to proposal editor

**Phase 3: AI Customization (2 days)**
- Define allowed vs locked fields
- Integrate with existing Gemini service
- Add brand voice constraints

### Key Files to Create/Modify

```
NEW FILES:
- open-seo-main/src/server/features/proposals/templates/full/FullTemplate.tsx
- open-seo-main/src/server/features/proposals/templates/specific/SpecificTemplate.tsx
- open-seo-main/src/server/features/proposals/templates/slim/SlimTemplate.tsx
- open-seo-main/src/server/features/proposals/pdf/proposal-pdf-generator.ts

MODIFY:
- open-seo-main/src/db/proposal-schema.ts (add 'full' | 'specific' | 'slim')
- open-seo-main/src/client/components/proposals/TemplateSelector.tsx (new cards)
```

---

## Bottleneck 3: Contracts + Signature + Payment

### The Problem

Need automated flow: contract → signature → payment → client created

### What Already Exists (95% COMPLETE!)

| Component | Location | Status |
|-----------|----------|--------|
| **Contract PDF Generation** | `open-seo-main/src/server/features/proposals/signing/pdf.ts` | COMPLETE |
| **E-Signature (Dokobit)** | `open-seo-main/src/server/lib/dokobit/client.ts` | COMPLETE |
| **Smart-ID / Mobile-ID** | Baltic eIDAS qualified signatures | COMPLETE |
| **Stripe Checkout** | `open-seo-main/src/server/features/proposals/payment/payment.ts` | COMPLETE |
| **Setup + Monthly Fee** | One-time + recurring in single checkout | COMPLETE |
| **Webhook Handling** | `open-seo-main/src/routes/api/stripe/webhook.ts` | COMPLETE |
| **Auto-Onboarding** | `open-seo-main/src/server/features/proposals/onboarding/onboarding.ts` | COMPLETE |
| **Follow-up Automations** | `open-seo-main/src/server/features/proposals/automation/` | PARTIAL |

### Current Flow (Already Working!)

```
[Proposal Accepted]
       ↓
[Dokobit E-Signature]
  - Smart-ID (app verification)
  - Mobile-ID (SMS verification)
  - 4-digit code displayed
  - User confirms in app
       ↓
[Stripe Checkout]
  - Setup fee (one-time)
  - Monthly fee (recurring)
  - Lithuanian locale
       ↓
[Auto-Onboarding Triggers]
  - Create client from prospect
  - Create project with keywords
  - Send GSC invite email
  - Send kickoff scheduling email (Calendly)
  - Send client welcome email
  - Notify agency (email + Slack)
```

### What's Missing

| Gap | Priority | Description |
|-----|----------|-------------|
| **Automation Testing** | HIGH | Follow-up automations exist but not tested |
| **Pipeline Dashboard** | MEDIUM | No visual view of all proposals by stage |
| **Payment Failure Handling** | MEDIUM | No retry automation for failed payments |
| **Self-Service Entry** | LOW | Currently agent-assisted only |

### Existing Automations (Need Activation)

```typescript
// From automation.ts - THESE EXIST BUT NEED TESTING
const AUTOMATION_RULES = [
  {
    id: 'not_viewed_3d',
    trigger: { status: 'sent', daysWithoutView: 3 },
    action: 'send_reminder_email'
  },
  {
    id: 'viewed_no_action_5d', 
    trigger: { status: 'viewed', daysWithoutAction: 5 },
    action: 'send_followup_email'
  },
  {
    id: 'hot_prospect',
    trigger: { engagementScore: 'hot' },
    action: 'notify_agency'
  }
];
```

### Recommended Automations to Add

```typescript
// NEW AUTOMATIONS
const NEW_RULES = [
  {
    id: 'signed_not_paid_1d',
    trigger: { status: 'signed', daysWithoutPayment: 1 },
    action: 'send_payment_reminder'
  },
  {
    id: 'payment_failed',
    trigger: { stripeEvent: 'payment_intent.payment_failed' },
    action: 'send_retry_notification'
  },
  {
    id: 'proposal_expired',
    trigger: { status: 'sent', daysSinceSent: 30 },
    action: 'archive_with_lost_reason_prompt'
  }
];
```

### Implementation Plan

**Phase 1: Activate & Test (2 days)**
- Enable existing automations
- Test full flow: prospect → proposal → sign → pay → onboard
- Fix any issues found

**Phase 2: Add Missing Automations (1 day)**
- Payment failure handling
- Proposal expiration
- Signed but not paid reminder

**Phase 3: Pipeline Dashboard (3-5 days) [Optional]**
- Visual stage-by-stage view
- Win/loss analytics
- Conversion funnel metrics

### Key Files

```
EXISTING (just need testing):
- open-seo-main/src/server/features/proposals/signing/signing.ts
- open-seo-main/src/server/features/proposals/payment/payment.ts
- open-seo-main/src/server/features/proposals/onboarding/onboarding.ts
- open-seo-main/src/server/features/proposals/automation/automation.ts

MODIFY:
- automation.ts (add new rules)
- Add pipeline dashboard component
```

---

## Scraping Cost Analysis

### Cheapest Approach (Tiered)

| Tier | Method | Cost | Use When |
|------|--------|------|----------|
| **0** | JSON-LD/Schema.org extraction | FREE | 40% of e-commerce sites have it |
| **1** | Native fetch + Cheerio | FREE | Static HTML sites |
| **2** | Sitemap parsing | FREE | Page discovery |
| **3** | Self-hosted Crawl4AI | $0.10-0.50/1000 pages | JS rendering needed |
| **4** | Firecrawl Standard | $0.83/1000 pages | Anti-bot handling |

### Recommendation

```
1. TRY: Schema.org/JSON-LD extraction (FREE, already have code)
2. THEN: Cheerio HTML parsing (FREE, already have code)
3. FALLBACK: DataForSEO On-Page API ($0.02/page, already integrated)
```

### Existing Schema.org Extraction

```typescript
// Already exists in: open-seo-main/src/server/lib/audit/checks/tier1/schema-basics.ts
// Extracts: Product, LocalBusiness, Organization, BreadcrumbList
// Just need to store and use for keyword filtering
```

---

## Priority Implementation Order

### Week 1: Quick Wins (Contracts + Proposals)
1. **Day 1-2**: Test and activate contract/payment automations
2. **Day 3-4**: Add payment failure handling
3. **Day 5**: Create proposal PDF export

### Week 2: Template Variants
1. **Day 1-3**: Build Full/Specific/Slim templates
2. **Day 4-5**: AI customization with locked fields

### Week 3-4: Smart Keywords
1. **Day 1-3**: Business context extraction
2. **Day 4-5**: Embedding pre-filter
3. **Day 6-8**: AI batch classification
4. **Day 9-10**: User guidance chat

### Week 5: 1:1 Mapping
1. **Day 1-2**: Page type classification
2. **Day 3-4**: Greedy assignment
3. **Day 5**: Conflict resolution UI

---

## Summary: What to Build

### Already Have (Just Use It)
- Dokobit e-signature (Smart-ID/Mobile-ID)
- Stripe payments (setup + monthly)
- Auto-onboarding (client + project + emails)
- Proposal generation with AI
- Website scraping + business extraction
- Txtai embeddings
- Relevance scoring

### Need to Build
1. **AI keyword relevance filter** (DataForSEO → filtered set)
2. **1:1 keyword-page mapping** (prevent cannibalization)
3. **User guidance chat** (natural language → filters)
4. **Template variants** (Full/Specific/Slim)
5. **Proposal PDF export**
6. **Activate automations** (test existing code)

### Don't Need
- New e-signature provider (Dokobit is perfect for Baltics)
- New payment provider (Stripe is complete)
- Third-party proposal tools (have better in-house)
- External RAG service (txtai is sufficient)
