# Phase 30: Interactive Proposals with Lithuanian Signing & Payments

## Overview

Transform basic PDF proposals into a world-class interactive experience: AI-generated Lithuanian proposals with scrollytelling presentation, digital signatures via Smart-ID/Mobile-ID, Stripe payments, and auto-onboarding.

**Core Value:** One link → signed paying client (zero manual work)

## The Flow

```
Agency generates proposal
        ↓
Prospect opens /p/{token} (beautiful scrollytelling page)
        ↓
Reviews analysis, uses ROI calculator
        ↓
Clicks "Sutinku" (Accept)
        ↓
Signs with Smart-ID (4-digit code → confirm in app)
        ↓
Pays with Stripe
        ↓
Auto-onboarded as client (GSC invite sent)
```

## Sub-Plans

| Plan | Name | Scope | Depends On |
|------|------|-------|------------|
| 30-01 | Proposal Schema & Builder | DB schema, builder UI, template system | Phase 27 (scraped content) |
| 30-02 | AI Lithuanian Generation | **Gemini 3.1 Pro** integration, brand voice, segment-by-segment generation | 30-01 |
| 30-03 | Interactive Proposal Page | Scrollytelling, ROI calculator, animations, mobile-first | 30-01, 30-02 |
| 30-04 | Engagement Analytics | View tracking, section heatmap, engagement signals | 30-03 |
| 30-05 | E-Signature (Dokobit) | Smart-ID / Mobile-ID integration, PDF generation | 30-03 |
| 30-06 | Payment (Stripe) | Checkout, webhook, receipt, subscription option | 30-05 |
| 30-07 | Auto-Onboarding | Client creation, GSC invite, kickoff scheduler | 30-06 |
| 30-08 | Pipeline & Automation | Follow-up triggers, win/loss tracking, stage management | 30-04, 30-07 |

## Plan Details

### 30-01: Proposal Schema & Builder

**Goal:** Database schema and admin UI for creating/editing proposals

**Deliverables:**
- `proposals` table with content JSONB, pricing, status state machine
- `proposal_views` table for engagement tracking
- `proposal_signatures` table for Dokobit integration
- `proposal_payments` table for Stripe integration
- Builder UI: template selection, pricing config, preview

**Schema Draft:**
```sql
CREATE TABLE proposals (
  id UUID PRIMARY KEY,
  prospect_id UUID REFERENCES prospects(id),
  workspace_id UUID NOT NULL,
  
  template TEXT DEFAULT 'standard',
  content JSONB NOT NULL,           -- AI-generated sections
  brand_config JSONB,               -- Logo, colors, fonts
  
  setup_fee_cents INTEGER,
  monthly_fee_cents INTEGER,
  currency TEXT DEFAULT 'EUR',
  
  status TEXT DEFAULT 'draft',
  -- draft → sent → viewed → accepted → signed → paid → onboarded
  
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  
  sent_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 30-02: AI Lithuanian Generation

**Goal:** Generate proposal content in Lithuanian using Gemini 3.1 Pro

**Why Gemini 3.1 Pro (not Claude):**
- Better Lithuanian language quality
- More natural tone for Baltic market
- Cost-effective for high-volume generation

**Approach:** Segment-by-segment generation for proposals (structured multi-section content needs consistency across sections). Single-shot is fine for article generation.

**Segments:**
1. Hero/Summary (2-3 sentences hook)
2. Current State analysis
3. Opportunities section
4. ROI projection text
5. Investment/Pricing section
6. Next steps

**Brand Voice System:**
```typescript
const LITHUANIAN_BRAND_VOICE = {
  tone: "professional_warm",     // Profesionalus, bet šiltas
  formality: "jus",              // Formal "Jūs" not "tu"
  terminology: {
    SEO: "SEO",                  // Don't translate
    keywords: "raktažodžiai",
    organic_traffic: "organinis srautas",
    conversion_rate: "konversijos rodiklis",
    ROI: "investicijų grąža",
    domain_authority: "domeno autoritetas"
  },
  avoid: [
    "Garantuojame rezultatus",   // Illegal claim
    "Geriausi specialistai",     // Empty phrase
    "Anglų terminai be reikalo"  // Unnecessary English
  ]
};
```

**Per-Agency Customization:**
- Upload 2-3 example proposals to learn tone
- Custom terminology dictionary
- Logo and color scheme

### 30-03: Interactive Proposal Page

**Goal:** Scrollytelling experience at `/p/{token}`

**UX Elements:**
- Full-screen hero with animated traffic value
- Scroll-triggered section reveals
- Numbers count-up animation when visible
- Interactive ROI calculator (prospect inputs their numbers)
- Sticky CTA after viewing pricing
- Mobile-first responsive design
- Progress indicator on side

**Page Sections:**
1. **Hero:** "Jūsų svetainė turi €X/mėn. neišnaudotą potencialą"
2. **Current State:** Traffic, keywords, current value (animated charts)
3. **Opportunities:** Keyword list with difficulty badges
4. **ROI Calculator:** Interactive, adjustable assumptions
5. **Investment:** Pricing table with inclusions
6. **CTA:** "Sutinku su pasiūlymu" button

**Tech Stack:**
- Framer Motion for animations
- Intersection Observer for scroll triggers
- Recharts for animated charts

### 30-04: Engagement Analytics

**Goal:** Track how prospects interact with proposals

**Tracking:**
- Page views (timestamp, duration, device)
- Sections viewed (array of section IDs)
- ROI calculator usage (adjustments made)
- Scroll depth
- Time on pricing section

**Signals:**
```typescript
interface EngagementSignals {
  hot: boolean;           // 3+ views in 24h
  pricing_focused: boolean; // Viewed pricing 3+ times
  calculated_roi: boolean;  // Used ROI calculator
  ready_to_close: boolean;  // Scrolled to CTA multiple times
}
```

**Agency Dashboard:**
```
PASIŪLYMAS: helsinkisaunas.com
────────────────────────────────────────
Būsena: ⏳ Peržiūrėta (laukiama sprendimo)

