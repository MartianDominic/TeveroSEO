# Phase 87: Agency Business — Context

> **Created:** 2026-05-05
> **Status:** Planning Complete, Ready for Execution
> **Total Effort:** 3-4 days
> **Dependencies:** Phase 45 (Data Foundation)
> **Spec Document:** [CLIENT-PORTAL-SPEC.md](../CLIENT-PORTAL-SPEC.md)

---

## Executive Summary

Phase 87 delivers two features that transform agency-client communication:

1. **Content Calendar Enhancement** — Drag-drop scheduling (80% already built)
2. **Client Portal** — Read-only window for clients to see their results

Both features are **optional by design** — agencies enable per-client based on their relationship style.

---

## Key Decisions (Locked)

### 1. Everything is Optional

| Feature | Default | Agency Enables When |
|---------|---------|---------------------|
| Client Portal | **OFF** | Client asks "can I see progress anytime?" |
| Notifications | **OFF** | 15+ clients, need scale |
| Content Approval | **OFF** | Regulated industry, new relationship |

**Rationale:** Not every agency wants automation. Boutique agencies prefer calls. White-glove services present results in person. The best agency experience is THEIR workflow, not ours.

### 2. Communication Styles (Not Feature Toggles)

Instead of "which features?", ask **"how will you work with this client?"**

| Style | Portal | Notifications | Content | Best For |
|-------|--------|---------------|---------|----------|
| **High-Touch** | None | None | Publish directly | Premium clients, boutique |
| **Hybrid** | Link only | Monthly report | Publish directly | Most clients |
| **Self-Service** | Full login | All enabled | Client approves | Scaling agencies |

**Rationale:** Relationship-first framing makes configuration intuitive.

### 3. Portal Authentication Levels

| Level | Security | UX | Use When |
|-------|----------|---|----------|
| **Token-only** | Low | Frictionless | Trusted link sharing |
| **Token + Email** | Medium | One-time verify | Need audit trail |
| **Full Login** | High | Account required | Multiple stakeholders |

**Rationale:** Progressive security matches agency's risk tolerance.

### 4. Onboarding UX

- **5-step flow**: Details → Package → Style → Keywords → Launch
- **~2 minutes** to onboard a client
- **Visual preview** shows what client will see before committing
- **Progressive disclosure**: Style picker first, fine-tune hidden
- **Reassurance elements**: "You can change this anytime"

---

## Sub-Phase Overview

| Sub-phase | Focus | Effort | Key Deliverable |
|-----------|-------|--------|-----------------|
| **87-01** | Content Calendar Drag-Drop | 0.5 day | @dnd-kit handlers + date picker |
| **87-02** | Portal Token Schema | 0.5 day | `portal_tokens` table + security |
| **87-03** | Portal Auth Levels | 1 day | Token/Email/Login authentication |
| **87-04** | Portal UI Layout | 1 day | `ClientPortalView.tsx` + components |
| **87-05** | Notification System | 0.5 day | `NotificationPreference` schema + worker |
| **87-06** | Communication Style Config | 0.5 day | Style presets + per-client settings |

---

## Architecture

### Content Calendar Enhancement

```
EXISTING (80% complete):
├── ContentCalendarPage.tsx — react-big-calendar
├── contentCalendarStore.ts — article state management
├── ScheduledArticle model — keyword, publish_date, status
└── PATCH endpoint — already supports changing publish_date

NEW (Phase 87-01):
├── @dnd-kit handlers for drag-drop scheduling
├── Date picker per article in detail sheet
└── Keyword research → calendar link (connect keyword_id)
```

### Client Portal

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT PORTAL FLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TOKEN GENERATION                                                   │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Agency creates portal → generates token → sends link to client ││
│  │ Token: grzm-8f4k-2n9x (nanoid, 12 chars)                       ││
│  │ Expiry: 30 days default (configurable)                         ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  AUTHENTICATION (per auth_level)                                    │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ token_only:  /portal/:token → direct access                    ││
│  │ email_verify: /portal/:token → verify email → access           ││
│  │ full_login:  /portal/:token → Clerk login → access             ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  PORTAL VIEW                                                        │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Hero: Big number (40 keywords in top 10)                       ││
│  │ Progress: Bar showing goal vs. delivered (400% achieved)       ││
│  │ Tabs: Overview | Keywords | Content | Rankings                 ││
│  │ Read-only: No edit actions, just visibility                    ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Portal Tokens

