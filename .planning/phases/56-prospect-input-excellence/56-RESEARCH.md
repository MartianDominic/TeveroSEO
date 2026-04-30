# Phase 56: Prospect Input Excellence - Research

**Researched:** 2026-04-30
**Domain:** Prospect Creation Flow, AI Text Extraction, Server-Sent Events (SSE)
**Confidence:** HIGH

## Summary

Phase 56 transforms the prospect creation experience from a basic domain-entry form into an intelligent multi-modal input system. The core value proposition is "paste anything, get brilliant insights" -- users can paste conversation transcripts, email threads, or sales call notes and have AI extract structured business information.

The existing codebase provides solid foundations: `AddProspectDialog.tsx` handles basic prospect creation, `ProspectService.ts` manages CRUD with domain validation, and `PlatformDetector.ts` already implements platform fingerprinting (WordPress, Shopify, Wix, Squarespace, Webflow). The Claude API integration pattern is established in `voice.ts` using `@anthropic-ai/sdk` with Zod schema validation for structured outputs.

**Primary recommendation:** Extend the existing `AddProspectDialog.tsx` with a tab-based mode selector (Website URL / Website + Context / Conversation Only), implement a `ConversationExtractor` service using Claude's structured outputs with Zod validation, add a confirmation step with inline editing before analysis proceeds, and use Next.js Route Handlers with Web Streams API for real-time progress feedback.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- discuss phase skipped per user request.

### Claude's Discretion
All implementation choices are at Claude's discretion. Use ROADMAP phase goal, success criteria, DESIGN.md specifications, and codebase conventions to guide decisions.

Key guidance from DESIGN.md:
- Three input modes: Website URL, Website + Context, Conversation Only
- Confirmation flow required before analysis proceeds
- SSE for real-time progress feedback
- v6 design system tokens and patterns

### Deferred Ideas (OUT OF SCOPE)
None -- discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | Add Prospect button is enabled and functional | Existing `AddProspectDialog.tsx` has all components; issue is likely state or validation logic |
| SC-2 | Three input modes work: website URL, website + context, conversation dump | @tevero/ui Tabs component + mode-specific form components |
| SC-3 | AI extraction from conversation produces: business name, industry, services, keywords | Claude SDK + Zod structured outputs pattern from `voice.ts` |
| SC-4 | Confirmation screen shows before analysis with edit capability | StepWizard compound component from @tevero/ui |
| SC-5 | Real-time progress feedback shows during analysis (SSE) | Next.js Route Handlers with Web Streams API |
| SC-6 | Platform detection identifies WordPress, Shopify, Wix, etc. | `PlatformDetector.ts` already implemented |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mode selection UI | Browser / Client | -- | Client-side state, no server interaction needed |
| Form validation | Browser / Client | API / Backend | Immediate feedback in browser, final validation on server |
| AI extraction (conversation) | API / Backend | -- | LLM calls must be server-side (API key protection) |
| Confirmation editing | Browser / Client | -- | Pure UI state until final submission |
| SSE progress stream | API / Backend | Browser / Client | Server pushes events, client subscribes |
| Platform detection | API / Backend | -- | Requires fetching external URLs (CORS) |
| Prospect creation | API / Backend | Database | Server action -> Drizzle ORM -> PostgreSQL |
| i18n translation | Browser / Client | -- | next-intl handles client-side string resolution |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | 0.92.0 | Claude API for AI extraction | [VERIFIED: npm registry] Already in open-seo-main, production-proven |
| @tevero/ui | workspace | UI components (Dialog, Tabs, StepWizard) | [VERIFIED: codebase] Shared design system with v6 tokens |
| next-intl | 4.11.0 | i18n for EN/LT support | [VERIFIED: codebase] Already configured in apps/web |
| zod | 4.3.6 | Schema validation | [VERIFIED: codebase] Already used throughout for validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | 5.0.12 | Client state management | [VERIFIED: codebase] For multi-step wizard state |
| @tanstack/react-query | 5.99.0 | Server state / mutations | [VERIFIED: codebase] For progress polling fallback |
| lucide-react | 1.14.0 | Icons | [VERIFIED: codebase] Consistent iconography |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SSE (Web Streams) | Socket.IO | SSE simpler for unidirectional; Socket.IO already in deps but overkill for this use case |
| Zustand | React Context | Context causes unnecessary re-renders; wizard state benefits from Zustand's selective subscriptions |
| Claude SDK | Vercel AI SDK | Vercel AI SDK has streaming helpers but Claude SDK is already integrated with working patterns |

