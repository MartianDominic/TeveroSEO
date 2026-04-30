#!/usr/bin/env tsx
/**
 * Translation validation script
 *
 * Compares EN and LT message files to ensure:
 * - All keys present in both files
 * - Placeholders match between translations
 * - No missing or extra keys
 *
 * Usage:
 *   pnpm validate:translations
 *
 * Or directly:
 *   tsx scripts/validate-translations.ts en.json lt.json
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Placeholder regex for ICU and common formats
const PLACEHOLDER_REGEX = /\{[^}]+\}|\{\{[^}]+\}\}|%[sd]/g;

interface ValidationResult {
  missing: string[];      // Keys in EN but not in LT
  extra: string[];        // Keys in LT but not in EN
  placeholderMismatch: Array<{
    key: string;
    en: string[];
    lt: string[];
  }>;
}

/**
 * Recursively collect all keys with their full paths
 */
function collectKeys(obj: unknown, prefix: string = ''): Map<string, string> {
  const results = new Map<string, string>();

  if (typeof obj === 'string') {
    results.set(prefix, obj);
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      const nested = collectKeys(value, newPrefix);
      for (const [k, v] of nested) {
        results.set(k, v);
      }
    }
  }

  return results;
}

/**
 * Extract placeholders from a string
 */
function extractPlaceholders(text: string): string[] {
  const matches = text.match(PLACEHOLDER_REGEX) || [];
  // Sort for consistent comparison
  return matches.sort();
}

/**
 * Validate translations between two message files
 */
function validateTranslations(enPath: string, ltPath: string): ValidationResult {
  // Load files
  const enContent = readFileSync(enPath, 'utf-8');
  const ltContent = readFileSync(ltPath, 'utf-8');

  const enJson = JSON.parse(enContent);
  const ltJson = JSON.parse(ltContent);

  // Collect keys
  const enKeys = collectKeys(enJson);
  const ltKeys = collectKeys(ltJson);

  // Find missing keys (in EN but not LT)
  const missing: string[] = [];
  for (const key of enKeys.keys()) {
    if (!ltKeys.has(key)) {
      missing.push(key);
    }
  }

  // Find extra keys (in LT but not EN)
  const extra: string[] = [];
  for (const key of ltKeys.keys()) {
    if (!enKeys.has(key)) {
      extra.push(key);
    }
  }

  // Check placeholder consistency
  const placeholderMismatch: ValidationResult['placeholderMismatch'] = [];
  for (const [key, enValue] of enKeys) {
    const ltValue = ltKeys.get(key);
    if (!ltValue) continue;

    const enPlaceholders = extractPlaceholders(enValue);
    const ltPlaceholders = extractPlaceholders(ltValue);

    // Compare placeholders (ignoring ICU plural form differences)
    const enSimple = enPlaceholders.filter(p => !p.includes('plural'));
    const ltSimple = ltPlaceholders.filter(p => !p.includes('plural'));

    if (JSON.stringify(enSimple) !== JSON.stringify(ltSimple)) {
      placeholderMismatch.push({
        key,
        en: enSimple,
        lt: ltSimple
      });
    }
  }

  return { missing, extra, placeholderMismatch };
}

/**
 * Print validation results
 */
function printResults(result: ValidationResult): boolean {
  let hasErrors = false;

  console.log('\n=== Translation Validation Results ===\n');

  if (result.missing.length > 0) {
    hasErrors = true;
    console.log(`MISSING KEYS (${result.missing.length}):`);
    console.log('  Keys in EN but not in LT:');
    for (const key of result.missing) {
      console.log(`    - ${key}`);
    }
    console.log();
  }

  if (result.extra.length > 0) {
    hasErrors = true;
    console.log(`EXTRA KEYS (${result.extra.length}):`);
    console.log('  Keys in LT but not in EN:');
    for (const key of result.extra) {
      console.log(`    - ${key}`);
    }
    console.log();
  }

  if (result.placeholderMismatch.length > 0) {
    hasErrors = true;
    console.log(`PLACEHOLDER MISMATCHES (${result.placeholderMismatch.length}):`);
    for (const { key, en, lt } of result.placeholderMismatch) {
      console.log(`  ${key}:`);
      console.log(`    EN: ${JSON.stringify(en)}`);
      console.log(`    LT: ${JSON.stringify(lt)}`);
    }
    console.log();
  }

  if (!hasErrors) {
    console.log('All translations validated successfully!');
    console.log('  - No missing keys');
    console.log('  - No extra keys');
    console.log('  - All placeholders match');
  }

  return hasErrors;
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: tsx scripts/validate-translations.ts <en.json> <lt.json>');
  process.exit(1);
}

const enPath = resolve(process.cwd(), args[0]);
const ltPath = resolve(process.cwd(), args[1]);

console.log(`Validating translations:`);
console.log(`  EN: ${enPath}`);
console.log(`  LT: ${ltPath}`);

const result = validateTranslations(enPath, ltPath);
const hasErrors = printResults(result);

process.exit(hasErrors ? 1 : 0);
