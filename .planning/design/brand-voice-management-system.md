# Brand Voice Management System

**Design Document v1.0**
**Date:** 2026-04-22

---

## Executive Summary

A comprehensive brand voice management system for an SEO agency platform that handles three distinct client scenarios:
1. **Preservation Mode** - Clients with established brand voice that must be protected
2. **Application Mode** - Clients who need SEO content written in their learned voice
3. **Best Practices Mode** - Small businesses without an established voice

The system learns, stores, applies, and optionally protects brand voice across all content operations.

---

## 1. Brand Voice Settings

### 1.1 Settings Exposed to Users

```
Voice Profile Configuration
├── Profile Basics
│   ├── voice_name: string              # "Acme Corp Professional Voice"
│   ├── voice_mode: enum                # preservation | application | best_practices
│   └── voice_status: enum              # draft | active | archived
│
├── Tone & Personality
│   ├── primary_tone: enum              # professional | casual | friendly | authoritative | playful | inspirational
│   ├── secondary_tones: enum[]         # up to 3 complementary tones
│   ├── formality_level: 1-10           # 1=very casual, 10=highly formal
│   ├── personality_traits: string[]    # "witty", "empathetic", "direct", "storyteller"
│   └── emotional_range: enum           # reserved | moderate | expressive
│
├── Language Constraints
│   ├── required_phrases: string[]      # "Your trusted partner", "Excellence delivered"
│   ├── forbidden_phrases: string[]     # "cheap", "honestly", competitor names
│   ├── jargon_level: enum              # none | light | moderate | heavy
│   ├── industry_terms: string[]        # specific terminology to use
│   ├── acronym_policy: enum            # always_expand | first_use | assume_known
│   └── contraction_style: enum         # always | sometimes | never
│
├── Writing Mechanics
│   ├── sentence_length_target: enum    # short | medium | long | varied
│   ├── paragraph_length_target: enum   # short | medium | long
│   ├── list_preference: enum           # bullets | numbers | prose | mixed
│   ├── heading_style: enum             # question | statement | action
│   └── cta_style: string               # template for calls-to-action
│
├── SEO Integration
│   ├── keyword_density_tolerance: 1-5  # how aggressively to inject keywords
│   ├── keyword_placement_rules: enum[] # title | h1 | first_paragraph | throughout | natural_only
│   ├── seo_vs_voice_priority: 1-10     # 1=voice always wins, 10=SEO always wins
│   └── protected_sections: string[]    # section types that never get SEO optimization
│
└── Advanced
    ├── voice_blend_enabled: boolean    # allow blending with templates
    ├── voice_blend_weight: 0.0-1.0     # weight toward client voice
    ├── voice_template_id: uuid | null  # base template to blend with
    └── custom_instructions: text       # free-form additional guidance
```

### 1.2 Voice Capture Methods

**Method 1: Manual Configuration**
- User fills out settings form directly
- Best for: agencies with existing style guides

**Method 2: AI Analysis (Recommended)**
- System scrapes client website/content
- AI extracts voice characteristics
- User reviews and adjusts
- Best for: clients with existing content but no documented voice

**Method 3: Template Selection**
- Choose from industry-specific templates
- Customize as needed
- Best for: small businesses starting fresh

**Method 4: Hybrid**
- AI analyzes existing content
- Results populate form
- User adjusts and adds constraints
- Most common workflow

---

## 2. Voice Learning System

### 2.1 Content Analysis Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VOICE LEARNING PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Content    │───▶│  Extraction  │───▶│   Analysis   │              │
│  │   Sources    │    │   Engine     │    │   Engine     │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│        │                    │                    │                      │
│        │                    │                    ▼                      │
│        │                    │           ┌──────────────┐               │
│        │                    │           │    Voice     │               │
│        │                    │           │   Profile    │               │
│        │                    │           └──────────────┘               │
│        │                    │                    │                      │
│        ▼                    ▼                    ▼                      │
│  • Website pages      • Clean HTML         • Tone scoring             │
│  • Blog posts         • Body text          • Formality analysis       │
│  • Social media       • Remove noise       • Sentence patterns        │
│  • Existing docs      • Merge sources      • Vocabulary extraction    │
│  • Style guides                            • Rhetorical devices       │
│                                            • Personality inference    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Extracted Voice Dimensions

```typescript
interface ExtractedVoiceProfile {
  // Quantitative Metrics
  metrics: {
    avg_sentence_length: number;           // words per sentence
    avg_paragraph_length: number;          // sentences per paragraph
    avg_word_length: number;               // characters per word
    active_voice_ratio: number;            // 0.0-1.0
    contraction_frequency: number;         // per 100 words
    question_frequency: number;            // per 1000 words
    exclamation_frequency: number;         // per 1000 words
    list_frequency: number;                // per 1000 words
    readability_score: number;             // Flesch-Kincaid
    vocabulary_diversity: number;          // type-token ratio
  };

  // Qualitative Analysis
  tone: {
    primary: string;                       // detected primary tone
    secondary: string[];                   // complementary tones
    confidence: number;                    // 0.0-1.0
  };

  formality: {
    level: number;                         // 1-10 scale
    indicators: string[];                  // what drove the score
  };

  personality: {
    traits: string[];                      // e.g., ["direct", "empathetic", "expert"]
    archetype: string;                     // e.g., "The Trusted Advisor"
    confidence: number;
  };

  // Vocabulary Analysis
  vocabulary: {
    signature_phrases: string[];           // frequently used multi-word phrases
    go_to_words: string[];                 // high-frequency content words
    power_words: string[];                 // persuasive/emotional words used
    technical_terms: string[];             // industry-specific terminology
    avoided_patterns: string[];            // notably absent common phrases
  };

  // Structural Patterns
  structure: {
    opening_patterns: string[];            // how content typically starts
    closing_patterns: string[];            // how content typically ends
    transition_style: string;              // how sections connect
    heading_style: string;                 // question vs statement vs action
  };

  // Rhetorical Devices
  rhetoric: {
    uses_metaphors: boolean;
    metaphor_themes: string[];             // common metaphor domains
    uses_analogies: boolean;
    analogy_style: string;                 // technical | everyday | pop-culture
    storytelling_frequency: string;        // never | sometimes | often | always
    rhetorical_questions: string;          // frequency assessment
    persuasion_techniques: string[];       // e.g., ["social proof", "authority", "scarcity"]
  };

  // Source Attribution
  sources: {
    url: string;
    word_count: number;
    analyzed_at: string;
  }[];

  // Metadata
  analysis_version: string;
  confidence_score: number;                // overall confidence in profile
  sample_size: number;                     // total words analyzed
  analyzed_at: string;
}
```

