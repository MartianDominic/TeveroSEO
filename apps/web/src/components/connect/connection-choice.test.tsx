/**
 * Connection Choice Component Tests
 * Phase 66-04: Connection Wizard UI
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { ConnectionChoice } from "./connection-choice";

describe("ConnectionChoice", () => {
  it("renders heading", () => {
    render(<ConnectionChoice onSelect={vi.fn()} />);

    expect(screen.getByText(/how would you like to connect/i)).toBeInTheDocument();
  });

  it("renders all three connection options", () => {
    render(<ConnectionChoice onSelect={vi.fn()} />);

    // Use getAllByText for elements that may appear multiple times
    expect(screen.getAllByText(/i'll do it myself/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /send to my tech person/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /developer access/i })).toBeInTheDocument();
  });

  it("shows DIY description with time estimate", () => {
    render(<ConnectionChoice onSelect={vi.fn()} />);

    expect(screen.getByText(/takes about 2 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/step by step/i)).toBeInTheDocument();
  });

  it("shows developer handoff description", () => {
    render(<ConnectionChoice onSelect={vi.fn()} />);

    expect(screen.getByText(/email them/i)).toBeInTheDocument();
    expect(screen.getByText(/30 seconds/i)).toBeInTheDocument();
  });

  it("calls onSelect with 'diy' when DIY option is clicked", () => {
    const onSelect = vi.fn();
    render(<ConnectionChoice onSelect={onSelect} />);

    const diyButton = screen.getByRole("button", { name: /start setup/i });
    fireEvent.click(diyButton);

    expect(onSelect).toHaveBeenCalledWith("diy");
  });

  it("calls onSelect with 'developer' when developer option is clicked", () => {
    const onSelect = vi.fn();
    render(<ConnectionChoice onSelect={onSelect} />);

    const devButton = screen.getByRole("button", { name: /send instructions/i });
    fireEvent.click(devButton);

    expect(onSelect).toHaveBeenCalledWith("developer");
  });

  it("calls onSelect with 'oauth' when OAuth option is clicked", () => {
    const onSelect = vi.fn();
    render(<ConnectionChoice onSelect={onSelect} showOAuth />);

    const oauthButton = screen.getByRole("button", { name: /connect with oauth/i });
    fireEvent.click(oauthButton);

    expect(onSelect).toHaveBeenCalledWith("oauth");
  });

  it("hides OAuth option when showOAuth is false", () => {
    render(<ConnectionChoice onSelect={vi.fn()} showOAuth={false} />);

    expect(screen.queryByText(/connect with oauth/i)).not.toBeInTheDocument();
  });

  it("shows OAuth option by default", () => {
    render(<ConnectionChoice onSelect={vi.fn()} />);

    expect(screen.getByText(/developer access/i)).toBeInTheDocument();
  });

  it("displays platform name in OAuth option", () => {
    render(<ConnectionChoice onSelect={vi.fn()} platformName="Shopify" />);

    expect(screen.getByText(/shopify/i)).toBeInTheDocument();
  });
});