PERŽIŪROS:
├── Bal. 21, 14:32 — 4 min (📱 mobilus)
│   └── Peržiūrėjo: santrauka, galimybės
├── Bal. 21, 18:45 — 12 min (💻 kompiuteris)
│   └── ROI skaičiuoklę naudojo 3x
└── Bal. 22, 09:12 — 2 min (📱 mobilus)
    └── Tik kainodara

SIGNALAI: 🔥 Aktyvus | 💰 Domisi kaina | 📊 Skaičiavo ROI
```

### 30-05: E-Signature (Dokobit)

**Goal:** Legally binding digital signatures via Smart-ID / Mobile-ID

**Integration:** Dokobit API (Estonian/Lithuanian provider)
- ~€0.20-0.50 per signature
- eIDAS qualified (legally binding in EU)
- Works on mobile and desktop

**Flow:**
1. User clicks "Sutinku"
2. Modal: Choose Smart-ID or Mobile-ID
3. Enter personal code (asmens kodas)
4. Show verification code (e.g., 4721)
5. User confirms in Smart-ID app
6. Signed PDF generated and stored

**Schema Addition:**
```sql
CREATE TABLE proposal_signatures (
  id UUID PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id),
  
  signer_name TEXT NOT NULL,
  signer_personal_code_hash TEXT,   -- Hashed for GDPR
  signing_method TEXT,              -- 'smart_id', 'mobile_id'
  dokobit_session_id TEXT,
  signed_pdf_url TEXT,              -- R2 storage
  
  signed_at TIMESTAMPTZ
);
```

### 30-06: Payment (Stripe)

**Goal:** Collect setup fee immediately after signing

**Integration:** Stripe Checkout
- Setup fee: One-time payment
- Monthly fee: Optional subscription
- Currency: EUR

**Flow:**
1. Signature confirmed → redirect to Stripe Checkout
2. Prefilled with customer email, proposal amount
3. Payment success → webhook updates proposal status
4. Receipt sent automatically

**Schema Addition:**
```sql
CREATE TABLE proposal_payments (
  id UUID PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id),
  
  provider TEXT DEFAULT 'stripe',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,      -- For recurring
  
  amount_cents INTEGER,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'pending',    -- pending, completed, failed
  
  paid_at TIMESTAMPTZ
);
```

### 30-07: Auto-Onboarding

**Goal:** Zero manual work from "yes" to active client

**Automated Steps:**
1. Create client record (from prospect data)
2. Create project (with opportunity keywords from Phase 29)
3. Mark prospect as "converted" (link to client)
4. Send GSC connection invite email
5. Schedule kickoff call (Calendly embed or API)
6. Notify agency: "🎉 Naujas klientas: domain.com"

**State Transitions:**
```
Proposal paid → triggers:
  ├── clients.insert(from_prospect)
  ├── prospects.update(status: 'converted', converted_client_id)
  ├── projects.insert(client_id, opportunity_keywords)
  ├── email.send(gsc_invite_template)
  └── notifications.send(agency_new_client)
