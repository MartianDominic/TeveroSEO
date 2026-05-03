/**
 * Connection Step Indicator Tests
 * Phase 66-04: Connection Wizard UI
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionStepIndicator } from "./step-indicator";

describe("ConnectionStepIndicator", () => {
  it("renders all steps", () => {
    render(<ConnectionStepIndicator currentStep="url" />);

    // Should show all 4 main steps
    expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/detect/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/choose/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/install/i)).toBeInTheDocument();
  });

  it("highlights current step", () => {
    render(<ConnectionStepIndicator currentStep="choice" />);

    const choiceStep = screen.getByLabelText(/choose/i);
    expect(choiceStep).toHaveAttribute("data-current", "true");
  });

  it("marks previous steps as complete", () => {
    render(<ConnectionStepIndicator currentStep="diy" />);

    const urlStep = screen.getByLabelText(/url/i);
    const detectStep = screen.getByLabelText(/detect/i);
    const chooseStep = screen.getByLabelText(/choose/i);

    expect(urlStep).toHaveAttribute("data-complete", "true");
    expect(detectStep).toHaveAttribute("data-complete", "true");
    expect(chooseStep).toHaveAttribute("data-complete", "true");
  });

  it("shows checkmarks for completed steps", () => {
    render(<ConnectionStepIndicator currentStep="success" />);

    const checkmarks = screen.getAllByTestId("step-checkmark");
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it("shows progress connector between steps", () => {
    const { container } = render(<ConnectionStepIndicator currentStep="choice" />);

    const connectors = container.querySelectorAll("[data-connector]");
    expect(connectors.length).toBe(3); // 4 steps = 3 connectors
  });
});
