# Phase 75: Conversation Intelligence - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** New feature - World-Class Keyword Intelligence v8.0

<domain>
## Phase Boundary

Extract structured analysis constraints from unstructured client conversation using Claude. This is the brain of the keyword intelligence system - everything downstream depends on accurate constraint extraction.

**Core Problem:**
User pastes client conversation like:
```
"Mes automobilių plovykla Šiauliuose. Norime pritraukti daugiau verslo 
klientų su automobilių parkais. Mums svarbiausia - reguliari priežiūra 
ir detailing paslaugos."
```

AI must extract:
- Business: car wash in Šiauliai
- Geo constraint: Šiauliai ONLY (exclude Kaunas, Vilnius, etc.)
- Audience: B2B (company fleets)
- Priority services: regular maintenance, detailing
- Implied BOFU focus: "pritraukti klientų" = want buyers

**Output Type:** `AnalysisConstraints` - structured object consumed by all downstream classifiers.

</domain>

<decisions>
## Implementation Decisions

### Constraint Categories to Extract

1. **Business Context**
   - `type`: ecommerce | service | saas | local | b2b_services
   - `coreOffering`: string (e.g., "automobilių plovykla")
   - `problemsSolved`: string[] (for side keyword discovery)
   - `productCategories`: string[] (e.g., ["plovimas", "detailing"])

2. **Geographic Constraints**
   - `scope`: hyperlocal | city | regional | national
   - `includeCities`: string[] (explicit mentions)
   - `excludeCities`: string[] (competitors' territories)
   - `nearMeAllowed`: boolean
   - `genericAllowed`: boolean (keywords without city)

3. **Audience Constraints**
   - `b2bOnly`: boolean
   - `b2cAllowed`: boolean
   - `industryFocus`: string[] (if B2B)

4. **Funnel Configuration**
   - `primary`: bofu | mofu | tofu
   - `fallbackOrder`: ('bofu' | 'mofu' | 'tofu')[]
   - `targetCount`: number (100, 150, 200)
   - `minPerStage`: Record<string, number>

5. **Priority Categories**
   - `category`: string
   - `weightMultiplier`: number (1.0-2.0)
   - `reason`: string

6. **Negative Filters**
   - `excludeTerms`: string[] (e.g., ["savitarna", "namų"])
   - `excludeBrands`: string[]
   - `excludeIntents`: string[] (e.g., ["diy"])

7. **Special Modes**
   - `pSEODetection`: boolean
   - `sideKeywordDiscovery`: boolean
   - `competitorGaps`: boolean

### Model Selection
- **Primary:** Claude Sonnet 4.6 (best at nuanced extraction)
- **Fallback:** Gemini 2.5 Flash (for rate limits)

### Confidence Scoring
- Per-field confidence (0-1)
- Overall extraction confidence
- `clarificationNeeded`: string[] for ambiguous inputs

### Prompt Architecture
- XML-structured metaprompt
- Few-shot examples (3+ Lithuanian conversations)
- Explicit output schema with JSON

</decisions>

<references>
## Reference Documents

- `.planning/keyword-intelligence/WORLD-CLASS-ARCHITECTURE.md` — Full system design
- `.planning/keyword-intelligence/PHASES.md` — Phase breakdown
- `.planning/keyword-intelligence/SYSTEM-ANALYSIS.md` — 10-agent analysis findings
- `open-seo-main/src/server/features/prospects/services/ConversationExtractor.ts` — Existing basic extraction
- `open-seo-main/src/server/features/keywords/types/focus-directive.ts` — Existing FocusDirective (ephemeral)

</references>

<existing_code>
## Existing Infrastructure

### ConversationExtractor (Phase 56)
Location: `open-seo-main/src/server/features/prospects/services/ConversationExtractor.ts`
- Basic Claude Sonnet extraction
- Outputs: businessName, industry, services[], targetAudience, keywords[], location
- **Gap:** No geographic constraints, no funnel preference, no priorities

### FocusDirective
Location: `open-seo-main/src/server/features/keywords/types/focus-directive.ts`
- `CategoryPriority`: name, weight_modifier, scope, confidence
- `CategorySuppression`: suppress_factor, reason
- **Gap:** Generated per-request via LLM, not persisted, no conversation extraction

### AI-Writer Research Intent
Location: `AI-Writer/backend/services/research/intent/`
- `ResearchPurpose`: learn, create_content, make_decision, compare, solve_problem
- **Gap:** Different purpose (content research), not keyword analysis

</existing_code>

<success_criteria>
## Success Criteria

1. Given Lithuanian client conversation, extracts business type correctly 90%+
2. Geographic constraints (include/exclude cities) extracted with 85%+ accuracy
3. B2B vs B2C audience correctly identified 90%+
4. Confidence scores calibrated (high confidence = high accuracy)
5. Ambiguous inputs flagged in `clarificationNeeded` array
6. Extraction completes in <3 seconds
7. Works with both Lithuanian and English conversations

</success_criteria>

<test_cases>
## Key Test Cases

### Case 1: Local Service B2B
```
Input: "Mes automobilių plovykla Šiauliuose. Norime pritraukti daugiau 
verslo klientų su automobilių parkais."

Expected:
- businessContext.type: "service"
- businessContext.coreOffering: "automobilių plovykla"
- geoConstraints.includeCities: ["šiauliai"]
- geoConstraints.scope: "city"
- audienceConstraints.b2bOnly: true
- funnelConfig.primary: "bofu" (inferred from "pritraukti klientų")
```

### Case 2: E-commerce National
```
Input: "Parduodame natūralią kosmetiką visoje Lietuvoje. Mūsų prioritetas - 
veido serumai ir šampūnai. Norime išsiskirti iš konkurentų."

Expected:
- businessContext.type: "ecommerce"
- geoConstraints.scope: "national"
- geoConstraints.genericAllowed: true
- priorities[0].category: "veido serumai"
- priorities[1].category: "šampūnai"
```

### Case 3: B2B Services Multiple Cities
```
Input: "Teikiame IT paslaugas Vilniuje ir Kaune. Klientai - didelės įmonės. 
Nenorime smulkių verslų."

Expected:
- businessContext.type: "b2b_services"
- geoConstraints.includeCities: ["vilnius", "kaunas"]
- audienceConstraints.b2bOnly: true
- audienceConstraints.industryFocus: ["enterprise"]
- negativeFilters.excludeTerms: ["smulkus verslas", "mažos įmonės"]
```

</test_cases>
