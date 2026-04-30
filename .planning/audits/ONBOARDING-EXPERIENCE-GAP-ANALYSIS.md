# TeveroSEO Prospect-to-Client Onboarding Experience Gap Analysis

**Date:** 2026-04-30
**Auditors:** 5 Opus subagents (Proposal, Agreement, Keyword, Payment, CRM)
**Goal:** Identify gaps for world-class, super fast, easy, and pleasurable experience

---

## Executive Summary

TeveroSEO has a **solid technical foundation** but falls significantly short of a world-class onboarding experience. The platform is functional but not delightful. Critical gaps exist in:

1. **Keyword Analysis** - Core value prop ("paste anything, get insights") not realized
2. **Split Payments** - Not implemented at all
3. **Client Contract Page** - Clients cannot view/sign contracts
4. **Proposal Editing** - No Google Docs-like inline editing
5. **CRM/Communication** - Missing email sequences, booking, client portal

**Estimated effort to world-class:** 12-16 weeks focused development

---

## Critical Gaps (P0) - Launch Blockers

### 1. Keyword Analysis: Text Input Mode NOT IMPLEMENTED

**Current State:** Only website URL input works
**Expected:** "Paste anything, get brilliant insights"

| Gap | Impact | Effort |
|-----|--------|--------|
| No conversation/transcript parsing | Cannot process sales call dumps | 12-16h |
| No confirmation flow ("Here's what I understood") | Users can't verify/correct AI understanding | 8-10h |
| **Add Prospect button is DISABLED** | Cannot add prospects at all! | 4-6h |
| Notes field not used by AI | User context ignored during analysis | 4-6h |
| No real-time progress feedback | Users don't know what's happening | 6-8h |

**Files affected:**
- `open-seo-main/src/routes/_app/prospects/index.tsx` (disabled button line 121)
- `open-seo-main/src/server/lib/scraper/businessExtractor.ts`
- `open-seo-main/src/server/workers/prospect-analysis-processor.ts`

---

### 2. Split Payments: COMPLETELY MISSING

**Current State:** One-time payment OR subscription only
**Expected:** Pay in full OR 2-3 installments (client choice)

| Gap | Impact | Effort |
|-----|--------|--------|
| No installment schema | Cannot track partial payments | 8h |
| No split configuration UI | Agency cannot offer payment plans | 12h |
| No client payment plan selector | Clients cannot choose installments | 8h |
| No installment reminders | Manual follow-up required | 4h |
| No agency tracking dashboard | "Who paid what" not visible | 8h |

**Schema changes needed:**
```sql
CREATE TABLE payment_schedules (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(id),
  installment_number INTEGER,
  amount_cents INTEGER,
  due_at TIMESTAMP,
  status TEXT, -- pending, paid, overdue
  paid_at TIMESTAMP
);
```

---

### 3. Client Contract Page: DOES NOT EXIST

**Current State:** No `/c/:token` route - clients cannot view or sign contracts
**Expected:** Professional contract viewing + e-signature in 3 clicks

| Gap | Impact | Effort |
|-----|--------|--------|
| No public contract page | **Clients cannot sign** | 8h |
| Email sending not wired up | Contracts cannot be delivered | 4h |
| Variable values hardcoded | Contracts have wrong client data | 4h |
| No preview before sending | Agency cannot verify content | 4h |

**Design doc specifies `/c/:token`** but route was never created.

---

### 4. Proposal Editor: Not Google Docs-Like

**Current State:** Textarea editing with manual save
**Expected:** Click anywhere and type, instant save, drag-drop sections

| Gap | Impact | Effort |
|-----|--------|--------|
| No inline editing | 3-5x more clicks than necessary | 16h |
| No drag-and-drop sections | Cannot customize proposal flow | 12h |
| No duplicate/clone proposal | Must recreate from scratch | 4h |
| No auto-save | Risk of losing work | 4h |
| No version history | Cannot recover changes | 8h |
| No undo/redo | Common accidents not reversible | 4h |

---

## High Priority Gaps (P1) - First 30 Days

### 5. Agreement/Contract UX

| Gap | Current | Expected | Effort |
|-----|---------|----------|--------|
| Inline clause editor | None | Add/edit custom clauses | 16h |
| PDF quality | Basic Helvetica | Professional branded PDF | 8h |
| Clause library | None | Pre-approved add-ons | 12h |
| Activity timeline | Data exists, no UI | Visual history | 8h |

### 6. Prospect/CRM Capabilities

