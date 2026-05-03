/**
 * Platform Guide Component Tests
 * Phase 66-04: Connection Wizard UI
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlatformGuide } from "./platform-guide";

const mockGuide = {
  platform: "shopify",
  name: "Shopify",
  steps: [
    {
      number: 1,
      title: "Log into Shopify admin",
      description: "Go to yourstore.myshopify.com/admin and sign in.",
      screenshot: "/guides/shopify/step-1.png",
    },
    {
      number: 2,
      title: "Go to Online Store, then Themes",
      description: 'In the left menu, click "Online Store" then "Themes".',
      screenshot: "/guides/shopify/step-2.png",
    },
    {
      number: 3,
      title: "Edit your theme code",
      description: 'Click the three dots (...) next to your theme, then choose "Edit code".',
      screenshot: "/guides/shopify/step-3.png",
    },
    {
      number: 4,
      title: "Add the TeveroSEO helper",
      description: 'Find and click "theme.liquid" in the left panel. Find <head> near the top and paste this line right after it:',
      code: '<script async src="https://pixel.tevero.io/t.js" data-site="site-123"></script>',
      screenshot: "/guides/shopify/step-4.png",
    },
    {
      number: 5,
      title: "Save your changes",
      description: 'Click "Save" in the top right. That\'s it! Your store is now connected.',
      helpLink: "/help/shopify",
    },
  ],
  estimatedTime: "2 min",
  difficulty: "easy" as const,
  paidPlanRequired: false,
  fallbackToGtm: true,
};

const mockSnippet = '<script async src="https://pixel.tevero.io/t.js" data-site="site-123"></script>';

describe("PlatformGuide", () => {
  describe("loading state", () => {
    it("shows loading message when guide is null", () => {
      render(
        <PlatformGuide
          guide={null}
          currentStep={0}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText(/loading guide/i)).toBeInTheDocument();
    });
  });

  describe("header", () => {
    it("displays platform name in heading", () => {
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={0}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText(/add teveroseo to your shopify/i)).toBeInTheDocument();
    });

    it("shows step counter", () => {
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={2}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText(/step 3 of 5/i)).toBeInTheDocument();
    });
  });

  describe("step content", () => {
    it("shows step number and title", () => {
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={0}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText(/log into shopify admin/i)).toBeInTheDocument();
    });

    it("shows step description", () => {
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={0}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText(/go to yourstore.myshopify.com/i)).toBeInTheDocument();
    });

    it("shows screenshot when available", () => {
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={0}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const screenshot = screen.getByAltText(/screenshot for step 1/i);
      expect(screenshot).toBeInTheDocument();
      expect(screenshot).toHaveAttribute("src", "/guides/shopify/step-1.png");
    });
  });

  describe("code snippet", () => {
    it("shows code block when step has code", () => {
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={3} // Step 4 has code
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText(/script async src/i)).toBeInTheDocument();
    });

    it("has copy button for code", () => {
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={3}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    });

    it("shows 'Copied!' feedback after clicking copy", async () => {
      // Mock clipboard API
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={3}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const copyButton = screen.getByRole("button", { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      });
    });
  });

  describe("help links", () => {
    it("shows help links when step has helpLink", () => {
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={4} // Step 5 has helpLink
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText(/stuck/i)).toBeInTheDocument();
      expect(screen.getByText(/watch video/i)).toBeInTheDocument();
      expect(screen.getByText(/chat with us/i)).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("calls onNext when 'I did this' is clicked", () => {
      const onNext = vi.fn();
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={0}
          onNext={onNext}
          onBack={vi.fn()}
        />
      );

      const nextButton = screen.getByRole("button", { name: /i did this/i });
      fireEvent.click(nextButton);

      expect(onNext).toHaveBeenCalled();
    });

    it("calls onBack when 'Back' is clicked", () => {
      const onBack = vi.fn();
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={1}
          onNext={vi.fn()}
          onBack={onBack}
        />
      );

      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      expect(onBack).toHaveBeenCalled();
    });

    it("disables Back button on first step", () => {
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={0}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const backButton = screen.getByRole("button", { name: /back/i });
      expect(backButton).toBeDisabled();
    });

    it("shows 'Verify Installation' on last step", () => {
      render(
        <PlatformGuide
          guide={mockGuide}
          snippet={mockSnippet}
          currentStep={4} // Last step
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /verify installation/i })).toBeInTheDocument();
    });
  });
});
