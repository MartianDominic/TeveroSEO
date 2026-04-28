/**
 * Example Usage: Lithuanian Hair Care Keyword Classifier
 *
 * This file demonstrates how to use the keyword classification system
 * with realistic Lithuanian hair care e-commerce data.
 *
 * Run: npx ts-node keyword-classifier.example.ts
 */

import {
  Category,
  KeywordInput,
  AnthropicKeywordClassifier,
  normalizeLithuanianKeyword,
  detectIntent,
} from "./keyword-classifier";

// ============================================================================
// Sample Categories (Lithuanian Hair Care E-commerce)
// ============================================================================

const SAMPLE_CATEGORIES: Category[] = [
  {
    id: "cat_000",
    name: "Plaukų priežiūra",
    name_en: "Hair Care",
    description: "Visa plaukų priežiūros produkcija",
    keywords_hint: "plaukai, priežiūra, hair care",
    parent_category: null,
  },
  {
    id: "cat_001",
    name: "Plaukų dažai",
    name_en: "Hair Dyes",
    description: "Ilgalaikiai ir pusiau ilgalaikiai plaukų dažai, oksidaciniai dažai, toniniai dažai",
    keywords_hint: "dažai, dažymas, spalva, atspalvis, oksidantas, toneris, tonavimas",
    parent_category: "cat_000",
  },
  {
    id: "cat_002",
    name: "Šampūnai",
    name_en: "Shampoos",
    description: "Kasdieniai ir specializuoti šampūnai visiems plaukų tipams",
    keywords_hint: "šampūnas, plauti, valyti, riebiems, sausiems, normaliems",
    parent_category: "cat_000",
  },
  {
    id: "cat_003",
    name: "Kondicionieriai",
    name_en: "Conditioners",
    description: "Plaukų kondicionieriai ir balzamai",
    keywords_hint: "kondicionierius, balzamas, minkštinimas, švelninimas",
    parent_category: "cat_000",
  },
  {
    id: "cat_004",
    name: "Plaukų kaukės",
    name_en: "Hair Masks",
    description: "Intensyvios plaukų kaukės ir gydymo priemonės",
    keywords_hint: "kaukė, gydymas, atstatymas, maitinimas, drėkinimas",
    parent_category: "cat_000",
  },
  {
    id: "cat_005",
    name: "Plaukų aliejai",
    name_en: "Hair Oils",
    description: "Plaukų aliejai ir serumai",
    keywords_hint: "aliejus, serumas, argano, kokoso, blizgesys",
    parent_category: "cat_000",
  },
  {
    id: "cat_006",
    name: "Formavimo priemonės",
    name_en: "Styling Products",
    description: "Plaukų formavimo produktai: putos, lakai, geliai, vaškai",
    keywords_hint: "formavimas, stilius, putos, lakas, gelis, vaškas, fiksavimas",
    parent_category: "cat_000",
  },
  {
    id: "cat_007",
    name: "Šilumos apsauga",
    name_en: "Heat Protection",
    description: "Termo apsaugos priemonės plaukų tiesinimui ir garbanojimui",
    keywords_hint: "termo, šiluma, apsauga, tiesinimas, garbanojimas",
    parent_category: "cat_000",
  },
  {
    id: "cat_008",
    name: "Galvos odos priežiūra",
    name_en: "Scalp Care",
    description: "Galvos odos gydymas, šveičiamieji ir pleiskanų priemonės",
    keywords_hint: "galvos oda, pleiskanos, niežulys, šveičiamasis, peeling",
    parent_category: "cat_000",
  },
  {
    id: "cat_009",
    name: "Profesionali plaukų kosmetika",
    name_en: "Professional Hair Care",
    description: "Profesionalios salono kokybės plaukų priežiūros priemonės",
    keywords_hint: "profesionalus, salonas, kirpėjas, L'Oreal Professionnel, Wella",
    parent_category: "cat_000",
  },
  {
    id: "cat_010",
    name: "Plaukų augimo priemonės",
    name_en: "Hair Growth",
    description: "Plaukų augimą skatinančios priemonės, nuo slinkimo",
    keywords_hint: "augimas, slinkimas, stiprinimas, minoxidil, biotinas",
    parent_category: "cat_000",
  },
  {
    id: "cat_011",
    name: "Dažytų plaukų priežiūra",
    name_en: "Color-Treated Hair Care",
    description: "Specializuoti produktai dažytiems plaukams",
    keywords_hint: "dažyti plaukai, spalvos apsauga, color protection",
    parent_category: "cat_000",
  },
  {
    id: "cat_012",
    name: "Garbanotų plaukų priežiūra",
    name_en: "Curly Hair Care",
    description: "Produktai garbanotiems ir banguotiems plaukams",
    keywords_hint: "garbanos, bangos, curls, curl defining",
    parent_category: "cat_000",
  },
  {
    id: "cat_013",
    name: "Plaukų priedai",
    name_en: "Hair Accessories",
    description: "Šukos, šepečiai, segtukai ir kiti plaukų priedai",
    keywords_hint: "šepetys, šukos, segtukas, gumytė, plaukų juosta",
    parent_category: "cat_000",
  },
  {
    id: "cat_014",
    name: "Vyriška plaukų priežiūra",
    name_en: "Men's Hair Care",
    description: "Plaukų priežiūros produktai vyrams",
    keywords_hint: "vyrams, vyriškas, men, barzdos, pomada",
    parent_category: "cat_000",
  },
];

