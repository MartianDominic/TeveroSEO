# SEO Chat: Agency-Side UI Specification

> **Purpose:** Design spec for the chat interface agency owners use during sales calls or Facebook/WhatsApp DM conversations with prospects. Optimizes for rapid analysis, proposal generation, and conversion.
>
> **Design System:** v6 (Newsreader + Geist + Geist Mono, ghost-edge shadows, 12px floor)
>
> **Architecture:** v7 Master Design Architecture (three-column shell, autonomy/control balance)
>
> **Technical Spec:** Phase 98 Complete Spec (9 intents, analysis registry, proposal flow)

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Shell Layout](#2-shell-layout)
3. [Chat Input Experience](#3-chat-input-experience)
4. [Response Display](#4-response-display)
5. [Mode Selection](#5-mode-selection)
6. [Proposal Generation Flow](#6-proposal-generation-flow)
7. [Session Management](#7-session-management)
8. [Keyboard Shortcuts](#8-keyboard-shortcuts)
9. [Right Rail Integration](#9-right-rail-integration)
10. [Component Specifications](#10-component-specifications)
11. [States and Edge Cases](#11-states-and-edge-cases)

---

## 1. Design Philosophy

### 1.1 The Core Tension

The chat serves two masters simultaneously:

| Master | Implication |
|--------|-------------|
| **Speed** | Agency is on a live call. Every second counts. |
| **Trust** | Prospect is watching. Output must look authoritative, not "AI-generated spam." |

The design resolves this by:
- **Input:** Maximum flexibility (paste anything, mention anything)
- **Output:** Structured, editorial-quality cards (not raw text dumps)
- **Actions:** One-click paths to proposal (not multi-step wizards)

### 1.2 The Conversion Formula

From sales conversation analysis (Karolina/plaukupasaka.lt):

```
CONVERSION = (Economic Alignment x Honest Vulnerability) / Risk Exposure
```

The chat UI must surface:
1. **Economic value** (traffic value, keyword opportunity) prominently
2. **Realistic timelines** (not over-promising)
3. **Clear next step** (Generate Proposal button always visible when context sufficient)

### 1.3 v7 Principles Applied

| Principle | Application to Chat |
|-----------|---------------------|
| **One editorial moment** | The current analysis result card is THE answer |
| **Calm at rest, depth on demand** | Chat history fades; active response dominates |
| **Cards as glass, not paper** | Analysis cards use `--shadow-card` with hover lift |

---

## 2. Shell Layout

### 2.1 Three-Column Adaptation

The SEO Chat page uses the standard v7 shell but with chat-specific adaptations:

```
+------------------+----------------------------------------+------------------+
|                  |                                        |                  |
|     SIDEBAR      |              MAIN: CHAT                |      RAIL        |
|     (Nav)        |                                        |   (Context)      |
|                  |  +----------------------------------+  |                  |
|  . Prospects     |  |       CHAT HISTORY               |  |  PROSPECT        |
|  . Clients       |  |       (scrollable)               |  |  CONTEXT         |
|  . SEO Chat <--  |  |                                  |  |                  |
|  . Intelligence  |  |  [Message bubble]                |  |  Domain: ...     |
|  . Reports       |  |  [Analysis card]                 |  |  DA: 15          |
|                  |  |  [Message bubble]                |  |  Keywords: 47    |
|                  |  |  [Analysis card]                 |  |  Last: 2h ago    |
|                  |  |                                  |  |                  |
|                  |  +----------------------------------+  |  +------------+  |
|                  |                                        |  |  PROPOSAL   |  |
|                  |  +----------------------------------+  |  |  DRAFT      |  |
|                  |  |       INPUT AREA                 |  |  |            |  |
|                  |  |       (sticky bottom)            |  |  | 47 kw      |  |
|                  |  +----------------------------------+  |  | E2,100/mo  |  |
|                  |                                        |  | [Generate] |  |
|                  |                                        |  +------------+  |
|                  |                                        |                  |
|  clamp(232,      |           minmax(0, 1fr)               |  clamp(320,      |
|  16vw, 272)      |                                        |  22vw, 380)      |
+------------------+----------------------------------------+------------------+
```

### 2.2 Main Column Structure

```css
.chat-main {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--shell-utility-h));
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6) var(--space-7);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.chat-input-area {
  position: sticky;
  bottom: 0;
  padding: var(--space-5) var(--space-7) var(--space-6);
  background: linear-gradient(
    to bottom,
    rgba(250, 250, 247, 0) 0%,
    var(--canvas) 20%
  );
}
```

### 2.3 Right Rail: Context Panel

The right rail transforms into a **prospect context panel** during chat:

```
+----------------------------------+
|  PROSPECT CONTEXT                |
|  --------------------------------|
|                                  |
|  meistreliokampas.lt             |
|  [Switch Prospect v]             |
|                                  |
|  DA 15  |  DR 12  |  2.4K pages  |
|                                  |
|  Keywords tracked: 47            |
|  Traffic value: E2,100/mo        |
|  Last analysis: 2h ago           |
|                                  |
|  --------------------------------|
|                                  |
|  PROPOSAL DRAFT                  |
|                                  |
|  Keywords: 47                    |
|  Packages: Starter | Growth | Scale
|                                  |
|  [Generate Proposal]             |
|  [Preview] [Reset]               |
|                                  |
|  --------------------------------|
|                                  |
|  SESSION HISTORY                 |
|                                  |
|  Today, 14:23                    |
|  . Keyword feasibility           |
|  . Topical map generated         |
|                                  |
|  Yesterday                       |
|  . Domain analysis               |
|                                  |
+----------------------------------+
```

---

## 3. Chat Input Experience

### 3.1 Input Component Anatomy

```
+-----------------------------------------------------------------------+
|  @meistreliokampas.lt                                          [x]    |
+-----------------------------------------------------------------------+
|                                                                       |
|  Can they rank for "makita dalys" and "dewalt dalys"?                 |
|                                                                       |
|  _____________________________________________________________________|
|                                                                       |
|  [Attach] [Voice]            Quick/Standard/Deep        [Send] Cmd+Enter
+-----------------------------------------------------------------------+
```

### 3.2 Input Modes

| Input Type | How It Works | Visual Treatment |
|------------|--------------|------------------|
| **Paste from Facebook/WhatsApp** | Paste any text. System extracts domain, keywords, questions. | Pasted text in `--surface-2` bg with mono timestamp |
| **Live typing** | Standard text input. @-mention for context. | Default input styling |
| **Voice memo** | Click mic icon or `Cmd+M`. Transcription streams in. | Waveform indicator during recording |
| **File/screenshot upload** | Drag-drop or click attach. OCR extracts text. | Thumbnail preview with extracted text tooltip |

### 3.3 @-Mention System

Type `@` to inject context:

```
@domain     -> Domain picker (recent + search)
@keywords   -> Keyword picker from current session
@competitor -> Competitor domain picker
@[url]      -> Direct URL injection
```

**Visual treatment:**

```css
.mention-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--accent-soft);
  color: var(--accent-ink);
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-family: var(--font-mono);
}
```

### 3.4 Input Component Wireframe

```
+-----------------------------------------------------------------------+
|                                                                       |
|  +------------------------------------------------------------------+ |
|  |  CONTEXT CHIPS (extracted or @-mentioned)                        | |
|  |                                                                  | |
|  |  [meistreliokampas.lt]  [makita dalys]  [dewalt dalys]    [+]   | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  +------------------------------------------------------------------+ |
|  |                                                                  | |
|  |  Can they rank for these keywords in 3 months?                   | |
|  |                                                                  | |
|  |  _                                                               | |
|  |                                                                  | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  +--------+  +--------+                    +-----+  +--------------+ |
|  | Attach |  |  Mic   |                    |Mode |  |    Send      | |
|  |   +    |  |   o))  |                    | v   |  |   Cmd+Enter  | |
|  +--------+  +--------+                    +-----+  +--------------+ |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 3.5 Context Extraction

When user pastes a message, the system extracts:

1. **Domains** (regex for TLDs: `.com`, `.lt`, `.io`, etc.)
2. **Keywords** (quoted strings, text after "rank for", "target", etc.)
3. **Questions** (sentences ending in `?`)
4. **Competitors** (domains mentioned in competitive context)

**Visual feedback:**

```
+-----------------------------------------------------------------------+
|  PASTED FROM FACEBOOK MESSENGER                        Apr 29, 14:23  |
|  --------------------------------------------------------------------- |
|                                                                       |
|  "Hi! I have a website meistreliokampas.lt and I want to rank for     |
|  makita dalys and dewalt dalys. My competitor aceraservisas.lt is     |
|  already on page 1. Can you help?"                                    |
|                                                                       |
|  EXTRACTED:                                                           |
|  . Domain: meistreliokampas.lt                                        |
|  . Keywords: makita dalys, dewalt dalys                               |
|  . Competitor: aceraservisas.lt                                       |
|  . Question: ranking feasibility                                      |
|                                                                       |
|  [Analyze This] [Edit Extraction]                                     |
+-----------------------------------------------------------------------+
```

### 3.6 Voice Input

- **Activation:** Click mic icon or `Cmd+M`
- **During recording:** Waveform animation, live transcription preview
- **Post-recording:** Transcribed text appears in input, editable before send

```css
.voice-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--error-soft);
  border-radius: var(--radius-button);
}

.voice-waveform {
  width: 80px;
  height: 24px;
  /* Animated SVG bars */
}

.voice-timer {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--error);
}
```

---

## 4. Response Display

### 4.1 Message Types

| Type | Visual Treatment |
|------|------------------|
| **User message** | Right-aligned, `--surface` bg, `--shadow-card` |
| **System message** | Left-aligned, no bg, `--text-3` color |
| **Analysis card** | Full-width card, `--shadow-card`, structured content |
| **Progress indicator** | Inline skeleton + phase stepper |
| **Error** | `--error-soft` bg, `--error` text, retry action |

### 4.2 Analysis Card Anatomy

The analysis card is the **editorial moment** of each response:

```
+-----------------------------------------------------------------------+
|  KEYWORD FEASIBILITY                                  [Expand] [Copy] |
|  --------------------------------------------------------------------- |
|                                                                       |
|  +----------------------------------+  +----------------------------+ |
|  |  makita dalys                    |  |  dewalt dalys              | |
|  |                                  |  |                            | |
|  |  FEASIBLE                        |  |  FEASIBLE                  | |
|  |  High Confidence                 |  |  High Confidence           | |
|  |                                  |  |                            | |
|  |  Volume   200/mo                 |  |  Volume   150/mo           | |
|  |  KD       28                     |  |  KD       22               | |
|  |  Value    E180/mo                |  |  Value    E120/mo          | |
|  |                                  |  |                            | |
|  |  Timeline: 3-4 months            |  |  Timeline: 2-3 months      | |
|  +----------------------------------+  +----------------------------+ |
|                                                                       |
|  Expanded to 47 related keywords                                      |
|                                                                       |
|  [View Topical Map]  [Add to Proposal]  [Expand Keywords]             |
+-----------------------------------------------------------------------+
```

### 4.3 Analysis Card CSS

```css
.analysis-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition: box-shadow var(--motion-hover), transform var(--motion-hover);
}

.analysis-card:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-1px);
}

.analysis-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--hairline-2);
}

.analysis-card-title {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
}

.analysis-card-body {
  padding: 20px 24px;
}

.analysis-card-actions {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  background: var(--surface-2);
  border-top: 1px solid var(--hairline-2);
}
```

### 4.4 Progress Indicators

**Phase stepper for multi-step analyses:**

```
+-----------------------------------------------------------------------+
|  ANALYZING...                                                         |
|                                                                       |
|  [*] Domain health       Complete                                     |
|  [*] Keyword feasibility Complete                                     |
|  [o] Topical clustering  In progress...                              |
|  [ ] Gap analysis        Pending                                      |
|                                                                       |
|  ============================================------------  78%        |
|                                                                       |
+-----------------------------------------------------------------------+
```

```css
.progress-stepper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.progress-step-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-step-indicator.complete {
  background: var(--success);
  color: white;
}

.progress-step-indicator.active {
  background: var(--accent);
  color: white;
  animation: pulse 1.5s ease-in-out infinite;
}

.progress-step-indicator.pending {
  background: var(--surface-3);
  border: 1px solid var(--hairline);
}

.progress-bar {
  height: 4px;
  background: var(--surface-3);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  transition: width 300ms var(--ease-smooth);
}
```

### 4.5 Inline Visualizations

**Domain Health Card:**

```
+-----------------------------------------------------------------------+
|  DOMAIN HEALTH                                        meistreliokampas.lt
|  --------------------------------------------------------------------- |
|                                                                       |
|  +----------------+  +----------------+  +----------------+           |
|  |       15       |  |       12       |  |     2,400      |           |
|  |      DA        |  |      DR        |  |     Pages      |           |
|  +----------------+  +----------------+  +----------------+           |
|                                                                       |
|  Traffic: ~500/mo          Keywords: 45 ranking (8 in positions 4-10) |
|                                                                       |
|  HEALTH CHECK                                                         |
|  [*] SSL active                                                       |
|  [*] Mobile-friendly                                                  |
|  [*] Core Web Vitals: Pass                                            |
|                                                                       |
|  ISSUES FOUND: 2                                                      |
|  [!] Missing meta descriptions (40% of pages)                         |
|  [!] No FAQ schema                                                    |
|                                                                       |
+-----------------------------------------------------------------------+
```

**Topical Map Visualization:**

```
+-----------------------------------------------------------------------+
|  TOPICAL MAP                                              47 keywords |
|  --------------------------------------------------------------------- |
|                                                                       |
|  +-- Makita dalys (pillar)                   KD 28 | 850/mo          |
|  |   +-- makita akumuliatorius               KD 18 | 320/mo          |
|  |   +-- makita angliniai sepetėliai         KD 12 | 90/mo           |
|  |   +-- makita reduktorius                  KD 35 | 70/mo           |
|  |                                                                    |
|  +-- Dewalt dalys (pillar)                   KD 22 | 420/mo          |
|  |   +-- dewalt akumuliatorius               KD 15 | 180/mo          |
|  |   +-- dewalt gręžtuvas dalys              KD 20 | 95/mo           |
|  |                                                                    |
|  +-- Milwaukee dalys (pillar)                KD 15 | 180/mo          |
|  |   +-- ...                                                          |
|                                                                       |
|  Total opportunity: 2,440/mo searches | E2,100/mo value               |
|                                                                       |
|  [View Full Map]  [Generate Proposal]                                 |
+-----------------------------------------------------------------------+
```

### 4.6 Error States

```
+-----------------------------------------------------------------------+
|  ANALYSIS FAILED                                                      |
|  --------------------------------------------------------------------- |
|                                                                       |
|  DataForSEO API rate limit exceeded.                                  |
|  Wait 30 seconds or try a smaller keyword set.                        |
|                                                                       |
|  [Retry]  [Use Cached Data]  [Skip This Analysis]                     |
+-----------------------------------------------------------------------+
```

---

## 5. Mode Selection

### 5.1 Automatic Mode Detection

The system automatically selects mode based on query complexity:

| Signal | Mode |
|--------|------|
| Single domain check | Quick |
| 1-3 keywords feasibility | Quick |
| "Full analysis" / "deep dive" | Deep |
| Topical map request | Standard |
| Competitor comparison | Standard |
| Technical audit | Deep |

### 5.2 Mode Selector UI

For power users who want explicit control:

```
+-------------------------+
|  Analysis Depth         |
|  -----------------------|
|                         |
|  [Quick]  5-10 sec      |
|           $0.01         |
|                         |
|  [Standard]  15-30 sec  |  <-- Default (highlighted)
|              $0.03      |
|                         |
|  [Deep]  1-2 min        |
|          $0.08          |
|                         |
+-------------------------+
```

**Compact mode selector (inline with input):**

```css
.mode-selector {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--surface-2);
  border-radius: var(--radius-button);
}

.mode-option {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  border-radius: calc(var(--radius-button) - 2px);
  cursor: pointer;
  transition: background var(--motion-fast), color var(--motion-fast);
}

.mode-option:hover {
  color: var(--text-2);
}

.mode-option.active {
  background: var(--surface);
  color: var(--text-1);
  box-shadow: var(--shadow-card);
}
```

### 5.3 Token Budget Display (Power Users Only)

Hidden by default. Enable via `/settings/seo-chat`:

```
+----------------------------------+
|  Token Budget: $2.47 remaining   |
|  This query: ~$0.03              |
|  ================================|
+----------------------------------+
```

---

## 6. Proposal Generation Flow

### 6.1 Trigger Patterns

| Trigger | Response |
|---------|----------|
| "Generate proposal" (natural language) | Opens proposal panel |
| `Cmd+P` shortcut | Opens proposal panel |
| "Generate Proposal" button on analysis card | Opens proposal panel with pre-filled keywords |
| Rail "Generate Proposal" button | Opens proposal panel |

### 6.2 Proposal Panel (Slide-Over)

When triggered, a slide-over panel appears from the right:

```
+-----------------------------------------------------------------------+
|                                                                       |
|  +----------------------+  +----------------------------------------+ |
|  |                      |  |                                        | |
|  |   CHAT MAIN          |  |  GENERATE PROPOSAL                [x] | |
|  |   (dimmed 50%)       |  |  --------------------------------------| |
|  |                      |  |                                        | |
|  |                      |  |  meistreliokampas.lt                   | |
|  |                      |  |                                        | |
|  |                      |  |  KEYWORDS (47 selected)                | |
|  |                      |  |  +----------------------------------+  | |
|  |                      |  |  | [x] makita dalys        E180/mo |  | |
|  |                      |  |  | [x] dewalt dalys        E120/mo |  | |
|  |                      |  |  | [x] milwaukee dalys     E80/mo  |  | |
|  |                      |  |  | ...                              |  | |
|  |                      |  |  +----------------------------------+  | |
|  |                      |  |                                        | |
|  |                      |  |  PACKAGE ASSIGNMENT                    | |
|  |                      |  |                                        | |
|  |                      |  |  +-----------+ +-----------+ +-------+ | |
|  |                      |  |  | Starter   | | Growth ** | | Scale | | |
|  |                      |  |  | E800/mo   | | E1,200/mo | | E2K/mo| | |
|  |                      |  |  | 10 kw     | | 25 kw     | | 47 kw | | |
|  |                      |  |  +-----------+ +-----------+ +-------+ | |
|  |                      |  |                                        | |
|  |                      |  |  Assignment: [By Feasibility v]        | |
|  |                      |  |                                        | |
|  |                      |  |  PREVIEW                               | |
|  |                      |  |  +----------------------------------+  | |
|  |                      |  |  | Your SEO Opportunity             |  | |
|  |                      |  |  | 47 keywords worth E2,100/mo      |  | |
|  |                      |  |  +----------------------------------+  | |
|  |                      |  |                                        | |
|  |                      |  |  [Preview Full]  [Generate & Copy Link]| |
|  |                      |  |                                        | |
|  +----------------------+  +----------------------------------------+ |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 6.3 Package Assignment Options

```
+----------------------------------+
|  Keyword Assignment              |
|  --------------------------------|
|                                  |
|  o  First N keywords             |
|     Top 10/25/47 from list       |
|                                  |
|  o  By Feasibility               |
|     Easiest keywords first       |
|                                  |
|  o  By Priority Score            |
|     Highest opportunity first    |
|                                  |
|  o  Manual Selection             |
|     Drag keywords to packages    |
|                                  |
+----------------------------------+
```

### 6.4 Manual Keyword Assignment

When "Manual Selection" is chosen:

```
+-----------------------------------------------------------------------+
|  MANUAL KEYWORD ASSIGNMENT                                            |
|  --------------------------------------------------------------------- |
|                                                                       |
|  AVAILABLE (47)           STARTER (10)    GROWTH (25)    SCALE (47)   |
|  +------------------+     +-----------+   +-----------+  +-----------+|
|  | makita dalys     | --> |           |   |           |  |           ||
|  | dewalt dalys     |     |           |   |           |  |           ||
|  | milwaukee dalys  |     |           |   |           |  |           ||
|  | ...              |     |           |   |           |  |           ||
|  +------------------+     +-----------+   +-----------+  +-----------+|
|                                                                       |
|  Drag keywords to assign. Each package inherits all lower tiers.      |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 6.5 Proposal Preview

Before generating the magic link:

```
+-----------------------------------------------------------------------+
|  PROPOSAL PREVIEW                                                     |
|  --------------------------------------------------------------------- |
|                                                                       |
|  +----------------------------------------------------------------+  |
|  |                                                                |  |
|  |  YOUR SEO OPPORTUNITY                                          |  |
|  |  meistreliokampas.lt                                           |  |
|  |                                                                |  |
|  |  We found 47 keyword opportunities worth E2,100/mo             |  |
|  |                                                                |  |
|  |  TOPICAL CLUSTERS:                                             |  |
|  |  . Makita dalys (15 keywords)                                  |  |
|  |  . Dewalt dalys (12 keywords)                                  |  |
|  |  . Milwaukee dalys (8 keywords)                                |  |
|  |  . ...                                                         |  |
|  |                                                                |  |
|  |  +---------+  +---------+  +---------+                         |  |
|  |  | Starter |  | Growth  |  |  Scale  |                         |  |
|  |  | E800/mo |  | E1.2K** |  | E2K/mo  |                         |  |
|  |  +---------+  +---------+  +---------+                         |  |
|  |                                                                |  |
|  +----------------------------------------------------------------+  |
|                                                                       |
|  Magic Link: tevero.lt/p/abc123xyz                                    |
|  Expires: 14 days                                                     |
|                                                                       |
|  [Copy Link]  [Send via Email]  [Open Preview]  [Edit Packages]       |
+-----------------------------------------------------------------------+
```

### 6.6 Post-Generation State

After proposal is generated, the rail updates:

```
+----------------------------------+
|  PROPOSAL SENT                   |
|  --------------------------------|
|                                  |
|  meistreliokampas.lt             |
|  Link: tevero.lt/p/abc123xyz     |
|                                  |
|  Viewed: Not yet                 |
|  Expires: 14 days                |
|                                  |
|  [Copy Link]  [Resend]  [Revoke] |
|                                  |
+----------------------------------+
```

---

## 7. Session Management

### 7.1 Multi-Prospect Sessions

**Tab bar at top of chat:**

```
+-----------------------------------------------------------------------+
|  [meistreliokampas.lt]  [plaukupasaka.lt]  [aceraservisas.lt]  [+]   |
+-----------------------------------------------------------------------+
```

```css
.session-tabs {
  display: flex;
  gap: 4px;
  padding: 0 var(--space-7);
  background: var(--canvas);
  border-bottom: 1px solid var(--hairline-2);
}

.session-tab {
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text-3);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color var(--motion-fast), border-color var(--motion-fast);
}

