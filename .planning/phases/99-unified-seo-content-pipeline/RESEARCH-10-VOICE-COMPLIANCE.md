# RESEARCH-10: Voice Compliance System

> Phase 99: Unified SEO Content Pipeline
> Research on existing voice profile implementation in AI-Writer/open-seo-main

---

## Executive Summary

The Voice Compliance System is a mature, cross-platform implementation spanning TypeScript (open-seo-main) and Python (AI-Writer). It provides:

- **40+ voice profile fields** stored in PostgreSQL via Drizzle ORM
- **VoiceConstraintBuilder** (TypeScript) as single source of truth for prompt injection
- **Voice extraction from content samples** via AI analysis
- **5-dimension compliance scoring** (tone, vocabulary, structure, personality, rules)
- **8-level precedence system** for voice source priority during generation

---

## 1. Voice Profile Schema (40+ Fields)

**Location:** `open-seo-main/src/db/voice-schema.ts`

### Profile Basics
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `id` | text | PK | Unique identifier |
| `clientId` | uuid | FK | Links to clients table |
| `voiceName` | text | null | Human-readable name |
| `voiceStatus` | enum | "draft" | draft/active/archived |
| `mode` | text | "best_practices" | preservation/application/best_practices |
| `industryTemplate` | text | null | Template reference |

### Tone and Personality (8 fields)
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `primaryTone` | enum | "professional" | 11 options: professional, casual, friendly, authoritative, playful, inspirational, empathetic, urgent, conversational, academic, innovative |
| `tonePrimary` | text | null | Backward compat alias |
| `toneSecondary` | text | null | Secondary tone |
| `secondaryTones` | jsonb | [] | Array of secondary tones |
| `formalityLevel` | integer | 6 | 1-10 scale (DB constraint) |
| `personalityTraits` | jsonb | [] | Array of trait strings |
| `archetype` | text | null | professional/casual/technical/friendly/authoritative |
| `emotionalRange` | text | "moderate" | Permitted emotional spectrum |

### Language Constraints (6 fields)
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `requiredPhrases` | jsonb | [] | Must include these phrases |
| `forbiddenPhrases` | jsonb | [] | Never use these phrases |
| `jargonLevel` | text | "moderate" | Technical jargon allowance |
| `industryTerms` | jsonb | [] | Domain-specific vocabulary |
| `acronymPolicy` | text | "first_use" | first_use/always_expand/assume_known |
| `contractionUsage` | text | "sometimes" | never/sometimes/frequently |

### Writing Mechanics (7 fields)
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `sentenceLengthAvg` | integer | null | Learned average |
| `paragraphLengthAvg` | integer | null | Learned average |
| `sentenceLengthTarget` | text | "varied" | Target guidance |
| `paragraphLengthTarget` | text | "short" | Target guidance |
| `listPreference` | text | "mixed" | bullet/numbered/mixed |
| `headingStyle` | text | "action" | title_case/sentence_case/all_caps |
| `ctaTemplate` | text | null | Call-to-action pattern |

### Vocabulary Patterns (2 fields)
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `vocabularyPatterns` | jsonb | null | `{ preferred: string[], avoided: string[] }` |
| `signaturePhrases` | jsonb | [] | Brand catchphrases |

### SEO Integration (4 fields)
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `keywordDensityTolerance` | integer | 3 | Target keyword density % (1-20) |
| `keywordPlacementRules` | jsonb | ["title","h1","first_paragraph","throughout"] | Required keyword positions |
| `seoVsVoicePriority` | integer | 6 | 1-10 scale (1=voice priority, 10=SEO priority) |
| `protectedSections` | jsonb | [] | Sections exempt from SEO changes |

### Voice Blending (4 fields)
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `voiceBlendEnabled` | boolean | false | Enable template blending |
| `voiceBlendWeight` | real | 0.5 | 0.0=pure client, 1.0=pure template |
| `voiceTemplateId` | text | null | Template to blend with |
| `customInstructions` | text | null | Override instructions (highest priority) |

