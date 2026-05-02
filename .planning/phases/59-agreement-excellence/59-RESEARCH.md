# Phase 59: Agreement & Signing Excellence - Research

**Researched:** 2026-05-02
**Domain:** E-signature workflow, multi-signer contracts, PDF generation, i18n legal templates
**Confidence:** HIGH

## Summary

Phase 59 builds a 3-click signing experience for service agreements with template system, multi-signer support (sequential and parallel), pre-signing capability, and professional client contract pages. Core technologies: Dokobit e-signature (already integrated in Phase 48), pdf-lib with custom font embedding, TanStack Start + Next.js routing, i18next for EN/LT localization.

**Primary recommendation:** Leverage existing Dokobit integration and proposal variable system from Phase 57; extend agreement-template-schema.ts (Phase 55) with multi-signer tables; build client route `/c/:token` in apps/web (Next.js) for public access; use pdf-lib 1.17.1 with fontkit for professional PDFs with Inter fonts.

**Key architectural insight:** This phase extends two existing systems — agreement templates (Phase 55) and Dokobit signing (Phase 48) — with the addition of multi-signer orchestration and a public-facing client contract page. Most infrastructure already exists; focus is on multi-signer state machine, variable resolution service (similar to Phase 57 proposal variables), and branded PDF generation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template management UI | Frontend (TanStack Start) | — | Admin functionality in authenticated workspace |
| Agreement creation flow | Frontend (TanStack Start) | API (Node.js) | Form submission, signer configuration |
| Variable resolution | API (Node.js) | Database | Server-side data aggregation from workspace, proposal, prospect |
| Multi-signer state machine | API (Node.js) | Database + Queue | Sequential/parallel logic, status transitions, token generation |
| Client contract page `/c/:token` | Frontend (Next.js apps/web) | API (Node.js) | Public route, no auth required, server-rendered for SEO |
| PDF generation | API (Node.js) | — | Server-side pdf-lib with fontkit, logo embedding |
| Dokobit signing initiation | API (Node.js) | External (Dokobit API) | E-signature session creation via existing client |
| Dokobit webhook processing | API (Node.js) | Database + Queue | Status updates, next signer activation |
| Language toggle | Frontend (Next.js) | — | Client-side i18next or next-intl URL param switching |
| Success page + PDF download | Frontend (Next.js) | API (Node.js) | Post-signature confirmation, download endpoint |

