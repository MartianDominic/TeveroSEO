import { describe, test, expect } from "vitest";
import { LITHUANIAN_CITIES, NEAR_ME_PATTERNS, findCity } from "./cities";
import type { CityEntry } from "./types";

describe("Lithuanian City Database", () => {
  test("contains 50+ cities", () => {
    expect(LITHUANIAN_CITIES.length).toBeGreaterThanOrEqual(50);
  });

  test("Each major city has 4+ variants", () => {
    const majorCities = ["vilnius", "kaunas", "klaipeda", "siauliai", "panevezys"];

    majorCities.forEach(cityName => {
      const city = LITHUANIAN_CITIES.find(c => c.name === cityName);
      expect(city).toBeDefined();
      expect(city!.variants.length).toBeGreaterThanOrEqual(4);
    });
  });

  test("vilnius has full morphological variants", () => {
    const vilnius = LITHUANIAN_CITIES.find(c => c.name === "vilnius");
    expect(vilnius?.variants).toContain("vilniuje");
    expect(vilnius?.variants).toContain("vilniaus");
    expect(vilnius?.variants).toContain("vilniu");
    expect(vilnius?.variants).toContain("vilniui");
  });

  test("CityEntry has correct structure", () => {
    const city: CityEntry = LITHUANIAN_CITIES[0];
    expect(city).toHaveProperty("name");
    expect(city).toHaveProperty("variants");
    expect(typeof city.name).toBe("string");
    expect(Array.isArray(city.variants)).toBe(true);
  });
});

describe("findCity", () => {
  test.each([
    ["vilniuje", "vilnius"],
    ["kaune", "kaunas"],
    ["siauliuose", "siauliai"],
    ["klaipedoje", "klaipeda"],
    ["panevezio", "panevezys"],
  ])("findCity(%s) returns %s", (variant, expected) => {
    const result = findCity(variant);
    expect(result).not.toBeNull();
    expect(result?.name).toBe(expected);
  });

  test("findCity with nonexistent city returns null", () => {
    expect(findCity("nonexistent")).toBeNull();
    expect(findCity("fakecity")).toBeNull();
  });

  test("findCity is case-insensitive", () => {
    expect(findCity("VILNIUJE")?.name).toBe("vilnius");
    expect(findCity("Kaune")?.name).toBe("kaunas");
  });
});

describe("NEAR_ME_PATTERNS", () => {
  test("contains at least 7 patterns", () => {
    expect(NEAR_ME_PATTERNS.length).toBeGreaterThanOrEqual(7);
  });

  test.each([
    ["salia manes", true],
    ["netoli", true],
    ["arti", true],
    ["near me", true],
    ["nearby", true],
    ["vilniuje", false],
    ["kaunas", false],
  ])("pattern matching for '%s': %s", (text, expected) => {
    const matches = NEAR_ME_PATTERNS.some(p => p.test(text));
    expect(matches).toBe(expected);
  });
});