### Metadata (6 fields)
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `confidenceScore` | integer | null | AI confidence in profile accuracy |
| `lastModifiedBy` | text | null | Audit trail |
| `analyzedAt` | timestamp | null | Last voice analysis |
| `createdAt` | timestamp | now() | Creation time |
| `updatedAt` | timestamp | now() | Last update |
| `isArchived` | boolean | false | Soft delete flag |

### Database Constraints
```sql
-- Voice blend weight 0.0-1.0
CHECK (voice_blend_weight IS NULL OR (voice_blend_weight >= 0 AND voice_blend_weight <= 1))

-- Formality level 1-10
CHECK (formality_level IS NULL OR (formality_level >= 1 AND formality_level <= 10))

-- Keyword density 1-20%
CHECK (keyword_density_tolerance IS NULL OR (keyword_density_tolerance >= 1 AND keyword_density_tolerance <= 20))

-- SEO vs voice priority 1-10
CHECK (seo_vs_voice_priority IS NULL OR (seo_vs_voice_priority >= 1 AND seo_vs_voice_priority <= 10))
```

---

## 2. VoiceConstraintBuilder

**Location:** `open-seo-main/src/server/features/voice/services/VoiceConstraintBuilder.ts`

### Three Operating Modes

1. **preservation**: Protect branded content from changes
2. **application**: Full voice profile injection (40+ fields)
3. **best_practices**: Generic SEO best practices only

### Synchronous Function
```typescript
export function buildVoiceConstraints(options: VoiceConstraintOptions): string
```
- Fast, mode-based constraint generation
- Used when protection rules not needed

### Async Class Builder
```typescript
export class VoiceConstraintBuilder {
  async build(options: VoiceConstraintOptions): Promise<string>
}
```
- Loads protection rules from database
- Required for preservation mode with active rules

### Template Blending Algorithm
- Numeric values: Linear interpolation based on blend weight
- Categorical values: Use profile if blend < 0.5, template if >= 0.5
- Arrays: Merge both, weighted by blend ratio

### Security: Prompt Injection Prevention (T-37-09)
```typescript
function escapeForPrompt(text: string): string {
  return text
    .replace(/\\/g, "\\\\")   // Escape backslashes
    .replace(/"/g, '\\"')      // Escape quotes
    .replace(/\n/g, " ")       // Replace newlines
    .replace(/\r/g, "")        // Remove carriage returns
    .replace(/</g, "&lt;")     // Escape HTML tags
    .replace(/>/g, "&gt;");
}
```

---

## 3. Voice Extraction from Samples

**Locations:**
- `open-seo-main/src/server/features/voice/services/VoiceAnalyzer.ts`
- `AI-Writer/backend/services/persona_analysis_service.py`

### Voice Analysis Pipeline

1. **Page Scraping**: Content extracted from client website
2. **AI Analysis**: Gemini analyzes writing patterns
3. **Dimension Extraction**: Tone, formality, vocabulary patterns
4. **Profile Aggregation**: Multiple pages merged into unified profile

### Extracted Dimensions
```typescript
interface ExtractedVoiceDimensions {
  tonePrimary: string;
  toneSecondary: string;
  formalityLevel: number;
  personalityTraits: string[];
  archetype: string;
  sentenceLengthAvg: number;
  paragraphLengthAvg: number;
  contractionUsage: string;
  vocabularyPatterns: { preferred: string[], avoided: string[] };
  signaturePhrases: string[];
  forbiddenPhrases: string[];
  headingStyle: string;
}
```

