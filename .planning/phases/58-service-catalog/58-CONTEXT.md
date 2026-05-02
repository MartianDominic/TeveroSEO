# Phase 58: Service Catalog & Extra Services - Context

**Gathered:** 2026-05-02
**Status:** Ready for execution
**Mode:** Auto-generated from DESIGN.md

<domain>
## Phase Boundary

Enable structured service packages with add-on services as proposal line items, replacing the current text-only `investment.inclusions: string[]`.

**Core Capabilities:**
- Service catalog with workspace-level templates
- Three service categories: `seo_package`, `addon`, `one_time`
- Package selection (radio) + add-ons (checkboxes) in proposal builder
- Price customization per proposal (override template prices)
- Auto-calculate monthly/setup/first-month totals
- Service terms auto-append to agreement
- Default templates seeded on workspace creation

**Key Constraint:** Full i18n support (EN/LT) for all service names, descriptions, and terms.

</domain>

<decisions>
## Implementation Decisions

### Data Model
- `serviceTemplates` table for workspace-level reusable definitions
- `proposalServices` junction table for proposal-specific selections
- Pricing types: `monthly`, `one_time`, `per_unit`
- Prices stored as cents (basePriceCents, setupFeeCents)
- Service inclusions as JSONB array

### Service Selector UI
- Embedded in proposal Investment section
- Package selection: radio buttons (mutually exclusive)
- Add-ons: checkboxes (can select multiple)
- [Edit] button opens price customization modal
- Summary card shows calculated totals

### Service Management
- Settings > Services page for CRUD operations
- Duplicate service template for quick variations
- Soft delete via `isActive` flag
- Display order for UI sorting

### Agreement Integration
- Selected services → agreement line items
- Service `termsTemplate` auto-appended to agreement
- Variable substitution in service-specific clauses

### Default Templates
- 3 SEO packages (Starter, Growth, Enterprise)
- 5 add-on services (GMB, Reviews, Website, CRM, Booking)
- Seeded when workspace created (if no templates exist)

</decisions>

<references>
## Reference Documents

- `DESIGN.md` — Full specification with schemas and UI mockups
- `57-CONTEXT.md` — Proposal editor patterns (prerequisite)
- Phase 46-47 — Existing proposal system foundation

</references>

<success_criteria>
## Success Criteria

1. Service catalog exists with default templates
2. Agencies can create/edit/delete service templates
3. Proposal builder shows service selector
4. Package selection (radio) with 3 default tiers
5. Add-on services (checkboxes) can be toggled
6. Prices can be customized per proposal
7. Summary shows calculated totals
8. Selected services appear in agreement
9. Service terms auto-included in agreement

</success_criteria>
