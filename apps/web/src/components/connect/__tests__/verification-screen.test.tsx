/**
 * VerificationScreen Component Tests
 * Phase 66-06: Verification UI
 *
 * Tests verification polling UI, success states, and troubleshooting.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { VerificationScreen } from "../verification-screen";

// Mock the verification poll hook
vi.mock("@/hooks/use-verification-poll", () => ({
  useVerificationPoll: vi.fn(),
}));

// Mock canvas-confetti
vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

import { useVerificationPoll } from "@/hooks/use-verification-poll";

const mockUseVerificationPoll = useVerificationPoll as ReturnType<typeof vi.fn>;

describe("VerificationScreen", () => {
  const defaultProps = {
    siteId: "site-123",
    siteUrl: "https://example.com",
    onSuccess: vi.fn(),
    onManualCheck: vi.fn(),
    onNeedHelp: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVerificationPoll.mockReturnValue({
      status: "pending",
      isPolling: false,
      attempts: 0,
      location: undefined,
      error: undefined,
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      checkNow: vi.fn(),
    });
  });

  describe("waiting state", () => {
    it("renders waiting message", () => {
      mockUseVerificationPoll.mockReturnValue({
        status: "pending",
        isPolling: true,
        attempts: 0,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      expect(
        screen.getByText(/waiting for your website to say hello/i)
      ).toBeInTheDocument();
    });

    it("renders pulsing dots animation", () => {
      mockUseVerificationPoll.mockReturnValue({
        status: "pending",
        isPolling: true,
        attempts: 0,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      // Check for animation container
      const dotsContainer = screen.getByTestId("pulsing-dots");
      expect(dotsContainer).toBeInTheDocument();
    });

    it("renders open website button with external link", () => {
      mockUseVerificationPoll.mockReturnValue({
        status: "pending",
        isPolling: true,
        attempts: 0,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      const openButton = screen.getByRole("link", {
        name: /open my website/i,
      });
      expect(openButton).toHaveAttribute("href", "https://example.com");
      expect(openButton).toHaveAttribute("target", "_blank");
    });

    it("shows troubleshooting tips after multiple attempts", () => {
      mockUseVerificationPoll.mockReturnValue({
        status: "pending",
        isPolling: true,
        attempts: 2,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      expect(
        screen.getByText(/taking longer than expected/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/make sure you saved the file/i)).toBeInTheDocument();
    });

    it("renders manual check link", () => {
      render(<VerificationScreen {...defaultProps} />);

      const manualCheckButton = screen.getByRole("button", {
        name: /check manually/i,
      });
      expect(manualCheckButton).toBeInTheDocument();
    });

    it("renders need help link", () => {
      render(<VerificationScreen {...defaultProps} />);

      const helpButton = screen.getByRole("button", { name: /need help/i });
      expect(helpButton).toBeInTheDocument();
    });
  });

  describe("success state", () => {
    it("renders success message when detected", () => {
      mockUseVerificationPoll.mockReturnValue({
        status: "detected",
        isPolling: false,
        attempts: 1,
        location: { city: "San Francisco", country: "United States" },
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      expect(screen.getByText(/you're connected/i)).toBeInTheDocument();
    });

    it("shows location when available", () => {
      mockUseVerificationPoll.mockReturnValue({
        status: "detected",
        isPolling: false,
        attempts: 1,
        location: { city: "San Francisco", country: "United States" },
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      expect(
        screen.getByText(/san francisco/i)
      ).toBeInTheDocument();
    });

    it("shows generic message when no location", () => {
      mockUseVerificationPoll.mockReturnValue({
        status: "detected",
        isPolling: false,
        attempts: 1,
        location: undefined,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      expect(
        screen.getByText(/detected your first visitor/i)
      ).toBeInTheDocument();
    });

    it("shows OAuth enhancement prompt", () => {
      mockUseVerificationPoll.mockReturnValue({
        status: "detected",
        isPolling: false,
        attempts: 1,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      expect(screen.getByText(/want more features/i)).toBeInTheDocument();
      // Multiple elements contain "Google Search Console" text
      const gscElements = screen.getAllByText(/google search console/i);
      expect(gscElements.length).toBeGreaterThan(0);
    });

    it("renders go to dashboard button", () => {
      mockUseVerificationPoll.mockReturnValue({
        status: "detected",
        isPolling: false,
        attempts: 1,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      const dashboardButton = screen.getByRole("button", {
        name: /go to dashboard/i,
      });
      expect(dashboardButton).toBeInTheDocument();
    });

    it("calls onSuccess when dashboard button clicked", () => {
      mockUseVerificationPoll.mockReturnValue({
        status: "detected",
        isPolling: false,
        attempts: 1,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      const dashboardButton = screen.getByRole("button", {
        name: /go to dashboard/i,
      });
      fireEvent.click(dashboardButton);

      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  describe("interactions", () => {
    it("calls checkNow when manual check clicked", () => {
      const mockCheckNow = vi.fn();
      mockUseVerificationPoll.mockReturnValue({
        status: "pending",
        isPolling: false, // Not polling, so button is enabled
        attempts: 0,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        checkNow: mockCheckNow,
      });

      render(<VerificationScreen {...defaultProps} />);

      const manualCheckButton = screen.getByRole("button", {
        name: /check manually/i,
      });
      fireEvent.click(manualCheckButton);

      expect(mockCheckNow).toHaveBeenCalled();
    });

    it("calls onNeedHelp when help button clicked", () => {
      render(<VerificationScreen {...defaultProps} />);

      const helpButton = screen.getByRole("button", { name: /need help/i });
      fireEvent.click(helpButton);

      expect(defaultProps.onNeedHelp).toHaveBeenCalled();
    });

    it("starts polling on mount", () => {
      const mockStartPolling = vi.fn();
      mockUseVerificationPoll.mockReturnValue({
        status: "pending",
        isPolling: false,
        attempts: 0,
        startPolling: mockStartPolling,
        stopPolling: vi.fn(),
        checkNow: vi.fn(),
      });

      render(<VerificationScreen {...defaultProps} />);

      expect(mockStartPolling).toHaveBeenCalled();
    });
  });
});
