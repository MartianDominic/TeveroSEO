# Research 03: Proposal Generation System

> **Agent:** 3 of 20 (Stream A: Keywords to Proposal)  
> **Status:** Complete  
> **Date:** 2026-05-11  
> **Source Files:**
> - `.planning/keyword-intelligence/PROPOSAL-XML-PROMPTS.md`
> - `.planning/keyword-intelligence/WORLD-CLASS-ARCHITECTURE.md`

---

## Executive Summary

The TeveroSEO proposal generation system uses a sophisticated copywriting framework stack (Schwartz + Halbert + Kennedy + Ogilvy + Cialdini) to create AI-powered SEO proposals in Lithuanian. The system classifies prospect awareness, generates curiosity-driven pre-sale hooks, calculates multi-scenario ROI projections, and produces legally-compliant service agreements.

---

## 1. Awareness Classification System

### How It Works

The `prospect-awareness-classifier.xml` prompt uses Eugene Schwartz's 5-level awareness framework to determine prospect readiness and select the optimal hook strategy.

```
                    PROSPECT AWARENESS CLASSIFICATION
    
    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │   INPUT SIGNALS                                                 │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  - Domain scrape summary                                │   │
    │   │  - Initial inquiry text                                 │   │
    │   │  - Lead source (cold/warm/inbound)                      │   │
    │   │  - Conversation history/notes                           │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                              │                                  │
    │                              ▼                                  │
    │   CLASSIFICATION RULES (priority order)                         │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  1. Explicit proposal request → MOST-AWARE              │   │
    │   │  2. Competitor/pricing mentions → PRODUCT-AWARE         │   │
    │   │  3. SEO/optimization mentions → SOLUTION-AWARE          │   │
    │   │  4. Traffic/ranking problems → PROBLEM-AWARE            │   │
    │   │  5. Cold lead, no SEO signals → UNAWARE                 │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                              │                                  │
    │                              ▼                                  │
    │   OUTPUT                                                        │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  {                                                      │   │
    │   │    "awareness_level": "problem-aware",                  │   │
    │   │    "confidence": 0.85,                                  │   │
    │   │    "signals_detected": ["traffic concerns", "no SEO"],  │   │
    │   │    "hook_strategy": "Present SEO as THE solution",      │   │
    │   │    "recommended_approach": {                            │   │
    │   │      "opening_angle": "Jūsų konkurentai gauna X...",    │   │
    │   │      "primary_cialdini": "social_proof",                │   │
    │   │      "objections_to_address": ["cost", "timeline"]      │   │
    │   │    }                                                    │   │
    │   │  }                                                      │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
```

### Awareness Levels Detail

| Level | Prospect State | Signal Detection (Lithuanian) | Hook Strategy |
|-------|----------------|------------------------------|---------------|
| **UNAWARE** | Doesn't know they have a problem | Cold response, no SEO mention, "kas tai?" | Problem agitation first |
| **PROBLEM-AWARE** | Knows traffic/rankings poor | "mazu lankytoju", "nerandame Google" | Present SEO as THE solution |
| **SOLUTION-AWARE** | Knows SEO exists, comparing | "norime optimizuoti", talked to agencies | Differentiate methodology |
| **PRODUCT-AWARE** | Knows your offer | Reviewed website, price questions | Remove objections, build trust |
| **MOST-AWARE** | Ready to buy | Asked for proposal, timeline questions | Clear CTA, reduce friction |

### Output Schema

```typescript
interface AwarenessClassification {
  awareness_level: 'unaware' | 'problem-aware' | 'solution-aware' | 'product-aware' | 'most-aware';
  confidence: number; // 0.0-1.0
  signals_detected: string[];
  hook_strategy: string;
  recommended_approach: {
    opening_angle: string;
    primary_cialdini: 'authority' | 'social_proof' | 'scarcity' | 'reciprocity' | 'liking' | 'commitment';
    objections_to_address: string[];
  };
  reasoning: string;
}
```

