# Phase 55: Platform Internationalization - Research

**Completed:** 2026-04-30
**Source:** Gemini API docs, i18n best practices, Lithuanian language analysis

## Why Gemini for Lithuanian?

Lithuanian is complex:
- 7 grammatical cases
- Gender agreement (masculine/feminine)
- Complex verb conjugations
- Formal/informal (tu/jūs) distinction
- Unique vocabulary (oldest Indo-European language)

Google/Gemini advantages:
- EU institutional translations (Lithuania joined 2004)
- Lithuanian government digitization corpus
- 15+ years of Google Translate feedback data

## Translation Service Design

### Prompt Structure
```
RULES:
- Use {formality} form (jūs/tu)
- Keep SEO terms in English: SEO, URL, backlink, keyword
- Preserve placeholders: {{name}}, {count}
- Max length: {maxLength} characters

CONTEXT: {type} content, {tone} tone

SOURCE: {text}
TRANSLATION:
```

### Caching Strategy
- Key: SHA256(text + targetLang + contextType + formality)
- TTL: None (permanent cache, invalidate on model updates)
- Expected hit rate: >80% after warmup

## Text Length Analysis

| English | Lithuanian | Increase |
|---------|------------|----------|
| Dashboard | Valdymo skydelis | +78% |
| Save | Išsaugoti | +80% |
| Generate Proposal | Generuoti pasiūlymą | +50% |
| Settings | Nustatymai | +11% |

**Average increase: 20-40%**

## Solution: Short Variants

```json
{
  "nav.dashboard": "Valdymo skydelis",
  "nav.dashboard_short": "Skydelis"
}
```

## Framework Selection

### next-intl (Next.js)
- Server Components support
- App Router middleware
- ICU message format
- Static rendering

### i18next (TanStack)
- Most popular React i18n
- Browser language detection
- Interpolation + plurals

## Lithuanian Plurals (ICU)

Lithuanian has 4 plural forms:
- one: 1, 21, 31... (ends in 1, not 11)
- few: 2-9, 22-29... (ends in 2-9, not 12-19)
- many: 0, 10-20, 100... 
- other: fractions

```
{count, plural,
  one {# raktažodis}
  few {# raktažodžiai}
  many {# raktažodžių}
  other {# raktažodžio}
}
```

## Estimated String Count

| Namespace | Count |
|-----------|-------|
| common | 50 |
| nav | 20 |
| dashboard | 30 |
| prospects | 60 |
| proposals | 80 |
| agreements | 40 |
| invoices | 50 |
| settings | 60 |
| errors | 40 |
| **Total** | **~430** |

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Translation quality | Human review workflow, quality scoring |
| Legal accuracy | Pre-approved templates, lawyer review |
| Text overflow | Short variants, responsive CSS |
| API costs | Aggressive caching, batch translations |

**Total: 70-88 hours across 8 plans**