.session-tab:hover {
  color: var(--text-2);
}

.session-tab.active {
  color: var(--text-1);
  border-color: var(--accent);
}

.session-tab-new {
  padding: 12px 12px;
  color: var(--text-4);
}

.session-tab-new:hover {
  color: var(--accent);
}
```

### 7.2 Session History Panel

Access via rail "SESSION HISTORY" section or `Cmd+H`:

```
+----------------------------------+
|  SESSION HISTORY                 |
|  --------------------------------|
|                                  |
|  TODAY                           |
|                                  |
|  14:23 | meistreliokampas.lt     |
|  . Keyword feasibility (47 kw)   |
|  . Proposal generated            |
|                                  |
|  11:08 | plaukupasaka.lt         |
|  . Domain analysis               |
|  . Quick wins identified         |
|                                  |
|  YESTERDAY                       |
|                                  |
|  16:45 | aceraservisas.lt        |
|  . Competitor analysis           |
|                                  |
|  [View All Sessions]             |
|                                  |
+----------------------------------+
```

### 7.3 Cross-Session Context

When returning to a previous session:

```
+-----------------------------------------------------------------------+
|  RESUMING SESSION                                     meistreliokampas.lt
|  --------------------------------------------------------------------- |
|                                                                       |
|  Last active: 2 hours ago                                             |
|                                                                       |
|  CONTEXT PRESERVED:                                                   |
|  . Domain: meistreliokampas.lt (DA 15)                                |
|  . Keywords: 47 tracked                                               |
|  . Proposal: Generated (not viewed yet)                               |
|                                                                       |
|  [Continue Conversation]  [Start Fresh]                               |
+-----------------------------------------------------------------------+
```

### 7.4 Session Persistence

Sessions are stored in database with:

```typescript
interface ChatSession {
  id: string;
  workspaceId: string;
  prospectId?: string;
  prospectDomain?: string;
  createdAt: Date;
  lastActiveAt: Date;
  messages: Message[];
  analysisResults: Map<string, AnalysisOutput>;
  keywords: Keyword[];
  proposalDraftId?: string;
}
```

---

## 8. Keyboard Shortcuts

### 8.1 Global Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+Enter` | Send message | Input focused |
| `Cmd+P` | Generate proposal | Any |
| `Cmd+N` | New session | Any |
| `Cmd+H` | Session history | Any |
| `Cmd+M` | Voice input | Any |
| `Cmd+K` | Command palette | Any |
| `Cmd+J` | Jump to prospect | Any |
| `Escape` | Close panel/cancel | Panel open |

