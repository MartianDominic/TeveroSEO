/**
 * ErrorScreen Component Tests
 * Phase 66-06: Verification UI
 *
 * Tests error states, troubleshooting UI, and recovery actions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorScreen, type ErrorType } from "../error-screen";

describe("ErrorScreen", () => {
  const defaultProps = {
    errorType: "timeout" as ErrorType,
    siteUrl: "https://example.com",
    onRetry: vi.fn(),
    onSendToDeveloper: vi.fn(),
    onNeedHelp: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("timeout error", () => {
    it("renders timeout message", () => {
      render(<ErrorScreen {...defaultProps} errorType="timeout" />);

      expect(
        screen.getByText(/we can't see the helper yet/i)
      ).toBeInTheDocument();
    });

    it("shows troubleshooting checklist", () => {
      render(<ErrorScreen {...defaultProps} errorType="timeout" />);

      expect(
        screen.getByText(/needs a few more minutes/i)
      ).toBeInTheDocument();
    });

    it("renders try again button", () => {
      render(<ErrorScreen {...defaultProps} errorType="timeout" />);

      const retryButton = screen.getByRole("button", { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
    });

    it("renders send to developer button", () => {
      render(<ErrorScreen {...defaultProps} errorType="timeout" />);

      const devButton = screen.getByRole("button", {
        name: /send to developer/i,
      });
      expect(devButton).toBeInTheDocument();
    });

    it("renders chat with us button", () => {
      render(<ErrorScreen {...defaultProps} errorType="timeout" />);

      const helpButton = screen.getByRole("button", { name: /chat with us/i });
      expect(helpButton).toBeInTheDocument();
    });
  });

  describe("domain_mismatch error", () => {
    it("renders domain mismatch message", () => {
      render(
        <ErrorScreen
          {...defaultProps}
          errorType="domain_mismatch"
          detectedDomain="other-site.com"
        />
      );

      expect(
        screen.getByText(/found the helper, but on a different website/i)
      ).toBeInTheDocument();
    });

    it("shows detected vs expected domains", () => {
      render(
        <ErrorScreen
          {...defaultProps}
          errorType="domain_mismatch"
          detectedDomain="other-site.com"
          expectedDomain="example.com"
        />
      );

      expect(screen.getByText(/other-site.com/i)).toBeInTheDocument();
      expect(screen.getByText(/example.com/i)).toBeInTheDocument();
    });

    it("offers option to add as different site", () => {
      render(
        <ErrorScreen
          {...defaultProps}
          errorType="domain_mismatch"
          detectedDomain="other-site.com"
          onAddDifferentSite={vi.fn()}
        />
      );

      const addButton = screen.getByRole("button", {
        name: /add as different site/i,
      });
      expect(addButton).toBeInTheDocument();
    });
  });

  describe("technical error", () => {
    it("renders technical error message", () => {
      render(<ErrorScreen {...defaultProps} errorType="technical" />);

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it("shows team notified message", () => {
      render(<ErrorScreen {...defaultProps} errorType="technical" />);

      expect(
        screen.getByText(/our team has been notified/i)
      ).toBeInTheDocument();
    });

    it("renders retry and contact options", () => {
      render(<ErrorScreen {...defaultProps} errorType="technical" />);

      expect(
        screen.getByRole("button", { name: /try again/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /chat with us/i })
      ).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("calls onRetry when try again clicked", () => {
      render(<ErrorScreen {...defaultProps} />);

      const retryButton = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(retryButton);

      expect(defaultProps.onRetry).toHaveBeenCalled();
    });

    it("calls onSendToDeveloper when send to developer clicked", () => {
      render(<ErrorScreen {...defaultProps} />);

      const devButton = screen.getByRole("button", {
        name: /send to developer/i,
      });
      fireEvent.click(devButton);

      expect(defaultProps.onSendToDeveloper).toHaveBeenCalled();
    });

    it("calls onNeedHelp when chat with us clicked", () => {
      render(<ErrorScreen {...defaultProps} />);

      const helpButton = screen.getByRole("button", { name: /chat with us/i });
      fireEvent.click(helpButton);

      expect(defaultProps.onNeedHelp).toHaveBeenCalled();
    });

    it("calls onAddDifferentSite when available", () => {
      const onAddDifferentSite = vi.fn();
      render(
        <ErrorScreen
          {...defaultProps}
          errorType="domain_mismatch"
          detectedDomain="other-site.com"
          onAddDifferentSite={onAddDifferentSite}
        />
      );

      const addButton = screen.getByRole("button", {
        name: /add as different site/i,
      });
      fireEvent.click(addButton);

      expect(onAddDifferentSite).toHaveBeenCalled();
    });
  });

  describe("copy tone", () => {
    it("does not blame the user", () => {
      const { container } = render(
        <ErrorScreen {...defaultProps} errorType="timeout" />
      );

      // Should not contain accusatory language
      expect(container.textContent).not.toMatch(/you did/i);
      expect(container.textContent).not.toMatch(/your mistake/i);
      expect(container.textContent).not.toMatch(/you forgot/i);
    });
  });
});