### Voice Analysis Storage
```typescript
// Per-page analysis results
export const voiceAnalysis = pgTable("voice_analysis", {
  profileId: text("profile_id").references(() => voiceProfiles.id),
  url: text("url").notNull(),
  rawAnalysis: jsonb("raw_analysis"),  // Full AI response
  extractedTone: text("extracted_tone"),
  extractedFormality: integer("extracted_formality"),
  sampleSentences: jsonb("sample_sentences"),
});
```

---

## 4. Compliance Scoring

**Location:** `open-seo-main/src/server/features/voice/services/VoiceComplianceService.ts`

### 5-Dimension Scoring Model

| Dimension | Weight | Method | Description |
|-----------|--------|--------|-------------|
| `tone_match` | 25% | AI (Claude) | Tone alignment assessment |
| `vocabulary_match` | 20% | Deterministic | Forbidden/preferred word check |
| `structure_match` | 15% | Deterministic | Sentence/paragraph length |
| `personality_match` | 25% | AI (Claude) | Personality trait alignment |
| `rule_compliance` | 15% | Deterministic | Protection rules check |

### Quality Gate Threshold
```typescript
passed: overall >= QUALITY_THRESHOLDS.PASS  // 80 (FIX-14 standardized)
```

### Compliance Score Interface
```typescript
interface ComplianceScore {
  tone_match: number;           // 0-100
  vocabulary_match: number;     // 0-100
  structure_match: number;      // 0-100
  personality_match: number;    // 0-100
  rule_compliance: number;      // 0-100
  overall: number;              // Weighted average 0-100
  violations: ComplianceViolation[];
  passed: boolean;              // overall >= 80
}
```

### Violation Interface
```typescript
interface ComplianceViolation {
  dimension: "tone" | "vocabulary" | "structure" | "personality" | "rules";
  severity: "high" | "medium" | "low";
  line_number?: number;
  text: string;
  suggestion: string;
}
```

### Vocabulary Scoring Algorithm
```typescript
// Start at 100
// -10 per avoided word found
// -15 per forbidden phrase found
// +2 per preferred word used (max +10)
// Clamped to 0-100
```

### Structure Scoring Algorithm
```typescript
// Sentence deviation: 100 - (|actual - target| * 5), min 50
// Paragraph deviation: 100 - (|actual - target| * 10), min 50
// Final = average of both
```

---

## 5. Enforcement During Generation

**Location:** `AI-Writer/backend/services/article_generation_service.py`

### Voice Constraint Service (Python Client)

```python
# Single source of truth: TypeScript API
class VoiceConstraintService:
    async def fetch_voice_constraints(
        self,
        client_id: str,
        template_blend: Optional[float] = None,
        template_id: Optional[str] = None,
        target_url: Optional[str] = None,
    ) -> VoiceConstraintResult
```

### API Flow
1. Fetch voice profile from TypeScript API
2. Call `/api/seo/voice/{clientId}/constraints` endpoint
3. TypeScript runs `VoiceConstraintBuilder.buildVoiceConstraints()`
4. Return formatted constraints for prompt injection

### Fallback Mechanism
If TypeScript API unavailable:
```python
def _build_fallback_constraints(self, profile: Dict[str, Any]) -> str:
    # Simplified constraint building in Python
    # Handles basic fields, warns user about reduced capability
```

---

## 6. Voice Precedence System

**Location:** `AI-Writer/backend/services/voice_precedence.py`

### 8-Level Precedence Order (lowest to highest)

| Level | Source | Priority | Description |
|-------|--------|----------|-------------|
| 1 | Extracted brand voice | Lowest | Auto-generated from website scraping |
| 2 | Voice template | Low | Industry/custom templates |
| 3 | Blend weight note | Low-Mid | Template vs client ratio |
| 4 | Voice profile constraints | Mid | 40+ fields from TypeScript |
| 5 | ICP psychology | Mid-High | Target audience characteristics |
| 6 | SEO keywords | High | Keyword integration requirements |
| 7 | Fallback brand_voice | High | Legacy plain text (if no intelligence) |
| 8 | custom_voice_instructions | Highest | Explicit user overrides |