### 2.3 AI Analysis Prompt Template

```markdown
VOICE ANALYSIS TASK

You are a linguistic analyst specializing in brand voice extraction. Analyze the following content samples and extract a comprehensive voice profile.

=== CONTENT SAMPLES ===
{content_samples}

=== ANALYSIS REQUIREMENTS ===

1. QUANTITATIVE METRICS
   - Calculate average sentence length (words)
   - Calculate average paragraph length (sentences)
   - Measure active vs passive voice ratio
   - Count contractions per 100 words
   - Assess readability (Flesch-Kincaid grade level)

2. TONE ANALYSIS
   - Identify the PRIMARY tone from: professional, casual, friendly, authoritative, playful, inspirational, empathetic, urgent, conversational, academic
   - Identify up to 3 SECONDARY tones that complement the primary
   - Rate your confidence in this assessment (0.0-1.0)

3. FORMALITY ASSESSMENT
   - Rate formality on 1-10 scale (1=very casual, 10=highly formal)
   - List specific indicators that drove your rating

4. PERSONALITY INFERENCE
   - Extract 3-5 personality traits evident in the writing
   - Assign an archetype (e.g., "The Expert", "The Friend", "The Challenger")

5. VOCABULARY EXTRACTION
   - List 5-10 signature phrases unique to this voice
   - List 10-15 frequently used content words
   - List any technical/industry terms used
   - Note any notably avoided common phrases

6. STRUCTURAL PATTERNS
   - Describe how content typically opens
   - Describe how content typically closes
   - Describe transition style between sections
   - Describe heading style preference

7. RHETORICAL DEVICES
   - Does this voice use metaphors? What themes?
   - Does this voice use analogies? What style?
   - How often does storytelling appear?
   - What persuasion techniques are evident?

=== OUTPUT FORMAT ===
Respond with a JSON object matching the ExtractedVoiceProfile interface.
```

---

## 3. Voice Preservation Mode

### 3.1 Protected Content Tagging System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTENT PROTECTION LAYERS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Layer 1: Page-Level Protection                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  page_protection_level: enum                                      │  │
│  │    • full_protection     - No SEO modifications allowed           │  │
│  │    • partial_protection  - Only meta/technical SEO allowed        │  │
│  │    • seo_optimizable     - Full SEO optimization permitted        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Layer 2: Section-Level Tagging                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  <!-- voice:protected -->                                         │  │
│  │  <section class="brand-hero">                                     │  │
│  │    Our mission is to transform...  ← NEVER modify                 │  │
│  │  </section>                                                       │  │
│  │  <!-- /voice:protected -->                                        │  │
│  │                                                                    │  │
│  │  <!-- voice:optimizable keywords="seo software, rankings" -->     │  │
│  │  <section class="features">                                       │  │
│  │    Feature descriptions...        ← Can inject keywords           │  │
│  │  </section>                                                       │  │
│  │  <!-- /voice:optimizable -->                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Layer 3: Element-Level Rules                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  protected_elements:                                              │  │
│  │    - taglines              # Never modify                         │  │
│  │    - testimonial_quotes    # Never modify                         │  │
│  │    - legal_disclaimers     # Never modify                         │  │
│  │    - brand_stories         # Never modify                         │  │
│  │                                                                    │  │
│  │  optimizable_elements:                                            │  │
│  │    - meta_title            # Always optimize                      │  │
│  │    - meta_description      # Always optimize                      │  │
│  │    - alt_text              # Always optimize                      │  │
│  │    - body_copy             # Optimize if not protected            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Detection Heuristics for Brand Text

The system auto-detects "brand text" vs "SEO-optimizable text" using these signals:

```typescript
interface BrandTextDetector {
  // High confidence brand text indicators
  high_confidence_indicators: {
    contains_trademark: boolean;           // "AcmeCorp(R)"
    contains_registered_tagline: boolean;  // matches known taglines
    in_hero_section: boolean;              // position-based
    in_about_us: boolean;                  // page type
    is_testimonial: boolean;               // quote patterns
    is_mission_statement: boolean;         // semantic analysis
    is_value_proposition: boolean;         // structural patterns
  };

  // Medium confidence indicators
  medium_confidence_indicators: {
    highly_stylized: boolean;              // unusual capitalization, punctuation
    contains_brand_name: boolean;          // company name prominent
    emotionally_charged: boolean;          // sentiment analysis
    first_person_plural: boolean;          // "We believe...", "Our mission..."
  };

  // Low confidence (supplementary)
  low_confidence_indicators: {
    short_punchy_text: boolean;            // < 20 words
    prominent_position: boolean;           // above fold
    large_font_size: boolean;              // based on CSS
  };

  // Scoring
  calculate_protection_score(): number;    // 0-100
  recommendation: 'protect' | 'review' | 'optimizable';
}
```

### 3.3 Override Settings

```typescript
interface PreservationOverrides {
  // Global overrides
  always_protect_patterns: RegExp[];       // e.g., /Our (mission|vision|values)/i
  always_optimize_patterns: RegExp[];      // e.g., /Learn more about.*/i
  
  // Per-page overrides
  page_overrides: {
    url_pattern: string;                   // regex or glob
    protection_level: 'full' | 'partial' | 'none';
    override_reason: string;
  }[];

  // Per-section overrides (stored in CMS metadata)
  section_overrides: {
    section_id: string;
    protection_level: 'full' | 'partial' | 'none';
    override_reason: string;
    expires_at?: string;                   // optional expiration
  }[];

  // Emergency override
  agency_override_enabled: boolean;        // agency can override all
  agency_override_reason: string;
}
```