// ============================================================================
// Sample Keywords (from DataForSEO)
// ============================================================================

const SAMPLE_KEYWORDS: KeywordInput[] = [
  // Exact match examples
  { id: "kw_001", term: "plaukų dažai", search_volume: 2400, cpc: 0.45 },
  { id: "kw_002", term: "šampūnas riebiems plaukams", search_volume: 1200, cpc: 0.32 },
  { id: "kw_003", term: "plaukų kaukė", search_volume: 880, cpc: 0.28 },

  // Morphological variants
  { id: "kw_004", term: "plaukų dažų kaina", search_volume: 720, cpc: 0.52 },
  { id: "kw_005", term: "kaip dažyti plaukus namuose", search_volume: 1600, cpc: 0.15 },
  { id: "kw_006", term: "dažyti plaukus", search_volume: 560, cpc: 0.22 },

  // Brand keywords
  { id: "kw_007", term: "olaplex", search_volume: 3600, cpc: 0.85 },
  { id: "kw_008", term: "olaplex 3", search_volume: 2400, cpc: 0.78 },
  { id: "kw_009", term: "kerastase šampūnas", search_volume: 1100, cpc: 0.65 },
  { id: "kw_010", term: "moroccanoil aliejus", search_volume: 880, cpc: 0.72 },

  // Multi-category
  { id: "kw_011", term: "plaukų priežiūra", search_volume: 1800, cpc: 0.35 },
  { id: "kw_012", term: "riebiems plaukams", search_volume: 1400, cpc: 0.38 },
  { id: "kw_013", term: "sausiems plaukams", search_volume: 960, cpc: 0.42 },

  // Informational intent
  { id: "kw_014", term: "kodėl slenka plaukai", search_volume: 2200, cpc: 0.18 },
  { id: "kw_015", term: "kaip paspartinti plaukų augimą", search_volume: 1900, cpc: 0.25 },
  { id: "kw_016", term: "ką daryti kai pleiskanoja", search_volume: 1100, cpc: 0.12 },

  // Specific product types
  { id: "kw_017", term: "plaukų lakas stiprios fiksacijos", search_volume: 480, cpc: 0.28 },
  { id: "kw_018", term: "termo apsauga plaukams", search_volume: 720, cpc: 0.45 },
  { id: "kw_019", term: "plaukų šepetys šlapiem plaukams", search_volume: 320, cpc: 0.22 },

  // Hair type specific
  { id: "kw_020", term: "garbanotiems plaukams", search_volume: 640, cpc: 0.38 },
  { id: "kw_021", term: "dažytiems plaukams šampūnas", search_volume: 520, cpc: 0.48 },

  // Men's category
  { id: "kw_022", term: "plaukų vaškas vyrams", search_volume: 420, cpc: 0.35 },
  { id: "kw_023", term: "vyriška plaukų pomada", search_volume: 280, cpc: 0.32 },

  // Edge cases
  { id: "kw_024", term: "plaukų kosmetika", search_volume: 560, cpc: 0.28 },
  { id: "kw_025", term: "geriausi plaukų produktai", search_volume: 380, cpc: 0.45 },
];

// ============================================================================
// Demo Functions
// ============================================================================

/**
 * Demonstrate keyword normalization
 */