### 8.2 Chat-Specific Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+1/2/3` | Switch to session tab 1/2/3 |
| `Cmd+Shift+[` | Previous session |
| `Cmd+Shift+]` | Next session |
| `Cmd+D` | Duplicate last query |
| `Cmd+E` | Edit last message |
| `@` | Start @-mention |
| `Up` | Edit last message (when input empty) |

### 8.3 Keyboard Hint Display

Following v6 pattern, keyboard hints appear on hover:

```css
.action-button:hover .kbd-hint {
  opacity: 1;
  transform: translateX(0);
}

.kbd-hint {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity var(--motion-reveal), transform var(--motion-reveal);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-4);
  padding: 2px 6px;
  background: var(--surface-2);
  border-radius: 4px;
}
```

---

## 9. Right Rail Integration

### 9.1 Chat-Specific Rail Sections

```
+----------------------------------+
|  PROSPECT CONTEXT          [pin] |
|  --------------------------------|
|  ...                             |
+----------------------------------+
|  PROPOSAL DRAFT            [pin] |
|  --------------------------------|
|  ...                             |
+----------------------------------+
|  SESSION HISTORY           [pin] |
|  --------------------------------|
|  ...                             |
+----------------------------------+
|  TODAY FEED               [show] |
|  --------------------------------|
|  (Standard v7 Today feed)        |
+----------------------------------+
```

