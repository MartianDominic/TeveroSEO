# Phase 55: Full Platform Internationalization (i18n)

## Overview

Complete internationalization of the TeveroSEO platform with Lithuanian as the primary target language. Uses Gemini for high-quality Lithuanian translations due to its superior Baltic language training data.

## Why Gemini for Lithuanian?

Lithuanian is a complex Baltic language with:
- **7 grammatical cases** (nominative, genitive, dative, accusative, instrumental, locative, vocative)
- **Gender agreement** (masculine/feminine)
- **Complex verb conjugations** (3 conjugations, multiple tenses)
- **Formal/informal distinction** (tu vs jūs — critical for business)
- **Unique vocabulary** — oldest surviving Indo-European language

Google/Gemini has superior Lithuanian data from:
- EU institutional translations (Lithuania joined 2004)
- Lithuanian government digitization
- Large Lithuanian web corpus
- Google Translate's 15+ years of feedback

## Content Categories & Translation Strategies

| Category | Examples | Strategy | Translator |
|----------|----------|----------|------------|
| UI Chrome | Buttons, labels, menus, nav | Static JSON, pre-translated | Gemini batch + human review |
| Form Validation | Error messages | Static JSON with ICU plurals | Gemini batch |
| Proposals | AI-generated sales content | Dynamic at generation time | Claude generates EN → Gemini translates |
| Agreements | Legal contracts | Pre-approved templates + variable substitution | Human + Gemini for names/dates |
| Emails | Notifications, invites | Template-based | Gemini batch + dynamic parts |
| Reports | PDF content | Mixed static/dynamic | Pre-translated + Gemini for data |
| User Content | Notes, comments | Store original, translate on-demand | Gemini with caching |

## Architecture

### Translation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRANSLATION ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STATIC CONTENT (UI Strings)                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ Source Code  │───▶│ Message      │───▶│ Gemini Batch │                   │
│  │ (English)    │    │ Extraction   │    │ Translation  │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                                                 │                            │
│                                                 ▼                            │
│                                          ┌──────────────┐                   │
│                                          │ Human Review │                   │
│                                          │ (Optional)   │                   │
│                                          └──────────────┘                   │
│                                                 │                            │
│                                                 ▼                            │
│                                          ┌──────────────┐                   │
│                                          │ Locale Files │                   │
│                                          │ (JSON)       │                   │
│                                          └──────────────┘                   │
│                                                                              │
│  DYNAMIC CONTENT (Proposals, Agreements)                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ User Action  │───▶│ Claude       │───▶│ Translation  │                   │
│  │ (Generate)   │    │ (English)    │    │ Service      │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                                                 │                            │
│                                    ┌────────────┴────────────┐              │
│                                    ▼                         ▼              │
│                             ┌──────────────┐          ┌──────────────┐      │
│                             │ Cache Hit?   │──Yes────▶│ Return       │      │
│                             │              │          │ Cached       │      │
│                             └──────────────┘          └──────────────┘      │
│                                    │ No                                      │
│                                    ▼                                         │
│                             ┌──────────────┐                                │
│                             │ Gemini API   │                                │
│                             │ Translation  │                                │
│                             └──────────────┘                                │
│                                    │                                         │
│                                    ▼                                         │
│                             ┌──────────────┐                                │
│                             │ Cache +      │                                │
│                             │ Return       │                                │
│                             └──────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Multi-Tenant Language Model

```
Platform (default: en)
  │
  └── Workspace (Agency)
        │
        ├── workspace_settings
        │     ├── default_language: 'lt'
        │     ├── supported_languages: ['lt', 'en']
        │     ├── country: 'LT'
        │     └── formality: 'formal' (jūs)
        │
        └── Prospects/Clients
              │
              ├── prospect_settings
              │     ├── preferred_language: 'lt' (or null = inherit)
              │     ├── country: 'LT'
              │     └── formality_override: null (inherit)
              │
              └── Communications
                    ├── proposals: prospect.preferred_language
                    ├── agreements: prospect.preferred_language
                    ├── invoices: prospect.preferred_language
                    └── emails: prospect.preferred_language
```