---

## 4. Voice Application Mode

### 4.1 Keyword Injection Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    KEYWORD INJECTION PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 1: Identify Injection Opportunities                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  • Natural pause points in sentences                              │  │
│  │  • Topic sentence positions                                       │  │
│  │  • Heading/subheading locations                                   │  │
│  │  • Definition or explanation contexts                             │  │
│  │  • List items                                                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Step 2: Voice-Compatible Phrasing                                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Original (neutral):                                              │  │
│  │    "Our software helps with SEO"                                  │  │
│  │                                                                    │  │
│  │  Voice-adapted (professional, authoritative):                     │  │
│  │    "Our enterprise SEO platform delivers measurable results"      │  │
│  │                                                                    │  │
│  │  Voice-adapted (casual, friendly):                                │  │
│  │    "Our SEO tools make ranking way easier than you'd think"       │  │
│  │                                                                    │  │
│  │  Voice-adapted (direct, expert):                                  │  │
│  │    "The platform handles technical SEO. Period."                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Step 3: Density Control                                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  tolerance_level │ target_density │ max_per_section              │  │
│  │  ───────────────┼────────────────┼────────────────               │  │
│  │        1        │     0.5%       │       1                        │  │
│  │        2        │     1.0%       │       2                        │  │
│  │        3        │     1.5%       │       3                        │  │
│  │        4        │     2.0%       │       4                        │  │
│  │        5        │     2.5%       │       5                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Style Transfer Prompt Template

```markdown
SEO CONTENT GENERATION WITH VOICE APPLICATION

=== VOICE PROFILE ===
{voice_profile_json}

=== TARGET KEYWORDS ===
Primary: {primary_keyword}
Secondary: {secondary_keywords}
LSI Terms: {lsi_terms}

=== CONTENT REQUIREMENTS ===
Topic: {topic}
Word Count: {target_word_count}
Content Type: {content_type}

=== VOICE APPLICATION RULES ===

1. TONE MATCHING
   - Write in {primary_tone} tone with {secondary_tones} undertones
   - Formality level: {formality_level}/10
   - Emotional range: {emotional_range}

2. VOCABULARY CONSTRAINTS
   - USE these signature phrases where natural: {signature_phrases}
   - USE these power words: {power_words}
   - AVOID these phrases: {forbidden_phrases}
   - Technical terminology level: {jargon_level}

3. STRUCTURAL REQUIREMENTS
   - Average sentence length: {target_sentence_length} words
   - Paragraph style: {paragraph_style}
   - Opening pattern: {opening_pattern}
   - Use {list_preference} for lists

4. KEYWORD INTEGRATION
   - Primary keyword in: title, H1, first paragraph, 2x in body
   - Secondary keywords: 1x each, naturally placed
   - Keyword density target: {density_target}%
   - Never force keywords - if it sounds unnatural, skip it

5. RHETORICAL DEVICES
   - Metaphor usage: {metaphor_preference}
   - Storytelling: {storytelling_frequency}
   - Persuasion techniques: {persuasion_techniques}

=== OUTPUT ===
Generate the content following all constraints. After generation, provide a compliance report showing:
- Voice consistency score (1-10)
- Keyword density achieved
- Any constraints that couldn't be met and why
```

### 4.3 Before/After Comparison

```typescript
interface VoiceComparisonReport {
  original_content: string;
  optimized_content: string;
  
  // Changes summary
  changes: {
    type: 'keyword_added' | 'phrasing_adjusted' | 'structure_modified' | 'section_added';
    location: string;                      // line number or section name
    before: string;
    after: string;
    reason: string;
  }[];

  // Voice consistency metrics
  voice_metrics: {
    tone_consistency: number;              // 0-100
    vocabulary_alignment: number;          // 0-100
    structure_compliance: number;          // 0-100
    overall_voice_score: number;           // 0-100
  };

  // SEO metrics
  seo_metrics: {
    keyword_density_before: number;
    keyword_density_after: number;
    keywords_added: string[];
    placement_compliance: boolean;
  };

  // Warnings
  warnings: {
    message: string;
    severity: 'info' | 'warning' | 'critical';
    suggestion?: string;
  }[];
}
```

---

## 5. Default Best Practices Mode

### 5.1 Tevero Agency Default Voice

```typescript
const TEVERO_DEFAULT_VOICE: VoiceProfile = {
  voice_name: "Tevero Professional Default",
  voice_mode: "best_practices",
  
  tone: {
    primary: "professional",
    secondary: ["friendly", "authoritative"],
    formality_level: 6,
  },
  
  personality: {
    traits: ["knowledgeable", "helpful", "results-focused", "trustworthy"],
    archetype: "The Trusted Expert",
  },
  
  vocabulary: {
    required_phrases: [],
    forbidden_phrases: [
      "honestly",
      "actually", 
      "very unique",
      "in order to",
      "utilize" // use "use" instead
    ],
    jargon_level: "moderate",
    contraction_style: "sometimes",
  },
  
  writing_mechanics: {
    sentence_length_target: "varied",
    paragraph_length_target: "short",
    list_preference: "mixed",
    heading_style: "action",
  },
  
  seo_integration: {
    keyword_density_tolerance: 3,
    keyword_placement_rules: ["title", "h1", "first_paragraph", "throughout"],
    seo_vs_voice_priority: 6,
  },
};
```

### 5.2 Industry-Specific Templates