---

## 2. Pre-Sale Hooks with Halbert Fascinations

### How Pre-Sale Hooks Create Curiosity

The `presale-hook-generator.xml` prompt generates 1-page curiosity reports using Gary Halbert's fascination formulas. The key constraint: **show WHAT, tease HOW, hide SPECIFICS**.

```
                    PRE-SALE HOOK GENERATION FLOW
    
    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │   INPUTS                                                        │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  - Company name + domain                                │   │
    │   │  - Awareness level (from classifier)                    │   │
    │   │  - Total keywords found                                 │   │
    │   │  - Quick wins count                                     │   │
    │   │  - Monthly traffic opportunity                          │   │
    │   │  - Estimated revenue opportunity                        │   │
    │   │  - Top competitor + their traffic                       │   │
    │   │  - Biggest gap category                                 │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                              │                                  │
    │                              ▼                                  │
    │   HALBERT FASCINATION FORMULAS                                  │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  1. "The secret of [desirable outcome]..."              │   │
    │   │  2. "Why [common belief] is costing you [loss]..."      │   │
    │   │  3. "How to [achieve goal] without [painful process]..."│   │
    │   │  4. "What [competitor] knows that you don't..."         │   │
    │   │  5. "[Specific number] ways your [asset] is [problem]..."│  │
    │   │  6. "The #1 mistake [persona] make with [topic]..."     │   │
    │   │  7. "How we helped [similar company] achieve [result]..."│  │
    │   └─────────────────────────────────────────────────────────┘   │
    │                              │                                  │
    │                              ▼                                  │
    │   CRITICAL CONSTRAINTS                                          │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  NEVER reveal:                                          │   │
    │   │  - Full keyword list                                    │   │
    │   │  - Exact page mappings                                  │   │
    │   │  - Actionable strategy                                  │   │
    │   │                                                         │   │
    │   │  ALWAYS show:                                           │   │
    │   │  - Specific numbers (€47,000 not "significant revenue") │   │
    │   │  - Open loops (unresolved tension)                      │   │
    │   │  - Competitor comparisons                               │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
```

### Awareness-Specific Headlines

| Awareness | Headline Template (Lithuanian) |
|-----------|-------------------------------|
| **UNAWARE** | "Kodel {{TOP_COMPETITOR}} gauna {{COMPETITOR_TRAFFIC}} lankytoju per menesi, o jus - ne?" |
| **PROBLEM-AWARE** | "{{COMPANY_NAME}}: {{TRAFFIC_OPPORTUNITY}} potencialiu lankytoju laukia" |
| **SOLUTION-AWARE** | "{{COMPANY_NAME}} SEO Galimybiu Ataskaita" |

### Fascination Examples

```
Lithuanian Fascinations (with formula ID):

[5] {{QUICK_WINS}} puslapiai, kurie siandien yra 11-30 pozicijoje ir 
    galetu buti TOP 3 per 90 dienu...

[2] Kodel jusu "{{BIGGEST_GAP}}" kategorija neturi ne vieno Google 
    rezultato - nors paiesku paklausa yra 2,400/men...

[4] Kas {{TOP_COMPETITOR}} daro skirtingai, kad jie uzima 73% jusu 
    tiksliniu raktazodziu...

[7] Kaip panasus verslas per 6 menesius padidino organinius lankytojus 
    340% (ir tiksliai kokiu metodu)...

[1] Vienas techninis pakeitimas, kuris galetu atrakinti 
    {{TRAFFIC_OPPORTUNITY}} lankytoju be naujo turinio...
```

### Pre-Sale Hook Output Schema

```typescript
interface PresaleHook {
  headline: string;
  subheadline: string;
  fascinations: Array<{
    text: string;
    formula_used: '1' | '2' | '3' | '4' | '5' | '6' | '7';
  }>;
  stats: Array<{
    number: string;
    label: string;
  }>;
  closing_paragraph: string;
  cta: {
    main: string;
    scarcity: string; // e.g., "Sia savaite turime 3 laisvas konsultacijas"
  };
}
```

