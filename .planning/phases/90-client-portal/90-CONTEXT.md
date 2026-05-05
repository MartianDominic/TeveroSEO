---
phase: 90
name: World-Class Client Portal
milestone: v10.0
status: ready
created: "2026-05-05"
prd: CLIENT-PORTAL-PRD.md
---

# Phase 90 Context: World-Class Client Portal

## Vision

Build a client portal that answers "Is my SEO working?" in 5 seconds — with every number traceable to Google's own data. Inspired by Linear, Stripe, Superhuman, and Locomotive.

**Core Principle:** Never show a number you can't defend in a client meeting.

## Trust Hierarchy (CRITICAL)

All data display follows this strict hierarchy:

```
VERIFIED (GSC)          ← Always show, source of truth
    ↓
CALCULATED (our math)   ← Show growth %, changes (derived from GSC)
    ↓
DEFENSIBLE (CPC data)   ← Optional, clearly labeled with asterisk
    ↓
CLIENT-OWNED (inputs)   ← Their numbers, their responsibility
    ↓
INTEGRATED (GA4)        ← Real revenue if connected

✗ NEVER: Industry average revenue estimates
✗ NEVER: Conversion rate assumptions we made up
✗ NEVER: "Your SEO is worth €X" without client data
```

## Design Principles

1. **Proactive > Reactive** — Portal comes to the client (notifications, digests)
2. **Relative over Absolute** — "Up 340%" beats "Worth €12k"
3. **Show the Work** — Transparency justifies retainer
4. **Signal over Noise** — Fewer notifications, higher quality
5. **Speed is Trust** — Sub-second loads, instant interactions

## V6 Design System Tokens

### Typography

```css
/* Fonts */
--font-display: 'Newsreader';  /* Titles, large numbers */
--font-sans: 'Geist';          /* Body, UI */
--font-mono: 'Geist Mono';     /* Code, timestamps, domains */

/* Type Scale */
--type-h1:    clamp(30px, 2.4vw, 40px);   /* Page titles */
--type-h2:    clamp(17px, 1.3vw, 18.5px); /* Section titles */
--type-h3:    clamp(15px, 1.1vw, 16px);   /* Card titles */
--type-body:  clamp(14px, 1vw, 14.5px);   /* Body text */
--type-small: clamp(13px, 0.92vw, 13.5px);/* Meta text */
--type-tiny:  12px;                        /* Labels, eyebrows (WCAG floor) */

/* Number Display */
--num-mega:   clamp(58px, 4.8vw, 80px);   /* Hero numbers */
--num-hero:   clamp(38px, 3.2vw, 46px);   /* Large stats */
--num-card:   clamp(36px, 3vw, 44px);     /* Card numbers */
--num-row:    clamp(20px, 1.7vw, 26px);   /* Table numbers */
```

### Colors

```css
--canvas:       #FAFAF7;  /* Background */
--surface:      #FFFFFF;  /* Cards */
--surface-2:    #F8F8F3;  /* Secondary surface */
--surface-3:    #F2F1EB;  /* Tertiary surface */
--text-1:       #14141A;  /* Primary text */
--text-2:       #54545A;  /* Secondary text */
--text-3:       #93939A;  /* Tertiary/labels */
--text-4:       #C4C3BB;  /* Disabled */
--accent:       #0F4F3D;  /* Primary green */
--accent-soft:  #EAF1ED;  /* Accent background */
--success:      #1B6E45;  /* Positive */
--success-soft: #EAF2EE;  /* Success background */
--error:        #9B2C2C;  /* Negative */
--error-soft:   #F4E6E6;  /* Error background */
--warning:      #A87F1A;  /* Caution */
--warning-soft: #F4EDDA;  /* Warning background */
```

### Shadows (Ghost-Edge)

```css
/* Default card shadow */
--shadow-card:
  0 0 0 1px rgba(20, 20, 26, 0.045),
  0 1px 2px rgba(20, 20, 26, 0.03),
  inset 0 1px 0 rgba(255, 255, 255, 0.5);

/* Hover lift state */
--shadow-lift:
  0 0 0 1px rgba(20, 20, 26, 0.06),
  0 6px 16px -4px rgba(20, 20, 26, 0.06),
  0 16px 40px -16px rgba(20, 20, 26, 0.10),
  inset 0 1px 0 rgba(255, 255, 255, 0.55);
```

### Motion

```css
--ease-smooth:    cubic-bezier(0.16, 1, 0.3, 1);
--motion-fast:    160ms;
--motion-hover:   280ms;
--motion-reveal:  240ms;
```

### Radii

```css
--radius-input:  6px;
--radius-button: 8px;
--radius-card:   12px;
--radius-modal:  14px;
--radius-pill:   999px;
```

## Component Patterns

### Card with Hover Lift

```tsx
<div className="bg-surface rounded-card shadow-card hover:shadow-lift hover:-translate-y-px transition-all duration-hover">
  {children}
</div>
```

### Stat Card

```tsx
<StatCard
  icon={<TrendingUp />}
  label="Organic Clicks"
  value={8420}
  delta={34}
  deltaLabel="vs last month"
  source="GSC"  // Shows "GSC" badge
/>
```

### Delta Badge

```tsx
// Auto-determines color from value
<DeltaBadge value={12} />    // Green: ↑ +12
<DeltaBadge value={-5} />    // Red: ↓ -5
<DeltaBadge value={0} />     // Gray: —
```

### Trust Indicator

