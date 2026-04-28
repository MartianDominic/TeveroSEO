# Phase 30: Interactive Proposals - Context

**Gathered:** 2026-04-21
**Status:** Ready for execution
**Mode:** Auto-generated (plans pre-exist)

## Phase Boundary

Transform basic PDF proposals into a world-class interactive experience:
- AI-generated Lithuanian proposals (Gemini 3.1 Pro)
- Scrollytelling presentation at `/p/{token}`
- Digital signatures via Smart-ID/Mobile-ID (Dokobit)
- Stripe payments
- Auto-onboarding

**Core Value:** One link → signed paying client (zero manual work)

## The Flow

```
Agency generates proposal
        ↓
Prospect opens /p/{token} (scrollytelling page)
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

## Success Criteria

1. Proposal schema stores content, pricing, status state machine
2. Gemini 3.1 Pro generates Lithuanian proposal text (segment-by-segment)
3. Scrollytelling proposal page with ROI calculator
4. View tracking and engagement signals
5. Dokobit Smart-ID/Mobile-ID signing integration
6. Stripe payment checkout
7. Auto-onboarding creates client, project, sends GSC invite
8. Pipeline view with automated follow-ups

## Dependencies

- Phase 27: Website Scraping (complete) - scraped content
- Phase 28: Keyword Gap Analysis (complete) - competitor keywords
- Phase 29: AI Opportunity Discovery (complete) - suggested keywords
- Dokobit account for Smart-ID/Mobile-ID
- Stripe account (already in use)
- Google Cloud for Gemini 3.1 Pro API

## Plan Sequence

| Plan | Name | Depends On |
|------|------|------------|
| 30-01 | Proposal Schema & Builder | - |
| 30-02 | AI Lithuanian Generation | 30-01 |
| 30-03 | Interactive Proposal Page | 30-01, 30-02 |
| 30-04 | Engagement Analytics | 30-03 |
| 30-05 | E-Signature (Dokobit) | 30-03 |
| 30-06 | Payment (Stripe) | 30-05 |
| 30-07 | Auto-Onboarding | 30-06 |
| 30-08 | Pipeline & Automation | 30-04, 30-07 |

## Technical Stack

- Gemini 3.1 Pro for Lithuanian text generation
- Framer Motion for scroll animations
- Dokobit API for Smart-ID/Mobile-ID
- Stripe Checkout for payments
- Recharts for animated charts

## Deferred Ideas

None — using existing plans.
