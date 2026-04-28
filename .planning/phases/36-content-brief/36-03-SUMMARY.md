---
plan: 36-03
status: complete
completed_at: 2026-04-23T16:55:00Z
---

# Plan 36-03 Summary: Brief Wizard UI & Server Functions

## Completed Tasks

### Task 1: Server Functions for Briefs
- Created `src/serverFunctions/briefs.ts` with TanStack Start server functions
- Functions: getBriefsFn, getBriefFn, analyzeSerpFn, createBriefFn, updateBriefStatusFn, deleteBriefFn
- Uses `createServerFn().middleware().inputValidator().handler()` pattern
- Zod validation for all inputs
- Proxies to internal API routes

### Task 2: Content Briefs List Page
- Created `src/routes/_app/clients/$clientId/briefs/index.tsx`
- Table display with keyword, word count, voice mode, status columns
- Status badges with semantic variants (draft=secondary, ready/published=default, generating=outline)
- Delete confirmation dialog using AlertDialog
- Empty state with CTA to create first brief

### Task 3: New Brief Wizard (3-Step Flow)
- Created `src/routes/_app/clients/$clientId/briefs/new.tsx`
- Step 1: Keyword selection with search and manual mapping ID input
- Step 2: SERP preview showing word count target, meta lengths, PAA questions, common H2s
- Step 3: Voice mode selection with radio buttons and tooltip explanations
- Progress indicator with step numbers and connecting lines

### Task 4: RadioGroup UI Component
- Created `src/client/components/ui/radio-group.tsx`
- Radix UI primitive with shadcn/ui styling
- Installed `@radix-ui/react-radio-group` dependency

## Files Created/Modified

| File | Action |
|------|--------|
| `src/serverFunctions/briefs.ts` | Created |
| `src/routes/_app/clients/$clientId/briefs/index.tsx` | Created |
| `src/routes/_app/clients/$clientId/briefs/new.tsx` | Created |
| `src/client/components/ui/radio-group.tsx` | Created |
| `package.json` | Modified (added @radix-ui/react-radio-group) |

## UI Components

### BriefsList Page
- React Query for data fetching with loading/error states
- Table with sortable columns (keyword, word count, voice mode, status)
- View button links to brief detail page
- Delete with confirmation dialog

### NewBriefWizard
- 3-step wizard with visual progress indicator
- Step 1: KeywordSelect - search input + manual mapping ID field
- Step 2: SerpPreview - word count cards, PAA questions, common H2 badges
- Step 3: VoiceMode - radio group with three options and descriptions
- Cancel/Back/Next/Create navigation

## Voice Modes

| Mode | Label | Description |
|------|-------|-------------|
| preservation | Voice Preservation | Maintains existing voice and tone from current content |
| application | Brand Application | Applies brand guidelines for consistent identity |
| best_practices | SEO Best Practices | Optimizes structure and language for search engines |

## Requirements Coverage

- BRIEF-07: UI for content brief generation ✓
  - List view with status badges ✓
  - 3-step wizard flow ✓
  - SERP preview before save ✓
  - Voice mode selection with tooltips ✓