### Language Resolution Order

```typescript
function resolveLanguage(context: LanguageContext): Language {
  // 1. Explicit user choice (language switcher in UI)
  if (context.userSelection) return context.userSelection;
  
  // 2. Prospect/Client preference (for outbound communications)
  if (context.prospect?.preferredLanguage) return context.prospect.preferredLanguage;
  
  // 3. Workspace default
  if (context.workspace?.defaultLanguage) return context.workspace.defaultLanguage;
  
  // 4. Browser Accept-Language header
  if (context.acceptLanguage) {
    const supported = ['en', 'lt'];
    const preferred = parseAcceptLanguage(context.acceptLanguage);
    const match = preferred.find(lang => supported.includes(lang));
    if (match) return match;
  }
  
  // 5. Platform default
  return 'en';
}
```

## Text Length Accommodation

Lithuanian translations average **20-40% longer** than English:

| English | Lithuanian | Increase |
|---------|------------|----------|
| Dashboard | Valdymo skydelis | +78% |
| Generate Proposal | Generuoti pasiūlymą | +50% |
| Settings | Nustatymai | +11% |
| Save | Išsaugoti | +80% |
| Cancel | Atšaukti | +14% |

### Strategies

**1. Flexible CSS Layouts**
```css
/* Allow wrapping */
.nav-item { 
  white-space: normal;
  word-wrap: break-word;
}

/* Responsive font sizing */
.button-text {
  font-size: clamp(0.75rem, 1.5vw, 0.875rem);
}

/* Ellipsis for overflow */
.truncate-with-tooltip {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**2. Short/Long Variants**
```json
{
  "nav.dashboard": "Valdymo skydelis",
  "nav.dashboard_short": "Skydelis",
  "actions.generateProposal": "Generuoti pasiūlymą",
  "actions.generateProposal_short": "Generuoti"
}
```

**3. Translation Length Constraints**
```typescript
// Gemini prompt includes max length
const prompt = `
CRITICAL: Maximum ${maxLength} characters.
If translation exceeds limit, use shorter synonyms or abbreviations.
Common abbreviations: pasiūlymas → pas., nustatymai → nust.
`;
```

**4. Component-Level Adaptation**
```tsx
function NavItem({ messageKey }: Props) {
  const t = useTranslations();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const variant = isMobile ? `${messageKey}_short` : messageKey;
  
  // Fallback to full version if short doesn't exist
  return <span>{t(variant, { fallback: t(messageKey) })}</span>;
}
```

**5. Icon + Text Combinations**
```tsx
// When space is tight, show icon with tooltip
<Button>
  <PlusIcon />
  <span className="hidden lg:inline">{t('actions.createNew')}</span>
  <Tooltip>{t('actions.createNew')}</Tooltip>
</Button>
```

## Database Schema

### Language Settings
```sql
-- Workspace language settings
ALTER TABLE organization ADD COLUMN default_language TEXT DEFAULT 'en';
ALTER TABLE organization ADD COLUMN supported_languages TEXT[] DEFAULT ARRAY['en'];
ALTER TABLE organization ADD COLUMN country TEXT;
ALTER TABLE organization ADD COLUMN formality TEXT DEFAULT 'formal'; -- formal | informal

-- Prospect language preferences  
ALTER TABLE prospects ADD COLUMN preferred_language TEXT; -- null = inherit from workspace
ALTER TABLE prospects ADD COLUMN country TEXT;

