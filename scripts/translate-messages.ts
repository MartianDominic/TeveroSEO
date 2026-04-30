#!/usr/bin/env tsx
/**
 * Batch translation script for message files using TranslationService
 *
 * Usage:
 *   pnpm translate:web   # Translate apps/web messages
 *   pnpm translate:seo   # Translate open-seo-main messages
 *
 * Or directly:
 *   tsx scripts/translate-messages.ts input.json output.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Types from TranslationService
interface TranslationRequest {
  text: string;
  sourceLang: 'en';
  targetLang: 'lt';
  context: {
    type: 'ui' | 'proposal' | 'agreement' | 'email' | 'report';
    formality: 'formal' | 'informal';
  };
  preservePlaceholders?: boolean;
}

interface TranslationResult {
  text: string;
  cached: boolean;
  confidence: number;
}

// Placeholder regex for ICU and common formats
const PLACEHOLDER_REGEX = /\{[^}]+\}|\{\{[^}]+\}\}|%[sd]/g;

/**
 * Recursively traverse JSON and collect all string values with their paths
 */
function collectStrings(obj: unknown, path: string[] = []): Array<{ path: string[]; value: string }> {
  const results: Array<{ path: string[]; value: string }> = [];

  if (typeof obj === 'string') {
    results.push({ path, value: obj });
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      results.push(...collectStrings(value, [...path, key]));
    }
  }

  return results;
}

/**
 * Set a value at a nested path in an object
 */
function setNestedValue(obj: Record<string, unknown>, path: string[], value: string): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

/**
 * Get a value at a nested path in an object
 */
function getNestedValue(obj: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Check if string contains ICU plural forms
 */
function hasICUPlural(text: string): boolean {
  return text.includes('{count, plural,') || text.includes(', plural,');
}

/**
 * Convert English ICU plural to Lithuanian 4-form plural
 * Lithuanian has: one (1, 21, 31...), few (2-9, 22-29...), many (11-19), other (0, 10, 20...)
 */
function convertToLithuanianPlural(text: string, translated: string): string {
  // If already has Lithuanian forms, return as-is
  if (translated.includes(' few {') && translated.includes(' many {')) {
    return translated;
  }

  // Extract the plural structure
  const match = translated.match(/\{(\w+), plural, ([^}]+one \{[^}]+\}[^}]+other \{[^}]+\})\}/);
  if (!match) return translated;

  const [, variable, content] = match;

  // Extract one and other forms
  const oneMatch = content.match(/one \{([^}]+)\}/);
  const otherMatch = content.match(/other \{([^}]+)\}/);

  if (!oneMatch || !otherMatch) return translated;

  const oneForm = oneMatch[1];
  const otherForm = otherMatch[1];

  // For Lithuanian, few form is like one but with different ending
  // many form is same as other for most cases
  return `{${variable}, plural, one {${oneForm}} few {${oneForm.replace(/as$/, 'ai').replace(/is$/, 'ys')}} many {${otherForm}} other {${otherForm}}}`;
}

/**
 * Simple translation function (placeholder for real TranslationService)
 * In production, this would call the actual TranslationService
 */
async function translateText(request: TranslationRequest): Promise<TranslationResult> {
  // For now, return the original text as a stub
  // The real implementation would call TranslationService
  console.log(`  Translating: "${request.text.substring(0, 50)}..."`);

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50));

  return {
    text: request.text, // Would be translated text
    cached: false,
    confidence: 0.85
  };
}

/**
 * Main translation function
 */
async function translateMessages(inputPath: string, outputPath: string): Promise<void> {
  console.log(`\nTranslating messages:`);
  console.log(`  Input:  ${inputPath}`);
  console.log(`  Output: ${outputPath}\n`);

  // Load input file
  const inputContent = readFileSync(inputPath, 'utf-8');
  const inputJson = JSON.parse(inputContent) as Record<string, unknown>;

  // Load existing output if present (to skip already translated)
  let outputJson: Record<string, unknown> = {};
  if (existsSync(outputPath)) {
    const existingContent = readFileSync(outputPath, 'utf-8');
    outputJson = JSON.parse(existingContent) as Record<string, unknown>;
    console.log(`  Found existing output file, will skip already translated keys\n`);
  }

  // Collect all strings from input
  const strings = collectStrings(inputJson);
  console.log(`  Found ${strings.length} strings to process\n`);

  let translated = 0;
  let skipped = 0;

  // Process strings in batches
  const batchSize = 10;
  for (let i = 0; i < strings.length; i += batchSize) {
    const batch = strings.slice(i, i + batchSize);

    await Promise.all(batch.map(async ({ path, value }) => {
      // Check if already translated
      const existing = getNestedValue(outputJson, path);
      if (existing) {
        skipped++;
        return;
      }

      // Skip empty strings
      if (!value.trim()) {
        setNestedValue(outputJson, path, value);
        skipped++;
        return;
      }

      // Translate
      const result = await translateText({
        text: value,
        sourceLang: 'en',
        targetLang: 'lt',
        context: {
          type: 'ui',
          formality: 'formal'
        },
        preservePlaceholders: true
      });

      let translatedText = result.text;

      // Handle ICU plurals
      if (hasICUPlural(value)) {
        translatedText = convertToLithuanianPlural(value, translatedText);
      }

      setNestedValue(outputJson, path, translatedText);
      translated++;
    }));

    // Rate limiting delay between batches (60 RPM = 1 per second)
    if (i + batchSize < strings.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Write output
  writeFileSync(outputPath, JSON.stringify(outputJson, null, 2) + '\n');

  console.log(`\nCompleted:`);
  console.log(`  Translated: ${translated}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Output:     ${outputPath}\n`);
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: tsx scripts/translate-messages.ts <input.json> <output.json>');
  process.exit(1);
}

const inputPath = resolve(process.cwd(), args[0]);
const outputPath = resolve(process.cwd(), args[1]);

translateMessages(inputPath, outputPath).catch(err => {
  console.error('Translation failed:', err);
  process.exit(1);
});