```typescript
const INDUSTRY_TEMPLATES: Record<string, Partial<VoiceProfile>> = {
  // Healthcare / Medical
  "healthcare": {
    tone: {
      primary: "empathetic",
      secondary: ["authoritative", "reassuring"],
      formality_level: 7,
    },
    vocabulary: {
      forbidden_phrases: ["guarantee", "cure", "100%", "miracle"],
      jargon_level: "light", // explain medical terms
    },
  },

  // Legal Services
  "legal": {
    tone: {
      primary: "authoritative",
      secondary: ["professional", "precise"],
      formality_level: 8,
    },
    vocabulary: {
      required_phrases: ["consult with an attorney", "individual circumstances"],
      forbidden_phrases: ["guaranteed outcome", "always wins"],
      jargon_level: "moderate",
    },
  },

  // E-commerce / Retail
  "ecommerce": {
    tone: {
      primary: "friendly",
      secondary: ["enthusiastic", "helpful"],
      formality_level: 4,
    },
    vocabulary: {
      jargon_level: "none",
      contraction_style: "always",
    },
    writing_mechanics: {
      sentence_length_target: "short",
      list_preference: "bullets",
    },
  },

  // B2B SaaS
  "b2b_saas": {
    tone: {
      primary: "professional",
      secondary: ["innovative", "results-focused"],
      formality_level: 6,
    },
    vocabulary: {
      jargon_level: "moderate",
    },
    writing_mechanics: {
      heading_style: "action",
    },
  },

  // Financial Services
  "financial": {
    tone: {
      primary: "authoritative",
      secondary: ["trustworthy", "precise"],
      formality_level: 8,
    },
    vocabulary: {
      forbidden_phrases: ["guaranteed returns", "risk-free", "get rich"],
      jargon_level: "moderate",
    },
  },

  // Real Estate
  "real_estate": {
    tone: {
      primary: "friendly",
      secondary: ["professional", "local-expert"],
      formality_level: 5,
    },
    vocabulary: {
      jargon_level: "light",
    },
  },

  // Home Services (Plumbers, HVAC, etc.)
  "home_services": {
    tone: {
      primary: "friendly",
      secondary: ["trustworthy", "expert"],
      formality_level: 4,
    },
    vocabulary: {
      jargon_level: "none",
      contraction_style: "always",
    },
    writing_mechanics: {
      sentence_length_target: "short",
    },
  },

  // Technology / IT
  "technology": {
    tone: {
      primary: "innovative",
      secondary: ["expert", "forward-thinking"],
      formality_level: 5,
    },
    vocabulary: {
      jargon_level: "heavy", // tech-savvy audience
    },
  },
};
```

### 5.3 Voice Evolution Path

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VOICE MATURITY JOURNEY                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Stage 1: Best Practices (Week 1-4)                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  • Industry template selected                                     │  │
│  │  • Generic professional voice                                     │  │
│  │  • Full SEO optimization enabled                                  │  │
│  │  • System tracks content performance                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                           │                                             │
│                           ▼                                             │
│  Stage 2: Voice Discovery (Week 5-8)                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  • System prompts: "Add 3 signature phrases you like"             │  │
│  │  • System prompts: "What words should we avoid?"                  │  │
│  │  • Analyze published content for emerging patterns                │  │
│  │  • Client feedback incorporated                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                           │                                             │
│                           ▼                                             │
│  Stage 3: Voice Refinement (Week 9-12)                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  • System generates draft voice profile from content              │  │
│  │  • Client reviews and adjusts                                     │  │
│  │  • A/B test voice variations                                      │  │
│  │  • Track engagement metrics by voice style                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                           │                                             │
│                           ▼                                             │
│  Stage 4: Established Voice (Month 4+)                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  • Full voice profile locked in                                   │  │
│  │  • Switch to "application" mode                                   │  │
│  │  • Voice consistency monitoring enabled                           │  │
│  │  • Periodic voice refresh prompts                                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Data Model

### 6.1 Database Schema (Drizzle ORM - PostgreSQL)