-- Client language preferences (same as prospects but for converted clients)
ALTER TABLE clients ADD COLUMN preferred_language TEXT;
ALTER TABLE clients ADD COLUMN country TEXT;
```

### Translation Cache
```sql
CREATE TABLE translation_cache (
  id TEXT PRIMARY KEY,
  
  -- Source identification
  source_hash TEXT NOT NULL, -- SHA256 of source text
  source_text TEXT NOT NULL,
  source_lang TEXT NOT NULL DEFAULT 'en',
  
  -- Target
  target_lang TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  
  -- Context (affects translation)
  context_type TEXT NOT NULL, -- 'ui' | 'proposal' | 'agreement' | 'email'
  formality TEXT NOT NULL DEFAULT 'formal',
  
  -- Metadata
  translator TEXT NOT NULL, -- 'gemini-1.5-pro' | 'human' | 'gemini-1.5-flash'
  model_version TEXT, -- For cache invalidation on model updates
  quality_score FLOAT, -- 0-1, for review prioritization
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  use_count INTEGER NOT NULL DEFAULT 1,
  
  -- Constraints
  UNIQUE(source_hash, target_lang, context_type, formality)
);

CREATE INDEX ix_translation_cache_lookup 
  ON translation_cache(source_hash, target_lang, context_type);
CREATE INDEX ix_translation_cache_review 
  ON translation_cache(quality_score) WHERE reviewed_at IS NULL;
```

### Custom Workspace Overrides
```sql
-- Agencies can override specific translations
CREATE TABLE workspace_translation_overrides (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  
  -- What to override
  message_key TEXT NOT NULL, -- e.g., 'proposals.hero.title'
  language TEXT NOT NULL,
  
  -- Override value
  custom_value TEXT NOT NULL,
  
  -- Audit
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workspace_id, message_key, language)
);
```

## Gemini Translation Service

### Service Architecture
```typescript
// src/server/services/translation/TranslationService.ts

export interface TranslationRequest {
  text: string;
  sourceLang: 'en';
  targetLang: 'lt' | 'en';
  context: TranslationContext;
  maxLength?: number;
  preservePlaceholders?: boolean; // {{name}}, {count}, etc.
}

export interface TranslationContext {
  type: 'ui' | 'proposal' | 'agreement' | 'email' | 'report';
  formality: 'formal' | 'informal';
  domain?: 'seo' | 'business' | 'legal' | 'technical';
  tone?: 'professional' | 'friendly' | 'urgent' | 'celebratory';
  workspaceId?: string; // For custom overrides lookup
}

export interface TranslationResult {
  text: string;
  cached: boolean;
  confidence: number;
  alternatives?: string[]; // For review UI
}
```

### Gemini Prompt Engineering
```typescript
const LITHUANIAN_SYSTEM_PROMPT = `You are an expert Lithuanian translator specializing in B2B SaaS and SEO industry content.

LINGUISTIC RULES:
1. FORMALITY: Use {formality} consistently
   - Formal (jūs): "Jūs galite...", "Jūsų paskyra..."
   - Informal (tu): "Tu gali...", "Tavo paskyra..."
   
2. CASE AGREEMENT: Ensure proper grammatical cases
   - Nominative for subjects
   - Accusative for direct objects
   - Genitive for possession and quantities
   
3. TECHNICAL TERMS: Keep these in English (they're industry standard in Lithuania):
   - SEO, URL, API, CMS, HTML, CSS
   - backlink, keyword, SERP, CTR
   - dashboard (but "valdymo skydelis" is also acceptable)
   
4. BUSINESS TERMS: Use proper Lithuanian business vocabulary:
   - proposal = pasiūlymas
   - agreement/contract = sutartis
   - invoice = sąskaita faktūra
   - client = klientas
   - prospect = potencialus klientas
   
5. PLACEHOLDERS: Preserve exactly as written:
   - {{name}}, {count}, %s, {0}
   - Do NOT translate content inside placeholders

6. LENGTH CONSTRAINT: {maxLengthInstruction}

7. TONE: Maintain {tone} tone throughout

CONTEXT: {contextDescription}`;

