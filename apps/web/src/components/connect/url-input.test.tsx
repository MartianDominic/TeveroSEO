/**
 * URL Input Component Tests
 * Phase 66-04: Connection Wizard UI
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UrlInput } from "./url-input";

describe("UrlInput", () => {
  it("renders with heading and input", () => {
    render(<UrlInput onSubmit={vi.fn()} />);

    expect(screen.getByText("Let's connect your website")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("mywebsite.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("shows https:// prefix in input", () => {
    render(<UrlInput onSubmit={vi.fn()} />);

    expect(screen.getByText("https://")).toBeInTheDocument();
  });

  it("disables submit button when URL is empty", () => {
    render(<UrlInput onSubmit={vi.fn()} />);

    const button = screen.getByRole("button", { name: /continue/i });
    expect(button).toBeDisabled();
  });

  it("enables submit button when URL is entered", () => {
    render(<UrlInput onSubmit={vi.fn()} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "mysite.com" } });

    const button = screen.getByRole("button", { name: /continue/i });
    expect(button).not.toBeDisabled();
  });

  it("calls onSubmit with URL when form is submitted", () => {
    const onSubmit = vi.fn();
    render(<UrlInput onSubmit={onSubmit} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "mysite.com" } });
    fireEvent.submit(input.closest("form")!);

    expect(onSubmit).toHaveBeenCalledWith("mysite.com");
  });

  it("shows loading state when isLoading is true", () => {
    render(<UrlInput onSubmit={vi.fn()} isLoading />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("displays initialUrl when provided", () => {
    render(<UrlInput onSubmit={vi.fn()} initialUrl="example.com" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("example.com");
  });

  it("shows example text", () => {
    render(<UrlInput onSubmit={vi.fn()} />);

    expect(screen.getByText(/example:/i)).toBeInTheDocument();
  });
});
