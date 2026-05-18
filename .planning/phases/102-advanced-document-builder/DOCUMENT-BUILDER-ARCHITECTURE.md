# Phase 102: Advanced Document Builder Architecture

> World-class architecture for persuasion-aware document creation with multiple input sources

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [The 3-Layer System](#the-3-layer-system)
3. [Input Source Flows](#input-source-flows)
4. [Template System](#template-system)
5. [AI Generation Interface](#ai-generation-interface)
6. [Data Models](#data-models)
7. [User Flows](#user-flows)
8. [A/B Testing Architecture](#ab-testing-architecture)
9. [Analytics Pipeline](#analytics-pipeline)

---

## Core Architecture

### Design Philosophy

The document builder follows a **separation of concerns** principle across three distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    STRUCTURE LAYER                          │
│  "What persuasion elements exist and in what order"         │
│  • Persuasion block types (Pain Amplifier, Risk Reversal)   │
│  • Block sequence and hierarchy                             │
│  • Framework compliance (Russell Brunson, Dan Kennedy)      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     CONTENT LAYER                           │
│  "The actual words, images, and formatting"                 │
│  • Text content (TipTap rich text)                          │
│  • Media assets                                             │
│  • Styling and brand application                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     CONTEXT LAYER                           │
│  "Who we're writing for and reference materials"            │
│  • Prospect data (company, pain points, industry)           │
│  • Style references (PDF uploads, brand guidelines)         │
│  • Previous successful proposals                            │
└─────────────────────────────────────────────────────────────┘
```

### Why 3 Layers?

| Problem | Solution |
|---------|----------|
| "I want to use this structure but different content" | Structure layer is reusable across proposals |
| "I want to match this client's tone" | Context layer holds style references |
| "I want to A/B test just the guarantee section" | Content layer blocks are independently testable |
| "I want AI to fill in prospect-specific details" | Context layer feeds AI generation |

---

## The 3-Layer System

### Layer 1: Structure Layer

Defines the persuasion architecture of the document.

```typescript
interface StructureLayer {
  framework?: PersuasionFramework; // Optional framework to validate against
  blocks: PersuasionBlockDefinition[];
  validation: StructureValidation;
}

interface PersuasionBlockDefinition {
  id: string;
  type: PersuasionBlockType;
  position: number;
  required: boolean; // Framework may require certain blocks
  children?: PersuasionBlockDefinition[]; // Nested blocks
}

type PersuasionBlockType =
  | 'pain_amplifier'      // "Your current SEO is costing you €X/month"
  | 'villain_story'       // "Other agencies promise rankings but..."
  | 'credibility'         // "We've helped 47 e-commerce brands..."
  | 'social_proof'        // Testimonials, case studies, logos
  | 'process_reveal'      // "Our 6-phase methodology"
  | 'offer_stack'         // Package breakdown with value anchoring
  | 'risk_reversal'       // Guarantees, refund policies
  | 'objection_handler'   // FAQ, common concerns
  | 'urgency'             // Limited availability, deadline
  | 'cta'                 // Call to action
  | 'custom';             // Freeform content

interface PersuasionFramework {
  id: string;
  name: string; // "Russell Brunson Perfect Webinar", "Dan Kennedy Long Form"
  requiredBlocks: PersuasionBlockType[];
  recommendedSequence: PersuasionBlockType[];
  validationRules: FrameworkRule[];
}
```

### Layer 2: Content Layer

Holds the actual content for each block.

```typescript
interface ContentLayer {
  blocks: ContentBlock[];
  version: number;
  lastModified: Date;
}

interface ContentBlock {
  structureId: string; // Links to PersuasionBlockDefinition.id
  content: TipTapContent; // Rich text JSON
  media: MediaAsset[];
  styling: BlockStyling;
  templateMode?: TemplateContentMode; // For template blocks
}

interface BlockStyling {
  variant: 'default' | 'highlighted' | 'minimal' | 'card';
  customCSS?: string;
  backgroundColor?: string;
  textAlignment?: 'left' | 'center' | 'right';
}
```

### Layer 3: Context Layer

Provides generation context and style references.

```typescript
interface ContextLayer {
  prospect: ProspectContext;
  styleReferences: StyleReference[];
  previousSuccesses: ProposalReference[];
  brandGuidelines?: BrandGuidelines;
}

interface ProspectContext {
  prospectId: string;
  companyName: string;
  industry: string;
  painPoints: string[];
  competitorMentions: string[];
  budgetRange?: string;
  decisionMaker: {
    name: string;
    role: string;
    communicationStyle?: 'formal' | 'casual' | 'technical';
  };
  customFields: Record<string, string>; // Extensible
}

interface StyleReference {
  id: string;
  type: 'pdf' | 'url' | 'previous_proposal';
  name: string;
  extractedStyle?: ExtractedStyle; // AI-analyzed style attributes
  uploadedAt: Date;
}

interface ExtractedStyle {
  tone: string[];           // ["professional", "confident", "direct"]
  vocabulary: string[];     // Key phrases to use
  avoidances: string[];     // Phrases/patterns to avoid
  structurePatterns: string[]; // Observed structural patterns
}
```

---

## Input Source Flows

### Overview: 5 Entry Points

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                              │
├──────────────┬──────────────┬────────────┬──────────┬───────────┤
│  Blank       │  Paste       │  Template  │  PDF     │  Clone    │
│  Canvas      │  Import      │  Selection │  Upload  │  Existing │
└──────┬───────┴──────┬───────┴─────┬──────┴────┬─────┴─────┬─────┘
       │              │             │           │           │
       ▼              ▼             ▼           ▼           ▼
   Framework     AI Structure   Pre-built   Style Only   Full Copy
   Selector      Detection      Blocks      Reference    + Edit
       │              │             │           │           │
       └──────────────┴─────────────┴───────────┴───────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  UNIFIED EDITOR │
                    │  (3-Layer View) │
                    └─────────────────┘
```

### Flow 1: Blank Canvas

**Use case:** Starting fresh with optional framework guidance.

```
User clicks "New Proposal"
        │
        ▼
┌─────────────────────────────────┐
│  Framework Selection (Optional) │
│  ┌─────────────────────────────┐│
│  │ ○ No framework (freeform)  ││
│  │ ● Russell Brunson Stack    ││
│  │ ○ Dan Kennedy Long Form    ││
│  │ ○ Problem-Agitate-Solve    ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  Prospect Selection             │
│  (Existing or Create New)       │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  Editor opens with:             │
│  • Empty structure (or          │
│    framework skeleton)          │
│  • Context layer populated      │
│  • Block palette visible        │
└─────────────────────────────────┘
```

**Key UX:** If framework selected, show ghost blocks for required/recommended elements.

### Flow 2: Paste Import

**Use case:** User has existing proposal text (from Google Doc, email, etc.)

```
User clicks "Import from Text"
        │
        ▼
┌─────────────────────────────────┐
│  Large Text Area                │
│  "Paste your proposal text..."  │
│                                 │
│  [────────────────────────────] │
│  [                            ] │
│  [     (5000+ chars OK)       ] │
│  [────────────────────────────] │
│                                 │
│  [ ] Also use as style ref     │
│  [Analyze & Import]             │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  AI STRUCTURE DETECTION (Gemini 3.1 Pro)                    │
│                                                              │
│  Input: Raw text                                             │
│  Output: {                                                   │
│    detected_blocks: [                                        │
│      { type: 'pain_amplifier', content: '...', confidence: 0.92 },
│      { type: 'credibility', content: '...', confidence: 0.88 },
│      ...                                                     │
│    ],                                                        │
│    suggested_framework: 'russell_brunson',                   │
│    framework_match_score: 0.85,                              │
│    extracted_style: { tone: [...], vocabulary: [...] }       │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  REVIEW & ADJUST SCREEN                                      │
│                                                              │
│  Detected Structure:              Your Text:                 │
│  ┌────────────────────┐          ┌────────────────────┐     │
│  │ 🎯 Pain Amplifier  │ ←──────→ │ "Your current SEO  │     │
│  │    (92% match)     │          │  is invisible..."  │     │
│  └────────────────────┘          └────────────────────┘     │
│  ┌────────────────────┐          ┌────────────────────┐     │
│  │ ⚡ Villain Story   │ ←──────→ │ "Other agencies    │     │
│  │    (88% match)     │          │  promise but..."   │     │
│  └────────────────────┘          └────────────────────┘     │
│                                                              │
│  [Accept All] [Edit Mappings] [Start Over]                   │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
    Editor with pre-populated blocks
```

**AI Prompt for Structure Detection:**

```
You are analyzing a sales/proposal document to identify persuasion elements.

For each section of text, classify it as one of these block types:
- pain_amplifier: Highlights prospect's current problems/costs
- villain_story: Positions competitors or status quo as the enemy
- credibility: Establishes authority, experience, expertise
- social_proof: Testimonials, case studies, client logos
- process_reveal: Explains methodology or how service works
- offer_stack: Presents packages/pricing with value framing
- risk_reversal: Guarantees, refund policies, risk removal
- objection_handler: Addresses common concerns/FAQ
- urgency: Creates time pressure or scarcity
- cta: Call to action
- custom: Content that doesn't fit other categories

Also identify:
1. The overall persuasion framework (if recognizable)
2. Writing style attributes (tone, vocabulary, patterns)

Return structured JSON with confidence scores.
```

### Flow 3: Template Selection

**Use case:** User wants to start from a proven template.

```
User clicks "Start from Template"
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  TEMPLATE GALLERY                                            │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ E-commerce  │ │ Local Biz   │ │ B2B SaaS    │            │
│  │ SEO Pitch   │ │ SEO Pitch   │ │ SEO Pitch   │            │
│  │             │ │             │ │             │            │
│  │ 8 blocks    │ │ 6 blocks    │ │ 10 blocks   │            │
│  │ 78% win rate│ │ 65% win rate│ │ 82% win rate│            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                              │
│  Filter: [Industry ▼] [Framework ▼] [Length ▼]              │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  TEMPLATE PREVIEW                                            │
│                                                              │
│  E-commerce SEO Pitch                                        │
│  ────────────────────                                        │
│  Framework: Russell Brunson Stack                            │
│  Blocks: 8 | Avg. time to customize: 12 min                  │
│                                                              │
│  Block Types:                                                │
│  1. Pain Amplifier (Variable) - Revenue you're losing        │
│  2. Credibility (Fixed) - Our e-commerce track record        │
│  3. Process Reveal (Variable) - 6-phase methodology          │
│  4. Case Study (Regenerate) - Similar client success         │
│  5. Offer Stack (Variable) - Package tiers                   │
│  6. Risk Reversal (Fixed) - 90-day guarantee                 │
│  7. FAQ (Variable) - Common objections                       │
│  8. CTA (Variable) - Book call                               │
│                                                              │
│  [Preview Full Template] [Use This Template]                 │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
    Select Prospect → Editor with template blocks
```

### Flow 4: PDF Upload (Style Reference)

**Use case:** User has a beautifully designed PDF they want to match stylistically.

```
User clicks "Upload Reference PDF"
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  PDF UPLOAD                                                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │              [ Drag PDF here or click ]                 ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ⚠️  PDF is used as STYLE REFERENCE only                    │
│      Content will not be extracted for editing              │
│      AI will match the tone, structure, and vocabulary      │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  STYLE EXTRACTION (Background Process)                       │
│                                                              │
│  Analyzing PDF... ████████░░ 80%                            │
│                                                              │
│  Detected Style Attributes:                                  │
│  • Tone: Professional, Confident, Data-driven               │
│  • Structure: Problem → Solution → Proof → Offer            │
│  • Key phrases: "ROI-focused", "data-backed", "proven"      │
│  • Visual style: Minimal, lots of whitespace, blue accents  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
    Style reference saved to Context Layer
    User proceeds to Blank Canvas or Template flow
```

**Why PDF is Style-Only (Not Editable):**

1. **PDF parsing is lossy** - Tables, columns, styling don't survive extraction
2. **Layout ≠ Structure** - PDF visual layout doesn't map to persuasion blocks
3. **Editing complexity** - Would need full PDF editor (out of scope)
4. **Style is the value** - Users want to MATCH the PDF, not EDIT it

### Flow 5: Clone Existing Proposal

**Use case:** User wants to base new proposal on a previous successful one.

```
User clicks "Clone Existing"
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  PROPOSAL HISTORY                                            │
│                                                              │
│  Recent Proposals:                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✓ Plaukų Pasaka SEO        │ Won  │ €3,500 │ 2 weeks   ││
│  │   E-commerce, 8 blocks      │      │        │ ago       ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ ✗ TechStartup.lt           │ Lost │ €5,000 │ 1 month   ││
│  │   B2B SaaS, 10 blocks       │      │        │ ago       ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ ⏳ RestaurantX              │ Open │ €1,200 │ 3 days    ││
│  │   Local Business, 6 blocks  │      │        │ ago       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  [Clone Selected] [View Analytics First]                     │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  CLONE OPTIONS                                               │
│                                                              │
│  What to copy:                                               │
│  ☑ Structure (block types and order)                        │
│  ☑ Content (actual text - will need editing)                │
│  ☐ Styling (colors, fonts, layout)                          │
│  ☐ A/B test variants (if any)                               │
│                                                              │
│  New prospect: [Select or Create ▼]                         │
│                                                              │
│  [Create Clone]                                              │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
    Editor with cloned content
    All {{prospect.field}} placeholders highlighted for review
```

---

## Template System

### Template Content Modes

Each block in a template has a **content mode** that determines how it behaves when the template is used:

```typescript
type TemplateContentMode = 'fixed' | 'variable' | 'regenerate';
```

| Mode | Behavior | Example |
|------|----------|---------|
| **Fixed** | Content is copied exactly, user can't regenerate | "90-day ranking guarantee or full refund" |
| **Variable** | Content has placeholders, user fills in or AI assists | "We've helped {{industry}} companies achieve {{typical_result}}" |
| **Regenerate** | AI generates fresh content from scratch each time | Case study block - AI finds relevant success story for this prospect |

### Template Data Model

```typescript
interface ProposalTemplate {
  id: string;
  name: string;
  description: string;
  industry?: string;
  framework?: string;
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  usageCount: number;
  winRate?: number; // Calculated from proposals using this template
  
  // Structure
  blocks: TemplateBlock[];
  
  // Style
  defaultStyling: ProposalStyling;
  styleReferences: StyleReference[];
}

interface TemplateBlock {
  id: string;
  persuasionType: PersuasionBlockType;
  position: number;
  
  // Content mode
  contentMode: TemplateContentMode;
  
  // Mode-specific content
  fixedContent?: TipTapContent;        // For 'fixed' mode
  variableContent?: VariableContent;   // For 'variable' mode
  regeneratePrompt?: string;           // For 'regenerate' mode
  
  // Generation hints
  aiHints?: {
    tone?: string;
    length?: 'short' | 'medium' | 'long';
    includeData?: string[];  // e.g., ['competitor_gap', 'estimated_traffic']
  };
}

interface VariableContent {
  template: string; // "We've helped {{count}} {{industry}} businesses..."
  placeholders: Placeholder[];
  fallbackContent?: string; // If placeholders can't be resolved
}

interface Placeholder {
  key: string;           // "industry"
  source: 'prospect' | 'seo_data' | 'user_input' | 'ai_generated';
  prospectField?: string; // For 'prospect' source: "industry"
  seoDataPath?: string;   // For 'seo_data' source: "domain_health.score"
  promptIfMissing?: string; // For 'user_input': "What industry is this client in?"
  aiPrompt?: string;      // For 'ai_generated': "Generate 2-3 word industry descriptor"
}
```

### Creating Templates

Templates can be created from:

1. **Scratch** - Build in template editor with explicit mode selection per block
2. **Save Proposal as Template** - Convert existing proposal:
   - System identifies prospect-specific content
   - User marks blocks as Fixed/Variable/Regenerate
   - Placeholders auto-detected from prospect data usage

```
┌─────────────────────────────────────────────────────────────┐
│  SAVE AS TEMPLATE                                            │
│                                                              │
│  This block contains prospect-specific content:              │
│  "Plaukų Pasaka currently ranks #47 for 'plaukų priežiūra'" │
│                                                              │
│  How should this block work in the template?                 │
│                                                              │
│  ○ Fixed - Keep this exact text                             │
│  ● Variable - Replace with: "{{prospect.company}} currently  │
│               ranks #{{seo_data.main_keyword_rank}} for      │
│               '{{seo_data.main_keyword}}'"                   │
│  ○ Regenerate - AI generates fresh ranking analysis          │
│                                                              │
│  [Previous Block] [Next Block] [Save Template]               │
└─────────────────────────────────────────────────────────────┘
```

---

## AI Generation Interface

### Unified Generation Request

Regardless of how content is being generated (new block, variable fill, regenerate), all requests go through a unified interface:

```typescript
interface GenerationRequest {
  // What to generate
  blockType: PersuasionBlockType;
  intent: 'create' | 'fill_variables' | 'regenerate' | 'improve';
  
  // Context (from Context Layer)
  prospect: ProspectContext;
  styleReferences: StyleReference[];
  
  // Content context
  existingContent?: string;      // For 'improve' intent
  variableTemplate?: string;     // For 'fill_variables' intent
  customPrompt?: string;         // User's specific instructions
  
  // Constraints
  maxLength?: number;
  tone?: string;
  language: string;              // 'lt', 'en', etc.
  
  // Framework compliance
  framework?: PersuasionFramework;
  precedingBlocks?: string[];    // Context of what comes before
  followingBlocks?: string[];    // Context of what comes after
}

interface GenerationResponse {
  content: string;
  confidence: number;
  suggestions?: string[];        // Alternative phrasings
  frameworkCompliance?: {
    compliant: boolean;
    issues?: string[];
  };
}
```

### Generation Flow

```
┌─────────────────────────────────────────────────────────────┐
│  USER ACTION                                                 │
│  (Click "Generate", "Fill", "Improve", etc.)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  BUILD GENERATION REQUEST                                    │
│                                                              │
│  1. Determine intent from action type                        │
│  2. Gather prospect context                                  │
│  3. Load style references (if any)                          │
│  4. Extract surrounding block context                        │
│  5. Apply framework constraints                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PROMPT CONSTRUCTION                                         │
│                                                              │
│  System: You are writing {blockType} content for a           │
│          {framework} style sales proposal.                   │
│                                                              │
│  Context: Prospect is {prospect.company} in {industry}.      │
│           Pain points: {painPoints}                          │
│           Previous blocks establish: {precedingContext}      │
│                                                              │
│  Style: Match this tone: {styleReference.tone}               │
│         Use vocabulary like: {styleReference.vocabulary}     │
│         Avoid: {styleReference.avoidances}                   │
│                                                              │
│  Task: {specific task based on intent}                       │
│                                                              │
│  Constraints: Max {maxLength} words, language: {language}    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  GEMINI 3.1 PRO                                              │
│  $1.25/1M tokens                                             │
│  Optimized for content generation                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  POST-PROCESSING                                             │
│                                                              │
│  1. Validate framework compliance                            │
│  2. Check length constraints                                 │
│  3. Verify language consistency                              │
│  4. Generate alternatives if requested                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  RETURN TO EDITOR                                            │
│  Content inserted, user can edit                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Complete Schema Overview

```typescript
// ═══════════════════════════════════════════════════════════
// PROPOSAL
// ═══════════════════════════════════════════════════════════

interface Proposal {
  id: string;
  prospectId: string;
  templateId?: string;        // If created from template
  
  // Status
  status: 'draft' | 'sent' | 'viewed' | 'won' | 'lost';
  sentAt?: Date;
  viewedAt?: Date;
  outcomeAt?: Date;
  
  // The 3 Layers
  structure: StructureLayer;
  content: ContentLayer;
  context: ContextLayer;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // Version tracking
  currentVersion: number;
  versions: ProposalVersion[];
}

interface ProposalVersion {
  version: number;
  structure: StructureLayer;
  content: ContentLayer;
  createdAt: Date;
  changeDescription?: string;
}

// ═══════════════════════════════════════════════════════════
// BLOCKS
// ═══════════════════════════════════════════════════════════

interface PersuasionBlock {
  id: string;
  proposalId: string;
  
  // Structure
  type: PersuasionBlockType;
  position: number;
  parentId?: string;          // For nested blocks
  
  // Content
  content: TipTapContent;
  styling: BlockStyling;
  
  // A/B Testing
  isVariantParent: boolean;   // If true, this block has variants
  activeVariantId?: string;   // Which variant is currently shown
  
  // Analytics
  viewCount: number;
  dwellTimeMs: number;
  scrollDepthReached: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════
// A/B TESTING
// ═══════════════════════════════════════════════════════════

interface BlockVariant {
  id: string;
  parentBlockId: string;      // The original block this is a variant of
  variantName: string;        // "Control", "Variant A", "Variant B"
  
  // Content
  content: TipTapContent;
  styling?: BlockStyling;     // Null = inherit from parent
  
  // Traffic allocation
  weight: number;             // 0-100, all variants should sum to 100
  
  // Analytics
  impressions: number;
  conversions: number;        // Defined by conversion event
  conversionRate: number;     // Calculated
  
  // Status
  status: 'active' | 'paused' | 'winner' | 'loser';
  
  // Metadata
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════
// IMPORT & STYLE
// ═══════════════════════════════════════════════════════════

interface ImportSession {
  id: string;
  userId: string;
  
  // Source
  sourceType: 'paste' | 'pdf' | 'url';
  sourceContent: string;      // Raw pasted text or file reference
  
  // Detection results
  detectedBlocks: DetectedBlock[];
  suggestedFramework?: string;
  frameworkConfidence?: number;
  extractedStyle?: ExtractedStyle;
  
  // User decisions
  acceptedMappings: BlockMapping[];
  
  // Status
  status: 'analyzing' | 'review' | 'imported' | 'cancelled';
  
  // Result
  resultProposalId?: string;
  
  createdAt: Date;
}

interface DetectedBlock {
  originalText: string;
  suggestedType: PersuasionBlockType;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

interface BlockMapping {
  detectedBlockIndex: number;
  assignedType: PersuasionBlockType;
  userModified: boolean;
}

// ═══════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════

interface ProposalView {
  id: string;
  proposalId: string;
  viewerToken: string;        // Magic link token
  
  // Session
  sessionId: string;
  startedAt: Date;
  endedAt?: Date;
  
  // Engagement
  totalDwellTimeMs: number;
  scrollDepthPercent: number;
  blockInteractions: BlockInteraction[];
  
  // Outcome
  ctaClicked: boolean;
  ctaClickedAt?: Date;
}

interface BlockInteraction {
  blockId: string;
  variantId?: string;         // If A/B test variant was shown
  
  // Engagement metrics
  viewedAt: Date;
  dwellTimeMs: number;
  scrolledPastAt?: Date;
  
  // Actions
  linkClicks: number;
  copyEvents: number;         // User copied text from this block
}
```

---

## User Flows

### Complete User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                     STARTING POINT                           │
│                                                              │
│   User wants to create a proposal for a prospect             │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
      ┌─────────┐    ┌─────────┐    ┌─────────┐
      │ Blank   │    │ Import  │    │ Template│
      │ Canvas  │    │ Content │    │ Gallery │
      └────┬────┘    └────┬────┘    └────┬────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        EDITOR                                │
│                                                              │
│  ┌─────────────────┐  ┌────────────────────────────────────┐│
│  │  Block Palette  │  │          Canvas                    ││
│  │                 │  │                                    ││
│  │  Pain Amplifier │  │  ┌────────────────────────────┐   ││
│  │  Villain Story  │  │  │ [Pain Amplifier Block]     │   ││
│  │  Credibility    │  │  │ Your SEO is costing you... │   ││
│  │  Social Proof   │  │  │ [✨ Generate] [🔄 Variants]│   ││
│  │  Process Reveal │  │  └────────────────────────────┘   ││
│  │  Offer Stack    │  │                                    ││
│  │  Risk Reversal  │  │  ┌────────────────────────────┐   ││
│  │  Objection      │  │  │ [Credibility Block]        │   ││
│  │  Urgency        │  │  │ We've helped 47 e-comm...  │   ││
│  │  CTA            │  │  └────────────────────────────┘   ││
│  │                 │  │                                    ││
│  └─────────────────┘  └────────────────────────────────────┘│
│                                                              │
│  [Preview] [Save Draft] [Create Variant] [Send]             │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
      ┌─────────┐    ┌─────────┐    ┌─────────┐
      │ Preview │    │ A/B     │    │ Send &  │
      │ & Edit  │    │ Test    │    │ Track   │
      └─────────┘    │ Setup   │    └────┬────┘
                     └────┬────┘         │
                          │              │
                          ▼              ▼
                   ┌─────────────────────────┐
                   │  Prospect Views Proposal │
                   │  (Magic Link)            │
                   └───────────┬─────────────┘
                               │
                               ▼
                   ┌─────────────────────────┐
                   │  Analytics Dashboard    │
                   │  • Block heatmaps       │
                   │  • A/B test results     │
                   │  • Conversion tracking  │
                   └───────────┬─────────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
               ▼               ▼               ▼
          ┌─────────┐    ┌─────────┐    ┌─────────┐
          │ Mark    │    │ Save as │    │ Iterate │
          │ Won/Lost│    │ Template│    │ & Resend│
          └─────────┘    └─────────┘    └─────────┘
```

---

## A/B Testing Architecture

### Variant Assignment

**Deterministic hash assignment** ensures:
- Same prospect always sees same variant (consistency)
- No database lookup needed for assignment (performance)
- Statistically even distribution (fairness)

```typescript
function getVariantForProspect(
  prospectId: string,
  blockId: string,
  variants: BlockVariant[]
): BlockVariant {
  // Create deterministic hash
  const hash = createHash('sha256')
    .update(`${prospectId}:${blockId}`)
    .digest();
  
  // Convert first 4 bytes to number
  const hashNum = hash.readUInt32BE(0);
  
  // Map to 0-99 range
  const bucket = hashNum % 100;
  
  // Find variant by weight
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return variant;
    }
  }
  
  // Fallback to last variant
  return variants[variants.length - 1];
}
```

### Real-Time Analytics

**Redis counters + periodic Postgres sync** for performance:

```typescript
// On each view event
async function recordBlockView(blockId: string, variantId?: string) {
  const key = variantId 
    ? `block:${blockId}:variant:${variantId}:views`
    : `block:${blockId}:views`;
  
  // Atomic increment in Redis
  await redis.incr(key);
  
  // Also add to time-series for decay analysis
  await redis.zadd(
    `block:${blockId}:views:ts`,
    Date.now(),
    `${Date.now()}:${variantId || 'control'}`
  );
}

// Periodic sync job (every 5 minutes)
async function syncAnalyticsToPostgres() {
  const keys = await redis.keys('block:*:views');
  
  for (const key of keys) {
    const [, blockId, , variantId] = key.split(':');
    const count = await redis.getset(key, '0');
    
    if (variantId) {
      await db.blockVariants.increment({
        where: { id: variantId },
        data: { impressions: parseInt(count) }
      });
    } else {
      await db.blocks.increment({
        where: { id: blockId },
        data: { viewCount: parseInt(count) }
      });
    }
  }
}
```

### Statistical Significance

```typescript
interface ABTestResult {
  variantId: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  confidenceLevel: number;  // 0-100
  isSignificant: boolean;   // > 95% confidence
  recommendation: 'winner' | 'loser' | 'needs_more_data';
}

function calculateSignificance(
  control: { impressions: number; conversions: number },
  variant: { impressions: number; conversions: number }
): ABTestResult {
  // Z-test for proportions
  const p1 = control.conversions / control.impressions;
  const p2 = variant.conversions / variant.impressions;
  const pPooled = (control.conversions + variant.conversions) / 
                  (control.impressions + variant.impressions);
  
  const se = Math.sqrt(
    pPooled * (1 - pPooled) * 
    (1/control.impressions + 1/variant.impressions)
  );
  
  const z = (p2 - p1) / se;
  const confidence = normalCDF(z) * 100;
  
  return {
    variantId: variant.id,
    impressions: variant.impressions,
    conversions: variant.conversions,
    conversionRate: p2,
    confidenceLevel: confidence,
    isSignificant: confidence > 95,
    recommendation: confidence > 95 
      ? (p2 > p1 ? 'winner' : 'loser')
      : 'needs_more_data'
  };
}
```

---

## Analytics Pipeline

### Engagement Tracking

```
┌─────────────────────────────────────────────────────────────┐
│  PROSPECT VIEWS PROPOSAL                                     │
│  (Magic link: /p/abc123)                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CLIENT-SIDE TRACKING                                        │
│                                                              │
│  • Intersection Observer: Which blocks are visible?          │
│  • Scroll depth: How far did they scroll?                   │
│  • Dwell time: How long on each block?                      │
│  • Interactions: Clicks, copies, hovers                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  BATCHED EVENTS (every 5 seconds or on exit)                │
│                                                              │
│  {                                                           │
│    sessionId: "sess_123",                                    │
│    events: [                                                 │
│      { type: "block_view", blockId: "b1", dwell: 4200 },    │
│      { type: "block_view", blockId: "b2", dwell: 8100 },    │
│      { type: "scroll_depth", percent: 67 },                  │
│      { type: "cta_click", blockId: "b8" }                   │
│    ]                                                         │
│  }                                                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  API ENDPOINT: POST /api/proposals/[id]/analytics           │
│                                                              │
│  • Validate session token                                    │
│  • Update Redis counters                                     │
│  • Queue detailed event processing                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ANALYTICS AGGREGATION (BullMQ job)                          │
│                                                              │
│  • Calculate block engagement scores                         │
│  • Update A/B test statistics                                │
│  • Detect patterns (which blocks correlate with wins?)      │
│  • Generate heatmap data                                     │
└─────────────────────────────────────────────────────────────┘
```

### Heatmap Visualization

```typescript
interface BlockHeatmapData {
  blockId: string;
  blockType: PersuasionBlockType;
  position: number;
  
  // Engagement metrics (normalized 0-100)
  viewRate: number;          // % of viewers who saw this block
  avgDwellTime: number;      // Seconds
  engagementScore: number;   // Composite score
  
  // Conversion correlation
  correlationWithWin: number; // -1 to 1
  
  // Visual
  heatLevel: 'cold' | 'warm' | 'hot'; // For color coding
}

function calculateHeatLevel(score: number): 'cold' | 'warm' | 'hot' {
  if (score < 30) return 'cold';
  if (score < 70) return 'warm';
  return 'hot';
}
```

---

## Implementation Priority

### Phase 1: Core Builder (MVP)
1. Block palette with persuasion types
2. Drag-drop reordering (@dnd-kit)
3. TipTap rich text editing
4. Basic AI generation (single block)
5. Preview mode

### Phase 2: Templates & Import
1. Paste import with AI structure detection
2. Template creation from proposals
3. Template gallery with industry filters
4. Variable content modes

### Phase 3: Analytics & A/B Testing
1. View tracking pipeline
2. Block-level heatmaps
3. A/B variant creation
4. Statistical significance calculation

### Phase 4: Advanced Features
1. PDF style extraction
2. Framework compliance validation
3. Diff visualization for versions
4. Conversion correlation analysis

---

## Appendix: Lithuanian Proposal Structure Analysis

The user's 3000-word Lithuanian SEO proposal was analyzed and mapped to persuasion blocks:

| Section | Persuasion Type | Key Technique |
|---------|-----------------|---------------|
| Opening hook about ranking #47 | Pain Amplifier | Specific data point creates urgency |
| "Other agencies promise rankings" | Villain Story | Positions competitors as unreliable |
| "47 e-commerce brands helped" | Credibility | Social proof through numbers |
| 6-phase methodology breakdown | Process Reveal | Transparency builds trust |
| Package tiers with struck prices | Offer Stack | Value anchoring with contrasts |
| "90-day ranking guarantee" | Risk Reversal | Removes purchase barrier |
| FAQ section | Objection Handler | Pre-empts common concerns |
| Limited availability notice | Urgency | Creates scarcity |
| "Book your strategy call" CTA | CTA | Clear next step |

This proposal follows the **Russell Brunson "Perfect Webinar" framework** with 85% compliance.
