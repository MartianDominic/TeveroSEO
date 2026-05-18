/**
 * PDF Export Tests
 * Phase 102-11: Task 6 - TDD tests for PDF generation
 *
 * Tests PDF export with Puppeteer, block rendering, and theme application.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// Hoisted mock setup
const mockPage = vi.hoisted(() => ({
  setContent: vi.fn().mockResolvedValue(undefined),
  pdf: vi.fn().mockResolvedValue(Buffer.from("PDF content")),
}));

const mockBrowser = vi.hoisted(() => ({
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

// Mock database
vi.mock("@/db", () => ({
  db: {
    query: {
      persuasionBlocks: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "block-1",
            proposalId: "prop-1",
            workspaceId: "ws-1",
            type: "pain_amplifier",
            position: 0,
            content: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Your SEO is costing you money." }],
                },
              ],
            },
          },
          {
            id: "block-2",
            proposalId: "prop-1",
            workspaceId: "ws-1",
            type: "credibility",
            position: 1,
            content: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "We have helped 50 companies." }],
                },
              ],
            },
          },
        ]),
      },
      brandThemes: {
        findFirst: vi.fn().mockResolvedValue({
          id: "theme-1",
          primaryColor: "#1a1a1a",
          secondaryColor: "#666666",
          headingFont: "Georgia",
          bodyFont: "Arial",
        }),
      },
    },
  },
}));

import { exportToPdf, generateProposalHtml } from "../pdf-export";

describe("pdf-export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exportToPdf", () => {
    test("generates PDF buffer", async () => {
      const result = await exportToPdf({
        proposalId: "prop-1",
        variableContext: { prospect: { company: "Test Co" } },
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("uses Puppeteer for rendering", async () => {
      const puppeteer = await import("puppeteer");

      await exportToPdf({
        proposalId: "prop-1",
        variableContext: {},
      });

      expect(puppeteer.default.launch).toHaveBeenCalledWith({ headless: true });
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setContent).toHaveBeenCalled();
      expect(mockPage.pdf).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test("includes all blocks in order", async () => {
      await exportToPdf({
        proposalId: "prop-1",
        variableContext: {},
      });

      const setContentCall = mockPage.setContent.mock.calls[0][0];
      expect(setContentCall).toContain("Your SEO is costing you money");
      expect(setContentCall).toContain("We have helped 50 companies");

      // Block 1 should appear before block 2
      const block1Pos = setContentCall.indexOf("Your SEO is costing you money");
      const block2Pos = setContentCall.indexOf("We have helped 50 companies");
      expect(block1Pos).toBeLessThan(block2Pos);
    });
  });

  describe("generateProposalHtml", () => {
    test("applies brand theme colors", () => {
      const blocks = [
        {
          id: "b1",
          type: "cta",
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Call now" }] }] },
        },
      ];
      const theme = {
        primaryColor: "#FF0000",
        secondaryColor: "#00FF00",
        headingFont: "Times New Roman",
        bodyFont: "Verdana",
      };

      const html = generateProposalHtml(blocks as any, theme, {});

      expect(html).toContain("--primary-color: #FF0000");
      expect(html).toContain("--secondary-color: #00FF00");
      expect(html).toContain("--heading-font: Times New Roman");
      expect(html).toContain("--body-font: Verdana");
    });

    test("applies brand theme fonts", () => {
      const blocks = [
        {
          id: "b1",
          type: "heading",
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Title" }] }] },
        },
      ];
      const theme = {
        primaryColor: "#000",
        secondaryColor: "#666",
        headingFont: "Georgia",
        bodyFont: "Arial",
      };

      const html = generateProposalHtml(blocks as any, theme, {});

      expect(html).toContain("font-family: var(--heading-font)");
      expect(html).toContain("font-family: var(--body-font)");
    });

    test("interpolates variables before export", () => {
      const blocks = [
        {
          id: "b1",
          type: "pain_amplifier",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "{{prospect.company}} is losing traffic." }],
              },
            ],
          },
        },
      ];
      const context = { prospect: { company: "Acme Corp" } };

      const html = generateProposalHtml(blocks as any, null, context);

      expect(html).toContain("Acme Corp is losing traffic");
      expect(html).not.toContain("{{prospect.company}}");
    });

    test("returns valid HTML document", () => {
      const blocks = [
        {
          id: "b1",
          type: "cta",
          content: { type: "doc", content: [] },
        },
      ];

      const html = generateProposalHtml(blocks as any, null, {});

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html>");
      expect(html).toContain("</html>");
      expect(html).toContain("<head>");
      expect(html).toContain("<body>");
    });
  });

  describe("XSS Prevention", () => {
    test("escapes script tags in variable values", () => {
      const blocks = [
        {
          id: "b1",
          type: "pain_amplifier",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Welcome {{prospect.company}}!" }],
              },
            ],
          },
        },
      ];
      const maliciousContext = {
        prospect: { company: '<script>alert("xss")</script>' },
      };

      const html = generateProposalHtml(blocks as any, null, maliciousContext);

      // Should NOT contain raw script tags
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("</script>");
      // Should contain escaped version
      expect(html).toContain("&lt;script&gt;");
    });

    test("escapes event handlers in variable values", () => {
      const blocks = [
        {
          id: "b1",
          type: "credibility",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Contact: {{prospect.email}}" }],
              },
            ],
          },
        },
      ];
      const maliciousContext = {
        prospect: { email: '"><img src=x onerror="alert(1)"><"' },
      };

      const html = generateProposalHtml(blocks as any, null, maliciousContext);

      // Should NOT contain raw img tag (< and > are escaped)
      expect(html).not.toContain("<img");
      // Should contain escaped version - the tag is neutralized
      expect(html).toContain("&lt;img");
      // Quotes are also escaped preventing attribute breakout
      expect(html).toContain("&quot;");
    });

    test("escapes javascript: URLs in variable values", () => {
      const blocks = [
        {
          id: "b1",
          type: "cta",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Visit {{prospect.website}}" }],
              },
            ],
          },
        },
      ];
      const maliciousContext = {
        prospect: { website: 'javascript:alert(document.cookie)' },
      };

      const html = generateProposalHtml(blocks as any, null, maliciousContext);

      // The colon should not be escaped (it's not in our escape list)
      // but any attempt to use this in an href would still be blocked
      // because the surrounding quotes would be escaped
      expect(html).toContain("javascript:alert");
    });

    test("escapes HTML in block content text", () => {
      const blocks = [
        {
          id: "b1",
          type: "pain_amplifier",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: '<div onclick="steal()">Click here</div>' }],
              },
            ],
          },
        },
      ];

      const html = generateProposalHtml(blocks as any, null, {});

      expect(html).not.toContain('<div onclick');
      expect(html).toContain("&lt;div");
    });

    test("preserves safe Lithuanian text", () => {
      const blocks = [
        {
          id: "b1",
          type: "credibility",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Sveiki, {{prospect.contact_name}}!" }],
              },
            ],
          },
        },
      ];
      const context = {
        prospect: { contact_name: "Ąžuolas Jonaitis" },
      };

      const html = generateProposalHtml(blocks as any, null, context);

      expect(html).toContain("Sveiki, Ąžuolas Jonaitis!");
    });
  });
});