---

## 3. ROI Projections Calculation

### Three-Scenario Methodology

The `proposal-roi-projections.xml` prompt generates credible projections with confidence intervals to avoid overpromising while remaining compelling.

```
                    ROI PROJECTION METHODOLOGY
    
    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │   INPUTS                                                        │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  Current State:                                         │   │
    │   │  - Monthly organic traffic                              │   │
    │   │  - Average ranking position                             │   │
    │   │                                                         │   │
    │   │  Opportunity:                                           │   │
    │   │  - Quick wins count + traffic potential                 │   │
    │   │  - Gap keywords traffic potential                       │   │
    │   │                                                         │   │
    │   │  Business Metrics:                                      │   │
    │   │  - Conversion rate (%)                                  │   │
    │   │  - Average order value (EUR)                            │   │
    │   │  - Customer lifetime value (optional)                   │   │
    │   │                                                         │   │
    │   │  Timeline: months                                       │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                              │                                  │
    │                              ▼                                  │
    │   CTR CURVES (Industry Standard)                                │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  Position 1:  28.5%  │  Position 6:   5.1%              │   │
    │   │  Position 2:  15.7%  │  Position 7:   4.0%              │   │
    │   │  Position 3:  11.0%  │  Position 8:   3.2%              │   │
    │   │  Position 4:   8.0%  │  Position 9:   2.8%              │   │
    │   │  Position 5:   7.2%  │  Position 10:  2.5%              │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                              │                                  │
    │                              ▼                                  │
    │   THREE SCENARIO DEFINITIONS                                    │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │                                                         │   │
    │   │  CONSERVATIVE (50% targets achieved)                    │   │
    │   │  - Quick win capture: 50%                               │   │
    │   │  - Gap capture: 30%                                     │   │
    │   │  - Position improvement: +5 avg                         │   │
    │   │                                                         │   │
    │   │  EXPECTED (Based on similar client results)             │   │
    │   │  - Quick win capture: 75%                               │   │
    │   │  - Gap capture: 50%                                     │   │
    │   │  - Position improvement: +10 avg                        │   │
    │   │                                                         │   │
    │   │  OPTIMISTIC (All initiatives succeed)                   │   │
    │   │  - Quick win capture: 90%                               │   │
    │   │  - Gap capture: 70%                                     │   │
    │   │  - Position improvement: +15 avg                        │   │
    │   │                                                         │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
```

### ROI Calculation Formula

```
Traffic Projection:
  new_traffic = current_traffic 
              + (quick_win_potential * capture_rate)
              + (gap_keywords_traffic * gap_capture_rate)
              + CTR_improvement_from_position_gains

Revenue Projection:
  monthly_revenue = new_traffic * conversion_rate * average_order_value
  annual_revenue = monthly_revenue * 12

ROI Calculation:
  ROI% = ((annual_revenue - total_investment) / total_investment) * 100
  payback_months = total_investment / monthly_revenue
```

### ROI Output Schema

```typescript
interface ROIProjections {
  roi_projections: {
    monthly_traffic: {
      current: number;
      month_3: { conservative: number; expected: number; optimistic: number };
      month_6: { conservative: number; expected: number; optimistic: number };
      month_12: { conservative: number; expected: number; optimistic: number };
    };
    annual_revenue: {
      conservative: number;
      expected: number;
      optimistic: number;
    };
    assumptions: {
      conversion_rate: number;
      aov: number;
      ctr_model: 'industry standard';
    };
    roi: {
      investment: number;
      conservative_roi_percent: number;
      expected_roi_percent: number;
      payback_months: number;
    };
  };
}
```

---

## 4. Full Proposal Structure

