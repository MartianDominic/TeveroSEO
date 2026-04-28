/**
 * Lithuanian Hair Care Domain Lemma Map
 *
 * Maps inflected Lithuanian forms to their nominative singular base forms.
 * Organized by semantic category for maintainability.
 *
 * Lithuanian has 7 grammatical cases affecting all nouns/adjectives:
 * - Nominative (vardininkas): base form - "plaukai" (hair)
 * - Genitive (kilmininkas): possession - "plaukų" (of hair)
 * - Dative (naudininkas): indirect object - "plaukams" (for hair)
 * - Accusative (galininkas): direct object - "plaukus" (hair)
 * - Instrumental (įnagininkas): means - "plaukais" (with hair)
 * - Locative (vietininkas): location - "plaukuose" (in hair)
 * - Vocative (šauksmininkas): address - "plaukai" (O hair!)
 *
 * E-commerce patterns:
 * - Category names often use Dative: "Dažytiems plaukams" (for colored hair)
 * - Product types in Nominative: "Šampūnas" (shampoo)
 */

// =============================================================================
// HAIR TYPES AND CONDITIONS (Dative plural -> Nominative singular)
// =============================================================================

const HAIR_TYPES: Record<string, string> = {
  // Basic hair types - Dative plural forms
  plaukams: "plaukai", // for hair -> hair
  dažytiems: "dažytas", // for colored -> colored
  pažeistiems: "pažeistas", // for damaged -> damaged
  riebiems: "riebus", // for oily -> oily
  sausiems: "sausas", // for dry -> dry
  normaliems: "normalus", // for normal -> normal
  garbanotiems: "garbanotas", // for curly -> curly
  ploniems: "plonas", // for thin -> thin
  storiems: "storas", // for thick -> thick
  silpniems: "silpnas", // for weak -> weak
  stipriems: "stiprus", // for strong -> strong
  spalvotiems: "spalvotas", // for colored -> colored
  šviesiems: "šviesus", // for light/blonde -> light/blonde
  tamsiems: "tamsus", // for dark -> dark
  žiliems: "žilas", // for gray -> gray
  blankiems: "blankus", // for dull -> dull
  blizgiems: "blizgus", // for shiny -> shiny
  jautriems: "jautrus", // for sensitive -> sensitive
  aliejingiems: "aliejingas", // for oily -> oily
  sveikiems: "sveikas", // for healthy -> healthy
  trapiems: "trapus", // for brittle -> brittle
  minkštiems: "minkštas", // for soft -> soft
  šiurkštiems: "šiurkštus", // for coarse -> coarse
  putliems: "putlus", // for fluffy -> fluffy
  slenkantiems: "slenkantis", // for falling -> falling
  retėjantiems: "retėjantis", // for thinning -> thinning
  besiraitantiems: "besiraitantis", // for frizzy -> frizzy
  banguotiems: "banguotas", // for wavy -> wavy
  tiesiems: "tiesus", // for straight -> straight
  chemiškai: "chemiškas", // chemically -> chemical
  apdorotiems: "apdorotas", // for treated -> treated
  natūraliems: "natūralus", // for natural -> natural

  // Genitive plural forms
  plaukų: "plaukai", // of hair -> hair
  dažytų: "dažytas", // of colored -> colored
  pažeistų: "pažeistas", // of damaged -> damaged
  riebių: "riebus", // of oily -> oily
  sausų: "sausas", // of dry -> dry

  // Accusative plural forms
  plaukus: "plaukai", // hair (acc) -> hair
  dažytus: "dažytas", // colored (acc) -> colored
};

// =============================================================================
// PRODUCT TYPES (Plural -> Singular nominative)
// =============================================================================

