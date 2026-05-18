# World-Class Variable/Template System Analysis

**Researched:** 2026-05-16
**Domain:** Template variable syntax, conditional logic, loops, computed fields, AI-powered variables
**Confidence:** HIGH

---

## Executive Summary

The current plan uses `{{variable.path}}` syntax with pipe-delimited filters (`|currency:EUR`, `|truncate:50`). This analysis confirms this is the **correct architectural choice** for 2026 document builders, aligning with industry standards (Liquid, Handlebars, Mailchimp, HubSpot) while being intuitive for non-developers.

**Key findings:**

1. **Liquid-style syntax is the 2026 standard** for document/email templates. The `{{ value | filter }}` pattern is battle-tested across Shopify (4M+ storefronts), email platforms, and proposal tools.

2. **Conditional logic should use visual builders** for non-technical users, with fallback to `{% if %}` syntax for power users. Pure WYSIWYG conditionals (like PandaDoc) reduce template errors.

3. **AI-powered variables are emerging** but carry cost/latency concerns. A hybrid approach (cached AI generation + manual override) is recommended.

4. **The existing TeveroSEO variable system is already well-designed** (variable-definitions-schema.ts + VariableExtension.ts). Phase 102 should extend, not replace it.

**Primary recommendation:** Keep `{{variable.path|filter}}` syntax. Add visual conditional builder UI. Implement loop syntax (`{% for %}`) for repeating sections. Consider AI variables as a premium feature with explicit cost indicators.

---

## 1. Syntax Comparison

| Engine | Variable Syntax | Filter Syntax | Conditional | Loop | Non-Dev Friendly |
|--------|----------------|---------------|-------------|------|------------------|
| **Mustache** | `{{variable}}` | None | `{{#if}}` sections only | `{{#each}}` | HIGH (minimal) |
| **Handlebars** | `{{variable}}` | Helpers: `{{helper var}}` | `{{#if}}`, `{{#unless}}` | `{{#each}}` | HIGH |
| **Liquid** | `{{ variable }}` | `{{ var \| filter: arg }}` | `{% if %}`, `{% elsif %}` | `{% for %}` | MEDIUM-HIGH |
| **Nunjucks/Jinja2** | `{{ variable }}` | `{{ var \| filter(arg) }}` | `{% if %}`, `{% elif %}` | `{% for %}` | MEDIUM |
| **EJS** | `<%= variable %>` | None (JS functions) | `<% if () { %>` | `<% for () { %>` | LOW |
| **MDX/JSX** | `{variable}` | JS expressions | `{cond && <X/>}` | `.map()` | LOW (developers only) |
| **Mailchimp** | `*\|MERGE\|*` | Built-in only | `*\|IF:MERGE\|*` | Group tags | HIGH (GUI) |
| **HubSpot** | `{{ variable }}` (HubL) | `{{ var \| filter }}` | `{% if %}` (HubL) | `{% for %}` | MEDIUM |
| **PandaDoc** | `[variable]` | None | Visual rules | Visual repeaters | HIGH (GUI) |

