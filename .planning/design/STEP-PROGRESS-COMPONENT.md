# Step Progress Component

> **Reference**: Screenshot pattern with vertical checklist, service icons, and live counts
> **Status**: Ready for implementation
> **Principle**: Users see OUTCOMES, not implementation details

---

## Design Philosophy: Dual-Purpose Labels

**The goal**: Labels that are:
1. **Informative to you** — You know exactly what's happening under the hood
2. **Opaque to agency users** — They can't reverse-engineer your tech stack

**Example mapping:**

| Internal Reality | User-Facing Label | You See | They See |
|------------------|-------------------|---------|----------|
| T0 Fetcher working | "Fetching pages" | "Ah, T0 is handling this" | "Cool, it's fetching" |
| T1 Camoufox retry | "Processing..." | "Some pages needed T1" | "Still working" |
| T2 DataForSEO fallback | "Finalizing..." | "Hard pages going to T2" | "Almost done" |
| All tiers combined | "Scraping content" | "This is the tiered system" | "It's scraping" |

**Rule: Generic verbs, no service names, no technical terms.**

---

## Visual Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ◇ Generating article                                          │
│                                                                 │
│   ✓  Searching Google                         G  24 sources    │
│   ✓  Scraping content                            18 pages      │
│   ✓  Writing content                             3,247 words   │
│   ●  Generating images                           4 of 6        │
│   ○  Adding links                                20 links      │
│   ○  Publishing article                       W  9:00 AM       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Anatomy

```
┌─ Card (white, ghost-edge shadow, 12px radius) ─────────────────┐
│                                                                 │
│   [◇] [Header text]                    ← Loading icon + title  │
│                                                                 │
│   [●] [Step name]                [Icon] [Count/meta]           │
│   [●] [Step name]                       [Count/meta]           │
│   [●] [Step name]                       [Count/meta]           │
│   [●] [Step name]                       [Count/meta]  ← Current│
│   [○] [Step name]                       [Count/meta]  ← Pending│
│   [○] [Step name]                [Icon] [Count/meta]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Legend:
  ◇  = Loading spinner (header)
  ✓  = Green checkmark (complete)
  ●  = Green filled dot (in progress)
  ○  = Gray empty circle (pending)
```

---

## CSS Specifications

### Card Container

```css
.step-progress-card {
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 
    0 0 0 1px rgba(20, 20, 26, 0.045),
    0 1px 3px rgba(20, 20, 26, 0.04),
    0 4px 12px rgba(20, 20, 26, 0.03);
  padding: 20px 24px;
  min-width: 320px;
  max-width: 400px;
}
```

### Header

```css
.step-progress-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.step-progress-header-icon {
  width: 16px;
  height: 16px;
  color: var(--text-3);
  animation: spin 1.5s linear infinite;
}

.step-progress-header-text {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 400;
  color: var(--text-3);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### Step Row

```css
.step-row {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.step-row + .step-row {
  border-top: none;  /* No dividers between rows */
}
```

### Status Icons

```css
/* Complete checkmark */
.step-icon-complete {
  width: 18px;
  height: 18px;
  color: #22c55e;  /* Green-500 */
}

/* In progress - filled dot */
.step-icon-progress {
  width: 10px;
  height: 10px;
  margin: 4px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.9); }
}

/* Pending - empty circle */
.step-icon-pending {
  width: 10px;
  height: 10px;
  margin: 4px;
  border-radius: 50%;
  border: 1.5px solid var(--text-4);
  background: transparent;
}
```

### Step Text

```css
.step-name {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 400;
  color: var(--text-1);
}

.step-row.pending .step-name {
  color: var(--text-3);
}
```

### Right Side (Count + Service Icon)

```css
.step-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.step-service-icon {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}