```sql
CREATE TABLE portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  token VARCHAR(32) NOT NULL UNIQUE, -- nanoid
  
  -- Security
  auth_level TEXT NOT NULL DEFAULT 'token_only', -- token_only, email_verify, full_login
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Usage tracking
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  
  -- Status
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX portal_tokens_token_idx ON portal_tokens(token);
CREATE INDEX portal_tokens_client_id_idx ON portal_tokens(client_id);
```

### Portal Users (for email_verify and full_login)

```sql
CREATE TABLE portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  email VARCHAR(255) NOT NULL,
  
  -- Auth
  clerk_user_id VARCHAR(255), -- NULL for email_verify
  email_verified_at TIMESTAMPTZ,
  
  -- Access
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT portal_users_client_email_unique UNIQUE (client_id, email)
);
```

### Notification Preferences

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) UNIQUE,
  
  -- Notification types (all default FALSE)
  weekly_digest BOOLEAN DEFAULT FALSE,
  monthly_report BOOLEAN DEFAULT FALSE,
  milestone_alerts BOOLEAN DEFAULT FALSE,
  content_published BOOLEAN DEFAULT FALSE,
  
  -- Recipients
  recipient_emails TEXT[] DEFAULT '{}',
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Client Communication Settings

```sql
CREATE TABLE client_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) UNIQUE,
  
  -- Communication style preset
  communication_style TEXT DEFAULT 'hybrid', -- high_touch, hybrid, self_service, custom
  
  -- Portal settings
  portal_enabled BOOLEAN DEFAULT FALSE,
  portal_auth_level TEXT DEFAULT 'token_only',
  
  -- Notification settings
  notifications_enabled BOOLEAN DEFAULT FALSE,
  
  -- Content workflow
  content_approval_required BOOLEAN DEFAULT FALSE,
  auto_approve_after_days INTEGER DEFAULT 3,
  
  -- Keyword tracking
  keyword_lockin_enabled BOOLEAN DEFAULT TRUE, -- ON by default (infrastructure)
  keyword_lockin_strict BOOLEAN DEFAULT FALSE, -- strict vs informal
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## UI Components

### Portal View Hierarchy

```
ClientPortalView.tsx
├── PortalHeader.tsx — Logo, client name, last updated
├── PortalHero.tsx — Big number, progress bar, goal achievement
├── PortalTabs.tsx
│   ├── OverviewTab.tsx — Summary metrics, recent activity
│   ├── KeywordsTab.tsx — Keyword table with funnel breakdown
│   ├── ContentTab.tsx — Content calendar (read-only)
│   └── RankingsTab.tsx — Position trends, movement alerts
└── PortalFooter.tsx — Agency branding, contact info
```

### Agency Settings UI

```
ClientSettingsPage.tsx
├── CommunicationStyleSelector.tsx — Style picker with preview
├── PortalSettingsPanel.tsx — Enable, auth level, URL management
├── NotificationSettingsPanel.tsx — Toggle + recipient management
├── ContentWorkflowPanel.tsx — Approval settings
└── KeywordTrackingPanel.tsx — Lock-in settings
```

---

## Success Criteria

1. Content calendar supports drag-drop rescheduling
2. Portal token generation works with 3 auth levels
3. Portal view loads < 500ms with real client data
4. Communication style presets correctly configure features
5. Onboarding flow completes in < 2 minutes
6. All features disabled by default until agency enables
7. Settings UI shows visual preview before committing

---

## References

- [CLIENT-PORTAL-SPEC.md](../CLIENT-PORTAL-SPEC.md) — Comprehensive specification
- [PHASE-85-89-DEEP-DIVE.md](../PHASE-85-89-DEEP-DIVE.md) — Technical deep-dive
- [design-system-v6.md](../../design/design-system-v6.md) — UI design patterns
- [v8-agency-pipeline.md](../../design/v8-agency-pipeline.md) — Agency data models

---

*Context document completed: 2026-05-05*
