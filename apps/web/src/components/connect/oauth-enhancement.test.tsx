/**
 * OAuth Enhancement Tests
 * Phase 66-09: Platform Integration Facade
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OAuthEnhancement, type EnhancementPlatform } from "./oauth-enhancement";

// Mock @tevero/ui components
vi.mock("@tevero/ui", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

// Test data
const mockEnhancements: EnhancementPlatform[] = [
  {
    platform: "google_search_console",
    name: "Google Search Console",
    icon: <span>GSC</span>,
    benefits: [
      "See your ranking positions",
      "Track keyword performance",
      "Submit URLs for indexing",
    ],
    ctaText: "Connect GSC",
  },
  {
    platform: "google_analytics",
    name: "Google Analytics",
    icon: <span>GA</span>,
    benefits: [
      "Access historical traffic data",
      "Track conversions",
    ],
    ctaText: "Connect GA",
  },
  {
    platform: "wordpress_org",
    name: "WordPress",
    icon: <span>WP</span>,
    benefits: [
      "Publish content directly",
      "Edit SEO fields",
    ],
    ctaText: "Connect WordPress",
    connected: true, // Already connected
  },
];

describe("OAuthEnhancement", () => {
  const defaultProps = {
    siteId: "site-123",
    domain: "example.com",
    pixelConnected: true,
    enhancements: mockEnhancements,
    onConnect: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the enhancement page with header", () => {
    render(<OAuthEnhancement {...defaultProps} />);

    expect(screen.getByText("Enhance your connection")).toBeInTheDocument();
    expect(screen.getByText(/example.com/)).toBeInTheDocument();
  });

  it("shows pixel connected status", () => {
    render(<OAuthEnhancement {...defaultProps} />);

    expect(screen.getByText("Pixel connected")).toBeInTheDocument();
    expect(
      screen.getByText(/Real-time analytics and Core Web Vitals/)
    ).toBeInTheDocument();
  });

  it("shows available enhancements (not connected)", () => {
    render(<OAuthEnhancement {...defaultProps} />);

    // GSC should be shown (not connected)
    expect(screen.getByText("Google Search Console")).toBeInTheDocument();
    expect(screen.getByText("See your ranking positions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect GSC/i })).toBeInTheDocument();

    // GA should be shown (not connected)
    expect(screen.getByText("Google Analytics")).toBeInTheDocument();

    // WordPress should NOT be shown (already connected)
    expect(screen.queryByText("WordPress")).not.toBeInTheDocument();
  });

  it("calls onConnect when connect button clicked", () => {
    render(<OAuthEnhancement {...defaultProps} />);

    const connectGscButton = screen.getByRole("button", { name: /Connect GSC/i });
    fireEvent.click(connectGscButton);

    expect(defaultProps.onConnect).toHaveBeenCalledWith("google_search_console");
  });

  it("calls onDismiss when close button clicked", () => {
    render(<OAuthEnhancement {...defaultProps} />);

    const closeButton = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(closeButton);

    expect(defaultProps.onDismiss).toHaveBeenCalled();
  });

  it("calls onLater when later button clicked", () => {
    const onLater = vi.fn();
    render(<OAuthEnhancement {...defaultProps} onLater={onLater} />);

    const laterButtons = screen.getAllByRole("button", { name: /Later/i });
    fireEvent.click(laterButtons[0]);

    expect(onLater).toHaveBeenCalledWith("google_search_console");
  });

  it("shows all done state when all platforms connected", () => {
    const allConnected = mockEnhancements.map((e) => ({ ...e, connected: true }));

    render(
      <OAuthEnhancement
        {...defaultProps}
        enhancements={allConnected}
      />
    );

    expect(screen.getByText("All set!")).toBeInTheDocument();
    expect(
      screen.getByText(/You've connected all available platforms/)
    ).toBeInTheDocument();
  });

  it("shows loading state when connecting", () => {
    render(
      <OAuthEnhancement
        {...defaultProps}
        connectingPlatform="google_search_console"
      />
    );

    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("shows connected count when some platforms are connected", () => {
    render(<OAuthEnhancement {...defaultProps} />);

    expect(screen.getByText(/1 platform already connected/)).toBeInTheDocument();
  });

  it("shows benefits for each enhancement", () => {
    render(<OAuthEnhancement {...defaultProps} />);

    // GSC benefits
    expect(screen.getByText("See your ranking positions")).toBeInTheDocument();
    expect(screen.getByText("Track keyword performance")).toBeInTheDocument();
    expect(screen.getByText("Submit URLs for indexing")).toBeInTheDocument();

    // GA benefits
    expect(screen.getByText("Access historical traffic data")).toBeInTheDocument();
    expect(screen.getByText("Track conversions")).toBeInTheDocument();
  });
});
