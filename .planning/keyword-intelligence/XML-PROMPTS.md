# XML Prompts: Production LLM Templates

> **Status:** Research Complete  
> **Last Updated:** 2026-04-26  
> **Model Target:** Claude Sonnet 4.6 / GPT-4

---

## Overview

This document summarizes the production-ready XML-structured prompts for the Keyword Intelligence System. Each prompt is designed for Lithuanian hair care e-commerce with 200-500 products.

---

## Prompt Files

| File | Purpose | Location |
|------|---------|----------|
| `keyword-classification-prompt.xml` | Category classification | `.planning/prompts/` |
| `keyword-product-matcher.xml` | Product matching | `.planning/prompts/` |
| `category-naming-prompt.xml` | Gap detection naming | `.planning/prompts/` |
| `business-priority-parser.xml` | User focus extraction | `open-seo-main/src/server/features/keywords/prompts/` |

---

## 1. Category Classification Prompt

**File:** `keyword-classification-prompt.xml`

### Structure

```xml
<prompt>
  <system-context>
    <role>Expert e-commerce keyword classifier (Lithuanian)</role>
    <domain-knowledge>
      <morphology-rules>Lithuanian inflection patterns</morphology-rules>
      <intent-signals>"kaina" = price, "kaip" = how-to</intent-signals>
    </domain-knowledge>
  </system-context>
  
  <task-definition>
    <classification-rules>5 prioritized rules</classification-rules>
    <confidence-calibration>0.95+ exact, 0.70-0.84 ambiguous</confidence-calibration>
  </task-definition>
  
  <categories>{{CATEGORIES_PLACEHOLDER}}</categories>
  
  <few-shot-examples>6 Lithuanian examples</few-shot-examples>
  
  <keywords-batch>{{KEYWORDS_PLACEHOLDER}}</keywords-batch>
  
  <output-schema>JSON with classifications array</output-schema>
  
  <execution-instructions>5 ordered steps</execution-instructions>
  
  <quality-checks>6 validation rules</quality-checks>
</prompt>
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Chain-of-thought reasoning | Explicit `<reasoning>` tags improve accuracy for morphological variants |
| Lithuanian morphology section | Documents genitive/dative/infinitive patterns for model reference |
| Confidence calibration anchors | Prevents over-confident/under-confident predictions |
| Multi-category support | Primary + secondary categories with reasons |
| Quality checks | Validation rules ensure response completeness |

### Example Few-Shot

```xml
<example id="2" type="morphological_variant">
  <keyword>kaip dažyti plaukus namuose</keyword>
  <reasoning>
    1. MORPHOLOGY: "dažyti plaukus" = to dye hair (infinitive + accusative)
    2. MODIFIER: "namuose" = at home - indicates DIY intent
    3. INTENT: Informational ("kaip" = how), but product-adjacent
    4. CATEGORY MATCH: Related to "Plaukų dažai"
    5. CONTENT OPPORTUNITY: Good for blog/tutorial content
  </reasoning>
  <classification>
    <primary_category>cat_001</primary_category>
    <confidence>0.82</confidence>
    <flags><informational_intent>true</informational_intent></flags>
  </classification>
</example>
```

---

## 2. Product Matching Prompt

**File:** `keyword-product-matcher.xml`

### Structure

```xml
<prompt>
  <system-context>
    <core-principle name="1:1-targeting-rule">
      Each keyword MUST map to exactly ONE canonical URL
    </core-principle>
    <domain-knowledge>
      <brand-aliases>L'Oréal = Loreal = L'oreal</brand-aliases>
      <color-code-formats>6/0 = 6.0 = 6-0 = 6N</color-code-formats>
    </domain-knowledge>
  </system-context>
  
  <input-schema>
    <keyword>{{KEYWORD}}</keyword>
    <candidate-products>{{PRODUCTS_JSON}}</candidate-products>
  </input-schema>
  
  <matching-criteria>
    <criterion name="intent-classification" weight="prerequisite"/>
    <criterion name="brand-match" weight="high">+40 points</criterion>
    <criterion name="color-code-match" weight="critical">+50/-100 points</criterion>
    <criterion name="product-line-match" weight="high">+35 points</criterion>
  </matching-criteria>
  
  <few-shot-examples>7 examples</few-shot-examples>
  
  <output-schema>JSON with match result</output-schema>
