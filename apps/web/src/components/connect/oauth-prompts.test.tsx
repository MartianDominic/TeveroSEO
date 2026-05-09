/**
 * OAuth Prompts Tests
 * Phase 66-09: Platform Integration Facade
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  GscPrompt,
  GaPrompt,
  GbpPrompt,
  CmsPublishPrompt,
  isPromptDismissed,
  dismissPrompt,
  useOAuthPrompts,
} from "./oauth-prompts";


// Mock @tevero/ui components
vi.mock("@tevero/ui", () => ({
  Button: ({ children, onClick, disabled, size, variant, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-size={size} data-variant={variant} {...props}>
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
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("OAuth Prompts", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("GscPrompt", () => {
    const defaultProps = {
      onConnect: vi.fn(),
      onDismiss: vi.fn(),
    };

    it("renders GSC prompt with correct content", () => {
      render(<GscPrompt {...defaultProps} />);

      expect(screen.getByText("See your ranking positions")).toBeInTheDocument();
      expect(
        screen.getByText(/Connect Google Search Console to track/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Connect Search Console/i })
      ).toBeInTheDocument();
    });

    it("calls onConnect when connect button clicked", () => {
      render(<GscPrompt {...defaultProps} />);

      fireEvent.click(
        screen.getByRole("button", { name: /Connect Search Console/i })
      );

      expect(defaultProps.onConnect).toHaveBeenCalled();
    });

    it("calls onDismiss and hides when dismiss button clicked", () => {
      render(<GscPrompt {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));

      expect(defaultProps.onDismiss).toHaveBeenCalled();
    });

    it("shows loading state when connecting", () => {
      render(<GscPrompt {...defaultProps} isConnecting />);

      expect(screen.getByText("Connecting...")).toBeInTheDocument();
    });
  });

  describe("GaPrompt", () => {
    it("renders GA prompt with correct content", () => {
      render(<GaPrompt onConnect={vi.fn()} onDismiss={vi.fn()} />);

      expect(screen.getByText("Get historical traffic data")).toBeInTheDocument();
      expect(
        screen.getByText(/Connect Google Analytics to see/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Connect Analytics/i })
      ).toBeInTheDocument();
    });
  });

  describe("GbpPrompt", () => {
    it("renders GBP prompt with correct content", () => {
      render(<GbpPrompt onConnect={vi.fn()} onDismiss={vi.fn()} />);

      expect(screen.getByText("Manage your local presence")).toBeInTheDocument();
      expect(
        screen.getByText(/Connect Google Business Profile/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Connect Business Profile/i })
      ).toBeInTheDocument();
    });
  });

  describe("CmsPublishPrompt", () => {
    it("renders CMS prompt with platform name", () => {
      render(
        <CmsPublishPrompt
          platformName="WordPress"
          onConnect={vi.fn()}
          onDismiss={vi.fn()}
        />
      );

      expect(
        screen.getByText("Publish directly to WordPress")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Connect your WordPress account/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Connect WordPress/i })
      ).toBeInTheDocument();
    });

    it("handles different platform names", () => {
      render(
        <CmsPublishPrompt
          platformName="Shopify"
          onConnect={vi.fn()}
          onDismiss={vi.fn()}
        />
      );

      expect(screen.getByText("Publish directly to Shopify")).toBeInTheDocument();
    });
  });

  describe("dismissal persistence", () => {
    it("dismissPrompt stores timestamp in localStorage", () => {
      dismissPrompt("gsc");

      const stored = localStorageMock.getItem("tevero_oauth_prompt_dismissed_gsc");
      expect(stored).not.toBeNull();
      expect(parseInt(stored!, 10)).toBeLessThanOrEqual(Date.now());
    });

    it("isPromptDismissed returns true after dismissal", () => {
      dismissPrompt("ga");

      expect(isPromptDismissed("ga")).toBe(true);
    });

    it("isPromptDismissed returns false for non-dismissed prompts", () => {
      expect(isPromptDismissed("gbp")).toBe(false);
    });

    it("prompt does not render when dismissed", () => {
      dismissPrompt("gsc");

      const { container } = render(
        <GscPrompt onConnect={vi.fn()} onDismiss={vi.fn()} />
      );

      expect(container.querySelector("[data-testid='card']")).toBeNull();
    });
  });

  describe("useOAuthPrompts hook", () => {
    it("returns prompt props for all platforms", () => {
      const { result } = renderHook(() =>
        useOAuthPrompts({
          onConnect: vi.fn(),
        })
      );

      expect(result.current.showGscPrompt).toBe(true);
      expect(result.current.showGaPrompt).toBe(true);
      expect(result.current.showGbpPrompt).toBe(true);
      expect(result.current.gscPromptProps).toBeDefined();
      expect(result.current.gaPromptProps).toBeDefined();
      expect(result.current.gbpPromptProps).toBeDefined();
    });

    it("calls onConnect with platform when prompt connect clicked", () => {
      const onConnect = vi.fn();
      const { result } = renderHook(() =>
        useOAuthPrompts({ onConnect })
      );

      act(() => {
        result.current.gscPromptProps.onConnect();
      });

      expect(onConnect).toHaveBeenCalledWith("gsc");
    });

    it("tracks connecting platform state", () => {
      const { result } = renderHook(() =>
        useOAuthPrompts({ onConnect: vi.fn() })
      );

      act(() => {
        result.current.gscPromptProps.onConnect();
      });

      expect(result.current.connectingPlatform).toBe("gsc");
    });

    it("getCmsPromptProps returns correct props for platform", () => {
      const { result } = renderHook(() =>
        useOAuthPrompts({ onConnect: vi.fn() })
      );

      const wpProps = result.current.getCmsPromptProps("WordPress");

      expect(wpProps.platformName).toBe("WordPress");
      expect(wpProps.onConnect).toBeDefined();
      expect(wpProps.onDismiss).toBeDefined();
    });

    it("shouldShowCmsPrompt returns false for dismissed platforms", () => {
      dismissPrompt("cms_wordpress");

      const { result } = renderHook(() =>
        useOAuthPrompts({ onConnect: vi.fn() })
      );

      expect(result.current.shouldShowCmsPrompt("wordpress")).toBe(false);
    });
  });
});
