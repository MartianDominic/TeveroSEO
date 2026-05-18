# Generation Progress Component Specification

> **Status**: Design Spec Complete
> **Priority**: P0 (blocks 7.4, 9.0 journeys)
> **Design System**: v6 compliant (12px floor, Geist + Newsreader, ghost-edge shadows)

---

## Overview

The Generation Progress component provides beautiful, phase-by-phase visibility into all async operations. It builds **user trust** by showing exactly what the system is doing, while maintaining the **calm at rest** principle.

**Core Insight**: Progress UI is a trust-building mechanism. Users don't just want to know *how long* — they want to know *what's happening*.

---

## Design Philosophy

| Principle | Application |
|-----------|-------------|
| **One editorial moment** | Current phase name is the hero (Newsreader serif) |
| **Calm at rest, depth on demand** | Collapsed shows phase + %, expanded shows details |
| **Numbers want air** | Phase percentage in serif with generous spacing |
| **Everything fluid** | Responsive via container queries |
| **Trust through visibility** | Every sub-step is visible |

---

## Component Variants

### 1. Inline Progress (For card-embedded operations)

```
┌─────────────────────────────────────────────────────────────────────┐
│  GENERATING ARTICLE                                                  │
│                                                                      │
│  ●───●───●───○───○───○                                              │
│  Research  Outline  Writing  SEO  Quality  Publish                  │
│                     ▲                                                │
│                  current                                             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Writing Section 3 of 7                                          ││
│  │ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  42%       ││
│  │                                                                  ││
│  │ "Building the optimal internal linking structure..."            ││
│  │                                                                  ││
│  │ ETA: ~2 min remaining                                           ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  12px mono: Started 14:23 · Token usage: 2,847                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Modal Overlay (For full-page generation flows)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                     ┌─────────────────────────────────────┐                 │
│                     │                                     │                 │
│                     │      42%                            │                 │
│                     │      Newsreader 58px               │                 │
│                     │                                     │                 │
│                     │   Writing                           │                 │
│                     │   Geist 18px text-2                │                 │
│                     │                                     │                 │
│                     │   ●───●───●───○───○───○            │                 │
│                     │                                     │                 │
│                     ├─────────────────────────────────────┤                 │
│                     │                                     │                 │
│                     │   Section 3 of 7: Internal Links   │                 │
│                     │   ████████████████░░░░░░░░░░░░░░░  │                 │
│                     │                                     │                 │
│                     │   "Building the optimal internal    │                 │
│                     │    linking structure..."            │                 │
│                     │                                     │                 │
│                     │   ETA: ~2 min · Tokens: 2,847      │                 │
│                     │                                     │                 │
│                     │   ─────────────────────────────     │                 │
│                     │   ✓ Research (14s)                 │                 │
│                     │   ✓ Outline (8s)                   │                 │
│                     │   ◐ Writing (42%)                  │                 │
│                     │   ○ SEO Optimization               │                 │
│                     │   ○ Quality Gate                   │                 │
│                     │   ○ Publish                        │                 │
│                     │                                     │                 │
│                     │   [Cancel]              [Minimize]  │                 │
│                     └─────────────────────────────────────┘                 │
│                                                                             │
│                     backdrop: rgba(250, 250, 247, 0.92)                     │
│                     + backdrop-filter: blur(8px)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Minimized Pill (For background operations)

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  Other page content...                             │
│                                                    │
│                                                    │
│                                                    │
│                                                    │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │ ◐ Writing... 42%  ████░░░░  ~2 min  [↗]   │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ^ Fixed bottom-right, shadow-pop on hover        │
└────────────────────────────────────────────────────┘
```

---

## Visual Specifications

### Phase Stepper

```css
.phase-stepper {
  display: flex;
  align-items: center;
  gap: 0;
}

.phase-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--surface-3);
  transition: all var(--motion-hover);
}

.phase-dot.complete {
  background: var(--accent);
}

.phase-dot.current {
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  animation: pulse 2s infinite;
}

.phase-dot.pending {
  background: var(--surface-3);
  border: 1px solid var(--hairline);
}

.phase-connector {
  width: 24px;
  height: 2px;
  background: var(--surface-3);
}

.phase-connector.complete {
  background: var(--accent);
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 3px var(--accent-soft); }
  50% { box-shadow: 0 0 0 6px rgba(15, 79, 61, 0.1); }
}
```

