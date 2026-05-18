# Phase 102: Blocking Decision Analysis

> **Purpose:** World-class ultrathink on the core architectural decision blocking Phase 102 — how to create editable, visually-designed proposals without burning AI credits or losing human work.

**Created:** 2026-05-15
**Status:** Decision Required Before Implementation

---

## Table of Contents

1. [The Core Problem](#the-core-problem)
2. [Current State Inventory](#current-state-inventory)
3. [The Three Pathways](#the-three-pathways)
4. [The Bottleneck Analysis](#the-bottleneck-analysis)
5. [Input Sources Matrix](#input-sources-matrix)
6. [Ten Expert Perspectives](#ten-expert-perspectives)
7. [Synthesis & Recommendation](#synthesis--recommendation)

---

## The Core Problem

### The Duality

Tevero operates in two modes simultaneously:
1. **As an SEO Agency** — Creating and sending proposals to close Lithuanian/EU clients
2. **As a SaaS Platform** — Enabling other agencies to create and send proposals

This duality creates tension: the agency needs **design polish** (landing-page quality proposals that close €3,500+ deals), while the SaaS needs **editability** (non-technical agency users must customize without coding).

### The Bottleneck

The user articulated the exact bottleneck:

> "That's where it bottlenecks in my mind on editability — how do we go about it if it's an app type thing? Do we have to convert it to HTML first? But then it risks burning lots of AI credits / removing the work others have done when trying to edit one small detail due to AI constraints."

**Translation:** If proposals look like designed landing pages (the 3000-word Lithuanian copy with pricing cards, icons, feature lists), how do users:
1. Edit a single word without regenerating the whole thing?
2. Preserve visual design while allowing text changes?
3. Not burn $5 in AI credits to fix a typo?

---

## Current State Inventory

### What Exists (Phase 57+)

| Component | Location | Capability |
|-----------|----------|------------|
| **TipTap Editor** | `ProposalInlineEditor.tsx` | Rich text editing with variables, formatting, links |
| **Variable Extension** | `extensions/VariableExtension.tsx` | `{{variable}}` chips that resolve at render |
| **Section Drag-Drop** | `SectionList.tsx` + `SortableSection.tsx` | @dnd-kit reordering of sections |
| **Section Order Persistence** | `useSectionOrder.ts` | Debounced save with optimistic updates |
| **Version History** | `VersionHistory.tsx` | List view + restore (NO diff view) |
| **Template System** | `TemplateSelector.tsx` | Pre-built templates with sections |
| **Variable Palette** | `VariablePalette.tsx` | Drag-to-insert variables |
| **AI Generation** | `AIGenerationModal.tsx` | Gemini-powered content generation |
| **Proposal Preview** | `ProposalPreview.tsx` | Read-only rendered view |

### What Exists (Design System v6)

| Token | Value | Purpose |
|-------|-------|---------|
| **Fonts** | Newsreader (serif display) + Geist (UI) + Geist Mono | Premium typography |
| **Colors** | Emerald accent (#0F4F3D), warm canvas (#FAFAF7) | Calm, premium feel |
| **Shadows** | Ghost-edge layered shadows | Glass card effect |
| **Spacing** | Fluid via `clamp()` | Responsive without breakpoints |
| **Cards** | No borders, shadow lift on hover | Stripe/Linear quality |

### What's Missing (Phase 102 Gaps)

| Gap | Impact |
|-----|--------|
| **Persuasion block types** | Can't tag blocks as "Pain Amplifier" vs "Risk Reversal" |
| **Block-level A/B testing** | Can't test which guarantee copy converts better |
| **Section heatmaps** | Can't see which blocks prospects read |
| **Side-by-side diff** | Can't compare versions visually |
| **PDF import** | Can't extract style from designed PDFs |
| **Landing-page rendering** | Proposals render as "document" not "landing page" |

---

## The Three Pathways

The user identified three distinct proposal creation flows:

### Pathway 1: Full Analysis → Proposal

```
Domain Entry → Scrape → Keyword Intelligence → Gap Analysis
     ↓
SEO Chat Analysis → Package Recommendation
     ↓
AI Proposal Generation (personalized narrative)
     ↓
Prospect Signs → Agreement → Payment
```

**Characteristics:**
- Data-rich (SEO metrics, competitor gaps, keyword opportunities)
- Highly personalized (prospect's domain, industry, pain points)
- Maximum conversion potential
- Requires ~$0.17 in data costs before proposal

### Pathway 2: Keywords-First (Prospect Provides)

```
Prospect Provides Keywords → We Validate/Expand
     ↓
Feasibility Analysis (can we rank these?)
     ↓
Scoped Proposal (guarantee X keywords to page 1)
     ↓
Agreement → Payment
```

**Characteristics:**
- Lower data cost (no full scrape needed)
- Prospect has buying intent (they know what they want)
- Risk: Prospect keywords may be unrealistic
- Variation: We add complementary keywords they missed

### Pathway 3: General Proposal (No Analysis)

```
Sales Conversation → Qualification
     ↓
Generic Package Selection (Starto/Augimo/Premium)
     ↓
Send Standard Proposal (the 3000-word Lithuanian copy)
     ↓
Agreement → Payment
```

**Characteristics:**
- Zero data cost
- Fastest to send
- Relies on copy quality + trust built in conversation
- The "landing page" style proposal
- Currently: Copy-paste from Google Doc

---

## The Bottleneck Analysis

### The Fundamental Tension

```
┌─────────────────────────────────────────────────────────────┐
│                    DESIGN QUALITY                           │
│                                                             │
│   Landing Page Style          vs          App Editor Style  │
│   ─────────────────                       ─────────────────  │
│   • Pricing cards with icons             • TipTap rich text │
│   • Feature bullet lists                 • Drag-drop blocks │
│   • Visual hierarchy                     • Variable chips   │
│   • Designed in Figma/code              • WYSIWYG          │
│   • Exported as PDF/HTML                 • Live preview     │
│                                                             │
│   Problem: Not editable                  Problem: Looks     │
│   without re-coding                      like a "document"  │
│                                          not a sales page   │
└─────────────────────────────────────────────────────────────┘
```

### Why This Is Hard

**Option A: Design in Code (Next.js), Export PDF**
- ✅ Beautiful landing-page quality
- ✅ Can be dynamic (variables work)
- ❌ Editing requires code changes
- ❌ Non-technical users can't customize
- ❌ Every client variation = engineering time

**Option B: Build in Editor (TipTap), Render as Document**
- ✅ Fully editable by non-technical users
- ✅ Variables, sections, drag-drop work
- ❌ Looks like a "proposal document" not a "sales page"
- ❌ Can't achieve pricing-card-with-icons layouts
- ❌ Limited visual design vocabulary

**Option C: AI Regeneration Each Time**
- ✅ Can produce any format
- ❌ Burns AI credits on every edit
- ❌ May lose human refinements
- ❌ Inconsistent output
- ❌ Slow iteration cycle

### The Real Question

> "How do we get landing-page design quality with document-editor editability?"

---

## Input Sources Matrix

| Source | Content | Style | Editability | AI Cost |
|--------|---------|-------|-------------|---------|
| **Blank Canvas** | User creates | User defines | Full | Generation only |
| **Paste from Google Doc** | Imported text | Needs styling | Full after import | Structure detection |
| **Template (Built-in)** | Pre-filled | Pre-styled | Full | Variable filling |
| **Template (From Paste)** | Extracted structure | Extracted style | Full | Initial analysis |
| **PDF Upload** | Cannot extract | Style reference only | None (reference) | Style extraction |
| **Clone Existing** | Copied | Copied | Full | None |
| **AI Full Generation** | Generated | Generated | Full | High |

### The PDF Problem (Deeper)

PDFs are mentioned as a potential input. The user suggested:
> "We could design it in some other tool and import it as PDF with the design — eg make NextJS project and then just export as PDF"

**Why this doesn't work for editing:**
1. PDF → Text extraction is lossy (tables, columns, styling lost)
2. PDF visual layout ≠ semantic structure (a 3-column pricing table is just positioned text)
3. Re-editing the PDF source (Next.js code) defeats the purpose
4. PDFs are OUTPUT formats, not SOURCE formats

**What PDFs CAN do:**
- Serve as style references (AI extracts tone, vocabulary, visual patterns)
- Provide inspiration for template design
- Be the final export format (not the editing format)

---

## Ten Expert Perspectives

### Expert 1: The Red Team Skeptic

```xml
<expert role="red-team-skeptic" mindset="adversarial">
  <challenge>
    The entire Phase 102 premise may be flawed. You're trying to build a 
    "persuasion-aware visual document builder" but the real closing happens 
    in the CONVERSATION, not the document.
    
    Your €3,500 Plaukų Pasaka deal closed because Karolina trusted Dominic 
    on the call, not because the proposal had the right "Pain Amplifier" blocks.
    
    The proposal is POST-DECISION confirmation, not PRE-DECISION persuasion.
  </challenge>
  
  <counterargument>
    If true, then Phase 102 should focus on:
    1. Speed (send proposal in 30 seconds after call)
    2. Professionalism (looks legitimate, not sketchy)
    3. Memory aid (prospect can review details later)
    
    NOT on:
    - A/B testing block variants
    - Persuasion framework compliance
    - Complex visual builders
  </counterargument>
  
  <recommendation>
    Kill the complexity. The "3000-word Lithuanian copy" already works.
    Make it a TEMPLATE with VARIABLES, not a BUILDER with BLOCKS.
    
    Pathway 3 (General Proposal) should be the DEFAULT, not the fallback.
    Pathways 1 and 2 add data APPENDICES to the same core proposal.
  </recommendation>
</expert>
```

### Expert 2: The Funnel Builder Veteran (Russell Brunson School)

```xml
<expert role="funnel-veteran" mindset="conversion-obsessed">
  <insight>
    The Lithuanian proposal IS a Russell Brunson Perfect Webinar.
    I analyzed it:
    
    1. Pain Amplifier: "Kasdien jūs atiduodate pinigus konkurentams"
    2. Villain Story: "Agentūros žada daug, bet retai prisiima atsakomybę"
    3. Credibility: "Todėl atsirado Tevero"
    4. Process Reveal: "6 etapai, per kuriuos vedame kiekvieną projektą"
    5. Offer Stack: Three tiers with struck-through prices
    6. Risk Reversal: "Nepasiekiame rezultato? Grąžiname visus pinigus"
    7. Urgency: "Priimame tik 8 naujus projektus per mėnesį"
    8. CTA: "Atsiųskite svetainės adresą"
    
    This is a LANDING PAGE, not a document.
  </insight>
  
  <recommendation>
    Build it as a LANDING PAGE in the app. The "editor" is really:
    
    1. Block selector (pick which persuasion elements to include)
    2. Content fill (text within each block)
    3. Variable injection ({{prospect.company}}, {{package.price}})
    4. Style application (design system v6 components)
    
    Each block is a REACT COMPONENT, not a TipTap section.
    Editing is FORM FIELDS feeding into components, not WYSIWYG.
    
    The preview IS the proposal. Export as PDF for sending.
  </recommendation>
  
  <architecture>
    ProposalPage = Stack of PersuasionBlockComponents
    
    <PainAmplifierBlock>
      props: { headline, bodyText, statistics }
      renders: Designed card with icon, text, optional chart
    </PainAmplifierBlock>
    
    <OfferStackBlock>
      props: { tiers: [{name, price, features, cta}] }
      renders: Pricing cards with design system styling
    </OfferStackBlock>
    
    Editing = Form panel on left, Preview on right
    No TipTap. No WYSIWYG. Form → Component → Preview.
  </architecture>
</expert>
```

### Expert 3: The SaaS Scalability Architect

```xml
<expert role="saas-architect" mindset="scale-first">
  <concern>
    You're building for Tevero-the-agency but selling to agencies-as-customers.
    These have DIFFERENT needs:
    
    Tevero-as-agency:
    - One brand voice (Lithuanian direct-response)
    - One design system (v6)
    - Small team (knows the tools intimately)
    - Can afford complexity
    
    Agencies-as-customers:
    - Many brand voices (each of THEIR clients)
    - Many design preferences
    - Varying technical skill
    - Need simplicity + customization
  </concern>
  
  <recommendation>
    Two-tier architecture:
    
    TIER 1: Template Library (for SaaS customers)
    - Pre-built, tested proposal templates
    - Fill-in-the-blank simplicity
    - Variables auto-populated from prospect data
    - Limited customization (choose sections, edit text)
    - Fast: 5 minutes to send
    
    TIER 2: Template Builder (for power users / Tevero)
    - Full block builder with persuasion types
    - Custom component creation
    - A/B testing capabilities
    - Analytics dashboards
    - Requires training
    
    Most agencies use Tier 1. Tevero uses Tier 2.
    Tier 2 creates templates that flow down to Tier 1.
  </recommendation>
  
  <economics>
    Tier 1 retention: Simple → Sticky
    Tier 2 value: Power → Premium pricing
    
    Don't build Tier 2 features that confuse Tier 1 users.
    The UI should MODE-SWITCH based on user tier.
  </economics>
</expert>
```

### Expert 4: The AI Cost Economist

```xml
<expert role="ai-economist" mindset="token-paranoid">
  <analysis>
    Current AI costs in proposal pipeline:
    
    Pathway 1 (Full Analysis):
    - Domain scrape: ~$0.05 (Scrapling + proxy)
    - Keyword intelligence: ~$0.04 (Grok classification)
    - Proposal generation: ~$0.08 (Gemini narrative)
    - Total: ~$0.17 per prospect
    
    With Phase 102 as currently spec'd:
    - Structure detection on paste: ~$0.02
    - Per-block generation: ~$0.01 × 8 blocks = $0.08
    - Style extraction from PDF: ~$0.03
    - Variable filling: ~$0.01
    - A/B variant generation: ~$0.02 per variant
    
    Danger: Every "Generate" button click = cost
  </analysis>
  
  <recommendation>
    CACHE AGGRESSIVELY:
    
    1. Template text is STATIC — never regenerate
    2. Variable filling is DETERMINISTIC — no AI needed
    3. Structure detection happens ONCE on import
    4. Block content is SAVED — edits are local, not regenerated
    
    AI should be:
    - OPTIONAL (user clicks "Help me write this")
    - INCREMENTAL (generate THIS block, not whole proposal)
    - CACHED (same input = same output, use hash key)
    
    The "Fixed/Variable/Regenerate" content modes from the architecture
    doc are correct. Enforce them strictly.
    
    NEVER auto-regenerate on edit. User must explicitly request AI.
  </recommendation>
  
  <metric>
    Target: <$0.05 AI cost per proposal sent
    Current risk: $0.20+ if regeneration is liberal
    
    Gate: Show AI cost estimate before any generation action
  </metric>
</expert>
```

### Expert 5: The UX Minimalist (Linear/Superhuman School)

```xml
<expert role="ux-minimalist" mindset="ruthless-simplicity">
  <critique>
    The Phase 102 spec has 8 requirements. That's 7 too many for MVP.
    
    The ONLY requirement that matters:
    "Can recreate the 3000-word Lithuanian SEO proposal"
    
    Everything else is optimization that can come later:
    - A/B testing: Post-MVP
    - Heatmaps: Post-MVP  
    - Framework compliance: Post-MVP
    - PDF import: Post-MVP
    - Diff view: Post-MVP
  </critique>
  
  <mvp-definition>
    MVP = Create + Edit + Send + Track Opens
    
    1. Create: Choose template OR blank
    2. Edit: Change text in blocks (simple forms, not WYSIWYG)
    3. Send: Generate magic link
    4. Track: Know when they opened it
    
    That's it. Four features.
  </mvp-definition>
  
  <ui-principle>
    Linear doesn't show you options until you need them.
    Superhuman hides complexity behind keyboard shortcuts.
    
    The proposal builder should:
    - Default view: Preview only (read mode)
    - Click to edit: Form appears for that block
    - Escape to close: Back to preview
    - Cmd+S to save: Instant feedback
    
    No sidebar of block types. No drag handles visible at rest.
    No "builder" feeling. Just: Here's your proposal. Click to change.
  </ui-principle>
</expert>
```

### Expert 6: The Lithuanian Market Specialist

```xml
<expert role="market-specialist" mindset="cultural-context">
  <insight>
    Lithuanian B2B buyers are SKEPTICAL by default.
    The proposal copy works because it:
    
    1. Acknowledges skepticism: "Jei dabar galvojate, kad tai tuščias pažadas"
    2. Explains WHY guarantee is real: "Mūsų garantija mus pačius priverčia"
    3. Uses concrete numbers: "47 e-commerce brands", "96.55%"
    4. Addresses objections preemptively: "Trys logiški klausimai"
    5. Shows process transparency: All 6 phases explained
    
    This is NOT American "hype" copy. This is "prove it" copy.
  </insight>
  
  <warning>
    Don't let Phase 102 "framework" this into something generic.
    The power is in the SPECIFIC Lithuanian voice.
    
    If agencies using the SaaS are American, their templates
    should be DIFFERENT. Not localized — DIFFERENT structure.
    
    Russell Brunson works in USA. In Lithuania, it needs
    more proof, more transparency, more "why should I trust you."
  </warning>
  
  <recommendation>
    Template library should be MARKET-SPECIFIC:
    - Lithuanian agency template (current copy style)
    - American agency template (more aspirational)
    - UK agency template (more formal)
    
    The persuasion BLOCKS are universal.
    The persuasion TONE is cultural.
    
    AI generation must know the target market.
  </recommendation>
</expert>
```

### Expert 7: The Document Engineering Purist

```xml
<expert role="doc-engineer" mindset="structured-content">
  <observation>
    The problem isn't "landing page vs document."
    The problem is CONFLATING content and presentation.
    
    Content: What the proposal SAYS
    - Headlines, body text, prices, features
    - This is DATA
    
    Presentation: How the proposal LOOKS
    - Cards, columns, icons, spacing
    - This is RENDERING
    
    Current TipTap approach: Content and presentation mixed
    - Bold text = presentation decision stored in content
    - Drag order = presentation logic in content structure
    
    Proper approach: Separate content from presentation
    - Content = JSON (structured data)
    - Presentation = React components (rendering logic)
    - Variables = pointers to external data
  </observation>
  
  <architecture>
    ProposalContent = {
      blocks: [
        {
          type: "pain_amplifier",
          content: {
            headline: "Kasdien jūs atiduodate pinigus",
            body: "Pagalvokite apie tai...",
            statistic: { value: 96.55, unit: "%" }
          }
        },
        {
          type: "offer_stack",
          content: {
            tiers: [
              { name: "Starto", price: 2500, features: [...] },
              { name: "Augimo", price: 3500, features: [...] }
            ]
          }
        }
      ]
    }
    
    ProposalRenderer = (content, theme) => JSX
    
    Editing = Form that modifies content JSON
    Preview = Renderer applied to content JSON
    Export = Renderer output to PDF
  </architecture>
  
  <benefit>
    - Edit headline? Change one JSON field. No AI.
    - Change design? New theme. Same content.
    - A/B test? Two content variants, same renderer.
    - Analytics? Track by block type, not DOM position.
  </benefit>
</expert>
```

### Expert 8: The Competitive Intelligence Analyst

```xml
<expert role="competitive-analyst" mindset="market-aware">
  <landscape>
    Proposal software market:
    
    1. PandaDoc / Proposify / Qwilr
       - Document-style proposals
       - Good templates, drag-drop
       - Weak on persuasion structure
       - No SEO-specific features
    
    2. ClickFunnels / Leadpages / Unbounce
       - Landing page builders
       - Strong conversion focus
       - Not for proposals (no signing, no pricing tables)
       - Overkill for B2B agency use
    
    3. Canva / Figma
       - Design-first
       - Beautiful output
       - No dynamic data
       - Export-only (not editable after send)
    
    4. Custom code (current Tevero)
       - Maximum control
       - Requires engineering
       - Not scalable as SaaS
  </landscape>
  
  <whitespace>
    NOBODY is doing:
    Persuasion-aware + SEO-data-integrated + Landing-page-quality + Editable
    
    This IS the Phase 102 opportunity.
    But it requires solving the editability bottleneck.
  </whitespace>
  
  <recommendation>
    Don't compete with PandaDoc on "document building."
    Don't compete with ClickFunnels on "page building."
    
    Compete on: "Proposal that closes deals using your SEO data"
    
    The differentiator is the SEO INTEGRATION:
    - Automatic competitor gap insertion
    - Real keyword data in proposal
    - Feasibility scores backing guarantees
    - Technical audit summary as proof
    
    The DESIGN is table stakes. The DATA is the moat.
  </recommendation>
</expert>
```

### Expert 9: The Technical Debt Preventer

```xml
<expert role="tech-debt-preventer" mindset="long-term-maintainability">
  <warning>
    Phase 102 as currently spec'd creates multiple tech debt vectors:
    
    1. TIPTAP EXTENSION SPRAWL
       Adding persuasionType to EditorSection means:
       - Custom TipTap nodes for each block type
       - Custom serialization/deserialization
       - Custom rendering for preview
       - Migration complexity when block types change
    
    2. SCHEMA COUPLING
       block_variants table ties A/B testing to specific block IDs:
       - What happens when block structure changes?
       - How do you migrate active tests?
       - Analytics history becomes orphaned
    
    3. RENDERING DUPLICATION
       If blocks render differently in:
       - Editor preview
       - Public proposal view
       - PDF export
       - Email embed
       
       You maintain 4 renderers per block type.
       8 block types × 4 renderers = 32 code paths.
  </warning>
  
  <recommendation>
    SINGLE RENDERER ARCHITECTURE:
    
    One React component per block type.
    Used EVERYWHERE:
    - Editor preview: <OfferStackBlock data={...} mode="preview" />
    - Public view: <OfferStackBlock data={...} mode="public" />
    - PDF: <OfferStackBlock data={...} mode="print" />
    
    The `mode` prop adjusts:
    - Interactivity (preview has hover states, public doesn't)
    - Styling (print has page-break rules)
    - Links (public has tracking, preview has editor affordances)
    
    Same component. Same data. Different modes.
  </recommendation>
  
  <migration-safety>
    Block type changes should be ADDITIVE only.
    
    v1: pain_amplifier has { headline, body }
    v2: pain_amplifier has { headline, body, statistic? }
    
    Old proposals still render (statistic is optional).
    New proposals can use statistic.
    
    NEVER remove or rename fields. Deprecate and migrate.
  </migration-safety>
</expert>
```

### Expert 10: The Revenue Optimizer

```xml
<expert role="revenue-optimizer" mindset="business-outcome">
  <question>
    What is the $ value of Phase 102?
    
    Current state:
    - Proposals close at ~40% (Lithuanian market, warm leads)
    - Average deal: €3,000
    - Proposals sent: ~20/month
    - Revenue: €3,000 × 20 × 40% = €24,000/month
    
    Phase 102 impact scenarios:
    
    Scenario A: 10% close rate improvement (40% → 44%)
    - Revenue: €3,000 × 20 × 44% = €26,400/month
    - Delta: +€2,400/month = +€28,800/year
    
    Scenario B: 2× proposals sent (better templates = faster creation)
    - Revenue: €3,000 × 40 × 40% = €48,000/month
    - Delta: +€24,000/month = +€288,000/year
    
    Scenario C: Both
    - Revenue: €3,000 × 40 × 44% = €52,800/month
    - Delta: +€28,800/month = +€345,600/year
  </question>
  
  <insight>
    SPEED has 10× more revenue impact than CONVERSION RATE.
    
    Spending 3 months building A/B testing to improve conversion 10%
    is worth €28,800/year.
    
    Spending 1 month building faster templates to 2× proposal volume
    is worth €288,000/year.
    
    The bottleneck is NOT conversion optimization.
    The bottleneck is VELOCITY.
  </insight>
  
  <recommendation>
    Phase 102 priority order:
    
    1. FAST TEMPLATES (Pathway 3) — Week 1-2
       - The 3000-word copy as a real template
       - Variables for {{company}}, {{package}}, {{price}}
       - One-click send with magic link
       - Impact: 2× proposal volume immediately
    
    2. DATA APPENDICES (Pathway 1/2) — Week 3-4
       - Add SEO data sections to templates
       - Keyword tables, competitor gaps
       - Auto-populated from SEO Chat analysis
       - Impact: Higher-value deals (data = credibility)
    
    3. ANALYTICS (Heatmaps) — Week 5-6
       - Track which sections are read
       - Identify drop-off points
       - Impact: Informs future template improvements
    
    4. A/B TESTING (Block variants) — Post-MVP
       - Only after you have volume for statistical significance
       - 20 proposals/month = 6 months to test ONE variant
       - Not worth building until 100+ proposals/month
  </recommendation>
</expert>
```

---

## Synthesis & Recommendation

### The Emerging Consensus

Across 10 expert perspectives, several themes repeat:

1. **VELOCITY > PERFECTION** — Speed of sending proposals matters more than perfect design
2. **TEMPLATES > BUILDER** — Pre-built templates with variable fill beats complex builders
3. **CONTENT ≠ PRESENTATION** — Separate what you say from how it looks
4. **COMPONENTS > WYSIWYG** — React components with forms beat TipTap rich text for structured content
5. **DATA IS THE MOAT** — SEO integration differentiates; design is table stakes
6. **CULTURAL CONTEXT** — Lithuanian copy structure is NOT universal

### The Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PROPOSAL CONTENT (JSON)                         │
│                                                                     │
│  {                                                                  │
│    template_id: "lithuanian-seo-standard",                         │
│    blocks: [                                                        │
│      { type: "pain_amplifier", content: {...} },                   │
│      { type: "offer_stack", content: {...} },                      │
│      ...                                                            │
│    ],                                                                │
│    variables: { company: "Plaukų Pasaka", package: "Augimo" },     │
│    appendices: { keyword_table: [...], competitor_gaps: [...] }    │
│  }                                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
    ┌───────────┐       ┌───────────┐       ┌───────────┐
    │  EDITOR   │       │  PUBLIC   │       │    PDF    │
    │   VIEW    │       │   VIEW    │       │  EXPORT   │
    │           │       │           │       │           │
    │ Form +    │       │ Rendered  │       │ Print     │
    │ Preview   │       │ Page      │       │ Styles    │
    │ Side-by-  │       │ (magic    │       │           │
    │ side      │       │  link)    │       │           │
    └───────────┘       └───────────┘       └───────────┘
```

### The Editability Solution

**Problem:** Landing-page quality proposals that non-technical users can edit.

**Solution:** Form-based editing of structured content, rendered by components.

| Action | Old (WYSIWYG) | New (Structured) |
|--------|---------------|------------------|
| Edit headline | Click text, type | Open form field, type |
| Change price | Find in text, modify | Edit `pricing.amount` |
| Reorder blocks | Drag in canvas | Drag in block list |
| Add data | Copy-paste table | Click "Add Keyword Table" |
| Change design | Edit CSS/HTML | Switch template theme |
| A/B test copy | Duplicate whole doc | Add content variant |

**No AI needed for edits.** AI is only for:
- Initial content generation (optional)
- Style extraction from reference PDFs (one-time)
- Suggestions ("Improve this headline")

### Implementation Phases (Revised)

**Week 1-2: Foundation**
- Proposal content schema (JSON structure)
- 8 block type components (React)
- Single renderer with mode prop
- Lithuanian standard template

**Week 3-4: Editor**
- Form-based block editing
- Preview panel (same components)
- Variable system ({{tokens}})
- Save/load/version

**Week 5-6: Integration**
- SEO data appendices (from SEO Chat)
- Magic link generation
- View tracking (opens, time-on-page)
- PDF export

**Post-MVP: Optimization**
- Block-level analytics
- A/B testing (when volume justifies)
- Additional templates
- Template builder for power users

---

## Open Questions (For User Decision)

1. **Template-First or Builder-First?**
   - Template-first = ship faster, less flexible
   - Builder-first = more flexible, longer to ship

2. **Form-Based or WYSIWYG?**
   - Form-based = simpler, more structured
   - WYSIWYG = more familiar, harder to maintain

3. **Pathway Priority?**
   - Pathway 3 first = fastest to value
   - Pathway 1 first = more differentiated

4. **SaaS Users vs Tevero-Internal?**
   - Build for Tevero first, generalize later?
   - Build generic first, customize for Tevero?

---

*Analysis complete. Decision required before Phase 102 planning can proceed.*