### Precedence Validation
```python
class VoicePrecedenceValidator:
    def validate(self) -> VoicePrecedenceReport:
        self._check_conflicting_tones()
        self._check_custom_instructions_override()
        self._check_missing_voice_profile()
        self._check_blend_without_template()
```

### Conflict Detection
- Formal vs Casual tone warnings
- Custom instruction override alerts
- Missing voice profile warnings
- Blend weight without template warnings

---

## 7. Voice Audit Log

**Location:** `open-seo-main/src/db/voice-schema.ts`

### Audit Schema
```typescript
export const voiceAuditLog = pgTable("voice_audit_log", {
  voiceProfileId: text("voice_profile_id").references(() => voiceProfiles.id),
  contentId: text("content_id"),
  contentType: text("content_type"),
  contentUrl: text("content_url"),
  voiceConsistencyScore: real("voice_consistency_score"),
  toneConsistencyScore: real("tone_consistency_score"),
  vocabularyAlignmentScore: real("vocabulary_alignment_score"),
  structureComplianceScore: real("structure_compliance_score"),
  issues: jsonb("issues"),  // VoiceAuditIssue[]
  auditedAt: timestamp("audited_at"),
});
```

### Audit Issue Interface
```typescript
interface VoiceAuditIssue {
  type: string;
  severity: "critical" | "warning" | "info";
  location: string;
  expected: string;
  actual: string;
  suggestion: string;
}
```

---

## 8. Key Integration Points

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/seo/voice/{clientId}` | GET | Fetch voice profile |
| `/api/seo/voice/{clientId}/constraints` | POST | Build voice constraints |
| `/api/seo/voice/{clientId}/compliance` | POST | Score content compliance |
| `/api/seo/voice/{clientId}/analyze` | POST | Analyze content for voice |
| `/api/seo/voice/{clientId}/protection-rules` | GET/POST | Manage protection rules |

### Cross-Service Communication
```
AI-Writer (Python)
    |
    | HTTP POST /api/seo/voice/{clientId}/constraints
    v
open-seo-main (TypeScript)
    |
    | VoiceConstraintBuilder.build()
    v
Formatted prompt constraints
```

---

## 9. Phase 99 Integration Considerations

### Existing Capabilities to Leverage
1. **40+ field voice profiles** - fully implemented schema
2. **TypeScript as single source of truth** - no Python duplication
3. **5-dimension compliance scoring** - production-ready
4. **8-level precedence system** - sophisticated conflict resolution
5. **Template blending** - weighted interpolation
6. **Audit logging** - trend analysis ready

### Gaps to Address
1. **Real-time compliance feedback** - currently post-generation only
2. **Voice drift detection** - audit data not yet analyzed for trends
3. **Multi-language voice profiles** - single language only
4. **Voice versioning** - no history tracking beyond soft delete

### Recommended Phase 99 Approach
1. Reuse existing `VoiceConstraintBuilder` and `VoiceComplianceService`
2. Add streaming compliance feedback during generation
3. Implement voice drift alerts from audit log trends
4. Consider voice profile versioning for A/B testing

---

## File References

| File | Purpose |
|------|---------|
| `open-seo-main/src/db/voice-schema.ts` | Voice profile schema (40+ fields) |
| `open-seo-main/src/server/features/voice/services/VoiceConstraintBuilder.ts` | Prompt constraint builder |
| `open-seo-main/src/server/features/voice/services/VoiceComplianceService.ts` | 5-dimension scoring |
| `AI-Writer/backend/services/voice_constraint_service.py` | Python client for TypeScript API |
| `AI-Writer/backend/services/voice_precedence.py` | 8-level precedence system |
| `AI-Writer/backend/services/article_generation_service.py` | Voice enforcement during generation |
| `AI-Writer/backend/services/persona_analysis_service.py` | Voice extraction from samples |
