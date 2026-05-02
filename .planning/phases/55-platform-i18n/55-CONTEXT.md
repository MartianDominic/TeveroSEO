# Phase 55: Platform Internationalization - Context

**Gathered:** 2026-04-30
**Status:** Ready for execution

<domain>
## Phase Boundary

Complete internationalization of TeveroSEO platform with Lithuanian as primary target. Claude→Gemini translation wrapper for high-quality Lithuanian. Multi-tenant language settings. Text fitting for longer translations.

</domain>

<decisions>
## Implementation Decisions

### Translation Architecture
- **D-01:** Use Gemini 1.5 Pro for Lithuanian translations (superior Baltic language data)
- **D-02:** Static UI strings pre-translated via batch job
- **D-03:** Dynamic content (proposals, agreements) translated at generation time
- **D-04:** Translation cache with SHA256 hash key for deduplication

### i18n Frameworks
- **D-05:** next-intl for apps/web (Next.js)
- **D-06:** i18next for open-seo-main (TanStack Start)
- **D-07:** Path prefix routing: /lt/dashboard for Lithuanian

### Multi-Tenant Language
- **D-08:** workspace default_language + supported_languages
- **D-09:** prospect preferred_language (null = inherit from workspace)
- **D-10:** Resolution order: user > prospect > workspace > browser > default
- **D-11:** Formality setting: formal (jūs) vs informal (tu)

### Text Fitting
- **D-12:** Short variants (_short suffix) for tight spaces
- **D-13:** Responsive font sizing via clamp()
- **D-14:** Icon-only with tooltip for mobile

### Legal Content
- **D-15:** Pre-approved Lithuanian agreement templates
- **D-16:** Variable substitution only (no AI translation of legal clauses)
- **D-17:** Lawyer review required before deployment

### Claude's Discretion
- Specific CSS adjustments for overflow
- Cache eviction strategy
- Quality scoring algorithm details
- Translation prompt fine-tuning

</decisions>

<canonical_refs>
## Canonical References

| File | What it provides |
|------|------------------|
| `.planning/phases/55-platform-i18n/DESIGN.md` | Full architecture, Gemini prompts, schema |
| `apps/web/src/app/` | Next.js App Router structure to add i18n |
| `open-seo-main/src/routes/` | TanStack routes to add i18n |

</canonical_refs>

<existing_patterns>
## Existing Patterns to Follow

- Workspace settings pattern from organization table
- Prospect preferences pattern from prospects table
- Service class pattern for TranslationService
- API route patterns for settings endpoints

</existing_patterns>
