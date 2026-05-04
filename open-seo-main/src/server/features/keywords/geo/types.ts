import { z } from "zod";

export interface CityEntry {
  name: string;           // Normalized city name (nominative: vilnius, kaunas)
  variants: string[];     // All morphological forms (vilniuje, vilniaus, vilniu)
}

export interface GeoClassification {
  hasExplicitCity: boolean;
  city: string | null;           // Normalized city name
  isNearMe: boolean;
  isGeneric: boolean;            // No location mentioned
  passesGeoFilter: boolean;      // Given constraints
  geoScore: number;              // 0-1 for scoring
  reason: string;                // Why pass/fail
}

export const GeoConstraintsSchema = z.object({
  includeCities: z.array(z.string()).default([]),
  excludeCities: z.array(z.string()).default([]),
  nearMeAllowed: z.boolean().default(true),
  genericAllowed: z.boolean().default(true),
});

export type GeoConstraints = z.infer<typeof GeoConstraintsSchema>;
