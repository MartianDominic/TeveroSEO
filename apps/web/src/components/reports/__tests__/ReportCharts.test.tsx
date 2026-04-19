import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ReportGSCChart } from "../ReportGSCChart";
import { ReportGA4Chart } from "../ReportGA4Chart";
import type { GSCDataPoint, GA4DataPoint } from "@/lib/analytics/types";

const mockGSCData: GSCDataPoint[] = [
  { date: "2026-04-01", clicks: 100, impressions: 1000, ctr: 0.1, position: 5.2 },
  { date: "2026-04-02", clicks: 120, impressions: 1100, ctr: 0.109, position: 4.8 },
  { date: "2026-04-03", clicks: 95, impressions: 950, ctr: 0.1, position: 5.5 },
];

const mockGA4Data: GA4DataPoint[] = [
  { date: "2026-04-01", sessions: 500, users: 400, bounce_rate: 0.45 },
  { date: "2026-04-02", sessions: 550, users: 420, bounce_rate: 0.42 },
  { date: "2026-04-03", sessions: 480, users: 380, bounce_rate: 0.48 },
];

describe("ReportGSCChart", () => {
  it("renders with data array", () => {
    const { container } = render(
      <ReportGSCChart data={mockGSCData} locale="en-US" />
    );

    // Should render an SVG element (Recharts renders SVG)
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("uses RGB colors instead of hex or hsl", () => {
    const { container } = render(
      <ReportGSCChart data={mockGSCData} locale="en-US" />
    );

    // Get all elements with stroke attribute
    const elementsWithStroke = container.querySelectorAll("[stroke]");

    // Filter to Line elements (paths with stroke that aren't grid lines)
    const lineStrokes: string[] = [];
    elementsWithStroke.forEach((el) => {
      const stroke = el.getAttribute("stroke");
      if (stroke && stroke !== "none" && !stroke.includes("#") && !stroke.includes("hsl")) {
        // Should be rgb() format
        if (stroke.startsWith("rgb(")) {
          lineStrokes.push(stroke);
        }
      }
    });

    // At least one line should use rgb() colors
    expect(lineStrokes.length).toBeGreaterThan(0);

    // No hex colors should be present in strokes
    elementsWithStroke.forEach((el) => {
      const stroke = el.getAttribute("stroke");
      if (stroke && stroke !== "none") {
        expect(stroke).not.toMatch(/^#[0-9A-Fa-f]{3,6}$/);
        expect(stroke).not.toContain("hsl(var(");
      }
    });
  });

  it("has explicit width for PDF stability", () => {
    const { container } = render(
      <ReportGSCChart data={mockGSCData} locale="en-US" />
    );

    // The container should have explicit dimensions (not just 100%)
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // SVG should have explicit width/height attributes
    const width = svg?.getAttribute("width");
    const height = svg?.getAttribute("height");

    // Width should be a number (explicit), not "100%"
    expect(width).toBeDefined();
    expect(Number(width)).toBeGreaterThan(0);
    expect(height).toBeDefined();
    expect(Number(height)).toBeGreaterThan(0);
  });
});

describe("ReportGA4Chart", () => {
  it("renders sessions/users lines", () => {
    const { container } = render(
      <ReportGA4Chart data={mockGA4Data} locale="en-US" />
    );

    // Should render an SVG element
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("uses RGB colors for PDF compatibility", () => {
    const { container } = render(
      <ReportGA4Chart data={mockGA4Data} locale="en-US" />
    );

    // Get all elements with stroke attribute
    const elementsWithStroke = container.querySelectorAll("[stroke]");

    // No CSS variables or hex colors in strokes
    elementsWithStroke.forEach((el) => {
      const stroke = el.getAttribute("stroke");
      if (stroke && stroke !== "none") {
        expect(stroke).not.toMatch(/^#[0-9A-Fa-f]{3,6}$/);
        expect(stroke).not.toContain("hsl(var(");
      }
    });
  });
});