**Installation:**
No new packages required. All dependencies already present in apps/web and open-seo-main.

**Version verification:** [VERIFIED: npm registry 2026-04-30]
- @anthropic-ai/sdk: 0.92.0 (latest, published 2026-04-28)
- next: 15.5.15 in use, 16.2.4 available (minor update possible but not required)
- next-intl: 4.11.0 (matches installed)
- zod: 4.3.6 in use, 4.4.1 available (patch update possible)

## Architecture Patterns

### System Architecture Diagram

```
User Input                   Multi-Step Flow                     Backend Processing
============                 ===============                     ==================

[Add Prospect]               [Mode Selection]                    
     |                            |                              
     v                            v                              
+---------------+           +---------------+                    
| Mode Selector |--Website->| URL Input     |--submit----------->+
| (Tabs)        |           +---------------+                    |
|               |--Website+->| URL + Notes  |--submit----------->|
|               |  Context   +---------------+                   |
|               |--Convo--->| Textarea      |--submit----------->|
+---------------+  Only      +---------------+                   |
                                  |                              |
                                  v                              |
                            [SSE Progress]<--events--------------+
                                  |                              |
                                  |   +---------------------------+
                                  |   |                           
                                  v   v                           
                            +---------------+                    +-----------------------+
                            | Confirmation  |<---extracted data--| ConversationExtractor |
                            | Screen        |                    | (Claude API)          |
                            | (Editable)    |                    +-----------------------+
                            +---------------+                              |
                                  |                              +-----------------------+
                                  |--confirm----------------->   | ProspectService       |
                                  |                              | (create + analyze)    |
                                  v                              +-----------------------+
                            [Prospect Detail]                              |
                                                                          v
                                                                 [PostgreSQL]
```

### Data Flow

1. **Input Phase**: User selects mode -> enters data -> clicks "Analyze"
2. **Extraction Phase**: Server receives input -> calls Claude for extraction (conversation mode) or scrapes website
3. **Progress Phase**: SSE stream pushes stage updates to client
4. **Confirmation Phase**: Client displays extracted data -> user edits inline -> clicks "Confirm"
5. **Analysis Phase**: Server creates prospect with confirmed data -> queues full analysis

### Recommended Project Structure
```
apps/web/src/
├── app/(shell)/prospects/
│   ├── actions.ts                    # Extended with new action
│   └── api/
│       └── progress/
│           └── [prospectId]/
│               └── route.ts          # SSE endpoint
├── components/prospects/
│   ├── AddProspectModal.tsx          # Replaces AddProspectDialog
│   ├── WebsiteInputForm.tsx          # Mode 1
│   ├── WebsiteContextForm.tsx        # Mode 2
│   ├── ConversationInputForm.tsx     # Mode 3
│   ├── AnalysisProgress.tsx          # Progress display
│   ├── ExtractionConfirmation.tsx    # Confirmation/edit screen
│   └── KeywordSelector.tsx           # Checkbox keyword list
└── stores/
    └── prospect-wizard-store.ts      # Zustand store for wizard state

open-seo-main/src/server/features/prospects/services/
├── ConversationExtractor.ts          # AI extraction service
├── ExtractionConfirmationService.ts  # Confirmation flow logic
└── ProgressBroadcaster.ts            # SSE event emitter
```

### Pattern 1: Claude Structured Outputs with Zod
**What:** Use `messages.parse()` with `zodOutputFormat()` for type-safe AI responses
**When to use:** Any AI extraction that requires structured data
**Example:**
```typescript
// Source: https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic();

const ExtractionSchema = z.object({
  businessName: z.string(),
  industry: z.string(),
  services: z.array(z.string()),
  keywords: z.array(z.string()),
  targetAudience: z.string().optional(),
  location: z.string().optional(),
  confidence: z.number().min(0).max(100),
});

const message = await client.messages.parse({
  model: 'claude-sonnet-4-5',
  max_tokens: 2048,
  messages: [{ role: 'user', content: `Extract business information from this conversation:\n\n${transcript}` }],
  output_config: {
    format: zodOutputFormat(ExtractionSchema),
  },
});

const extraction = message.parsed_output; // Typed as z.infer<typeof ExtractionSchema>
```