const PRODUCT_TYPES: Record<string, string> = {
  // Shampoos
  šampūnai: "šampūnas", // shampoos -> shampoo
  šampūno: "šampūnas", // of shampoo -> shampoo
  šampūnų: "šampūnas", // of shampoos -> shampoo
  šampūną: "šampūnas", // shampoo (acc) -> shampoo
  šampūnu: "šampūnas", // with shampoo -> shampoo

  // Conditioners
  kondicionieriai: "kondicionierius", // conditioners -> conditioner
  kondicionieriaus: "kondicionierius", // of conditioner -> conditioner
  kondicionierių: "kondicionierius", // of conditioners -> conditioner
  kondicionierį: "kondicionierius", // conditioner (acc) -> conditioner

  // Masks
  kaukės: "kaukė", // masks -> mask
  kaukę: "kaukė", // mask (acc) -> mask
  kaukių: "kaukė", // of masks -> mask
  kaukei: "kaukė", // for mask -> mask

  // Oils
  aliejai: "aliejus", // oils -> oil
  aliejaus: "aliejus", // of oil -> oil
  aliejų: "aliejus", // of oils -> oil
  aliejumi: "aliejus", // with oil -> oil

  // Serums
  serumai: "serumas", // serums -> serum
  serumų: "serumas", // of serums -> serum
  serumo: "serumas", // of serum -> serum

  // Sprays
  purškikliai: "purškiklis", // sprays -> spray
  purškiklio: "purškiklis", // of spray -> spray
  purškiklių: "purškiklis", // of sprays -> spray

  // Balms
  balzamai: "balzamas", // balms -> balm
  balzamo: "balzamas", // of balm -> balm
  balzamų: "balzamas", // of balms -> balm

  // Lotions
  losjonai: "losjonas", // lotions -> lotion
  losjono: "losjonas", // of lotion -> lotion
  losjonų: "losjonas", // of lotions -> lotion

  // Creams
  kremai: "kremas", // creams -> cream
  kremo: "kremas", // of cream -> cream
  kremų: "kremas", // of creams -> cream

  // Foams/mousses
  putos: "puta", // foams -> foam
  putų: "puta", // of foams -> foam
  putą: "puta", // foam (acc) -> foam

  // Gels
  geliai: "gelis", // gels -> gel
  gelio: "gelis", // of gel -> gel
  gelių: "gelis", // of gels -> gel

  // Waxes
  vaškai: "vaškas", // waxes -> wax
  vaško: "vaškas", // of wax -> wax
  vaškų: "vaškas", // of waxes -> wax

  // Dyes/colors
  dažai: "dažas", // dyes -> dye
  dažų: "dažas", // of dyes -> dye
  dažo: "dažas", // of dye -> dye

  // Pastes
  pastos: "pasta", // pastes -> paste
  pastų: "pasta", // of pastes -> paste
  pastą: "pasta", // paste (acc) -> paste

  // Tonics
  tonikai: "tonikas", // tonics -> tonic
  toniko: "tonikas", // of tonic -> tonic
  tonikų: "tonikas", // of tonics -> tonic

  // Sprays (alternative)
  purškala: "purškala", // spray (noun)
  purškalai: "purškala", // sprays -> spray

  // Lacquers/hairsprays
  lakai: "lakas", // lacquers -> lacquer
  lako: "lakas", // of lacquer -> lacquer
  lakų: "lakas", // of lacquers -> lacquer

  // Treatments
  procedūros: "procedūra", // procedures -> procedure
  procedūrų: "procedūra", // of procedures -> procedure
  procedūrai: "procedūra", // for procedure -> procedure

  // Ampoules
  ampulės: "ampulė", // ampoules -> ampoule
  ampulių: "ampulė", // of ampoules -> ampoule
  ampulę: "ampulė", // ampoule (acc) -> ampoule
};

// =============================================================================
// ACTIONS AND TREATMENTS (Genitive/Dative -> Nominative)
// =============================================================================

