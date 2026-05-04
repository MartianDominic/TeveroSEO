/**
 * Lithuanian Cities Database
 *
 * Lithuanian city names with declension variants (locative, genitive forms).
 */

import type { LithuanianCity, CityExtraction } from './types';

export const LITHUANIAN_CITIES: LithuanianCity[] = [
  { name: 'Vilnius', variants: ['vilniuje', 'vilniaus', 'vilnių'] },
  { name: 'Kaunas', variants: ['kaune', 'kauno'] },
  { name: 'Klaipėda', variants: ['klaipėdoje', 'klaipėdos'] },
  { name: 'Šiauliai', variants: ['šiauliuose', 'šiaulių'] },
  { name: 'Panevėžys', variants: ['panevėžyje', 'panevėžio'] },
  { name: 'Alytus', variants: ['alytuje', 'alytaus'] },
  { name: 'Marijampolė', variants: ['marijampolėje', 'marijampolės'] },
  { name: 'Mažeikiai', variants: ['mažeikiuose', 'mažeikių'] },
  { name: 'Jonava', variants: ['jonavoje', 'jonavos'] },
  { name: 'Utena', variants: ['utenoje', 'utenos'] },
  { name: 'Kėdainiai', variants: ['kėdainiuose', 'kėdainių'] },
  { name: 'Telšiai', variants: ['telšiuose', 'telšių'] },
  { name: 'Tauragė', variants: ['tauragėje', 'tauragės'] },
  { name: 'Ukmergė', variants: ['ukmergėje', 'ukmergės'] },
  { name: 'Visaginas', variants: ['visagine', 'visagino'] },
  { name: 'Plungė', variants: ['plungėje', 'plungės'] },
  { name: 'Kretinga', variants: ['kretingoje', 'kretingos'] },
  { name: 'Palanga', variants: ['palangoje', 'palangos'] },
  { name: 'Šilutė', variants: ['šilutėje', 'šilutės'] },
  { name: 'Radviliškis', variants: ['radviliškyje', 'radvilškio'] },
  { name: 'Druskininkai', variants: ['druskininkuose', 'druskininkų'] },
  { name: 'Rokiškis', variants: ['rokiškyje', 'rokiškio'] },
  { name: 'Biržai', variants: ['biržuose', 'biržų'] },
  { name: 'Garliava', variants: ['gargždose', 'gargždų'] },
  { name: 'Kuršėnai', variants: ['kuršėnuose', 'kuršėnų'] },
  { name: 'Elektrėnai', variants: ['elektrėnuose', 'elektrėnų'] },
  { name: 'Jurbarkas', variants: ['jurbarke', 'jurbarko'] },
  { name: 'Vilkaviškis', variants: ['vilkaviškyje', 'vilkaviškio'] },
  { name: 'Raseiniai', variants: ['raseiniuose', 'raseinių'] },
  { name: 'Anykščiai', variants: ['anykščiuose', 'anykščių'] },
  { name: 'Lentvaris', variants: ['lentvaryje', 'lentvario'] },
  { name: 'Grigiškės', variants: ['grigiškėse', 'grigiškių'] },
  { name: 'Prienai', variants: ['prienuose', 'prienų'] },
  { name: 'Joniškis', variants: ['joniškio', 'joniškyje'] },
  { name: 'Kelmė', variants: ['kelmėje', 'kelmės'] },
  { name: 'Varėna', variants: ['varėnoje', 'varėnos'] },
  { name: 'Kaišiadorys', variants: ['kaišiadoryse', 'kaišiadorių'] },
  { name: 'Pasvalys', variants: ['pasvalyje', 'pasvalio'] },
  { name: 'Kupiškis', variants: ['kupiškyje', 'kupiškio'] },
  { name: 'Zarasai', variants: ['zarasuose', 'zarasų'] },
  { name: 'Skuodas', variants: ['skuode', 'skuodo'] },
  { name: 'Molėtai', variants: ['molėtuose', 'molėtų'] },
  { name: 'Šakiai', variants: ['šakiuose', 'šakių'] },
  { name: 'Šalčininkai', variants: ['šalčininkuose', 'šalčininkų'] },
  { name: 'Švenčionys', variants: ['švenčionyse', 'švenčionių'] },
  { name: 'Pakruojis', variants: ['pakruojyje', 'pakruojo'] },
  { name: 'Ignalina', variants: ['ignalinoje', 'ignalinos'] },
  { name: 'Lazdijai', variants: ['lazdijiuose', 'lazdijų'] },
  { name: 'Šilalė', variants: ['šilalėje', 'šilalės'] },
  { name: 'Trakai', variants: ['trakuose', 'trakų'] },
  { name: 'Širvintos', variants: ['širvintose', 'širvintų'] },
  { name: 'Naujoji Akmenė', variants: ['naujoje akmėnėje', 'naujos akmenės'] },
];

/**
 * Extract city from a keyword
 *
 * @param keyword - The keyword to search for cities
 * @returns CityExtraction if found, null otherwise
 */
export function extractCityFromKeyword(keyword: string): CityExtraction | null {
  const lowerKeyword = keyword.toLowerCase();

  for (const city of LITHUANIAN_CITIES) {
    for (const variant of city.variants) {
      if (lowerKeyword.includes(variant.toLowerCase())) {
        return {
          city: city.name.toLowerCase(),
          variant: variant,
        };
      }
    }
  }

  return null;
}

/**
 * Remove city variant from keyword
 *
 * @param keyword - The keyword containing a city
 * @param variant - The city variant to remove
 * @returns Keyword with city removed and trimmed
 */
export function removeCity(keyword: string, variant: string): string {
  return keyword.replace(new RegExp(variant, 'gi'), '').trim();
}