.step-count {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 400;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
```

---

## Service Icons

| Service | Icon | When Used |
|---------|------|-----------|
| Google | `G` logo (colored) | Searching Google, GSC submit |
| WordPress | `W` logo (gray) | Publishing to WP |
| Shopify | `S` bag icon | Publishing to Shopify |
| DataForSEO | `DFS` text badge | DataForSEO tier used |
| Redis | Red diamond | Cache operations |

---

## Step Definitions by Operation

### Prospect Analysis

```
User sees:                                    You know internally:
─────────────────────────────────────────────────────────────────
✓  Finding pages              847 found      ← Sitemap + crawl discovery
●  Fetching content           312 of 847     ← T0/T1/T2 all combined here
○  Analyzing keywords                        ← Keyword extraction
○  Organizing topics                         ← Topical clustering  
○  Finding opportunities                     ← Gap analysis vs competitors
○  Preparing results                         ← RAG ingestion (they don't know what RAG is)
```

```typescript
const prospectSteps: Step[] = [
  { id: 'discover', name: 'Finding pages', countLabel: 'found' },
  { id: 'fetch', name: 'Fetching content', countLabel: 'of' },      // All tiers hidden here
  { id: 'keywords', name: 'Analyzing keywords', countLabel: 'found' },
  { id: 'topics', name: 'Organizing topics', countLabel: 'groups' },
  { id: 'gaps', name: 'Finding opportunities', countLabel: 'found' },
  { id: 'save', name: 'Preparing results', countLabel: '' },        // No "vectors" - meaningless to users
];
```

**Retry handling (invisible to users):**
- Count just increments: "312 of 847" → "313 of 847"
- No indication of which tier handled each page
- If pages fail completely: "840 of 847 (7 skipped)" — vague, no explanation

---

### Article Generation

```
User sees:                                    You know internally:
─────────────────────────────────────────────────────────────────
✓  Searching Google        G  24 sources     ← SERP scraping
✓  Gathering content          18 pages       ← Competitor page scraping (tiered)
✓  Writing article            3,247 words    ← LLM generation
●  Creating images            4 of 6         ← Image gen API
○  Adding links               ~20 links      ← Internal link insertion
○  Publishing              W  9:00 AM        ← CMS push + GSC submit
```

```typescript
const articleSteps: Step[] = [
  { id: 'serp', name: 'Searching Google', icon: 'google', countLabel: 'sources' },
  { id: 'gather', name: 'Gathering content', countLabel: 'pages' },
  { id: 'write', name: 'Writing article', countLabel: 'words' },
  { id: 'images', name: 'Creating images', countLabel: 'of' },
  { id: 'links', name: 'Adding links', countLabel: 'links' },
  { id: 'publish', name: 'Publishing', icon: 'wordpress', countLabel: '' },
];
```

---

### SEO Audit

```
User sees:                                    You know internally:
─────────────────────────────────────────────────────────────────
✓  Scanning site              500 pages      ← Crawl with tiered fetching
✓  Checking pages             109 checks     ← 109 checks across 4 tiers
●  Finding issues             23 found       ← Issue aggregation
○  Calculating score                         ← Score computation
```

```typescript
const auditSteps: Step[] = [
  { id: 'scan', name: 'Scanning site', countLabel: 'pages' },
  { id: 'check', name: 'Checking pages', countLabel: 'checks' },
  { id: 'issues', name: 'Finding issues', countLabel: 'found' },
  { id: 'score', name: 'Calculating score', countLabel: '' },
];
```

---

### Proposal Generation

```
User sees:                                    You know internally:
─────────────────────────────────────────────────────────────────
✓  Analyzing site             127 pages      ← Quick scrape
✓  Researching keywords    G  2,341 found    ← Keyword intelligence pipeline
✓  Checking competitors       5 sites        ← Competitor analysis
●  Writing proposal           4 of 6         ← LLM narrative generation
○  Generating PDF                            ← PDF export
```

```typescript
const proposalSteps: Step[] = [
  { id: 'analyze', name: 'Analyzing site', countLabel: 'pages' },
  { id: 'keywords', name: 'Researching keywords', icon: 'google', countLabel: 'found' },
  { id: 'competitors', name: 'Checking competitors', countLabel: 'sites' },
  { id: 'write', name: 'Writing proposal', countLabel: 'of' },
  { id: 'pdf', name: 'Generating PDF', countLabel: '' },
];
```

---

## React Component

```tsx
interface Step {
  id: string;
  name: string;
  status: 'complete' | 'progress' | 'pending';
  icon?: 'google' | 'wordpress' | 'shopify' | 'redis' | null;
  count?: number | string;
  countLabel?: string;
}

interface StepProgressProps {
  title: string;
  steps: Step[];
}

export function StepProgress({ title, steps }: StepProgressProps) {
  return (
    <div className="step-progress-card">
      {/* Header */}
      <div className="step-progress-header">
        <LoadingDiamond className="step-progress-header-icon" />
        <span className="step-progress-header-text">{title}</span>
      </div>

      {/* Steps */}
      <div className="step-list">
        {steps.map((step) => (
          <div 
            key={step.id} 
            className={`step-row ${step.status}`}
          >
            {/* Status icon */}
            <div className="step-icon">
              {step.status === 'complete' && <CheckIcon />}
              {step.status === 'progress' && <div className="step-icon-progress" />}
              {step.status === 'pending' && <div className="step-icon-pending" />}
            </div>

            {/* Step name */}
            <span className="step-name">{step.name}</span>

            {/* Count + service icon */}
            <div className="step-meta">
              {step.icon && <ServiceIcon name={step.icon} />}
              <span className="step-count">
                {step.count} {step.countLabel}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Live Example States

### In Progress (Scraping)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ◇ Scraping prospect                                           │
│                                                                 │
│   ✓  Finding pages                               847 URLs       │
│   ●  Scraping content                            312 of 847     │
│   ○  Extracting keywords                                        │
│   ○  Building clusters                                          │
│   ○  Analyzing gaps                                             │
│   ○  Ingesting to RAG                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Complete

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ✓ Prospect ready                                              │
│                                                                 │
│   ✓  Finding pages                               847 URLs       │
│   ✓  Scraping content                            847 pages      │
│   ✓  Extracting keywords                         2,341 keywords │
│   ✓  Building clusters                           47 topics      │
│   ✓  Analyzing gaps                              23 opportunities│
│   ✓  Ingesting to RAG                            4,200 vectors  │
│                                                                 │
│   ─────────────────────────────────────────────────────────────│
│   Completed in 2m 34s · $0.12 cost                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### With Tier Indicators (Phase 100 Scraping)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ◇ Scraping content                                            │
│                                                                 │
│   ✓  T0: Fetcher                                 812 pages      │
│   ✓  T1: Camoufox                                31 pages       │
│   ●  T2: DataForSEO                          DFS 4 of 4        │
│                                                                 │
│   Total: 847 pages · Est. cost: $0.09                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Animations

### Step Completion Transition

```css
.step-row {
  transition: opacity 200ms ease;
}

.step-icon-complete {
  animation: checkIn 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes checkIn {
  0% { 
    transform: scale(0.5); 
    opacity: 0; 
  }
  50% { 
    transform: scale(1.2); 
  }
  100% { 
    transform: scale(1); 
    opacity: 1; 
  }
}
```

### Count Update

```css
.step-count {
  transition: all 150ms ease;
}

.step-count.updating {
  animation: countPulse 150ms ease;
}

@keyframes countPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## Tailwind Implementation

```tsx
export function StepProgress({ title, steps }: StepProgressProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-80 max-w-md">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <LoadingDiamond className="w-4 h-4 text-gray-400 animate-spin" />
        <span className="text-sm text-gray-500">{title}</span>
      </div>

      {/* Steps */}
      <div className="space-y-0">
        {steps.map((step) => (
          <div 
            key={step.id} 
            className="grid grid-cols-[20px_1fr_auto] items-center gap-3 py-2.5"
          >
            {/* Status icon */}
            {step.status === 'complete' && (
              <CheckCircle2 className="w-[18px] h-[18px] text-green-500" />
            )}
            {step.status === 'progress' && (
              <div className="w-2.5 h-2.5 mx-1 rounded-full bg-green-500 animate-pulse" />
            )}
            {step.status === 'pending' && (
              <div className="w-2.5 h-2.5 mx-1 rounded-full border-[1.5px] border-gray-300" />
            )}

            {/* Step name */}
            <span className={cn(
              "text-sm",
              step.status === 'pending' ? "text-gray-400" : "text-gray-900"
            )}>
              {step.name}
            </span>

            {/* Count + service icon */}
            <div className="flex items-center gap-1.5">
              {step.icon && <ServiceIcon name={step.icon} className="w-3.5 h-3.5 opacity-70" />}
              <span className="text-[13px] text-gray-400 tabular-nums">
                {step.count} {step.countLabel}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Usage

```tsx
// Article generation
<StepProgress
  title="Generating article"
  steps={[
    { id: 'research', name: 'Searching Google', status: 'complete', icon: 'google', count: 24, countLabel: 'sources' },
    { id: 'scrape', name: 'Scraping content', status: 'complete', count: 18, countLabel: 'pages' },
    { id: 'write', name: 'Writing content', status: 'complete', count: '3,247', countLabel: 'words' },
    { id: 'images', name: 'Generating images', status: 'progress', count: '4 of 6' },
    { id: 'links', name: 'Adding links', status: 'pending', count: 20, countLabel: 'links' },
    { id: 'publish', name: 'Publishing article', status: 'pending', icon: 'wordpress', count: '9:00 AM' },
  ]}
/>

// Prospect scraping with tiers
<StepProgress
  title="Scraping prospect"
  steps={[
    { id: 'discover', name: 'Finding pages', status: 'complete', count: 847, countLabel: 'URLs' },
    { id: 't0', name: 'T0: Fetcher', status: 'complete', count: 812, countLabel: 'pages' },
    { id: 't1', name: 'T1: Camoufox', status: 'complete', count: 31, countLabel: 'pages' },
    { id: 't2', name: 'T2: DataForSEO', status: 'progress', icon: 'dataforseo', count: '3 of 4' },
    { id: 'extract', name: 'Extracting keywords', status: 'pending' },
    { id: 'rag', name: 'Ingesting to RAG', status: 'pending' },
  ]}
/>
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/web/src/components/ui/step-progress.tsx` | Main component |
| `apps/web/src/components/ui/service-icons.tsx` | Google, WordPress, etc. |
| `apps/web/src/components/ui/loading-diamond.tsx` | Header spinner |

---

*1:1 match with reference screenshot. Minimal, clean, informative.*
