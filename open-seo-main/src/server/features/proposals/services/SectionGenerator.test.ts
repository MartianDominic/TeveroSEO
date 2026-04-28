/**
 * Tests for SectionGenerator.
 * Phase 43-06: Proposal Generation
 *
 * Tests AI-powered section generation using XML prompts with
 * Halbert/Kennedy/Ogilvy copywriting frameworks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Create a shared mock for the create function
const mockCreate = vi.fn();

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Mock template for presale-hook.xml
const MOCK_PRESALE_HOOK_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<prompt name="presale-hook-generator" version="1.0">
  <input-schema>
    <company_name>{{COMPANY_NAME}}</company_name>
    <domain>{{DOMAIN}}</domain>
    <awareness_level>{{AWARENESS_LEVEL}}</awareness_level>
    <quick_wins>{{QUICK_WINS}}</quick_wins>
    <traffic_opportunity>{{TRAFFIC_OPPORTUNITY}}</traffic_opportunity>
    <revenue_opportunity>{{REVENUE_OPPORTUNITY}}</revenue_opportunity>
  </input-schema>
</prompt>`;

// Mock template for executive-summary.xml
const MOCK_EXECUTIVE_SUMMARY_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<prompt name="proposal-executive-summary" version="1.0">
  <input-schema>
    <company_name>{{COMPANY_NAME}}</company_name>
    <domain>{{DOMAIN}}</domain>
    <awareness_level>{{AWARENESS_LEVEL}}</awareness_level>
    <language>{{LANGUAGE}}</language>
  </input-schema>
</prompt>`;

// Mock template for investment-section.xml
const MOCK_INVESTMENT_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<prompt name="proposal-investment-section" version="1.0">
  <input-schema>
    <setup_fee>{{SETUP_FEE}}</setup_fee>
    <monthly_fee>{{MONTHLY_FEE}}</monthly_fee>
    <contract_months>{{CONTRACT_MONTHS}}</contract_months>
    <awareness_level>{{AWARENESS_LEVEL}}</awareness_level>
  </input-schema>
</prompt>`;

// Mock template for agreement-generator.xml
const MOCK_AGREEMENT_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<prompt name="agreement-generator" version="1.0">
  <input-schema>
    <company_name>{{COMPANY_NAME}}</company_name>
    <domain>{{DOMAIN}}</domain>
    <setup_fee>{{SETUP_FEE}}</setup_fee>
    <monthly_fee>{{MONTHLY_FEE}}</monthly_fee>
  </input-schema>
</prompt>`;

// Mock fs module to return different templates based on file path
vi.mock("node:fs", () => ({
  readFileSync: (path: string) => {
    if (path.includes("presale-hook")) {
      return MOCK_PRESALE_HOOK_TEMPLATE;
    }
    if (path.includes("executive-summary")) {
      return MOCK_EXECUTIVE_SUMMARY_TEMPLATE;
    }
    if (path.includes("investment-section")) {
      return MOCK_INVESTMENT_TEMPLATE;
    }
    if (path.includes("agreement-generator")) {
      return MOCK_AGREEMENT_TEMPLATE;
    }
    // Return executive summary as default for unknown paths
    return MOCK_EXECUTIVE_SUMMARY_TEMPLATE;
  },
}));

// Import AFTER mocks are set up
import {
  SectionGenerator,
  type SectionType,
  type SectionInput,
} from "./SectionGenerator";

describe("SectionGenerator", () => {
  let generator: SectionGenerator;

  beforeEach(() => {
    generator = new SectionGenerator();
    mockCreate.mockReset();
  });

  describe("generateSection", () => {
    it('should return Lithuanian text for "executive_summary" section', async () => {
      const lithuanianResponse = `
      Gerb. Partneriai,

      UAB "Plaukų Centras" turi galimybę pasiekti 5,000 organinių lankytojų per mėnesį.
      Ši ataskaita pristato mūsų SEO strategiją ir rekomendacijas.
      `;

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: lithuanianResponse,
          },
        ],
      });

      const input: SectionInput = {
        companyName: "Plaukų Centras",
        domain: "plaukucentras.lt",
        awarenessLevel: "solution-aware",
        language: "lt",
      };

      const result = await generator.generateSection("executive_summary", input);

      expect(result.type).toBe("executive_summary");
      expect(result.language).toBe("lt");
      expect(result.content).toContain("Plaukų Centras");
      expect(result.content).toContain("lankytojų");
      expect(result.generatedAt).toBeDefined();
    });

    it('should use Halbert fascinations for "presale_hook" section', async () => {
      // Response with Halbert fascination formulas
      const halbertResponse = `
      <output>
      {
        "headline": "Kodėl jūsų konkurentai gauna 3,000 lankytojų per mėnesį, o jūs - ne?",
        "fascinations": [
          {"text": "25 puslapiai, kurie šiandien yra 11-30 pozicijoje ir galėtų būti TOP 3 per 90 dienų...", "formula_used": "5"},
          {"text": "Vienas techninis pakeitimas, kuris galėtų atrakinti 2,000 lankytojų be naujo turinio...", "formula_used": "1"},
          {"text": "Kas jūsų konkurentai daro skirtingai, kad jie užima 73% jūsų tikslinių raktažodžių...", "formula_used": "4"}
        ],
        "stats": [
          {"number": "2,500", "label": "Mėnesiniai lankytojai, kuriuos galite pasiekti"},
          {"number": "€15,000", "label": "Metinė vertė"}
        ],
        "cta": {"main": "Susitikime 30 minučių", "scarcity": "Šią savaitę turime 3 laisvas konsultacijas."}
      }
      </output>
      `;

      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: halbertResponse }],
      });

      const input: SectionInput = {
        companyName: "Test Company",
        domain: "test.lt",
        awarenessLevel: "unaware",
        quickWins: 25,
        trafficOpportunity: 2500,
        revenueOpportunity: 15000,
      };

      const result = await generator.generateSection("presale_hook", input);

      expect(result.type).toBe("presale_hook");
      expect(result.content).toContain("fascinations");
      expect(result.content).toContain("formula_used");
      // Check for Halbert-style curiosity elements
      expect(result.content).toContain("Kodėl");
      expect(result.content).toContain("lankytojų");
    });

    it('should include pricing and CTA for "investment" section', async () => {
      const investmentResponse = `
      {
        "investment_section": {
          "value_stack": {
            "deliverables": [
              {"name": "Techninis SEO auditas", "value": 500, "description": "Pilnas svetainės techninis auditas"},
              {"name": "Turinio optimizacija", "value": 800, "description": "10 prioritetinių puslapių"}
            ],
            "total_value": 1300
          },
          "price_justification": {
            "inhouse_comparison": "SEO specialisto samdymas kainuotų €2500/mėn + mokesčiai.",
            "inaction_cost": "Kiekvienas mėnuo be veiksmų = €1,200 prarastų pajamų.",
            "ppc_comparison": "Google Ads šiems raktažodžiams kainuotų €3,000/mėn."
          },
          "payment_options": [
            {"name": "Mėnesinis mokėjimas", "structure": "€500 pradinis + €800/mėn", "total": 5300, "recommended": true}
          ],
          "cta": {
            "primary_action": "Pasirašyti sutartį ir pradėti",
            "primary_button": "Pradėti projektą"
          }
        }
      }
      `;

      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: investmentResponse }],
      });

      const input: SectionInput = {
        companyName: "Test Company",
        domain: "test.lt",
        awarenessLevel: "most-aware",
        setupFee: 500,
        monthlyFee: 800,
        contractMonths: 6,
      };

      const result = await generator.generateSection("investment", input);

      expect(result.type).toBe("investment");
      expect(result.content).toContain("investment_section");
      expect(result.content).toContain("500");
      expect(result.content).toContain("800");
      expect(result.content).toContain("Pradėti projektą");
      expect(result.content).toContain("cta");
    });

    it('should produce valid contract structure for "agreement" section', async () => {
      const agreementResponse = `
      {
        "agreement": {
          "document_type": "sutartis",
          "version": "1.0",
          "generated_date": "2026-04-27",
          "sections": [
            {"number": "1", "title": "SUTARTIES DALYKAS", "content": "Pagal šią Sutartį Vykdytojas įsipareigoja teikti..."},
            {"number": "2", "title": "KAINA IR ATSISKAITYMO TVARKA", "content": "Pradinis mokestis: €500..."},
            {"number": "3", "title": "ŠALIŲ TEISĖS IR PAREIGOS", "content": "Vykdytojas įsipareigoja..."},
            {"number": "4", "title": "INTELEKTINĖ NUOSAVYBĖ", "content": "Sukurtas turinys tampa..."},
            {"number": "5", "title": "KONFIDENCIALUMAS", "content": "Šalys įsipareigoja..."},
            {"number": "6", "title": "SUTARTIES NUTRAUKIMAS", "content": "Sutartis gali būti nutraukta..."},
            {"number": "7", "title": "ATSAKOMYBĖ", "content": "Vykdytojo atsakomybė ribojama..."},
            {"number": "8", "title": "BAIGIAMOSIOS NUOSTATOS", "content": "Sutarčiai taikoma..."}
          ],
          "appendices": [
            {"number": "1", "title": "PASLAUGŲ APRAŠYMAS", "content": "..."},
            {"number": "2", "title": "DUOMENŲ TVARKYMO SUTARTIS (DPA)", "content": "..."}
          ],
          "signatures": {
            "provider": {"company": "Tevero", "representative": "Vardas Pavardė", "title": "Direktorius"},
            "client": {"company": "Test Company", "representative": "", "title": ""}
          }
        }
      }
      `;

      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: agreementResponse }],
      });

      const input: SectionInput = {
        companyName: "Test Company",
        domain: "test.lt",
        awarenessLevel: "most-aware",
        setupFee: 500,
        monthlyFee: 800,
        contractMonths: 6,
        agencyName: "Tevero",
      };

      const result = await generator.generateSection("agreement", input);

      expect(result.type).toBe("agreement");
      // Verify legal structure sections
      expect(result.content).toContain("SUTARTIES DALYKAS");
      expect(result.content).toContain("KAINA IR ATSISKAITYMO TVARKA");
      expect(result.content).toContain("ŠALIŲ TEISĖS IR PAREIGOS");
      expect(result.content).toContain("INTELEKTINĖ NUOSAVYBĖ");
      expect(result.content).toContain("KONFIDENCIALUMAS");
      expect(result.content).toContain("SUTARTIES NUTRAUKIMAS");
      expect(result.content).toContain("ATSAKOMYBĖ");
      expect(result.content).toContain("BAIGIAMOSIOS NUOSTATOS");
      // Verify appendices
      expect(result.content).toContain("PASLAUGŲ APRAŠYMAS");
      expect(result.content).toContain("DUOMENŲ TVARKYMO SUTARTIS");
    });

    it("should adjust tone and approach based on awareness level", async () => {
      // Test with "unaware" - should use problem agitation
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: `
            <output>
            Jūsų konkurentai gauna 3x daugiau lankytojų. Štai kodėl...
            Ar žinote, kiek potencialių klientų prarandate kiekvieną dieną?
            </output>
            `,
          },
        ],
      });

      const unawareInput: SectionInput = {
        companyName: "Cold Lead Company",
        domain: "coldlead.lt",
        awarenessLevel: "unaware",
      };

      const unawareResult = await generator.generateSection(
        "executive_summary",
        unawareInput
      );
      expect(unawareResult.content).toContain("konkurentai");

      // Test with "most-aware" - should be direct CTA focused
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: `
            <output>
            Štai jūsų pasiūlymas. Pasirašykite sutartį ir pradėsime šią savaitę.
            Visa informacija, kurią mums suteikėte, patvirtina - esate pasiruošę augti.
            </output>
            `,
          },
        ],
      });

      const awareInput: SectionInput = {
        companyName: "Ready Company",
        domain: "ready.lt",
        awarenessLevel: "most-aware",
      };

      const awareResult = await generator.generateSection(
        "executive_summary",
        awareInput
      );
      expect(awareResult.content).toContain("pasiūlymas");
      expect(awareResult.content).toContain("Pasirašykite");
    });
  });

  describe("generateSections (parallel)", () => {
    it("should generate multiple sections in parallel", async () => {
      // Mock responses for multiple sections
      mockCreate
        .mockResolvedValueOnce({
          content: [
            { type: "text", text: "Executive summary content in Lithuanian" },
          ],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: '{"investment_section": {"cta": {"primary_button": "Pradėti"}}}',
            },
          ],
        });

      const input: SectionInput = {
        companyName: "Test Company",
        domain: "test.lt",
        awarenessLevel: "solution-aware",
        setupFee: 500,
        monthlyFee: 800,
      };

      const sections: SectionType[] = ["executive_summary", "investment"];
      const results = await generator.generateSections(sections, input);

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe("executive_summary");
      expect(results[1].type).toBe("investment");
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe("template filling", () => {
    it("should escape user input to prevent prompt injection", async () => {
      // Test that malicious input is escaped
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "Safe response" }],
      });

      const maliciousInput: SectionInput = {
        companyName: "Test {{IGNORE_INSTRUCTIONS}}",
        domain: "test.lt",
        awarenessLevel: "solution-aware",
      };

      await generator.generateSection("executive_summary", maliciousInput);

      // Verify the mock was called with escaped content
      const callArgs = mockCreate.mock.calls[0][0];
      const userContent = callArgs.messages[0].content;

      // Should have escaped the braces
      expect(userContent).not.toContain("{{IGNORE_INSTRUCTIONS}}");
      expect(userContent).toContain("{ {IGNORE_INSTRUCTIONS} }");
    });
  });

  describe("error handling", () => {
    it("should throw error for non-text response", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "test",
            name: "test",
            input: {},
          },
        ],
      });

      const input: SectionInput = {
        companyName: "Test",
        domain: "test.lt",
        awarenessLevel: "solution-aware",
      };

      await expect(
        generator.generateSection("executive_summary", input)
      ).rejects.toThrow("Unexpected response type");
    });
  });
});