### 9.2 Real-Time Updates

During analysis, the rail shows live updates:

```
+----------------------------------+
|  ANALYZING...                    |
|  --------------------------------|
|                                  |
|  Domain health: Complete         |
|  Keyword data: In progress...    |
|  Clustering: Pending             |
|                                  |
|  ETA: ~15 seconds                |
|                                  |
+----------------------------------+
```

### 9.3 Proposal Status Tracking

After proposal generation, rail shows:

```
+----------------------------------+
|  PROPOSAL STATUS                 |
|  --------------------------------|
|                                  |
|  meistreliokampas.lt             |
|                                  |
|  Link: tevero.lt/p/abc123xyz     |
|                                  |
|  ACTIVITY:                       |
|  . Created: 14:23                |
|  . Viewed: Not yet               |
|  . Package selected: -           |
|  . Checkout started: -           |
|                                  |
|  Expires in 13 days, 22 hours    |
|                                  |
|  [Remind]  [Extend]  [Revoke]    |
|                                  |
+----------------------------------+
```

---

## 10. Component Specifications

### 10.1 Chat Message Bubble

```css
.message-bubble {
  max-width: 80%;
  padding: 12px 16px;
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.message-bubble.user {
  margin-left: auto;
  background: var(--accent-soft);
}

.message-bubble.system {
  background: transparent;
  box-shadow: none;
  color: var(--text-3);
  font-size: 13px;
}

.message-meta {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-4);
  margin-top: 4px;
}
```

