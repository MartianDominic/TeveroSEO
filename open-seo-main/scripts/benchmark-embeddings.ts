/**
 * Benchmark v5-nano embeddings with realistic workload.
 *
 * Phase 83: Embedding Infrastructure Upgrade
 *
 * Target metrics:
 * - Speed: 200 kw/sec
 * - 100 prospects (~200k keywords): <10 minutes
 *
 * Usage:
 *   npx tsx scripts/benchmark-embeddings.ts
 *   npx tsx scripts/benchmark-embeddings.ts --local-only
 *   npx tsx scripts/benchmark-embeddings.ts --api-only
 *
 * Prerequisites:
 * - Local embedding server running (docker compose --profile embedding up)
 * - OR JINA_API_KEY set for API-only mode
 */

import {
  createResilientEmbedding,
  InMemoryEmbeddingCache,
} from "../src/server/features/keywords/services/ResilientEmbedding";

// Sample Lithuanian keywords for benchmarking
const SAMPLE_KEYWORDS = [
  "sampunas ploniems plaukams",
  "kaip stiprinti plaukus",
  "geriausias kondicionierius",
  "plauku priauginimas kaina",
  "plauku slinkimo priezastys",
  "naturalus plauku stiprinimas",
  "plauku kaukes namu salygomis",
  "plauku dziovintuvas profesionalus",
  "plauku tiesintuvas keratinu",
  "plauku dazai be amoniako",
  "plauku formavimo priemones",
  "plauku aliejus argano",
  "plauku augimo vitaminai",
  "plauku transplantacija vilnius",
  "plauku kirpimas namuose",
  "plauku stilius vyrams",
  "plauku prieziura vasara",
  "plauku plovimas kasdien",
  "plauku spalvos tendencijos",
  "plauku garbanojimas ilgalaikis",
  "seo paslaugos vilnius",
  "svetainiu kurimas kaina",
  "internetines parduotuves kurimas",
  "google reklama kaina",
  "facebook reklamos valdymas",
  "turinio rasymas svetainems",
  "straipsniu rasymas seo",
  "nuorodu kurimas paslaugos",
  "konkurentu analize seo",
  "raktiniu zodziu tyrimas",
  // Add more to reach 1000
];

// Generate 1000 unique keywords by combining patterns
function generateKeywords(count: number): string[] {
  const prefixes = [
    "kaip",
    "kodel",
    "kada",
    "kur",
    "kas",
    "kiek",
    "kokia",
    "kokios",
    "kuris",
    "ar",
  ];
  const verbs = [
    "pasirinkti",
    "naudoti",
    "rasti",
    "pirkti",
    "palyginti",
    "ivertinti",
    "patikrinti",
    "apskaiciuoti",
    "nustatyti",
    "optimizuoti",
  ];
  const topics = [
    "svetaine",
    "el. parduotuve",
    "tinklarastis",
    "reklama",
    "seo",
    "turinys",
    "nuorodos",
    "raktazodziai",
    "konkurentai",
    "analize",
  ];
  const suffixes = [
    "vilniuje",
    "kaune",
    "klaipedoje",
    "lietuvoje",
    "online",
    "pigiai",
    "greitai",
    "profesionaliai",
    "efektyviai",
    "kokybishkai",
  ];

  const keywords = [...SAMPLE_KEYWORDS];

  while (keywords.length < count) {
    const prefix = prefixes[keywords.length % prefixes.length];
    const verb = verbs[Math.floor(keywords.length / 10) % verbs.length];
    const topic = topics[Math.floor(keywords.length / 100) % topics.length];
    const suffix = suffixes[Math.floor(keywords.length / 1000) % suffixes.length];
    keywords.push(`${prefix} ${verb} ${topic} ${suffix}`);
  }

  return keywords.slice(0, count);
}

interface BenchmarkResult {
  totalKeywords: number;
  totalTimeMs: number;
  keywordsPerSecond: number;
  estimatedTimeFor100Prospects: string;
  bySource: Record<string, number>;
  cacheHits: number;
  passed: boolean;
}

async function runBenchmark(keywordCount: number): Promise<BenchmarkResult> {
  const embedder = createResilientEmbedding(new InMemoryEmbeddingCache());
  const keywords = generateKeywords(keywordCount);

  console.log(`\nBenchmarking ${keywordCount} keywords...`);
  console.log(`Embedding dimension: ${embedder.getDimension()}`);

  // Warm-up run (10 keywords)
  console.log("Warming up...");
  await embedder.embedBatch(keywords.slice(0, 10));

  // Main benchmark
  console.log("Running benchmark...");
  const start = performance.now();
  const result = await embedder.embedBatch(keywords);
  const elapsed = performance.now() - start;

  const kwPerSec = (keywordCount / elapsed) * 1000;
  const timeFor200k = (200000 / kwPerSec) / 60; // minutes

  const benchmarkResult: BenchmarkResult = {
    totalKeywords: keywordCount,
    totalTimeMs: Math.round(elapsed),
    keywordsPerSecond: Math.round(kwPerSec * 10) / 10,
    estimatedTimeFor100Prospects: `${timeFor200k.toFixed(1)} minutes`,
    bySource: result.summary.bySource,
    cacheHits: result.summary.cacheHits,
    passed: kwPerSec >= 200,
  };

  return benchmarkResult;
}

function printResults(result: BenchmarkResult): void {
  console.log("\n" + "=".repeat(60));
  console.log("BENCHMARK RESULTS");
  console.log("=".repeat(60));

  console.log(`\nTotal keywords: ${result.totalKeywords}`);
  console.log(`Total time: ${result.totalTimeMs}ms`);
  console.log(`Speed: ${result.keywordsPerSecond} keywords/sec`);
  console.log(`100 prospects (200k keywords): ${result.estimatedTimeFor100Prospects}`);

  console.log("\nEmbedding sources:");
  for (const [source, count] of Object.entries(result.bySource)) {
    if (count > 0) {
      console.log(`  - ${source}: ${count} (${((count / result.totalKeywords) * 100).toFixed(1)}%)`);
    }
  }

  console.log(`\nCache hits: ${result.cacheHits}`);

  console.log("\n" + "-".repeat(60));
  if (result.passed) {
    console.log("PASS: Meets 100 prospects/hour target (>=200 kw/sec)");
  } else {
    console.log("FAIL: Below target speed (<200 kw/sec)");
    console.log("       Consider:");
    console.log("       - Ensure local embedding server is running");
    console.log("       - Check network connectivity");
    console.log("       - Verify EMBEDDING_SERVER_URL is set correctly");
  }
  console.log("-".repeat(60));
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Phase 83: v5-nano Embedding Benchmark");
  console.log("=".repeat(60));

  const args = process.argv.slice(2);
  const localOnly = args.includes("--local-only");
  const apiOnly = args.includes("--api-only");

  if (localOnly) {
    console.log("\nMode: Local embedding server only");
    if (!process.env.EMBEDDING_SERVER_URL) {
      process.env.EMBEDDING_SERVER_URL = "http://localhost:8001";
    }
  } else if (apiOnly) {
    console.log("\nMode: Jina API only");
    if (!process.env.JINA_API_KEY) {
      console.error("ERROR: JINA_API_KEY not set. Set it to use API-only mode.");
      process.exit(1);
    }
  } else {
    console.log("\nMode: Auto (local server with API fallback)");
  }

  try {
    // Run benchmark with 1000 keywords
    const result = await runBenchmark(1000);
    printResults(result);

    // Exit with appropriate code
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error("\nBenchmark failed:", error);
    process.exit(1);
  }
}

main();
