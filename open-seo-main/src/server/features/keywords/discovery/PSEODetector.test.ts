/**
 * PSEODetector Tests
 */

import { describe, it, expect } from 'vitest';
import { PSEODetector, detectPSEOPatterns, computePSEOScore } from './PSEODetector';
import type { PSEOCluster, PSEODetectorConfig } from './types';

// Mock keyword data for testing
interface MockKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  type: 'bofu' | 'mofu' | 'tofu';
}

const carWashKeywords: MockKeyword[] = [
  { keyword: 'automobilių plovykla vilniuje', volume: 320, difficulty: 45, type: 'bofu' },
  { keyword: 'automobilių plovykla kaune', volume: 280, difficulty: 42, type: 'bofu' },
  { keyword: 'automobilių plovykla klaipėdoje', volume: 150, difficulty: 38, type: 'bofu' },
  { keyword: 'automobilių plovykla šiauliuose', volume: 120, difficulty: 35, type: 'bofu' },
  { keyword: 'automobilių plovykla panevėžyje', volume: 90, difficulty: 32, type: 'bofu' },
];

const mixedKeywords: MockKeyword[] = [
  ...carWashKeywords,
  { keyword: 'kirpykla vilniuje', volume: 200, difficulty: 40, type: 'bofu' },
  { keyword: 'kirpykla kaune', volume: 180, difficulty: 38, type: 'bofu' },
  { keyword: 'kirpykla klaipėdoje', volume: 120, difficulty: 35, type: 'bofu' },
  { keyword: 'automobilis', volume: 500, difficulty: 60, type: 'tofu' }, // No city
];