const TRANSLATION_PROMPT = `
${LITHUANIAN_SYSTEM_PROMPT}

SOURCE TEXT (English):
"""
{sourceText}
"""

Provide ONLY the Lithuanian translation, no explanations:`;
```

### Translation Service Implementation
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash } from 'crypto';

export class TranslationService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.3, // Lower = more consistent translations
        topP: 0.8,
        maxOutputTokens: 2048,
      }
    });
  }
  
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    // Skip if same language
    if (request.sourceLang === request.targetLang) {
      return { text: request.text, cached: false, confidence: 1.0 };
    }
    
    // Check cache
    const cacheKey = this.buildCacheKey(request);
    const cached = await this.checkCache(cacheKey);
    if (cached) {
      await this.updateCacheStats(cacheKey);
      return { text: cached.translated_text, cached: true, confidence: 0.95 };
    }
    
    // Check workspace overrides
    if (request.context.workspaceId) {
      const override = await this.checkOverride(request);
      if (override) {
        return { text: override, cached: true, confidence: 1.0 };
      }
    }
    
    // Build prompt
    const prompt = this.buildPrompt(request);
    
    // Call Gemini
    const result = await this.model.generateContent(prompt);
    let translation = result.response.text().trim();
    
    // Validate placeholders preserved
    if (request.preservePlaceholders !== false) {
      translation = this.validatePlaceholders(request.text, translation);
    }
    
    // Validate length
    if (request.maxLength && translation.length > request.maxLength) {
      translation = await this.retryWithShorter(request, translation);
    }
    
    // Cache result
    await this.cacheTranslation(cacheKey, request, translation);
    
    return { text: translation, cached: false, confidence: 0.85 };
  }
  
  async translateBatch(requests: TranslationRequest[]): Promise<TranslationResult[]> {
    // Parallel translation with rate limiting
    const batchSize = 10;
    const results: TranslationResult[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(req => this.translate(req))
      );
      results.push(...batchResults);
      
      // Rate limit: 60 RPM for Gemini 1.5 Pro
      if (i + batchSize < requests.length) {
        await sleep(1000);
      }
    }
    
    return results;
  }
  
  private buildCacheKey(request: TranslationRequest): string {
    const hash = createHash('sha256')
      .update(request.text)
      .update(request.targetLang)
      .update(request.context.type)
      .update(request.context.formality)
      .digest('hex');
    return hash.substring(0, 32);
  }
  
  private validatePlaceholders(source: string, translation: string): string {
    // Extract placeholders from source
    const placeholderRegex = /\{\{?\w+\}?\}|%[sd]|\{[0-9]+\}/g;
    const sourcePlaceholders = source.match(placeholderRegex) || [];
    
    // Check all exist in translation
    for (const ph of sourcePlaceholders) {
      if (!translation.includes(ph)) {
        console.warn(`Placeholder ${ph} missing in translation, restoring`);
        // Attempt to find where it should go based on position
        // This is a safety fallback
      }
    }
    
    return translation;
  }
}
```

## i18n Framework Setup

### Next.js (apps/web) — next-intl
```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'lt'],
  defaultLocale: 'en',
  localePrefix: 'as-needed', // /lt/dashboard, but /dashboard for English
  localeDetection: true,
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
```

```typescript
// i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default
}));
```

### TanStack Start (open-seo-main) — i18next
```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: require('./locales/en.json') },
      lt: { translation: require('./locales/lt.json') },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
```

## Language Switcher UX

### Global App Switcher
```tsx
// components/LanguageSwitcher.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧', native: 'English' },
  { code: 'lt', name: 'Lithuanian', flag: '🇱🇹', native: 'Lietuvių' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  
  const handleChange = (newLocale: string) => {
    // Remove current locale prefix and add new one
    const newPath = pathname.replace(`/${locale}`, '') || '/';
    router.push(`/${newLocale}${newPath}`);
  };
  
  const current = LANGUAGES.find(l => l.code === locale);
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <span className="mr-2">{current?.flag}</span>
          <span className="hidden sm:inline">{current?.native}</span>
          <ChevronDownIcon className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map(lang => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            className={locale === lang.code ? 'bg-accent' : ''}
          >
            <span className="mr-2">{lang.flag}</span>
            <span>{lang.native}</span>
            {locale === lang.code && <CheckIcon className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Prospect Communication Language
```tsx
// In prospect detail/edit page
<FormField
  label={t('prospect.communicationLanguage')}
  description={t('prospect.communicationLanguageDesc')}
