/**
 * English SEO Services Agreement Template
 * Phase 55-06: Legal Agreement Templates
 *
 * Pre-approved English legal template for SEO services.
 * Structure mirrors Lithuanian template for consistency.
 */
import type { AgreementTemplate } from "./seo-services-lt";

/**
 * English SEO Services Agreement Template
 *
 * Legal clauses structured identically to Lithuanian version.
 * Only scopeDescription (section 4) is marked as non-legal.
 */
export const SEO_SERVICES_TEMPLATE_EN: AgreementTemplate = {
  name: "SEO Services Agreement",
  description: "Standard SEO services agreement",
  language: "en",
  type: "seo-services",
  sections: [
    {
      id: "header",
      title: "SEO SERVICES AGREEMENT",
      content: `SEO SERVICES AGREEMENT No. {{contractNumber}}

{{city}}, {{contractDate}}`,
      isLegal: true,
      order: 1,
    },
    {
      id: "parties",
      title: "1. PARTIES",
      content: `1. PARTIES

1.1. Service Provider (hereinafter - Provider):
{{providerName}}, company code {{providerCode}}, registered address {{providerAddress}}, represented by {{providerRepresentative}}, acting on the basis of {{providerBasis}}.

1.2. Client (hereinafter - Client):
{{clientName}}, company code {{clientCode}}, registered address {{clientAddress}}, represented by {{clientRepresentative}}, acting on the basis of {{clientBasis}}.

The Provider and Client are hereinafter jointly referred to as the Parties, and individually as a Party.`,
      isLegal: true,
      order: 2,
    },
    {
      id: "subject",
      title: "2. SUBJECT OF AGREEMENT",
      content: `2. SUBJECT OF AGREEMENT

2.1. The Provider undertakes to provide the Client with SEO (Search Engine Optimization) services aimed at improving the visibility of the Client's website {{websiteUrl}} in search engine results.

2.2. Services are provided according to the terms set forth in this Agreement and its annexes.`,
      isLegal: true,
      order: 3,
    },
    {
      id: "scope",
      title: "3. SCOPE OF SERVICES",
      content: `3. SCOPE OF SERVICES

3.1. The Provider provides the following services:

{{scopeDescription}}

3.2. Detailed service specification is provided in Annex No. 1 to this Agreement.`,
      isLegal: false, // This section CAN be translated
      order: 4,
    },
    {
      id: "price",
      title: "4. PRICE AND PAYMENT TERMS",
      content: `4. PRICE AND PAYMENT TERMS

4.1. Setup fee: {{setupFee}} {{currency}}.

4.2. Monthly fee: {{monthlyFee}} {{currency}} per month.

4.3. The setup fee shall be paid within 7 (seven) business days from signing of the Agreement.

4.4. Monthly fee is payable in advance by the 5th day of each month.

4.5. Payments are made by bank transfer to the Provider's bank account.

4.6. Prices are stated {{vatStatus}}.`,
      isLegal: true,
      order: 5,
    },
    {
      id: "term",
      title: "5. TERM OF AGREEMENT",
      content: `5. TERM OF AGREEMENT

5.1. The Agreement enters into force on {{startDate}} and is valid for {{contractDuration}} months.

5.2. The Agreement shall be automatically renewed for an additional {{renewalPeriod}} month period unless either Party provides written notice of termination at least {{noticePeriod}} days before the end of the current period.`,
      isLegal: true,
      order: 6,
    },
    {
      id: "obligations",
      title: "6. RIGHTS AND OBLIGATIONS OF THE PARTIES",
      content: `6. RIGHTS AND OBLIGATIONS OF THE PARTIES

6.1. The Provider undertakes to:
6.1.1. Provide services professionally and on time;
6.1.2. Inform the Client about performed work and achieved results;
6.1.3. Provide monthly reports on SEO activity results;
6.1.4. Ensure confidentiality.

6.2. The Client undertakes to:
6.2.1. Pay for the provided services on time;
6.2.2. Provide the Provider with necessary access to the website and related tools;
6.2.3. Provide required information and materials on time;
6.2.4. Not make decisions that may negatively affect SEO results without the Provider's knowledge.`,
      isLegal: true,
      order: 7,
    },
    {
      id: "confidentiality",
      title: "7. CONFIDENTIALITY",
      content: `7. CONFIDENTIALITY

7.1. The Parties undertake to keep confidential all information received in the performance of this Agreement.

7.2. The confidentiality obligation applies during the term of the Agreement and for {{confidentialityYears}} years after its termination.

7.3. The confidentiality obligation does not apply to information that is publicly available or must be disclosed by law.`,
      isLegal: true,
      order: 8,
    },
    {
      id: "liability",
      title: "8. LIMITATION OF LIABILITY",
      content: `8. LIMITATION OF LIABILITY

8.1. The Provider does not guarantee specific positions in search results, as this depends on numerous external factors.

8.2. The Provider's maximum liability shall not exceed the amounts paid by the Client during the last {{liabilityMonths}} months.

8.3. The Provider is not liable for damages caused by the actions of the Client or third parties.`,
      isLegal: true,
      order: 9,
    },
    {
      id: "termination",
      title: "9. TERMINATION OF AGREEMENT",
      content: `9. TERMINATION OF AGREEMENT

9.1. Each Party has the right to terminate the Agreement by providing written notice to the other Party at least {{terminationNoticeDays}} calendar days in advance.

9.2. The Agreement may be terminated immediately if one of the Parties breaches essential terms of the Agreement and fails to remedy the breach within 14 days of receiving notice.

9.3. Upon termination of the Agreement, the Client must pay for all services provided up to the date of termination.`,
      isLegal: true,
      order: 10,
    },
    {
      id: "disputes",
      title: "10. DISPUTE RESOLUTION",
      content: `10. DISPUTE RESOLUTION

10.1. All disputes arising from or related to this Agreement shall be resolved through negotiations.

10.2. If the dispute cannot be resolved through negotiations within 30 days, it shall be resolved in the courts of the Republic of Lithuania according to the Provider's registered address.

10.3. This Agreement shall be governed by the laws of the Republic of Lithuania.`,
      isLegal: true,
      order: 11,
    },
    {
      id: "final",
      title: "11. FINAL PROVISIONS",
      content: `11. FINAL PROVISIONS

11.1. The Agreement is executed in two copies having equal legal force, one for each Party.

11.2. All amendments and additions to the Agreement shall be valid only if made in writing and signed by both Parties.

11.3. If any provision of the Agreement becomes invalid, the remaining provisions shall remain in effect.

11.4. Annexes to the Agreement form an integral part of the Agreement.`,
      isLegal: true,
      order: 12,
    },
    {
      id: "signatures",
      title: "12. PARTY DETAILS AND SIGNATURES",
      content: `12. PARTY DETAILS AND SIGNATURES

SERVICE PROVIDER:
{{providerName}}
Company code: {{providerCode}}
Address: {{providerAddress}}
Bank: {{providerBank}}
Account: {{providerAccount}}

_________________________
{{providerRepresentative}}
{{providerPosition}}

CLIENT:
{{clientName}}
Company code: {{clientCode}}
Address: {{clientAddress}}
Bank: {{clientBank}}
Account: {{clientAccount}}

_________________________
{{clientRepresentative}}
{{clientPosition}}`,
      isLegal: true,
      order: 13,
    },
  ],
  variables: [
    // Contract identification
    { key: "contractNumber", label: "Contract Number", type: "text", required: true, translateValue: false },
    { key: "city", label: "City", type: "text", required: true, translateValue: false },
    { key: "contractDate", label: "Contract Date", type: "date", required: true, translateValue: false },

    // Provider details
    { key: "providerName", label: "Provider Name", type: "text", required: true, translateValue: false },
    { key: "providerCode", label: "Provider Company Code", type: "text", required: true, translateValue: false },
    { key: "providerAddress", label: "Provider Address", type: "text", required: true, translateValue: false },
    { key: "providerRepresentative", label: "Provider Representative", type: "text", required: true, translateValue: false },
    { key: "providerBasis", label: "Representation Basis", type: "text", required: true, translateValue: false },
    { key: "providerBank", label: "Provider Bank", type: "text", required: true, translateValue: false },
    { key: "providerAccount", label: "Provider Account", type: "text", required: true, translateValue: false },
    { key: "providerPosition", label: "Provider Position", type: "text", required: true, translateValue: false },

    // Client details
    { key: "clientName", label: "Client Name", type: "text", required: true, translateValue: false },
    { key: "clientCode", label: "Client Company Code", type: "text", required: true, translateValue: false },
    { key: "clientAddress", label: "Client Address", type: "text", required: true, translateValue: false },
    { key: "clientRepresentative", label: "Client Representative", type: "text", required: true, translateValue: false },
    { key: "clientBasis", label: "Client Representation Basis", type: "text", required: true, translateValue: false },
    { key: "clientBank", label: "Client Bank", type: "text", required: false, translateValue: false },
    { key: "clientAccount", label: "Client Account", type: "text", required: false, translateValue: false },
    { key: "clientPosition", label: "Client Position", type: "text", required: true, translateValue: false },

    // Service details
    { key: "websiteUrl", label: "Website URL", type: "text", required: true, translateValue: false },
    { key: "scopeDescription", label: "Scope Description", type: "text", required: true, translateValue: true }, // CAN be translated

    // Financial
    { key: "setupFee", label: "Setup Fee", type: "currency", required: true, translateValue: false },
    { key: "monthlyFee", label: "Monthly Fee", type: "currency", required: true, translateValue: false },
    { key: "currency", label: "Currency", type: "text", required: true, translateValue: false },
    { key: "vatStatus", label: "VAT Status", type: "text", required: true, translateValue: false },

    // Term
    { key: "startDate", label: "Start Date", type: "date", required: true, translateValue: false },
    { key: "contractDuration", label: "Contract Duration (months)", type: "number", required: true, translateValue: false },
    { key: "renewalPeriod", label: "Renewal Period (months)", type: "number", required: true, translateValue: false },
    { key: "noticePeriod", label: "Notice Period (days)", type: "number", required: true, translateValue: false },

    // Legal terms
    { key: "confidentialityYears", label: "Confidentiality Years", type: "number", required: true, translateValue: false },
    { key: "liabilityMonths", label: "Liability Months", type: "number", required: true, translateValue: false },
    { key: "terminationNoticeDays", label: "Termination Notice Days", type: "number", required: true, translateValue: false },
  ],
};