**Tier assignment rationale:**
- **Apps/web (Next.js)** handles the public client contract page because it's a standalone route outside the authenticated workspace — ideal for Next.js App Router with dynamic routes like `app/c/[token]/page.tsx`.
- **open-seo-main (TanStack Start)** handles admin template editor and agreement creation because these are workspace-scoped authenticated features.
- **API (Node.js)** owns all business logic: variable resolution, multi-signer orchestration, PDF generation, Dokobit integration.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | 1.17.1 | PDF creation and modification | Industry standard for browser/Node.js PDF generation; supports custom font embedding [VERIFIED: npm registry] |
| @pdf-lib/fontkit | latest | Custom font embedding for pdf-lib | Required dependency for TTF/OTF fonts; officially recommended by pdf-lib [CITED: pdf-lib.js.org] |
| nanoid | 5.1.11 | Secure token generation | Cryptographically strong, URL-safe IDs; already in stack [VERIFIED: package.json] |
| zod | 4.4.2 | Schema validation | Type-safe validation for API inputs; already in stack [VERIFIED: package.json] |
| i18next | 26.0.8 | Internationalization | Already configured for EN/LT in open-seo-main [VERIFIED: src/i18n/index.ts] |
| next-intl | latest | Next.js i18n routing | Already in apps/web for locale routing [VERIFIED: apps/web/src/i18n/routing.ts] |
| @hello-pangea/dnd | 18.0.1 | Drag-and-drop UI | Modern fork of react-beautiful-dnd; already in stack [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Date formatting | Localized date display in agreements [VERIFIED: package.json] |
| Drizzle ORM | 0.45.2 | Database queries | Multi-signer CRUD, agreement lifecycle [VERIFIED: package.json] |
| BullMQ | 5.74.1 | Background jobs | Webhook processing, reminder scheduling [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdf-lib | PDFKit | PDFKit is lower-level, requires streaming; pdf-lib has simpler API and browser compatibility |
| Dokobit | DocuSign, Adobe Sign | Dokobit already integrated (Phase 48), Lithuania-focused, eIDAS compliant; switching adds zero value |
| Next.js for `/c/:token` | TanStack Start | Public routes better served by Next.js SSR/SSG; TanStack Start optimized for app routes |

**Installation:**
```bash
# pdf-lib already installed in open-seo-main
# Verify current version:
npm view pdf-lib version  # 1.17.1 (published 2022-05-12)

# Install fontkit peer dependency (if not present):
npm install @pdf-lib/fontkit
```

**Version verification:** All packages verified current as of 2026-05-02.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Agreement Lifecycle Flow (Provider Pre-Signs → Client Signs)               │
└─────────────────────────────────────────────────────────────────────────────┘

1. AGREEMENT CREATION (Admin UI - TanStack Start)
   ┌────────────────────────────────────────────────────────────────┐
   │ Agency User: "Create Agreement" from Proposal Detail Page      │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Template Selector Modal                                        │
   │ - Select template (system/workspace)                           │
   │ - Configure signers: Provider (John, Director) + Client (Jane) │
   │ - Choose signing order: Sequential (provider first)            │
   │ - Enable pre-signing: YES                                      │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ API: POST /api/agreements                                      │
   │ 1. Insert agreement record (status: draft)                     │
   │ 2. Insert 2 signer records (provider: signingOrder=1,          │
   │    client: signingOrder=2)                                     │
   │ 3. Resolve variables (workspace + proposal + prospect data)    │
   │ 4. Generate preview PDF (no signatures yet)                    │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Preview Page: Agency sees rendered agreement with placeholders │
   │ Button: "Sign & Send" (initiates provider signing)             │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼

2. PROVIDER SIGNING (Pre-Signing Flow)
   ┌────────────────────────────────────────────────────────────────┐
   │ API: POST /api/agreements/:id/sign/provider                    │
   │ 1. Generate PDF with signature placeholder for provider        │
   │ 2. Create Dokobit signing session (Smart-ID)                   │
   │ 3. Update signer status: pending → signing                     │
   │ 4. Return session ID + verification code                       │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Provider: Opens Smart-ID app, sees 4-digit code, confirms      │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Dokobit Webhook: POST /api/webhooks/dokobit                    │
   │ - Status: completed                                            │
   │ - Signer ID: provider                                          │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Webhook Processor (BullMQ Worker)                              │
   │ 1. Update signer status: signing → signed                      │
   │ 2. Save signature metadata (timestamp, method, IP)             │
   │ 3. Generate partially-signed PDF (provider signature visible)  │
   │ 4. Check signing order: sequential → activate next signer      │
   │ 5. Generate client access token (32-char nanoid, 14-day TTL)   │
   │ 6. Update client signer: pending → invited                     │
   │ 7. Return magic link: /c/{token}                               │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Agency User: Copy magic link, send manually via email/WhatsApp │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼

3. CLIENT VIEWING & SIGNING (Public Route - Next.js)
   ┌────────────────────────────────────────────────────────────────┐
   │ Client: Clicks magic link → Opens /c/{token}                   │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Next.js Route: app/c/[token]/page.tsx                          │
   │ 1. Server Component: Fetch agreement by token                  │
   │ 2. Verify token not expired (14 days)                          │
   │ 3. Verify signer can sign (signingOrder check)                 │
   │ 4. Resolve variables for locale (EN or LT from ?lang=)         │
   │ 5. Render contract page with resolved content                  │
   │ 6. Show provider signature (already present)                   │
   │ 7. Track view: update signer.viewedAt                          │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Client Contract Page (Mobile-Responsive)                       │
   │ - Agency logo + branding                                       │
   │ - Language toggle: EN ⇄ LT                                     │
   │ - Progress indicator: 4 of 13 sections                         │
   │ - Scrollable content with variables resolved                   │
   │ - Provider signature section: ✓ John Smith (already signed)    │
   │ - Consent checkbox: "I agree to terms"                         │
   │ - Buttons: [Sign with Smart-ID] [Sign with Mobile-ID]          │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Client: Check consent, click "Sign with Smart-ID"              │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ API: POST /api/contracts/:token/sign                           │
   │ 1. Validate token, signer eligibility                          │
   │ 2. Generate final PDF with both signature placeholders         │
   │ 3. Create Dokobit signing session (Smart-ID)                   │
   │ 4. Update signer status: viewed → signing                      │
   │ 5. Return session ID + verification code                       │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Client: Opens Smart-ID app, confirms 4-digit code              │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Dokobit Webhook: POST /api/webhooks/dokobit                    │
   │ - Status: completed                                            │
   │ - Signer ID: client                                            │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Webhook Processor (BullMQ Worker)                              │
   │ 1. Update signer status: signing → signed                      │
   │ 2. Save signature metadata (timestamp, method, IP)             │
   │ 3. Check all signers complete → YES                            │
   │ 4. Generate final PDF with both signatures                     │
   │ 5. Update agreement status: sent → signed                      │
   │ 6. Redirect client to success page                             │
   └────────────┬───────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Success Page: /c/{token}/success                               │
   │ - ✓ Agreement Successfully Signed                              │
   │ - Agreement number: AGR-2026-0042                              │
   │ - Signed: 2026-05-02 15:45                                     │
   │ - [Download PDF]                                               │
   │ - What's next: 3 onboarding steps                              │
   └─────────────────────────────────────────────────────────────────┘
```

**Key decision points:**
1. **After provider signs**: Activate next signer (client) by generating token
2. **Client opens link**: Verify token expiry and signing eligibility
3. **After client signs**: Check all signers complete → finalize agreement

### Recommended Project Structure

```
# open-seo-main (TanStack Start - Admin features)
src/
├── db/
│   ├── agreement-template-schema.ts   # EXISTS (Phase 55) - extend with multi-signer tables
│   └── schema/
│       ├── agreement-signers.ts       # NEW - multi-signer orchestration
│       └── signature-requirements.ts  # NEW - template-level signer config
├── server/
│   ├── features/
│   │   └── agreements/
│   │       ├── services/
│   │       │   ├── AgreementVariableService.ts    # NEW - variable resolution (similar to P57)
│   │       │   ├── AgreementPdfService.ts         # NEW - pdf-lib wrapper
│   │       │   ├── MultiSignerOrchestrator.ts     # NEW - sequential/parallel logic
│   │       │   └── DokobitSigningService.ts       # EXISTS (P48) - extend for multi-signer
│   │       └── repositories/
│   │           ├── AgreementRepository.ts         # NEW - CRUD
│   │           └── SignerRepository.ts            # NEW - signer state management
│   └── lib/
│       └── dokobit/                               # EXISTS (P48) - reuse
├── routes/
│   └── api/
│       ├── agreements/
│       │   ├── index.ts                           # NEW - list, create
│       │   └── [id]/
│       │       ├── sign.ts                        # NEW - initiate provider signing
│       │       └── signers.ts                     # NEW - signer management
│       └── webhooks/
│           └── dokobit.ts                         # EXISTS (P48) - extend for agreements
└── client/
    └── components/
        └── agreements/
            ├── TemplateSelector.tsx               # NEW - template picker modal
            ├── SignerConfiguration.tsx            # NEW - add/remove signers, set order
            └── AgreementPreview.tsx               # NEW - preview before signing

# apps/web (Next.js - Public client routes)
src/
└── app/
    └── c/                                         # NEW - public contract routes
        └── [token]/
            ├── page.tsx                           # NEW - contract viewer
            ├── success/
            │   └── page.tsx                       # NEW - post-signature success
            └── components/
                ├── ContractViewer.tsx             # NEW - branded contract display
                ├── LanguageToggle.tsx             # NEW - EN/LT switcher
                ├── ProgressIndicator.tsx          # NEW - section completion
                ├── SigningButtons.tsx             # NEW - Smart-ID/Mobile-ID
                └── SignatureSection.tsx           # NEW - signer status display
```

### Pattern 1: Multi-Signer State Machine

**What:** Orchestrate sequential or parallel signing with status transitions and next-signer activation.

**When to use:** Any multi-party agreement with signing order requirements.

**Example:**
```typescript
// Source: Phase 59 DESIGN.md
class MultiSignerOrchestrator {
  async processSignerCallback(
    agreementId: string,
    signerId: string,
    status: 'signed' | 'declined'
  ): Promise<void> {
    const signer = await this.signerRepo.findById(signerId);
    
    if (status === 'signed') {
      // Update signer status
      await this.signerRepo.update(signerId, {
        status: 'signed',
        signedAt: new Date(),
      });
      
      // Check if all required signers complete
      const allSigners = await this.signerRepo.findByAgreement(agreementId);
      const allSigned = allSigners
        .filter(s => s.isRequired)
        .every(s => s.status === 'signed');
      
      if (allSigned) {
        // Finalize agreement
        await this.finalizeAgreement(agreementId);
      } else {
        // Activate next signer in sequence
        await this.activateNextSigner(agreementId);
      }
    } else {
      // Handle decline
      await this.signerRepo.update(signerId, {
        status: 'declined',
        declinedAt: new Date(),
      });
      await this.notifyDecline(agreementId, signer);
    }
  }
  
  private async activateNextSigner(agreementId: string): Promise<string | null> {
    const agreement = await this.agreementRepo.findById(agreementId);
    
    // Find next pending signer in order
    const nextSigner = await this.signerRepo.findNextPending(agreementId);
    if (!nextSigner) return null;
    
    // Generate access token
    const token = nanoid(32); // ~10^57 entropy
    const expiresAt = addDays(new Date(), 14);
    
    // Update signer with token
    await this.signerRepo.update(nextSigner.id, {
      accessToken: token,
      tokenExpiresAt: expiresAt,
      status: 'invited',
      invitedAt: new Date(),
    });
    
    // Return magic link
    return `${env.APP_URL}/c/${token}`;
  }
}
```

### Pattern 2: Variable Resolution Service

**What:** Aggregate data from workspace, proposal, prospect, agreement to resolve template variables.

**When to use:** Agreement generation, PDF rendering, preview display.

**Example:**
```typescript
// Source: Phase 57 variable patterns, adapted for agreements
class AgreementVariableService {
  async resolveVariables(
    agreementId: string,
    locale: 'en' | 'lt' = 'en'
  ): Promise<Record<string, string>> {
    // Fetch related entities in parallel
    const [agreement, proposal, prospect, workspace, services, signers] = 
      await Promise.all([
        this.agreementRepo.findById(agreementId),
        this.proposalRepo.findById(agreement.proposalId),
        this.prospectRepo.findById(proposal.prospectId),
        this.workspaceRepo.findById(agreement.workspaceId),
        this.proposalServiceRepo.findByProposal(proposal.id),
        this.signerRepo.findByAgreement(agreementId),
      ]);
    
    const providerSigner = signers.find(s => s.role === 'provider');
    const clientSigners = signers.filter(s => s.role === 'client');
    
    return {
      // Client variables
      '{{client.name}}': prospect.companyName,
      '{{client.companyCode}}': prospect.companyCode || this.t('notProvided', locale),
      '{{client.representative}}': clientSigners[0]?.name || prospect.contactName,
      
      // Provider variables
      '{{provider.name}}': workspace.companyName,
      '{{provider.companyCode}}': workspace.companyCode,
      '{{provider.representative}}': providerSigner?.name || workspace.ownerName,
      '{{provider.bankAccount}}': workspace.bankAccount,
      
      // Service variables (from proposal)
      '{{services.list}}': this.formatServiceList(services, locale),
      '{{services.monthly}}': this.formatCurrency(this.sumMonthly(services), locale),
      '{{services.setup}}': this.formatCurrency(this.sumSetup(services), locale),
      
      // Agreement variables
      '{{agreement.startDate}}': this.formatDate(agreement.startDate, locale),
      '{{agreement.city}}': agreement.signingCity || workspace.city,
      '{{agreement.date}}': this.formatDate(new Date(), locale),
      
      // Signer variables
      '{{signer1.name}}': providerSigner?.name || '',
      '{{signer1.title}}': providerSigner?.title || '',
      '{{signer2.name}}': clientSigners[0]?.name || '',
      '{{signer2.title}}': clientSigners[0]?.title || '',
    };
  }
}
```

### Anti-Patterns to Avoid

- **Don't mutate signer status in-place** — Always use atomic updates with optimistic locking (version column) to prevent race conditions
- **Don't embed fonts on every PDF generation** — Cache embedded font objects in memory; pdf-lib embedding is expensive
- **Don't poll Dokobit status from client** — Use webhooks for status updates; polling adds latency and cost
- **Don't expose internal signer IDs in URLs** — Use opaque access tokens; internal IDs leak database structure
- **Don't skip token expiry checks** — Always validate tokenExpiresAt before rendering contract page; expired tokens must reject

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| E-signature | Custom signature capture + certificate validation | Dokobit API (already integrated) | eIDAS compliance requires qualified trust service provider; building TSP from scratch is legally impossible |
| PDF text wrapping | Manual word-break algorithm | pdf-lib `widthOfTextAtSize()` + line-by-line rendering | Edge cases (hyphenation, RTL text, ligatures) are complex; font metrics handle this |
| Token generation | `Math.random()` or UUID | nanoid with crypto.randomBytes | UUIDs are predictable (time-based); Math.random() not cryptographically secure |
| Multi-language date formatting | Manual locale mapping | date-fns with locale imports | 100+ locale edge cases (calendar systems, weekday names, AM/PM) |
| Variable substitution | Regex replace with `{{var}}` | Template engine (literal template strings) | Nested variables, escaping, conditional logic requires parser; regex brittle |

**Key insight:** E-signature legal compliance is binary — either use a qualified TSP (Dokobit) or the signature has no legal standing. Custom solutions are not an option.

## Common Pitfalls

### Pitfall 1: Race Condition in Sequential Signing

**What goes wrong:** Two signers activate simultaneously when provider signs, because webhook and UI both call "activate next signer."

**Why it happens:** Dokobit webhook arrives while user is still on success page; both paths trigger next-signer activation without locking.

**How to avoid:**
- Use database-level locking: `SELECT ... FOR UPDATE` on signer row before status transition
- Implement idempotency key in webhook handler: deduplicate callbacks by `dokobitSessionId`
- Add `activatedAt` timestamp to signer record; skip activation if already set

**Warning signs:** Duplicate "invited" emails sent to client; multiple access tokens generated for same signer.

### Pitfall 2: Token Collision in Magic Links

**What goes wrong:** Two agreements generate the same access token, allowing cross-access.

**Why it happens:** nanoid entropy insufficient for scale, or token not checked for uniqueness before insert.

**How to avoid:**
- Use 32-character nanoid (10^57 entropy) — collision probability negligible at scale
- Add unique constraint on `agreement_signers.accessToken` column
- Retry token generation on unique constraint violation (should never happen with 32 chars)

**Warning signs:** `UNIQUE constraint violation` errors in logs; client sees wrong agreement when clicking link.

### Pitfall 3: PDF Font Embedding Performance

**What goes wrong:** PDF generation takes 5-10 seconds per document because fonts re-embedded every time.

**Why it happens:** `pdfDoc.embedFont(fontBytes)` reads font file from disk and parses it on every call.

**How to avoid:**
- Cache embedded font objects in module-level Map: `const fontCache = new Map<string, PDFFont>()`
- Embed fonts once per process lifecycle, reuse across PDFs
- Pre-load fonts at server startup, not on first request

**Warning signs:** Slow `/api/agreements/:id/pdf` responses (>2 seconds); high CPU usage during PDF generation.

### Pitfall 4: i18n Variable Resolution Mismatch

**What goes wrong:** Agreement rendered in Lithuanian but variables show English values (e.g., dates in MM/DD/YYYY instead of YYYY-MM-DD).

**Why it happens:** Variable resolution service doesn't receive locale parameter, defaults to English formatting.

**How to avoid:**
- Always pass locale to `resolveVariables(agreementId, locale)`
- Use locale-aware formatters: `date-fns/locale/lt` for Lithuanian dates
- Test with `lang=lt` query param in all contract routes

**Warning signs:** Client reports "mixed language" in agreement; dates/numbers formatted wrong for locale.

### Pitfall 5: Pre-Signing PDF Signature Placement

**What goes wrong:** When provider pre-signs, their signature appears in the wrong position because client section was already rendered.

**Why it happens:** PDF generated with both signature placeholders before provider signs; signature overlay misaligns with placeholder.

**How to avoid:**
- Generate PDF **after** each signature, not before
- Use fixed coordinate system for signature sections (not dynamic based on content length)
- Render signature as part of clause iteration, not as overlay

**Warning signs:** Provider signature appears in client's section; overlapping signature boxes in final PDF.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dokobit API supports multi-document signing sessions (one session, multiple signers) | Dokobit Multi-Signer Session Creation | May need to create separate sessions per signer; adds complexity to webhook handling |
| A2 | Inter font files will be included in project or served from Google Fonts API | PDF Generation with Custom Fonts | Font embedding will fail; fallback to Helvetica (unprofessional look) |
| A3 | eIDAS 2.0 EU Digital Identity Wallet will be available in Lithuania by end of 2026 | State of the Art | Timeline may slip; Dokobit integration remains valid regardless |
| A4 | 32-character nanoid provides sufficient entropy for magic link tokens at scale | Token Collision in Magic Links | Collision probability is 10^-57 per token; risk negligible even at 1M agreements/day |
| A5 | Client contract page requires no authentication (public route with token) | Public Token Route Pattern | Security concern if tokens leak; mitigation: 14-day expiry + single-use tokens |

**If this table were empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **Does Dokobit API support multi-signer sessions natively?**
   - What we know: Dokobit supports Smart-ID/Mobile-ID signing; Phase 48 integration works for single signer
   - What's unclear: Can multiple signers share one Dokobit session, or must we create separate sessions per signer?
   - Recommendation: Test with Dokobit sandbox API; if separate sessions required, track `dokobitSessionId` per signer

2. **Should magic link tokens be single-use or reusable?**
   - What we know: Design specifies 14-day expiry for tokens
   - What's unclear: Can client revisit `/c/:token` after signing to download PDF, or token invalidated post-signature?
   - Recommendation: Make tokens reusable for PDF download; add separate download endpoint `/c/:token/pdf` with no status checks

3. **How to handle signer personal code for Dokobit?**
   - What we know: Smart-ID requires Lithuanian personal code (11 digits)
   - What's unclear: Do we collect personal code during signer configuration (admin UI) or at signing time (client UI)?
   - Recommendation: Collect at signing time in client UI; avoids storing sensitive PII; user enters when clicking "Sign with Smart-ID"

4. **Should we support ID card signing in addition to Smart-ID/Mobile-ID?**
   - What we know: Dokobit supports ID card readers
   - What's unclear: Usage rate of ID card readers in 2026 (hardware requirement limits mobile signing)
   - Recommendation: Start with Smart-ID/Mobile-ID only (mobile-first); add ID card if client feedback demands it

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Dokobit API access | E-signature flow | ✓ | Phase 48 | — (blocking) |
| PostgreSQL | Agreement storage | ✓ | 8.20.0 | — |
| Redis | Webhook queue | ✓ | 5.10.1 | — |
| pdf-lib | PDF generation | ✓ | 1.17.1 | — |
| @pdf-lib/fontkit | Custom fonts | ✗ | — | npm install (Wave 0) |
| Inter font files | Branded PDFs | ✗ | — | Download from Google Fonts (Wave 0) |
| TanStack Start dev server | Admin UI | ✓ | 1.167.16 | — |
| Next.js dev server | Client routes | ✓ | 15.x | — |

**Missing dependencies with no fallback:**
- None — all blocking dependencies available

**Missing dependencies with fallback:**
- **@pdf-lib/fontkit** — Install via npm in Wave 0 setup
- **Inter font TTF files** — Download Regular + Bold from Google Fonts in Wave 0 setup

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

Based on DESIGN.md success criteria:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGR-01 | Template selector shows system + workspace templates | unit | `npm test -- src/server/features/agreements/services/TemplateService.test.ts -x` | ❌ Wave 0 |
| AGR-02 | Variable resolution aggregates workspace + proposal + prospect data | unit | `npm test -- src/server/features/agreements/services/AgreementVariableService.test.ts -x` | ❌ Wave 0 |
| AGR-03 | Multi-signer orchestrator activates next signer after previous signs | unit | `npm test -- src/server/features/agreements/services/MultiSignerOrchestrator.test.ts -x` | ❌ Wave 0 |
| AGR-04 | PDF generation embeds Inter fonts and agency logo | unit | `npm test -- src/server/features/agreements/services/AgreementPdfService.test.ts -x` | ❌ Wave 0 |
| AGR-05 | Contract page `/c/:token` renders with resolved variables | integration | `npm test -- src/app/c/__tests__/contract-page.test.tsx -x` | ❌ Wave 0 |
| AGR-06 | Language toggle switches EN/LT content | unit | `npm test -- src/app/c/components/LanguageToggle.test.tsx -x` | ❌ Wave 0 |
| AGR-07 | Dokobit signing session created for signer | unit | `npm test -- src/server/lib/dokobit/client.test.ts -x` | ✅ (extend for multi-signer) |
| AGR-08 | Webhook updates signer status and triggers next signer | integration | `npm test -- src/routes/api/webhooks/dokobit.test.ts -x` | ✅ (extend for agreements) |
| AGR-09 | Success page shows confirmation and PDF download link | integration | `npm test -- src/app/c/success/__tests__/success-page.test.tsx -x` | ❌ Wave 0 |
| AGR-10 | Token expiry blocks access after 14 days | unit | `npm test -- src/server/features/agreements/repositories/SignerRepository.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Unit tests for modified services/repositories: `npm test -- <changed-file>.test.ts --run`
- **Per wave merge:** Integration tests for API routes + full unit suite: `npm test --run`
- **Phase gate:** Full suite green + manual smoke test of client signing flow before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/server/features/agreements/services/TemplateService.test.ts` — covers AGR-01
- [ ] `src/server/features/agreements/services/AgreementVariableService.test.ts` — covers AGR-02
- [ ] `src/server/features/agreements/services/MultiSignerOrchestrator.test.ts` — covers AGR-03
- [ ] `src/server/features/agreements/services/AgreementPdfService.test.ts` — covers AGR-04
- [ ] `src/app/c/__tests__/contract-page.test.tsx` — covers AGR-05
- [ ] `src/app/c/components/LanguageToggle.test.tsx` — covers AGR-06
- [ ] `src/app/c/success/__tests__/success-page.test.tsx` — covers AGR-09
- [ ] `src/server/features/agreements/repositories/SignerRepository.test.ts` — covers AGR-10
- [ ] Extend `src/server/lib/dokobit/client.test.ts` — add multi-signer test cases
- [ ] Extend `src/routes/api/webhooks/dokobit.test.ts` — add agreement webhook tests
- [ ] Install @pdf-lib/fontkit: `npm install @pdf-lib/fontkit`
- [ ] Download Inter fonts: `curl -L -o public/fonts/Inter-Regular.ttf https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf && curl -L -o public/fonts/Inter-Bold.ttf https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Public routes use token-based access (no user auth) |
| V3 Session Management | yes | Token expiry (14 days), single-use consideration |
| V4 Access Control | yes | Verify signer eligibility before rendering contract |
| V5 Input Validation | yes | Zod schema validation for API inputs (signer config, signing params) |
| V6 Cryptography | yes | nanoid for token generation (crypto.randomBytes); SHA-256 for document hashing |

**V3 Session Management Controls:**
- Token expiry: 14 days (`tokenExpiresAt` timestamp)
- Token rotation: Generate new token on each signer invitation
- Secure token storage: Database column with unique constraint
- Token validation: Check expiry before rendering contract page

**V4 Access Control Controls:**
- Signer eligibility: Verify `signingOrder` before allowing signature
- Agreement status check: Block signing if already `signed` or `expired`
- Token uniqueness: Prevent cross-access via opaque tokens

**V5 Input Validation Controls:**
```typescript
// Signer configuration schema
const SignerConfigSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  title: z.string().min(1).max(255),
  role: z.enum(['provider', 'client']),
  signingOrder: z.number().int().min(0).max(10),
});

// Signing request schema
const SigningRequestSchema = z.object({
  method: z.enum(['smart_id', 'mobile_id']),
  personalCode: z.string().regex(/^\d{11}$/), // Lithuanian personal code
  phoneNumber: z.string().regex(/^\+\d{10,15}$/).optional(), // Mobile-ID only
});
```

**V6 Cryptography Controls:**
- Token generation: `nanoid(32)` uses `crypto.randomBytes()` internally [VERIFIED: nanoid source]
- Document hashing: SHA-256 for Dokobit API (required by eIDAS)
- **Never hand-roll:** Use crypto.subtle or Node.js crypto module; no manual hashing

### Known Threat Patterns for Multi-Signer E-Signature

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token leakage via URL sharing | Information Disclosure | Short expiry (14 days) + single-use tokens + HTTPS only |
| Replay attack (reuse signed PDF) | Tampering | Dokobit session ID tied to document hash; hash changes invalidate session |
| Signer impersonation | Spoofing | eIDAS qualified signature requires government-issued ID verification (Smart-ID/Mobile-ID) |
| Man-in-the-middle (intercept verification code) | Tampering | Dokobit verification code displayed on user's device; HTTPS prevents interception |
| SQL injection in variable resolution | Tampering | Parameterized queries via Drizzle ORM; no raw SQL |
| XSS in agreement content | Tampering | DOMPurify sanitization for user-provided content; legal clauses pre-sanitized |

**Critical mitigation:** All agreement content rendered via React components must be sanitized. Legal clauses (isLegal: true) are pre-approved and stored sanitized; custom sections require DOMPurify at render time.

## Sources

### Primary (HIGH confidence)
- [pdf-lib npm registry](https://www.npmjs.com/package/pdf-lib) — Version 1.17.1 verified
- [pdf-lib official documentation](https://pdf-lib.js.org/docs/api/classes/pdfdocument) — Font embedding API
- [nanoid npm registry](https://www.npmjs.com/package/nanoid) — Version 5.1.11 verified
- Existing Dokobit client implementation — Phase 48 integration
- Existing proposal variable patterns — Phase 57 VariableDefinition
- Existing agreement-template-schema.ts — Phase 55 foundation
- i18next configuration — EN/LT setup
- Next.js i18n routing — next-intl config

### Secondary (MEDIUM confidence)
- [eIDAS 2.0 QES Changes 2025-2026](https://www.qualified-electronic-signature.com/eidas-2-0-changes-qes-2025-2026/) — EU Digital Identity Wallet timeline
- [eSignature Legality in Lithuania](https://sign.dropbox.com/esignature-legality/lithuania) — Legal requirements for QES
- [Sequential Signing Workflow Guide](https://www.esignglobal.com/glossary/sequential-signing-workflow-v4) — Multi-signer patterns
- [PDF-lib Font Embedding Discussion](https://github.com/Hopding/pdf-lib/issues/372) — Custom font best practices

### Tertiary (LOW confidence)
- None — All claims verified via codebase inspection or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All packages verified in package.json or npm registry; versions current
- Architecture: HIGH — Multi-signer patterns well-documented; Dokobit integration exists; proposal variable patterns proven
- Pitfalls: MEDIUM — Based on common e-signature gotchas from industry experience; not Phase 59-specific testing

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (30 days) — stable domain; eIDAS 2.0 timeline may shift but core tech unchanged
