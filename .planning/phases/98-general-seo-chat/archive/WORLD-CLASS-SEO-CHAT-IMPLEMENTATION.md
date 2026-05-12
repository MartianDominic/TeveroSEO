# World-Class SEO Chat Implementation

> **Purpose**: Comprehensive design document consolidating all 10 Opus subagent research findings for TeveroSEO Phase 98 General SEO Chat feature.
> **Status**: Research Complete — Ready for Implementation
> **Generated**: 2026-05-09

---

## Executive Summary

This document defines the architecture for a world-class SEO chat that combines:
- **ChatGPT/Claude-like conversational UX** with multi-turn context
- **5-Mode System** for cost-aware depth selection
- **Context Injection** via drag-drop, paste, and @ mentions
- **Proposal Generation** with stage-by-stage workflow
- **Confirmation Workflows** balancing autonomy with safety
- **State Machine** for complex flow management

**Key Constraint**: Grok 4.1 retiring May 15, 2026 — must migrate to Grok 4.3.

---

## Table of Contents

1. [Mode & Depth System](#1-mode--depth-system)
2. [Context Injection Patterns](#2-context-injection-patterns)
3. [State Machine Architecture](#3-state-machine-architecture)
4. [Proposal Generation Workflow](#4-proposal-generation-workflow)
5. [Confirmation Workflow Tiers](#5-confirmation-workflow-tiers)
6. [Cost Optimization Strategy](#6-cost-optimization-strategy)
7. [World-Class UX Patterns](#7-world-class-ux-patterns)
8. [System Integration](#8-system-integration)
9. [Streaming Architecture](#9-streaming-architecture)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Mode & Depth System

### 1.1 The 5-Mode Architecture

Different user intents require different analysis depths. The mode system provides explicit cost/quality tradeoffs.

| Mode | Use Case | Cost | Response Time | Token Budget |
|------|----------|------|---------------|--------------|
| **Quick** | Random SEO questions, cached lookups | $0.002 | <2s | 2K |
| **Standard** | Keyword feasibility, basic analysis | $0.02 | 5-15s | 8K |
| **Deep** | Full competitor analysis, content gaps | $0.08 | 30-60s | 16K |
| **Prospect** | Lead qualification, proposal prep | $0.25 | 2-3min | 32K |
| **Client** | Full client context, voice-aware | $0.15 | 1-2min | 24K |

### 1.2 Mode Selection Logic

```typescript
// lib/seo-chat/mode-selector.ts

interface ModeSelectionContext {
  query: string;
  hasClientContext: boolean;
  hasProspectContext: boolean;
  recentQueries: number;        // Questions in last 5 minutes
  explicitMode?: ChatMode;
  userPreference?: ChatMode;
}

function selectMode(ctx: ModeSelectionContext): ChatMode {
  // Explicit override always wins
  if (ctx.explicitMode) return ctx.explicitMode;
  
  // Client context → Client mode
  if (ctx.hasClientContext) return 'client';
  
  // Prospect context → Prospect mode
  if (ctx.hasProspectContext) return 'prospect';
  
  // Intent-based selection
  const intent = classifyIntent(ctx.query);
  
  switch (intent.type) {
    case 'simple_question':
      return 'quick';
    case 'feasibility_check':
      return 'standard';
    case 'competitor_analysis':
    case 'content_gap':
      return 'deep';
    case 'proposal_generation':
      return 'prospect';
    default:
      return ctx.userPreference ?? 'standard';
  }
}
```

### 1.3 Mode UI Pattern

```
┌──────────────────────────────────────────────────────────────────────┐
│  Ask anything about SEO...                                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Can meistreliokampas.lt rank for Milwaukee dalys?              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Mode: [Quick ▾]  ─────────────────────────────────────  [Send]     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ ○ Quick    — Cached data, instant answers           ~$0.002    │ │
│  │ ● Standard — Live SERP check, basic analysis        ~$0.02     │ │
│  │ ○ Deep     — Full competitor + content gap          ~$0.08     │ │
│  │ ○ Prospect — Lead qualification, proposal draft     ~$0.25     │ │
│  │ ○ Client   — Full context, voice-aware response     ~$0.15     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.4 The 5-Depth Levels

Orthogonal to modes, depth controls analysis thoroughness within a mode:

| Depth | Description | Time | Cost Multiplier |
|-------|-------------|------|-----------------|
| **Instant** | Cached results only | <500ms | 0x |
| **Quick** | Single API call | 5s | 1x |
| **Standard** | 3-5 API calls | 30s | 3x |
| **Deep** | Full analysis suite | 2min | 8x |
| **Comprehensive** | Exhaustive + manual review | 5min | 15x |

### 1.5 Progressive Disclosure Pattern

**Start Quick, Offer Deeper**

```typescript
// After quick response, offer upgrade
interface QuickResponseWithUpgrade {
  answer: string;
  confidence: number;
  upgradeOptions: {
    depth: 'standard' | 'deep';
    additionalInsights: string[];
    estimatedCost: number;
    estimatedTime: string;
  }[];
}

// Example response:
// "Based on cached data, Milwaukee dalys has LOW competition (estimate: 
//  achievable in 3-6 months).
//  
//  [🔍 Get live SERP data +$0.02] [📊 Full competitor analysis +$0.08]"
```

---

## 2. Context Injection Patterns

### 2.1 Context Injection Methods

| Method | Trigger | Example |
|--------|---------|---------|
| **Drag & Drop** | File drop zone | CSV keywords, competitor URLs |
| **Paste Detection** | Ctrl+V with URL/CSV | Auto-parse and attach |
| **@ Mentions** | `@` prefix | `@client`, `@audit`, `@keywords` |
| **Slash Commands** | `/` prefix | `/analyze`, `/propose`, `/compare` |
| **URL Auto-Extract** | URL in message | Parse domain, attach context |
| **File Upload** | Button click | Documents, spreadsheets |

### 2.2 @ Mention System

```typescript
// lib/seo-chat/mentions.ts

type MentionType = 
  | '@client'      // Load active client context
  | '@audit'       // Load recent audit data
  | '@keywords'    // Load tracked keywords
  | '@competitors' // Load competitor list
  | '@voice'       // Load brand voice profile
  | '@proposal'    // Load draft proposal
  | '@project';    // Load project settings

interface MentionResolver {
  resolve(mention: MentionType, workspaceId: string): Promise<ContextChunk>;
}

// Context chunks are injected into prompt
interface ContextChunk {
  type: MentionType;
  tokens: number;
  content: string;
  metadata: Record<string, unknown>;
}

// Example usage in chat:
// "Can @client rank for these @keywords in @competitors markets?"
// → Resolves to: client profile + tracked keywords + competitor domains
```

### 2.3 Paste Detection

```typescript
// lib/seo-chat/paste-handler.ts

interface PasteDetectionResult {
  type: 'url' | 'csv' | 'keywords' | 'text' | 'unknown';
  confidence: number;
  parsed: ParsedContent;
  suggestedAction?: string;
}

function detectPasteContent(text: string): PasteDetectionResult {
  // URL detection
  const urlMatch = text.match(/https?:\/\/[^\s]+/g);
  if (urlMatch) {
    return {
      type: 'url',
      confidence: 0.95,
      parsed: { urls: urlMatch.map(parseUrl) },
      suggestedAction: 'Analyze these domains?',
    };
  }
  
  // CSV detection (comma or tab separated with headers)
  if (looksLikeCSV(text)) {
    const parsed = parseCSV(text);
    return {
      type: 'csv',
      confidence: 0.85,
      parsed: { rows: parsed.rows, columns: parsed.columns },
      suggestedAction: `Import ${parsed.rows.length} keywords?`,
    };
  }
  
  // Keyword list (newline separated)
  if (looksLikeKeywordList(text)) {
    const keywords = text.split('\n').filter(Boolean);
    return {
      type: 'keywords',
      confidence: 0.80,
      parsed: { keywords },
      suggestedAction: `Analyze ${keywords.length} keywords?`,
    };
  }
  
  return { type: 'text', confidence: 1.0, parsed: { text } };
}
```

### 2.4 File Upload Processing

```typescript
// lib/seo-chat/file-processor.ts

type SupportedFileType = 
  | 'csv'           // Keyword lists, competitor URLs
  | 'xlsx'          // Spreadsheets
  | 'pdf'           // Documents, reports
  | 'txt'           // Plain text
  | 'json'          // Structured data
  | 'url-list';     // URLs to analyze

interface FileProcessingResult {
  success: boolean;
  fileType: SupportedFileType;
  summary: string;
  tokens: number;
  contextChunks: ContextChunk[];
  warnings?: string[];
}

async function processUploadedFile(file: File): Promise<FileProcessingResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'csv':
      return processCSV(file);
    case 'xlsx':
      return processExcel(file);
    case 'pdf':
      return processPDF(file);
    default:
      return processText(file);
  }
}

// Token budget enforcement
function enforceTokenBudget(
  chunks: ContextChunk[], 
  budget: number
): ContextChunk[] {
  let used = 0;
  const result: ContextChunk[] = [];
  
  // Priority order: client > keywords > audit > competitors > voice
  const prioritized = chunks.sort((a, b) => 
    PRIORITY_ORDER.indexOf(a.type) - PRIORITY_ORDER.indexOf(b.type)
  );
  
  for (const chunk of prioritized) {
    if (used + chunk.tokens <= budget) {
      result.push(chunk);
      used += chunk.tokens;
    } else {
      // Summarize remaining chunks
      const summarized = summarizeChunk(chunk, budget - used);
      if (summarized.tokens > 0) {
        result.push(summarized);
        break;
      }
    }
  }
  
  return result;
}
```

### 2.5 Context Injection UI

```
┌──────────────────────────────────────────────────────────────────────┐
│  Context attached:                                                   │
│  ┌────────┐  ┌────────┐  ┌────────────────────┐                     │
│  │ @client │  │ 📄 CSV │  │ 🔗 competitor.com │  [+ Add more]       │
│  │ Makita  │  │ 47 kw  │  │                    │                     │
│  └────────┘  └────────┘  └────────────────────┘                     │
│                                                                      │
│  Token budget: [████████░░░░░░░░░░░░] 8,234 / 32,000                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Can we rank for these keywords against the competitor?         │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. State Machine Architecture

### 3.1 Core States

```typescript
// lib/seo-chat/state-machine.ts

type ChatState = 
  | 'idle'              // Waiting for input
  | 'processing'        // Running analysis
  | 'awaiting_input'    // Need user decision
  | 'confirming'        // Awaiting action confirmation
  | 'executing'         // Running confirmed action
  | 'complete'          // Response delivered
  | 'error';            // Error state

type ChatEvent =
  | { type: 'SUBMIT'; query: string; context?: ContextChunk[] }
  | { type: 'UPLOAD'; file: File }
  | { type: 'MENTION'; mention: MentionType }
  | { type: 'SELECT_MODE'; mode: ChatMode }
  | { type: 'CONFIRM'; actionId: string }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }
  | { type: 'CLARIFY'; response: string }
  | { type: 'UPGRADE_DEPTH'; depth: DepthLevel };

interface ChatContext {
  sessionId: string;
  query: string;
  mode: ChatMode;
  depth: DepthLevel;
  contextChunks: ContextChunk[];
  pendingAction?: PendingAction;
  results?: AnalysisResult[];
  error?: Error;
  costAccumulated: number;
  tokensUsed: number;
}
```

### 3.2 State Transitions

```
                    ┌───────────────────────────────────────────┐
                    │                                           │
                    ▼                                           │
┌────────┐      ┌──────────────┐      ┌─────────────────┐      │
│  IDLE  │─────►│  PROCESSING  │─────►│    COMPLETE     │──────┘
└────────┘      └──────────────┘      └─────────────────┘
    ▲                  │                      │
    │                  │                      │
    │                  ▼                      │
    │           ┌──────────────┐              │
    │           │ AWAITING_    │              │
    │           │ INPUT        │──────────────┤
    │           └──────────────┘              │
    │                  │                      │
    │                  ▼                      │
    │           ┌──────────────┐              │
    │           │  CONFIRMING  │              │
    │           └──────────────┘              │
    │                  │                      │
    │                  ▼                      │
    │           ┌──────────────┐              │
    └───────────│  EXECUTING   │──────────────┘
                └──────────────┘
                       │
                       ▼
                ┌──────────────┐
                │    ERROR     │
                └──────────────┘
```

### 3.3 Flow Patterns

**Pattern 1: Linear (Simple Q&A)**
```
IDLE → PROCESSING → COMPLETE → IDLE
```

**Pattern 2: Branching (Decision Required)**
```
IDLE → PROCESSING → AWAITING_INPUT → [user selects] → PROCESSING → COMPLETE
```

**Pattern 3: Parallel (Concurrent Analysis)**
```
IDLE → PROCESSING ─┬─► Keyword Analysis ─┬─► COMPLETE
                   ├─► SERP Analysis     ─┤
                   └─► Backlink Check    ─┘
```

**Pattern 4: Nested (Sub-flows)**
```
IDLE → PROCESSING → [needs clarification] → 
  AWAITING_INPUT → [user clarifies] → 
    PROCESSING → [needs confirmation] →
      CONFIRMING → [user confirms] →
        EXECUTING → COMPLETE
```

### 3.4 State Machine Implementation

```typescript
// Using XState for type-safe state management
import { createMachine, assign } from 'xstate';

const seoChatMachine = createMachine({
  id: 'seoChat',
  initial: 'idle',
  context: {
    sessionId: '',
    query: '',
    mode: 'standard',
    depth: 'quick',
    contextChunks: [],
    results: [],
    costAccumulated: 0,
    tokensUsed: 0,
  } as ChatContext,
  states: {
    idle: {
      on: {
        SUBMIT: {
          target: 'processing',
          actions: assign({
            query: (_, event) => event.query,
            contextChunks: (_, event) => event.context ?? [],
          }),
        },
        UPLOAD: {
          target: 'processing',
          actions: 'processUpload',
        },
      },
    },
    processing: {
      invoke: {
        src: 'analyzeQuery',
        onDone: [
          {
            target: 'awaiting_input',
            cond: 'needsClarification',
          },
          {
            target: 'confirming',
            cond: 'needsConfirmation',
          },
          {
            target: 'complete',
            actions: assign({ results: (_, event) => event.data }),
          },
        ],
        onError: {
          target: 'error',
          actions: assign({ error: (_, event) => event.data }),
        },
      },
    },
    awaiting_input: {
      on: {
        CLARIFY: {
          target: 'processing',
          actions: 'incorporateClarification',
        },
        CANCEL: 'idle',
      },
    },
    confirming: {
      on: {
        CONFIRM: 'executing',
        CANCEL: 'complete',
      },
    },
    executing: {
      invoke: {
        src: 'executeAction',
        onDone: 'complete',
        onError: 'error',
      },
    },
    complete: {
      on: {
        SUBMIT: 'processing',
        UPGRADE_DEPTH: {
          target: 'processing',
          actions: assign({ depth: (_, event) => event.depth }),
        },
      },
      after: {
        // Auto-return to idle after 5 minutes of inactivity
        300000: 'idle',
      },
    },
    error: {
      on: {
        RETRY: 'processing',
        CANCEL: 'idle',
      },
    },
  },
});
```

---

## 4. Proposal Generation Workflow

### 4.1 The 7-Stage Proposal Pipeline

Based on artlitas-seo darbu eiga pattern, proposals follow a structured workflow:

| Stage | Name | Purpose | Output |
|-------|------|---------|--------|
| 1 | **Discovery** | Understand client needs | Problem statement |
| 2 | **Audit** | Technical/content analysis | Findings list |
| 3 | **Opportunity** | Identify ranking potential | Keyword matrix |
| 4 | **Strategy** | Define approach | Strategic pillars |
| 5 | **Roadmap** | Phase-by-phase plan | Timeline + deliverables |
| 6 | **Investment** | Pricing + ROI projection | Quote document |
| 7 | **Presentation** | Client-ready materials | PDF/slides |

### 4.2 Stage Transitions

```typescript
// lib/seo-chat/proposal-workflow.ts

interface ProposalStage {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'review' | 'complete' | 'skipped';
  data: unknown;
  completedAt?: Date;
  reviewedBy?: string;
}

interface ProposalWorkflow {
  id: string;
  prospectId: string;
  currentStage: number;
  stages: ProposalStage[];
  createdAt: Date;
  updatedAt: Date;
}

// Stage requirements
const STAGE_REQUIREMENTS: Record<number, string[]> = {
  1: ['prospect_url', 'target_keywords', 'business_goals'],
  2: ['discovery_complete'],
  3: ['audit_complete'],
  4: ['opportunity_analysis'],
  5: ['strategy_approved'],
  6: ['roadmap_approved'],
  7: ['investment_approved'],
};

// Validation before stage transition
function canAdvanceStage(workflow: ProposalWorkflow): {
  canAdvance: boolean;
  missing?: string[];
} {
  const currentStage = workflow.currentStage;
  const requirements = STAGE_REQUIREMENTS[currentStage + 1] ?? [];
  const missing = requirements.filter(req => !hasRequirement(workflow, req));
  
  return {
    canAdvance: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  };
}
```

### 4.3 Proposal Stage UI

```
┌──────────────────────────────────────────────────────────────────────┐
│  PROPOSAL: Meistrelio Kampas SEO                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Progress: ████████████░░░░░░░░░░░░░░░░ Stage 3 of 7                │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ ✓ 1. Discovery     │ ✓ 2. Audit     │ ● 3. Opportunity  │       │ │
│  │ ○ 4. Strategy      │ ○ 5. Roadmap   │ ○ 6. Investment   │       │ │
│  │ ○ 7. Presentation  │                 │                   │       │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Current: Opportunity Analysis                                       │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                      │
│  Analyzing 6 keywords against 5 competitors...                       │
│                                                                      │
│  [████████████░░░░░░░░] 60% — Backlink gap analysis                 │
│                                                                      │
│  Preliminary findings:                                               │
│  • Milwaukee keywords: LOW competition (Quick Win)                   │
│  • Makita remontas: MEDIUM competition (6-12 months)                 │
│  • 3 content gaps identified                                         │
│                                                                      │
│  [Pause] [Skip to Strategy] [View Details]                          │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.4 Proposal Chat Integration

```typescript
// lib/seo-chat/proposal-actions.ts

interface ProposalChatAction {
  type: 'proposal';
  subtype: 
    | 'start_proposal'
    | 'advance_stage'
    | 'request_review'
    | 'add_finding'
    | 'modify_timeline'
    | 'generate_document';
  payload: unknown;
}

// Chat understands proposal context
const PROPOSAL_INTENTS = [
  {
    pattern: /start.*proposal|create.*proposal|new.*proposal/i,
    action: 'start_proposal',
  },
  {
    pattern: /move.*next.*stage|advance|continue.*proposal/i,
    action: 'advance_stage',
  },
  {
    pattern: /add.*finding|include.*in.*audit/i,
    action: 'add_finding',
  },
  {
    pattern: /generate.*pdf|create.*document|export/i,
    action: 'generate_document',
  },
];

// Example chat interaction:
// User: "Start a proposal for meistreliokampas.lt with the 6 keywords we discussed"
// → Creates proposal workflow
// → Attaches context from conversation
// → Begins Discovery stage
```

---

## 5. Confirmation Workflow Tiers

### 5.1 The 5-Tier System

| Tier | Category | Confirmation UX | Examples |
|------|----------|-----------------|----------|
| **1** | Read-only | None | View data, show history |
| **2** | Reversible | Inline 3s auto-proceed | Track keyword, add note |
| **3** | Costly | Cost disclosure + confirm | SERP analysis, backlinks |
| **4** | Destructive | Full dialog + impact | Delete, archive |
| **5** | External | Preview modal | Send email, publish |

### 5.2 Decision Matrix

```typescript
// lib/seo-chat/action-classifier.ts

interface ActionClassification {
  tier: 1 | 2 | 3 | 4 | 5;
  category: 'read' | 'reversible' | 'costly' | 'destructive' | 'external';
  confirmationType: 'none' | 'inline' | 'cost' | 'dialog' | 'preview';
  estimatedCost?: number;
  impactDescription?: string;
}

const ACTION_CLASSIFICATIONS: Record<string, ActionClassification> = {
  // Tier 1: Read-only
  'view_keywords': { tier: 1, category: 'read', confirmationType: 'none' },
  'show_history': { tier: 1, category: 'read', confirmationType: 'none' },
  'get_cached_serp': { tier: 1, category: 'read', confirmationType: 'none' },
  
  // Tier 2: Reversible
  'track_keyword': { tier: 2, category: 'reversible', confirmationType: 'inline' },
  'add_note': { tier: 2, category: 'reversible', confirmationType: 'inline' },
  'categorize_keywords': { tier: 2, category: 'reversible', confirmationType: 'inline' },
  
  // Tier 3: Costly
  'live_serp_analysis': { 
    tier: 3, 
    category: 'costly', 
    confirmationType: 'cost',
    estimatedCost: 0.02,
  },
  'backlinks_analysis': { 
    tier: 3, 
    category: 'costly', 
    confirmationType: 'cost',
    estimatedCost: 0.05,
  },
  'keyword_research': { 
    tier: 3, 
    category: 'costly', 
    confirmationType: 'cost',
    estimatedCost: 0.03,
  },
  
  // Tier 4: Destructive
  'delete_keyword': { 
    tier: 4, 
    category: 'destructive', 
    confirmationType: 'dialog',
    impactDescription: 'Ranking history will be lost',
  },
  'archive_client': { 
    tier: 4, 
    category: 'destructive', 
    confirmationType: 'dialog',
    impactDescription: 'Client will be hidden from active views',
  },
  
  // Tier 5: External
  'send_report': { 
    tier: 5, 
    category: 'external', 
    confirmationType: 'preview',
  },
  'publish_to_cms': { 
    tier: 5, 
    category: 'external', 
    confirmationType: 'preview',
  },
  'trigger_indexnow': { 
    tier: 5, 
    category: 'external', 
    confirmationType: 'preview',
  },
};
```

### 5.3 Trust Progression

Users earn trust through successful actions:

```typescript
// lib/seo-chat/trust-system.ts

interface TrustProfile {
  score: number;                    // 0-100
  tier: 'new' | 'standard' | 'power' | 'admin';
  totalActions: number;
  successRate: number;
  autoApproveThreshold: number;     // cents
}

const TIER_THRESHOLDS: Record<string, Partial<ActionClassification>> = {
  new: {
    // Full confirmation for everything
  },
  standard: {
    // Reversible: auto-execute with undo
    // Costly: quick confirm
  },
  power: {
    // Costly < $0.10: auto-execute
    // Destructive: simplified dialog
  },
  admin: {
    // Costly < $1.00: auto-execute
    // External: condensed preview
  },
};
```

---

## 6. Cost Optimization Strategy

### 6.1 Grok 4.1 Migration Warning

**CRITICAL: Grok 4.1 retiring May 15, 2026**

| Model | Current | Migration Target | Cost Change |
|-------|---------|------------------|-------------|
| grok-4.1-fast | $0.20/1M | grok-4.3-flash | $0.30/1M (+50%) |
| grok-4.1-thinking | $2.00/1M | grok-4.3-reasoning | $1.25/1M (-37%) |

**Migration Plan**:
1. Abstract model selection behind `ModelRouter`
2. A/B test Grok 4.3 for 2 weeks before cutover
3. Update cost estimates in UI
4. Monitor quality regression

### 6.2 Prompt Caching Strategy

**Front-load static content for 75-84% savings**:

```typescript
// lib/seo-chat/prompt-builder.ts

interface CacheablePrompt {
  // STATIC: System prompt, examples, schema definitions
  // Cache these — they don't change between requests
  static: string;           // ~4000 tokens
  
  // SEMI-STATIC: Client context, voice profile
  // Cache per session — changes infrequently
  sessionContext: string;   // ~2000 tokens
  
  // DYNAMIC: User query, recent messages
  // Never cached — unique per request
  dynamic: string;          // ~500 tokens
}

// Anthropic prompt caching: 90% discount on cached tokens
// OpenAI/Grok: Use context caching headers

function buildPrompt(ctx: ChatContext): CacheablePrompt {
  return {
    static: SYSTEM_PROMPT + EXAMPLES + TOOL_SCHEMAS,
    sessionContext: ctx.contextChunks.map(c => c.content).join('\n'),
    dynamic: buildMessageHistory(ctx) + ctx.query,
  };
}
```

### 6.3 Conversation Summarization

**70% context reduction through smart summarization**:

```typescript
// lib/seo-chat/context-manager.ts

interface ConversationWindow {
  // Full messages (recent)
  recent: Message[];          // Last 3 messages
  
  // Summarized context (older)
  summary: string;            // Compressed history
  
  // Extracted entities
  entities: {
    domains: string[];
    keywords: string[];
    competitors: string[];
    decisions: string[];
  };
}

async function compressConversation(
  messages: Message[],
  maxTokens: number
): Promise<ConversationWindow> {
  if (estimateTokens(messages) <= maxTokens) {
    return { recent: messages, summary: '', entities: extractEntities(messages) };
  }
  
  // Keep last 3 messages intact
  const recent = messages.slice(-3);
  const older = messages.slice(0, -3);
  
  // Summarize older messages
  const summary = await summarizeMessages(older);
  
  return {
    recent,
    summary,
    entities: extractEntities(messages),
  };
}
```

### 6.4 Tool Result Compression

**Compress verbose API responses**:

```typescript
// lib/seo-chat/tool-compression.ts

interface ToolResultCompression {
  original: unknown;
  compressed: unknown;
  compressionRatio: number;
  lossless: boolean;
}

function compressToolResult(
  toolName: string,
  result: unknown
): ToolResultCompression {
  switch (toolName) {
    case 'serp_analysis':
      return compressSERPResult(result);
    case 'backlinks':
      return compressBacklinksResult(result);
    case 'keyword_research':
      return compressKeywordResult(result);
    default:
      return { original: result, compressed: result, compressionRatio: 1, lossless: true };
  }
}

function compressSERPResult(result: SERPResult): ToolResultCompression {
  // Original: full HTML snippets, all 100 results
  // Compressed: top 10 results, key metrics only
  const compressed = {
    query: result.query,
    top10: result.results.slice(0, 10).map(r => ({
      position: r.position,
      domain: r.domain,
      title: r.title.slice(0, 60),
      da: r.domainAuthority,
    })),
    totalResults: result.totalResults,
    features: result.serpFeatures,
  };
  
  return {
    original: result,
    compressed,
    compressionRatio: JSON.stringify(compressed).length / JSON.stringify(result).length,
    lossless: false,
  };
}
```

### 6.5 Cost Tracking Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│  SEO Chat Usage — May 2026                                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Total Spend: $12.47                    Queries: 847                 │
│  ════════════════════════════════════════════════════════════════   │
│                                                                      │
│  By Mode:                                                            │
│  ─────────────────────────────────────────────────────────────────   │
│  Quick       ████████████████████████████████  $2.14  (645 queries) │
│  Standard    ████████████                      $4.82  (156 queries) │
│  Deep        ████████                          $3.21  (32 queries)  │
│  Prospect    ████                              $1.89  (11 queries)  │
│  Client      ██                                $0.41  (3 queries)   │
│                                                                      │
│  By Cost Component:                                                  │
│  ─────────────────────────────────────────────────────────────────   │
│  LLM tokens          ████████████████          $5.23  (42%)         │
│  DataForSEO          ████████████              $4.12  (33%)         │
│  Backlinks API       ██████                    $2.11  (17%)         │
│  Other               ██                        $1.01  (8%)          │
│                                                                      │
│  Cache Hit Rate: 73%    Estimated Savings: $31.82                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. World-Class UX Patterns

### 7.1 Competitive Analysis

Analysis of 7 best-in-class products:

| Product | Key Pattern | Adopt? |
|---------|-------------|--------|
| **ChatGPT** | Canvas for editing, memory system | Yes - canvas for proposals |
| **Claude** | Artifacts, project context | Yes - context injection |
| **Perplexity** | Source citations, follow-up suggestions | Yes - SERP citations |
| **Linear** | Command palette, keyboard-first | Yes - Cmd+K integration |
| **Superhuman** | Split inbox, AI triage | Partial - smart routing |
| **Notion AI** | Inline AI, block-level operations | Yes - inline suggestions |
| **Cursor** | Context-aware completion, codebase indexing | Yes - SEO-aware completion |

### 7.2 Interaction Patterns

**Pattern 1: Streaming with Stage Indicators**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Analyzing meistreliokampas.lt for 6 keywords...                     │
│                                                                      │
│  [✓] Domain authority check — DA 28, age 5 years                    │
│  [✓] SERP analysis — 4/6 keywords have moderate competition         │
│  [●] Competitor gap analysis — comparing against 5 competitors      │
│  [ ] Backlink profile — pending                                      │
│  [ ] Content gap scan — pending                                      │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                      │
│  Preliminary: Milwaukee keywords show lowest competition.            │
│  Recommend starting there for quick wins.                            │
│                                                                      │
│  ▼ [Show live data stream]                                          │
└──────────────────────────────────────────────────────────────────────┘
```

**Pattern 2: Smart Follow-ups**

```typescript
// After each response, suggest relevant follow-ups
interface FollowUpSuggestion {
  text: string;
  intent: string;
  estimatedCost: number;
  confidence: number;
}

const FOLLOW_UP_TEMPLATES: Record<string, FollowUpSuggestion[]> = {
  'feasibility_check': [
    { text: 'Show me the top competitors', intent: 'competitor_analysis', estimatedCost: 0.02 },
    { text: 'What content should I create first?', intent: 'content_gap', estimatedCost: 0.05 },
    { text: 'Create a proposal from this', intent: 'start_proposal', estimatedCost: 0.15 },
  ],
  'competitor_analysis': [
    { text: 'How do their backlinks compare?', intent: 'backlink_gap', estimatedCost: 0.08 },
    { text: 'What keywords are they ranking for that I\'m not?', intent: 'keyword_gap', estimatedCost: 0.05 },
  ],
};
```

**Pattern 3: Inline Entity Detection**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Can [meistreliokampas.lt] rank for [Milwaukee dalys] in [Lithuania]?│
│       └── Domain ────────┘       └── Keyword ───┘      └── Geo ─┘   │
│                                                                      │
│  Detected entities:                                                  │
│  ┌─────────────────┐ ┌──────────────────┐ ┌────────────────────┐    │
│  │ 🌐 Domain       │ │ 🔍 Keyword       │ │ 📍 Location        │    │
│  │ meistreliokam...│ │ Milwaukee dalys  │ │ Lithuania          │    │
│  │ [Edit]          │ │ [Add more]       │ │ [Change]           │    │
│  └─────────────────┘ └──────────────────┘ └────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.3 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+J` | Open/focus chat |
| `Cmd+K` | Command palette |
| `Cmd+Enter` | Send message |
| `Cmd+Shift+Enter` | Send with Deep mode |
| `Cmd+.` | Cancel current operation |
| `Cmd+/` | Show shortcuts |
| `Escape` | Close/cancel |
| `Tab` | Accept suggestion |
| `↑` | Edit last message |

### 7.4 Mobile Adaptation

```
┌────────────────────────────────────┐
│  ← SEO Chat                   ···  │
├────────────────────────────────────┤
│                                    │
│  ┌────────────────────────────┐   │
│  │ You                        │   │
│  │ Can meistreliokampas.lt   │   │
│  │ rank for Milwaukee dalys? │   │
│  └────────────────────────────┘   │
│                                    │
│  ┌────────────────────────────┐   │
│  │ Assistant                  │   │
│  │                            │   │
│  │ ✓ YES — High potential    │   │
│  │                            │   │
│  │ Score: 85/100 ●●●●○        │   │
│  │ Timeline: 3-6 months       │   │
│  │                            │   │
│  │ Key factors:               │   │
│  │ • Low competition          │   │
│  │ • Strong product catalog   │   │
│  │ • Missing landing page     │   │
│  │                            │   │
│  │ [Track] [Analyze] [More]   │   │
│  └────────────────────────────┘   │
│                                    │
├────────────────────────────────────┤
│  [📎] Ask about SEO...      [↑]   │
│  [Quick ▾]                        │
└────────────────────────────────────┘
```

---

## 8. System Integration

### 8.1 CopilotKit Integration Status

| Feature | CopilotKit Support | Gap | Solution |
|---------|-------------------|-----|----------|
| Chat UI | ✓ CopilotPopup | Limited customization | Custom chat component |
| Tool calls | ✓ useCopilotAction | No confirmation workflow | Wrap with confirmation layer |
| Context | ✓ useCopilotReadable | Manual injection | Custom context provider |
| Streaming | ✓ Built-in | No stage indicators | Custom SSE handler |
| History | ✗ Not built-in | — | Custom persistence |
| Modes | ✗ Not built-in | — | Custom mode system |

### 8.2 Architecture Decision

**Recommendation: Hybrid Approach**

1. Use CopilotKit for:
   - Tool registration and execution
   - Basic message handling
   - LLM provider abstraction

2. Custom implementation for:
   - Chat UI (full v6 design system compliance)
   - Mode/depth selection
   - Context injection
   - Confirmation workflows
   - Session persistence
   - Cost tracking

```typescript
// lib/copilot/custom-provider.tsx

export function SEOChatProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilot">
      <SEOModeProvider>
        <SEOContextProvider>
          <SEOConfirmationProvider>
            <SEOChatUI>
              {children}
            </SEOChatUI>
          </SEOConfirmationProvider>
        </SEOContextProvider>
      </SEOModeProvider>
    </CopilotKit>
  );
}
```

### 8.3 Existing Infrastructure Leverage

| Component | Location | Reuse |
|-----------|----------|-------|
| SSE Streaming | `lib/keyword-chat/stage-emitter.ts` | 100% |
| DataForSEO Client | `open-seo-main/lib/dataforseoClient.ts` | 100% |
| Competitor Analysis | `open-seo-main/features/keywords/CompetitorSpyService.ts` | 80% |
| SERP Cache | `open-seo-main/lib/cache/serp-cache.ts` | 100% |
| Voice Profile | `AI-Writer/alwrity_voice_profiles.py` | Via API |
| Article Generation | `AI-Writer/alwrity_long_form_ai_writer.py` | Via API |

### 8.4 Database Schema

```sql
-- Session management
CREATE TABLE seo_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  client_id UUID,                    -- Optional client context
  title TEXT NOT NULL,
  mode TEXT DEFAULT 'standard',
  total_cost_cents INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages with full context
CREATE TABLE seo_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES seo_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context_chunks JSONB,              -- Attached context
  tool_calls JSONB,                  -- Tool invocations
  cost_cents INTEGER DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  model TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Action audit log
CREATE TABLE seo_chat_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES seo_chat_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES seo_chat_messages(id),
  action_type TEXT NOT NULL,
  action_category TEXT NOT NULL,
  params JSONB,
  result JSONB,
  cost_cents INTEGER DEFAULT 0,
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  undone_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences
CREATE TABLE seo_chat_preferences (
  user_id TEXT PRIMARY KEY,
  default_mode TEXT DEFAULT 'standard',
  auto_approve_limit_cents INTEGER DEFAULT 0,
  daily_limit_cents INTEGER DEFAULT 500,
  always_allow TEXT[] DEFAULT '{}',
  never_auto_execute TEXT[] DEFAULT '{}',
  show_cost_badges BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_workspace ON seo_chat_sessions(workspace_id);
CREATE INDEX idx_sessions_client ON seo_chat_sessions(client_id);
CREATE INDEX idx_messages_session ON seo_chat_messages(session_id);
CREATE INDEX idx_actions_session ON seo_chat_actions(session_id);
```

---

## 9. Streaming Architecture

### 9.1 SSE Event Types

```typescript
// lib/seo-chat/sse-events.ts

type SSEEventType =
  | 'stage_start'       // Analysis stage beginning
  | 'stage_progress'    // Progress update within stage
  | 'stage_complete'    // Stage finished
  | 'partial_result'    // Streaming text/data
  | 'entity_detected'   // URL/keyword/domain found
  | 'action_pending'    // Action needs confirmation
  | 'action_complete'   // Action executed
  | 'error'             // Error occurred
  | 'complete'          // All stages done
  | 'cost_update';      // Running cost total

interface SSEEvent {
  type: SSEEventType;
  timestamp: number;
  data: unknown;
}

// Example event stream:
// { type: 'stage_start', data: { stage: 'domain_analysis', estimatedMs: 2000 } }
// { type: 'stage_progress', data: { stage: 'domain_analysis', progress: 0.5 } }
// { type: 'partial_result', data: { text: 'Domain authority is 28...' } }
// { type: 'stage_complete', data: { stage: 'domain_analysis', result: { da: 28 } } }
// { type: 'cost_update', data: { totalCents: 2 } }
// { type: 'complete', data: { summary: '...', actions: [...] } }
```

### 9.2 Client-Side Handler

```typescript
// hooks/useSEOChatStream.ts

interface StreamState {
  status: 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';
  stages: StageProgress[];
  partialResponse: string;
  entities: DetectedEntity[];
  pendingActions: PendingAction[];
  cost: number;
  error?: Error;
}

function useSEOChatStream() {
  const [state, dispatch] = useReducer(streamReducer, initialState);
  
  const send = useCallback(async (query: string, options: SendOptions) => {
    dispatch({ type: 'START_STREAM' });
    
    const response = await fetch('/api/seo-chat/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options }),
    });
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const events = parseSSEChunk(chunk);
      
      for (const event of events) {
        dispatch({ type: 'SSE_EVENT', event });
      }
    }
    
    dispatch({ type: 'STREAM_COMPLETE' });
  }, []);
  
  return { state, send };
}
```

### 9.3 Streaming Cost Model

**Grok 4.1/4.3: Streaming = Batching cost**

Unlike some providers, Grok charges the same for streaming and batched responses:

```typescript
// No streaming penalty — use freely
const STREAMING_COST_MULTIPLIER = 1.0;

// Benefits of streaming:
// 1. Better UX — progressive disclosure
// 2. Cancelability — stop early if wrong direction
// 3. Stage visibility — user sees progress
// 4. Partial results — useful even if incomplete
```

---

## 10. Implementation Roadmap

### 10.1 Phase 1: Core Infrastructure (Week 1-2)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | State machine setup | `lib/seo-chat/state-machine.ts` |
| 2 | Mode system | `lib/seo-chat/mode-system.ts` |
| 3 | Context injection framework | `lib/seo-chat/context-manager.ts` |
| 4-5 | SSE streaming endpoint | `api/seo-chat/analyze/route.ts` |

**Milestone**: Basic chat with mode selection, no actions

### 10.2 Phase 2: Analysis Pipeline (Week 3-4)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Intent classifier | `lib/seo-chat/intent-classifier.ts` |
| 3 | Feasibility scorer | `lib/seo-chat/feasibility-scorer.ts` |
| 4-5 | DataForSEO integration | `lib/seo-chat/data-fetchers.ts` |
| 6-7 | Response generator | `lib/seo-chat/response-generator.ts` |

**Milestone**: Feasibility checks for single/multi keywords

### 10.3 Phase 3: UI Components (Week 5-6)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Chat panel (v6 tokens) | `components/seo-chat/ChatPanel.tsx` |
| 3 | Mode selector | `components/seo-chat/ModeSelector.tsx` |
| 4 | Stage progress | `components/seo-chat/StageProgress.tsx` |
| 5 | Response cards | `components/seo-chat/ResponseCard.tsx` |
| 6-7 | Context chips | `components/seo-chat/ContextChips.tsx` |

**Milestone**: Full UI with streaming responses

### 10.4 Phase 4: Confirmation & Actions (Week 7-8)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Confirmation tier system | `lib/seo-chat/confirmation-system.ts` |
| 3 | Action executor | `lib/seo-chat/action-executor.ts` |
| 4-5 | Undo stack | `lib/seo-chat/undo-stack.ts` |
| 6-7 | Cost tracking | `lib/seo-chat/cost-tracker.ts` |

**Milestone**: Full action execution with confirmations

### 10.5 Phase 5: Context & History (Week 9-10)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | @ mention system | `lib/seo-chat/mentions.ts` |
| 3 | File upload handler | `lib/seo-chat/file-processor.ts` |
| 4-5 | Session persistence | `lib/seo-chat/session-manager.ts` |
| 6-7 | Conversation history | `components/seo-chat/History.tsx` |

**Milestone**: Full context injection + history

### 10.6 Phase 6: Proposal Integration (Week 11-12)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-3 | Proposal workflow engine | `lib/seo-chat/proposal-workflow.ts` |
| 4-5 | Stage UI | `components/seo-chat/ProposalStages.tsx` |
| 6-7 | Document generation | `lib/seo-chat/proposal-generator.ts` |

**Milestone**: Full proposal workflow from chat

### 10.7 Phase 7: Polish & Migration (Week 13-14)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Grok 4.3 migration | Updated model config |
| 3-4 | Cost dashboard | `components/seo-chat/CostDashboard.tsx` |
| 5-6 | Mobile optimization | Responsive components |
| 7 | E2E tests | Test suite |

**Milestone**: Production-ready, Grok 4.3 compatible

---

## Appendix A: Token Budget Reference

| Context Type | Typical Tokens | Priority |
|--------------|----------------|----------|
| System prompt | 2,000 | 1 (always) |
| Client profile | 500-1,000 | 2 |
| Voice profile | 300-500 | 3 |
| Recent messages (3) | 1,000-2,000 | 4 |
| Conversation summary | 500-1,000 | 5 |
| Attached keywords | 100-500 | 6 |
| Audit findings | 500-2,000 | 7 |
| Competitor data | 500-1,500 | 8 |

**Total Budget by Mode**:
- Quick: 4K tokens
- Standard: 8K tokens
- Deep: 16K tokens
- Prospect: 32K tokens
- Client: 24K tokens

---

## Appendix B: Error Codes

| Code | Category | Description | Recovery |
|------|----------|-------------|----------|
| `RATE_LIMITED` | API | DataForSEO rate limit | Retry with backoff |
| `COST_LIMIT` | Cost | Daily cost limit reached | Wait for reset |
| `CONTEXT_OVERFLOW` | Context | Token budget exceeded | Summarize context |
| `MODEL_UNAVAILABLE` | API | Model endpoint down | Fallback to backup |
| `PARSE_ERROR` | Input | Cannot parse user input | Request clarification |
| `ACTION_FAILED` | Action | Action execution failed | Offer retry |
| `CONFIRMATION_TIMEOUT` | Action | Confirmation expired | Re-request |

---

## Appendix C: Design System Tokens (v6)

```css
/* SEO Chat specific tokens */
.seo-chat {
  --chat-bg: var(--surface);
  --chat-border: var(--border);
  --chat-input-bg: var(--surface-2);
  --chat-message-user: var(--surface-2);
  --chat-message-assistant: var(--surface);
  --chat-stage-pending: var(--text-3);
  --chat-stage-active: var(--accent);
  --chat-stage-complete: var(--success);
  --chat-cost-low: var(--success);
  --chat-cost-medium: var(--warning);
  --chat-cost-high: var(--error);
  --chat-radius: var(--radius-card);
  --chat-shadow: var(--shadow-card);
}

/* Mode colors */
.mode-quick { --mode-color: #10B981; }
.mode-standard { --mode-color: #3B82F6; }
.mode-deep { --mode-color: #8B5CF6; }
.mode-prospect { --mode-color: #F59E0B; }
.mode-client { --mode-color: #EC4899; }
```

---

*Document consolidates research from 10 Opus subagents*
*Phase: 98-general-seo-chat*
*Generated: 2026-05-09*
*Status: Ready for Implementation*