### Complete Proposal Flow

```
                    FULL PROPOSAL GENERATION PIPELINE
    
    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │   STEP 1: CLASSIFY AWARENESS                                    │
    │   prospect-awareness-classifier.xml                             │
    │   ─────────────────────────────                                 │
    │   Input: Domain, inquiry, lead source, conversation             │
    │   Output: awareness_level, hook_strategy, cialdini_principle    │
    │                              │                                  │
    │                              ▼                                  │
    │   STEP 2: GENERATE EXECUTIVE SUMMARY                            │
    │   proposal-executive-summary.xml (Ogilvy Authority)             │
    │   ─────────────────────────────────────────────────             │
    │   Sections:                                                     │
    │   - Hook (1-2 sentences, opportunity + specific number)         │
    │   - Situation (2-3 sentences, current state factually)          │
    │   - Opportunity (3-4 sentences, what analysis revealed)         │
    │   - Approach (bullet points, proposed actions)                  │
    │   - Outcome (bullet points, expected results)                   │
    │                              │                                  │
    │                              ▼                                  │
    │   STEP 3: COMPETITOR ANALYSIS                                   │
    │   proposal-competitor-analysis.xml (Blair Enns Positioning)     │
    │   ─────────────────────────────────────────────────────────     │
    │   Sections:                                                     │
    │   - Landscape Overview (comparison table)                       │
    │   - Keyword Gap Opportunity ("unclaimed territory")             │
    │   - Content Gap Opportunity (content types analysis)            │
    │   - Competitive Advantage Potential (differentiation)           │
    │                              │                                  │
    │                              ▼                                  │
    │   STEP 4: ROI PROJECTIONS                                       │
    │   proposal-roi-projections.xml                                  │
    │   ───────────────────────────                                   │
    │   Sections:                                                     │
    │   - Traffic projection table (month 3/6/12 by scenario)         │
    │   - Revenue projection table (with assumptions callout)         │
    │   - ROI calculation (investment, %, payback period)             │
    │                              │                                  │
    │                              ▼                                  │
    │   STEP 5: INVESTMENT SECTION                                    │
    │   proposal-investment-section.xml (Kennedy Direct Response)     │
    │   ───────────────────────────────────────────────────────       │
    │   Sections:                                                     │
    │   - Value Stack (deliverables with "retail" values)             │
    │   - Price Justification (vs in-house, inaction, PPC)            │
    │   - Risk Reversal (performance guarantee)                       │
    │   - Urgency (legitimate only: capacity, seasonal)               │
    │   - Payment Options (monthly recommended, upfront discount)     │
    │   - CTA (single clear action)                                   │
    │                              │                                  │
    │                              ▼                                  │
    │   OUTPUT: GeneratedProposal                                     │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
```

### Copywriting Framework Integration

| Section | Framework | Key Principles |
|---------|-----------|----------------|
| **Executive Summary** | Ogilvy Long-Copy | Headline is 80%, specificity sells, benefit-first, proof-proof-proof |
| **Competitor Analysis** | Blair Enns Positioning | Position don't attack, expertise frames conversation, client decides |
| **ROI Projections** | Data Analyst | Always show ranges, explain assumptions, use industry benchmarks |
| **Investment** | Kennedy Direct Response | Price justification, risk reversal, legitimate urgency, stack the deck |

### Full Proposal Output Schema

