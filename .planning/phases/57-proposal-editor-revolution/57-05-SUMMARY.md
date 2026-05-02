---
phase: 57-proposal-editor-revolution
plan: 05
subsystem: proposal-editor
tags: [sections, crud, ui-components, i18n]
dependency_graph:
  requires: [57-04]
  provides: [custom-sections, section-crud-api]
  affects: [proposal-editor, template-sections]
tech_stack:
  added: []
  patterns: [section-type-registry, platform-detection]
key_files:
  created:
    - apps/web/src/components/proposals/AddSectionMenu.tsx
    - apps/web/src/components/proposals/sections/TextSection.tsx
    - apps/web/src/components/proposals/sections/ImageSection.tsx
    - apps/web/src/components/proposals/sections/TestimonialSection.tsx
    - apps/web/src/components/proposals/sections/CaseStudySection.tsx
    - apps/web/src/components/proposals/sections/VideoSection.tsx
    - apps/web/src/components/proposals/sections/ComparisonSection.tsx
    - apps/web/src/components/proposals/sections/TimelineSection.tsx
    - apps/web/src/components/proposals/sections/index.ts
    - apps/web/src/components/proposals/DeleteSectionDialog.tsx
    - open-seo-main/src/routes/api/proposals/[id]/sections/index.ts
    - open-seo-main/src/routes/api/proposals/[id]/sections/[sid].ts
  modified:
    - apps/web/src/components/proposals/index.ts
decisions:
  - "8 custom section types: text, image, testimonial, case_study, video, comparison, timeline, custom"
  - "SECTION_TYPE_CONFIGS registry with icons and localized labels/descriptions"
  - "Platform detection for video embeds: YouTube, Vimeo, Loom via URL pattern matching"
  - "Section data stored as JSON in template_sections.content field"
  - "Auto-position calculation via max(position)+1 on POST"
metrics:
  duration: "25 minutes"
  completed: "2026-05-02T11:22:00Z"
---

# Phase 57 Plan 05: Custom Sections + Add Section Menu Summary

8 custom section types with dedicated editors and full CRUD API for proposal sections.

## One-Liner

AddSectionMenu with 4x2 grid of 8 section types (text/image/testimonial/case_study/video/comparison/timeline/custom), each with dedicated editor component and POST/PUT/DELETE API.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | AddSectionMenu | 70bf51c32 | AddSectionMenu.tsx |
| 2 | Section Components | 70bf51c32 | sections/*.tsx |
| 3 | Section CRUD API | 6e15bee69 | [id]/sections/*.ts |
| 4 | Delete Confirmation | 70bf51c32 | DeleteSectionDialog.tsx |

## Implementation Details

### AddSectionMenu (Task 1)

4x2 grid popup with section types:
- Uses Popover from shadcn/ui
- SECTION_TYPE_CONFIGS registry with icon, labelEn/Lt, descriptionEn/Lt
- Hover shows description preview
- Click triggers onSelect callback with section type

### Section Components (Task 2)

| Type | Content Fields | Features |
|------|---------------|----------|
| text | content | ProposalInlineEditor wrapper |
| image | url, caption, alt | Live preview, URL validation |
| testimonial | quote, author, company, image? | Preview card with avatar |
| case_study | title, metrics[], description | Add/remove metric cards |
| video | url, platform | Auto platform detection, embed preview |
| comparison | items[{aspect, before, after}] | Before/after table rows |
| timeline | phases[{title, duration, description}] | Visual timeline with dots |
| custom | any | Generic content block |

### Section CRUD API (Task 3)

```
POST   /api/proposals/:id/sections      # Add section (auto-position)
PUT    /api/proposals/:id/sections/:sid # Update section
DELETE /api/proposals/:id/sections/:sid # Delete (blocks required)
```

Zod validation on all inputs. Section data stored as JSON in content field.

### Delete Confirmation (Task 4)

AlertDialog with localized messages:
- "Are you sure?" with section title
- "This action cannot be undone" warning
- Cancel/Delete buttons with loading state

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

All 12 files created, both commits exist (70bf51c32, 6e15bee69).