```typescript
// packages/db/src/schema/voice-profile.ts

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Enums
export const voiceModeEnum = pgEnum("voice_mode", [
  "preservation",
  "application", 
  "best_practices"
]);

export const voiceStatusEnum = pgEnum("voice_status", [
  "draft",
  "active",
  "archived"
]);

export const primaryToneEnum = pgEnum("primary_tone", [
  "professional",
  "casual",
  "friendly",
  "authoritative",
  "playful",
  "inspirational",
  "empathetic",
  "urgent",
  "conversational",
  "academic",
  "innovative"
]);

export const protectionLevelEnum = pgEnum("protection_level", [
  "full",
  "partial",
  "none"
]);

// Main voice profile table
export const voiceProfiles = pgTable(
  "voice_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull(),
    
    // Basics
    voiceName: text("voice_name").notNull(),
    voiceMode: voiceModeEnum("voice_mode").notNull().default("best_practices"),
    voiceStatus: voiceStatusEnum("voice_status").notNull().default("draft"),
    industryTemplate: text("industry_template"),
    
    // Tone & Personality
    primaryTone: primaryToneEnum("primary_tone").notNull().default("professional"),
    secondaryTones: jsonb("secondary_tones").$type<string[]>().default([]),
    formalityLevel: integer("formality_level").notNull().default(6),
    personalityTraits: jsonb("personality_traits").$type<string[]>().default([]),
    archetype: text("archetype"),
    emotionalRange: text("emotional_range").default("moderate"),
    
    // Language Constraints
    requiredPhrases: jsonb("required_phrases").$type<string[]>().default([]),
    forbiddenPhrases: jsonb("forbidden_phrases").$type<string[]>().default([]),
    jargonLevel: text("jargon_level").default("moderate"),
    industryTerms: jsonb("industry_terms").$type<string[]>().default([]),
    acronymPolicy: text("acronym_policy").default("first_use"),
    contractionStyle: text("contraction_style").default("sometimes"),
    
    // Writing Mechanics
    sentenceLengthTarget: text("sentence_length_target").default("varied"),
    paragraphLengthTarget: text("paragraph_length_target").default("short"),
    listPreference: text("list_preference").default("mixed"),
    headingStyle: text("heading_style").default("action"),
    ctaTemplate: text("cta_template"),
    
    // SEO Integration
    keywordDensityTolerance: integer("keyword_density_tolerance").default(3),
    keywordPlacementRules: jsonb("keyword_placement_rules").$type<string[]>()
      .default(["title", "h1", "first_paragraph", "throughout"]),
    seoVsVoicePriority: integer("seo_vs_voice_priority").default(6),
    protectedSections: jsonb("protected_sections").$type<string[]>().default([]),
    
    // Voice Blending
    voiceBlendEnabled: boolean("voice_blend_enabled").default(false),
    voiceBlendWeight: real("voice_blend_weight").default(0.5),
    voiceTemplateId: uuid("voice_template_id"),
    customInstructions: text("custom_instructions"),
    
    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
    lastModifiedBy: text("last_modified_by"),
  },
  (table) => [
    uniqueIndex("uq_voice_profile_client_active").on(table.clientId)
      .where(sql`voice_status = 'active'`),
    index("idx_voice_profile_client").on(table.clientId),
  ]
);

// Learned voice data from AI analysis
export const voiceAnalysis = pgTable(
  "voice_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voiceProfileId: uuid("voice_profile_id").notNull()
      .references(() => voiceProfiles.id, { onDelete: "cascade" }),
    
    // Quantitative Metrics
    metrics: jsonb("metrics").$type<{
      avg_sentence_length: number;
      avg_paragraph_length: number;
      avg_word_length: number;
      active_voice_ratio: number;
      contraction_frequency: number;
      question_frequency: number;
      exclamation_frequency: number;
      list_frequency: number;
      readability_score: number;
      vocabulary_diversity: number;
    }>(),
    
    // Extracted vocabulary
    signaturePhrases: jsonb("signature_phrases").$type<string[]>().default([]),
    goToWords: jsonb("go_to_words").$type<string[]>().default([]),
    powerWords: jsonb("power_words").$type<string[]>().default([]),
    technicalTerms: jsonb("technical_terms").$type<string[]>().default([]),
    avoidedPatterns: jsonb("avoided_patterns").$type<string[]>().default([]),
    
    // Structural patterns
    openingPatterns: jsonb("opening_patterns").$type<string[]>().default([]),
    closingPatterns: jsonb("closing_patterns").$type<string[]>().default([]),
    transitionStyle: text("transition_style"),
    
    // Rhetorical analysis
    rhetoricalDevices: jsonb("rhetorical_devices").$type<{
      uses_metaphors: boolean;
      metaphor_themes: string[];
      uses_analogies: boolean;
      analogy_style: string;
      storytelling_frequency: string;
      rhetorical_questions: string;
      persuasion_techniques: string[];
    }>(),
    
    // Analysis metadata
    analysisVersion: text("analysis_version").notNull(),
    confidenceScore: real("confidence_score"),
    sampleSize: integer("sample_size"),
    sourcesAnalyzed: jsonb("sources_analyzed").$type<{
      url: string;
      word_count: number;
      analyzed_at: string;
    }[]>().default([]),
    
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_voice_analysis_profile").on(table.voiceProfileId),
  ]
);

// Content protection rules
export const contentProtectionRules = pgTable(
  "content_protection_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voiceProfileId: uuid("voice_profile_id").notNull()
      .references(() => voiceProfiles.id, { onDelete: "cascade" }),
    
    // Rule type
    ruleType: text("rule_type").notNull(), // "page" | "section" | "pattern"
    
    // Rule definition
    urlPattern: text("url_pattern"),           // for page rules
    sectionSelector: text("section_selector"), // for section rules
    textPattern: text("text_pattern"),         // regex for pattern rules
    
    // Protection settings
    protectionLevel: protectionLevelEnum("protection_level").notNull(),
    overrideReason: text("override_reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    
    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
    isActive: boolean("is_active").default(true),
  },
  (table) => [
    index("idx_protection_rules_profile").on(table.voiceProfileId),
  ]
);

// Voice templates (system + custom)
export const voiceTemplates = pgTable(
  "voice_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    name: text("name").notNull(),
    description: text("description"),
    industry: text("industry"),
    isSystem: boolean("is_system").notNull().default(false),
    
    // Template configuration (same structure as voice_profiles)
    templateConfig: jsonb("template_config").$type<Partial<VoiceProfile>>().notNull(),
    
    // Usage tracking
    usageCount: integer("usage_count").default(0),
    
    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("idx_voice_templates_industry").on(table.industry),
  ]
);

// Voice consistency audit log
export const voiceAuditLog = pgTable(
  "voice_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voiceProfileId: uuid("voice_profile_id").notNull()
      .references(() => voiceProfiles.id, { onDelete: "cascade" }),
    
    // What was audited
    contentId: uuid("content_id"),
    contentType: text("content_type"),     // "article" | "page" | "meta"
    contentUrl: text("content_url"),
    
    // Audit results
    voiceConsistencyScore: real("voice_consistency_score"),
    toneConsistencyScore: real("tone_consistency_score"),
    vocabularyAlignmentScore: real("vocabulary_alignment_score"),
    structureComplianceScore: real("structure_compliance_score"),
    
    // Issues found
    issues: jsonb("issues").$type<{
      type: string;
      severity: string;
      location: string;
      expected: string;
      actual: string;
      suggestion: string;
    }[]>().default([]),
    
    // Metadata
    auditedAt: timestamp("audited_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_voice_audit_profile").on(table.voiceProfileId),
    index("idx_voice_audit_content").on(table.contentId),
  ]
);

// Type exports
export type VoiceProfile = typeof voiceProfiles.$inferSelect;
export type VoiceProfileInsert = typeof voiceProfiles.$inferInsert;
export type VoiceAnalysis = typeof voiceAnalysis.$inferSelect;
export type ContentProtectionRule = typeof contentProtectionRules.$inferSelect;
export type VoiceTemplate = typeof voiceTemplates.$inferSelect;
export type VoiceAuditLog = typeof voiceAuditLog.$inferSelect;
```