>
  <Select
    value={prospect.preferredLanguage || 'inherit'}
    onValueChange={handleLanguageChange}
  >
    <SelectItem value="inherit">
      {t('common.inheritFromWorkspace')} ({workspace.defaultLanguage})
    </SelectItem>
    <SelectItem value="en">English</SelectItem>
    <SelectItem value="lt">Lietuvių</SelectItem>
  </Select>
</FormField>

{/* Preview toggle for proposals/agreements */}
<div className="flex items-center gap-2">
  <Label>{t('preview.language')}:</Label>
  <ToggleGroup value={previewLang} onValueChange={setPreviewLang}>
    <ToggleGroupItem value="en">EN</ToggleGroupItem>
    <ToggleGroupItem value="lt">LT</ToggleGroupItem>
  </ToggleGroup>
</div>
```

## Proposal & Agreement Translation

### Proposal Generation Flow
```typescript
async function generateProposal(
  prospectId: string,
  workspaceId: string,
  templateId?: string,
): Promise<Proposal> {
  const prospect = await getProspect(prospectId);
  const workspace = await getWorkspace(workspaceId);
  
  // Determine target language
  const targetLang = prospect.preferredLanguage || workspace.defaultLanguage || 'en';
  const formality = workspace.formality || 'formal';
  
  // Generate in English first (Claude)
  const englishContent = await claudeGenerateProposal(prospect, template);
  
  // Store English version
  const proposalId = await saveProposal({
    prospectId,
    workspaceId,
    contentEn: englishContent,
    language: targetLang,
  });
  
  // Translate if needed
  if (targetLang !== 'en') {
    const translationService = new TranslationService();
    
    // Translate each section
    const translatedContent = await translateProposalContent(
      englishContent,
      {
        type: 'proposal',
        formality,
        domain: 'seo',
        tone: 'professional',
        workspaceId,
      }
    );
    
    // Store translated version
    await updateProposal(proposalId, {
      contentLt: translatedContent,
    });
    
    return { ...proposal, content: translatedContent };
  }
  
  return { ...proposal, content: englishContent };
}

async function translateProposalContent(
  content: ProposalContent,
  context: TranslationContext,
): Promise<ProposalContent> {
  const translationService = new TranslationService();
  
  // Translate hero section
  const [headline, subheadline] = await Promise.all([
    translationService.translate({
      text: content.hero.headline,
      sourceLang: 'en',
      targetLang: 'lt',
      context,
      maxLength: 80, // Headlines should be concise
    }),
    translationService.translate({
      text: content.hero.subheadline,
      sourceLang: 'en',
      targetLang: 'lt',
      context,
      maxLength: 200,
    }),
  ]);
  
  // Translate other sections...
  
  return {
    hero: {
      headline: headline.text,
      subheadline: subheadline.text,
    },
    // ... other sections
  };
}
```

### Agreement Templates
```typescript
// Agreements use pre-approved templates with variable substitution
interface AgreementTemplate {
  id: string;
  name: string;
  language: 'en' | 'lt';
  sections: AgreementSection[];
  variables: TemplateVariable[]; // What can be substituted
}

interface AgreementSection {
  id: string;
  title: string;
  content: string;
  isLegal: boolean; // If true, don't AI-translate, use pre-approved version
}

interface TemplateVariable {
  key: string; // e.g., '{{clientName}}'
  type: 'text' | 'date' | 'currency' | 'list';
  translateValue: boolean; // Whether the value should be translated
}

