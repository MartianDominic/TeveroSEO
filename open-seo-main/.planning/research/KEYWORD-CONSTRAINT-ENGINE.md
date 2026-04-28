# SEO Keyword Constraint Engine - Technical Specification

## Overview

A rule-based constraint engine for filtering SEO keywords based on client agreements. Enables agencies to define per-client keyword targeting rules that automatically filter opportunity keywords, gap analysis results, and ranking targets.

## Problem Statement

Different clients have varying SEO goals that require custom keyword filtering:
- "Only rank for category pages, not products"
- "Focus on transactional keywords only"
- "Avoid competitor brand terms"
- "Prioritize keywords with buyer intent"
- "Only keywords in these 3 cities"
- "Exclude anything under 100 monthly searches"

The constraint engine must:
1. Store flexible rule definitions per client/workspace
2. Support AND/OR logic for complex constraints
3. Execute filters efficiently at scale (10K+ keywords)
4. Detect and suggest constraints from existing content
5. Provide a natural language interface for non-technical users

---

## 1. Constraint Types Taxonomy

### 1.1 Page Type Constraints

Filter keywords by target page type.

| Type | Description | Example |
|------|-------------|---------|
| `category` | Category/collection pages | "kitchen cabinets", "outdoor furniture" |
| `product` | Individual product pages | "MALM bed frame white" |
| `blog` | Content/blog pages | "how to install cabinets" |
| `landing` | Campaign landing pages | "free kitchen design consultation" |
| `location` | Location-specific pages | "plumber dallas tx" |

**Detection method:** Classify keywords by URL pattern and content type from existing rankings.

### 1.2 Intent Constraints

Filter by search intent classification.

| Intent | Description | Signal Words |
|--------|-------------|--------------|
| `transactional` | Ready to buy | buy, order, purchase, price, cost, cheap |
| `commercial` | Researching purchase | best, top, review, vs, compare, alternative |
| `informational` | Seeking information | how to, what is, guide, tutorial, tips |
| `navigational` | Looking for specific site | [brand name], login, support, contact |

**Detection method:** Use DataForSEO `search_intent_info.main_intent` field, supplemented by keyword pattern matching.

### 1.3 Volume Constraints

Filter by search volume metrics.

| Constraint | Field | Operator |
|------------|-------|----------|
| `min_volume` | `searchVolume` | >= |
| `max_volume` | `searchVolume` | <= |
| `min_cpc` | `cpc` | >= |
| `max_cpc` | `cpc` | <= |
| `min_difficulty` | `keywordDifficulty` | >= |
| `max_difficulty` | `keywordDifficulty` | <= |

### 1.4 Location Constraints (Geo-Targeting)

Filter by geographic modifiers in keywords.

| Type | Description | Example |
|------|-------------|---------|
| `include_cities` | Must contain one of these cities | ["Dallas", "Austin", "Houston"] |
| `include_regions` | Must contain region | ["Texas", "DFW"] |
| `exclude_cities` | Must not contain these cities | ["Los Angeles", "New York"] |
| `country_code` | Target country for DataForSEO location | 2840 (US) |

**Detection method:** NER extraction of location entities from keywords.

### 1.5 Exclusion Lists

Block specific terms or patterns.

| Type | Description | Example |
|------|-------------|---------|
| `competitor_brands` | Competitor brand names | ["IKEA", "Wayfair", "Amazon"] |
| `irrelevant_terms` | Non-target terms | ["DIY", "free", "cheap"] |
| `negative_patterns` | Regex patterns | ["/job|career|hiring/i"] |

### 1.6 Inclusion Lists

Require specific terms or patterns.

| Type | Description | Example |
|------|-------------|---------|
| `must_contain` | Required terms (any) | ["sauna", "steam room"] |
| `must_contain_all` | Required terms (all) | ["outdoor", "wood"] |
| `positive_patterns` | Regex patterns | ["/price|cost|quote/i"] |

### 1.7 Category Constraints

Filter by keyword category (from AI generation).

| Category | Description |
|----------|-------------|
| `product` | Product-focused keywords |
| `brand` | Brand-related keywords |
| `service` | Service keywords |
| `commercial` | Commercial/transactional intent |
| `informational` | Educational content |

---

## 2. Rule Engine Design

### 2.1 Database Schema

```sql
-- Constraint rule sets per client
CREATE TABLE keyword_constraint_sets (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 0, -- Higher = evaluated first
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(client_id, name)
);

CREATE INDEX ix_constraint_sets_client ON keyword_constraint_sets(client_id);
CREATE INDEX ix_constraint_sets_workspace ON keyword_constraint_sets(workspace_id);

-- Individual constraint rules within a set
CREATE TABLE keyword_constraints (
  id TEXT PRIMARY KEY,
  constraint_set_id TEXT NOT NULL REFERENCES keyword_constraint_sets(id) ON DELETE CASCADE,
  
  -- Rule definition
  constraint_type TEXT NOT NULL, -- 'page_type', 'intent', 'volume', 'location', 'exclusion', 'inclusion', 'category'
  operator TEXT NOT NULL, -- 'include', 'exclude', 'gte', 'lte', 'eq', 'contains', 'regex', 'any_of', 'all_of'
  field TEXT, -- For volume constraints: 'searchVolume', 'cpc', 'keywordDifficulty'
  value JSONB NOT NULL, -- String, number, or array depending on constraint_type
  
  -- Logic
  group_id TEXT, -- For OR grouping within AND logic
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  reason TEXT, -- Why this constraint exists (for UI display)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_constraint_type CHECK (
    constraint_type IN ('page_type', 'intent', 'volume', 'location', 'exclusion', 'inclusion', 'category')
  ),
  CONSTRAINT valid_operator CHECK (
    operator IN ('include', 'exclude', 'gte', 'lte', 'eq', 'contains', 'not_contains', 'regex', 'not_regex', 'any_of', 'all_of', 'none_of')
  )
);

CREATE INDEX ix_constraints_set ON keyword_constraints(constraint_set_id);
CREATE INDEX ix_constraints_type ON keyword_constraints(constraint_type);

-- Audit log for constraint changes
CREATE TABLE keyword_constraint_audit (
  id TEXT PRIMARY KEY,
  constraint_set_id TEXT REFERENCES keyword_constraint_sets(id) ON DELETE SET NULL,
  constraint_id TEXT,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'applied'
  changed_by TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  keywords_affected INTEGER, -- How many keywords matched when applied
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_constraint_audit_set ON keyword_constraint_audit(constraint_set_id);
CREATE INDEX ix_constraint_audit_created ON keyword_constraint_audit(created_at);

-- Pre-built constraint templates
CREATE TABLE keyword_constraint_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  business_type TEXT, -- 'ecommerce', 'local_service', 'saas', 'content_publisher'
  constraints JSONB NOT NULL, -- Array of constraint definitions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.2 Drizzle Schema

```typescript
// src/db/constraint-schema.ts
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { clients } from "./client-schema";
import { organization } from "./user-schema";