### 6.2 JSON Schema for API

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://tevero.io/schemas/voice-profile.json",
  "title": "VoiceProfile",
  "description": "Complete brand voice profile configuration",
  "type": "object",
  "required": ["voice_name", "voice_mode", "client_id"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "client_id": {
      "type": "string",
      "format": "uuid"
    },
    "voice_name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255
    },
    "voice_mode": {
      "type": "string",
      "enum": ["preservation", "application", "best_practices"]
    },
    "voice_status": {
      "type": "string",
      "enum": ["draft", "active", "archived"],
      "default": "draft"
    },
    "industry_template": {
      "type": ["string", "null"]
    },
    "tone": {
      "type": "object",
      "properties": {
        "primary": {
          "type": "string",
          "enum": [
            "professional", "casual", "friendly", "authoritative",
            "playful", "inspirational", "empathetic", "urgent",
            "conversational", "academic", "innovative"
          ]
        },
        "secondary": {
          "type": "array",
          "items": { "type": "string" },
          "maxItems": 3
        },
        "formality_level": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10
        },
        "emotional_range": {
          "type": "string",
          "enum": ["reserved", "moderate", "expressive"]
        }
      },
      "required": ["primary", "formality_level"]
    },
    "personality": {
      "type": "object",
      "properties": {
        "traits": {
          "type": "array",
          "items": { "type": "string" },
          "maxItems": 5
        },
        "archetype": {
          "type": ["string", "null"]
        }
      }
    },
    "vocabulary": {
      "type": "object",
      "properties": {
        "required_phrases": {
          "type": "array",
          "items": { "type": "string" }
        },
        "forbidden_phrases": {
          "type": "array",
          "items": { "type": "string" }
        },
        "jargon_level": {
          "type": "string",
          "enum": ["none", "light", "moderate", "heavy"]
        },
        "industry_terms": {
          "type": "array",
          "items": { "type": "string" }
        },
        "acronym_policy": {
          "type": "string",
          "enum": ["always_expand", "first_use", "assume_known"]
        },
        "contraction_style": {
          "type": "string",
          "enum": ["always", "sometimes", "never"]
        }
      }
    },
    "writing_mechanics": {
      "type": "object",
      "properties": {
        "sentence_length_target": {
          "type": "string",
          "enum": ["short", "medium", "long", "varied"]
        },
        "paragraph_length_target": {
          "type": "string",
          "enum": ["short", "medium", "long"]
        },
        "list_preference": {
          "type": "string",
          "enum": ["bullets", "numbers", "prose", "mixed"]
        },
        "heading_style": {
          "type": "string",
          "enum": ["question", "statement", "action"]
        },
        "cta_template": {
          "type": ["string", "null"]
        }
      }
    },
    "seo_integration": {
      "type": "object",
      "properties": {
        "keyword_density_tolerance": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5
        },
        "keyword_placement_rules": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["title", "h1", "first_paragraph", "throughout", "natural_only"]
          }
        },
        "seo_vs_voice_priority": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10
        },
        "protected_sections": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "blending": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false
        },
        "weight": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "template_id": {
          "type": ["string", "null"],
          "format": "uuid"
        },
        "custom_instructions": {
          "type": ["string", "null"]
        }
      }
    },
    "protection_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "rule_type": {
            "type": "string",
            "enum": ["page", "section", "pattern"]
          },
          "url_pattern": { "type": ["string", "null"] },
          "section_selector": { "type": ["string", "null"] },
          "text_pattern": { "type": ["string", "null"] },
          "protection_level": {
            "type": "string",
            "enum": ["full", "partial", "none"]
          },
          "override_reason": { "type": ["string", "null"] },
          "expires_at": {
            "type": ["string", "null"],
            "format": "date-time"
          }
        },
        "required": ["rule_type", "protection_level"]
      }
    }
  }
}
```

---

## 7. Settings UI/UX

### 7.1 Voice Settings Page Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Client                                    Client: Acme Corp  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Brand Voice Settings                                  [Preview] [Save] │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Voice Mode                                                      │   │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │   │
│  │  │ ● Preservation│ │   Application │ │ Best Practices│          │   │
│  │  │               │ │               │ │               │          │   │
│  │  │ Protect brand │ │ Learn & apply │ │ Use defaults  │          │   │
│  │  │ text from SEO │ │ voice to SEO  │ │ + industry    │          │   │
│  │  └───────────────┘ └───────────────┘ └───────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────────────────────┐ ┌────────────────────────────────┐ │
│  │  Tabs                          │ │                                │ │
│  │  [Tone] [Vocabulary] [Writing] │ │   AI Voice Learning            │ │
│  │  [SEO Rules] [Protection]      │ │   ─────────────────────────    │ │
│  ├────────────────────────────────┤ │                                │ │
│  │                                │ │   Status: ● Profile learned    │ │
│  │  Primary Tone                  │ │   Confidence: 87%              │ │
│  │  ┌──────────────────────────┐  │ │   Samples: 12,450 words        │ │
│  │  │ Professional          ▼ │  │ │   Last updated: 2 days ago     │ │
│  │  └──────────────────────────┘  │ │                                │ │
│  │                                │ │   [Re-analyze Content]         │ │
│  │  Secondary Tones (up to 3)     │ │                                │ │
│  │  ┌──────────────────────────┐  │ │   Sources Analyzed:            │ │
│  │  │ ☑ Friendly               │  │ │   • Homepage (2,100 words)     │ │
│  │  │ ☑ Authoritative          │  │ │   • About Us (1,800 words)     │ │
│  │  │ ☐ Innovative             │  │ │   • Blog (8,550 words)         │ │
│  │  │ ☐ Empathetic             │  │ │                                │ │
│  │  └──────────────────────────┘  │ │   [+ Add Content Source]       │ │
│  │                                │ │                                │ │
│  │  Formality Level               │ └────────────────────────────────┘ │
│  │  Very Casual ──────●───── Formal                                    │
│  │                   6/10                                              │
│  │                                                                     │
│  │  Personality Traits                                                 │
│  │  ┌──────────────────────────┐                                      │
│  │  │ knowledgeable × helpful × results-focused × trustworthy ×  +   │ │
│  │  └──────────────────────────┘                                      │
│  │                                                                     │
│  │  Archetype                                                          │
│  │  ┌──────────────────────────┐                                      │
│  │  │ The Trusted Expert                                             │ │
│  │  └──────────────────────────┘                                      │
│  │                                                                     │
│  └─────────────────────────────────────────────────────────────────────┘
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Voice Preview/Testing Feature

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Voice Preview                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Test your voice settings with a sample prompt:                         │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Write a paragraph about our project management software         │   │
│  │ Target keyword: project management tool                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                       [Generate Sample] │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Generated Sample                                    Score: 94% │   │
│  │  ───────────────────────────────────────────────────────────────│   │
│  │                                                                  │   │
│  │  Our project management tool transforms how teams collaborate.   │   │
│  │  Gone are the days of endless email threads and missed          │   │
│  │  deadlines. With intuitive dashboards and real-time updates,    │   │
│  │  your team stays aligned and productive. Whether you're         │   │
│  │  managing a startup or enterprise projects, the platform        │   │
│  │  scales with your needs.                                        │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Voice Compliance Report                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ✓ Tone: Professional with friendly undertones                  │   │
│  │  ✓ Formality: 6/10 (target: 6/10)                               │   │
│  │  ✓ Keyword: "project management tool" included naturally        │   │
│  │  ✓ Sentence length: Avg 12 words (target: varied)               │   │
│  │  ⚠ Missing: No use of required phrase "results-driven"          │   │
│  │  ✓ No forbidden phrases detected                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [Regenerate] [Apply to Current Draft] [Close]                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Protection Rules Editor

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Content Protection Rules                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Default Protection Level: [Partial ▼]                                  │
│  (Applied to all content not covered by specific rules)                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  + Add Rule                                                      │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │                                                                  │   │
│  │  Rule 1: Homepage Hero Section                     [Edit] [×]    │   │
│  │  Type: Section | Protection: Full                               │   │
│  │  Selector: .hero-content, .tagline, .mission-statement          │   │
│  │  Reason: Core brand messaging - never modify                    │   │
│  │                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │                                                                  │   │
│  │  Rule 2: Testimonials                              [Edit] [×]    │   │
│  │  Type: Pattern | Protection: Full                               │   │
│  │  Pattern: /"[^"]+"\s*[-–—]\s*[A-Z][a-z]+/                       │   │
│  │  Reason: Customer quotes must remain unmodified                 │   │
│  │                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │                                                                  │   │
│  │  Rule 3: Blog Posts                                [Edit] [×]    │   │
│  │  Type: Page | Protection: None (SEO Optimizable)                │   │
│  │  URL Pattern: /blog/*                                           │   │
│  │  Reason: Blog content should be fully optimized for SEO         │   │
│  │                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │                                                                  │   │
│  │  Rule 4: Product Descriptions                      [Edit] [×]    │   │
│  │  Type: Page | Protection: Partial                               │   │
│  │  URL Pattern: /products/*                                       │   │
│  │  Reason: Allow meta optimization, protect body copy             │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Decision Tree: Which Mode to Use

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VOICE MODE DECISION TREE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    ┌───────────────────────┐                            │
│                    │ Does client have      │                            │
│                    │ existing content?     │                            │
│                    └───────────┬───────────┘                            │
│                                │                                        │
│              ┌─────────────────┴─────────────────┐                      │
│              │                                   │                      │
│              ▼                                   ▼                      │
│     ┌───────────────┐                   ┌───────────────┐              │
│     │     YES       │                   │      NO       │              │
│     └───────┬───────┘                   └───────┬───────┘              │
│             │                                   │                      │
│             ▼                                   ▼                      │
│     ┌───────────────────────┐          ┌───────────────────────┐      │
│     │ Does client have      │          │   BEST PRACTICES      │      │
│     │ specific marketing    │          │   MODE                │      │
│     │ text they want to     │          │   ────────────────    │      │
│     │ PRESERVE unchanged?   │          │   • Select industry   │      │
│     └───────────┬───────────┘          │     template          │      │
│                 │                       │   • Apply defaults    │      │
│     ┌───────────┴───────────┐          │   • Full SEO opt.     │      │
│     │                       │          │   • Evolve over time  │      │
│     ▼                       ▼          └───────────────────────┘      │
│ ┌─────────┐           ┌─────────┐                                      │
│ │   YES   │           │   NO    │                                      │
│ └────┬────┘           └────┬────┘                                      │
│      │                     │                                           │
│      ▼                     ▼                                           │
│ ┌───────────────┐    ┌───────────────┐                                 │
│ │  PRESERVATION │    │  APPLICATION  │                                 │
│ │  MODE         │    │  MODE         │                                 │
│ │  ───────────  │    │  ───────────  │                                 │
│ │  • AI learns  │    │  • AI learns  │                                 │
│ │    voice      │    │    voice      │                                 │
│ │  • Tag brand  │    │  • Apply to   │                                 │
│ │    sections   │    │    new content│                                 │
│ │  • Protect    │    │  • SEO with   │                                 │
│ │    from SEO   │    │    voice      │                                 │
│ │  • Optimize   │    │  • No protect │                                 │
│ │    rest       │    │    needed     │                                 │
│ └───────────────┘    └───────────────┘                                 │
│                                                                         │
│                                                                         │
│  QUICK REFERENCE:                                                       │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Big brand, established voice, legal/compliance = PRESERVATION        │
│  • Agency client wanting SEO content in their style = APPLICATION       │
│  • Small business, new website, no style guide = BEST PRACTICES         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Integration Points

### 9.1 Content Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTENT GENERATION WITH VOICE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. User requests content generation                                    │
│     │                                                                   │
│     ▼                                                                   │
│  2. System loads active voice profile for client                        │
│     │                                                                   │
│     ▼                                                                   │
│  3. Check voice mode                                                    │
│     │                                                                   │
│     ├─► PRESERVATION: Load protection rules                             │
│     │   └─► Filter content sections                                     │
│     │       └─► Generate only for unprotected areas                     │
│     │                                                                   │
│     ├─► APPLICATION: Load full voice profile                            │
│     │   └─► Build voice-constrained prompt                              │
│     │       └─► Generate with voice + SEO requirements                  │
│     │                                                                   │
│     └─► BEST_PRACTICES: Load industry template                          │
│         └─► Blend with Tevero defaults                                  │
│             └─► Generate with balanced voice + SEO                      │
│                                                                         │
│  4. Post-generation voice audit                                         │
│     │                                                                   │
│     ├─► Calculate voice consistency score                               │
│     ├─► Check for forbidden phrases                                     │
│     ├─► Verify required phrases included                                │
│     └─► Log to voice_audit_log table                                    │
│                                                                         │
│  5. Return content + voice compliance report                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 API Endpoints

```typescript
// Voice Profile CRUD
GET    /api/clients/:clientId/voice-profile
POST   /api/clients/:clientId/voice-profile
PUT    /api/clients/:clientId/voice-profile
DELETE /api/clients/:clientId/voice-profile