```typescript
interface GeneratedProposal {
  type: 'presale_hook' | 'full_proposal';
  awarenessLevel: AwarenessLevel;
  sections: {
    executiveSummary: {
      hook: string;           // 1-2 sentences
      situation: string;      // 2-3 sentences
      opportunity: string;    // 3-4 sentences
      approach: string;       // bullet points
      outcome: string;        // bullet points
      word_count: number;     // 250-350 target
    };
    competitorAnalysis: {
      landscape_overview: {
        narrative: string;
        comparison_table: CompetitorRow[];
      };
      keyword_gaps: {
        narrative: string;
        total_keywords: number;
        total_volume: number;
        top_gaps: KeywordGap[];
      };
      content_gaps: {
        narrative: string;
        gaps: ContentGap[];
      };
      competitive_advantages: {
        narrative: string;
        advantages: Advantage[];
      };
    };
    roiProjections: ROIProjections;
    investment: {
      value_stack: {
        deliverables: Deliverable[];
        total_value: number;  // 3-5x actual price
      };
      price_justification: {
        inhouse_comparison: string;
        inaction_cost: string;
        ppc_comparison: string;
      };
      guarantee: {
        statement: string;
        fine_print: string;
      };
      urgency: {
        statement: string;
        type: 'capacity' | 'seasonal' | 'none';
      };
      payment_options: PaymentOption[];
      cta: {
        primary_action: string;
        primary_button: string;
        secondary_action: string;
      };
    };
  };
  metadata: {
    generatedAt: Date;
    version: string;
    estimatedReadTime: number;
  };
}
```

---

## 5. Lithuanian Legal Agreement Generation

### Agreement Structure

The `agreement-generator.xml` prompt produces legally-compliant service agreements following Lithuanian Civil Code requirements.

```
                    AGREEMENT GENERATION FLOW
    
    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │   INPUTS                                                        │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  Provider Data:                                         │   │
    │   │  - Company name, code, VAT code                         │   │
    │   │  - Address                                              │   │
    │   │  - Representative name + title                          │   │
    │   │                                                         │   │
    │   │  Client Data:                                           │   │
    │   │  - Company name, code, VAT code                         │   │
    │   │  - Address                                              │   │
    │   │  - Representative name + title                          │   │
    │   │                                                         │   │
    │   │  Terms:                                                 │   │
    │   │  - Services array                                       │   │
    │   │  - Setup fee, monthly fee                               │   │
    │   │  - Contract months, payment terms                       │   │
    │   │  - Deliverables, KPIs (optional)                        │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                              │                                  │
    │                              ▼                                  │
    │   LEGAL CONSTRAINTS                                             │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  - Must follow Lithuanian Civil Code                    │   │
    │   │  - AES (qualified electronic) signatures valid for B2B  │   │
    │   │  - IP transfer requires explicit clause                 │   │
    │   │  - DPA annex required for GDPR compliance               │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                              │                                  │
    │                              ▼                                  │
    │   CONTRACT SECTIONS                                             │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  1. SUTARTIES DALYKAS (Subject)                         │   │
    │   │  2. KAINA IR ATSISKAITYMO TVARKA (Price & Payment)      │   │
    │   │  3. SALIU TEISES IR PAREIGOS (Rights & Obligations)     │   │
    │   │  4. INTELEKTINE NUOSAVYBE (Intellectual Property)       │   │
    │   │  5. KONFIDENCIALUMAS (Confidentiality)                  │   │
    │   │  6. SUTARTIES NUTRAUKIMAS (Termination)                 │   │
    │   │  7. ATSAKOMYBE (Liability)                              │   │
    │   │  8. BAIGIAMOSIOS NUOSTATOS (Final Provisions)           │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                              │                                  │
    │                              ▼                                  │
    │   APPENDICES                                                    │
    │   ┌─────────────────────────────────────────────────────────┐   │
    │   │  Priedas 1: PASLAUGU APRASYMAS                          │   │
    │   │  - Services table (service, description, timeline)      │   │
    │   │  - Deliverables table (result, frequency, format)       │   │
    │   │  - KPIs table (if performance targets specified)        │   │
    │   │                                                         │   │
    │   │  Priedas 2: DUOMENU TVARKYMO SUTARTIS (DPA)             │   │
    │   │  - Data controller: Client                              │   │
    │   │  - Data processor: Provider                             │   │
    │   │  - Processed data: site analytics, visitor behavior     │   │
    │   │  - Purpose: SEO service delivery                        │   │
    │   │  - Retention: Contract duration + 1 year                │   │
    │   │  - Technical measures: encryption, access control       │   │
    │   └─────────────────────────────────────────────────────────┘   │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
```