function demoNormalization() {
  console.log("\n=== Lithuanian Keyword Normalization ===\n");

  const testKeywords = [
    "plaukų dažų kaina",
    "kaip dažyti plaukus",
    "šampūno pirkti",
    "kondicionieriaus atsiliepimas",
    "plaukų kaukės geriausios",
  ];

  for (const kw of testKeywords) {
    const normalized = normalizeLithuanianKeyword(kw);
    const intent = detectIntent(kw);
    console.log(`Original:   "${kw}"`);
    console.log(`Normalized: "${normalized}"`);
    console.log(`Intent:     ${intent}`);
    console.log("");
  }
}

/**
 * Demonstrate intent detection
 */
function demoIntentDetection() {
  console.log("\n=== Intent Detection ===\n");

  const testKeywords = [
    { term: "plaukų dažai kaina", expectedIntent: "transactional" },
    { term: "kaip dažyti plaukus", expectedIntent: "informational" },
    { term: "olaplex", expectedIntent: "navigational" },
    { term: "šampūnas riebiems plaukams", expectedIntent: "commercial" },
    { term: "pirkti kerastase", expectedIntent: "transactional" },
  ];

  for (const { term, expectedIntent } of testKeywords) {
    const detected = detectIntent(term);
    const match = detected === expectedIntent ? "OK" : "MISMATCH";
    console.log(`"${term}"`);
    console.log(`  Expected: ${expectedIntent}, Detected: ${detected} [${match}]`);
    console.log("");
  }
}

/**
 * Demonstrate full classification (requires API key)
 */
async function demoClassification(apiKey: string) {
  console.log("\n=== Full Classification Demo ===\n");

  const classifier = new AnthropicKeywordClassifier(
    SAMPLE_CATEGORIES,
    apiKey,
    {
      batchSize: 10,
      model: "claude-sonnet-4-20250514",
    }
  );

  // Take a small sample for demo
  const sampleKeywords = SAMPLE_KEYWORDS.slice(0, 5);

  console.log(`Classifying ${sampleKeywords.length} keywords...`);

  try {
    const result = await classifier.classifyBatch(sampleKeywords);

    console.log("\nStatistics:");
    console.log(`  Total keywords: ${result.statistics.total_keywords}`);
    console.log(`  High confidence: ${result.statistics.high_confidence}`);
    console.log(`  Medium confidence: ${result.statistics.medium_confidence}`);
    console.log(`  Low confidence: ${result.statistics.low_confidence}`);
    console.log(`  Needs review: ${result.statistics.needs_review}`);

    console.log("\nClassifications:");
    for (const c of result.classifications) {
      console.log(`\n  "${c.keyword}"`);
      console.log(`    Category: ${c.primary_category.name} (${c.primary_category.name_en})`);
      console.log(`    Confidence: ${(c.confidence * 100).toFixed(1)}%`);
      if (c.secondary_categories.length > 0) {
        console.log(`    Also fits: ${c.secondary_categories.map(s => s.name).join(", ")}`);
      }
      console.log(`    Reasoning: ${c.reasoning_summary}`);
    }

    if (result.unclassified.length > 0) {
      console.log("\nUnclassified:");
      for (const u of result.unclassified) {
        console.log(`  "${u.keyword}": ${u.reason}`);
      }
    }
  } catch (error) {
    console.error("Classification failed:", error);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("Lithuanian Hair Care Keyword Classifier - Demo\n");
  console.log("=".repeat(50));

  // Always run demos that don't require API
  demoNormalization();
  demoIntentDetection();

  // Run full classification if API key provided
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    await demoClassification(apiKey);
  } else {
    console.log("\n=== Full Classification Demo ===\n");
    console.log("Skipped: Set ANTHROPIC_API_KEY environment variable to run full demo.");
    console.log("\nExample:");
    console.log("  ANTHROPIC_API_KEY=sk-ant-xxx npx ts-node keyword-classifier.example.ts");
  }

  // Print sample category structure
  console.log("\n=== Sample Category Structure ===\n");
  console.log("Total categories:", SAMPLE_CATEGORIES.length);
  for (const cat of SAMPLE_CATEGORIES.slice(0, 5)) {
    console.log(`  ${cat.id}: ${cat.name} (${cat.name_en})`);
  }
  console.log("  ...");

  // Print sample keywords
  console.log("\n=== Sample Keywords ===\n");
  console.log("Total keywords:", SAMPLE_KEYWORDS.length);
  for (const kw of SAMPLE_KEYWORDS.slice(0, 5)) {
    console.log(`  ${kw.id}: "${kw.term}" (vol: ${kw.search_volume})`);
  }
  console.log("  ...");
}

main().catch(console.error);