// Voice Learning
POST   /api/clients/:clientId/voice-profile/analyze
GET    /api/clients/:clientId/voice-profile/analysis
POST   /api/clients/:clientId/voice-profile/analyze-url
POST   /api/clients/:clientId/voice-profile/analyze-content

// Voice Templates
GET    /api/voice-templates
GET    /api/voice-templates/:templateId
POST   /api/voice-templates           // create custom template
GET    /api/voice-templates/industry/:industry

// Protection Rules
GET    /api/clients/:clientId/voice-profile/protection-rules
POST   /api/clients/:clientId/voice-profile/protection-rules
PUT    /api/clients/:clientId/voice-profile/protection-rules/:ruleId
DELETE /api/clients/:clientId/voice-profile/protection-rules/:ruleId

// Voice Preview
POST   /api/clients/:clientId/voice-profile/preview
// Body: { prompt: string, keywords?: string[] }
// Returns: { sample: string, compliance_report: ComplianceReport }

// Voice Audit
GET    /api/clients/:clientId/voice-profile/audit-log
POST   /api/clients/:clientId/voice-profile/audit
// Body: { content: string, content_type: string }
// Returns: { scores: VoiceScores, issues: Issue[] }
```

---

## 10. Edge Cases & Considerations

### 10.1 Edge Cases

| Scenario | Handling |
|----------|----------|
| Client switches from preservation to application mode | Archive protection rules, prompt user to review |
| Voice analysis returns low confidence | Flag for manual review, use best_practices as fallback |
| Protected section contains critical SEO opportunity | Show warning, allow override with reason |
| Client's existing content has inconsistent voice | Average across samples, flag inconsistencies for user |
| Required phrase conflicts with SEO keyword | Voice wins by default (configurable via seo_vs_voice_priority) |
| Multiple voice profiles exist for client | Only one can be "active" at a time |
| Voice template is deleted while in use | Graceful fallback to defaults, notify user |
| Large content corpus for analysis | Process in batches, show progress |
| Non-English content | Voice learning supports primary language only for now |

### 10.2 Performance Considerations

- Voice profiles cached at application layer (Redis)
- Voice analysis runs as background job (BullMQ)
- Protection rules compiled to regex on profile activation
- Audit logging is async (fire-and-forget)

### 10.3 Security Considerations

- Voice profiles scoped to client (multi-tenant isolation)
- Protection rules validated server-side before save
- Custom instructions sanitized to prevent prompt injection
- API endpoints require authentication + client access

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create database schema and migrations
- [ ] Implement voice profile CRUD API
- [ ] Build voice settings UI (basic form)
- [ ] Add voice templates (system defaults)

### Phase 2: Voice Learning (Week 3-4)
- [ ] Implement content scraping for voice analysis
- [ ] Build AI analysis prompt and pipeline
- [ ] Create voice analysis background job
- [ ] Build analysis results UI

### Phase 3: Content Protection (Week 5)
- [ ] Implement protection rules CRUD
- [ ] Build brand text detection heuristics
- [ ] Add protection rule editor UI
- [ ] Integrate protection checks into content generation

### Phase 4: Voice Application (Week 6)
- [ ] Build voice-constrained prompt generator
- [ ] Implement voice compliance checker
- [ ] Add before/after comparison UI
- [ ] Integrate with existing content generation

### Phase 5: Polish & Testing (Week 7-8)
- [ ] Voice preview/testing feature
- [ ] Voice audit logging and dashboard
- [ ] A/B testing for voice variations
- [ ] Documentation and training materials

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Voice consistency score (automated) | > 85% average |
| Client satisfaction with voice accuracy | > 90% approval |
| SEO performance with voice application | No degradation vs. no-voice |
| Time to configure voice profile | < 15 minutes |
| Voice learning accuracy vs. manual config | > 80% alignment |
| Protection rule false positive rate | < 5% |

---

## Appendix A: AI Prompt Templates

### A.1 Voice Analysis Prompt

See Section 2.3 above.

### A.2 Voice Application Prompt

See Section 4.2 above.

### A.3 Voice Compliance Check Prompt

```markdown
VOICE COMPLIANCE CHECK