// Constraint types enum
export const CONSTRAINT_TYPES = [
  "page_type",
  "intent", 
  "volume",
  "location",
  "exclusion",
  "inclusion",
  "category",
] as const;
export type ConstraintType = (typeof CONSTRAINT_TYPES)[number];

// Operators enum
export const CONSTRAINT_OPERATORS = [
  "include",
  "exclude",
  "gte",
  "lte",
  "eq",
  "contains",
  "not_contains",
  "regex",
  "not_regex",
  "any_of",
  "all_of",
  "none_of",
] as const;
export type ConstraintOperator = (typeof CONSTRAINT_OPERATORS)[number];

// Value type for constraints
export type ConstraintValue = string | number | string[] | number[];

/**
 * Constraint rule sets - container for related constraints
 */
export const keywordConstraintSets = pgTable(
  "keyword_constraint_sets",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").default(false),
    priority: integer("priority").default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_constraint_sets_client").on(table.clientId),
    index("ix_constraint_sets_workspace").on(table.workspaceId),
    uniqueIndex("ix_constraint_sets_client_name").on(table.clientId, table.name),
  ]
);

/**
 * Individual constraint rules
 */
export const keywordConstraints = pgTable(
  "keyword_constraints",
  {
    id: text("id").primaryKey(),
    constraintSetId: text("constraint_set_id")
      .notNull()
      .references(() => keywordConstraintSets.id, { onDelete: "cascade" }),
    constraintType: text("constraint_type").notNull(),
    operator: text("operator").notNull(),
    field: text("field"), // For volume constraints
    value: jsonb("value").$type<ConstraintValue>().notNull(),
    groupId: text("group_id"), // For OR grouping
    isActive: boolean("is_active").default(true),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_constraints_set").on(table.constraintSetId),
    index("ix_constraints_type").on(table.constraintType),
  ]
);

/**
 * Audit log for constraint changes
 */
export const keywordConstraintAudit = pgTable(
  "keyword_constraint_audit",
  {
    id: text("id").primaryKey(),
    constraintSetId: text("constraint_set_id").references(
      () => keywordConstraintSets.id,
      { onDelete: "set null" }
    ),
    constraintId: text("constraint_id"),
    action: text("action").notNull(),
    changedBy: text("changed_by").notNull(),
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    keywordsAffected: integer("keywords_affected"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_constraint_audit_set").on(table.constraintSetId),
    index("ix_constraint_audit_created").on(table.createdAt),
  ]
);

/**
 * Pre-built constraint templates
 */
export const keywordConstraintTemplates = pgTable(
  "keyword_constraint_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),
    businessType: text("business_type"),
    constraints: jsonb("constraints").$type<ConstraintDefinition[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  }
);

// Constraint definition for templates
export interface ConstraintDefinition {
  constraintType: ConstraintType;
  operator: ConstraintOperator;
  field?: string;
  value: ConstraintValue;
  groupId?: string;
  reason?: string;
}

// Relations
export const keywordConstraintSetsRelations = relations(
  keywordConstraintSets,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [keywordConstraintSets.clientId],
      references: [clients.id],
    }),
    workspace: one(organization, {
      fields: [keywordConstraintSets.workspaceId],
      references: [organization.id],
    }),
    constraints: many(keywordConstraints),
  })
);

export const keywordConstraintsRelations = relations(
  keywordConstraints,
  ({ one }) => ({
    constraintSet: one(keywordConstraintSets, {
      fields: [keywordConstraints.constraintSetId],
      references: [keywordConstraintSets.id],
    }),
  })
);

// Type exports
export type KeywordConstraintSetSelect = typeof keywordConstraintSets.$inferSelect;
export type KeywordConstraintSetInsert = typeof keywordConstraintSets.$inferInsert;
export type KeywordConstraintSelect = typeof keywordConstraints.$inferSelect;
export type KeywordConstraintInsert = typeof keywordConstraints.$inferInsert;
```

### 2.3 AND/OR Logic Design

Constraints follow a **default AND** with **grouped OR** pattern:

```
(constraint1 AND constraint2) AND (constraint3 OR constraint4) AND constraint5
```

- Constraints **without** a `groupId` are AND'd together
- Constraints **with** the same `groupId` are OR'd together
- Groups are then AND'd with other groups and standalone constraints

**Example:** "Transactional keywords in Dallas OR Austin, excluding competitor brands"

```typescript
const constraints = [
  // Group: intent (standalone, no groupId)
  { constraintType: "intent", operator: "include", value: "transactional" },
  
  // Group "cities": Dallas OR Austin
  { constraintType: "location", operator: "contains", value: "dallas", groupId: "cities" },
  { constraintType: "location", operator: "contains", value: "austin", groupId: "cities" },
  
  // Group: exclusions (standalone)
  { constraintType: "exclusion", operator: "none_of", value: ["ikea", "wayfair", "amazon"] },
];
```

### 2.4 Priority and Override

When multiple constraint sets apply:

1. **Client-specific** constraints take precedence over workspace defaults
2. Higher `priority` values are evaluated first
3. First matching set's constraints are applied
4. Override capability: Individual constraints can be marked `isActive: false` to disable without deletion

---

## 3. Automatic Constraint Detection

### 3.1 Infer from Existing Content

Analyze the client's current rankings and content to suggest constraints.

```typescript
interface ContentAnalysis {
  // Page type distribution
  pageTypes: {
    category: number;    // % of pages
    product: number;
    blog: number;
    location: number;
  };
  