### 10.2 Analysis Card Variants

**Compact (inline in chat):**
- Fixed height: 200px
- Show key metrics only
- "Expand" button for full view

**Expanded (modal overlay):**
- Full-height modal
- Complete visualization
- Export/copy actions

**Embedded (in rail):**
- Condensed metrics
- No actions (view-only)

### 10.3 Proposal Action Buttons

Following v6 button system:

```css
/* Primary CTA */
.btn-generate-proposal {
  background: linear-gradient(180deg, #1A6E55 0%, #0F4F3D 100%);
  color: #fff;
  box-shadow: var(--shadow-cta);
  font-weight: 500;
}

.btn-generate-proposal:hover {
  box-shadow: var(--shadow-cta-hover);
  transform: translateY(-1px);
}

/* Secondary actions */
.btn-copy-link {
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.btn-copy-link:hover {
  box-shadow: var(--shadow-pop);
  transform: translateY(-1px);
}
```

### 10.4 Input Field

```css
.chat-input {
  width: 100%;
  min-height: 80px;
  max-height: 200px;
  padding: 16px;
  background: var(--surface);
  border: none;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-1);
  resize: none;
}

.chat-input:focus {
  outline: none;
  box-shadow: var(--shadow-lift), 0 0 0 2px var(--accent-soft);
}

.chat-input::placeholder {
  color: var(--text-4);
}
```

