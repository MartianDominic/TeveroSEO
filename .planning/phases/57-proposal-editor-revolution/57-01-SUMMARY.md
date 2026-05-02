---
phase: 57-proposal-editor-revolution
plan: 01
subsystem: proposals
tags: [schema, api, i18n, templates, drizzle]
dependency_graph:
  requires: []
  provides: [proposal_templates_schema, template_sections_schema, TemplateService, template_api]
  affects: [proposals, templates]
tech_stack:
  added: []
  patterns: [repository_pattern, three_layer_hierarchy, localized_fields]
key_files:
  created:
    - open-seo-main/src/db/proposal-template-schema.ts
    - open-seo-main/src/server/features/proposals/repositories/template.repository.ts
    - open-seo-main/src/server/features/proposals/services/TemplateService.ts
    - open-seo-main/src/routes/api/templates/proposals/index.ts
    - open-seo-main/src/routes/api/templates/proposals/$templateId.ts
    - open-seo-main/src/routes/api/templates/proposals/$templateId.duplicate.ts
  modified:
    - open-seo-main/src/db/schema.ts
    - apps/web/src/i18n/messages/en.json
    - apps/web/src/i18n/messages/lt.json
decisions:
  - Three-layer template hierarchy: system (workspaceId=null) -> workspace -> instance
  - Soft delete via isArchived flag for templates
  - Section ordering via sectionOrder jsonb array on templates table
  - i18n fields use suffix pattern: name, nameEn, nameLt
metrics:
  duration: 668s
  tasks_completed: 5
  files_created: 6
  files_modified: 3
  completed_at: "2026-05-02T10:23:42Z"
---

# Phase 57 Plan 01: Schema + Template CRUD + i18n Setup Summary

Template system foundation with Drizzle schema, repository layer, service layer, REST API, and i18n infrastructure for the Proposal Editor Revolution.

## One-liner

Proposal template schema with three-layer hierarchy (system/workspace/instance), complete CRUD API, and en/lt i18n namespace.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Drizzle Schema | 3acbd2786 | proposal-template-schema.ts, schema.ts |
| 2 | Template Repository | f32d635d4 | template.repository.ts |
| 3 | TemplateService | f3c05c73a | TemplateService.ts |
| 4 | API Endpoints | 98a088a62 | index.ts, $templateId.ts, $templateId.duplicate.ts |
| 5 | i18n Setup | fef36d268 | en.json, lt.json |

## Key Deliverables

### Database Schema

**proposal_templates table:**
- `id`, `workspaceId` (null = system template)
- Localized fields: `name`, `nameEn`, `nameLt`, `description`, `descriptionEn`, `descriptionLt`
- `type` (proposal | case_study | report)
- `category` (seo | local_seo | ecommerce | enterprise | custom)
- `sectionOrder` (jsonb array of section IDs)
- `variables` (jsonb array of VariableDefinition)
- `brandingSettings` (jsonb BrandingSettings)
- `version`, `isPublished`, `isDefault`, `isArchived`
- `createdAt`, `updatedAt`, `createdBy`

**template_sections table:**
- `id`, `templateId` (FK)
- `key`, `title`, `titleEn`, `titleLt`
- `content`, `contentEn`, `contentLt`
- `sectionType` (12 types: hero, introduction, current_state, etc.)
- `isRequired`, `isEditable`, `position`
- `conditions` (jsonb for conditional display)
- `aiPromptHint` (for AI generation)

### Repository Layer

- `findAllTemplates(workspaceId)`: List workspace + system templates
- `findTemplateById(id)`: Get template with sections
- `findDefaultTemplate(workspaceId, type)`: Workspace/system default fallback
- `createTemplate(template, sections)`: Create with sections
- `updateTemplate(id, updates)`: Update metadata
- `updateSectionOrder(id, order)`: Reorder sections
- `deleteTemplate(id, workspaceId)`: Soft delete
- `duplicateTemplate(id, targetWorkspaceId)`: Clone template
- Section CRUD: `createSection`, `updateSection`, `deleteSection`

### Service Layer

- Template validation (type, category, section type, variables)
- Workspace ownership verification on all mutations
- Default template management (clear old defaults when setting new)
- Three-layer hierarchy enforcement

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/templates/proposals | List templates for workspace |
| POST | /api/templates/proposals | Create new template |
| GET | /api/templates/proposals/:templateId | Get template with sections |
| PUT | /api/templates/proposals/:templateId | Update template |
| DELETE | /api/templates/proposals/:templateId | Soft delete template |
| POST | /api/templates/proposals/:templateId/duplicate | Clone template |

### i18n Infrastructure

**proposalEditor namespace (100+ keys):**
- `saveStatus`: saving, saved, error, lastSaved
- `sections`: addSection, deleteSection, moveUp, moveDown, reorder
- `sectionTypes`: 12 section type labels
- `variables`: title, search, categories, addCustom, dragTip
- `ai`: generateTitle, generating, regenerate, tone
- `toolbar`: undo, redo, bold, italic, link, etc.
- `version`: history, restore, preview, current
- `templates`: title, useTemplate, duplicate, setAsDefault
- `actions`: save, publish, delete, duplicate, export, share
- `validation`: nameRequired, nameTooLong, contentTooLong
- `confirmations`: deleteSection, discardChanges, deleteTemplate

## Deviations from Plan

None - plan executed exactly as written.

## Verification

```bash
# TypeScript compiles without errors for new files
pnpm tsc --noEmit 2>&1 | grep -E "(proposal-template|TemplateService|template.repository)" # No output

# JSON i18n files are valid
node -e "JSON.parse(require('fs').readFileSync('apps/web/src/i18n/messages/en.json'))" # Success
node -e "JSON.parse(require('fs').readFileSync('apps/web/src/i18n/messages/lt.json'))" # Success
```

## Self-Check: PASSED

All files created and committed successfully:
- [x] proposal-template-schema.ts exists
- [x] template.repository.ts exists
- [x] TemplateService.ts exists
- [x] API route files exist
- [x] i18n files updated
- [x] All commits recorded