  // Intent distribution of ranking keywords
  intents: {
    transactional: number;
    commercial: number;
    informational: number;
    navigational: number;
  };
  
  // Volume characteristics
  volumeStats: {
    min: number;
    max: number;
    median: number;
    p25: number;
    p75: number;
  };
  
  // Location patterns
  locations: string[];
  
  // Detected brand terms
  ownBrands: string[];
  competitorBrands: string[];
}

async function analyzeClientContent(clientId: string): Promise<ContentAnalysis> {
  // 1. Fetch saved keywords + rankings for client
  // 2. Fetch audit pages to classify page types
  // 3. Run intent classification on keywords
  // 4. Extract location entities
  // 5. Identify brand terms via NER or pattern matching
  
  return analysis;
}

function suggestConstraints(analysis: ContentAnalysis): ConstraintDefinition[] {
  const suggestions: ConstraintDefinition[] = [];
  
  // Suggest dominant page type focus
  const dominantPageType = Object.entries(analysis.pageTypes)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (dominantPageType[1] > 60) {
    suggestions.push({
      constraintType: "page_type",
      operator: "include",
      value: dominantPageType[0],
      reason: `${dominantPageType[1]}% of your content targets ${dominantPageType[0]} pages`,
    });
  }
  
  // Suggest volume floor based on p25
  if (analysis.volumeStats.p25 > 50) {
    suggestions.push({
      constraintType: "volume",
      operator: "gte",
      field: "searchVolume",
      value: analysis.volumeStats.p25,
      reason: `Your typical keywords have ${analysis.volumeStats.p25}+ monthly searches`,
    });
  }
  
  // Suggest competitor exclusions
  if (analysis.competitorBrands.length > 0) {
    suggestions.push({
      constraintType: "exclusion",
      operator: "none_of",
      value: analysis.competitorBrands,
      reason: `Avoid competitor brand terms: ${analysis.competitorBrands.join(", ")}`,
    });
  }
  
  return suggestions;
}
```

### 3.2 Niche-Based Templates

Pre-built templates by business type.

```typescript
const CONSTRAINT_TEMPLATES: Record<string, ConstraintDefinition[]> = {
  ecommerce: [
    // Focus on commercial intent
    { constraintType: "intent", operator: "any_of", value: ["transactional", "commercial"] },
    // Minimum volume threshold
    { constraintType: "volume", operator: "gte", field: "searchVolume", value: 100 },
    // Target product and category pages
    { constraintType: "page_type", operator: "any_of", value: ["product", "category"] },
  ],
  
  local_service: [
    // Focus on location-based
    { constraintType: "intent", operator: "any_of", value: ["transactional", "commercial"] },
    // Must include location terms
    { constraintType: "inclusion", operator: "any_of", value: ["near me", "in [city]", "[city]"] },
    // Lower volume threshold for local
    { constraintType: "volume", operator: "gte", field: "searchVolume", value: 20 },
  ],
  
  saas: [
    // Mix of commercial and informational
    { constraintType: "intent", operator: "any_of", value: ["transactional", "commercial", "informational"] },
    // Focus on software-related terms
    { constraintType: "inclusion", operator: "any_of", value: ["software", "tool", "platform", "app"] },
    // Medium volume threshold
    { constraintType: "volume", operator: "gte", field: "searchVolume", value: 50 },
  ],
  
  content_publisher: [
    // Focus on informational
    { constraintType: "intent", operator: "include", value: "informational" },
    // Target blog pages
    { constraintType: "page_type", operator: "include", value: "blog" },
    // Higher volume for content ROI
    { constraintType: "volume", operator: "gte", field: "searchVolume", value: 500 },
  ],
};
```

---

## 4. Client Onboarding Flow

### 4.1 Capture Constraints During Setup

**Step 1: Business Profile**
- Business type selection (ecommerce, local service, SaaS, etc.)
- Industry vertical
- Target markets/locations

**Step 2: Constraint Wizard**
```
What types of pages do you want to rank?
[ ] Category/Collection pages
[ ] Individual product pages
[x] Blog/Content pages
[ ] Location pages

What's your minimum keyword volume?
[100] monthly searches

Which competitors should we avoid targeting?
[Add competitor names...]

Any specific terms to exclude?
[Add terms like "free", "DIY", etc...]

Any locations to focus on?
[Add city/region names...]
```

**Step 3: Review & Confirm**
- Show preview of constraint effects on sample keywords
- Allow adjustments before saving

### 4.2 UI Components

```typescript
// ConstraintBuilder.tsx - Visual constraint builder
interface ConstraintBuilderProps {
  clientId: string;
  initialConstraints?: ConstraintDefinition[];
  onSave: (constraints: ConstraintDefinition[]) => void;
}

// ConstraintPreview.tsx - Shows filtered vs unfiltered count
interface ConstraintPreviewProps {
  constraints: ConstraintDefinition[];
  sampleKeywords: Keyword[];
}