You are a brand voice auditor. Check the following content against the voice profile.

=== VOICE PROFILE ===
{voice_profile_json}

=== CONTENT TO AUDIT ===
{content}

=== CHECK REQUIREMENTS ===

1. TONE COMPLIANCE
   - Does the tone match {primary_tone}?
   - Are {secondary_tones} present where appropriate?
   - Rate formality (1-10) and compare to target {formality_level}

2. VOCABULARY COMPLIANCE
   - Are required phrases present? {required_phrases}
   - Are any forbidden phrases used? {forbidden_phrases}
   - Is jargon level appropriate? {jargon_level}

3. STRUCTURAL COMPLIANCE
   - Does sentence length match target? {sentence_length_target}
   - Does paragraph structure match? {paragraph_length_target}
   - Is heading style correct? {heading_style}

4. PERSONALITY COMPLIANCE
   - Do personality traits come through? {personality_traits}
   - Is the archetype reflected? {archetype}

=== OUTPUT FORMAT ===
{
  "overall_score": 0-100,
  "tone_score": 0-100,
  "vocabulary_score": 0-100,
  "structure_score": 0-100,
  "personality_score": 0-100,
  "issues": [
    {
      "type": "vocabulary|tone|structure|personality",
      "severity": "critical|warning|info",
      "location": "line/paragraph reference",
      "expected": "what should be",
      "actual": "what was found",
      "suggestion": "how to fix"
    }
  ],
  "summary": "brief overall assessment"
}
```

---

*Document Version: 1.0*
*Last Updated: 2026-04-22*
*Author: TeveroSEO Platform Team*