const ACTIONS: Record<string, string> = {
  // Care
  priežiūrai: "priežiūra", // for care -> care
  priežiūros: "priežiūra", // of care -> care
  priežiūrą: "priežiūra", // care (acc) -> care

  // Strengthening
  stiprinimui: "stiprinimas", // for strengthening -> strengthening
  stiprinimo: "stiprinimas", // of strengthening -> strengthening
  stiprinimą: "stiprinimas", // strengthening (acc) -> strengthening

  // Moisturizing
  drėkinimui: "drėkinimas", // for moisturizing -> moisturizing
  drėkinimo: "drėkinimas", // of moisturizing -> moisturizing
  drėkinimą: "drėkinimas", // moisturizing (acc) -> moisturizing

  // Restoration
  atstatymui: "atstatymas", // for restoration -> restoration
  atstatymo: "atstatymas", // of restoration -> restoration
  atstatymą: "atstatymas", // restoration (acc) -> restoration

  // Protection
  apsaugai: "apsauga", // for protection -> protection
  apsaugos: "apsauga", // of protection -> protection
  apsaugą: "apsauga", // protection (acc) -> protection

  // Styling/forming
  formavimui: "formavimas", // for styling -> styling
  formavimo: "formavimas", // of styling -> styling
  formavimą: "formavimas", // styling (acc) -> styling

  // Cleansing
  valymui: "valymas", // for cleansing -> cleansing
  valymo: "valymas", // of cleansing -> cleansing
  valymą: "valymas", // cleansing (acc) -> cleansing

  // Nourishing
  maitinimui: "maitinimas", // for nourishing -> nourishing
  maitinimo: "maitinimas", // of nourishing -> nourishing
  maitinimą: "maitinimas", // nourishing (acc) -> nourishing

  // Coloring
  dažymui: "dažymas", // for coloring -> coloring
  dažymo: "dažymas", // of coloring -> coloring
  dažymą: "dažymas", // coloring (acc) -> coloring

  // Volume
  apimčiai: "apimtis", // for volume -> volume
  apimties: "apimtis", // of volume -> volume
  apimtį: "apimtis", // volume (acc) -> volume

  // Shine
  blizgesiui: "blizgesys", // for shine -> shine
  blizgesio: "blizgesys", // of shine -> shine
  blizgesį: "blizgesys", // shine (acc) -> shine

  // Smoothing
  glodinimui: "glodinimas", // for smoothing -> smoothing
  glodinimo: "glodinimas", // of smoothing -> smoothing
  glodinimą: "glodinimas", // smoothing (acc) -> smoothing

  // Straightening
  tiesinimui: "tiesinimas", // for straightening -> straightening
  tiesinimo: "tiesinimas", // of straightening -> straightening
  tiesinimą: "tiesinimas", // straightening (acc) -> straightening

  // Curling
  garbanojimui: "garbanojimas", // for curling -> curling
  garbanojimo: "garbanojimas", // of curling -> curling

  // Detangling
  iššukavimui: "iššukavimas", // for detangling -> detangling
  iššukavimo: "iššukavimas", // of detangling -> detangling

  // Growth
  augimui: "augimas", // for growth -> growth
  augimo: "augimas", // of growth -> growth

  // Repair
  taisymui: "taisymas", // for repair -> repair
  taisymo: "taisymas", // of repair -> repair

  // Hydration (alternative)
  hidratavimui: "hidratavimas", // for hydration -> hydration
  hidratavimo: "hidratavimas", // of hydration -> hydration

  // Regeneration
  regeneravimui: "regeneravimas", // for regeneration -> regeneration
  regeneravimo: "regeneravimas", // of regeneration -> regeneration

  // Thermual protection
  termoapsaugai: "termoapsauga", // for thermal protection -> thermal protection
  termoapsaugos: "termoapsauga", // of thermal protection -> thermal protection

  // Fixation
  fiksavimui: "fiksavimas", // for fixation -> fixation
  fiksavimo: "fiksavimas", // of fixation -> fixation
};

// =============================================================================
// BODY PARTS (Genitive/Dative -> Nominative)
// =============================================================================

const BODY_PARTS: Record<string, string> = {
  // Head
  galvos: "galva", // of head -> head
  galvai: "galva", // for head -> head
  galvą: "galva", // head (acc) -> head

  // Skin/scalp
  odos: "oda", // of skin -> skin
  odai: "oda", // for skin -> skin
  odą: "oda", // skin (acc) -> skin

  // Scalp (specific)
  galvosodos: "galvosoda", // of scalp -> scalp

  // Hair ends
  galiukų: "galiukas", // of ends -> end
  galiukams: "galiukas", // for ends -> end
  galiukus: "galiukas", // ends (acc) -> end

  // Roots
  šaknų: "šaknis", // of roots -> root
  šaknims: "šaknis", // for roots -> root
  šaknis: "šaknis", // roots -> root

  // Eyebrows
  antakių: "antakis", // of eyebrows -> eyebrow
  antakiams: "antakis", // for eyebrows -> eyebrow

  // Beard
  barzdos: "barzda", // of beard -> beard
  barzdai: "barzda", // for beard -> beard
  barzdą: "barzda", // beard (acc) -> beard
};

// =============================================================================
// INGREDIENTS AND COMPONENTS
// =============================================================================