// ConstraintSuggestions.tsx - AI-suggested constraints
interface ConstraintSuggestionsProps {
  clientId: string;
  onAccept: (constraint: ConstraintDefinition) => void;
}
```

### 4.3 Natural Language Interface

Convert natural language to constraints.

```typescript
interface NLConstraint {
  input: string;
  parsed: ConstraintDefinition | null;
  confidence: number;
}

const NL_PATTERNS: Array<{
  regex: RegExp;
  parse: (match: RegExpMatchArray) => ConstraintDefinition;
}> = [
  {
    regex: /only (?:rank for |focus on )?(category|product|blog|location) pages?/i,
    parse: (match) => ({
      constraintType: "page_type",
      operator: "include",
      value: match[1].toLowerCase(),
    }),
  },
  {
    regex: /(?:focus on |only )(transactional|commercial|informational) (?:intent |keywords?)?/i,
    parse: (match) => ({
      constraintType: "intent",
      operator: "include",
      value: match[1].toLowerCase(),
    }),
  },
  {
    regex: /exclude (?:keywords? )?(?:under|below) (\d+)(?: monthly)? searches?/i,
    parse: (match) => ({
      constraintType: "volume",
      operator: "gte",
      field: "searchVolume",
      value: parseInt(match[1]),
    }),
  },
  {
    regex: /avoid (?:competitor )?(?:brand )?(?:terms? )?(?:like |such as )?(.+)/i,
    parse: (match) => ({
      constraintType: "exclusion",
      operator: "none_of",
      value: match[1].split(/,\s*/).map(s => s.trim().toLowerCase()),
    }),
  },
  {
    regex: /only (?:keywords? )?in (.+)/i,
    parse: (match) => ({
      constraintType: "location",
      operator: "any_of",
      value: match[1].split(/,\s*/).map(s => s.trim()),
    }),
  },
];

function parseNaturalLanguage(input: string): NLConstraint {
  for (const pattern of NL_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      return {
        input,
        parsed: pattern.parse(match),
        confidence: 0.9,
      };
    }
  }
  
  // Fallback to AI-based parsing
  return { input, parsed: null, confidence: 0 };
}
```

---

## 5. Filter Execution

### 5.1 In-Memory Filtering (TypeScript)

For real-time filtering in the UI.

```typescript
// src/server/lib/constraints/ConstraintEngine.ts

import type { 
  KeywordConstraintSelect, 
  ConstraintType, 
  ConstraintOperator,
  ConstraintValue,
} from "@/db/constraint-schema";

export interface FilterableKeyword {
  keyword: string;
  searchVolume?: number;
  cpc?: number;
  keywordDifficulty?: number;
  intent?: string;
  pageType?: string;
  category?: string;
  url?: string;
}

export class ConstraintEngine {
  private constraints: KeywordConstraintSelect[];
  
  constructor(constraints: KeywordConstraintSelect[]) {
    this.constraints = constraints.filter(c => c.isActive);
  }
  
  /**
   * Filter keywords through all constraints.
   * Uses AND logic between groups, OR logic within groups.
   */
  filter(keywords: FilterableKeyword[]): FilterableKeyword[] {
    if (this.constraints.length === 0) {
      return keywords;
    }
    
    // Group constraints
    const groups = this.groupConstraints();
    
    return keywords.filter(kw => this.matchesAllGroups(kw, groups));
  }
  
  /**
   * Get statistics about filter effects.
   */
  analyze(keywords: FilterableKeyword[]): FilterAnalysis {
    const total = keywords.length;
    const passed = this.filter(keywords).length;
    const filtered = total - passed;
    
    // Per-constraint breakdown
    const breakdown = this.constraints.map(c => ({
      constraintId: c.id,
      constraintType: c.constraintType,
      operator: c.operator,
      value: c.value,
      filtered: keywords.filter(kw => !this.matchConstraint(kw, c)).length,
    }));
    
    return {
      total,
      passed,
      filtered,
      passRate: total > 0 ? passed / total : 1,
      breakdown,
    };
  }
  
  private groupConstraints(): Map<string | null, KeywordConstraintSelect[]> {
    const groups = new Map<string | null, KeywordConstraintSelect[]>();
    
    for (const constraint of this.constraints) {
      const groupId = constraint.groupId ?? null;
      const existing = groups.get(groupId) ?? [];
      existing.push(constraint);
      groups.set(groupId, existing);
    }
    
    return groups;
  }
  
  private matchesAllGroups(
    keyword: FilterableKeyword,
    groups: Map<string | null, KeywordConstraintSelect[]>
  ): boolean {
    for (const [groupId, constraints] of groups) {
      if (groupId === null) {
        // Standalone constraints: all must match (AND)
        if (!constraints.every(c => this.matchConstraint(keyword, c))) {
          return false;
        }
      } else {
        // Grouped constraints: at least one must match (OR)
        if (!constraints.some(c => this.matchConstraint(keyword, c))) {
          return false;
        }
      }
    }
    return true;
  }
  
  private matchConstraint(
    keyword: FilterableKeyword,
    constraint: KeywordConstraintSelect
  ): boolean {
    const { constraintType, operator, field, value } = constraint;
    
    switch (constraintType) {
      case "page_type":
        return this.matchPageType(keyword, operator, value);
      case "intent":
        return this.matchIntent(keyword, operator, value);
      case "volume":
        return this.matchVolume(keyword, operator, field!, value);
      case "location":
        return this.matchLocation(keyword, operator, value);
      case "exclusion":
        return this.matchExclusion(keyword, operator, value);
      case "inclusion":
        return this.matchInclusion(keyword, operator, value);
      case "category":
        return this.matchCategory(keyword, operator, value);
      default:
        return true;
    }
  }
  
