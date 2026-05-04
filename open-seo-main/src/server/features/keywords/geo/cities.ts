import type { CityEntry } from "./types";

// Lithuanian city database with 50+ cities and morphological variants
export const LITHUANIAN_CITIES: CityEntry[] = [
  // Top 10 cities by population with 4+ morphological variants
  { name: "vilnius", variants: ["vilniuje", "vilniaus", "vilniu", "vilniui"] },
  { name: "kaunas", variants: ["kaune", "kauno", "kaunui", "kauna"] },
  { name: "klaipeda", variants: ["klaipedoje", "klaipedos", "klaipedai", "klaipeda"] },
  { name: "siauliai", variants: ["siauliuose", "siauliu", "siauliams", "siaulius"] },
  { name: "panevezys", variants: ["panevezio", "panevežyje", "panevežiui", "panevežy"] },
  { name: "alytus", variants: ["alytuje", "alytaus", "alytui", "alytu"] },
  { name: "marijampole", variants: ["marijampoleje", "marijampoles", "marijampolei", "marijampole"] },
  { name: "mazeikiai", variants: ["mazeikiuose", "mazeikiu", "mazeikiams", "mazeikius"] },
  { name: "jonava", variants: ["jonavoje", "jonavos", "jonavai", "jonava"] },
  { name: "utena", variants: ["utenoje", "utenos", "utenai", "utena"] },

  // 40+ additional Lithuanian cities with 2-3 variants each
  { name: "kedainiai", variants: ["kedainiuose", "kedainiu", "kedainiams"] },
  { name: "telsiai", variants: ["telsiuose", "telsiu", "telsiams"] },
  { name: "taurage", variants: ["taurageje", "taurages", "tauragei"] },
  { name: "ukmerge", variants: ["ukmergeje", "ukmerges", "ukmergei"] },
  { name: "visaginas", variants: ["visagine", "visagino", "visaginui"] },
  { name: "palanga", variants: ["palangoje", "palangos", "palangai"] },
  { name: "druskininkai", variants: ["druskininkuose", "druskininku", "druskininkams"] },
  { name: "rokiskis", variants: ["rokiskyje", "rokiskio", "rokiskiui"] },
  { name: "plunge", variants: ["plungeje", "plunges", "plungei"] },
  { name: "elektrenai", variants: ["elektrenuose", "elektrenu", "elektrenams"] },
  { name: "kretinga", variants: ["kretingoje", "kretingos", "kretingai"] },
  { name: "silute", variants: ["siluteje", "silutes", "silutei"] },
  { name: "radviliskis", variants: ["radviliskyje", "radviliskio", "radviliskiui"] },
  { name: "palangale", variants: ["palangaleje", "palangales", "palangalei"] },
  { name: "gargzdai", variants: ["gargzduose", "gargzdu", "gargzdams"] },
  { name: "vilkaviskis", variants: ["vilkaviskyje", "vilkaviskio", "vilkaviskiui"] },
  { name: "raseiniai", variants: ["raseiniuose", "raseiniu", "raseiniams"] },
  { name: "anyksciai", variants: ["anyksciuose", "anykscių", "anyksciams"] },
  { name: "lentvaris", variants: ["lentvarije", "lentvario", "lentvariui"] },
  { name: "prienai", variants: ["prienuose", "prienu", "prienams"] },
  { name: "joniskis", variants: ["joniskyje", "joniskio", "joniskiui"] },
  { name: "kelme", variants: ["kelmeje", "kelmes", "kelmei"] },
  { name: "varena", variants: ["varenoje", "varenos", "varenai"] },
  { name: "kaisiadorys", variants: ["kaisiadorisu", "kaisiadoriu", "kaisiadorims"] },
  { name: "pasvalys", variants: ["pasvaly", "pasvalio", "pasvalyje"] },
  { name: "kupiskis", variants: ["kupiskyje", "kupiskio", "kupiskiui"] },
  { name: "birstonas", variants: ["birstonoje", "birstono", "birstonui"] },
  { name: "neringa", variants: ["neringoje", "neringos", "neringai"] },
  { name: "pagegiai", variants: ["pagegiu", "pagegių", "pagegiams"] },
  { name: "skuodas", variants: ["skuode", "skuodo", "skuodui"] },
  { name: "zarasai", variants: ["zarasuose", "zarasu", "zarasams"] },
  { name: "moletai", variants: ["moletuose", "moletu", "moletams"] },
  { name: "ignalina", variants: ["ignalinoje", "ignalinos", "ignalinai"] },
  { name: "salcininkai", variants: ["salcininkuose", "salcininku", "salcininkams"] },
  { name: "silale", variants: ["silaleje", "silales", "silalei"] },
  { name: "sirvintos", variants: ["sirvintose", "sirvintu", "sirvintoms"] },
  { name: "skuodas", variants: ["skuode", "skuodo", "skuodui"] },
  { name: "lazdijai", variants: ["lazdijuose", "lazdiju", "lazdijams"] },
  { name: "jurbarkas", variants: ["jurbarke", "jurbarko", "jurkarkui"] },
  { name: "pakruojis", variants: ["pakruojyje", "pakruojo", "pakruojiui"] },
  { name: "rietavas", variants: ["rietave", "rietavo", "rietavui"] },
];

// Near-me patterns (Lithuanian and English)
export const NEAR_ME_PATTERNS: RegExp[] = [
  /\bsalia manes\b/i,
  /\bnetoli\b/i,
  /\barti\b/i,
  /\bprie manes\b/i,
  /\bmano rajone\b/i,
  /\bnear me\b/i,
  /\bnearby\b/i,
];

// Build variant lookup index for O(1) performance
const variantIndex = new Map<string, CityEntry>();

for (const city of LITHUANIAN_CITIES) {
  // Index all variants (lowercase for case-insensitive matching)
  for (const variant of city.variants) {
    variantIndex.set(variant.toLowerCase(), city);
  }
  // Also index the city name itself
  variantIndex.set(city.name.toLowerCase(), city);
}

/**
 * Find city by any morphological variant
 * @param text - City name or variant to search for
 * @returns CityEntry if found, null otherwise
 */
export function findCity(text: string): CityEntry | null {
  const normalized = text.toLowerCase().trim();
  return variantIndex.get(normalized) || null;
}