</prompt>
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Intent classification first | Must determine PRODUCT_SPECIFIC vs GENERIC before matching |
| Color code normalization | 6/0 = 6.0 = 6N prevents false mismatches |
| **Critical penalty** for color mismatch | -100 points disqualifies wrong color (hair dye safety) |
| Brand alias dictionary | Handles L'Oréal vs Loreal variations |
| Letter-to-tone mapping | N=0, A=1, G=3 for color code translation |

### Intent Types

| Intent | Example | Target |
|--------|---------|--------|
| PRODUCT_SPECIFIC | "loreal majirel 6/0 50ml" | Exact product page |
| PRODUCT_LINE | "majirel plaukų dažai" | Product line landing |
| BRAND_EXPLORATION | "loreal plaukų dažai" | Brand collection |
| GENERIC | "plaukų dažai" | Category page |
| COLOR_SPECIFIC | "6/0 plaukų dažai" | Color-filtered category |

### Output Actions

```json
{
  "action": "ASSIGN_TO_PRODUCT | ASSIGN_TO_CATEGORY | ASSIGN_TO_BRAND_COLLECTION | FLAG_AS_GAP",
  "confidence": 0.92,
  "match": {
    "product_id": "prod_123",
    "url": "/produktai/loreal-majirel-6-0-50ml"
  },
  "reasoning": "Exact color code match (6/0) + brand + product line"
}
```

---

## 3. Category Naming Prompt

**File:** `category-naming-prompt.xml`

### Structure

```xml
<prompt>
  <system>
    <role>E-commerce category architect (Lithuanian)</role>
    <guidelines>6 naming guidelines</guidelines>
    <naming_conventions>
      <convention type="top_level">Broad, 1-3 words</convention>
      <convention type="subcategory">Specific, parent implied</convention>
      <convention type="attribute_based">Cross-category filters</convention>
    </naming_conventions>
  </system>
  
  <input>
    <existing_categories>{{EXISTING_CATEGORIES}}</existing_categories>
    <keyword_cluster>{{KEYWORD_LIST}}</keyword_cluster>
  </input>
  
  <examples>5 scenario examples</examples>
  
  <output_schema>JSON recommendation</output_schema>
  
  <constraints>Critical, high, medium severity rules</constraints>
</prompt>
```

### Action Types

| Action | Use Case |
|--------|----------|
| `CREATE_SUBCATEGORY` | New category under existing parent |
| `CREATE_TOP_LEVEL` | New root-level category |
| `MERGE_CATEGORIES` | Consolidate overlapping categories |
| `CREATE_ATTRIBUTE_FILTER` | Cross-category filter (e.g., "Be sulfatų") |
| `NO_CATEGORY` | Informational queries → blog content |

### Example Output

```json
{
  "action_type": "CREATE_SUBCATEGORY",
  "primary_name": "Plaukų aliejai",
  "alternatives": [
    {"name": "Aliejai plaukams", "rank": 2, "trade_off": "More natural phrasing"},
    {"name": "Plaukų aliejukai", "rank": 3, "trade_off": "Diminutive, cuter"}
  ],
  "parent_category": {"id": "1", "name": "Plaukų priežiūra"},
  "reasoning": {
    "naming_rationale": "Uses highest-volume keyword stem, matches sibling plural pattern",
    "seo_considerations": "Captures 2400 monthly searches"
  }
}
```

---

## 4. Business Priority Parser Prompt

**File:** `business-priority-parser.xml`

### Structure

```xml
<prompt>
  <system-context>
    <core-principles>
      <principle name="conservative-inference">Extract only stated priorities</principle>
      <principle name="temporal-awareness">Detect quarterly/seasonal signals</principle>
      <principle name="lithuanian-expansion">Auto-generate LT variants</principle>
    </core-principles>
  </system-context>
  
  <output-schema>FocusDirective JSON</output-schema>
  
  <extraction-rules>
    <rule section="categories">How to extract category priorities</rule>
    <rule section="brands">Promote vs exclude patterns</rule>
    <rule section="temporal">Q1-Q4, seasonal detection</rule>
  </extraction-rules>
  
  <examples>6 comprehensive examples</examples>
</prompt>
```