  private matchPageType(
    keyword: FilterableKeyword,
    operator: string,
    value: ConstraintValue
  ): boolean {
    const pageType = keyword.pageType?.toLowerCase() ?? "";
    const values = Array.isArray(value) ? value : [value];
    
    switch (operator) {
      case "include":
      case "any_of":
        return values.some(v => pageType === String(v).toLowerCase());
      case "exclude":
      case "none_of":
        return values.every(v => pageType !== String(v).toLowerCase());
      default:
        return true;
    }
  }
  
  private matchIntent(
    keyword: FilterableKeyword,
    operator: string,
    value: ConstraintValue
  ): boolean {
    const intent = keyword.intent?.toLowerCase() ?? "";
    const values = Array.isArray(value) ? value : [value];
    
    switch (operator) {
      case "include":
      case "any_of":
        return values.some(v => intent === String(v).toLowerCase());
      case "exclude":
      case "none_of":
        return values.every(v => intent !== String(v).toLowerCase());
      default:
        return true;
    }
  }
  
  private matchVolume(
    keyword: FilterableKeyword,
    operator: string,
    field: string,
    value: ConstraintValue
  ): boolean {
    let fieldValue: number | undefined;
    
    switch (field) {
      case "searchVolume":
        fieldValue = keyword.searchVolume;
        break;
      case "cpc":
        fieldValue = keyword.cpc;
        break;
      case "keywordDifficulty":
        fieldValue = keyword.keywordDifficulty;
        break;
      default:
        return true;
    }
    
    if (fieldValue === undefined) {
      return true; // Unknown values pass through
    }
    
    const numValue = typeof value === "number" ? value : parseFloat(String(value));
    
    switch (operator) {
      case "gte":
        return fieldValue >= numValue;
      case "lte":
        return fieldValue <= numValue;
      case "eq":
        return fieldValue === numValue;
      default:
        return true;
    }
  }
  
  private matchLocation(
    keyword: FilterableKeyword,
    operator: string,
    value: ConstraintValue
  ): boolean {
    const kw = keyword.keyword.toLowerCase();
    const values = Array.isArray(value) ? value : [value];
    
    switch (operator) {
      case "contains":
      case "any_of":
        return values.some(v => kw.includes(String(v).toLowerCase()));
      case "not_contains":
      case "none_of":
        return values.every(v => !kw.includes(String(v).toLowerCase()));
      case "all_of":
        return values.every(v => kw.includes(String(v).toLowerCase()));
      default:
        return true;
    }
  }
  
  private matchExclusion(
    keyword: FilterableKeyword,
    operator: string,
    value: ConstraintValue
  ): boolean {
    const kw = keyword.keyword.toLowerCase();
    const values = Array.isArray(value) ? value : [value];
    
    switch (operator) {
      case "none_of":
        return values.every(v => !kw.includes(String(v).toLowerCase()));
      case "not_regex":
        return values.every(v => {
          try {
            return !new RegExp(String(v), "i").test(kw);
          } catch {
            return true;
          }
        });
      default:
        // Default exclusion behavior
        return values.every(v => !kw.includes(String(v).toLowerCase()));
    }
  }
  
  private matchInclusion(
    keyword: FilterableKeyword,
    operator: string,
    value: ConstraintValue
  ): boolean {
    const kw = keyword.keyword.toLowerCase();
    const values = Array.isArray(value) ? value : [value];
    
    switch (operator) {
      case "any_of":
      case "contains":
        return values.some(v => kw.includes(String(v).toLowerCase()));
      case "all_of":
        return values.every(v => kw.includes(String(v).toLowerCase()));
      case "regex":
        return values.some(v => {
          try {
            return new RegExp(String(v), "i").test(kw);
          } catch {
            return false;
          }
        });
      default:
        return true;
    }
  }
  
  private matchCategory(
    keyword: FilterableKeyword,
    operator: string,
    value: ConstraintValue
  ): boolean {
    const category = keyword.category?.toLowerCase() ?? "";
    const values = Array.isArray(value) ? value : [value];
    
    switch (operator) {
      case "include":
      case "any_of":
        return values.some(v => category === String(v).toLowerCase());
      case "exclude":
      case "none_of":
        return values.every(v => category !== String(v).toLowerCase());
      default:
        return true;
    }
  }
}

export interface FilterAnalysis {
  total: number;
  passed: number;
  filtered: number;
  passRate: number;
  breakdown: Array<{
    constraintId: string;
    constraintType: string;
    operator: string;
    value: ConstraintValue;
    filtered: number;
  }>;
}
```

### 5.2 SQL Query Patterns

For database-level filtering when working with large datasets.

```typescript
// src/server/lib/constraints/SqlConstraintBuilder.ts

import { SQL, sql, and, or, gte, lte, eq, like, notLike } from "drizzle-orm";
import type { KeywordConstraintSelect } from "@/db/constraint-schema";