```tsx
// For estimated data
<TrustIndicator level="estimated" />  // Shows asterisk *
<TrustIndicator level="verified" />   // Shows checkmark ✓
<TrustIndicator level="client" />     // Shows user icon
```

## Data Sources Mapping

| Data Point | Source | Trust Level | UI Treatment |
|------------|--------|-------------|--------------|
| Clicks | GSC | Verified | No indicator needed |
| Impressions | GSC | Verified | No indicator needed |
| Position | GSC | Verified | No indicator needed |
| Position Change | Calculated | Verified | No indicator needed |
| Top 10 Count | Calculated | Verified | No indicator needed |
| Volume | DataForSEO | Estimated | Asterisk + footnote |
| CPC | DataForSEO | Estimated | Asterisk + footnote |
| Difficulty | DataForSEO | Estimated | Asterisk + footnote |
| Conversion Rate | Client | Client-owned | User icon + "your input" |
| AOV | Client | Client-owned | User icon + "your input" |
| Revenue | GA4 | Integrated | "From GA4" badge |

## Information Architecture

```
/portal/:clientId
├── /dashboard          (default landing)
├── /keywords
│   └── /:keywordId     (keyword detail)
├── /progress
├── /value
├── /activity
├── /requests
│   ├── /new/:type
│   └── /:requestId
├── /documents
├── /team
├── /integrations
└── /settings
```

## Authentication Model

Portal uses existing `portal_tokens` from Phase 89:

```typescript
// Three auth levels
type PortalAuthLevel = 
  | 'token'        // Link-only access (default)
  | 'email_verify' // Email verification required
  | 'full_login';  // Clerk auth required

// Token validation
const token = await db.query.portalTokens.findFirst({
  where: and(
    eq(portalTokens.token, urlToken),
    eq(portalTokens.isActive, true),
    gt(portalTokens.expiresAt, new Date())
  )
});
```

## Notification Strategy

### Email Templates

All emails follow this structure:

```
Subject: [Emoji] [Primary Info]

Hi {firstName},

[One-line hook with the news]

[Details in simple list format]

[Single CTA button]

──────────────────────────────
Sent by TeveroSEO · Manage notifications
```

### Notification Types

| Event | Email | Slack | Push | Default |
|-------|-------|-------|------|---------|
| Keyword hits Top 10 | ✓ | ✓ | ✓ | ON |
| Goal achieved | ✓ | ✓ | ✓ | ON |
| Significant drop | ✓ | ✓ | ✓ | ON |
| Work completed | - | - | ✓ | ON |
| Weekly digest | ✓ | - | - | ON |

## Implementation Phases

| Plan | Name | Duration | Focus |
|------|------|----------|-------|
| 90-01 | Trust Foundation | 3 weeks | Dashboard, keywords, activity, notifications |
| 90-02 | Progress & Value | 2 weeks | Goals, before/after, milestones, value context |
| 90-03 | Self-Service | 2 weeks | Requests, documents, calendar |
| 90-04 | Intelligence | 3 weeks | GA4, Slack, anomalies, team |
| 90-05 | Polish & PWA | 2 weeks | PWA, push, white-label |

## Dependencies

- **Phase 89** (Keyword Lock-in): Provides `contracts`, `contractedKeywords`, `outOfScopeRequests` schemas
- **Phase 87** (Agency Business): Provides base portal token authentication
- **GSC Integration** (Phase 61): Required for verified data
- **BullMQ** (existing): For notification jobs
- **Resend** (existing): For transactional emails

## Success Metrics

| Category | Metric | Target |
|----------|--------|--------|
| Engagement | Weekly active users | >60% of clients |
| Engagement | Return rate (weekly) | >50% |
| Trust | "Where did this number come from" questions | Near zero |
| Trust | Contract renewal rate | >85% |
| Efficiency | Requests via portal (vs email) | >50% |
| Efficiency | Time to answer "how's my SEO" | <30 seconds |

## File Structure

```
apps/web/src/
├── app/portal/[clientId]/
│   ├── page.tsx              (dashboard)
│   ├── keywords/
│   ├── progress/
│   ├── value/
│   ├── activity/
│   ├── requests/
│   ├── documents/
│   ├── team/
│   ├── integrations/
│   └── settings/
├── components/portal/
│   ├── StatCard.tsx
│   ├── DeltaBadge.tsx
│   ├── TrustIndicator.tsx
│   ├── KeywordTable.tsx
│   ├── ActivityFeed.tsx
│   ├── WinCard.tsx
│   ├── NeedsAttention.tsx
│   └── ...
└── lib/portal/
    ├── types.ts
    ├── api.ts
    └── hooks.ts

open-seo-main/src/
├── db/schema/
│   └── portal-schema.ts      (extends existing)
├── server/features/portal/
│   ├── services/
│   │   ├── DashboardService.ts
│   │   ├── NotificationService.ts
│   │   ├── ActivityService.ts
│   │   └── RequestService.ts
│   └── repositories/
└── routes/api/portal/
    ├── dashboard.$clientId.ts
    ├── keywords.$clientId.ts
    └── ...
```

## Key Decisions (Locked)

1. **No fake revenue numbers** — Only show verified GSC data + client-provided inputs
2. **Asterisks for estimates** — DataForSEO volume/CPC clearly labeled
3. **GSC required** — Portal cannot function without GSC connection
4. **GA4 optional** — Unlocks verified revenue if connected
5. **Push via PWA** — Native push notifications, not browser-only
6. **Resend for email** — Consistent with existing email infrastructure
7. **BullMQ for async** — Notification jobs, digest generation