### Pattern 2: SSE with Next.js Route Handlers
**What:** Server-Sent Events using Web Streams API
**When to use:** Real-time progress updates for long-running operations
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/guides/streaming
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE events
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      sendEvent('stage', { stage: 'connecting', progress: 10 });
      // ... perform work
      sendEvent('stage', { stage: 'crawling', progress: 30 });
      // ... perform work
      sendEvent('complete', { extractedData });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
```

### Pattern 3: Multi-Step Wizard with Zustand
**What:** State machine for wizard steps with persistence
**When to use:** Complex forms with multiple steps and intermediate state
**Example:**
```typescript
// Source: Codebase pattern (zustand already in use)
import { create } from 'zustand';

type WizardStep = 'input' | 'progress' | 'confirmation' | 'complete';
type InputMode = 'website' | 'website_with_context' | 'conversation';

interface ProspectWizardState {
  step: WizardStep;
  mode: InputMode;
  formData: Record<string, unknown>;
  extractedData: ExtractionResult | null;
  setStep: (step: WizardStep) => void;
  setMode: (mode: InputMode) => void;
  setFormData: (data: Partial<Record<string, unknown>>) => void;
  setExtractedData: (data: ExtractionResult) => void;
  reset: () => void;
}

export const useProspectWizardStore = create<ProspectWizardState>((set) => ({
  step: 'input',
  mode: 'website',
  formData: {},
  extractedData: null,
  setStep: (step) => set({ step }),
  setMode: (mode) => set({ mode }),
  setFormData: (data) => set((state) => ({ formData: { ...state.formData, ...data } })),
  setExtractedData: (data) => set({ extractedData: data }),
  reset: () => set({ step: 'input', mode: 'website', formData: {}, extractedData: null }),
}));
```

### Anti-Patterns to Avoid
- **Client-side API key exposure:** NEVER call Claude API from the browser; all LLM calls must go through server actions or API routes [CITED: Anthropic SDK docs]
- **Polling instead of SSE:** Don't use setInterval polling when SSE is available; it wastes bandwidth and adds latency
- **Unvalidated AI outputs:** Always use Zod schemas with `messages.parse()` to validate AI responses before using them
- **Missing error boundaries:** Long-running operations must handle network failures, timeouts, and partial failures gracefully

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE protocol | Custom event formatting | Web Streams API + standard SSE format | Reconnection, event parsing handled by browser |
| Text extraction prompts | Ad-hoc string concatenation | Structured prompt templates | Consistency, testability, version control |
| Form wizard state | useState chains | Zustand store | Persistence across re-renders, DevTools debugging |
| Platform detection | New regex patterns | Existing `PlatformDetector.ts` | Already handles 5 platforms with weighted scoring |
| Modal animations | CSS transitions | @tevero/ui Dialog + Radix | Accessibility, focus trap, keyboard navigation |

**Key insight:** The codebase already has well-tested patterns for AI integration (voice.ts), platform detection (PlatformDetector.ts), and server actions (prospects/actions.ts). Extend these rather than creating parallel implementations.

## Common Pitfalls

### Pitfall 1: SSE Connection Drops
**What goes wrong:** Browser EventSource connections timeout after ~30-60 seconds of inactivity
**Why it happens:** SSE requires periodic keep-alive messages; long operations exceed browser timeout
**How to avoid:** Send heartbeat events every 15 seconds during long operations
**Warning signs:** Progress updates stop mid-operation, users report "stuck" state

### Pitfall 2: AI Extraction Hallucination
**What goes wrong:** Claude generates plausible-sounding but incorrect business information
**Why it happens:** Insufficient context in conversation, ambiguous text, or leading questions
**How to avoid:** Always require user confirmation before using extracted data; show confidence scores
**Warning signs:** Users frequently correct AI extractions, low confidence scores

### Pitfall 3: Form State Loss on Navigation
**What goes wrong:** User navigates away mid-wizard and loses all entered data
**Why it happens:** React component state resets on unmount
**How to avoid:** Persist wizard state to Zustand (sessionStorage-backed); warn on navigation
**Warning signs:** Support tickets about "lost work"

### Pitfall 4: i18n Key Collisions
**What goes wrong:** New translation keys shadow existing keys or get overwritten
**Why it happens:** Phase 55 added 254 keys; new keys may conflict
**How to avoid:** Namespace new keys under `prospects.wizard.*`; check existing en.json before adding
**Warning signs:** TypeScript errors on t() calls, wrong strings appearing in UI

### Pitfall 5: Confirmation Bypass
**What goes wrong:** Analysis runs without user confirmation, using potentially incorrect AI extractions
**Why it happens:** Race condition between "Analyze" click and confirmation step
**How to avoid:** Require explicit `confirmationStatus: 'confirmed'` before proceeding to analysis
**Warning signs:** Users report "I didn't approve that" or incorrect data in reports

## Code Examples

### Server Action for Extraction
```typescript
// Source: Codebase pattern from apps/web/src/app/(shell)/prospects/actions.ts
"use server";

