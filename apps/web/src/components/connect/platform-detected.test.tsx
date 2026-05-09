/**
 * Platform Detected Component Tests
 * Phase 66-04: Connection Wizard UI
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PlatformDetected } from "./platform-detected";

describe("PlatformDetected", () => {
  describe("loading state", () => {
    it("shows loading message when isLoading is true", () => {
      render(<PlatformDetected isLoading />);

      expect(screen.getByText(/checking your website/i)).toBeInTheDocument();
    });

    it("shows progress bar when loading", () => {
      render(<PlatformDetected isLoading />);

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
  });

  describe("detected state", () => {
    const mockDetection = {
      platform: "shopify",
      confidence: 100,
      features: ["ecommerce"],
      paidPlanRequired: false,
      estimatedTime: "2 min",
    };

    it("shows platform name when detected", () => {
      render(<PlatformDetected detection={mockDetection} platformName="Shopify" />);

      expect(screen.getByText(/found:/i)).toBeInTheDocument();
      expect(screen.getByText("Shopify")).toBeInTheDocument();
    });

    it("shows feature badges when platform has features", () => {
      render(<PlatformDetected detection={mockDetection} platformName="Shopify" />);

      expect(screen.getByText(/e-commerce platform detected/i)).toBeInTheDocument();
    });

    it("shows checkmark icon for detected platform", () => {
      render(<PlatformDetected detection={mockDetection} platformName="Shopify" />);

      // Look for the checkmark (success indicator)
      const successIcon = screen.getByTestId("platform-detected-icon");
      expect(successIcon).toBeInTheDocument();
    });

    it("shows paid plan warning when required", () => {
      const paidDetection = {
        ...mockDetection,
        paidPlanRequired: true,
      };
      render(<PlatformDetected detection={paidDetection} platformName="WordPress.com" />);

      expect(screen.getByText(/paid plan/i)).toBeInTheDocument();
    });
  });

  describe("unknown platform", () => {
    it("shows generic message for unknown platform", () => {
      const unknownDetection = {
        platform: "unknown",
        confidence: 0,
        features: [],
        paidPlanRequired: false,
        estimatedTime: "2 min",
      };
      render(<PlatformDetected detection={unknownDetection} />);

      expect(screen.getByText(/custom website/i)).toBeInTheDocument();
    });
  });
});
