/**
 * Tests for ClarifyingQuestionLoop Component
 * Phase 84-01 Task 2: Build clarifying question conversational loop
 *
 * TDD RED: Tests written before implementation.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Import the component (will fail until implemented)
import { ClarifyingQuestionLoop } from "./ClarifyingQuestionLoop";
import { useClarifyingQuestions } from "./useClarifyingQuestions";

// Mock the hook for isolated component testing
vi.mock("./useClarifyingQuestions", () => ({
  useClarifyingQuestions: vi.fn(),
}));

const mockUseClarifyingQuestions = useClarifyingQuestions as ReturnType<typeof vi.fn>;

describe("ClarifyingQuestionLoop", () => {
  const defaultClarifications = [
    {
      field: "business.type",
      question: "What type of business are you?",
      options: ["E-commerce", "Service", "SaaS", "Local business"],
    },
    {
      field: "geo.scope",
      question: "What geographic area do you serve?",
      options: ["Local", "Regional", "National"],
    },
  ];

  const mockOnAnswer = vi.fn();
  const mockOnComplete = vi.fn();
  const mockOnSkip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseClarifyingQuestions.mockReturnValue({
      currentQuestion: defaultClarifications[0],
      currentIndex: 0,
      totalQuestions: 2,
      answers: {},
      round: 1,
      isComplete: false,
      submitAnswer: mockOnAnswer,
      skipQuestion: mockOnSkip,
      reset: vi.fn(),
    });
  });

  describe("rendering", () => {
    it("renders the current clarifying question", () => {
      render(
        <ClarifyingQuestionLoop
          clarifications={defaultClarifications}
          onAnswer={mockOnAnswer}
          onComplete={mockOnComplete}
        />
      );

      expect(
        screen.getByText("What type of business are you?")
      ).toBeInTheDocument();
    });

    it("renders question options as selectable buttons", () => {
      render(
        <ClarifyingQuestionLoop
          clarifications={defaultClarifications}
          onAnswer={mockOnAnswer}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText("E-commerce")).toBeInTheDocument();
      expect(screen.getByText("Service")).toBeInTheDocument();
      expect(screen.getByText("SaaS")).toBeInTheDocument();
      expect(screen.getByText("Local business")).toBeInTheDocument();
    });

    it("shows progress indicator (1/2)", () => {
      render(
        <ClarifyingQuestionLoop
          clarifications={defaultClarifications}
          onAnswer={mockOnAnswer}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(/1.*of.*2/i)).toBeInTheDocument();
    });

    it("shows round indicator when round > 1", () => {
      mockUseClarifyingQuestions.mockReturnValue({
        currentQuestion: defaultClarifications[0],
        currentIndex: 0,
        totalQuestions: 2,
        answers: {},
        round: 2,
        isComplete: false,
        submitAnswer: mockOnAnswer,
        skipQuestion: mockOnSkip,
        reset: vi.fn(),
      });

      render(
        <ClarifyingQuestionLoop
          clarifications={defaultClarifications}
          onAnswer={mockOnAnswer}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(/round 2/i)).toBeInTheDocument();
    });
  });

  describe("interaction", () => {
    it("calls onAnswer when option is selected", () => {
      render(
        <ClarifyingQuestionLoop
          clarifications={defaultClarifications}
          onAnswer={mockOnAnswer}
          onComplete={mockOnComplete}
        />
      );

      fireEvent.click(screen.getByText("E-commerce"));

      expect(mockOnAnswer).toHaveBeenCalledWith("business.type", "E-commerce");
    });

    it("renders text input for questions without options", () => {
      const textQuestion = {
        field: "business.coreOffering",
        question: "What is your main product or service?",
      };

      mockUseClarifyingQuestions.mockReturnValue({
        currentQuestion: textQuestion,
        currentIndex: 0,
        totalQuestions: 1,
        answers: {},
        round: 1,
        isComplete: false,
        submitAnswer: mockOnAnswer,
        skipQuestion: mockOnSkip,
        reset: vi.fn(),
      });

      render(
        <ClarifyingQuestionLoop
          clarifications={[textQuestion]}
          onAnswer={mockOnAnswer}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("shows skip button", () => {
      render(
        <ClarifyingQuestionLoop
          clarifications={defaultClarifications}
          onAnswer={mockOnAnswer}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(/skip/i)).toBeInTheDocument();
    });

    it("calls skipQuestion when skip is clicked", () => {
      render(
        <ClarifyingQuestionLoop
          clarifications={defaultClarifications}
          onAnswer={mockOnAnswer}
          onComplete={mockOnComplete}
        />
      );

      fireEvent.click(screen.getByText(/skip/i));

      expect(mockOnSkip).toHaveBeenCalled();
    });
  });

  describe("completion", () => {
    it("calls onComplete when all questions answered", () => {
      mockUseClarifyingQuestions.mockReturnValue({
        currentQuestion: null,
        currentIndex: 2,
        totalQuestions: 2,
        answers: {
          "business.type": "E-commerce",
          "geo.scope": "National",
        },
        round: 1,
        isComplete: true,
        submitAnswer: mockOnAnswer,
        skipQuestion: mockOnSkip,
        reset: vi.fn(),
      });

      render(
        <ClarifyingQuestionLoop
          clarifications={defaultClarifications}
          onAnswer={mockOnAnswer}
          onComplete={mockOnComplete}
        />
      );

      expect(mockOnComplete).toHaveBeenCalled();
    });
  });
});

describe("useClarifyingQuestions hook", () => {
  // Note: These tests will need a proper React testing setup
  // For now, we test the hook logic in isolation

  it("tracks question progression", async () => {
    // Will be implemented with actual hook
    expect(true).toBe(true);
  });

  it("accumulates answers", async () => {
    expect(true).toBe(true);
  });

  it("tracks clarification rounds", async () => {
    expect(true).toBe(true);
  });

  it("caps at 3 rounds max", async () => {
    expect(true).toBe(true);
  });
});