const INGREDIENTS: Record<string, string> = {
  // Keratin
  keratino: "keratinas", // of keratin -> keratin
  keratinui: "keratinas", // for keratin -> keratin
  keratiną: "keratinas", // keratin (acc) -> keratin
  keratinu: "keratinas", // with keratin -> keratin

  // Collagen
  kolageno: "kolagenas", // of collagen -> collagen
  kolagenui: "kolagenas", // for collagen -> collagen
  kolageną: "kolagenas", // collagen (acc) -> collagen

  // Argan
  argano: "arganas", // of argan -> argan
  arganui: "arganas", // for argan -> argan

  // Coconut
  kokoso: "kokosas", // of coconut -> coconut
  kokosų: "kokosas", // of coconuts -> coconut

  // Aloe
  alavijo: "alavijas", // of aloe -> aloe
  alavijui: "alavijas", // for aloe -> aloe

  // Vitamin
  vitaminų: "vitaminas", // of vitamins -> vitamin
  vitaminais: "vitaminas", // with vitamins -> vitamin
  vitaminui: "vitaminas", // for vitamin -> vitamin

  // Protein
  baltymų: "baltymas", // of proteins -> protein
  baltymais: "baltymas", // with proteins -> protein
  baltymui: "baltymas", // for protein -> protein

  // Oil (general)
  aliejumi: "aliejus", // with oil -> oil

  // Shea butter
  taukmedžio: "taukmedis", // of shea tree -> shea tree

  // Hyaluronic acid
  hialurono: "hialuronas", // of hyaluronic -> hyaluronic

  // Biotin
  biotino: "biotinas", // of biotin -> biotin
  biotinui: "biotinas", // for biotin -> biotin

  // Caffeine
  kofeino: "kofeinas", // of caffeine -> caffeine
  kofeinui: "kofeinas", // for caffeine -> caffeine

  // Panthenol
  pantenolio: "pantenolis", // of panthenol -> panthenol

  // Silk
  šilko: "šilkas", // of silk -> silk
  šilku: "šilkas", // with silk -> silk

  // Honey
  medaus: "medus", // of honey -> honey
  medumi: "medus", // with honey -> honey

  // Avocado
  avokado: "avokadas", // of avocado -> avocado

  // Castor (oil)
  ricinų: "ricinas", // of castor -> castor
  ricinos: "ricinas", // of castor -> castor

  // Jojoba
  chochobos: "chochoba", // of jojoba -> jojoba
  jojobos: "jojoba", // of jojoba (alternative spelling) -> jojoba
};

// =============================================================================
// DESCRIPTORS AND QUALIFIERS
// =============================================================================

const DESCRIPTORS: Record<string, string> = {
  // Professional
  profesionaliam: "profesionalus", // for professional -> professional
  profesionalaus: "profesionalus", // of professional -> professional
  profesionali: "profesionalus", // professional (f) -> professional
  profesionalios: "profesionalus", // of professional (f) -> professional

  // Intensive
  intensyviam: "intensyvus", // for intensive -> intensive
  intensyvaus: "intensyvus", // of intensive -> intensive
  intensyvi: "intensyvus", // intensive (f) -> intensive

  // Deep
  giliam: "gilus", // for deep -> deep
  gilaus: "gilus", // of deep -> deep
  gili: "gilus", // deep (f) -> deep

  // Daily
  kasdieniam: "kasdienis", // for daily -> daily
  kasdienio: "kasdienis", // of daily -> daily
  kasdienė: "kasdienis", // daily (f) -> daily

  // Special
  specialiam: "specialus", // for special -> special
  specialaus: "specialus", // of special -> special
  speciali: "specialus", // special (f) -> special

  // Natural
  natūraliam: "natūralus", // for natural -> natural
  natūralaus: "natūralus", // of natural -> natural
  natūrali: "natūralus", // natural (f) -> natural

  // Organic
  ekologiškam: "ekologiškas", // for organic -> organic
  ekologiško: "ekologiškas", // of organic -> organic
  ekologiška: "ekologiškas", // organic (f) -> organic

  // Gentle
  švelniu: "švelnus", // with gentle -> gentle
  švelnaus: "švelnus", // of gentle -> gentle
  švelni: "švelnus", // gentle (f) -> gentle

  // Strong
  stipriam: "stiprus", // for strong -> strong
  stipraus: "stiprus", // of strong -> strong
  stipri: "stiprus", // strong (f) -> strong

  // Effective
  efektyviam: "efektyvus", // for effective -> effective
  efektyvaus: "efektyvus", // of effective -> effective
  efektyvi: "efektyvus", // effective (f) -> effective

  // Anti-dandruff
  priespleiskaninis: "priespleiskaninis", // anti-dandruff
  nuo: "nuo", // against (preposition, kept as-is)
  pleiskanų: "pleiskanos", // of dandruff -> dandruff
};