| Gap | Current | Expected | Effort |
|-----|---------|----------|--------|
| Contact tags | None | Custom tagging system | 8h |
| Custom fields | None | User-defined fields | 12h |
| Multiple contacts per company | Single contact | Full B2B support | 12h |
| Manual competitor input | Auto-discovery only | Specify competitors | 4h |
| Keyword selection for proposal | Callbacks do nothing | Checkbox multi-select | 8h |

### 7. Communication & Follow-up

| Gap | Current | Expected | Effort |
|-----|---------|----------|--------|
| Email sequences | None | Drip campaign automation | 24h |
| Email tracking | None | Opens, clicks tracking | 12h |
| Custom email templates | 7 predefined only | Template builder | 16h |
| SMS capabilities | None | Twilio integration | 12h |
| Follow-up reminders | Activity type exists, no scheduler | Automated reminders | 8h |

### 8. Booking & Scheduling

| Gap | Current | Expected | Effort |
|-----|---------|----------|--------|
| Discovery call booking | None | Public booking page | 16h |
| Calendar integration | None | Google/Outlook OAuth | 16h |
| Availability management | None | Set available slots | 8h |
| Meeting reminders | None | Pre-meeting emails | 4h |

### 9. Payment Polish

| Gap | Current | Expected | Effort |
|-----|---------|----------|--------|
| Discount/coupon codes | None | Promo code system | 12h |
| Failed payment auto-retry | Logging only | Automatic retry + alert | 8h |
| Express checkout | 2-3 clicks | Saved payment methods | 12h |

---

## Medium Priority Gaps (P2) - First 90 Days

### 10. Proposal Polish

| Gap | Effort |
|-----|--------|
| Inline comments for prospects | 16h |
| Rich text editor (TipTap) | 12h |
| PDF export (pre-signing) | 8h |
| Template library/marketplace | 16h |
| Real-time collaboration | 24h |

### 11. Extra Services

| Gap | Effort |
|-----|--------|
| Service packages catalog | 12h |
| GMB SEO service option | 16h |
| Google Reviews management | 24h |
| Website project tracking | 16h |
| Add-on service pricing | 8h |

### 12. Client Portal

| Gap | Effort |
|-----|--------|
| Client self-service login | 16h |
| Client dashboard | 24h |
| Project progress view | 12h |
| Self-service report access | 8h |
| In-app messaging | 24h |
| Invoice history portal | 8h |

### 13. CRM Advanced

| Gap | Effort |
|-----|--------|
| Revenue forecasting | 12h |
| Gmail/Outlook sync | 24h |
| Duplicate detection | 8h |
| Notes threading | 8h |

---

## User Journey Friction Analysis

### Agency User Journey (Creating & Managing)

```
Current State (Friction Points Marked with *)

1. Add Prospect
   * Button is DISABLED - cannot add prospects!
   * No conversation dump input
   * No confirmation of extracted data

2. Analyze Prospect
   - Crawling works (sitemap, multi-page)
   * No progress feedback during analysis
   * Notes not used by AI

3. Create Proposal
   - Template selection works
   * No inline editing (textarea only)
   * No drag-drop sections
   * No duplicate/clone
   * Manual save required

4. Send Proposal
   - Email delivery works
   - Engagement tracking works
   * No inline prospect comments

5. Create Agreement
   - API exists
   * No preview before sending
   * Hardcoded variable values
   * No inline clause editing

6. Send Agreement
   * Email not wired up
   * No client viewing page!

7. Process Payment
   - Stripe/Revolut work
   * No split payment option
   * No discount codes

8. Onboarding
   - Checklist system works
   - Site connections work
   * No client self-service portal
```

### Prospect/Client Journey (Receiving & Converting)

```
Current State (Friction Points Marked with *)

1. Receive Proposal
   - Branded email works
   - Public viewing works
   * Cannot ask inline questions
   * Cannot download PDF (pre-sign)

2. Review Proposal
   - ROI calculator works
   - Mobile responsive
   * No chat with agency
   * No commenting

3. Accept Proposal
   - Accept/reject works
   - E-signature works
   * Goes to payment immediately (no pause option)

4. View Agreement
   * PAGE DOES NOT EXIST!
   * Cannot view contract before signing

5. Sign Agreement
   - Dokobit works (when page exists)
   * 8+ clicks to sign (should be 3)

6. Make Payment
   - Multiple providers work
   - Apple/Google Pay work
   * No installment option
   * No saved payment methods

7. Onboarding
   - Magic links work
   * No client dashboard
   * No progress visibility
   * No self-service access
```