export class SqlConstraintBuilder {
  /**
   * Build a Drizzle WHERE clause from constraints.
   * Returns undefined if no constraints.
   */
  static build(
    constraints: KeywordConstraintSelect[],
    columnMap: ColumnMap
  ): SQL | undefined {
    const activeConstraints = constraints.filter(c => c.isActive);
    
    if (activeConstraints.length === 0) {
      return undefined;
    }
    
    // Group constraints
    const groups = new Map<string | null, KeywordConstraintSelect[]>();
    for (const c of activeConstraints) {
      const groupId = c.groupId ?? null;
      const existing = groups.get(groupId) ?? [];
      existing.push(c);
      groups.set(groupId, existing);
    }
    
    const conditions: SQL[] = [];
    
    for (const [groupId, groupConstraints] of groups) {
      const groupConditions = groupConstraints
        .map(c => this.buildCondition(c, columnMap))
        .filter((c): c is SQL => c !== undefined);
      
      if (groupConditions.length === 0) continue;
      
      if (groupId === null) {
        // Standalone constraints: AND
        conditions.push(...groupConditions);
      } else {
        // Grouped constraints: OR
        conditions.push(or(...groupConditions)!);
      }
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }
  
  private static buildCondition(
    constraint: KeywordConstraintSelect,
    columnMap: ColumnMap
  ): SQL | undefined {
    const { constraintType, operator, field, value } = constraint;
    
    switch (constraintType) {
      case "volume": {
        const column = columnMap[field as keyof ColumnMap];
        if (!column) return undefined;
        
        const numValue = typeof value === "number" 
          ? value 
          : parseInt(String(value));
        
        switch (operator) {
          case "gte": return gte(column, numValue);
          case "lte": return lte(column, numValue);
          case "eq": return eq(column, numValue);
        }
        break;
      }
      
      case "intent": {
        const column = columnMap.intent;
        if (!column) return undefined;
        
        const values = Array.isArray(value) ? value : [value];
        
        switch (operator) {
          case "include":
          case "any_of":
            return or(...values.map(v => eq(column, String(v))));
          case "exclude":
          case "none_of":
            return and(...values.map(v => sql`${column} IS DISTINCT FROM ${v}`));
        }
        break;
      }
      
      case "exclusion": {
        const column = columnMap.keyword;
        if (!column) return undefined;
        
        const values = Array.isArray(value) ? value : [value];
        const conditions = values.map(v => 
          notLike(column, `%${String(v).toLowerCase()}%`)
        );
        return and(...conditions);
      }
      
      case "inclusion": {
        const column = columnMap.keyword;
        if (!column) return undefined;
        
        const values = Array.isArray(value) ? value : [value];
        
        switch (operator) {
          case "any_of":
          case "contains":
            return or(...values.map(v => 
              like(column, `%${String(v).toLowerCase()}%`)
            ));
          case "all_of":
            return and(...values.map(v => 
              like(column, `%${String(v).toLowerCase()}%`)
            ));
        }
        break;
      }
      
      case "location": {
        const column = columnMap.keyword;
        if (!column) return undefined;
        
        const values = Array.isArray(value) ? value : [value];
        
        switch (operator) {
          case "contains":
          case "any_of":
            return or(...values.map(v => 
              sql`LOWER(${column}) LIKE ${"%" + String(v).toLowerCase() + "%"}`
            ));
          case "not_contains":
          case "none_of":
            return and(...values.map(v => 
              sql`LOWER(${column}) NOT LIKE ${"%" + String(v).toLowerCase() + "%"}`
            ));
        }
        break;
      }
      
      case "category": {
        const column = columnMap.category;
        if (!column) return undefined;
        
        const values = Array.isArray(value) ? value : [value];
        
        switch (operator) {
          case "include":
          case "any_of":
            return or(...values.map(v => eq(column, String(v))));
          case "exclude":
          case "none_of":
            return and(...values.map(v => sql`${column} IS DISTINCT FROM ${v}`));
        }
        break;
      }
    }
    
    return undefined;
  }
}

interface ColumnMap {
  keyword: SQL;
  searchVolume?: SQL;
  cpc?: SQL;
  keywordDifficulty?: SQL;
  intent?: SQL;
  pageType?: SQL;
  category?: SQL;
}
```

### 5.3 Performance Optimization

For filtering 10K+ keywords efficiently:

```typescript
// 1. Database-level filtering preferred
async function filterKeywordsFromDb(
  clientId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<FilterableKeyword[]> {
  const constraints = await getClientConstraints(clientId);
  
  const whereClause = SqlConstraintBuilder.build(constraints, {
    keyword: sql`${savedKeywords.keyword}`,
    searchVolume: sql`${keywordMetrics.searchVolume}`,
    cpc: sql`${keywordMetrics.cpc}`,
    keywordDifficulty: sql`${keywordMetrics.keywordDifficulty}`,
    intent: sql`${keywordMetrics.intent}`,
  });
  
  return db
    .select()
    .from(savedKeywords)
    .leftJoin(keywordMetrics, eq(savedKeywords.id, keywordMetrics.keywordId))
    .where(whereClause)
    .limit(options.limit ?? 1000)
    .offset(options.offset ?? 0);
}

// 2. Indexed columns for common constraints
// Add indexes on frequently filtered columns:
// - ix_keyword_metrics_search_volume
// - ix_keyword_metrics_intent
// - ix_keyword_metrics_difficulty

// 3. Batch processing for large datasets
async function filterKeywordsInBatches(
  keywords: FilterableKeyword[],
  constraints: KeywordConstraintSelect[],
  batchSize: number = 1000
): Promise<FilterableKeyword[]> {
  const engine = new ConstraintEngine(constraints);
  const results: FilterableKeyword[] = [];
  
  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);
    const filtered = engine.filter(batch);
    results.push(...filtered);
  }
  
  return results;
}