### Progress Bar

```css
.progress-bar-track {
  height: 6px;
  background: var(--surface-3);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%);
  border-radius: 3px;
  transition: width 300ms var(--ease-smooth);
  /* Subtle shimmer for active progress */
  background-size: 200% 100%;
  animation: shimmer 2s linear infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Hero Percentage (Modal)

```css
.progress-hero-percent {
  font-family: var(--font-display);
  font-size: clamp(48px, 4vw, 64px);
  font-weight: 400;
  letter-spacing: -0.034em;
  color: var(--text-1);
  font-variant-numeric: tabular-nums lining-nums;
}

.progress-hero-phase {
  font-family: var(--font-sans);
  font-size: var(--type-h2);  /* 17-18.5px */
  font-weight: 500;
  color: var(--text-2);
  margin-top: 8px;
}
```

### Status Text (Live update)

```css
.progress-status {
  font-family: var(--font-sans);
  font-size: var(--type-body);  /* 14px */
  color: var(--text-2);
  font-style: italic;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-meta {
  font-family: var(--font-mono);
  font-size: var(--type-tiny);  /* 12px - WCAG floor */
  color: var(--text-3);
  font-variant-numeric: tabular-nums lining-nums;
}
```

### Phase List (Expanded)

```css
.phase-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid var(--hairline-2);
}

.phase-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: var(--type-body);
}

.phase-item.complete {
  color: var(--text-3);
}

.phase-item.complete .phase-icon {
  color: var(--success);
}

.phase-item.current {
  color: var(--text-1);
  font-weight: 500;
}

.phase-item.pending {
  color: var(--text-4);
}

.phase-time {
  font-family: var(--font-mono);
  font-size: var(--type-tiny);
  color: var(--text-3);
  margin-left: auto;
}
```

---

## Animation & Transitions

### Phase Transition

When moving to a new phase:

```css
/* Outgoing phase */
.phase-transitioning-out {
  animation: phaseOut 280ms var(--ease-smooth) forwards;
}

@keyframes phaseOut {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-8px); }
}

/* Incoming phase */
.phase-transitioning-in {
  animation: phaseIn 280ms var(--ease-smooth) forwards;
}