### Key Contract Clauses (Lithuanian)

| Section | Key Provisions |
|---------|----------------|
| **Payment** | Setup fee due within 7 days; monthly fee by day X; 0.02%/day late penalty |
| **Provider Obligations** | Professional service delivery, monthly reports by 5th, issue notification, confidentiality |
| **Client Obligations** | Admin access, GSC/GA access, timely responses, timely payment |
| **IP Transfer** | Content becomes client property ONLY after full payment |
| **Termination** | 30-day written notice for material breach; 14-day cure period |
| **Liability Cap** | Provider liability limited to fees paid |
| **Disclaimer** | No guarantee of specific positions (Google algorithm changes) |
| **Jurisdiction** | Lithuanian law; Vilnius court for disputes >EUR7000 |

### Agreement Output Schema

```typescript
interface GeneratedAgreement {
  agreement: {
    document_type: 'sutartis';
    version: string;
    generated_date: string; // ISO date
    sections: Array<{
      number: string;
      title: string;
      content: string; // filled template
    }>;
    appendices: Array<{
      number: string;
      title: string;
      content: string | StructuredContent;
    }>;
    signatures: {
      provider: {
        company: string;
        representative: string;
        title: string;
      };
      client: {
        company: string;
        representative: string;
        title: string;
      };
    };
  };
}
```

---

## 6. Implementation Code

### ProposalGenerator Class