// 4. Pre-computed constraint hash for caching
function computeConstraintHash(constraints: KeywordConstraintSelect[]): string {
  const normalized = constraints
    .filter(c => c.isActive)
    .map(c => ({
      type: c.constraintType,
      op: c.operator,
      field: c.field,
      value: c.value,
      group: c.groupId,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .slice(0, 16);
}
```

### 5.4 Incremental Filtering

Apply constraints as new keywords are discovered.

```typescript
// src/server/lib/constraints/IncrementalFilter.ts

export class IncrementalConstraintFilter {
  private engine: ConstraintEngine;
  private constraintHash: string;
  
  constructor(constraints: KeywordConstraintSelect[]) {
    this.engine = new ConstraintEngine(constraints);
    this.constraintHash = computeConstraintHash(constraints);
  }
  
  /**
   * Filter newly discovered keywords and persist results.
   */
  async filterNew(
    clientId: string,
    newKeywords: FilterableKeyword[]
  ): Promise<{
    passed: FilterableKeyword[];
    filtered: FilterableKeyword[];
  }> {
    const passed = this.engine.filter(newKeywords);
    const passedSet = new Set(passed.map(k => k.keyword));
    const filtered = newKeywords.filter(k => !passedSet.has(k.keyword));
    
    // Log filtering results for audit
    await db.insert(keywordConstraintAudit).values({
      id: generateId(),
      constraintSetId: null, // Set if applicable
      action: "applied",
      changedBy: "system",
      newValue: {
        constraintHash: this.constraintHash,
        totalNew: newKeywords.length,
        passed: passed.length,
        filtered: filtered.length,
      },
      keywordsAffected: filtered.length,
    });
    
    return { passed, filtered };
  }
  
  /**
   * Re-apply constraints when rules change.
   */
  async refilterAll(clientId: string): Promise<void> {
    // Get all client keywords
    const allKeywords = await getClientKeywords(clientId);
    
    // Re-apply constraints
    const passed = this.engine.filter(allKeywords);
    const passedIds = new Set(passed.map(k => k.id));
    
    // Update keyword status in bulk
    await db
      .update(savedKeywords)
      .set({ isFiltered: true })
      .where(
        and(
          eq(savedKeywords.clientId, clientId),
          notInArray(savedKeywords.id, Array.from(passedIds))
        )
      );
    
    await db
      .update(savedKeywords)
      .set({ isFiltered: false })
      .where(
        and(
          eq(savedKeywords.clientId, clientId),
          inArray(savedKeywords.id, Array.from(passedIds))
        )
      );
  }
}
```

---

## 6. API Endpoints

```typescript
// src/server/features/constraints/router.ts

import { createTRPCRouter, protectedProcedure } from "@/server/lib/trpc";
import { z } from "zod";

export const constraintRouter = createTRPCRouter({
  // Get constraint sets for a client
  getSets: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(keywordConstraintSets)
        .where(eq(keywordConstraintSets.clientId, input.clientId))
        .orderBy(desc(keywordConstraintSets.priority));
    }),
  
  // Get constraints for a set
  getConstraints: protectedProcedure
    .input(z.object({ setId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(keywordConstraints)
        .where(eq(keywordConstraints.constraintSetId, input.setId));
    }),
  
  // Create constraint set
  createSet: protectedProcedure
    .input(z.object({
      clientId: z.string(),
      name: z.string(),
      description: z.string().optional(),
      constraints: z.array(ConstraintDefinitionSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const setId = generateId();
      
      await ctx.db.transaction(async (tx) => {
        await tx.insert(keywordConstraintSets).values({
          id: setId,
          clientId: input.clientId,
          workspaceId: ctx.session.organizationId,
          name: input.name,
          description: input.description,
        });
        
        if (input.constraints.length > 0) {
          await tx.insert(keywordConstraints).values(
            input.constraints.map(c => ({
              id: generateId(),
              constraintSetId: setId,
              ...c,
            }))
          );
        }
      });
      
      return { id: setId };
    }),
  
  // Update constraint
  updateConstraint: protectedProcedure
    .input(z.object({
      id: z.string(),
      updates: ConstraintUpdateSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(keywordConstraints)
        .where(eq(keywordConstraints.id, input.id));
      
      await ctx.db
        .update(keywordConstraints)
        .set(input.updates)
        .where(eq(keywordConstraints.id, input.id));
      
      // Audit log
      await ctx.db.insert(keywordConstraintAudit).values({
        id: generateId(),
        constraintSetId: existing.constraintSetId,
        constraintId: input.id,
        action: "updated",
        changedBy: ctx.session.userId,
        previousValue: existing,
        newValue: { ...existing, ...input.updates },
      });
    }),
  
  // Preview filter effects
  preview: protectedProcedure
    .input(z.object({
      clientId: z.string(),
      constraints: z.array(ConstraintDefinitionSchema),
    }))
    .query(async ({ ctx, input }) => {
      // Get sample keywords
      const keywords = await getClientKeywords(input.clientId, { limit: 1000 });
      
      // Apply constraints
      const engine = new ConstraintEngine(
        input.constraints.map((c, i) => ({
          id: `preview-${i}`,
          constraintSetId: "preview",
          isActive: true,
          createdAt: new Date(),
          ...c,
        }))
      );
      
      return engine.analyze(keywords);
    }),
  
  // Get suggested constraints
  suggest: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const analysis = await analyzeClientContent(input.clientId);
      return suggestConstraints(analysis);
    }),
  
  // Parse natural language
  parseNL: protectedProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return parseNaturalLanguage(input.text);
    }),
  
  // Get templates
  getTemplates: protectedProcedure
    .input(z.object({ businessType: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const query = ctx.db.select().from(keywordConstraintTemplates);
      
      if (input.businessType) {
        return query.where(
          eq(keywordConstraintTemplates.businessType, input.businessType)
        );
      }
      
      return query;
    }),
});
```

---

## 7. Integration Points

### 7.1 Opportunity Discovery Integration

Apply constraints when generating opportunity keywords.

```typescript
// In OpportunityDiscoveryService.ts
async function discoverOpportunities(clientId: string): Promise<OpportunityKeyword[]> {
  // Generate raw opportunities
  const rawOpportunities = await generateKeywordOpportunities(businessInfo);
  
  // Get client constraints
  const constraints = await getActiveConstraints(clientId);
  
  // Filter through constraint engine
  const engine = new ConstraintEngine(constraints);
  const filtered = engine.filter(
    rawOpportunities.map(k => ({
      keyword: k.keyword,
      searchVolume: k.searchVolume,
      keywordDifficulty: k.difficulty,
      category: k.category,
    }))
  );
  
  // Map back to opportunity keywords
  return rawOpportunities.filter(k => 
    filtered.some(f => f.keyword === k.keyword)
  );
}
```

### 7.2 Gap Analysis Integration

Apply constraints when computing keyword gaps.

```typescript
// In KeywordGapService.ts
async function analyzeGaps(
  clientDomain: string,
  competitorDomains: string[],
  clientId: string
): Promise<KeywordGap[]> {
  // Get raw gaps from DataForSEO
  const rawGaps = await fetchDomainIntersection(clientDomain, competitorDomains);
  
  // Get client constraints
  const constraints = await getActiveConstraints(clientId);
  
  // Filter gaps
  const engine = new ConstraintEngine(constraints);
  const filtered = engine.filter(
    rawGaps.map(g => ({
      keyword: g.keyword,
      searchVolume: g.searchVolume,
      keywordDifficulty: g.difficulty,
    }))
  );
  
  return rawGaps.filter(g => 
    filtered.some(f => f.keyword === g.keyword)
  );
}
```

### 7.3 Ranking Tracker Integration

Filter tracked keywords by constraints.

```typescript
// In RankingService.ts
async function getFilteredRankings(clientId: string): Promise<KeywordRanking[]> {
  const constraints = await getActiveConstraints(clientId);
  
  // Build SQL filter
  const whereClause = SqlConstraintBuilder.build(constraints, {
    keyword: sql`${savedKeywords.keyword}`,
    searchVolume: sql`${keywordMetrics.searchVolume}`,
  });
  
  return db
    .select()
    .from(keywordRankings)
    .innerJoin(savedKeywords, eq(keywordRankings.keywordId, savedKeywords.id))
    .leftJoin(keywordMetrics, eq(savedKeywords.id, keywordMetrics.keywordId))
    .where(and(
      eq(savedKeywords.clientId, clientId),
      whereClause
    ));
}
```

---

## 8. Testing Strategy

```typescript
// src/server/lib/constraints/ConstraintEngine.test.ts

describe("ConstraintEngine", () => {
  const sampleKeywords: FilterableKeyword[] = [
    { keyword: "buy sauna online", searchVolume: 500, intent: "transactional" },
    { keyword: "how to install sauna", searchVolume: 200, intent: "informational" },
    { keyword: "ikea sauna heater", searchVolume: 100, intent: "navigational" },
    { keyword: "sauna dallas tx", searchVolume: 50, intent: "transactional" },
    { keyword: "outdoor sauna guide", searchVolume: 300, intent: "informational" },
  ];
  
  describe("volume constraints", () => {
    it("filters by minimum volume", () => {
      const engine = new ConstraintEngine([
        createConstraint("volume", "gte", "searchVolume", 200),
      ]);
      const result = engine.filter(sampleKeywords);
      expect(result).toHaveLength(3);
      expect(result.every(k => (k.searchVolume ?? 0) >= 200)).toBe(true);
    });
  });
  
  describe("intent constraints", () => {
    it("includes only transactional", () => {
      const engine = new ConstraintEngine([
        createConstraint("intent", "include", undefined, "transactional"),
      ]);
      const result = engine.filter(sampleKeywords);
      expect(result).toHaveLength(2);
    });
    
    it("excludes informational", () => {
      const engine = new ConstraintEngine([
        createConstraint("intent", "exclude", undefined, "informational"),
      ]);
      const result = engine.filter(sampleKeywords);
      expect(result).toHaveLength(3);
    });
  });
  
  describe("exclusion constraints", () => {
    it("excludes competitor brands", () => {
      const engine = new ConstraintEngine([
        createConstraint("exclusion", "none_of", undefined, ["ikea"]),
      ]);
      const result = engine.filter(sampleKeywords);
      expect(result).toHaveLength(4);
      expect(result.every(k => !k.keyword.includes("ikea"))).toBe(true);
    });
  });
  
  describe("location constraints", () => {
    it("includes keywords with location", () => {
      const engine = new ConstraintEngine([
        createConstraint("location", "contains", undefined, "dallas"),
      ]);
      const result = engine.filter(sampleKeywords);
      expect(result).toHaveLength(1);
    });
  });
  
  describe("AND/OR logic", () => {
    it("applies AND between groups", () => {
      const engine = new ConstraintEngine([
        createConstraint("intent", "include", undefined, "transactional"),
        createConstraint("volume", "gte", "searchVolume", 100),
      ]);
      const result = engine.filter(sampleKeywords);
      expect(result).toHaveLength(2); // buy sauna online, sauna dallas tx
    });
    
    it("applies OR within groups", () => {
      const engine = new ConstraintEngine([
        createConstraint("intent", "include", undefined, "transactional", "intent-group"),
        createConstraint("intent", "include", undefined, "informational", "intent-group"),
      ]);
      const result = engine.filter(sampleKeywords);
      expect(result).toHaveLength(4); // All except navigational
    });
  });
});
```

---

## 9. Migration Plan

### Phase 1: Schema & Core Engine
1. Create database tables
2. Implement ConstraintEngine class
3. Add unit tests

### Phase 2: API & UI
1. Implement TRPC endpoints
2. Build constraint builder UI
3. Add constraint preview component

### Phase 3: Integration
1. Integrate with OpportunityDiscovery
2. Integrate with GapAnalysis
3. Integrate with RankingTracker

### Phase 4: Intelligence
1. Implement content analysis
2. Build suggestion engine
3. Add NLP parsing

---

## 10. Future Enhancements

1. **Machine Learning Suggestions** - Train model on successful client targeting patterns
2. **Constraint Effectiveness Scoring** - Track which constraints correlate with ranking success
3. **A/B Testing** - Test different constraint sets against each other
4. **Constraint Marketplace** - Share templates across workspaces
5. **Real-time Sync** - Push constraint updates to connected dashboards via WebSocket