### Output Schema Highlights

```json
{
  "priorities": {
    "categories": [{"name": "Hair Coloring", "weight_modifier": 1.5, "scope": "QUARTERLY"}],
    "brands": [{"brand": "L'Oreal Professionnel", "action": "PROMOTE", "weight_modifier": 1.8}]
  },
  "suppressions": {
    "brands": [{"brand": "Pigu", "action": "EXCLUDE", "reason": "competitor"}],
    "attributes": [{"attribute": "home", "attribute_lt": "namams", "suppress_factor": 0.1}]
  },
  "volume_preference": {
    "strategy": "HIGH_VOLUME",
    "rationale": "Brand awareness phase"
  },
  "lithuanian_variants": {
    "generated": [
      {"original": "professional", "variants": ["profesionalus", "profesionalūs", "saloninis"]}
    ]
  }
}
```

### Confidence Calibration

| Level | Range | Meaning |
|-------|-------|---------|
| High | 0.9-1.0 | Explicitly stated, unambiguous |
| Medium | 0.7-0.89 | Strongly implied, reasonable inference |
| Low | 0.5-0.69 | Possible interpretation, needs confirmation |
| Very Low | 0.0-0.49 | Guessing, requires clarification |

---

## Prompt Engineering Patterns

### 1. Chain-of-Thought with Tags

```xml
<reasoning>
  1. MORPHOLOGY: Identify Lithuanian word forms
  2. INTENT: Classify search intent
  3. MATCH: Find category/product alignment
  4. CONFIDENCE: Calibrate certainty
</reasoning>
```

### 2. Confidence Anchoring

```xml
<confidence-calibration>
  <score value="0.95-1.0" meaning="Exact match"/>
  <score value="0.70-0.84" meaning="Good fit with ambiguity"/>
  <score value="below 0.50" meaning="Requires human review"/>
</confidence-calibration>
```

### 3. Quality Checks as Constraints

```xml
<quality-checks>
  <check>Every keyword must appear in classifications OR unclassified</check>
  <check>Primary category must be valid category_id</check>
  <check>Reasoning required for confidence below 0.85</check>
</quality-checks>
```

### 4. Few-Shot Example Coverage

| Example Type | Purpose |
|--------------|---------|
| Exact match | Establish baseline accuracy |
| Morphological variant | Handle Lithuanian inflection |
| Brand keyword | Special brand handling |
| Multi-category | Ambiguity resolution |
| Edge case | Error recovery |
| No match | Gap detection |

### 5. Placeholder Injection

```xml
<categories>{{CATEGORIES_PLACEHOLDER}}</categories>
<keywords-batch>{{KEYWORDS_PLACEHOLDER}}</keywords-batch>
```

Runtime substitution keeps prompts reusable.

---

## TypeScript Implementation

Each prompt has a companion TypeScript file:

| XML Prompt | TypeScript Implementation |
|------------|--------------------------|
| `keyword-classification-prompt.xml` | `keyword-classifier.ts` |
| `keyword-product-matcher.xml` | `keyword-product-matcher.ts` |
| `category-naming-prompt.xml` | Used directly (no impl needed) |
| `business-priority-parser.xml` | `BusinessPriorityParser.ts` |

### Usage Pattern

```typescript
import { KeywordClassifier } from './keyword-classifier';

const classifier = new KeywordClassifier({
  promptPath: './keyword-classification-prompt.xml',
  categories: loadCategories()
});

const results = await classifier.classifyBatch(keywords);
```

---

## Summary

| Prompt | Key Innovation |
|--------|---------------|
| Category Classification | Lithuanian morphology rules + confidence calibration |
| Product Matching | Color code normalization + 1:1 targeting rule |
| Category Naming | 5 action types + attribute-filter pattern |
| Business Priority | Layered temporal scope + Lithuanian variant expansion |

All prompts are designed for Claude Sonnet 4.6 or GPT-4, optimized for Lithuanian language handling and e-commerce domain specificity.