```typescript
// proposal-generator.ts

import { LLMClient } from '@tevero/ai';

interface ProposalGeneratorConfig {
  prompts: {
    awarenessClassifier: string;
    presaleHook: string;
    executiveSummary: string;
    investmentSection: string;
    roiProjections: string;
    competitorAnalysis: string;
    agreementGenerator: string;
  };
  defaults: {
    language: 'lt' | 'en';
    currency: 'EUR' | 'USD';
    conversionRate: number;    // Default: 0.02 (2%)
    averageOrderValue: number; // Default: 50 EUR
  };
}

interface ProposalContext {
  prospect: {
    company_name: string;
    domain: string;
    industry: string;
    inquiry_text: string;
    lead_source: string;
    conversation_notes?: string;
  };
  analysis: {
    total_keywords: number;
    quick_wins_count: number;
    monthly_traffic_opportunity: number;
    estimated_revenue_opportunity: number;
    current_traffic: number;
    domain_authority: number;
    indexed_pages: number;
    ranking_keywords: number;
    critical_issues_count: number;
  };
  competitors: Array<{
    domain: string;
    monthly_traffic: number;
    domain_authority: number;
    top10_keywords: number;
  }>;
  agency: {
    company_name: string;
    company_code: string;
    vat_code: string;
    address: string;
    representative: string;
    representative_title: string;
    phone: string;
  };
}

export class ProposalGenerator {
  private llm: LLMClient;
  private config: ProposalGeneratorConfig;

  constructor(llm: LLMClient, config: ProposalGeneratorConfig) {
    this.llm = llm;
    this.config = config;
  }

  /**
   * Step 1: Classify prospect awareness level
   */
  async classifyAwareness(prospect: ProposalContext['prospect']): Promise<AwarenessClassification> {
    const prompt = this.loadPrompt('awarenessClassifier');
    const filled = this.fillTemplate(prompt, {
      DOMAIN: prospect.domain,
      SCRAPE_SUMMARY: '', // From scraper
      INQUIRY_TEXT: prospect.inquiry_text,
      LEAD_SOURCE: prospect.lead_source,
      CONVERSATION_NOTES: prospect.conversation_notes || '',
    });

    const result = await this.llm.generate(filled, { format: 'json' });
    return JSON.parse(result) as AwarenessClassification;
  }

  /**
   * Step 2: Generate pre-sale curiosity hook
   */
  async generatePresaleHook(
    context: ProposalContext,
    awareness: AwarenessClassification
  ): Promise<PresaleHook> {
    const prompt = this.loadPrompt('presaleHook');
    const topCompetitor = context.competitors[0];

    const filled = this.fillTemplate(prompt, {
      COMPANY_NAME: context.prospect.company_name,
      DOMAIN: context.prospect.domain,
      AWARENESS_LEVEL: awareness.awareness_level,
      TOTAL_KEYWORDS: context.analysis.total_keywords,
      QUICK_WINS: context.analysis.quick_wins_count,
      TRAFFIC_OPPORTUNITY: context.analysis.monthly_traffic_opportunity,
      REVENUE_OPPORTUNITY: context.analysis.estimated_revenue_opportunity,
      TOP_COMPETITOR: topCompetitor?.domain || 'Konkurentas',
      COMPETITOR_TRAFFIC: topCompetitor?.monthly_traffic || 0,
      BIGGEST_GAP: 'pagrindine kategorija', // From gap analysis
    });

    const result = await this.llm.generate(filled, { format: 'json' });
    return JSON.parse(result) as PresaleHook;
  }

  /**
   * Step 3: Generate full proposal with all sections
   */
  async generateFullProposal(context: ProposalContext): Promise<GeneratedProposal> {
    // Run awareness classification first
    const awareness = await this.classifyAwareness(context.prospect);

    // Generate all sections in parallel
    const [
      executiveSummary,
      competitorAnalysis,
      roiProjections,
      investment,
    ] = await Promise.all([
      this.generateExecutiveSummary(context, awareness),
      this.generateCompetitorAnalysis(context),
      this.generateROIProjections(context),
      this.generateInvestmentSection(context),
    ]);

    return {
      type: 'full_proposal',
      awarenessLevel: awareness.awareness_level,
      sections: {
        executiveSummary,
        competitorAnalysis,
        roiProjections,
        investment,
      },
      metadata: {
        generatedAt: new Date(),
        version: '1.0',
        estimatedReadTime: this.calculateReadTime(executiveSummary),
      },
    };
  }

  /**
   * Step 4: Generate legal agreement
   */
  async generateAgreement(
    proposal: GeneratedProposal,
    client: ClientData,
    pricing: PricingConfig
  ): Promise<GeneratedAgreement> {
    const prompt = this.loadPrompt('agreementGenerator');
    const filled = this.fillTemplate(prompt, {
      PROVIDER_COMPANY: this.config.agency.company_name,
      PROVIDER_CODE: this.config.agency.company_code,
      PROVIDER_VAT: this.config.agency.vat_code,
      PROVIDER_ADDRESS: this.config.agency.address,
      PROVIDER_REP: this.config.agency.representative,
      PROVIDER_REP_TITLE: this.config.agency.representative_title,
      CLIENT_COMPANY: client.company_name,
      CLIENT_CODE: client.company_code,
      CLIENT_VAT: client.vat_code,
      CLIENT_ADDRESS: client.address,
      CLIENT_REP: client.representative,
      CLIENT_REP_TITLE: client.representative_title,
      SERVICES_JSON: JSON.stringify(pricing.services),
      SETUP_FEE: pricing.setup_fee,
      MONTHLY_FEE: pricing.monthly_fee,
      CONTRACT_MONTHS: pricing.contract_months,
      PAYMENT_DAYS: pricing.payment_terms_days,
      DELIVERABLES_JSON: JSON.stringify(pricing.deliverables),
      KPIS_JSON: JSON.stringify(pricing.kpis || []),
    });

    const result = await this.llm.generate(filled, { format: 'json' });
    return JSON.parse(result) as GeneratedAgreement;
  }

  // Helper methods
  private loadPrompt(name: keyof ProposalGeneratorConfig['prompts']): string {
    // Load XML prompt from file system or embedded
    return this.config.prompts[name];
  }

  private fillTemplate(template: string, values: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => 
      values[key]?.toString() ?? ''
    );
  }

  private calculateReadTime(summary: ExecutiveSummary): number {
    const words = summary.word_count || 300;
    return Math.ceil(words / 200); // 200 words per minute
  }
}
```

