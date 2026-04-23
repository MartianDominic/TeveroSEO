# Phase 37: Brand Voice Management - Research

**Researched:** 2026-04-23
**Domain:** Voice learning, content protection, AI-constrained generation
**Confidence:** HIGH

## Summary

Phase 37 implements a comprehensive brand voice management system with three modes: preservation (protect brand text from SEO changes), application (write in client's learned voice), and best_practices (use industry defaults). The system learns voice from existing content via AI analysis and applies it during content generation.

**Key finding:** The foundation is already substantially implemented (approximately 20-25% complete based on existing code). The schema (`voice-schema.ts`), core services (VoiceAnalyzer, VoiceProfileService, ProtectionRulesService, VoiceConstraintBuilder, VoiceComplianceService), BullMQ queue/processor, and industry templates are already in place. What remains is:
1. Expanding the schema to match the full 40+ field design doc specification
2. Building the agency-grade UI (tabbed interface, wizard, visual protection rules editor, full preview suite)
3. Integrating voice constraints into AI-Writer article generation
4. Adding voice templates table and audit logging

**Primary recommendation:** Extend the existing voice schema and services rather than rebuilding. Focus implementation effort on the UI layer and AI-Writer integration, as backend infrastructure is largely complete.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use existing Cheerio scraper (Phase 27) + Claude AI for voice extraction - no additional API costs
- Analyze 5-10 pages per client for voice learning (homepage, about, blog posts, key pages)
- Extract core 12 dimensions: tone (primary + secondary), formality level, personality traits, archetype, sentence length, paragraph length, contraction frequency, vocabulary patterns, signature phrases, forbidden phrases, heading style
- Confidence threshold: 70% - below this, flag for manual review and adjustment
- Voice analysis runs as BullMQ background job with progress tracking
- Tabbed interface + sidebar summary for Voice Settings UI
- Full preview suite: Generate 3 sample types (headline, paragraph, CTA) with compliance scores
- Visual protection rules editor: Page rules, section CSS selectors, regex text patterns, expiration dates, bulk import from CSV
- Guided wizard for mode selection with decision tree
- Route: `/clients/[clientId]/settings/voice`
- Implement complete schema from design doc (voice_profiles, voice_analysis, content_protection_rules, voice_templates, voice_audit_log)
- Industry templates: healthcare, legal, ecommerce, B2B SaaS, financial, real estate, home services, technology
- Full audit trail: log content ID, voice scores per dimension, issues found, before/after for changes
- RESTful API with bulk operations
- Dynamic voice-constrained prompts in `_build_article_prompt()`
- Post-generation compliance audit scoring each dimension
- Pre-generation filtering for preservation mode (protected sections excluded)
- Weighted voice blending: 0.0-1.0 slider

### Claude's Discretion
- Specific component composition within shadcn/ui and Radix patterns
- Error handling and loading state implementations
- Background job retry and failure handling specifics
- Redis caching strategy for voice profiles

### Deferred Ideas (OUT OF SCOPE)
- Voice A/B testing: generate content in two voice variants, track performance
- Multi-language voice profiles (voice learning for non-English content)
- Voice collaboration: multiple team members can contribute to voice profile
- Voice version history with rollback
- Automated voice drift detection (alert when content deviates from profile)
- Voice export/import between clients (copy voice profile)
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Voice profile CRUD | API / Backend | Database | Business logic in services, persistence in PostgreSQL |
| Voice learning (AI analysis) | API / Backend | - | Claude API calls, BullMQ job processing |
| Content scraping | API / Backend | - | Uses existing DataForSEO scraper infrastructure |
| Protection rules engine | API / Backend | - | Server-side rule matching and validation |
| Voice constraint injection | API / Backend (AI-Writer) | - | Python service modifies prompts before generation |
| Compliance scoring | API / Backend (AI-Writer) | - | Post-generation AI analysis |
| Voice settings UI | Frontend Server (Next.js) | Browser | SSR for initial load, client-side interactivity |
| Preview generation | API / Backend (AI-Writer) | - | Calls AI generation with voice constraints |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 | PostgreSQL ORM | [VERIFIED: npm registry] Project standard, type-safe |
| bullmq | 5.76.1 | Background jobs | [VERIFIED: npm registry] Existing queue infrastructure |
| @anthropic-ai/sdk | 0.90.0 | Claude AI API | [VERIFIED: npm registry] Voice extraction + compliance |
| zod | 4.3.6 | Schema validation | [VERIFIED: npm registry] API input/output validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | existing | ID generation | Voice profile/analysis IDs |
| cheerio | existing | HTML parsing | Content scraping (Phase 27) |
| @tevero/ui | existing | UI components | All voice settings UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claude | Gemini | Claude better for nuanced voice analysis; Gemini cheaper but less consistent tone detection |
| BullMQ | Trigger.dev | BullMQ already integrated; Trigger.dev would require new infrastructure |

**Installation:** All dependencies already installed in the project.

## Architecture Patterns

### System Architecture Diagram

```
                    Voice Management System Flow
                    ============================

[User] ─────────────────────────────────────────────────────────────────┐
   │                                                                    │
   ▼                                                                    │
┌──────────────────────────────────────────────────────────────────────▼──┐
│                      apps/web (Next.js)                                 │
│  /clients/[clientId]/settings/voice                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Voice Settings UI                                                   ││
│  │ ┌──────────┬────────────┬───────────┬────────────┬────────────────┐││
│  │ │ Mode     │ Tone &     │ Vocabulary │ Protection │ Preview        │││
│  │ │ Wizard   │ Personality│ & Writing  │ Rules      │ Suite          │││
│  │ └──────────┴────────────┴───────────┴────────────┴────────────────┘││
│  │                                                                     ││
│  │ ┌─────────────────────────────────────────────────────────────────┐││
│  │ │ Sidebar: Voice Profile Summary + "Learn Voice" Button           │││
│  │ └─────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                    │ Server Actions
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      open-seo-main (API)                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Voice API Routes                                                 │   │
│  │ GET/POST/PUT /api/clients/:id/voice-profile                      │   │
│  │ POST /api/clients/:id/voice-profile/analyze                      │   │
│  │ GET/POST/PUT/DELETE /api/clients/:id/voice-profile/protection    │   │
│  │ POST /api/clients/:id/voice-profile/preview                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                    │                                                    │
│  ┌─────────────────▼───────────────────────────────────────────────┐   │
│  │ Voice Services                                                   │   │
│  │ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ │   │
│  │ │VoiceProfileSvc  │ │ProtectionRulesSvc│ │VoiceComplianceSvc  │ │   │
│  │ └────────┬────────┘ └────────┬────────┘ └────────┬────────────┘ │   │
│  │          │                   │                   │               │   │
│  │          └───────────────────┼───────────────────┘               │   │
│  │                              ▼                                   │   │
│  │              ┌────────────────────────────────┐                  │   │
│  │              │ VoiceConstraintBuilder         │                  │   │
│  │              │ (builds AI prompt constraints) │                  │   │
│  │              └────────────────────────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                    │                                                    │
│  ┌─────────────────▼───────────────────────────────────────────────┐   │
│  │ BullMQ Queue: voice-analysis                                     │   │
│  │ ┌─────────────────────────────────────────────────────────────┐ │   │
│  │ │ Job: {clientId, profileId, urls[]}                          │ │   │
│  │ │ Progress: {completedUrls, totalUrls}                        │ │   │
│  │ └─────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                    │                                                    │
│  ┌─────────────────▼───────────────────────────────────────────────┐   │
│  │ Voice Analysis Processor (Sandboxed Worker)                      │   │
│  │ 1. Scrape page (DataForSEO)                                      │   │
│  │ 2. Extract text content                                          │   │
│  │ 3. Call Claude for voice analysis ─────────────────────────┐     │   │
│  │ 4. Save per-page analysis                                   │     │   │
│  │ 5. Aggregate results → update profile                       │     │   │
│  └─────────────────────────────────────────────────────────────│─────┘  │
└─────────────────────────────────────────────────────────────────│────────┘
                                                                  │
                    ┌─────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Claude API                                         │
│  - Voice extraction (12 dimensions)                                     │
│  - Compliance scoring (post-generation)                                 │
└─────────────────────────────────────────────────────────────────────────┘

                    ▼ Voice constraints passed to AI-Writer
┌─────────────────────────────────────────────────────────────────────────┐
│                      AI-Writer (FastAPI)                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ article_generation_service.py                                    │   │
│  │ _build_article_prompt() ← Voice constraints injected here        │   │
│  │                                                                  │   │
│  │ Mode: preservation → exclude protected sections                  │   │
│  │ Mode: application → full 12-dimension constraints                │   │
│  │ Mode: best_practices → generic SEO guidelines                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                    │                                                    │
│  ┌─────────────────▼───────────────────────────────────────────────┐   │
│  │ Post-Generation Compliance Audit                                 │   │
│  │ Score: tone, vocabulary, structure, personality                  │   │
│  │ → voice_audit_log table                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PostgreSQL                                         │
│  voice_profiles │ voice_analysis │ content_protection_rules            │
│  voice_templates │ voice_audit_log                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
open-seo-main/src/
├── db/
│   └── voice-schema.ts           # ✓ EXISTS - needs expansion for templates + audit log
├── server/
│   ├── features/voice/
│   │   ├── index.ts              # ✓ EXISTS
│   │   ├── types.ts              # ✓ EXISTS
│   │   ├── services/
│   │   │   ├── VoiceAnalyzer.ts          # ✓ EXISTS
│   │   │   ├── VoiceProfileService.ts    # ✓ EXISTS
│   │   │   ├── ProtectionRulesService.ts # ✓ EXISTS
│   │   │   ├── VoiceConstraintBuilder.ts # ✓ EXISTS
│   │   │   ├── VoiceComplianceService.ts # ✓ EXISTS
│   │   │   └── VoiceTemplateService.ts   # NEW NEEDED
│   │   └── templates/
│   │       └── industryTemplates.ts      # ✓ EXISTS
│   ├── queues/
│   │   └── voiceAnalysisQueue.ts # ✓ EXISTS
│   └── workers/
│       └── voice-analysis-processor.ts # ✓ EXISTS

apps/web/src/
├── app/(shell)/clients/[clientId]/settings/
│   └── voice/                    # NEW NEEDED
│       ├── page.tsx              # Main voice settings page
│       └── components/
│           ├── VoiceModeWizard.tsx
│           ├── TonePersonalityTab.tsx
│           ├── VocabularyTab.tsx
│           ├── WritingMechanicsTab.tsx
│           ├── ProtectionRulesTab.tsx
│           ├── VoicePreviewPanel.tsx
│           └── VoiceSidebarSummary.tsx
├── actions/
│   └── voice.ts                  # NEW NEEDED - server actions
└── lib/
    └── voiceApi.ts               # NEW NEEDED - API client

AI-Writer/backend/
├── services/
│   └── article_generation_service.py  # ✓ EXISTS - needs voice integration
└── api/
    └── voice_preview.py               # NEW NEEDED - preview endpoints
```

### Pattern 1: Voice Profile CRUD with Service Layer
**What:** Repository pattern for voice profile operations
**When to use:** All database operations for voice profiles
**Example:**
```typescript
// Source: Existing VoiceProfileService.ts pattern
export const voiceProfileService = {
  async getByClientId(clientId: string): Promise<VoiceProfileSelect | null> {
    const [profile] = await db
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.clientId, clientId))
      .limit(1);
    return profile ?? null;
  },

  async upsert(clientId: string, data: Partial<VoiceProfileInsert>): Promise<VoiceProfileSelect> {
    // ... upsert logic with conflict handling
  },
};
```

### Pattern 2: BullMQ Job with Progress Tracking
**What:** Resumable background job with checkpointing
**When to use:** Voice analysis (5-10 pages, Claude API calls)
**Example:**
```typescript
// Source: Existing voice-analysis-processor.ts
export default async function processVoiceAnalysisJob(
  job: Job<VoiceAnalysisJobData>,
): Promise<void> {
  const startIdx = job.data.progress?.completedUrls ?? 0;
  
  for (let i = startIdx; i < urls.length; i++) {
    // Process page
    await job.updateData({
      ...job.data,
      progress: { completedUrls: i + 1, totalUrls: urls.length },
    });
    await job.updateProgress(((i + 1) / urls.length) * 100);
  }
}
```

### Pattern 3: Voice Constraint Injection
**What:** Build prompt sections from voice profile
**When to use:** Before any AI content generation
**Example:**
```typescript
// Source: Existing VoiceConstraintBuilder.ts
export function buildVoiceConstraints(options: VoiceConstraintOptions): string {
  const { profile, templateBlend = 0, templateId } = options;

  if (profile.mode === "best_practices") {
    return buildBestPracticesConstraints();
  }

  if (profile.mode === "preservation") {
    return buildBasicPreservationConstraints(profile);
  }

  // Application mode: full voice constraints
  return buildApplicationConstraints(profile, templateBlend, templateId);
}
```

### Anti-Patterns to Avoid
- **Direct DB access in route handlers:** Always use service layer
- **Synchronous AI calls in request cycle:** Always use BullMQ for voice analysis
- **Storing full scraped content in DB:** Store only extracted dimensions and metadata (T-37-04)
- **Unbounded URL lists:** Enforce 5-10 page limit for voice analysis
- **Prompt injection via user phrases:** Always escape special characters (T-37-09)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue | Custom worker | BullMQ | [VERIFIED: codebase] Already integrated, retries/progress built-in |
| AI API | Raw HTTP | @anthropic-ai/sdk | [VERIFIED: npm] Type-safe, error handling, rate limiting |
| Schema validation | Manual checks | Zod | [VERIFIED: codebase] Consistent with project patterns |
| Form state | useState spaghetti | React Hook Form | [ASSUMED] Standard for complex forms |
| Rate limiting | DIY counter | BullMQ job deduplication | [VERIFIED: voiceAnalysisQueue.ts] Already implemented |

**Key insight:** The voice infrastructure is already built. Focus on composition not construction.

## Common Pitfalls

### Pitfall 1: Overwriting Existing Implementation
**What goes wrong:** Creating new files that duplicate existing services
**Why it happens:** Not checking for existing voice-schema.ts and service files
**How to avoid:** Run `find . -name "*voice*"` before creating new files
**Warning signs:** Import errors, duplicate type definitions

### Pitfall 2: Blocking UI on Voice Analysis
**What goes wrong:** UI waits for 5-10 page analysis to complete
**Why it happens:** Not using background job properly
**How to avoid:** Return job ID immediately, poll for progress
**Warning signs:** Page timeout, frozen UI during "Learn Voice" click

### Pitfall 3: Prompt Injection via User Phrases
**What goes wrong:** Malicious signature/forbidden phrases alter AI behavior
**Why it happens:** Passing user input directly to prompts
**How to avoid:** Use escapeForPrompt() helper (already exists in VoiceConstraintBuilder)
**Warning signs:** Strange AI output, instruction leakage in generated content

### Pitfall 4: Voice Analysis Rate Limiting
**What goes wrong:** Multiple concurrent analyses for same client
**Why it happens:** User clicking "Learn Voice" multiple times
**How to avoid:** Check for existing active job before queueing (already in voiceAnalysisQueue.ts)
**Warning signs:** Duplicate Claude API charges, inconsistent profile updates

### Pitfall 5: Schema Migration Conflicts
**What goes wrong:** Expanding voice_profiles table breaks existing data
**Why it happens:** Adding NOT NULL columns without defaults
**How to avoid:** All new columns MUST have defaults or be nullable
**Warning signs:** Migration errors, NULL constraint violations

## Code Examples

### Voice Profile Schema Extension (from design doc)
```typescript
// Source: Design doc brand-voice-management-system.md Section 6.1
// Note: Extends existing voice-schema.ts

// Add to voice_profiles table
primaryTone: primaryToneEnum("primary_tone").notNull().default("professional"),
secondaryTones: jsonb("secondary_tones").$type<string[]>().default([]),
emotionalRange: text("emotional_range").default("moderate"),
jargonLevel: text("jargon_level").default("moderate"),
industryTerms: jsonb("industry_terms").$type<string[]>().default([]),
acronymPolicy: text("acronym_policy").default("first_use"),
ctaTemplate: text("cta_template"),
keywordDensityTolerance: integer("keyword_density_tolerance").default(3),
keywordPlacementRules: jsonb("keyword_placement_rules").$type<string[]>()
  .default(["title", "h1", "first_paragraph", "throughout"]),
seoVsVoicePriority: integer("seo_vs_voice_priority").default(6),
voiceBlendEnabled: boolean("voice_blend_enabled").default(false),
voiceBlendWeight: real("voice_blend_weight").default(0.5),
voiceTemplateId: text("voice_template_id"),
customInstructions: text("custom_instructions"),
```

### Voice Templates Table (NEW)
```typescript
// Source: Design doc Section 6.1
export const voiceTemplates = pgTable(
  "voice_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    industry: text("industry"),
    isSystem: boolean("is_system").notNull().default(false),
    templateConfig: jsonb("template_config").$type<Partial<VoiceProfile>>().notNull(),
    usageCount: integer("usage_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("idx_voice_templates_industry").on(table.industry),
  ],
);
```

### Voice Audit Log Table (NEW)
```typescript
// Source: Design doc Section 6.1
export const voiceAuditLog = pgTable(
  "voice_audit_log",
  {
    id: text("id").primaryKey(),
    voiceProfileId: text("voice_profile_id").notNull()
      .references(() => voiceProfiles.id, { onDelete: "cascade" }),
    contentId: text("content_id"),
    contentType: text("content_type"),     // "article" | "page" | "meta"
    contentUrl: text("content_url"),
    voiceConsistencyScore: real("voice_consistency_score"),
    toneConsistencyScore: real("tone_consistency_score"),
    vocabularyAlignmentScore: real("vocabulary_alignment_score"),
    structureComplianceScore: real("structure_compliance_score"),
    issues: jsonb("issues").$type<{
      type: string;
      severity: string;
      location: string;
      expected: string;
      actual: string;
      suggestion: string;
    }[]>().default([]),
    auditedAt: timestamp("audited_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_voice_audit_profile").on(table.voiceProfileId),
    index("idx_voice_audit_content").on(table.contentId),
  ],
);
```

### AI-Writer Voice Integration (Python)
```python
# Source: Design doc Section 4.2 + existing article_generation_service.py
# Add to _build_article_prompt() after existing intelligence injection

# NEW: Fetch voice profile from open-seo API
voice_profile = fetch_voice_profile(client_id)

if voice_profile and voice_profile.get("mode") == "application":
    system_parts.append(f"""
## Voice & Tone Requirements

### Primary Tone
{voice_profile.get("tone_primary", "professional")}

### Formality Level
{voice_profile.get("formality_level", 5)}/10

### Vocabulary Guidelines
Preferred: {", ".join(voice_profile.get("vocabulary_patterns", {}).get("preferred", []))}
FORBIDDEN: {", ".join(voice_profile.get("forbidden_phrases", []))}

### Writing Style
- Sentence length: ~{voice_profile.get("sentence_length_avg", 15)} words
- Contractions: {voice_profile.get("contraction_usage", "sometimes")}
""")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single brand_voice text field | 40+ dimension voice profile | Phase 37 | Rich, multi-dimensional voice control |
| Manual style instructions | AI voice learning | Phase 37 | Automated voice extraction from content |
| No protection mechanism | Preservation mode + rules | Phase 37 | Clients can protect brand text from SEO |
| Generic prompts | Mode-specific constraint injection | Phase 37 | Three distinct generation strategies |

**Deprecated/outdated:**
- `client_settings.brand_voice` text field: Being superseded by voice_profiles table (maintain backwards compatibility)
- `client_settings.voice_template_id`: Move to voice_profiles.voiceTemplateId for consistency

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | React Hook Form is standard for complex forms | Don't Hand-Roll | Minor - can use useState if preferred |
| A2 | CSV import uses papaparse | CONTEXT.md decisions | Low - library choice is flexible |

**If this table is empty:** Most claims verified via codebase inspection. Voice infrastructure extensively documented in existing code.

## Open Questions

1. **Migration strategy for existing brand_voice field**
   - What we know: Some clients have data in client_settings.brand_voice
   - What's unclear: Should we auto-migrate to voice_profiles or maintain parallel support?
   - Recommendation: Maintain backwards compatibility - if voice_profiles.mode is null, fall back to brand_voice text

2. **Voice preview API location**
   - What we know: Need preview endpoint for testing voice before saving
   - What's unclear: Should this be in open-seo (closer to profile) or AI-Writer (closer to generation)?
   - Recommendation: AI-Writer - preview requires actual AI generation, not just constraint building

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (open-seo), Pytest (AI-Writer) |
| Config file | `vitest.config.ts` / `pytest.ini` |
| Quick run command | `pnpm test:unit -- --filter voice` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| voice_profiles schema | 12+ dimensions stored | unit | `pnpm test -- voice-schema` | Partial (current has 12 fields) |
| voice_analysis table | AI results persisted | unit | `pnpm test -- voice-analysis` | YES |
| Voice learning | 5-10 pages analyzed | integration | Manual - requires Claude API | NO - needs mock |
| Preservation mode | Protected content excluded | unit | `pnpm test -- VoiceConstraintBuilder` | YES |
| Application mode | Constraints injected | unit | `pnpm test -- VoiceConstraintBuilder` | YES |
| Best practices mode | Default SEO voice | unit | `pnpm test -- VoiceConstraintBuilder` | YES |
| Voice settings UI | Tabs + wizard render | e2e | Manual | NO - UI not built |
| Preview generation | Sample content generated | integration | Manual - requires AI | NO |

### Sampling Rate
- **Per task commit:** `pnpm test -- --filter voice`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/voice-schema.test.ts` - covers expanded schema fields
- [ ] `tests/voice-audit-log.test.ts` - covers audit logging
- [ ] AI-Writer Python tests for voice integration

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A - uses existing Clerk auth |
| V3 Session Management | No | N/A - uses existing session |
| V4 Access Control | Yes | Client ID scoping (existing pattern) |
| V5 Input Validation | Yes | Zod schemas for all API inputs |
| V6 Cryptography | No | No secrets stored in voice data |

### Known Threat Patterns for Voice System

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via phrases | Tampering | escapeForPrompt() in VoiceConstraintBuilder |
| Cross-client voice access | Information Disclosure | clientId scoping in all queries |
| DoS via large URL lists | Denial of Service | 10-page limit, rate limiting per client |
| Scraping unauthorized URLs | Information Disclosure | Validate URLs belong to client domain |

## Sources

### Primary (HIGH confidence)
- [Codebase] `open-seo-main/src/db/voice-schema.ts` - existing 12-field schema
- [Codebase] `open-seo-main/src/server/features/voice/` - complete service layer
- [Codebase] `open-seo-main/src/server/queues/voiceAnalysisQueue.ts` - BullMQ integration
- [Context7] /drizzle-team/drizzle-orm-docs - pgTable, pgEnum, jsonb patterns
- [Design Doc] `.planning/design/brand-voice-management-system.md` - full specification

### Secondary (MEDIUM confidence)
- [npm registry] drizzle-orm@0.45.2, bullmq@5.76.1, zod@4.3.6 - verified current versions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, verified versions
- Architecture: HIGH - extensive existing implementation to extend
- Pitfalls: HIGH - drawn from existing code patterns and security considerations

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days - stable domain)
