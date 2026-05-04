/**
 * Constraint Extraction Prompt Template
 *
 * XML-structured metaprompt for extracting AnalysisConstraints from client conversations
 * using Claude Sonnet 4.6.
 *
 * Based on business-priority-parser.xml pattern with Lithuanian examples.
 */

export const CONSTRAINT_EXTRACTION_PROMPT = `<system>
You are extracting keyword analysis constraints from a client conversation for an SEO proposal system.

Your task is to convert natural language client input into structured constraints that will drive:
- Geographic keyword filtering
- Funnel stage classification (BOFU/MOFU/TOFU)
- Relevance scoring and prioritization
- Keyword cascade selection

Be precise. These constraints directly affect which keywords appear in the client's proposal.
</system>

<task>
Extract structured constraints from the client conversation. Identify:

1. **BusinessContext**: What type of business? What do they offer? What problems do they solve?
2. **GeoConstraints**: Geographic targeting scope and city-level include/exclude lists
3. **AudienceConstraints**: B2B vs B2C focus, industry targeting
4. **FunnelConfig**: Preferred funnel stage (BOFU/MOFU/TOFU) and fallback order
5. **Priorities**: Category weight multipliers for keyword scoring
6. **NegativeFilters**: Terms, brands, or intents to exclude
7. **SpecialModes**: pSEO detection, side keyword discovery, competitor gap analysis

Infer missing information from context when confidence is reasonable (>0.5).
</task>

<categories>
**1. BusinessContext**
- type: ecommerce | service | saas | local | b2b_services
- coreOffering: Primary product/service (string)
- problemsSolved: Pain points addressed (array of strings)
- productCategories: Product/service categories (array of strings)

**2. GeoConstraints**
- scope: hyperlocal | city | regional | national
  - hyperlocal: Single neighborhood/district (e.g., "Šiauliai city center")
  - city: One or more specific cities
  - regional: Multi-city region (e.g., "Northern Lithuania")
  - national: Entire country
- includeCities: Cities to target (array of strings, Lithuanian city names)
- excludeCities: Cities to avoid (array of strings)
- nearMeAllowed: Include "near me" keywords (boolean)
- genericAllowed: Include non-geographic keywords (boolean)

**3. AudienceConstraints**
- b2bOnly: Business-to-business only (boolean)
- b2cAllowed: Business-to-consumer allowed (boolean)
- industryFocus: Specific industries to target (array of strings)

**4. FunnelConfig**
- primary: bofu | mofu | tofu
  - bofu: Bottom-of-funnel (high intent, ready to buy)
  - mofu: Middle-of-funnel (considering options)
  - tofu: Top-of-funnel (awareness, research)
- fallbackOrder: Fallback stages if not enough keywords (array)
- targetCount: Total keywords desired (number)
- minPerStage: Minimum keywords per stage (number, optional)

**5. Priorities**
Array of category weight multipliers (1.0-2.0):
- category: Category name (e.g., "Transactional", "Local", "Branded")
- weightMultiplier: 1.0 (normal) to 2.0 (max boost)
- reason: Why this category is prioritized (string)

**6. NegativeFilters**
- excludeTerms: Terms that disqualify keywords (array of strings)
- excludeBrands: Competitor or unwanted brands (array of strings)
- excludeIntents: Intent types to exclude (array of strings)

**7. SpecialModes**
- pSEODetection: Detect programmatic SEO patterns (boolean)
- sideKeywordDiscovery: Suggest adjacent opportunities (boolean)
- competitorGaps: Identify competitor keyword gaps (boolean)
</categories>

<examples>
**Case 1: Local Service B2B (Car Wash in Šiauliai)**

Conversation:
"Mes teikiame automobilių plovimo paslaugas Šiauliuose. Orientuojamės į verslo klientus - taksi parkai, nuomos įmonės. Norime raktažodžių, kurie atvestų klientus ieškančius profesionalaus plovimo. Nenorime DIY raktažodžių."

Extracted Constraints:
\`\`\`json
{
  "business": {
    "type": "local",
    "coreOffering": "Professional car wash services",
    "problemsSolved": ["Vehicle cleanliness", "Fleet maintenance"],
    "productCategories": ["Car wash", "Auto detailing"]
  },
  "geo": {
    "scope": "city",
    "includeCities": ["Šiauliai"],
    "excludeCities": [],
    "nearMeAllowed": true,
    "genericAllowed": false
  },
  "audience": {
    "b2bOnly": true,
    "b2cAllowed": false,
    "industryFocus": ["Transportation", "Car rental"]
  },
  "funnel": {
    "primary": "bofu",
    "fallbackOrder": ["mofu"],
    "targetCount": 30,
    "minPerStage": 10
  },
  "priorities": [
    {
      "category": "Local",
      "weightMultiplier": 1.8,
      "reason": "Geographic focus critical for foot traffic"
    },
    {
      "category": "Transactional",
      "weightMultiplier": 1.5,
      "reason": "B2B clients ready to purchase"
    }
  ],
  "negatives": {
    "excludeTerms": ["DIY", "self-service", "free"],
    "excludeBrands": [],
    "excludeIntents": ["informational"]
  },
  "specialModes": {
    "pSEODetection": false,
    "sideKeywordDiscovery": true,
    "competitorGaps": false
  }
}
\`\`\`

Confidence:
\`\`\`json
{
  "overall": 0.85,
  "business": 0.9,
  "geo": 0.95,
  "audience": 0.9,
  "funnel": 0.8,
  "priorities": 0.8,
  "negatives": 0.7,
  "specialModes": 0.5
}
\`\`\`

---

**Case 2: E-commerce National (Cosmetics)**

Conversation:
"Parduodame kosmetiką internetu visoje Lietuvoje. Daugiausia B2C - moterys 25-45 m. Norime raktažodžių visiems piltuvėlio etapams, bet prioritetas - pardavimams. Turime kategorijas: veido priežiūra, makiažas, kūno priežiūra."

Extracted Constraints:
\`\`\`json
{
  "business": {
    "type": "ecommerce",
    "coreOffering": "Online cosmetics retail",
    "problemsSolved": ["Skincare needs", "Beauty product access"],
    "productCategories": ["Face care", "Makeup", "Body care"]
  },
  "geo": {
    "scope": "national",
    "includeCities": [],
    "excludeCities": [],
    "nearMeAllowed": false,
    "genericAllowed": true
  },
  "audience": {
    "b2bOnly": false,
    "b2cAllowed": true,
    "industryFocus": []
  },
  "funnel": {
    "primary": "bofu",
    "fallbackOrder": ["mofu", "tofu"],
    "targetCount": 50,
    "minPerStage": 15
  },
  "priorities": [
    {
      "category": "Transactional",
      "weightMultiplier": 1.7,
      "reason": "Sales-focused per client request"
    },
    {
      "category": "Product-specific",
      "weightMultiplier": 1.4,
      "reason": "Three distinct product categories"
    }
  ],
  "negatives": {
    "excludeTerms": [],
    "excludeBrands": [],
    "excludeIntents": []
  },
  "specialModes": {
    "pSEODetection": true,
    "sideKeywordDiscovery": false,
    "competitorGaps": true
  }
}
\`\`\`

Confidence:
\`\`\`json
{
  "overall": 0.9,
  "business": 0.95,
  "geo": 0.95,
  "audience": 0.85,
  "funnel": 0.85,
  "priorities": 0.9,
  "negatives": 0.6,
  "specialModes": 0.7
}
\`\`\`

---

**Case 3: B2B Services Multiple Cities (IT Consulting)**

Conversation:
"IT konsultacijos įmonėms Vilniuje, Kaune, Klaipėdoje. Specializuojamės gamybos ir IT sektorių. Ieškome informacinių raktažodžių - norime pritraukti įmones, kurios tik pradeda galvoti apie IT modernizavimą."

Extracted Constraints:
\`\`\`json
{
  "business": {
    "type": "b2b_services",
    "coreOffering": "IT consulting for enterprises",
    "problemsSolved": ["IT modernization", "Technology transformation"],
    "productCategories": ["IT consulting", "Digital transformation"]
  },
  "geo": {
    "scope": "city",
    "includeCities": ["Vilnius", "Kaunas", "Klaipėda"],
    "excludeCities": [],
    "nearMeAllowed": false,
    "genericAllowed": true
  },
  "audience": {
    "b2bOnly": true,
    "b2cAllowed": false,
    "industryFocus": ["Manufacturing", "IT sector"]
  },
  "funnel": {
    "primary": "tofu",
    "fallbackOrder": ["mofu"],
    "targetCount": 40,
    "minPerStage": 12
  },
  "priorities": [
    {
      "category": "Informational",
      "weightMultiplier": 1.6,
      "reason": "Client wants awareness-stage keywords"
    },
    {
      "category": "Industry-specific",
      "weightMultiplier": 1.5,
      "reason": "Focus on manufacturing and IT sectors"
    }
  ],
  "negatives": {
    "excludeTerms": ["cheap", "free", "DIY"],
    "excludeBrands": [],
    "excludeIntents": ["navigational"]
  },
  "specialModes": {
    "pSEODetection": false,
    "sideKeywordDiscovery": true,
    "competitorGaps": true
  }
}
\`\`\`

Confidence:
\`\`\`json
{
  "overall": 0.88,
  "business": 0.9,
  "geo": 0.95,
  "audience": 0.9,
  "funnel": 0.85,
  "priorities": 0.85,
  "negatives": 0.7,
  "specialModes": 0.8
}
\`\`\`

</examples>

<output_schema>
Return JSON matching this exact structure:

\`\`\`typescript
{
  "constraints": {
    "business": {
      "type": "ecommerce" | "service" | "saas" | "local" | "b2b_services",
      "coreOffering": string,
      "problemsSolved": string[],
      "productCategories": string[]
    },
    "geo": {
      "scope": "hyperlocal" | "city" | "regional" | "national",
      "includeCities": string[],
      "excludeCities": string[],
      "nearMeAllowed": boolean,
      "genericAllowed": boolean
    },
    "audience": {
      "b2bOnly": boolean,
      "b2cAllowed": boolean,
      "industryFocus": string[]
    },
    "funnel": {
      "primary": "bofu" | "mofu" | "tofu",
      "fallbackOrder": ("bofu" | "mofu" | "tofu")[],
      "targetCount": number,
      "minPerStage"?: number
    },
    "priorities": Array<{
      "category": string,
      "weightMultiplier": number, // 1.0 to 2.0
      "reason": string
    }>,
    "negatives": {
      "excludeTerms": string[],
      "excludeBrands": string[],
      "excludeIntents": string[]
    },
    "specialModes": {
      "pSEODetection": boolean,
      "sideKeywordDiscovery": boolean,
      "competitorGaps": boolean
    }
  },
  "confidence": {
    "overall": number, // 0.0 to 1.0
    "business": number,
    "geo": number,
    "audience": number,
    "funnel": number,
    "priorities": number,
    "negatives": number,
    "specialModes": number
  },
  "clarificationNeeded": string[]
}
\`\`\`
</output_schema>

<confidence_rules>
**Scoring Guidelines:**

- **0.9 - 1.0**: Explicit statement in conversation
  - Example: "Mes teikiame automobilių plovimo paslaugas" → business.type = "local" (0.95)

- **0.7 - 0.9**: Strong implication from context
  - Example: Mentions "taxi fleets, rental companies" → audience.b2bOnly = true (0.85)

- **0.5 - 0.7**: Reasonable inference based on business type
  - Example: E-commerce + Lithuania → geo.scope = "national" (0.65)

- **< 0.5**: Guesswork or default assumption
  - **Add to clarificationNeeded array** if confidence < 0.5

**Clarification Format:**
If any field has confidence < 0.5, add a clear question to \`clarificationNeeded\`:
- "Geographic targeting unclear - do you want to target specific cities or nationwide?"
- "Funnel preference not mentioned - should we focus on high-intent buyers (BOFU) or awareness (TOFU)?"
- "No priority categories specified - should we infer from your business type or all equal weight?"

**Never guess with low confidence.** It's better to ask for clarification than provide incorrect constraints.
</confidence_rules>

{{USER_INPUT}}
`;

/**
 * Builds the complete extraction prompt with user conversation injected.
 *
 * @param conversation - Client conversation text to extract constraints from
 * @param instruction - Optional additional instruction for the extraction
 * @returns Complete prompt ready for Claude API
 */
export function buildExtractionPrompt(
  conversation: string,
  instruction?: string
): string {
  let userInput = `<conversation>\n${conversation}\n</conversation>`;

  if (instruction) {
    userInput += `\n\n<instruction>\n${instruction}\n</instruction>`;
  }

  userInput += `\n\nExtract the structured constraints from the conversation above. Return only the JSON object matching the output schema.`;

  return CONSTRAINT_EXTRACTION_PROMPT.replace("{{USER_INPUT}}", userInput);
}
