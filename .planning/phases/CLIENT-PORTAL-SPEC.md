# Client Portal & Keyword Lock-in Specification

> **Generated:** 2026-05-05
> **Purpose:** Comprehensive spec for Phase 87-89 core features
> **Design System:** [design-system-v6.md](/.planning/design/design-system-v6.md)
> **Data Models:** [v8-agency-pipeline.md](/.planning/design/v8-agency-pipeline.md)

---

## Executive Summary

Two features define the agency-client relationship:

1. **Keyword Lock-in** — The contract-to-delivery bridge that proves ROI
2. **Client Portal** — The read-only window that clients use to see their results

Together they answer the client's only question: *"Is this working?"*

---

## Philosophy: Optional by Design

**Every feature in this spec is optional.** The platform enables workflows, it doesn't enforce them.

### Default States

| Feature | Default | Why |
|---------|---------|-----|
| Client Portal | **OFF** | Agency explicitly enables per client |
| Notifications | **OFF** | Agency explicitly enables per client |
| Content Approval | **OFF** | Agency publishes directly by default |
| Keyword Lock-in | **ON** | Infrastructure, but can be informal (no strict enforcement) |

### Why Optional Matters

Not every agency wants automation:

| Agency Type | Their Preference |
|-------------|------------------|
| Boutique (3-5 clients) | Personal calls every week, relationship-first |
| White-glove premium | Present results in person, not dashboards |
| Non-technical clients | Would never log into a portal anyway |
| Trust-based retainers | Client doesn't want to review content |

**The best agency experience is THEIR workflow, not ours.**

### Configuration Hierarchy

```
PLATFORM DEFAULTS (agency-wide)
    ↓ can be overridden by
CLIENT SETTINGS (per-client)
    ↓ can be adjusted by
CLIENT PREFERENCES (if agency allows self-service)
```

### The Rule

If an agency doesn't want a feature, they should **never see it**. No "disabled but visible" states. Clean UI for their chosen workflow.

### Per-Client Configuration UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLIENT SETTINGS: Grožio Namai                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLIENT ACCESS                                                              │
│  ○ No portal (we communicate directly)                                      │
│  ○ Portal link only (read-only, no login)                                   │
│  ● Portal with login (client requested dashboard access)                    │
│                                                                             │
│  NOTIFICATIONS                                                              │
│  ○ None (we handle all communication)                                       │
│  ○ Monthly report only                                                      │
│  ● Weekly + monthly + milestones (client requested)                         │
│                                                                             │
│  CONTENT WORKFLOW                                                           │
│  ● Publish directly (trusted relationship)                                  │
│  ○ Client reviews before publish                                            │
│                                                                             │
│  KEYWORD TRACKING                                                           │
│  ● Formal lock-in (contract specifies exact keywords)                       │
│  ○ Informal (we track keywords but no strict scope)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### When to Use Each Feature

**Client Portal — Enable when:**
- Client asks "can I see progress anytime?"
- Agency wants to reduce "what's the status?" emails
- Client has multiple stakeholders who need visibility
- Agency positions transparency as differentiator

**Client Portal — Skip when:**
- Agency prefers personal monthly calls
- Client said "just send me a PDF quarterly"
- Client wouldn't log in anyway
- White-glove service where agency presents everything

