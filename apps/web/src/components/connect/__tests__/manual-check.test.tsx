/**
 * ManualCheck Component Tests
 * Phase 66-06: Verification UI
 *
 * Tests manual verification button, loading state, and results.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManualCheck } from "../manual-check";

describe("ManualCheck", () => {
  const defaultProps = {
    siteId: "site-123",
    onSuccess: vi.fn(),
    onStillPending: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders check now button", () => {
    render(<ManualCheck {...defaultProps} />);

    const button = screen.getByRole("button", { name: /check now/i });
    expect(button).toBeInTheDocument();
  });

  it("shows loading state when checking", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ status: "pending" }),
              }),
            100
          )
        )
    );

    render(<ManualCheck {...defaultProps} />);

    const button = screen.getByRole("button", { name: /check now/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/checking/i)).toBeInTheDocument();
    });
  });

  it("calls onSuccess when detected", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "detected",
        location: { city: "London", country: "UK" },
      }),
    });

    render(<ManualCheck {...defaultProps} />);

    const button = screen.getByRole("button", { name: /check now/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledWith({
        status: "detected",
        location: { city: "London", country: "UK" },
      });
    });
  });

  it("calls onStillPending when still pending", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "pending" }),
    });

    render(<ManualCheck {...defaultProps} />);

    const button = screen.getByRole("button", { name: /check now/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(defaultProps.onStillPending).toHaveBeenCalled();
    });
  });

  it("calls onError on failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error")
    );

    render(<ManualCheck {...defaultProps} />);

    const button = screen.getByRole("button", { name: /check now/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalled();
    });
  });

  it("shows result message after pending check", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "pending" }),
    });

    render(<ManualCheck {...defaultProps} />);

    const button = screen.getByRole("button", { name: /check now/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/not detected yet/i)).toBeInTheDocument();
    });
  });

  it("disables button while checking", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ status: "pending" }),
              }),
            100
          )
        )
    );

    render(<ManualCheck {...defaultProps} />);

    const button = screen.getByRole("button", { name: /check now/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });
});
