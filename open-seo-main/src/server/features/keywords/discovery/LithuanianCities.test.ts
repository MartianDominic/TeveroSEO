/**
 * Lithuanian Cities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  LITHUANIAN_CITIES,
  extractCityFromKeyword,
  removeCity,
} from './LithuanianCities';

describe('LithuanianCities', () => {
  describe('LITHUANIAN_CITIES database', () => {
    it('should have at least 50 cities', () => {
      expect(LITHUANIAN_CITIES.length).toBeGreaterThanOrEqual(50);
    });

    it('should include all major cities with locative variants', () => {
      const majorCities = ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Panevėžys'];

      for (const cityName of majorCities) {
        const city = LITHUANIAN_CITIES.find(c => c.name === cityName);
        expect(city).toBeDefined();
        expect(city?.variants.length).toBeGreaterThan(0);
      }
    });

    it('should have locative forms for Vilnius', () => {
      const vilnius = LITHUANIAN_CITIES.find(c => c.name === 'Vilnius');
      expect(vilnius?.variants).toContain('vilniuje');
    });

    it('should have locative forms for Kaunas', () => {
      const kaunas = LITHUANIAN_CITIES.find(c => c.name === 'Kaunas');
      expect(kaunas?.variants).toContain('kaune');
    });
  });

  describe('extractCityFromKeyword', () => {
    it('should extract city from "automobilių plovykla vilniuje"', () => {
      const result = extractCityFromKeyword('automobilių plovykla vilniuje');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('vilnius');
      expect(result?.variant).toBe('vilniuje');
    });

    it('should extract city from "plovykla kaune"', () => {
      const result = extractCityFromKeyword('plovykla kaune');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('kaunas');
      expect(result?.variant).toBe('kaune');
    });

    it('should return null for "automobilis" (no city)', () => {
      const result = extractCityFromKeyword('automobilis');
      expect(result).toBeNull();
    });

    it('should handle mixed case', () => {
      const result = extractCityFromKeyword('Plovykla VILNIUJE');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('vilnius');
    });

    it('should extract city from "klaipėdoje veikianti įmonė"', () => {
      const result = extractCityFromKeyword('klaipėdoje veikianti įmonė');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('klaipėda');
      expect(result?.variant).toBe('klaipėdoje');
    });

    it('should extract city from "šiauliuose esanti parduotuvė"', () => {
      const result = extractCityFromKeyword('šiauliuose esanti parduotuvė');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('šiauliai');
      expect(result?.variant).toBe('šiauliuose');
    });
  });

  describe('removeCity', () => {
    it('should remove city from "automobilių plovykla vilniuje"', () => {
      const result = removeCity('automobilių plovykla vilniuje', 'vilniuje');
      expect(result).toBe('automobilių plovykla');
    });

    it('should remove city from "plovykla kaune"', () => {
      const result = removeCity('plovykla kaune', 'kaune');
      expect(result).toBe('plovykla');
    });

    it('should trim whitespace after removal', () => {
      const result = removeCity('  plovykla  vilniuje  ', 'vilniuje');
      expect(result).toBe('plovykla');
    });

    it('should handle case-insensitive removal', () => {
      const result = removeCity('Plovykla VILNIUJE', 'vilniuje');
      expect(result).toBe('Plovykla');
    });
  });
});