// =============================================================================
// BRAND-RELATED TERMS
// =============================================================================

const BRAND_TERMS: Record<string, string> = {
  // Series/line
  serijos: "serija", // of series -> series
  serijai: "serija", // for series -> series
  seriją: "serija", // series (acc) -> series

  // Collection
  kolekcijos: "kolekcija", // of collection -> collection
  kolekcijai: "kolekcija", // for collection -> collection
  kolekciją: "kolekcija", // collection (acc) -> collection

  // Limited
  ribotam: "ribotas", // for limited -> limited
  riboto: "ribotas", // of limited -> limited
  ribota: "ribotas", // limited (f) -> limited

  // New
  naujam: "naujas", // for new -> new
  naujo: "naujas", // of new -> new
  nauja: "naujas", // new (f) -> new
  naujų: "naujas", // of new (pl) -> new

  // Original
  originaliam: "originalus", // for original -> original
  originalaus: "originalus", // of original -> original
  originali: "originalus", // original (f) -> original
};

// =============================================================================
// COMBINED EXPORT
// =============================================================================

/**
 * Complete lemma map for Lithuanian hair care domain.
 * Maps inflected forms to nominative singular base forms.
 */
export const LEMMA_MAP: Record<string, string> = {
  ...HAIR_TYPES,
  ...PRODUCT_TYPES,
  ...ACTIONS,
  ...BODY_PARTS,
  ...INGREDIENTS,
  ...DESCRIPTORS,
  ...BRAND_TERMS,
};

/**
 * Diacritic character mapping for ASCII conversion.
 * Includes Lithuanian diacritics and common international characters
 * found in brand names (French, German, Spanish, etc.).
 *
 * Used for fuzzy matching and URL-safe slug generation.
 */
export const LITHUANIAN_DIACRITIC_MAP: Record<string, string> = {
  // Lithuanian diacritics
  ą: "a",
  č: "c",
  ę: "e",
  ė: "e",
  į: "i",
  š: "s",
  ų: "u",
  ū: "u",
  ž: "z",
  // Uppercase Lithuanian
  Ą: "A",
  Č: "C",
  Ę: "E",
  Ė: "E",
  Į: "I",
  Š: "S",
  Ų: "U",
  Ū: "U",
  Ž: "Z",
  // French diacritics (common in brand names like L'Oréal, Kérastase)
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  à: "a",
  â: "a",
  ô: "o",
  î: "i",
  ï: "i",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
  œ: "oe",
  æ: "ae",
  // Uppercase French
  É: "E",
  È: "E",
  Ê: "E",
  Ë: "E",
  À: "A",
  Â: "A",
  Ô: "O",
  Î: "I",
  Ï: "I",
  Ù: "U",
  Û: "U",
  Ü: "U",
  Ç: "C",
  Œ: "OE",
  Æ: "AE",
  // German diacritics
  ä: "a",
  ö: "o",
  ß: "ss",
  Ä: "A",
  Ö: "O",
  // Spanish/Portuguese diacritics
  ñ: "n",
  Ñ: "N",
  ã: "a",
  õ: "o",
  Ã: "A",
  Õ: "O",
  // Scandinavian diacritics
  å: "a",
  Å: "A",
  ø: "o",
  Ø: "O",
};

/**
 * Get the number of terms in the lemma map.
 * Useful for verification and documentation.
 */
export function getLemmaMapStats(): {
  total: number;
  byCategory: Record<string, number>;
} {
  return {
    total: Object.keys(LEMMA_MAP).length,
    byCategory: {
      hairTypes: Object.keys(HAIR_TYPES).length,
      productTypes: Object.keys(PRODUCT_TYPES).length,
      actions: Object.keys(ACTIONS).length,
      bodyParts: Object.keys(BODY_PARTS).length,
      ingredients: Object.keys(INGREDIENTS).length,
      descriptors: Object.keys(DESCRIPTORS).length,
      brandTerms: Object.keys(BRAND_TERMS).length,
    },
  };
}
