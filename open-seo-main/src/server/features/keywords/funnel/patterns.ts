/**
 * Lithuanian funnel stage pattern library.
 *
 * Patterns use word boundaries and case-insensitive matching.
 * Morphological variants are explicitly listed (not stemmed) for precision.
 */

export interface PatternGroup {
  patterns: RegExp[];
  type: string;  // e.g., "purchase", "booking", "comparison", "learning"
}

// ============================================================
// BOFU PATTERNS (40+) - Ready to buy/book NOW
// ============================================================

export const BOFU_PATTERNS: PatternGroup[] = [
  // Purchase intent
  {
    type: "purchase",
    patterns: [
      /\b(pirkti|pirk|nusipirk|nupirkti|įsigyti)\b/i,
      /\b(užsakyti|užsisakyti|užsakymas|užsak)\b/i,
      /\b(kaina|kainos|kiek kainuoja|kainuoja)\b/i,
      /\b(nuolaida|akcija|išpardavimas|pigiau)\b/i,
      /\b(mokėjimas|apmokėti|sumokėti|mokėti)\b/i,
      /\b(piniginė|biudžetas|pigiai|pigus|nebrangiai)\b/i,
      /\b(kreditinė|kortele|grynais)\b/i,
      /\b(išsimokėtinai|dalimis|lizingas)\b/i,
      /\b(nemokamai|dykai|dovanų)\b/i,
    ],
  },
  // Service booking
  {
    type: "booking",
    patterns: [
      /\b(registruotis|registracija|užsiregistruoti)\b/i,
      /\b(rezervuoti|rezervacija|rezervuok|rezervacijos)\b/i,
      /\b(skambinti|susisiekti|kontaktai|kontaktas)\b/i,
      /\b(konsultacija|pasitarimas|patarimas)\b/i,
      /\b(paslaugos|paslauga|aptarnavimas)\b/i,
      /\b(laikas|laiką|užsisakyti laiką)\b/i,
      /\b(vizitas|apsilankymas)\b/i,
    ],
  },
  // Local/immediate intent
  {
    type: "local",
    patterns: [
      /(šalia manęs|netoli|arti|greta)/i,
      /\b(dabar|šiandien|skubiai|greitai|tuoj)\b/i,
      /\b(mieste|rajone|centre|vietoje)\b/i,
      /\b(atidarytas?|darbo laikas|kada dirba|veikia)\b/i,
      /\b(adresas|vieta|kur rasti)\b/i,
      /\b(telefonas|tel|telefono numeris)\b/i,
    ],
  },
  // Delivery
  {
    type: "delivery",
    patterns: [
      /\b(pristatymas|siuntimas|atsiėmimas|pristato)\b/i,
      /\b(nemokamas pristatymas|dykai pristato)\b/i,
      /\b(greitai pristatoma?|greitas pristatymas)\b/i,
      /\b(kurjeris|paštu|į namus|į adresą)\b/i,
      /\b(siuntų|siųsti|siųsk)\b/i,
      /\b(transportavimas|pervežimas)\b/i,
    ],
  },
  // Product specifics (signals buying decision)
  {
    type: "product_specific",
    patterns: [
      /\b(dydis|dydžiai|matmenys|matmuo)\b/i,
      /\b(spalva|spalvos|spalvų)\b/i,
      /\b(garantija|garantinis|garantuota)\b/i,
      /\b(originalus|originalas|autentiškas)\b/i,
      /\b(naujas|nauja|naujiena|naujausias)\b/i,
      /\b(kiekis|likutis|sandėlyje)\b/i,
      /\b(prekės kodas|artikulas|modelis)\b/i,
      /\b(komplektas|rinkinys|pakuotė)\b/i,
      /\b(svoris|sūris|tūris)\b/i,
      /\b(medžiaga|kokybė|sudėtis)\b/i,
      /\b(galiojimas|terminas|data)\b/i,
      /\b(sertifikatas|licencija)\b/i,
    ],
  },
];

// ============================================================
// MOFU PATTERNS (30+) - Comparing options
// ============================================================