import { requireActionAuth, type ActionResult } from "@/lib/auth/action-auth";
import { z } from "zod";

const extractFromConversationSchema = z.object({
  content: z.string().min(50, "Conversation too short for extraction").max(50000, "Content too long"),
  inputMode: z.enum(["website", "website_with_context", "conversation"]),
  domain: z.string().optional(),
});

export async function extractFromConversationAction(
  data: z.infer<typeof extractFromConversationSchema>
): Promise<ActionResult<ExtractionResult>> {
  await requireActionAuth();

  const validated = extractFromConversationSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid input" };
  }

  // Call open-seo-main backend
  const result = await postOpenSeo<ExtractionResult>(
    "/api/prospects/extract",
    validated.data
  );

  return { success: true, data: result };
}
```

### Confirmation Component Pattern
```typescript
// Source: v6 design system patterns from packages/ui
"use client";

import { useState } from "react";
import { Input, Label, Checkbox, Button } from "@tevero/ui";
import { useTranslations } from "next-intl";

interface ConfirmationProps {
  extraction: ExtractionResult;
  onConfirm: (data: ConfirmedData) => void;
  onReanalyze: () => void;
}

export function ExtractionConfirmation({ extraction, onConfirm, onReanalyze }: ConfirmationProps) {
  const t = useTranslations("prospects.wizard");
  const [editedData, setEditedData] = useState(extraction);

  return (
    <div className="space-y-[var(--space-5)]">
      <h2 className="text-[length:var(--type-h2)] font-medium text-text-1">
        {t("confirmTitle")}
      </h2>

      <div className="space-y-[var(--space-4)]">
        <div className="space-y-[var(--space-2)]">
          <Label htmlFor="businessName">{t("businessName")}</Label>
          <Input
            id="businessName"
            value={editedData.businessName}
            onChange={(e) => setEditedData({ ...editedData, businessName: e.target.value })}
          />
        </div>
        {/* ... more fields */}
      </div>

      <div className="flex justify-between pt-[var(--space-5)] border-t border-hairline">
        <Button variant="ghost" onClick={onReanalyze}>
          {t("reanalyze")}
        </Button>
        <Button onClick={() => onConfirm(editedData)}>
          {t("confirmAndContinue")}
        </Button>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tool use for structured output | `messages.parse()` with Zod | Anthropic SDK 0.90+ (Apr 2026) | Direct schema validation, no tool parsing needed |
| Pages Router API routes | App Router Route Handlers | Next.js 13+ (stable in 15.x) | Native streaming, edge support |
| Manual SSE implementation | Web Streams API | Chrome 89+, Node 18+ | Standard interface, proper backpressure |

**Deprecated/outdated:**
- `messages.create()` + manual JSON parsing: Use `messages.parse()` with `zodOutputFormat()` for guaranteed type safety
- `res.write()` for SSE (Pages Router): Use `ReadableStream` in Route Handlers
- `@radix-ui/react-tabs@0.x`: Upgrade to 1.1.x for improved accessibility

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Add Prospect button is disabled due to form validation state, not backend issue | Summary | May need backend changes if API actually broken |
| A2 | Claude sonnet-4-5 model is appropriate for extraction tasks | Code Examples | May need haiku for cost or opus for quality |
| A3 | 50 character minimum for conversation extraction is reasonable | Code Examples | May be too short, users may submit fragments |

## Open Questions

1. **Rate limiting for AI extraction**
   - What we know: Current analysis has 10/day/workspace limit
   - What's unclear: Should extraction (pre-analysis) count against this quota?
   - Recommendation: Extraction is lightweight (single Claude call); don't count against quota, but add a separate extraction rate limit (e.g., 50/day)

2. **Extraction confidence threshold**
   - What we know: Claude returns confidence scores
   - What's unclear: Below what threshold should we require manual entry instead?
   - Recommendation: Below 60% confidence, show warning but still allow confirmation; below 40%, suggest re-entry

3. **Partial extraction handling**
   - What we know: Some conversations may only contain business name, not keywords
   - What's unclear: How to handle missing fields in confirmation UI?
   - Recommendation: Show empty fields as editable with placeholder "Could not extract - please enter manually"

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | apps/web/vitest.config.ts |
| Quick run command | `npm test -w @tevero/web` |
| Full suite command | `npm test -w @tevero/web -- --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | Add Prospect button enabled | integration | `npm test -w @tevero/web -- src/components/prospects/AddProspectModal.test.tsx` | Wave 0 |
| SC-2 | Three input modes | unit | `npm test -w @tevero/web -- src/components/prospects/*.test.tsx` | Wave 0 |
| SC-3 | AI extraction | unit | `npm test -- open-seo-main/src/server/features/prospects/services/ConversationExtractor.test.ts` | Wave 0 |
| SC-4 | Confirmation screen | integration | `npm test -w @tevero/web -- src/components/prospects/ExtractionConfirmation.test.tsx` | Wave 0 |
| SC-5 | SSE progress | integration | `npm test -w @tevero/web -- src/app/.../progress/route.test.ts` | Wave 0 |
| SC-6 | Platform detection | unit | Existing: `open-seo-main/src/server/features/connections/services/PlatformDetector.test.ts` | Exists |

### Sampling Rate
- **Per task commit:** `npm test -w @tevero/web -- --watch=false [test-file]`
- **Per wave merge:** `npm test -w @tevero/web -- --coverage`
- **Phase gate:** Full suite green + 80% coverage before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/web/src/components/prospects/AddProspectModal.test.tsx` -- covers SC-1, SC-2
- [ ] `apps/web/src/components/prospects/ExtractionConfirmation.test.tsx` -- covers SC-4
- [ ] `apps/web/src/stores/prospect-wizard-store.test.ts` -- covers wizard state
- [ ] `open-seo-main/src/server/features/prospects/services/ConversationExtractor.test.ts` -- covers SC-3

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Clerk auth via `requireActionAuth()` |
| V3 Session Management | yes | Clerk session tokens |
| V4 Access Control | yes | Workspace ownership validation in ProspectService |
| V5 Input Validation | yes | Zod schemas on all inputs |
| V6 Cryptography | no | No secrets stored in this phase |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via URL input | Tampering | Domain validation regex, URL allowlist |
| Prompt injection in conversation | Tampering | System prompt hardening, output validation |
| XSS in extracted data display | Spoofing | React auto-escaping, DOMPurify for rich text |
| DoS via large conversation input | Denial of Service | 50KB content limit, rate limiting |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npm registry] @anthropic-ai/sdk version 0.92.0, next-intl 4.11.0, zod 4.3.6
- [VERIFIED: codebase] AddProspectDialog.tsx, ProspectService.ts, voice.ts patterns
- [VERIFIED: codebase] PlatformDetector.ts implementation
- [CITED: https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md] Structured outputs with Zod

### Secondary (MEDIUM confidence)
- [CITED: https://nextjs.org/docs/app/guides/streaming] Next.js SSE streaming patterns
- [VERIFIED: codebase] StepWizard, Tabs components from @tevero/ui

### Tertiary (LOW confidence)
- None -- all critical claims verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in codebase with working patterns
- Architecture: HIGH -- extends existing ProspectService/AddProspectDialog patterns
- Pitfalls: MEDIUM -- based on common issues with similar features, not observed in this codebase

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable libraries, low churn domain)
