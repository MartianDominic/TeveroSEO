import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ConfirmationToggle,
  getConfirmationMode,
} from "./ConfirmationToggle";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("ConfirmationToggle", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it("renders with default 'confirm' mode", () => {
    render(<ConfirmationToggle />);
    expect(screen.getByText("Confirm before proceeding")).toBeInTheDocument();
  });

  it("loads 'autonomous' mode from localStorage", () => {
    localStorageMock.setItem("keyword_confirmation_mode", "autonomous");
    render(<ConfirmationToggle />);
    expect(screen.getByText("Autonomous mode")).toBeInTheDocument();
  });

  it("toggles to autonomous mode when clicked", () => {
    render(<ConfirmationToggle />);

    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "keyword_confirmation_mode",
      "autonomous"
    );
    expect(screen.getByText("Autonomous mode")).toBeInTheDocument();
  });

  it("toggles back to confirm mode when clicked again", () => {
    localStorageMock.setItem("keyword_confirmation_mode", "autonomous");
    render(<ConfirmationToggle />);

    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "keyword_confirmation_mode",
      "confirm"
    );
    expect(screen.getByText("Confirm before proceeding")).toBeInTheDocument();
  });

  it("calls onChange callback when mode changes", () => {
    const onChange = vi.fn();
    render(<ConfirmationToggle onChange={onChange} />);

    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith("autonomous");
  });

  it("persists mode in localStorage across renders", () => {
    const { unmount } = render(<ConfirmationToggle />);

    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    unmount();

    // Re-render component
    render(<ConfirmationToggle />);
    expect(screen.getByText("Autonomous mode")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ConfirmationToggle className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("has accessible switch with aria attributes", () => {
    render(<ConfirmationToggle />);

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-describedby", "confirmation-mode-description");
  });
});

describe("getConfirmationMode", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("returns 'confirm' by default", () => {
    expect(getConfirmationMode()).toBe("confirm");
  });

  it("returns stored mode from localStorage", () => {
    localStorageMock.setItem("keyword_confirmation_mode", "autonomous");
    expect(getConfirmationMode()).toBe("autonomous");
  });

  it("returns 'confirm' for invalid stored values", () => {
    localStorageMock.setItem("keyword_confirmation_mode", "invalid");
    expect(getConfirmationMode()).toBe("confirm");
  });
});