```

### 30-08: Pipeline & Automation

**Goal:** Manage all proposals in pipeline view with smart follow-ups

**Pipeline Stages:**
```
New → Analyzed → Proposal Sent → Viewed → Accepted → Signed → Paid → Onboarded
  ↓       ↓           ↓           ↓         ↓         ↓       ↓
Lost   Lost       Lost        Lost      Lost      Lost   Won
```

**Automation Triggers:**
| Trigger | Action |
|---------|--------|
| Proposal not viewed in 3 days | Auto-reminder email |
| Viewed 3+ times, no action in 5 days | "Ar turite klausimų?" email |
| Proposal accepted | Signing instructions email |
| Proposal signed | Payment reminder if not paid in 1 day |
| Payment confirmed | Welcome + onboarding email |

**Analytics Dashboard:**
```
PARDAVIMŲ STATISTIKA (Balandis 2026)

Pipeline vertė       │████████████████░░░░│ €28,400/mėn.
Išsiųsti pasiūlymai  │ 24
Peržiūrėjimo rodiklis│ 88% (21/24)
Laimėjimo rodiklis   │ 67% (8/12 uždaryta)
Vid. uždarymo laikas │ 9 dienos
Vid. sandorio dydis  │ €2,400/mėn.
```

## Technical Notes

### Gemini 3.1 Pro Integration

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function generateProposalSegment(
  segment: 'hero' | 'current_state' | 'opportunities' | 'roi' | 'investment' | 'next_steps',
  data: ProspectAnalysis,
  brandVoice: BrandVoiceConfig
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  
  const prompt = buildSegmentPrompt(segment, data, brandVoice);
  const result = await model.generateContent(prompt);
  
  return result.response.text();
}

// Generate all segments sequentially (Gemini output limits)
async function generateFullProposal(
  data: ProspectAnalysis,
  brandVoice: BrandVoiceConfig
): Promise<ProposalContent> {
  const segments = ['hero', 'current_state', 'opportunities', 'roi', 'investment', 'next_steps'];
  const content: Record<string, string> = {};
  
  for (const segment of segments) {
    content[segment] = await generateProposalSegment(segment, data, brandVoice);
  }
  
  return content;
}
```

### Dokobit API (Smart-ID / Mobile-ID)

```typescript
// https://developers.dokobit.com/
const DOKOBIT_BASE = "https://api.dokobit.com/signing/v2";

interface SmartIdSession {
  sessionId: string;
  verificationCode: string;
}

async function initiateSmartIdSigning(
  personalCode: string,
  documentHash: string
): Promise<SmartIdSession> {
  const response = await fetch(`${DOKOBIT_BASE}/smartid/sign`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.DOKOBIT_ACCESS_TOKEN}` },
    body: JSON.stringify({
      pno: `LT-${personalCode}`,
      hash: documentHash,
      hashType: "SHA256"
    })
  });
  
  return response.json();
}

async function pollSigningStatus(sessionId: string): Promise<SigningResult> {
  // Poll every 2 seconds until signed or timeout
}
```

## Estimated Timeline

| Week | Plans | Focus |
|------|-------|-------|
| 1 | 30-01, 30-02 | Schema, AI generation |
| 2 | 30-03 | Interactive proposal page (core UX) |
| 3 | 30-04, 30-05 | Engagement tracking, Dokobit signing |
| 4 | 30-06, 30-07, 30-08 | Stripe, onboarding, pipeline |

**Total: 4 weeks for full implementation**

## Dependencies

- **Phase 27:** Scraped content (products, brands, services)
- **Phase 28:** Keyword gap analysis (competitor keywords)
- **Phase 29:** AI opportunity discovery (suggested keywords)
- **Dokobit account:** For Smart-ID/Mobile-ID integration
- **Stripe account:** Already in use (user confirmed)
- **Google Cloud:** For Gemini 3.1 Pro API