**Notifications — Enable when:**
- 15+ clients (can't call everyone weekly)
- Client explicitly requests automated updates
- Need audit trail of communication
- Want to scale without hiring

**Notifications — Skip when:**
- Prefer to control message timing
- Client said "don't email me"
- Agency delivers news personally
- Few enough clients to call regularly

**Content Approval — Enable when:**
- Client insists on reviewing before publish
- Regulated industry (legal/medical needs sign-off)
- New client relationship (building trust)
- Client has specific brand requirements

**Content Approval — Skip when:**
- Client said "just publish, I trust you"
- Speed matters (approval is bottleneck)
- Agency is the expert (client defers)
- Established trust relationship

---

## Agency Onboarding Journey

### The Problem with Feature Toggles

Bad UX:
```
☐ Enable portal
☐ Enable notifications
☐ Enable content approval
```

This forces agency users to think about features instead of relationships.

### Better: Ask About the Relationship

Instead of "which features?", ask **"how will you work with this client?"**

### Step 3: Communication Style (The Key Step)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ NEW CLIENT: Grožio Namai                                    Step 3 of 5    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HOW WILL YOU WORK WITH THIS CLIENT?                                        │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ○ HIGH-TOUCH                                                           ││
│  │   Personal calls, you present results, white-glove service             ││
│  │                                                                         ││
│  │   → No portal (you communicate directly)                               ││
│  │   → No automated emails (you control timing)                           ││
│  │   → Publish directly (trusted relationship)                            ││
│  │                                                                         ││
│  │   Best for: Premium clients, boutique agencies                         ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ● HYBRID (Recommended)                                                 ││
│  │   Portal for visibility, but you still communicate personally          ││
│  │                                                                         ││
│  │   → Portal link (client can check anytime)                             ││
│  │   → Monthly report email only                                          ││
│  │   → Publish directly                                                   ││
│  │                                                                         ││
│  │   Best for: Most clients                                               ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ○ SELF-SERVICE                                                         ││
│  │   Dashboard-first, automated updates, minimal calls                    ││
│  │                                                                         ││
│  │   → Portal with login (full access)                                    ││
│  │   → All notifications enabled                                          ││
│  │   → Client reviews content before publish                              ││
│  │                                                                         ││
│  │   Best for: Busy clients, larger agencies, scale-focused               ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ○ CUSTOM                                                               ││
│  │   I'll configure each setting manually                                 ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│                                                         [← Back] [Next →]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Full 5-Step Onboarding Flow (~2 minutes)

```
[1. Details]──[2. Package]──[3. Style]──[4. Keywords]──[5. Launch]
```

**Step 1: Client Details (30 sec)**
```
Company name    [Grožio Namai_________________]
Domain          [grozionamai.lt_______________]
Primary contact [Jonas Jonaitis_______________]
Email           [jonas@grozionamai.lt_________]
Industry        [Beauty & Cosmetics ▼]
Location        [Vilnius, Lithuania ▼]
```

**Step 2: Service Package (30 sec)**
```
Package         [SEO Growth ▼]
                ├── SEO Audit + Fixes
                ├── 50 Target Keywords
                ├── 8 Articles/Month
                └── Monthly Reporting

Monthly fee     €[2,500____]
Duration        [6 months ▼]
Goal            Land [30] keywords in [Top 10 ▼] by [Nov 15, 2026]
```

**Step 3: Communication Style** — shown above

**Step 4: Keywords (optional)**
```
How would you like to set up keywords?

○ Import from proposal (47 keywords already analyzed)
○ Research now (run keyword analysis)
● Do this later (set up after onboarding)
```

**Step 5: Launch**
```
Ready to launch Grožio Namai?

☑ Send welcome email to jonas@grozionamai.lt
☐ Schedule kickoff call
☑ Run initial site audit
☐ Generate portal link now

SUMMARY
├── Package: SEO Growth (€2,500/mo)
├── Style: Hybrid (portal link + monthly report)
├── Goal: 30 keywords in Top 10 by Nov 15
└── Keywords: Set up later

                              [← Back] [Launch Client →]
```

### Visual Preview: Show What Client Will Experience

When agency selects a style, show the client's view:

```
┌───────────────────────────────────┬─────────────────────────────────────────┐
│                                   │                                         │
│  SETTINGS                         │  PREVIEW: What Grožio Namai sees        │
│                                   │                                         │
│  Portal: Link only                │  ┌─────────────────────────────────────┐│
│  ● Enabled                        │  │     40                              ││
│  ○ Disabled                       │  │  keywords in top 10                 ││
│                                   │  │                                     ││
│  Notifications:                   │  │  ━━━━━━━━━━━━━━━━━━━━━              ││
│  ☐ Weekly digest                  │  │  Goal: 30  Current: 40              ││
│  ☑ Monthly report                 │  │                                     ││
│  ☐ Milestone alerts               │  │  133% of goal achieved              ││
│                                   │  └─────────────────────────────────────┘│
│                                   │                                         │
│  Content:                         │  ┌─────────────────────────────────────┐│
│  ● Publish directly               │  │  📧 Monthly Email Preview           ││
│  ○ Client reviews                 │  │                                     ││
│                                   │  │  Subject: Your May 2026 Report      ││
│                                   │  │  • 40 keywords in Top 10            ││
│                                   │  │  • +12% traffic this month          ││
│                                   │  └─────────────────────────────────────┘│
│                                   │                                         │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

### Post-Onboarding: Client Settings Page

After onboarding, agency can fine-tune anytime:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Grožio Namai                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLIENT SETTINGS                                                            │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ COMMUNICATION STYLE                                                    ││
│  │                                                                         ││
│  │ Currently: Hybrid                                       [Change →]     ││
│  │ Portal link + monthly report + publish directly                        ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ FINE-TUNE SETTINGS                                      [Expand ▼]    ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Expanded fine-tune view:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FINE-TUNE SETTINGS                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PORTAL ACCESS                                                              │
│  ○ Disabled (no portal)                                                     │
│  ● Link only (anyone with link can view)                                    │
│  ○ Email verification (client verifies via email)                           │
│  ○ Full login (client creates account)                                      │
│                                                                             │
│  Portal URL: app.tevero.io/p/grzm-8f4k-2n9x                                │
│  [Copy Link] [Regenerate] [Preview Portal]                                  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  NOTIFICATIONS                                                              │
│  Send to: jonas@grozionamai.lt                            [+ Add email]    │
│                                                                             │
│  ☐ Weekly digest (every Monday)                                             │
│  ☑ Monthly report (1st of month)                          [Preview →]      │
│  ☐ Milestone alerts (goal reached, big ranking jump)                        │
│  ☐ Content published (when new article goes live)                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CONTENT WORKFLOW                                                           │
│  ● Publish directly (you decide when content goes live)                     │
│  ○ Client approval required (client reviews before publish)                 │
│    └── Auto-approve after [3 days ▼] if no response                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  KEYWORD TRACKING                                                           │
│  ● Formal lock-in (contract specifies exact keywords)                       │
│    └── 47 keywords locked · Goal: 30 in Top 10 by Nov 15                   │
│    └── [View locked keywords] [Edit scope]                                  │
│  ○ Informal (flexible scope, no strict tracking)                            │
│                                                                             │
│                                                           [Save Changes]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### UX Principles

| Principle | How Applied |
|-----------|-------------|
| **Sensible defaults** | Hybrid style pre-selected |
| **Progressive disclosure** | Style picker first, fine-tune hidden |
| **Visual preview** | Show what client sees before committing |
| **Relationship-first** | "How will you work together?" not "which features?" |
| **Reversible** | Change style or settings anytime |
| **Quick** | Full onboarding in ~2 minutes |
| **No dead-ends** | "Do this later" for optional steps |

### Progressive Detail UX: Helping Agency Users Understand

**Problem:** Agency users need to understand what each option means without reading documentation.

**Solution:** Progressive disclosure at 4 levels — each interaction reveals more detail.

#### Level 1: At-a-Glance (Always Visible)

Every option shows: **Label + One-line description + ⓘ icon**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HOW WILL YOU WORK WITH THIS CLIENT?                                         │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ○ HIGH-TOUCH ⓘ                                                         ││
│  │   Personal calls, you present results, white-glove service             ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ● HYBRID (Recommended) ⓘ                                               ││
│  │   Portal for visibility, but you still communicate personally          ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ○ SELF-SERVICE ⓘ                                                       ││
│  │   Dashboard-first, automated updates, minimal calls                    ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  [Compare all options →]                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Level 2: Expanded Detail on Selection

When user selects an option, show the full breakdown inline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ● HYBRID (Recommended) ⓘ                                               ││
│  │   Portal for visibility, but you still communicate personally          ││
│  │                                                                         ││
│  │   ┌──────────────────────────────────────────────────────────────────┐ ││
│  │   │ WHAT THIS MEANS:                                                 │ ││
│  │   │ → Client gets a link to view progress anytime                    │ ││
│  │   │ → You send monthly email reports (automated)                     │ ││
│  │   │ → Content publishes when you decide (no client approval)         │ ││
│  │   │                                                                   │ ││
│  │   │ BEST FOR:                                                        │ ││
│  │   │ Most agency-client relationships. Client has transparency        │ ││
│  │   │ without micromanaging. You stay in control.                      │ ││
│  │   │                                                                   │ ││
│  │   │ YOU CAN CHANGE THIS LATER:                                       │ ││
│  │   │ Client Settings → Communication Style → anytime                  │ ││
│  │   └──────────────────────────────────────────────────────────────────┘ ││
│  └────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Level 3: Comparison Table

"Compare all options" opens side-by-side comparison:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ COMPARE COMMUNICATION STYLES                                        [× Close]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                  │ HIGH-TOUCH       │ HYBRID           │ SELF-SERVICE      │
│  ────────────────┼──────────────────┼──────────────────┼─────────────────  │
│                  │                  │                  │                   │
│  Portal          │ ✗ None           │ Link only        │ Full login        │
│                  │ You present      │ Client peeks     │ Client dashboard  │
│                  │ everything       │ when curious     │ as primary view   │
│                  │                  │                  │                   │
│  ────────────────┼──────────────────┼──────────────────┼─────────────────  │
│                  │                  │                  │                   │
│  Notifications   │ ✗ None           │ Monthly report   │ Weekly + monthly  │
│                  │ You call/email   │ You supplement   │ + milestones      │
│                  │ directly         │ with calls       │ + content alerts  │
│                  │                  │                  │                   │
│  ────────────────┼──────────────────┼──────────────────┼─────────────────  │
│                  │                  │                  │                   │
│  Content         │ Publish directly │ Publish directly │ Client approves   │
│                  │ Total control    │ You decide       │ before publish    │
│                  │                  │                  │                   │
│  ────────────────┼──────────────────┼──────────────────┼─────────────────  │
│                  │                  │                  │                   │
│  Best for        │ Premium clients  │ Most clients     │ Scaling agencies  │
│                  │ White-glove      │ Balanced control │ Busy clients      │
│                  │ Boutique shops   │ and transparency │ Self-starters     │
│                  │                  │                  │                   │
│  ────────────────┼──────────────────┼──────────────────┼─────────────────  │
│                  │                  │                  │                   │
│  Your time       │ HIGH             │ MEDIUM           │ LOW               │
│                  │ Weekly calls     │ Monthly calls    │ Quarterly check-in│
│                  │ Manual reports   │ Assisted reports │ Automated reports │
│                  │                  │                  │                   │
│  ────────────────┼──────────────────┼──────────────────┼─────────────────  │
│                  │                  │                  │                   │
│  Client trust    │ Relationship     │ Trust but verify │ Self-directed     │
│                  │ "I trust you"    │ "I'll peek"      │ "I'll manage"     │
│                  │                  │                  │                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Level 4: Info Icon Details

Clicking the ⓘ icon shows contextual help popover:

```
┌────────────────────────────────────────┐
│ HYBRID STYLE                           │
│ ──────────────────────────────────────│
│                                        │
│ The most popular choice for agencies.  │
│                                        │
│ ✓ Portal gives client visibility       │
│ ✓ Monthly reports automate updates     │
│ ✓ You still control content & timing   │
│                                        │
│ This works well when:                  │
│ • Client wants to "check in" sometimes │
│ • You don't have time for weekly calls │
│ • Client trusts your judgment          │
│                                        │
│ You'll still want to:                  │
│ • Call before big milestones           │
│ • Send personal notes with reports     │
│ • Check if they've opened the portal   │
│                                        │
│ [Got it]                               │
└────────────────────────────────────────┘
```

#### Smart Recommendations

Show context-aware suggestions based on available data:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💡 RECOMMENDATION                                                           │
│                                                                             │
│ Based on your agency profile:                                               │
│ • You have 18 active clients                                                │
│ • Grožio Namai is a €2,500/mo package (mid-tier)                           │
│ • Beauty industry clients typically prefer visual dashboards                │
│                                                                             │
│ → We recommend HYBRID for this client                                       │
│                                                                             │
│ [Apply recommendation]  [I'll choose myself]                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Recommendation Logic:**

| Context Signal | Recommendation |
|----------------|----------------|
| Package > €5,000/mo | HIGH-TOUCH (premium clients expect calls) |
| Package < €1,000/mo | SELF-SERVICE (efficiency matters) |
| Agency has 1-5 clients | HIGH-TOUCH (you have time) |
| Agency has 15+ clients | HYBRID or SELF-SERVICE (scale required) |
| Client industry = Beauty/Fashion | HYBRID (visual dashboards resonate) |
| Client industry = Legal/Finance | HIGH-TOUCH (relationship matters) |
| Client location ≠ your city | HYBRID (remote needs async visibility) |

#### Reassurance Elements

Every selection shows changeable/reversible status:

| Element | Where Shown |
|---------|-------------|
| "You can change this anytime" | Below every style option |
| "Settings → Communication Style" | Path to change later |
| "This only affects this client" | Confirming scope |
| "Client won't be notified" | On setting changes |
| "Preview before saving" | On any change |

**Example reassurance in wireframe:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ● HYBRID (Recommended) ⓘ                                                   │
│   Portal for visibility, but you still communicate personally              │
│                                                                             │
│   ↳ You can change this anytime in Client Settings                         │
└────────────────────────────────────────────────────────────────────────────┘
```

### Description Density Principle

**Rule:** More consequential decisions need more explanation.

| Decision Type | Explanation Level |
|---------------|-------------------|
| Reversible, low-stakes | One line + ⓘ icon |
| Takes effect immediately | Inline expanded detail |
| Affects client experience | Preview + confirmation |
| Irreversible (rare) | Modal + explicit confirm |

**Examples:**

```
LOW-STAKES (one line):
☑ Weekly digest → "Summary every Monday"

MEDIUM-STAKES (expanded):
Portal: Link only
↳ Anyone with the link can view. No login required.
   Use for: clients who won't bother logging in

HIGH-STAKES (preview):
Content Workflow: Client approves
↳ Client will receive email for each article
   They have 3 days to approve or reject
   [Preview what client sees →]
```

---

## Part 1: Keyword Lock-in System

### Why This Matters

Agencies face two problems:
1. **Scope creep** — Client asks for 50 keywords, then "can you also do X, Y, Z?"
2. **Value attribution** — Client says "I don't see results" when they have 40 keywords in top 10

Keyword Lock-in solves both by creating a permanent record of what was promised vs. what was delivered.

### The Contract-to-Delivery Bridge

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KEYWORD LOCK-IN LIFECYCLE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONTRACT SIGNED                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ Goal: Land 10-20 keywords in top 10 by July 31, 2026                   ││
│  │ Locked Keywords: 50 (the working set to achieve goal)                  ││
│  │ Baseline Snapshot: Position data at contract signing                   ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                 │                                           │
│                                 ▼                                           │
│  EXECUTION                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ Weekly: Position tracking against baseline                             ││
│  │ Monthly: Progress report (12/20 in top 10 = 60% to goal)               ││
│  │ Flags: Out-of-scope requests logged, not automatically added           ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                 │                                           │
│                                 ▼                                           │
│  CONTRACT END                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ Delivered: 40 keywords in top 10 (goal was 10-20)                      ││
│  │ Goal Achievement: 200-400% of target                                   ││
│  │ Renewal Proof: Clear, auditable, undeniable                            ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Value Proposition Math

The goal is expressed as a **single contracted number** (not a range). Use the actual target from the contract.

**Scenario A: Contract says "10 keywords in top 10", delivered 40**

| Formula | Result | Interpretation |
|---------|--------|----------------|
| 40 ÷ 10 | **400%** | 4× the contracted target |

**Scenario B: Contract says "20 keywords in top 10", delivered 40**

| Formula | Result | Interpretation |
|---------|--------|----------------|
| 40 ÷ 20 | **200%** | 2× the contracted target |

**Recommended Display:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   40                                                                        │
│   KEYWORDS IN TOP 10                                                        │
│                                                                             │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │
│   ▲ goal (10)                       ▲ delivered (40)                        │
│                                                                             │
│   400% of goal achieved                                                     │
│   "We promised 10. We delivered 40."                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Simple Math (Use This):**
- Use the **single contracted target** from the agreement
- No ranges: if contract says 10, divide by 10; if contract says 20, divide by 20
- The math is honest and directly tied to the signed agreement

### Data Schema

```typescript
// contractedKeywords: The locked keyword set
interface ContractedKeyword {
  id: string;
  contractId: string;
  keywordId: string;
  
  // Lock state
  lockedAt: Date;
  lockedPosition: number | null;      // Position at contract signing
  lockedSearchVolume: number;
  
  // Current state
  status: 'active' | 'completed' | 'replaced' | 'deferred';
  currentPosition: number | null;
  
  // Change tracking
  replacedBy: string | null;          // If swapped for another keyword
  replacedAt: Date | null;
  changeOrderId: string | null;       // If added via paid change order
}

// contractGoal: The target definition
interface ContractGoal {
  id: string;
  contractId: string;
  clientId: string;
  
  // Goal definition
  metric: 'top_10' | 'top_3' | 'page_1' | 'custom';
  targetLower: number;                // 10
  targetUpper: number;                // 20
  deadline: Date;                     // July 31, 2026
  
  // Progress tracking
  currentCount: number;               // How many currently meet metric
  goalAchievementPct: number;         // currentCount / targetUpper × 100
  
  // Timestamps
  startedAt: Date;
  completedAt: Date | null;
}

// outOfScopeRequest: Client asks for keywords not in contract
interface OutOfScopeRequest {
  id: string;
  contractId: string;
  clientId: string;
  
  // Request details
  requestedKeyword: string;
  requestedAt: Date;
  requestedBy: string;                // Client contact name
  
  // Resolution
  status: 'pending' | 'quoted' | 'accepted' | 'declined' | 'added_free';
  changeOrderId: string | null;
  quotedPrice: number | null;
  
  // Notes
  agencyNotes: string | null;
}
```

### Database Tables (Drizzle)

```typescript
export const contractedKeywords = pgTable('contracted_keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id').references(() => contracts.id).notNull(),
  keywordId: uuid('keyword_id').references(() => keywords.id).notNull(),
  
  lockedAt: timestamp('locked_at').defaultNow().notNull(),
  lockedPosition: integer('locked_position'),
  lockedSearchVolume: integer('locked_search_volume').notNull(),
  
  status: text('status').default('active').notNull(),
  currentPosition: integer('current_position'),
  
  replacedBy: uuid('replaced_by'),
  replacedAt: timestamp('replaced_at'),
  changeOrderId: uuid('change_order_id'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const contractGoals = pgTable('contract_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id').references(() => contracts.id).notNull(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  
  metric: text('metric').notNull(),
  targetLower: integer('target_lower').notNull(),
  targetUpper: integer('target_upper').notNull(),
  deadline: date('deadline').notNull(),
  
  currentCount: integer('current_count').default(0).notNull(),
  goalAchievementPct: decimal('goal_achievement_pct', { precision: 5, scale: 2 }).default('0'),
  
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const outOfScopeRequests = pgTable('out_of_scope_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id').references(() => contracts.id).notNull(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  
  requestedKeyword: text('requested_keyword').notNull(),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  requestedBy: text('requested_by'),
  
  status: text('status').default('pending').notNull(),
  changeOrderId: uuid('change_order_id'),
  quotedPrice: decimal('quoted_price', { precision: 10, scale: 2 }),
  
  agencyNotes: text('agency_notes'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Contract Signing Flow

This section documents HOW keyword lock-in actually happens, from proposal through signature.

#### 1. Pre-Contract: Keyword Selection

```
PROPOSAL → Keywords recommended (50)
           ↓
CLIENT REVIEW → Client approves/modifies list
           ↓
FINAL LIST → 47 approved, 3 removed
```

The agency proposes keywords based on research. The client reviews and may request changes before the contract is finalized. This back-and-forth happens before any legal commitment.

#### 2. Contract Signing UI

The actual UI presented at contract signing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT: Grožio Namai                                     [Sign Contract] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TERMS                                                                      │
│  ├── Duration: 6 months (Mar 15 - Sep 15, 2026)                            │
│  ├── Monthly Fee: €2,500                                                   │
│  └── Goal: Land 30 keywords in top 10 by Sep 15                            │
│                                                                             │
│  KEYWORD SCOPE (will be locked on signature)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ☑ 47 keywords from proposal                                         │   │
│  │                                                                      │   │
│  │ BOFU (12) ▼                                                         │   │
│  │ ├── šampūnas plaukams          Vol: 2400  KD: 32  Target: Top 10   │   │
│  │ ├── plaukų kondicionierius     Vol: 1800  KD: 28  Target: Top 10   │   │
│  │ └── ...                                                              │   │
│  │                                                                      │   │
│  │ MOFU (20) ▶                                                         │   │
│  │ TOFU (15) ▶                                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ⚠️  LOCK WARNING                                                          │
│  Once signed, these 47 keywords become the contracted scope.               │
│  Additional keywords require a change order (+€X/keyword).                 │
│                                                                             │
│  ☐ I understand the keyword scope is locked upon signature                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Key UI elements:
- **Collapsible funnel sections** (BOFU/MOFU/TOFU) for easy review
- **Explicit lock warning** so clients understand the commitment
- **Acknowledgment checkbox** required before signing

#### 3. Post-Signature: Lock Event

What happens when [Sign Contract] is clicked:

1. **Create `contract` record** with `signed_at` timestamp
2. **For each keyword in scope:**
   - Create `contracted_keyword` record
   - Set `locked_at` = now
   - Snapshot `locked_position` from current GSC data (or null if not ranking)
   - Set `status` = 'not_started'
3. **Create `contract_goal` record** with target (30 keywords top 10)
4. **Log activity:** "47 keywords locked to contract #2026-0342"
5. **Send confirmation email** to client with:
   - Contract summary
   - Full keyword list
   - Expected timeline
   - Portal access link

```typescript
async function signContract(contractId: string, keywordIds: string[]) {
  return await db.transaction(async (tx) => {
    // 1. Update contract with signature timestamp
    const contract = await tx.update(contracts)
      .set({ signedAt: new Date(), status: 'active' })
      .where(eq(contracts.id, contractId))
      .returning();

    // 2. Lock each keyword
    const lockedKeywords = await Promise.all(
      keywordIds.map(async (keywordId) => {
        const currentPosition = await getGSCPosition(keywordId);
        return tx.insert(contractedKeywords).values({
          contractId,
          keywordId,
          lockedAt: new Date(),
          lockedPosition: currentPosition,
          lockedSearchVolume: await getSearchVolume(keywordId),
          status: 'not_started',
        }).returning();
      })
    );

    // 3. Create goal record
    const goal = await tx.insert(contractGoals).values({
      contractId,
      clientId: contract[0].clientId,
      metric: 'top_10',
      targetLower: 20,
      targetUpper: 30,
      deadline: contract[0].endDate,
      currentCount: 0,
      goalAchievementPct: 0,
      startedAt: new Date(),
    }).returning();

    // 4. Log activity
    await tx.insert(activityLogs).values({
      contractId,
      action: 'keywords_locked',
      details: `${keywordIds.length} keywords locked to contract`,
    });

    return { contract: contract[0], lockedKeywords, goal: goal[0] };
  });
}
```

#### 4. Mid-Contract: Keyword Replacement

Sometimes keywords need to be swapped during the contract period:
- Client: "We discontinued that product, can we swap the keyword?"
- Agency: Create replacement in UI

```
REPLACE KEYWORD
┌─────────────────────────────────────────────────────────────────┐
│ Original: "šampūnas XYZ markė" (discontinued)                   │
│ Replacement: "šampūnas ABC markė" (new product)                 │
│                                                                  │
│ ☐ No additional charge (1-for-1 swap)                          │
│ ○ Change order required (if not equivalent)                     │
│                                                                  │
│ Reason: Product discontinued                                     │
│                                                                  │
│ [Cancel] [Replace Keyword]                                       │
└─────────────────────────────────────────────────────────────────┘
```

**On replacement:**
- Original keyword: `status` = 'replaced', `replaced_by` = new_id, `replaced_at` = now
- New keyword: Create new `contracted_keyword` with same `contract_id`

```typescript
async function replaceKeyword(
  originalKeywordId: string,
  newKeywordId: string,
  contractId: string,
  reason: string,
  requiresChangeOrder: boolean
) {
  return await db.transaction(async (tx) => {
    // Mark original as replaced
    await tx.update(contractedKeywords)
      .set({
        status: 'replaced',
        replacedBy: newKeywordId,
        replacedAt: new Date(),
        changeOrderId: requiresChangeOrder ? await createChangeOrder(tx, contractId) : null,
      })
      .where(
        and(
          eq(contractedKeywords.keywordId, originalKeywordId),
          eq(contractedKeywords.contractId, contractId)
        )
      );

    // Create new contracted keyword
    const currentPosition = await getGSCPosition(newKeywordId);
    const newContractedKeyword = await tx.insert(contractedKeywords).values({
      contractId,
      keywordId: newKeywordId,
      lockedAt: new Date(),
      lockedPosition: currentPosition,
      lockedSearchVolume: await getSearchVolume(newKeywordId),
      status: 'active',
    }).returning();

    // Log activity
    await tx.insert(activityLogs).values({
      contractId,
      action: 'keyword_replaced',
      details: `Keyword replaced: ${reason}`,
    });

    return newContractedKeyword[0];
  });
}
```

#### 5. Multi-Client Conflict Detection

When locking keywords, check for conflicts with other clients in the same geo:

```typescript
async function checkKeywordConflicts(keywordIds: string[], clientId: string) {
  // Find same keywords locked to other clients in same geo
  const conflicts = await db.query(`
    SELECT ck.keyword_id, c.client_name, ck.locked_at
    FROM contracted_keywords ck
    JOIN contracts ct ON ck.contract_id = ct.id
    JOIN clients c ON ct.client_id = c.id
    WHERE ck.keyword_id = ANY($1)
      AND c.id != $2
      AND c.geo = (SELECT geo FROM clients WHERE id = $2)
      AND ck.status = 'active'
  `, [keywordIds, clientId]);
  
  return conflicts;
}
```

Show warning if conflicts found:

```
⚠️ CONFLICT: 3 keywords overlap with existing clients
├── "automobilių detailingas" → Also contracted to AutoSpa (since Jan 2026)
├── "auto valymas" → Also contracted to CleanCar (since Feb 2026)
└── "automobilio poliravimas" → Also contracted to AutoSpa (since Jan 2026)

Options:
○ Proceed anyway (may compete with existing clients)
○ Remove conflicting keywords from this contract
○ Contact existing clients about exclusivity
```

**Conflict resolution workflow:**

1. **Proceed anyway** - Agency accepts potential internal competition. Log the decision for transparency.
2. **Remove conflicting keywords** - Strip conflicts from the new contract before signing.
3. **Contact existing clients** - Pause signing to negotiate exclusivity upgrades or permission.

```typescript
interface ConflictResolution {
  action: 'proceed' | 'remove' | 'pause';
  conflictingKeywordIds: string[];
  agencyNote?: string;
}

async function handleConflicts(
  contractId: string,
  resolution: ConflictResolution
) {
  switch (resolution.action) {
    case 'proceed':
      // Log decision and continue
      await db.insert(activityLogs).values({
        contractId,
        action: 'conflict_accepted',
        details: `Proceeding with ${resolution.conflictingKeywordIds.length} conflicting keywords`,
      });
      break;

    case 'remove':
      // Remove from pending contract scope
      await removeKeywordsFromPendingContract(
        contractId,
        resolution.conflictingKeywordIds
      );
      break;

    case 'pause':
      // Set contract to pending_conflict status
      await db.update(contracts)
        .set({ status: 'pending_conflict' })
        .where(eq(contracts.id, contractId));
      break;
  }
}
```

---

## Part 2: Client Portal Design

### Design Principles

Following [design-system-v6.md](/.planning/design/design-system-v6.md):

1. **One editorial moment per page** — The goal achievement number is THE answer
2. **Cards are glass, not paper** — Ghost-edge shadows, no hard borders
3. **Calm at rest, hover-to-reveal** — Secondary info only on interaction
4. **Numbers want air** — Big Newsreader numerals with generous whitespace
5. **Everything fluid** — `clamp()` for all tokens

### Portal URL Structure

```
/portal/:token → ClientPortalView.tsx
  - Token: UUID v4, maps to client_id
  - Expiry: 30 days (configurable, refreshable)
  - Security: Rate limited (100 views/hour), no write ops
  - Branding: Watermarked with agency logo
```

### Portal Authentication

The portal supports multiple authentication levels to balance security with ease of access.

#### 1. Token-Only Access (Default)

- Secure UUID link, no login required
- Anyone with link can view (read-only)
- Best for: Quick sharing, simple clients
- Risk: Link can be forwarded

```
https://app.teveroseo.com/portal/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

#### 2. Token + Email Verification

- Token triggers OTP to client's registered email
- Verifies viewer is actual client
- Best for: Higher security without password friction
- Flow:
  1. Client clicks portal link
  2. System sends 6-digit OTP to registered email
  3. Client enters OTP to access portal
  4. Session valid for 24 hours

#### 3. Full Client Login (Optional)

- Client creates account (integrate with Clerk)
- Multiple team members with roles (Owner, Viewer)
- Audit trail: who viewed what, when
- Best for: Enterprise clients, multi-stakeholder
- Required for interactive features:
  - Content approval workflow
  - Commenting on keywords
  - Request additional keywords
  - Email notification preferences

#### 4. Recommended Approach

- **Default:** Token-only for simplicity
- Agency can enable "Require email verification" per client
- Login unlocks interactive features
- Configuration stored per-client in `portal_settings`

#### Portal User Schema

```typescript
interface PortalUser {
  id: string;
  clientId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'viewer';
  lastLoginAt: Date | null;
  createdAt: Date;
}

interface PortalSettings {
  clientId: string;
  authLevel: 'token_only' | 'email_verification' | 'full_login';
  allowedDomains: string[];           // Email domain whitelist for team invites
  requireMfaForAdmin: boolean;        // Extra security for admin role
  sessionDurationHours: number;       // Default: 24 for OTP, 168 (7 days) for login
}
```

### Token Security

```typescript
interface PortalToken {
  id: string;
  clientId: string;
  token: string;                      // UUID v4
  
  // Access control
  expiresAt: Date;
  lastAccessedAt: Date | null;
  accessCount: number;
  
  // Permissions
  canViewKeywords: boolean;           // Default: true
  canViewCalendar: boolean;           // Default: true
  canViewProgress: boolean;           // Default: true
  canViewPerformance: boolean;        // Default: true (if GSC connected)
  
  // Branding
  agencyLogoUrl: string | null;
  agencyName: string;
  
  // Status
  isRevoked: boolean;
  revokedAt: Date | null;
  revokedBy: string | null;
  
  createdAt: Date;
  createdBy: string;
}
```

### Portal Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │  [Agency Logo]  ACME SEO PROGRESS        Last updated: 2h ago         ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │                                                                        ││
│  │                              40                                        ││
│  │                         keywords in                                    ││
│  │                           top 10                                       ││
│  │                                                                        ││
│  │    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       ││
│  │    ▲ goal (10-20)                              ▲ current (40)          ││
│  │                                                                        ││
│  │    200% of goal achieved  ·  13 days ahead of schedule                ││
│  │                                                                        ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐         │
│  │ CONTRACTED SCOPE            │  │ PROGRESS BREAKDOWN           │         │
│  │                             │  │                              │         │
│  │ 50 keywords locked          │  │ ✅ Top 10: 40 (goal: 10-20)  │         │
│  │ at contract signing         │  │ 🔄 Pos 11-20: 8              │         │
│  │                             │  │ ⏳ Pos 21+: 2                │         │
│  │ [View keyword list →]       │  │                              │         │
│  └─────────────────────────────┘  └─────────────────────────────┘         │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ KEYWORD PROGRESS                                          [↓ Export]  ││
│  ├────────────────────────────────────────────────────────────────────────┤│
│  │ Keyword                        Position    Change     Status          ││
│  │─────────────────────────────────────────────────────────────────────── ││
│  │ šampūnas plaukams                 3        ↑ from 15   ✅ Top 10      ││
│  │ natūralus šampūnas                 7        ↑ from 23   ✅ Top 10      ││
│  │ kondicionierius plaukams           4        ↑ from 12   ✅ Top 10      ││
│  │ plaukų priežiūra                  12        ↑ from 34   🔄 Progress    ││
│  │ ...                                                                    ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ CONTENT CALENDAR                                            May 2026  ││
│  ├────────────────────────────────────────────────────────────────────────┤│
│  │                                                                        ││
│  │  Mon   Tue   Wed   Thu   Fri   Sat   Sun                              ││
│  │  ───   ───   ───   ───   ───   ───   ───                              ││
│  │        1     2     3     4     5     6                                ││
│  │              ●                                                         ││
│  │  7     8     9     10    11    12    13                               ││
│  │        ●           ●                                                   ││
│  │  14    15    16    17    18    19    20                               ││
│  │              ●                                                         ││
│  │                                                                        ││
│  │  ● = Article published                                                ││
│  │  ○ = Article scheduled                                                ││
│  │                                                                        ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │                                                                        ││
│  │  Powered by TeveroSEO  ·  Portal generated May 5, 2026                ││
│  │                                                                        ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. Portal Header

```css
.portal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-7);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-card);
}

.portal-header .agency-logo {
  height: 32px;
  width: auto;
}

.portal-header .title {
  font-family: var(--font-sans);
  font-size: var(--type-h3);          /* 15-16px */
  font-weight: 500;
  color: var(--text-1);
  letter-spacing: -0.005em;
}

.portal-header .last-updated {
  font-size: var(--type-small);       /* 13-13.5px */
  color: var(--text-3);
}
```

#### 2. Goal Hero (The Editorial Moment)

Per [design-system-v6.md §7.1](/.planning/design/design-system-v6.md):

```css
.goal-hero {
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-card);
  padding: var(--space-8) var(--space-7);
  text-align: center;
  container-type: inline-size;
  container-name: hero;
}

.goal-hero .num-mega {
  font-family: var(--font-display);   /* Newsreader */
  font-size: var(--num-mega);         /* clamp(58px, 4.8vw, 80px) */
  font-weight: 400;
  letter-spacing: -0.034em;
  color: var(--text-1);
  line-height: 0.95;
  font-variant-numeric: tabular-nums lining-nums;
}

.goal-hero .label {
  font-family: var(--font-sans);      /* Geist */
  font-size: var(--type-body);        /* 14-14.5px */
  color: var(--text-2);
  margin-top: var(--space-2);
}

.goal-hero .progress-bar {
  height: 6px;
  background: var(--surface-3);
  border-radius: 3px;
  margin: var(--space-6) 0 var(--space-4);
  position: relative;
}

.goal-hero .progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  /* Width set by JS based on goal achievement */
}

.goal-hero .progress-marker {
  position: absolute;
  top: -8px;
  /* Left position set by JS */
  width: 2px;
  height: 22px;
  background: var(--text-3);
}

.goal-hero .detail-row {
  font-size: var(--type-small);       /* 13-13.5px */
  color: var(--text-3);
}

.goal-hero .achievement {
  color: var(--success);
  font-weight: 500;
}
```

#### 3. KPI Cards

```css
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-5);
}

.kpi-card {
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-card);
  padding: var(--space-6);
  transition: box-shadow var(--motion-hover), transform var(--motion-hover);
}

.kpi-card:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-1px);
}

.kpi-card .title {
  font-size: var(--type-tiny);        /* 12px */
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-3);
  margin-bottom: var(--space-3);
}

.kpi-card .value {
  font-family: var(--font-display);
  font-size: var(--num-card);         /* clamp(36px, 3vw, 44px) */
  font-weight: 400;
  letter-spacing: -0.026em;
  color: var(--text-1);
}

.kpi-card .action {
  font-size: var(--type-small);
  color: var(--accent);
  margin-top: var(--space-4);
  opacity: 0;
  transition: opacity var(--motion-reveal);
}

.kpi-card:hover .action {
  opacity: 1;
}
```

#### 4. Keyword Table

```css
.kw-table {
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.kw-table-head {
  display: grid;
  grid-template-columns: minmax(200px, 2fr) 100px 100px 120px;
  padding: var(--space-4) var(--space-6);
  background: var(--surface-2);
  border-bottom: 1px solid var(--hairline-2);
  font-size: var(--type-small);
  font-weight: 500;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.kw-row {
  display: grid;
  grid-template-columns: minmax(200px, 2fr) 100px 100px 120px;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--hairline-3);
  font-size: var(--type-body);
  color: var(--text-2);
  transition: background var(--motion-fast);
}

.kw-row:hover {
  background: var(--surface-2);
}

.kw-row .keyword {
  font-weight: 500;
  color: var(--text-1);
}

.kw-row .position {
  font-family: var(--font-display);
  font-size: var(--num-row);          /* clamp(20px, 1.7vw, 26px) */
  font-variant-numeric: tabular-nums lining-nums;
}

.kw-row .change {
  font-size: var(--type-small);
}

.kw-row .change.up {
  color: var(--success);
}

.kw-row .change.down {
  color: var(--error);
}

.kw-row .status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: var(--type-tiny);
  font-weight: 500;
}

.status-pill.top-10 {
  background: var(--success-soft);
  color: var(--success);
}

.status-pill.progress {
  background: var(--warning-soft);
  color: var(--warning);
}

.status-pill.pending {
  background: var(--surface-2);
  color: var(--text-3);
}
```

#### 5. Calendar Mini-View

```css
.calendar-card {
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-card);
  padding: var(--space-6);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}

.calendar-title {
  font-size: var(--type-h3);
  font-weight: 500;
  color: var(--text-1);
}

.calendar-month {
  font-size: var(--type-small);
  color: var(--text-3);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
  text-align: center;
}

.calendar-day-name {
  font-size: var(--type-tiny);
  font-weight: 500;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: var(--space-2) 0;
}

.calendar-day {
  padding: var(--space-2);
  font-size: var(--type-small);
  color: var(--text-2);
  position: relative;
}

.calendar-day.has-content::after {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.calendar-day.has-scheduled::after {
  background: var(--text-4);
}
```

#### 6. Footer Watermark

```css
.portal-footer {
  text-align: center;
  padding: var(--space-6) var(--space-7);
  font-size: var(--type-small);
  color: var(--text-4);
}

.portal-footer a {
  color: var(--text-3);
  text-decoration: none;
}

.portal-footer a:hover {
  color: var(--accent);
}
```

### Mobile Responsiveness

```css
@container hero (max-width: 600px) {
  .goal-hero .num-mega {
    font-size: clamp(40px, 12vw, 58px);
  }
}

@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
  
  .kw-table-head,
  .kw-row {
    grid-template-columns: 1fr 80px 80px;
  }
  
  .kw-row .change {
    display: none;
  }
}

@media (max-width: 480px) {
  .portal-header {
    flex-direction: column;
    gap: var(--space-3);
    text-align: center;
  }
  
  .kw-table-head,
  .kw-row {
    grid-template-columns: 1fr 60px;
  }
  
  .kw-row .status-pill {
    display: none;
  }
}
```

### Notification System

Passive portals don't work. Clients need proactive notifications.

**Email Triggers:**
| Event | Email Subject | Frequency |
|-------|---------------|-----------|
| Weekly digest | "Your SEO Progress: 3 new rankings this week" | Weekly (Mon 9am) |
| Monthly report ready | "Your May 2026 SEO Report is Ready" | Monthly (1st) |
| Milestone hit | "30 keywords now in Top 10!" | On event |
| Content published | "New article live: Kaip pasirinkti sampuna" | On publish |
| Ranking jump | "Big win: 'sampunas plaukams' moved to #3" | On >5 position jump |
| Content pending approval | "Article ready for your review" | On submit |

**Email Template (Monthly Report):**
```
Subject: Your May 2026 SEO Report is Ready

Hi [Client Name],

Your monthly SEO progress report is ready.

HIGHLIGHTS
- Keywords in Top 10: 34 (+6 from last month)
- Goal Progress: 113% (34/30 target)
- Organic Traffic: +23% MoM

CONTENT DELIVERED
- 4 articles published this month
- 2 articles scheduled for June

[View Full Report]

Questions? Reply to this email or schedule a call.

Best,
[Agency Name]
```

**Notification Preferences (in Portal):**
```
NOTIFICATION SETTINGS
[x] Weekly progress digest (Mondays)
[x] Monthly report
[x] Major ranking changes (>5 positions)
[ ] Every content publish
[x] Content pending my approval

Email: john@grozionamai.lt
```

**Schema:**
```typescript
interface NotificationPreference {
  clientId: string;
  portalUserId: string;
  weeklyDigest: boolean;
  monthlyReport: boolean;
  rankingChanges: boolean;
  contentPublish: boolean;
  contentApproval: boolean;
  email: string;
}

interface NotificationLog {
  id: string;
  clientId: string;
  type: 'weekly_digest' | 'monthly_report' | 'milestone' | 'content_publish' | 'ranking_jump' | 'approval_request';
  sentAt: Date;
  emailTo: string;
  opened: boolean;
  openedAt: Date | null;
  clicked: boolean;
  clickedAt: Date | null;
}
```

### Content Approval Workflow

Some clients want to review content before publish. Optional feature.

**Approval Flow:**
```
DRAFT --> INTERNAL REVIEW --> CLIENT REVIEW --> APPROVED --> PUBLISHED
                                  |
                          REVISION REQUESTED
                                  |
                          REVISED --> CLIENT REVIEW (loop)
```

**Portal View (Client):**
```
+-----------------------------------------------------------------------------+
| PENDING YOUR APPROVAL (2)                                                   |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | "Kaip pasirinkti tinkama sampuna jusu plauku tipui"                   |  |
|  | Target: sampunas plaukams - 1,847 words - Submitted May 3             |  |
|  |                                                                       |  |
|  | [Preview Article]  [Approve]  [Request Changes]                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | "Plauku prieziuros klaidos, kuriu reikia vengti"                      |  |
|  | Target: plauku prieziura - 2,103 words - Submitted May 4              |  |
|  |                                                                       |  |
|  | [Preview Article]  [Approve]  [Request Changes]                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+-----------------------------------------------------------------------------+
```

**Request Changes Flow:**
```
REQUEST CHANGES
+-----------------------------------------------------------------+
| Article: "Kaip pasirinkti tinkama sampuna..."                   |
|                                                                 |
| What needs to change?                                           |
| +-------------------------------------------------------------+ |
| | Please mention our new organic shampoo line that launched   | |
| | last week. Also, the price mentioned in paragraph 3 is      | |
| | outdated - should be 12.99 EUR not 9.99 EUR.                | |
| +-------------------------------------------------------------+ |
|                                                                 |
| [Cancel] [Submit Feedback]                                      |
+-----------------------------------------------------------------+
```

**Agency View (Revision Queue):**
```
REVISION REQUESTS
+------------------------------------------------------------------+
| Grozio Namai - "Kaip pasirinkti sampuna..."                      |
| Requested: May 4, 10:23am                                        |
|                                                                  |
| CLIENT FEEDBACK:                                                 |
| "Please mention our new organic shampoo line that launched       |
| last week. Also, the price mentioned in paragraph 3 is           |
| outdated - should be 12.99 EUR not 9.99 EUR."                    |
|                                                                  |
| [Open in Editor] [Mark Resolved]                                 |
+------------------------------------------------------------------+
```

**Schema:**
```typescript
interface ContentApproval {
  id: string;
  articleId: string;
  clientId: string;
  status: 'pending' | 'approved' | 'revision_requested' | 'revised';
  submittedAt: Date;
  submittedBy: string;          // Agency user
  reviewedAt: Date | null;
  reviewedBy: string | null;    // Portal user
  feedback: string | null;
  approvedAt: Date | null;
}
```

**Settings (Agency-side):**
```
CLIENT SETTINGS: Grozio Namai
+------------------------------------------------------------------+
| CONTENT APPROVAL                                                 |
|                                                                  |
| [ ] Require client approval before publishing                    |
|     Auto-approve after: [3 days] if no response                  |
|                                                                  |
| Approval contacts:                                               |
| - john@grozionamai.lt (Owner) - can approve                      |
| - marketing@grozionamai.lt (Viewer) - notified only              |
+------------------------------------------------------------------+
```

---

## Part 3: Implementation Plan

### Phase 1: Keyword Lock-in Foundation (1-2 days)

| Task | Effort |
|------|--------|
| Create `contracted_keywords` table + Drizzle schema | 2h |
| Create `contract_goals` table + Drizzle schema | 1h |
| Create `out_of_scope_requests` table + Drizzle schema | 1h |
| Keyword lock API: POST /api/contracts/:id/lock-keywords | 2h |
| Goal tracking service: calculate current count + achievement % | 3h |
| Out-of-scope request logging | 2h |

### Phase 2: Client Portal Backend (1-2 days)

| Task | Effort |
|------|--------|
| Create `portal_tokens` table + Drizzle schema | 1h |
| Token generation API: POST /api/clients/:id/portal-token | 2h |
| Token validation middleware | 2h |
| Portal data aggregation service | 3h |
| Rate limiting (100 views/hour) | 1h |
| Token revocation API | 1h |

### Phase 3: Client Portal Frontend (2-3 days)

| Task | Effort |
|------|--------|
| `ClientPortalPage.tsx` shell | 2h |
| `PortalHeader.tsx` component | 1h |
| `GoalHero.tsx` component (the editorial moment) | 3h |
| `KpiGrid.tsx` + `KpiCard.tsx` components | 2h |
| `KeywordTable.tsx` component | 3h |
| `CalendarMini.tsx` component | 2h |
| `PortalFooter.tsx` component | 30min |
| Mobile responsiveness + testing | 2h |

### Phase 4: Integration & Polish (1 day)

| Task | Effort |
|------|--------|
| Connect portal to real data APIs | 2h |
| Add CSV export for keyword list | 1h |
| Agency branding (logo upload, color override) | 2h |
| Analytics: track portal views per client | 1h |
| E2E tests for portal flow | 2h |

**Total Estimated Effort: 5-8 days**

---

## Part 4: API Reference

### Keyword Lock-in APIs

```typescript
// Lock keywords to contract
POST /api/contracts/:contractId/lock-keywords
Body: {
  keywordIds: string[];
  goal: {
    metric: 'top_10' | 'top_3' | 'page_1';
    targetLower: number;
    targetUpper: number;
    deadline: string;  // ISO date
  };
}
Response: {
  contractId: string;
  lockedCount: number;
  goal: ContractGoal;
}

// Get contract progress
GET /api/contracts/:contractId/progress
Response: {
  goal: ContractGoal;
  keywords: {
    total: number;
    inGoal: number;
    improving: number;
    stagnant: number;
  };
  achievement: {
    current: number;
    target: number;
    percentage: number;
    daysAhead: number;  // Positive = ahead, negative = behind
  };
}

// Log out-of-scope request
POST /api/contracts/:contractId/out-of-scope
Body: {
  keyword: string;
  requestedBy: string;
  notes?: string;
}
Response: {
  id: string;
  status: 'pending';
}
```

### Portal APIs

```typescript
// Generate portal token
POST /api/clients/:clientId/portal-token
Body: {
  expiresInDays?: number;  // Default: 30
  permissions?: {
    canViewKeywords?: boolean;
    canViewCalendar?: boolean;
    canViewProgress?: boolean;
    canViewPerformance?: boolean;
  };
}
Response: {
  token: string;
  url: string;  // Full portal URL
  expiresAt: string;
}

// Get portal data (public, token-authenticated)
GET /portal/:token/data
Response: {
  client: {
    name: string;
    domain: string;
  };
  agency: {
    name: string;
    logoUrl: string | null;
  };
  goal: ContractGoal;
  achievement: {
    current: number;
    target: number;
    percentage: number;
    daysAhead: number;
  };
  keywords: KeywordProgress[];
  calendar: CalendarEvent[];
  lastUpdated: string;
}

// Revoke portal token
DELETE /api/clients/:clientId/portal-token/:tokenId
Response: { success: true }
```

---

## Part 5: Success Metrics

### For Agencies

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Client portal views/week | 2+ per client | Engaged clients = retained clients |
| Goal achievement communicated | 100% | Every client sees their ROI |
| Out-of-scope requests logged | All | Prevents scope creep |
| Renewal rate | +15% vs baseline | Proven ROI = renewals |

### For Clients

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Time to understand progress | < 10 seconds | The big number tells the story |
| Questions asked to agency | -50% | Portal answers common questions |
| Satisfaction (NPS) | +20 points | Transparency builds trust |

---

## Part 6: Future Enhancements (Backlog)

| Feature | Value | Effort |
|---------|-------|--------|
| Email digest: weekly progress summary | High | Medium |
| Performance charts (GSC data) | Medium | Medium |
| Competitor comparison view | Medium | High |
| White-label portal (custom domain) | Medium | High |
| Multi-language portal (LT/EN toggle) | Low | Medium |
| PDF export of portal snapshot | Low | Low |

---

## Cross-References

- **Design System:** [design-system-v6.md](/.planning/design/design-system-v6.md)
- **Agency Pipeline:** [v8-agency-pipeline.md](/.planning/design/v8-agency-pipeline.md)
- **Phase Deep Dive:** [PHASE-85-89-DEEP-DIVE.md](/.planning/phases/PHASE-85-89-DEEP-DIVE.md)
- **Current Roadmap:** [ROADMAP.md](/.planning/ROADMAP.md)

---

*Specification completed: 2026-05-05*
*Ready for implementation in Phase 87-89*