---

## 11. States and Edge Cases

### 11.1 Empty State (No Sessions)

```
+-----------------------------------------------------------------------+
|                                                                       |
|                          START A CONVERSATION                         |
|                                                                       |
|  Paste a prospect's message or type a question about any domain.      |
|                                                                       |
|  Try:                                                                 |
|  . "Check meistreliokampas.lt"                                        |
|  . "Can acme.com rank for 'best running shoes'?"                      |
|  . "What keywords should techstartup.io target?"                      |
|                                                                       |
|  +----------------------------------------------------------------+  |
|  |  Type or paste a message...                      [Send]        |  |
|  +----------------------------------------------------------------+  |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 11.2 Loading State (Analysis Running)

Use skeleton screens matching the expected output structure:

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-2) 0%,
    var(--surface) 50%,
    var(--surface-2) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 11.3 Error State

```
+-----------------------------------------------------------------------+
|  ANALYSIS FAILED                                         [Retry] [x]  |
|  --------------------------------------------------------------------- |
|                                                                       |
|  We couldn't complete the keyword feasibility analysis.               |
|                                                                       |
|  Reason: DataForSEO API timeout (domain may be blocked)               |
|                                                                       |
|  Options:                                                             |
|  . [Retry] Try again                                                  |
|  . [Use Cached] Use data from 2 hours ago                             |
|  . [Skip] Continue without this analysis                              |
|  . [Manual] Enter data manually                                       |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 11.4 Rate Limit Warning