### API Endpoint

```typescript
// /api/proposals/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ProposalGenerator } from '@/lib/proposal-generator';
import { getLLMClient } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const { prospect, analysis, competitors, type } = await req.json();

  const generator = new ProposalGenerator(
    getLLMClient('gemini-3.1-pro'), // Primary content model
    getProposalConfig()
  );

  const context: ProposalContext = {
    prospect,
    analysis,
    competitors,
    agency: getAgencyDefaults(),
  };

  if (type === 'presale') {
    const awareness = await generator.classifyAwareness(prospect);
    const hook = await generator.generatePresaleHook(context, awareness);
    return NextResponse.json({ hook, awareness });
  }

  if (type === 'full') {
    const proposal = await generator.generateFullProposal(context);
    return NextResponse.json({ proposal });
  }

  if (type === 'agreement') {
    const { client, pricing, proposal } = await req.json();
    const agreement = await generator.generateAgreement(proposal, client, pricing);
    return NextResponse.json({ agreement });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
```

---

## 7. Quality Checklist

| Check | Criteria | Implementation |
|-------|----------|----------------|
| Lithuanian grammar | Native speaker review | Post-generation review queue |
| Legal compliance | Lawyer review for agreement | Template pre-approved by legal |
| Tone consistency | Ogilvy/Kennedy blend | Prompt constraints + examples |
| Number accuracy | All placeholders render | Template validation pre-generation |
| Fascination quality | Halbert formula adherence | Formula ID tracking in output |
| ROI credibility | Conservative defaults | 50% capture rate for conservative |
| CTA clarity | Single clear action | One primary CTA per section |

---

## 8. Summary

| Component | Copywriting Framework | Model | Lithuanian Adaptation |
|-----------|----------------------|-------|----------------------|
| Awareness Classifier | Schwartz 5 levels | Grok 4.1 | Business inquiry patterns |
| Pre-Sale Hook | Halbert fascinations | Gemini 3.1 Pro | Lithuanian curiosity phrasing |
| Executive Summary | Ogilvy authority | Gemini 3.1 Pro | Formal "jus" throughout |
| Competitor Analysis | Blair Enns positioning | Gemini 3.1 Pro | Non-aggressive tone |
| ROI Projections | Data analyst precision | Grok 4.1 | EUR formatting, 3 scenarios |
| Investment Section | Kennedy direct response | Gemini 3.1 Pro | Lithuanian pricing norms |
| Agreement Generator | Legal template | Gemini 3.1 Pro | Lithuanian Civil Code |

---

## 9. Integration Points

| Upstream | This System | Downstream |
|----------|-------------|------------|
| Keyword Intelligence (Research-02) | Proposal Generation | Client Onboarding (Research-04) |
| Scraping Infrastructure (Research-01) | XML Prompts | Content Calendar (Research-05) |
| DataForSEO Keyword Data | ROI Calculations | Agreement Signing Flow |
| Competitor Analysis | Competitor Narrative | CRM Pipeline Update |

---

## 10. Open Questions for Implementation

1. **Proposal versioning:** How do we track proposal revisions and A/B test different approaches?
2. **Multi-language:** Should we support English proposals for international prospects?
3. **Template customization:** Can agencies customize prompt templates per vertical?
4. **Agreement e-signing:** Integration with Dokobit or similar Lithuanian e-signature provider?
5. **Proposal analytics:** Track which fascinations/CTAs convert best?

---

*Research complete. Ready for implementation planning.*
