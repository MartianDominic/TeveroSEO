/**
 * useClarifyingQuestions Hook
 * Phase 84-01 Task 2: Build clarifying question conversational loop
 *
 * Manages state for clarifying questions when ConstraintExtractor
 * returns low confidence fields. Supports multi-round clarification
 * with max 3 rounds limit.
 */

import { useState, useCallback, useMemo } from "react";

export interface ClarificationQuestion {
  field: string;
  question: string;
  options?: string[];
}

export interface UseClarifyingQuestionsState {
  currentQuestion: ClarificationQuestion | null;
  currentIndex: number;
  totalQuestions: number;
  answers: Record<string, string>;
  round: number;
  isComplete: boolean;
}

export interface UseClarifyingQuestionsActions {
  submitAnswer: (field: string, answer: string) => void;
  skipQuestion: () => void;
  reset: () => void;
  startNewRound: (newQuestions: ClarificationQuestion[]) => void;
}

export type UseClarifyingQuestionsReturn = UseClarifyingQuestionsState &
  UseClarifyingQuestionsActions;

const MAX_ROUNDS = 3;

export function useClarifyingQuestions(
  initialQuestions: ClarificationQuestion[] = []
): UseClarifyingQuestionsReturn {
  const [questions, setQuestions] =
    useState<ClarificationQuestion[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [round, setRound] = useState(1);

  const currentQuestion = useMemo(() => {
    return questions[currentIndex] ?? null;
  }, [questions, currentIndex]);

  const isComplete = useMemo(() => {
    return currentIndex >= questions.length || round > MAX_ROUNDS;
  }, [currentIndex, questions.length, round]);

  const submitAnswer = useCallback((field: string, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [field]: answer,
    }));
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const skipQuestion = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const reset = useCallback(() => {
    setQuestions(initialQuestions);
    setCurrentIndex(0);
    setAnswers({});
    setRound(1);
  }, [initialQuestions]);

  const startNewRound = useCallback(
    (newQuestions: ClarificationQuestion[]) => {
      if (round >= MAX_ROUNDS) {
        // Don't start new round if we've hit max
        return;
      }

      setQuestions(newQuestions);
      setCurrentIndex(0);
      setRound((prev) => prev + 1);
    },
    [round]
  );

  return {
    currentQuestion,
    currentIndex,
    totalQuestions: questions.length,
    answers,
    round,
    isComplete,
    submitAnswer,
    skipQuestion,
    reset,
    startNewRound,
  };
}

/**
 * Map field names to human-readable clarifying questions.
 * This provides a consistent question mapping for all constraint fields.
 */
export const QUESTION_MAP: Record<
  string,
  { question: string; options?: string[] }
> = {
  "business.type": {
    question: "What type of business are you?",
    options: ["E-commerce", "Service", "SaaS", "Local business", "B2B services"],
  },
  "business.coreOffering": {
    question: "What is your main product or service?",
  },
  "geo.scope": {
    question: "What geographic area do you serve?",
    options: [
      "Single city/neighborhood (hyperlocal)",
      "One city",
      "Multiple cities/region",
      "Nationwide",
    ],
  },
  "geo.includeCities": {
    question: "Which specific cities or areas do you serve?",
  },
  "audience.b2bOnly": {
    question: "Who are your customers?",
    options: [
      "Only businesses (B2B)",
      "Only consumers (B2C)",
      "Both businesses and consumers",
    ],
  },
  "funnel.primary": {
    question: "What's your main marketing goal?",
    options: [
      "Capture ready-to-buy customers (Bottom of funnel)",
      "Help people compare options (Middle of funnel)",
      "Build awareness and educate (Top of funnel)",
    ],
  },
  priorities: {
    question:
      "What product or service categories are most important for your business?",
  },
  negatives: {
    question: "Are there any competitors or terms you want to exclude?",
  },
};

/**
 * Convert field name to a ClarificationQuestion object.
 */
export function fieldToQuestion(field: string): ClarificationQuestion {
  const mapping = QUESTION_MAP[field];
  if (mapping) {
    return {
      field,
      question: mapping.question,
      options: mapping.options,
    };
  }

  // Fallback for unmapped fields
  return {
    field,
    question: `Please provide more details about: ${field.replace(/\./g, " ")}`,
  };
}