```
+-----------------------------------------------------------------------+
|  APPROACHING RATE LIMIT                                      [x]      |
|  --------------------------------------------------------------------- |
|                                                                       |
|  You've used 85% of your daily analysis budget.                       |
|                                                                       |
|  Remaining: 15 analyses (~$0.45)                                      |
|  Resets: Tomorrow at 00:00 UTC                                        |
|                                                                       |
|  [Upgrade Plan]  [View Usage]  [Continue Anyway]                      |
+-----------------------------------------------------------------------+
```

### 11.5 Offline State

```
+-----------------------------------------------------------------------+
|  OFFLINE                                                              |
|  --------------------------------------------------------------------- |
|                                                                       |
|  You're offline. Some features are limited.                           |
|                                                                       |
|  Available:                                                           |
|  . View cached analysis results                                       |
|  . Draft messages (will send when back online)                        |
|  . Browse session history                                             |
|                                                                       |
|  Unavailable:                                                         |
|  . Run new analyses                                                   |
|  . Generate proposals                                                 |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## Implementation Checklist

### Phase 1: Core Chat
- [ ] Chat shell layout (three-column with chat-specific adaptations)
- [ ] Message input component with @-mention support
- [ ] Message bubble components (user, system, analysis card)
- [ ] Basic intent routing (domain_analysis, keyword_feasibility)
- [ ] Progress indicator component

### Phase 2: Analysis Cards
- [ ] Domain health card
- [ ] Keyword feasibility card
- [ ] Topical map visualization
- [ ] Error state handling

### Phase 3: Proposal Flow
- [ ] Proposal slide-over panel
- [ ] Package selection UI
- [ ] Keyword assignment (automatic + manual)
- [ ] Proposal preview
- [ ] Magic link generation

### Phase 4: Session Management
- [ ] Multi-session tabs
- [ ] Session history panel
- [ ] Cross-session context persistence
- [ ] Rail context panel

### Phase 5: Power User Features
- [ ] Keyboard shortcuts
- [ ] Voice input
- [ ] File/screenshot upload
- [ ] Token budget display

---

## File References

- Design System: `.planning/design/design-system-v6.md`
- Architecture: `.planning/design/v7-master-design-architecture.md`
- Technical Spec: `.planning/phases/98-general-seo-chat/PHASE-98-COMPLETE-SPEC.md`
- Sales Insights: `.planning/proposal-manual-v1/value-stack-analysis/02-SALES-CONVERSATION-INSIGHTS.md`

---

*End of specification. Last updated: 2026-05-12*