---

## Recommended Implementation Phases

### Phase A: Critical Fixes (Weeks 1-2) - ~60 hours

| Item | Hours |
|------|-------|
| Enable Add Prospect button + form | 6 |
| Text/conversation input mode | 16 |
| Confirmation flow ("Here's what I understood") | 10 |
| Create `/c/:token` client contract page | 8 |
| Wire up contract email sending | 4 |
| Fix hardcoded variable values | 4 |
| Duplicate proposal feature | 4 |
| Auto-save for proposals | 4 |

### Phase B: Split Payments (Weeks 3-4) - ~48 hours

| Item | Hours |
|------|-------|
| Payment schedule schema | 8 |
| Agency split configuration UI | 12 |
| Client payment plan selector | 8 |
| Installment tracking dashboard | 8 |
| Automated installment reminders | 8 |
| Failed payment handling | 4 |

### Phase C: Editor Excellence (Weeks 5-6) - ~52 hours

| Item | Hours |
|------|-------|
| Inline proposal editing (contentEditable/TipTap) | 16 |
| Drag-and-drop section reordering | 12 |
| Custom sections support | 12 |
| Version history | 8 |
| Undo/redo | 4 |

### Phase D: Communication (Weeks 7-8) - ~52 hours

| Item | Hours |
|------|-------|
| Email sequence builder | 24 |
| Email tracking (opens/clicks) | 12 |
| Custom email templates | 12 |
| Automated follow-up reminders | 4 |

### Phase E: CRM & Booking (Weeks 9-10) - ~52 hours

| Item | Hours |
|------|-------|
| Contact tags system | 8 |
| Custom fields | 12 |
| Multiple contacts per company | 12 |
| Booking page + calendar integration | 20 |

### Phase F: Client Portal (Weeks 11-12) - ~60 hours

| Item | Hours |
|------|-------|
| Client authentication system | 16 |
| Client dashboard | 24 |
| Progress/report self-service | 12 |
| Invoice history | 8 |

---

## Summary

**Total estimated effort:** 324 hours (~12-14 weeks with one developer)

**Top 5 Quick Wins (High Impact, Low Effort):**
1. Enable Add Prospect button (6h) - BLOCKING ALL PROSPECT CREATION
2. Duplicate proposal feature (4h) - Saves agency hours daily
3. Auto-save for proposals (4h) - Prevents data loss
4. Create client contract page (8h) - BLOCKING ALL CONTRACT SIGNING
5. Wire up contract emails (4h) - Enables full contract flow

**Top 5 Strategic Investments (High Impact, High Effort):**
1. Text/conversation input mode (16h) - Core value prop realization
2. Split payments (48h total) - Competitive feature, revenue flexibility
3. Inline editing + drag-drop (28h) - Google Docs-like experience
4. Email sequences (24h) - Automate follow-up, increase conversions
5. Client portal (60h) - Self-service, reduced support load

---

## Files Reference

### Critical Files Needing Changes

**Prospect/Keyword:**
- `open-seo-main/src/routes/_app/prospects/index.tsx` - Enable Add button
- `open-seo-main/src/server/lib/scraper/businessExtractor.ts` - Text extraction
- `open-seo-main/src/server/workers/prospect-analysis-processor.ts` - Progress

**Contracts:**
- Create: `open-seo-main/src/routes/c/$token.tsx` - Client contract page
- `open-seo-main/src/server/features/contracts/services/ContractService.ts` - Variables
- `open-seo-main/src/server/services/email/EmailService.ts` - Wire sending

**Proposals:**
- `open-seo-main/src/client/components/proposals/ProposalPreview.tsx` - Inline edit
- `open-seo-main/src/db/proposal-schema.ts` - Section order field
- `open-seo-main/src/serverFunctions/proposals.ts` - Duplicate endpoint

**Payments:**
- Create: `open-seo-main/src/db/payment-schedule-schema.ts` - Installments
- `open-seo-main/src/server/features/invoices/services/InvoiceService.ts` - Splits
- `apps/web/src/app/invoices/[id]/pay/page.tsx` - Plan selector UI

**CRM:**
- `open-seo-main/src/db/prospect-schema.ts` - Tags, custom fields
- Create: `open-seo-main/src/db/email-sequence-schema.ts` - Drip campaigns
- Create: `apps/web/src/app/client-portal/` - Client self-service

---

*This analysis was generated by 5 parallel Opus agents auditing different domains of the application. Each agent traced complete user journeys and identified friction points.*
