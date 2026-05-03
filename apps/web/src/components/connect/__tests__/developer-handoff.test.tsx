/**
 * Developer Handoff Component Tests
 * Phase 66-05: Developer Handoff Flow
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeveloperHandoff, HandoffStatusTracker } from "../developer-handoff";

// Mock fetch
global.fetch = vi.fn();

describe("DeveloperHandoff", () => {
  const defaultProps = {
    installationId: "inst_123",
    domain: "example.com",
    siteId: "site_abc123",
    senderName: "Jane Manager",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        handoffId: "handoff_123",
        magicLink: "https://app.tevero.io/install/token123",
        status: "sent",
      }),
    });
  });

  describe("Form rendering", () => {
    it("renders email input field", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      expect(screen.getByPlaceholderText(/developer@company.com/i)).toBeInTheDocument();
    });

    it("renders name input field", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      expect(screen.getByPlaceholderText(/John/i)).toBeInTheDocument();
    });

    it("renders message textarea", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      expect(
        screen.getByPlaceholderText(/Hey! Can you add this/i)
      ).toBeInTheDocument();
    });

    it("shows email preview", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      expect(screen.getByText(/Email Preview/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Add TeveroSEO to example.com \(30 seconds\)/i)
      ).toBeInTheDocument();
    });
  });

  describe("Email validation", () => {
    it("disables send button when email is empty", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      const sendButton = screen.getByRole("button", { name: /Send Email/i });
      expect(sendButton).toBeDisabled();
    });

    it("disables send button when email is invalid", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(/developer@company.com/i);
      fireEvent.change(emailInput, { target: { value: "invalid-email" } });

      const sendButton = screen.getByRole("button", { name: /Send Email/i });
      expect(sendButton).toBeDisabled();
    });

    it("enables send button when email is valid", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(/developer@company.com/i);
      fireEvent.change(emailInput, { target: { value: "dev@example.com" } });

      const sendButton = screen.getByRole("button", { name: /Send Email/i });
      expect(sendButton).not.toBeDisabled();
    });

    it("shows validation error for invalid email", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(/developer@company.com/i);
      fireEvent.change(emailInput, { target: { value: "not-an-email" } });

      expect(
        screen.getByText(/Please enter a valid email address/i)
      ).toBeInTheDocument();
    });
  });

  describe("Form submission", () => {
    it("sends handoff request on submit", async () => {
      const onSent = vi.fn();
      render(<DeveloperHandoff {...defaultProps} onSent={onSent} />);

      const emailInput = screen.getByPlaceholderText(/developer@company.com/i);
      fireEvent.change(emailInput, { target: { value: "dev@example.com" } });

      const sendButton = screen.getByRole("button", { name: /Send Email/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/connect/handoff",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("dev@example.com"),
          })
        );
      });
    });

    it("calls onSent callback on success", async () => {
      const onSent = vi.fn();
      render(<DeveloperHandoff {...defaultProps} onSent={onSent} />);

      const emailInput = screen.getByPlaceholderText(/developer@company.com/i);
      fireEvent.change(emailInput, { target: { value: "dev@example.com" } });

      const sendButton = screen.getByRole("button", { name: /Send Email/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(onSent).toHaveBeenCalledWith(
          "handoff_123",
          "https://app.tevero.io/install/token123"
        );
      });
    });

    it("shows success state after sending", async () => {
      render(<DeveloperHandoff {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(/developer@company.com/i);
      fireEvent.change(emailInput, { target: { value: "dev@example.com" } });

      const sendButton = screen.getByRole("button", { name: /Send Email/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Instructions Sent!/i)).toBeInTheDocument();
      });
    });

    it("shows error on API failure", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Rate limit exceeded" }),
      });

      render(<DeveloperHandoff {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(/developer@company.com/i);
      fireEvent.change(emailInput, { target: { value: "dev@example.com" } });

      const sendButton = screen.getByRole("button", { name: /Send Email/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Rate limit exceeded/i)).toBeInTheDocument();
      });
    });
  });

  describe("Email preview", () => {
    it("includes domain in preview subject", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      expect(
        screen.getByText(/Add TeveroSEO to example.com/i)
      ).toBeInTheDocument();
    });

    it("includes sender name in preview body", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      expect(screen.getByText(/Jane Manager/i)).toBeInTheDocument();
    });

    it("includes pixel snippet in preview", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      expect(screen.getByText(/data-site="site_abc123"/i)).toBeInTheDocument();
    });

    it("updates preview when message is typed", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      const messageInput = screen.getByPlaceholderText(/Hey! Can you add this/i);
      fireEvent.change(messageInput, { target: { value: "Please do this ASAP!" } });

      // The message appears in both textarea and preview - use getAllByText
      const elements = screen.getAllByText(/Please do this ASAP!/i);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Character counter", () => {
    it("shows message character count", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      expect(screen.getByText(/0\/500/i)).toBeInTheDocument();
    });

    it("updates count as user types", () => {
      render(<DeveloperHandoff {...defaultProps} />);

      const messageInput = screen.getByPlaceholderText(/Hey! Can you add this/i);
      fireEvent.change(messageInput, { target: { value: "Hello" } });

      expect(screen.getByText(/5\/500/i)).toBeInTheDocument();
    });
  });
});

describe("HandoffStatusTracker", () => {
  const mockHandoffs = [
    {
      id: "h1",
      developerEmail: "dev1@example.com",
      developerName: "John",
      status: "sent",
      sentAt: new Date().toISOString(),
      openedAt: null,
      completedAt: null,
      reminderCount: 0,
    },
    {
      id: "h2",
      developerEmail: "dev2@example.com",
      developerName: null,
      status: "completed",
      sentAt: new Date().toISOString(),
      openedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      reminderCount: 1,
    },
  ];

  it("renders nothing when handoffs is empty", () => {
    const { container } = render(<HandoffStatusTracker handoffs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all handoffs", () => {
    render(<HandoffStatusTracker handoffs={mockHandoffs} />);

    expect(screen.getByText("dev1@example.com")).toBeInTheDocument();
    expect(screen.getByText("dev2@example.com")).toBeInTheDocument();
  });

  it("shows correct status badges", () => {
    render(<HandoffStatusTracker handoffs={mockHandoffs} />);

    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows remind button for sent handoffs with < 3 reminders", () => {
    const onSendReminder = vi.fn();
    render(
      <HandoffStatusTracker
        handoffs={mockHandoffs}
        onSendReminder={onSendReminder}
      />
    );

    const remindButton = screen.getByRole("button", { name: /Remind/i });
    expect(remindButton).toBeInTheDocument();
  });

  it("hides remind button for completed handoffs", () => {
    render(<HandoffStatusTracker handoffs={[mockHandoffs[1]]} />);

    expect(
      screen.queryByRole("button", { name: /Remind/i })
    ).not.toBeInTheDocument();
  });

  it("hides remind button when max reminders reached", () => {
    const maxRemindersHandoff = {
      ...mockHandoffs[0],
      reminderCount: 3,
    };
    render(<HandoffStatusTracker handoffs={[maxRemindersHandoff]} />);

    expect(
      screen.queryByRole("button", { name: /Remind/i })
    ).not.toBeInTheDocument();
  });

  it("calls onSendReminder when remind button clicked", () => {
    const onSendReminder = vi.fn();
    render(
      <HandoffStatusTracker
        handoffs={mockHandoffs}
        onSendReminder={onSendReminder}
      />
    );

    const remindButton = screen.getByRole("button", { name: /Remind/i });
    fireEvent.click(remindButton);

    expect(onSendReminder).toHaveBeenCalledWith("h1");
  });

  it("shows reminder count when > 0", () => {
    render(<HandoffStatusTracker handoffs={[mockHandoffs[1]]} />);

    expect(screen.getByText(/1 reminders/i)).toBeInTheDocument();
  });
});
