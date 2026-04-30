/**
 * Lithuanian SEO Services Agreement Template
 * Phase 55-06: Legal Agreement Templates
 *
 * Pre-approved Lithuanian legal template for SEO services.
 * All sections with isLegal: true are NEVER AI-translated.
 */
import type {
  AgreementSection,
  TemplateVariable,
  AgreementTemplateType,
  AgreementLanguage,
} from "@/db/agreement-template-schema";

export interface AgreementTemplate {
  name: string;
  description: string;
  language: AgreementLanguage;
  type: AgreementTemplateType;
  sections: AgreementSection[];
  variables: TemplateVariable[];
}

/**
 * Lithuanian SEO Services Agreement Template
 *
 * Legal clauses reviewed and approved for Lithuanian jurisdiction.
 * Only scopeDescription (section 4) is marked as non-legal for translation.
 */
export const SEO_SERVICES_TEMPLATE_LT: AgreementTemplate = {
  name: "SEO paslaugu sutartis",
  description: "Standartine SEO paslaugu teikimo sutartis",
  language: "lt",
  type: "seo-services",
  sections: [
    {
      id: "header",
      title: "SEO PASLAUGU TEIKIMO SUTARTIS",
      content: `SEO PASLAUGU TEIKIMO SUTARTIS Nr. {{contractNumber}}

{{city}}, {{contractDate}}`,
      isLegal: true,
      order: 1,
    },
    {
      id: "parties",
      title: "1. SALYS",
      content: `1. SALYS

1.1. Paslaugu teikėjas (toliau - Teikėjas):
{{providerName}}, imones kodas {{providerCode}}, buveinės adresas {{providerAddress}}, atstovaujama {{providerRepresentative}}, veikiancio pagal {{providerBasis}}.

1.2. Klientas (toliau - Klientas):
{{clientName}}, imones kodas {{clientCode}}, buveinės adresas {{clientAddress}}, atstovaujamas {{clientRepresentative}}, veikiancio pagal {{clientBasis}}.

Teikėjas ir Klientas toliau kartu vadinami Salimis, o kiekvienas atskirai - Salimi.`,
      isLegal: true,
      order: 2,
    },
    {
      id: "subject",
      title: "2. SUTARTIES OBJEKTAS",
      content: `2. SUTARTIES OBJEKTAS

2.1. Teikėjas isipareigoja teikti Klientui SEO (paieškos sistemu optimizavimo) paslaugas, skirtas pagerinti Kliento svetainės {{websiteUrl}} matomuma paieškos sistemu rezultatuose.

2.2. Paslaugos teikiamos pagal šioje Sutartyje ir jos prieduose nustatytas salygas.`,
      isLegal: true,
      order: 3,
    },
    {
      id: "scope",
      title: "3. PASLAUGU APIMTIS",
      content: `3. PASLAUGU APIMTIS

3.1. Teikėjas teikia šias paslaugas:

{{scopeDescription}}

3.2. Detali paslaugu specifikacija pateikiama Sutarties Priede Nr. 1.`,
      isLegal: false, // This section CAN be translated
      order: 4,
    },
    {
      id: "price",
      title: "4. KAINA IR MOKEJIMO SALYGOS",
      content: `4. KAINA IR MOKEJIMO SALYGOS

4.1. Pradinis imokėjimas (setup fee): {{setupFee}} {{currency}}.

4.2. Menesinis mokestis: {{monthlyFee}} {{currency}} per menesi.

4.3. Pradinis mokėjimas turi buti sumokėtas per 7 (septynias) darbo dienas nuo Sutarties pasirašymo.

4.4. Menesinis mokestis mokamas avansu iki kiekvieno menesio 5 (penktos) dienos.

4.5. Mokėjimai atliekami bankiniu pavedimu i Teikėjo banko saskaita.

4.6. Kainos nurodytos {{vatStatus}}.`,
      isLegal: true,
      order: 5,
    },
    {
      id: "term",
      title: "5. SUTARTIES GALIOJIMAS",
      content: `5. SUTARTIES GALIOJIMAS

5.1. Sutartis isigalioja nuo {{startDate}} ir galioja {{contractDuration}} menesiu.

5.2. Sutartis automatiškai pratesiama {{renewalPeriod}} menesiu laikotarpiui, jei nė viena Salis nepareikš raštu apie Sutarties nutraukima likus ne maziau kaip {{noticePeriod}} dienoms iki einamojo laikotarpio pabaigos.`,
      isLegal: true,
      order: 6,
    },
    {
      id: "obligations",
      title: "6. SALIU TEISES IR PAREIGOS",
      content: `6. SALIU TEISES IR PAREIGOS

6.1. Teikėjas isipareigoja:
6.1.1. Teikti paslaugas profesionaliai ir laiku;
6.1.2. Informuoti Klienta apie atliktus darbus ir pasiektu rezultatus;
6.1.3. Teikti menesines ataskaitas apie SEO veiklos rezultatus;
6.1.4. Užtikrinti konfidencialuma.

6.2. Klientas isipareigoja:
6.2.1. Laiku mokėti už suteiktas paslaugas;
6.2.2. Suteikti Teikėjui butina prieiga prie svetainės ir susijusiu istaigiu;
6.2.3. Laiku pateikti reikiama informacija ir medziaga;
6.2.4. Nepriiminėti sprendimu, galinciu neigiamai paveikti SEO rezultatus, be Teikėjo žinios.`,
      isLegal: true,
      order: 7,
    },
    {
      id: "confidentiality",
      title: "7. KONFIDENCIALUMAS",
      content: `7. KONFIDENCIALUMAS

7.1. Salys isipareigoja laikyti konfidencialia visa informacija, gauta vykdant ši Sutarti.

7.2. Konfidencialumo isipareigojimas galioja Sutarties galiojimo metu ir {{confidentialityYears}} metus po jos pasibaigimo.

7.3. Konfidencialumo isipareigojimas netaikomas informacijai, kuri yra viešai prieinama arba turi buti atskleista pagal istatymus.`,
      isLegal: true,
      order: 8,
    },
    {
      id: "liability",
      title: "8. ATSAKOMYBES RIBOJIMAS",
      content: `8. ATSAKOMYBES RIBOJIMAS

8.1. Teikėjas negarantuoja konkreciu poziciju paieškos rezultatuose, nes tai priklauso nuo daugybės išoriniu veiksniu.

8.2. Teikėjo maksimali atsakomybė negali viršyti sumu, sumokėtu Klienta per paskutinius {{liabilityMonths}} menesiu.

8.3. Teikėjas neatsako už nuostolius, atsiradusius dėl Kliento ar treciu asmenu veiksmu.`,
      isLegal: true,
      order: 9,
    },
    {
      id: "termination",
      title: "9. SUTARTIES NUTRAUKIMAS",
      content: `9. SUTARTIES NUTRAUKIMAS

9.1. Kiekviena Salis turi teise nutraukti Sutarti, ispėjusi kita Sali raštu ne vėliau kaip prieš {{terminationNoticeDays}} kalendoriniu dienu.

9.2. Sutartis gali buti nutraukta nedelsiant, jei viena iš Saliu pažeidžia esmines Sutarties salygas ir per 14 dienu nuo ispėjimo gavimo nepašalina pažeidimo.

9.3. Nutraukus Sutarti, Klientas privalo sumokėti už visas suteiktas paslaugas iki nutraukimo dienos.`,
      isLegal: true,
      order: 10,
    },
    {
      id: "disputes",
      title: "10. GINCU SPRENDIMAS",
      content: `10. GINCU SPRENDIMAS

10.1. Visi gincai, kylantys iš šios Sutarties ar su ja susije, sprendziami derybomis.

10.2. Nepavykus išspresti ginco derybomis per 30 dienu, gincas sprendziamas Lietuvos Respublikos teismuose pagal Teikėjo buveinės vieta.

10.3. Šiai Sutarciai taikoma Lietuvos Respublikos teisė.`,
      isLegal: true,
      order: 11,
    },
    {
      id: "final",
      title: "11. BAIGIAMOSIOS NUOSTATOS",
      content: `11. BAIGIAMOSIOS NUOSTATOS

11.1. Sutartis sudaryta dviem egzemplioriais, turinčiais vienoda juridine galia, po viena kiekvienai Saliai.

11.2. Visi Sutarties pakeitimai ir papildymai galioja tik sudaromi raštu ir pasirašyti abieju Saliu.

11.3. Jei kuri nors Sutarties nuostata tampa negaliojancia, likusios nuostatos lieka galioti.

11.4. Sutarties priedai yra neatskiriama Sutarties dalis.`,
      isLegal: true,
      order: 12,
    },
    {
      id: "signatures",
      title: "12. SALIU REKVIZITAI IR PARASAI",
      content: `12. SALIU REKVIZITAI IR PARASAI

PASLAUGU TEIKĖJAS:
{{providerName}}
Imones kodas: {{providerCode}}
Adresas: {{providerAddress}}
Bankas: {{providerBank}}
Saskaita: {{providerAccount}}

_________________________
{{providerRepresentative}}
{{providerPosition}}

KLIENTAS:
{{clientName}}
Imones kodas: {{clientCode}}
Adresas: {{clientAddress}}
Bankas: {{clientBank}}
Saskaita: {{clientAccount}}

_________________________
{{clientRepresentative}}
{{clientPosition}}`,
      isLegal: true,
      order: 13,
    },
  ],
  variables: [
    // Contract identification
    { key: "contractNumber", label: "Sutarties numeris", type: "text", required: true, translateValue: false },
    { key: "city", label: "Miestas", type: "text", required: true, translateValue: false },
    { key: "contractDate", label: "Sutarties data", type: "date", required: true, translateValue: false },

    // Provider details
    { key: "providerName", label: "Teikėjo pavadinimas", type: "text", required: true, translateValue: false },
    { key: "providerCode", label: "Teikėjo imones kodas", type: "text", required: true, translateValue: false },
    { key: "providerAddress", label: "Teikėjo adresas", type: "text", required: true, translateValue: false },
    { key: "providerRepresentative", label: "Teikėjo atstovas", type: "text", required: true, translateValue: false },
    { key: "providerBasis", label: "Atstovavimo pagrindas", type: "text", required: true, translateValue: false },
    { key: "providerBank", label: "Teikėjo bankas", type: "text", required: true, translateValue: false },
    { key: "providerAccount", label: "Teikėjo saskaita", type: "text", required: true, translateValue: false },
    { key: "providerPosition", label: "Teikėjo pareigos", type: "text", required: true, translateValue: false },

    // Client details
    { key: "clientName", label: "Kliento pavadinimas", type: "text", required: true, translateValue: false },
    { key: "clientCode", label: "Kliento imones kodas", type: "text", required: true, translateValue: false },
    { key: "clientAddress", label: "Kliento adresas", type: "text", required: true, translateValue: false },
    { key: "clientRepresentative", label: "Kliento atstovas", type: "text", required: true, translateValue: false },
    { key: "clientBasis", label: "Kliento atstovavimo pagrindas", type: "text", required: true, translateValue: false },
    { key: "clientBank", label: "Kliento bankas", type: "text", required: false, translateValue: false },
    { key: "clientAccount", label: "Kliento saskaita", type: "text", required: false, translateValue: false },
    { key: "clientPosition", label: "Kliento pareigos", type: "text", required: true, translateValue: false },

    // Service details
    { key: "websiteUrl", label: "Svetainės URL", type: "text", required: true, translateValue: false },
    { key: "scopeDescription", label: "Paslaugu aprašymas", type: "text", required: true, translateValue: true }, // CAN be translated

    // Financial
    { key: "setupFee", label: "Pradinis mokestis", type: "currency", required: true, translateValue: false },
    { key: "monthlyFee", label: "Menesinis mokestis", type: "currency", required: true, translateValue: false },
    { key: "currency", label: "Valiuta", type: "text", required: true, translateValue: false },
    { key: "vatStatus", label: "PVM statusas", type: "text", required: true, translateValue: false },

    // Term
    { key: "startDate", label: "Pradžios data", type: "date", required: true, translateValue: false },
    { key: "contractDuration", label: "Sutarties trukme (men.)", type: "number", required: true, translateValue: false },
    { key: "renewalPeriod", label: "Pratęsimo laikotarpis (men.)", type: "number", required: true, translateValue: false },
    { key: "noticePeriod", label: "Ispėjimo terminas (d.)", type: "number", required: true, translateValue: false },

    // Legal terms
    { key: "confidentialityYears", label: "Konfidencialumo metai", type: "number", required: true, translateValue: false },
    { key: "liabilityMonths", label: "Atsakomybės menesiai", type: "number", required: true, translateValue: false },
    { key: "terminationNoticeDays", label: "Nutraukimo ispėjimas (d.)", type: "number", required: true, translateValue: false },
  ],
};