**Source:** [StackShare Template Engine Comparisons](https://stackshare.io/stackups/liquid-vs-mustache), [Colorlib JavaScript Templating Engines 2026](https://colorlib.com/wp/top-templating-engines-for-javascript/)

### Recommendation: Liquid-Style with TeveroSEO Extensions

```
Current (Phase 57):   {{variable.path}}
Proposed (Phase 102): {{variable.path|filter:arg1:arg2}}
```

**Why Liquid-style wins:**
- Pipe `|` is intuitive (reads left-to-right like Unix pipes)
- Filter arguments with `:` are cleaner than function parentheses
- 4M+ Shopify stores use this syntax (massive community familiarity)
- HubSpot, Mailchimp, and most email tools use similar patterns
- Non-developers can read `{{price|currency:EUR}}` as "price in EUR currency"

**Source:** [Shopify Liquid Introduction](https://shopify.github.io/liquid/basics/introduction/), [LiquidJS Documentation](https://liquidjs.com/tutorials/intro-to-liquid.html)

---

## 2. Conditional Logic Approaches

### 2.1 Syntax-Based Conditionals

| Pattern | Example | Use Case |
|---------|---------|----------|
| **Simple if** | `{% if score > 80 %}A{% endif %}` | Single condition |
| **If/else** | `{% if premium %}{{premium_content}}{% else %}{{standard}}{% endif %}` | Binary choice |
| **Elsif chain** | `{% if tier == 'gold' %}...{% elsif tier == 'silver' %}...{% else %}...{% endif %}` | Multiple branches |
| **Unless** | `{% unless banned %}Show content{% endunless %}` | Negation |
| **Case/when** | `{% case product.type %}{% when "shirt" %}Clothing{% endcase %}` | Switch statement |

**Operators supported (Liquid standard):**
- Comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Logic: `and`, `or`
- Contains: `contains` (for strings/arrays)

**Source:** [LiquidJS Conditionals](https://liquidjs.com/tutorials/intro-to-liquid.html), [Handlebars Built-in Helpers](https://handlebarsjs.com/guide/builtin-helpers.html)

### 2.2 Visual Conditional Builder (No-Code)

Modern document builders (PandaDoc, Docupilot) use **visual rule builders** instead of syntax:

```
+---------------------------------------------+
| CONDITION BUILDER                           |
+---------------------------------------------+
| IF   [prospect.tier ▼] [equals ▼] [Gold ▼] |
|      THEN show: [Premium Services Block]    |
| ELSE show: [Standard Services Block]        |
+---------------------------------------------+
```

**Key UI patterns:**

1. **Dropdown selectors** for field, operator, value
2. **Drag-drop blocks** for "then show" targets
3. **Add rule** button for AND/OR combinations
4. **Preview toggle** to test conditions with sample data

**Source:** [PandaDoc Conditional Content](https://support.pandadoc.com/en/articles/9714634-smart-content-block-conditional-content), [WeWeb No-Code UI Builder](https://www.weweb.io/ui-builder-nocode)

### 2.3 Recommendation: Hybrid Approach

| User Type | Interface | Stored As |
|-----------|-----------|-----------|
| Sales rep (non-technical) | Visual conditional builder | JSON rules |
| Template designer (power user) | Liquid syntax in editor | Raw template |
| Developer (API) | Direct JSON/Liquid | Either format |

**JSON rule format (for visual builder):**
```typescript
interface ConditionalRule {
  id: string;
  conditions: {
    field: string;        // "prospect.tier"
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'exists';
    value: string | number | boolean;
    logic?: 'and' | 'or'; // For chaining
  }[];
  thenShow: string[];     // Block IDs to show
  elseShow?: string[];    // Block IDs for else branch
}
```

**Conversion to Liquid at render time:**
```typescript
function rulesToLiquid(rule: ConditionalRule): string {
  const conditions = rule.conditions.map(c => 
    `${c.field} ${operatorMap[c.operator]} ${JSON.stringify(c.value)}`
  ).join(` ${rule.conditions[0]?.logic || 'and'} `);
  
  return `{% if ${conditions} %}
    {{ blocks.${rule.thenShow.join('}} {{ blocks.')} }}
  {% else %}
    {{ blocks.${rule.elseShow?.join('}} {{ blocks.')} }}
  {% endif %}`;
}
```

---

## 3. Loop/Repeater Patterns

### 3.1 Syntax Comparison

| Engine | Loop Syntax | Index Access | First/Last | Break/Continue |
|--------|------------|--------------|------------|----------------|
| **Liquid** | `{% for item in items %}` | `{{ forloop.index }}` | `forloop.first/last` | `{% break %}` |
| **Handlebars** | `{{#each items}}` | `{{@index}}` | `{{@first}}/{{@last}}` | No |
| **Nunjucks** | `{% for item in items %}` | `{{ loop.index }}` | `loop.first/last` | Yes |

**Common use cases in proposals:**
- Repeating table rows (services, pricing tiers)
- Bullet list expansion (deliverables, inclusions)
- Team member cards
- FAQ items

**Source:** [Liquid Iteration Tags](https://shopify.github.io/liquid/tags/iteration/), [Handlebars #each Helper](https://handlebarsjs.com/guide/builtin-helpers.html)

### 3.2 Visual Loop Builder

For non-technical users, provide a **visual repeater** UI:

```
+--------------------------------------------------+
| REPEATER: Services Table                         |
+--------------------------------------------------+
| Data source: [proposal.services ▼]               |
| For each item, show:                             |
|   +------------------------------------------+   |
|   | [Row Template]                           |   |
|   | {{item.name}} | {{item.price|currency}}  |   |
|   +------------------------------------------+   |
| Sort by: [price ▼] [Descending ▼]               |
| Limit: [All ▼]                                   |
+--------------------------------------------------+
```

**Features:**
- **Data source picker**: Select array field from available data
- **Item template**: Visual block editor for each iteration
- **Sort/filter**: Optional ordering and limiting
- **Empty state**: What to show when array is empty

### 3.3 Recommendation: Liquid `{% for %}` with Visual Builder

**Syntax:**
```liquid
{% for service in proposal.services %}
  <tr>
    <td>{{ service.name }}</td>
    <td>{{ service.price | currency: "EUR" }}</td>
  </tr>
{% else %}
  <tr><td colspan="2">No services selected</td></tr>
{% endfor %}
```

**Loop variables available:**
- `forloop.index` (1-based)
- `forloop.index0` (0-based)
- `forloop.first`, `forloop.last`
- `forloop.length`

**Modifiers:**
- `{% for item in items limit:5 %}` - First 5 only
- `{% for item in items offset:2 %}` - Skip first 2
- `{% for item in items reversed %}` - Reverse order

---

## 4. Computed/Formula Variables

### 4.1 Current State (TeveroSEO)

The existing `variable-definitions-schema.ts` already supports computed variables:

```typescript
sourceType: "computed",
computation: "calculateAnnualTotal", // Function name
```

This is a **function-based approach**: computations are predefined server-side functions.

### 4.2 Excel-Style Formula System

| Platform | Formula Syntax | Example |
|----------|---------------|---------|
| **Notion** | `prop("Field")` + functions | `if(prop("Age") < 18, "Minor", "Adult")` |
| **Airtable** | `{Field}` + functions | `{Price} * {Quantity}` |
| **Coda** | Named formulas | `SUM(Tasks.Hours)` |
| **Excel** | `=FORMULA(A1)` | `=IF(A1>100, "High", "Low")` |

**Source:** [Notion Formula Syntax](https://www.notion.com/help/formula-syntax), [Airtable Formula Reference](https://support.airtable.com/docs/formula-field-reference)

### 4.3 Recommendation: Extend Filter System for Computations

Instead of adding a full formula language, extend the filter system:

```liquid
{{ proposal.monthlyFee | multiply: 12 | add: proposal.setupFee | currency: "EUR" }}
```

**Proposed computation filters:**
```typescript
const COMPUTATION_FILTERS = {
  // Math
  add: (value, n) => Number(value) + Number(n),
  subtract: (value, n) => Number(value) - Number(n),
  multiply: (value, n) => Number(value) * Number(n),
  divide: (value, n) => Number(value) / Number(n),
  round: (value, decimals = 0) => Number(value).toFixed(decimals),
  
  // Array
  size: (arr) => Array.isArray(arr) ? arr.length : 0,
  first: (arr) => arr?.[0],
  last: (arr) => arr?.[arr.length - 1],
  join: (arr, separator = ', ') => arr?.join(separator),
  sum: (arr, field) => arr?.reduce((acc, item) => acc + Number(item[field] || 0), 0),
  
  // String
  truncate: (str, length, ellipsis = '...') => str.length > length ? str.slice(0, length - ellipsis.length) + ellipsis : str,
  upcase: (str) => String(str).toUpperCase(),
  downcase: (str) => String(str).toLowerCase(),
  capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
  
  // Date
  date: (value, format = 'long') => formatDate(value, format),
  date_add: (value, days) => addDays(new Date(value), days),
  
  // Formatting
  currency: (value, code = 'EUR', locale = 'lt-LT') => formatCurrency(value, code, locale),
  number: (value, decimals = 0) => formatNumber(value, decimals),
  percentage: (value, decimals = 0) => `${(Number(value) * 100).toFixed(decimals)}%`,
};
```

**Why filters over formulas:**
- Simpler mental model (data flows through pipes)
- Safer (no arbitrary code execution)
- Composable (chain multiple filters)
- Familiar to Liquid/Shopify users

---

## 5. AI-Powered Variables

### 5.1 Emerging Patterns

| Pattern | Example | Use Case |
|---------|---------|----------|
| **AI summary** | `{{ai.summarize: audit.findings}}` | Condense long content |
| **AI translate** | `{{ai.translate: content : lt}}` | Multilingual proposals |
| **AI rewrite** | `{{ai.rewrite: cta : persuasive}}` | Tone adjustment |
| **AI fill** | `{{ai.complete: industry_insight}}` | Dynamic content generation |

**Source:** [Microsoft Fabric AI Functions](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/pandas/summarize), [Coda AI Columns](https://help.coda.io/en/articles/7988177-coda-ai-features)

### 5.2 Cost/Latency Concerns

**Current model costs (CLAUDE.md):**
- Gemini 3.1 Pro: $1.25/1M tokens
- Grok 4.1-fast: $0.20/1M tokens

**Per-variable AI call impact:**
| Operation | Tokens | Cost | Latency |
|-----------|--------|------|---------|
| Summarize 500 words | ~800 | $0.001 | 1-2s |
| Translate 200 words | ~400 | $0.0005 | 0.5-1s |
| Generate insight | ~1000 | $0.00125 | 1-3s |
| Document with 10 AI vars | ~5000 | $0.00625 | 5-15s |

**Risk:** AI latency at render time makes real-time preview impossible.

### 5.3 Recommendation: Cached AI Generation

**Architecture:**
```
1. Template contains AI variable: {{ai.summarize: audit.findings}}
2. On template save OR prospect attach, trigger background job
3. AI generates value, stores in ai_variable_cache table
4. At render time, read from cache (instant)
5. "Regenerate" button allows manual refresh
```

**Database schema:**
```sql
CREATE TABLE ai_variable_cache (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  variable_key TEXT NOT NULL,
  input_hash TEXT NOT NULL,       -- Hash of input data (detect changes)
  generated_value TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  model_used TEXT NOT NULL,
  cost_cents INTEGER NOT NULL,    -- Track cost per generation
  UNIQUE(document_id, variable_key)
);
```

**UI indicators:**
- Green checkmark: Cached, fresh
- Yellow clock: Cached, input changed (stale)
- Gray spinner: Generating
- Cost badge: "~EUR 0.01" shown before generation

---

## 6. Visual Variable Builder Patterns

### 6.1 Field Picker UI

**Best practices from CKEditor 5, HubSpot, PandaDoc:**

```
+--------------------------------------------------+
| INSERT VARIABLE                             [x]  |
+--------------------------------------------------+
| Search: [___________________________] [Search]   |
|                                                  |
| CATEGORIES                                       |
| [*] Client (Blue)                               |
|     - {{client.name}}                           |
|     - {{client.website}}                        |
|     - {{client.contactName}}                    |
| [ ] Provider (Green)                            |
| [ ] Pricing (Orange)                            |
| [ ] Audit (Purple)                              |
| [ ] Dates (Gray)                                |
| [ ] Custom (Teal)                               |
|                                                  |
| RECENTLY USED                                    |
| {{client.name}} {{totals.monthly}} {{today}}    |
+--------------------------------------------------+
```

**Features:**
- Category collapse/expand with color coding
- Fuzzy search across all variables
- Recently used for quick access
- Keyboard navigation (arrow keys + Enter)
- Preview tooltip showing current value

**Source:** [CKEditor 5 Merge Fields](https://ckeditor.com/docs/ckeditor5/latest/features/merge-fields.html)

### 6.2 Filter Builder UI

After selecting a variable, offer filter options:

```
+--------------------------------------------------+
| CONFIGURE: {{totals.monthly}}                    |
+--------------------------------------------------+
| FILTERS (applied in order)                       |
| 1. [Currency ▼] Symbol: [EUR ▼]                 |
| 2. [+ Add filter]                               |
|                                                  |
| PREVIEW                                          |
| Raw value: 150000 (cents)                       |
| Formatted: EUR 1,500.00                          |
|                                                  |
| [Cancel] [Insert]                               |
+--------------------------------------------------+
```

### 6.3 Live Preview with Sample Data

**Pattern:** Always show resolved values alongside variable syntax.

```
+--------------------------------------------------+
| EDITOR                    | PREVIEW              |
+--------------------------------------------------+
| Dear {{client.name}},     | Dear Plaukupasaka,  |
|                           |                      |
| Your SEO score is         | Your SEO score is   |
| {{audit.score}}.          | 47.                 |
|                           |                      |
| Investment:               | Investment:          |
| {{totals.monthly|         | EUR 450.00/month    |
|   currency:EUR}}/month    |                      |
+--------------------------------------------------+
```

**Implementation:**
- Use existing `resolveVariable()` from variable-definitions-schema.ts
- Sample data from prospect/proposal context
- Toggle button: "Preview" / "Edit"
- Unresolved variables shown with red dashed border

**Source:** [UI-Patterns Live Preview](https://ui-patterns.com/patterns/LivePreview)

---

## 7. Best-in-Class Examples

### 7.1 Webflow CMS

**How it works:**
- Collections define data schema (like database tables)
- Dynamic content binds fields to visual elements
- Variables auto-update when source data changes
- No template syntax exposed to user (pure visual binding)

**What to adopt:**
- Collection-based data sources (Prospects, Proposals, Audits)
- Visual field picker from collections
- Real-time preview updates

**Source:** [Webflow CMS Guide](https://university.webflow.com/courses/cms-and-dynamic-content), [Webflow Variables](https://help.webflow.com/hc/en-us/articles/33961268146323-Variables)

### 7.2 Notion Databases

**How it works:**
- `prop("Field")` references column values
- Formula columns compute derived values
- `if(condition, then, else)` for conditionals
- Rollups aggregate related data

**What to adopt:**
- `prop()` style for explicit property references
- Local variables with `let()` for complex computations
- Relation traversal: `prop("Project").prop("Status")`

**Source:** [Notion Formula Cheat Sheet 2026](https://thomasjfrank.com/notion-formula-cheat-sheet/)

### 7.3 Airtable Formulas

**How it works:**
- `{Field}` references columns
- Functions like `IF()`, `SUM()`, `CONCATENATE()`
- Rollup fields aggregate linked records
- Array functions for complex data manipulation

**What to adopt:**
- Explicit `{Field}` brackets for field references
- Array aggregation functions
- Conditional rollups (filter before aggregating)

**Source:** [Airtable Formula Reference](https://support.airtable.com/docs/formula-field-reference)

### 7.4 Mailchimp Merge Tags

**How it works:**
- `*|MERGE|*` syntax with asterisks and pipes
- Conditionals: `*|IF:MERGE=value|*...*|END:IF|*`
- Groups: `*|INTERESTED:Category:Value|*`
- Fallbacks: `*|FNAME,Friend|*` (use "Friend" if FNAME empty)

**What to adopt:**
- Default/fallback values inline: `{{client.name,Valued Customer}}`
- Group-based conditionals for segmentation

**Source:** [Mailchimp Merge Tags Cheat Sheet](https://mailchimp.com/help/all-the-merge-tags-cheat-sheet/)

### 7.5 HubSpot Personalization

**How it works:**
- HubL templating language (Jinja2-inspired)
- Tokens from CRM properties
- Smart content rules for segment-based variations
- Default values set globally or per-token

**What to adopt:**
- Global default values (workspace settings)
- Per-token fallbacks (in template)
- Smart content concept (show different blocks to different segments)

**Source:** [HubSpot Personalization Tokens](https://knowledge.hubspot.com/marketing-email/use-personalization-tokens)

---

## 8. Recommended System for Phase 102

### 8.1 Variable Syntax

**Keep current syntax, extend with filters:**

```
{{category.field}}              -- Basic variable
{{category.field|filter}}       -- Single filter
{{category.field|f1|f2:arg}}    -- Chained filters with arguments
{{category.field,Default}}      -- Fallback value
```

**Examples:**
```liquid
{{client.name}}                           -- "Plaukupasaka"
{{totals.monthly|currency:EUR}}           -- "EUR 450.00"
{{proposal.createdAt|date:long}}          -- "2026 m. geguzis 16 d."
{{client.name|upcase}}                    -- "PLAUKUPASAKA"
{{services.list|join:, }}                 -- "SEO, Content, Links"
{{custom.discount,0}}                     -- "15" or "0" if unset
```

### 8.2 Conditional Syntax

**Liquid-style for power users:**
```liquid
{% if prospect.tier == 'enterprise' %}
  {{block:enterprise_pricing}}
{% elsif prospect.tier == 'growth' %}
  {{block:growth_pricing}}
{% else %}
  {{block:starter_pricing}}
{% endif %}
```

**Visual builder for non-technical users:**
- JSON rules stored in block metadata
- Converted to Liquid at render time

### 8.3 Loop Syntax

```liquid
{% for service in proposal.services %}
  | {{service.name}} | {{service.price|currency:EUR}} |
{% else %}
  | No services selected | - |
{% endfor %}
```

**Special loop variables:**
- `forloop.index` (1-based)
- `forloop.first`, `forloop.last`
- `forloop.length`

### 8.4 Filter Library

**Core filters (immediate implementation):**

| Filter | Arguments | Example | Output |
|--------|-----------|---------|--------|
| `currency` | code, locale | `{{price\|currency:EUR}}` | "EUR 1,500.00" |
| `date` | format | `{{today\|date:long}}` | "2026 m. geguzis 16 d." |
| `number` | decimals | `{{score\|number:1}}` | "87.5" |
| `percentage` | decimals | `{{rate\|percentage:0}}` | "15%" |
| `truncate` | length | `{{desc\|truncate:50}}` | "Lorem ipsum..." |
| `upcase` | - | `{{name\|upcase}}` | "ACME CORP" |
| `downcase` | - | `{{name\|downcase}}` | "acme corp" |
| `capitalize` | - | `{{name\|capitalize}}` | "Acme corp" |
| `join` | separator | `{{list\|join:, }}` | "a, b, c" |
| `size` | - | `{{items\|size}}` | "5" |
| `first` | - | `{{items\|first}}` | "item1" |
| `last` | - | `{{items\|last}}` | "item5" |

**Computation filters (Phase 2):**

| Filter | Arguments | Example | Output |
|--------|-----------|---------|--------|
| `add` | n | `{{monthly\|multiply:12\|add:setup}}` | annual total |
| `subtract` | n | `{{total\|subtract:discount}}` | net total |
| `multiply` | n | `{{monthly\|multiply:12}}` | annual |
| `divide` | n | `{{total\|divide:12}}` | monthly |
| `round` | decimals | `{{avg\|round:2}}` | "87.65" |

**AI filters (Phase 3, premium):**

| Filter | Arguments | Example | Cost |
|--------|-----------|---------|------|
| `ai_summarize` | max_words | `{{findings\|ai_summarize:50}}` | ~$0.001 |
| `ai_translate` | target_lang | `{{content\|ai_translate:lt}}` | ~$0.0005 |
| `ai_tone` | style | `{{cta\|ai_tone:persuasive}}` | ~$0.001 |

### 8.5 Implementation Stack

**Use LiquidJS as the template engine:**
- Pure JavaScript, runs in Node and browser
- Shopify-compatible syntax
- Extensible filters and tags
- Async filter support (for AI variables)

```bash
npm install liquidjs
```

**Source:** [LiquidJS GitHub](https://github.com/harttle/liquidjs)

**Integration with existing code:**

```typescript
// Extend existing variable-definitions-schema.ts
import { Liquid } from 'liquidjs';

const engine = new Liquid({
  strictFilters: false,    // Don't error on unknown filters
  strictVariables: false,  // Render empty for undefined vars
});

// Register TeveroSEO custom filters
engine.registerFilter('currency', (value, currency = 'EUR', locale = 'lt-LT') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(Number(value) / 100); // cents to whole
});

// Resolve variables using existing sourcePath system
export async function renderTemplate(
  template: string,
  context: Record<string, unknown>
): Promise<string> {
  return engine.parseAndRender(template, context);
}
```

### 8.6 UI Components

| Component | Purpose | Reuse From |
|-----------|---------|------------|
| `VariablePicker` | Category tree, search, insert | Extend existing VariableExtension |
| `FilterBuilder` | Chain filters visually | New component |
| `ConditionalBuilder` | Visual if/else rules | New component |
| `LoopBuilder` | Visual repeater config | New component |
| `PreviewPanel` | Live resolved preview | New component |

---

## 9. Sources

### Primary (HIGH confidence)
- [LiquidJS Documentation](https://liquidjs.com/tutorials/intro-to-liquid.html) - Filter registration, conditionals, loops
- [Shopify Liquid Reference](https://shopify.github.io/liquid/basics/introduction/) - Canonical syntax
- [Handlebars Built-in Helpers](https://handlebarsjs.com/guide/builtin-helpers.html) - Each, if, unless
- [Notion Formula Cheat Sheet 2026](https://thomasjfrank.com/notion-formula-cheat-sheet/) - Computed variables
- [Airtable Formula Reference](https://support.airtable.com/docs/formula-field-reference) - Rollups, conditionals

### Secondary (MEDIUM confidence)
- [CKEditor 5 Merge Fields](https://ckeditor.com/docs/ckeditor5/latest/features/merge-fields.html) - Visual picker patterns
- [Mailchimp Merge Tags](https://mailchimp.com/help/all-the-merge-tags-cheat-sheet/) - Conditional syntax
- [HubSpot Personalization](https://knowledge.hubspot.com/marketing-email/use-personalization-tokens) - Tokens with defaults
- [PandaDoc Variables](https://support.pandadoc.com/en/articles/9714599-variables) - Enterprise patterns

### Tertiary (needs validation)
- [Colorlib JavaScript Templating 2026](https://colorlib.com/wp/top-templating-engines-for-javascript/) - Market overview
- [Proposal Automation Trends 2026](https://llemental.com/posts/future-business-proposals-ai-automation-trends-2025-2026) - AI generation trends

---

## 10. Metadata

**Confidence breakdown:**
- Syntax recommendation: HIGH (industry standard, existing implementation)
- Filter system: HIGH (LiquidJS well-documented)
- Visual builder patterns: MEDIUM (best practices from multiple sources)
- AI variables: MEDIUM (emerging feature, cost model validated)

**Research date:** 2026-05-16
**Valid until:** 2026-08-16 (stable domain, 3 months)