@keyframes phaseIn {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

### Progress Updates

```css
/* Smooth number interpolation */
.progress-percent {
  transition: all 300ms var(--ease-smooth);
}

/* Bar fill with easing */
.progress-bar-fill {
  transition: width 300ms var(--ease-smooth);
}
```

### Modal Enter/Exit

```css
/* Backdrop */
.progress-modal-backdrop {
  animation: backdropIn 280ms var(--ease-smooth) forwards;
}

@keyframes backdropIn {
  0% { opacity: 0; backdrop-filter: blur(0); }
  100% { opacity: 1; backdrop-filter: blur(8px); }
}

/* Card */
.progress-modal-card {
  animation: cardIn 320ms var(--ease-smooth) forwards;
}

@keyframes cardIn {
  0% { 
    opacity: 0; 
    transform: translateY(24px) scale(0.96);
  }
  100% { 
    opacity: 1; 
    transform: translateY(0) scale(1);
  }
}
```

---

## Phase Definitions by Operation

### Article Generation (6 phases)

| Phase | Name | Typical Duration | What Happens |
|-------|------|------------------|--------------|
| 1 | Research | 8-15s | Keyword analysis, competitor scan, SERP review |
| 2 | Outline | 5-10s | Structure generation, heading hierarchy |
| 3 | Writing | 30-90s | Section-by-section content creation |
| 4 | SEO Optimization | 10-20s | Internal links, meta, schema |
| 5 | Quality Gate | 5-10s | Score calculation, checks |
| 6 | Publish | 3-8s | CMS push, GSC submit |

### Prospect Scraping (5 phases)

| Phase | Name | Typical Duration | What Happens |
|-------|------|------------------|--------------|
| 1 | Discovery | 5-15s | Sitemap fetch, page enumeration |
| 2 | Crawling | 30-180s | Page content extraction |
| 3 | Analysis | 10-30s | Keyword extraction, clustering |
| 4 | Intelligence | 15-30s | Competitor gap analysis |
| 5 | RAG Ingestion | 10-20s | Vector embedding, graph building |

### SEO Audit (4 phases)

| Phase | Name | Typical Duration | What Happens |
|-------|------|------------------|--------------|
| 1 | Crawling | 30-300s | Page discovery and fetching |
| 2 | Analysis | 20-60s | 109 checks across 4 tiers |
| 3 | Scoring | 5-10s | Issue categorization, severity |
| 4 | Recommendations | 5-15s | Quick wins, priority ordering |

### Report Generation (3 phases)

| Phase | Name | Typical Duration | What Happens |
|-------|------|------------------|--------------|
| 1 | Data Collection | 10-30s | Metrics aggregation |
| 2 | Visualization | 5-15s | Chart generation |
| 3 | Export | 3-10s | PDF/HTML rendering |

---

## React Component API

```tsx
interface GenerationProgressProps {
  // Operation configuration
  operation: 'article' | 'prospect' | 'audit' | 'report';
  phases: Phase[];
  
  // Current state
  currentPhase: number;
  phaseProgress: number;  // 0-100 within current phase
  totalProgress: number;  // 0-100 overall
  
  // Live updates
  statusText?: string;    // "Writing section 3 of 7..."
  etaSeconds?: number;    // Remaining time estimate
  
  // Metadata
  startedAt: Date;
  tokenUsage?: number;
  
  // Display mode
  variant: 'inline' | 'modal' | 'minimized';
  
  // Actions
  onCancel?: () => void;
  onMinimize?: () => void;
  onExpand?: () => void;
}

interface Phase {
  id: string;
  name: string;
  status: 'pending' | 'current' | 'complete';
  duration?: number;  // Seconds taken (for complete phases)
}
```

### Usage Examples

```tsx
// Article generation in modal
<GenerationProgress
  operation="article"
  phases={[
    { id: 'research', name: 'Research', status: 'complete', duration: 12 },
    { id: 'outline', name: 'Outline', status: 'complete', duration: 8 },
    { id: 'writing', name: 'Writing', status: 'current' },
    { id: 'seo', name: 'SEO Optimization', status: 'pending' },
    { id: 'quality', name: 'Quality Gate', status: 'pending' },
    { id: 'publish', name: 'Publish', status: 'pending' },
  ]}
  currentPhase={3}
  phaseProgress={42}
  totalProgress={37}
  statusText="Writing section 3 of 7: Internal Links"
  etaSeconds={120}
  startedAt={new Date('2026-05-11T14:23:00')}
  tokenUsage={2847}
  variant="modal"
  onCancel={handleCancel}
  onMinimize={handleMinimize}
/>

// Inline progress in card
<GenerationProgress
  operation="audit"
  phases={auditPhases}
  currentPhase={1}
  phaseProgress={68}
  totalProgress={25}
  statusText="Crawling: 340 of 500 pages"
  variant="inline"
/>

// Minimized pill (background operation)
<GenerationProgress
  operation="article"
  phases={articlePhases}
  currentPhase={3}
  phaseProgress={42}
  totalProgress={37}
  variant="minimized"
  onExpand={handleExpand}
/>
```

---

## State Machine

```
                    ┌─────────────┐
                    │   IDLE      │
                    └──────┬──────┘
                           │ start()
                           ▼
                    ┌─────────────┐
           ┌───────►│  RUNNING    │◄──────────┐
           │        └──────┬──────┘           │
           │               │                   │
           │    ┌──────────┴──────────┐       │
           │    │                     │       │
           │    ▼                     ▼       │
           │ [Phase 1]  ───►  [Phase 2] ... [Phase N]
           │    │                     │       │
           │    │                     │       │
           │    ▼                     ▼       │
           │ complete()           error()     │
           │    │                     │       │
           │    ▼                     ▼       │
           │ ┌─────────────┐   ┌─────────────┐
           │ │  COMPLETE   │   │   ERROR     │
           │ └─────────────┘   └──────┬──────┘
           │                          │
           │                          │ retry()
           └──────────────────────────┘

User actions:
- cancel() → CANCELLED state (from any RUNNING state)
- minimize() → Changes variant, doesn't affect state
- expand() → Changes variant, doesn't affect state
```

---

## Accessibility

### ARIA Attributes

```html
<div 
  role="progressbar"
  aria-valuenow="42"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-label="Article generation: Writing phase, 42% complete"
  aria-live="polite"
>
  <!-- Progress content -->
</div>
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Escape` | Close modal / Cancel operation (with confirmation) |
| `M` | Minimize modal |
| `Space` | Expand minimized pill |

### Screen Reader Announcements

```tsx
// Announce phase transitions
useEffect(() => {
  if (phaseChanged) {
    announce(`Now in ${currentPhase.name} phase`);
  }
}, [currentPhase]);

// Announce major milestones
useEffect(() => {
  if (totalProgress === 25) announce('25% complete');
  if (totalProgress === 50) announce('Halfway there');
  if (totalProgress === 75) announce('Almost done');
  if (totalProgress === 100) announce('Complete!');
}, [totalProgress]);
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .progress-bar-fill {
    animation: none;
    transition: width 0.01ms;
  }
  
  .phase-dot.current {
    animation: none;
  }
  
  .progress-modal-card,
  .progress-modal-backdrop {
    animation: none;
  }
}
```

---

## Error States

### Recoverable Error

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                                                                  ││
│  │   ⚠️  Writing paused                                            ││
│  │                                                                  ││
│  │   Rate limit reached. Will retry automatically in 30s.          ││
│  │                                                                  ││
│  │   ●───●───●─ · ─○───○───○                                       ││
│  │                                                                  ││
│  │   [Retry Now]  [Cancel]                                         ││
│  │                                                                  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Fatal Error

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                                                                  ││
│  │   ❌  Generation failed                                         ││
│  │                                                                  ││
│  │   The content service returned an error.                        ││
│  │   Your draft has been saved.                                    ││
│  │                                                                  ││
│  │   ●───●───✕                                                     ││
│  │                                                                  ││
│  │   Error: API timeout after 30s                                  ││
│  │   12px mono, text-3                                             ││
│  │                                                                  ││
│  │   [View Draft]  [Try Again]  [Report Issue]                     ││
│  │                                                                  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### Today Feed Integration

When operation completes, auto-add to Today feed:

```
14:25 │ Article "Best Running Gear 2026" generated
      │ CONTENT · GENERATED · 2m 34s · 4,200 tokens
      │ Score: 84 ✓
```

### Ops Strip Integration

Show active operations in ops strip:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ● Systems OK   ◐ 1 article generating (42%)   GSC sync 2h   DFS 14m ago  │
└───────────────────────────────────────────────────────────────────────────┘
```

### Notification Integration

- **On complete**: Toast notification if minimized
- **On error**: Persistent toast with action
- **If tab inactive**: Browser notification (if permitted)

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/web/src/components/progress/GenerationProgress.tsx` | Main component |
| `apps/web/src/components/progress/PhaseStepper.tsx` | Phase dots component |
| `apps/web/src/components/progress/ProgressBar.tsx` | Animated bar |
| `apps/web/src/components/progress/ProgressModal.tsx` | Modal wrapper |
| `apps/web/src/components/progress/MinimizedPill.tsx` | Collapsed variant |
| `apps/web/src/hooks/useGenerationProgress.ts` | State management hook |
| `apps/web/src/lib/progress/phases.ts` | Phase definitions |

---

## Implementation Checklist

- [ ] Create base `GenerationProgress` component with 3 variants
- [ ] Implement `PhaseStepper` with dot animations
- [ ] Implement `ProgressBar` with shimmer animation
- [ ] Create modal variant with backdrop blur
- [ ] Create minimized pill variant
- [ ] Add phase transition animations (280ms)
- [ ] Implement state machine for operation lifecycle
- [ ] Add ARIA attributes and screen reader announcements
- [ ] Handle `prefers-reduced-motion`
- [ ] Integrate with Today feed on completion
- [ ] Add ops strip indicator for active operations
- [ ] Create error state variants
- [ ] Test at 1280/1440/1920/2560 viewports
- [ ] Test at max-height: 760px (compact mode)
- [ ] Verify all text meets 12px WCAG floor

---

*Cross-references:*
- [Design System v6 §7.1](./design-system-v6.md#71-goal-hero-progress-block-the-v5-redesign) — Progress block patterns
- [Design System v6 §2.10](./design-system-v6.md#210-motion) — Animation timing
- [v7 Architecture Layer 5](./v7-master-design-architecture.md) — Progress state variants