// Pre-approved Lithuanian legal templates
const LT_AGREEMENT_TEMPLATE: AgreementTemplate = {
  id: 'seo-services-lt',
  name: 'SEO paslaugų sutartis',
  language: 'lt',
  sections: [
    {
      id: 'parties',
      title: 'ŠALYS',
      content: `
        Paslaugų teikėjas: {{providerName}}, įm. kodas {{providerCode}}, 
        adresas {{providerAddress}}
        
        Klientas: {{clientName}}, įm. kodas {{clientCode}}, 
        adresas {{clientAddress}}
      `,
      isLegal: true,
    },
    {
      id: 'scope',
      title: 'PASLAUGŲ APIMTIS',
      content: `{{scopeDescription}}`, // This gets translated
      isLegal: false,
    },
    // ... more sections
  ],
  variables: [
    { key: '{{clientName}}', type: 'text', translateValue: false },
    { key: '{{scopeDescription}}', type: 'text', translateValue: true },
    { key: '{{startDate}}', type: 'date', translateValue: false },
    { key: '{{monthlyFee}}', type: 'currency', translateValue: false },
  ],
};
```

## URL Structure

Using **path prefix** for SEO benefits and clear UX:

| Route | English | Lithuanian |
|-------|---------|------------|
| Dashboard | `/dashboard` | `/lt/dashboard` |
| Prospects | `/prospects` | `/lt/prospects` |
| Settings | `/settings` | `/lt/nustatymai` |

### Localized Slugs (Optional Enhancement)
```typescript
// For SEO, can use localized slugs
const LOCALIZED_PATHS: Record<string, Record<string, string>> = {
  en: {
    dashboard: 'dashboard',
    prospects: 'prospects',
    settings: 'settings',
  },
  lt: {
    dashboard: 'valdymo-skydelis',
    prospects: 'potencialus-klientai',
    settings: 'nustatymai',
  },
};
```

## Success Criteria

1. **Complete UI Translation** — All user-visible strings translated to Lithuanian
2. **Gemini Integration Works** — Dynamic content translates with <2s latency
3. **Translation Cache Hit Rate >80%** — Repeated phrases served from cache
4. **Text Fits UI** — No overflow/truncation issues in Lithuanian UI
5. **Multi-Tenant Language** — Workspace and prospect language settings work correctly
6. **Proposals in Lithuanian** — Full proposal generation with proper formality
7. **Agreements Legally Accurate** — Pre-approved templates with correct variable substitution
8. **Language Switcher Works** — Instant switching, preference persisted
9. **Emails Localized** — All transactional emails in recipient's language

## Estimated Effort

| Plan | Focus | Hours |
|------|-------|-------|
| 55-01 | i18n Framework Setup: next-intl, i18next, routing, middleware | 8-10h |
| 55-02 | Gemini Translation Service: API wrapper, caching, quality validation | 10-12h |
| 55-03 | UI String Extraction & Translation: Extract all strings, batch translate | 12-16h |
| 55-04 | Multi-Tenant Language Settings: workspace/prospect preferences, resolution | 8-10h |
| 55-05 | Dynamic Content Translation: proposals, emails, reports | 10-12h |
| 55-06 | Agreements & Legal: Lithuanian templates, variable substitution | 8-10h |
| 55-07 | Language Switcher & UX: header switcher, per-prospect override, preview | 6-8h |
| 55-08 | Text Fitting & Polish: CSS adjustments, short variants, QA | 8-10h |
| **Total** | | **70-88h** |

## Dependencies

- Phase 54 complete (payment system — invoices need translation)
- Gemini API access with sufficient quota
- Human reviewer for legal template approval
- UI/UX review for text fitting

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Gemini translation quality | Human review workflow, quality scoring, feedback loop |
| Legal accuracy | Pre-approved templates, lawyer review, no AI for legal clauses |
| Text overflow | Short variants, responsive CSS, thorough testing |
| API costs | Aggressive caching, batch translations, flash model for low-priority |
| Cache invalidation | Version tracking, manual refresh capability |