export const MOFU_PATTERNS: PatternGroup[] = [
  // Best/top lists
  {
    type: "comparison",
    patterns: [
      /\b(geriausi|geriausias|geriausios|geriausia|geriausių)\b/i,
      /\b(top \d+|topas|top10|top5|top 5)\b/i,
      /\b(populiariausi|populiariausios|populiariausia)\b/i,
      /\b(rekomenduojami|rekomenduojamos|rekomenduojama)\b/i,
      /\b(patikimiausi|kokybiškiausi|efektyviausi)\b/i,
      /\b(naujausi|moderniausi|tobuliausi)\b/i,
    ],
  },
  // Direct comparison
  {
    type: "versus",
    patterns: [
      /\b(palyginti|palyginimas|palyginimui)\b/i,
      /\bvs\b/i,
      /\b(ar)\s+\w+\s+(ar)\b/i,  // "ar X ar Y"
      /\b(skirtumai|skirtumas|skiriasi)\b/i,
      /\b(privalumai|trūkumai|pranašumai)\b/i,
      /\b(kuris geresnis|kuri geresnė|kas geriau)\b/i,
    ],
  },
  // Reviews and opinions
  {
    type: "reviews",
    patterns: [
      /\b(atsiliepimai|atsiliepimas|įvertinimai|įvertinimas)\b/i,
      /\b(nuomonė|nuomonės|patirtis|patirtys)\b/i,
      /\b(ar verta|verta pirkti|ar geras|ar gera)\b/i,
      /\b(rekomenduoju|patarimai|patarimas|rekomendacijos)\b/i,
      /\b(komentarai|apžvalgos|apžvalga)\b/i,
      /\b(testas|testavimas|išbandymas)\b/i,
    ],
  },
  // Selection help
  {
    type: "selection",
    patterns: [
      /\b(kaip pasirinkti|kaip išsirinkti|pasirinkimas)\b/i,
      /\b(koks|kokia|kokie|kokios)\s+.+?\s+(pasirinkti|rinktis|tinka)\b/i,
      /\b(koks|kokia|kokie|kokios)\s+(tinka|pasirinkti|rinktis)\b/i,
      /\b(alternatyva|alternatyvos|panašus|panašūs|analogai)\b/i,
      /\b(reitingas|reitingai|vertinimas)\b/i,
      /\b(gidas|vadovas|patarimai renkantis)\b/i,
    ],
  },
  // Specific use cases
  {
    type: "use_case",
    patterns: [
      /\b(kam\s+tinka|kam\s+skirtas|kam\s+skirta)\b/i,
      /\b(riebiems|sausiems|normaliai)\s+\w+\b/i,  // e.g., "riebiems plaukams"
      /\b(pradedantiesiems|profesionalams|namuose|biure)\b/i,
      /\b(žiemai|vasarai|rudens|pavasario)\b/i,
      /\b(vaikams|suaugusiems|vyrams|moterims)\b/i,
      /\b(jautriems|probleminiams|normaliai)\b/i,
      /\b(laisvalaikio|sporto|verslo)\b/i,
    ],
  },
];

// ============================================================
// TOFU PATTERNS (25+) - Just learning
// ============================================================

export const TOFU_PATTERNS: PatternGroup[] = [
  // Definition questions
  {
    type: "learning",
    patterns: [
      /\b(kas yra|kas tai|ką reiškia)\b/i,
      /\b(apibrėžimas|sąvoka|terminas|samprata)\b/i,
      /\b(kaip veikia|kaip tai veikia|veikimo principas)\b/i,
      /\b(supratimas|suvokimas|esmė)\b/i,
      /\b(reikšmė|prasmė)\b/i,
    ],
  },
  // How-to questions
  {
    type: "how_to",
    patterns: [
      /\b(kaip naudoti|naudojimas|naudojimo)\b/i,
      /\b(kaip padaryti|kaip sukurti|kaip gaminti)\b/i,
      /\b(instrukcija|instrukcijos|vadovas|gidas)\b/i,
      /\b(žingsnis po žingsnio|etapai|eiliškumas)\b/i,
      /\b(būdai|metodai|priemonės)\b/i,
      /\b(proceso|procesas)\b/i,
    ],
  },
  // Why questions
  {
    type: "why",
    patterns: [
      /\b(kodėl|kam reikia|ar reikia|ar verta)\b/i,
      /\b(nauda|privalumai ir trūkumai|pliusai)\b/i,
      /\b(svarba|svarbu|būtina|reikalinga)\b/i,
      /\b(priežastys|pagrindas)\b/i,
      /\b(efektas|poveikis|rezultatai)\b/i,
    ],
  },
  // General information
  {
    type: "information",
    patterns: [
      /\b(istorija|tendencijos|ateitis|raida)\b/i,
      /\b(pradedantiesiems|pradžiamoksliams|naujiems)\b/i,
      /\b(informacija|faktai|statistika|duomenys)\b/i,
      /\b(apžvalga|analizė|tyrimas)\b/i,
      /\b(įvadas|pagrindai|bazė)\b/i,
    ],
  },
  // Tips and guides
  {
    type: "tips",
    patterns: [
      /\b(patarimai|patarimas|patariame|rekomendacijos)\b/i,
      /\b(idėjos|idėja|mintys)\b/i,
      /\b(taisyklės|principai|normos)\b/i,
      /\b(klaidos|vengti|nedaryk|kliūtys)\b/i,
      /\b(gudrybės|triukai|patirtis)\b/i,
    ],
  },
];

// ============================================================
// Matching Functions
// ============================================================

export interface PatternMatchResult {
  matched: boolean;
  patternType: string | null;
}

/**
 * Match keyword against a set of pattern groups.
 * Returns on first match (early exit for performance).
 */
export function matchPatterns(
  keyword: string,
  patternGroups: PatternGroup[]
): PatternMatchResult {
  const normalizedKeyword = keyword.toLowerCase().trim();

  for (const group of patternGroups) {
    for (const pattern of group.patterns) {
      if (pattern.test(normalizedKeyword)) {
        return { matched: true, patternType: group.type };
      }
    }
  }

  return { matched: false, patternType: null };
}

/**
 * Check all pattern sets and return best match.
 * Priority: BOFU > MOFU > TOFU (purchase intent wins ties).
 */
export function detectFunnelPatterns(keyword: string): {
  stage: "bofu" | "mofu" | "tofu" | null;
  patternType: string | null;
} {
  const bofuMatch = matchPatterns(keyword, BOFU_PATTERNS);
  if (bofuMatch.matched) {
    return { stage: "bofu", patternType: bofuMatch.patternType };
  }

  const mofuMatch = matchPatterns(keyword, MOFU_PATTERNS);
  if (mofuMatch.matched) {
    return { stage: "mofu", patternType: mofuMatch.patternType };
  }

  const tofuMatch = matchPatterns(keyword, TOFU_PATTERNS);
  if (tofuMatch.matched) {
    return { stage: "tofu", patternType: tofuMatch.patternType };
  }

  return { stage: null, patternType: null };
}