describe('PSEODetector', () => {
  describe('detectPSEOPatterns', () => {
    it('should detect single car wash cluster from 5 city keywords', () => {
      const clusters = detectPSEOPatterns(carWashKeywords);

      expect(clusters).toHaveLength(1);
      expect(clusters[0].pattern).toContain('automobilių plovykla');
      expect(clusters[0].pattern).toContain('[CITY]');
    });

    it('should extract all 5 cities from car wash cluster', () => {
      const clusters = detectPSEOPatterns(carWashKeywords);

      expect(clusters[0].cities).toHaveLength(5);
      expect(clusters[0].cities).toContain('vilnius');
      expect(clusters[0].cities).toContain('kaunas');
      expect(clusters[0].cities).toContain('klaipėda');
      expect(clusters[0].cities).toContain('šiauliai');
      expect(clusters[0].cities).toContain('panevėžys');
    });

    it('should calculate correct total volume (960)', () => {
      const clusters = detectPSEOPatterns(carWashKeywords);

      expect(clusters[0].totalVolume).toBe(960);
    });

    it('should generate URL template as /automobiliu-plovykla/{city}', () => {
      const clusters = detectPSEOPatterns(carWashKeywords);

      expect(clusters[0].template).toMatch(/^\/[a-z-]+\/\{city\}$/);
      expect(clusters[0].template).toContain('plovykla');
    });

    it('should exclude clusters with less than 3 keywords', () => {
      const twoKeywords: MockKeyword[] = [
        { keyword: 'automobilių plovykla vilniuje', volume: 320, difficulty: 45, type: 'bofu' },
        { keyword: 'automobilių plovykla kaune', volume: 280, difficulty: 42, type: 'bofu' },
      ];

      const clusters = detectPSEOPatterns(twoKeywords);
      expect(clusters).toHaveLength(0);
    });

    it('should calculate opportunity score between 0 and 1', () => {
      const clusters = detectPSEOPatterns(carWashKeywords);

      expect(clusters[0].opportunityScore).toBeGreaterThan(0);
      expect(clusters[0].opportunityScore).toBeLessThanOrEqual(1);
    });

    it('should detect multiple patterns and return them sorted by score', () => {
      const clusters = detectPSEOPatterns(mixedKeywords);

      expect(clusters.length).toBeGreaterThanOrEqual(2);

      // Check descending sort by opportunityScore
      for (let i = 0; i < clusters.length - 1; i++) {
        expect(clusters[i].opportunityScore).toBeGreaterThanOrEqual(
          clusters[i + 1].opportunityScore
        );
      }
    });

    it('should respect custom minClusterSize config', () => {
      const config: PSEODetectorConfig = {
        minClusterSize: 5,
        volumeWeight: 0.35,
        cityWeight: 0.25,
        difficultyWeight: 0.20,
        funnelWeight: 0.20,
      };

      const fourKeywords = carWashKeywords.slice(0, 4);
      const clusters = detectPSEOPatterns(fourKeywords, config);

      expect(clusters).toHaveLength(0); // 4 keywords < minClusterSize of 5
    });

    it('should set estimatedPages to 50+', () => {
      const clusters = detectPSEOPatterns(carWashKeywords);

      expect(clusters[0].estimatedPages).toBeGreaterThanOrEqual(50);
    });

    it('should include all matching keywords in cluster', () => {
      const clusters = detectPSEOPatterns(carWashKeywords);

      expect(clusters[0].keywords).toHaveLength(5);
      expect(clusters[0].keywords).toContain('automobilių plovykla vilniuje');
      expect(clusters[0].keywords).toContain('automobilių plovykla panevėžyje');
    });
  });

  describe('computePSEOScore', () => {
    it('should return score between 0 and 1', () => {
      const cluster: PSEOCluster = {
        pattern: 'automobilių plovykla [CITY]',
        template: '/automobiliu-plovykla/{city}',
        keywords: carWashKeywords.map(k => k.keyword),
        cities: ['vilnius', 'kaunas', 'klaipėda', 'šiauliai', 'panevėžys'],
        estimatedPages: 52,
        totalVolume: 960,
        avgDifficulty: 38.4,
        opportunityScore: 0, // Will be calculated
      };

      const score = computePSEOScore(cluster, carWashKeywords);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should weight volume at 35%', () => {
      // High volume cluster should score higher
      const highVolumeCluster: PSEOCluster = {
        pattern: 'test [CITY]',
        template: '/test/{city}',
        keywords: ['test vilniuje', 'test kaune', 'test klaipėdoje'],
        cities: ['vilnius', 'kaunas', 'klaipėda'],
        estimatedPages: 52,
        totalVolume: 10000,
        avgDifficulty: 50,
        opportunityScore: 0,
      };

      const lowVolumeCluster: PSEOCluster = {
        ...highVolumeCluster,
        totalVolume: 500,
      };

      const highScore = computePSEOScore(highVolumeCluster, [
        { keyword: 'test vilniuje', volume: 3333, difficulty: 50, type: 'bofu' },
        { keyword: 'test kaune', volume: 3333, difficulty: 50, type: 'bofu' },
        { keyword: 'test klaipėdoje', volume: 3334, difficulty: 50, type: 'bofu' },
      ]);

      const lowScore = computePSEOScore(lowVolumeCluster, [
        { keyword: 'test vilniuje', volume: 166, difficulty: 50, type: 'bofu' },
        { keyword: 'test kaune', volume: 167, difficulty: 50, type: 'bofu' },
        { keyword: 'test klaipėdoje', volume: 167, difficulty: 50, type: 'bofu' },
      ]);

      expect(highScore).toBeGreaterThan(lowScore);
    });
  });

  describe('PSEODetector class', () => {
    it('should instantiate with default config', () => {
      const detector = new PSEODetector();
      expect(detector).toBeDefined();
    });

    it('should detect patterns via detect() method', () => {
      const detector = new PSEODetector();
      const clusters = detector.detect(carWashKeywords);

      expect(clusters).toHaveLength(1);
      expect(clusters[0].pattern).toContain('automobilių plovykla');
    });

    it('should use custom config', () => {
      const config: PSEODetectorConfig = {
        minClusterSize: 5,
        volumeWeight: 0.35,
        cityWeight: 0.25,
        difficultyWeight: 0.20,
        funnelWeight: 0.20,
      };

      const detector = new PSEODetector(config);
      const fourKeywords = carWashKeywords.slice(0, 4);
      const clusters = detector.detect(fourKeywords);

      expect(clusters).toHaveLength(0);
    });
  });
});
