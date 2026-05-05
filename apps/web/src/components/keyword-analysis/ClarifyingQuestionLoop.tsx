"use client";

/**
 * ClarifyingQuestionLoop Component
 * Phase 84-01 Task 2: Build clarifying question conversational loop
 *
 * Renders clarifying questions when ConstraintExtractor returns
 * low-confidence fields. Supports:
 * - Multiple choice options
 * - Free-text input
 * - Skip functionality
 * - Multi-round clarification (max 3)
 * - Progress tracking
 */

import { useState, useEffect, useCallback } from "react";
import { Button, Card, Input, Badge } from "@tevero/ui";
import { ChevronRight, SkipForward, MessageCircleQuestion } from "lucide-react";
import {
  useClarifyingQuestions,
  type ClarificationQuestion,
} from "./useClarifyingQuestions";

interface ClarifyingQuestionLoopProps {
  /** Initial clarification questions from ConstraintExtractor */
  clarifications: ClarificationQuestion[];
  /** Called when user answers a question */
  onAnswer: (field: string, answer: string) => void;
  /** Called when all questions are answered or max rounds reached */
  onComplete: (answers: Record<string, string>) => void;
  /** Called when new round of questions should be fetched */
  onRequestNewRound?: (answers: Record<string, string>) => Promise<ClarificationQuestion[]>;
}

export function ClarifyingQuestionLoop({
  clarifications,
  onAnswer,
  onComplete,
  onRequestNewRound,
}: ClarifyingQuestionLoopProps) {
  const {
    currentQuestion,
    currentIndex,
    totalQuestions,
    answers,
    round,
    isComplete,
    submitAnswer,
    skipQuestion,
    startNewRound,
  } = useClarifyingQuestions(clarifications);

  const [textInput, setTextInput] = useState("");
  const [isLoadingNewRound, setIsLoadingNewRound] = useState(false);

  // Handle completion
  useEffect(() => {
    if (isComplete) {
      onComplete(answers);
    }
  }, [isComplete, answers, onComplete]);

  // Handle answer submission
  const handleAnswer = useCallback(
    (answer: string) => {
      if (!currentQuestion) return;

      submitAnswer(currentQuestion.field, answer);
      onAnswer(currentQuestion.field, answer);
      setTextInput("");
    },
    [currentQuestion, submitAnswer, onAnswer]
  );

  // Handle text input submission
  const handleTextSubmit = useCallback(() => {
    if (textInput.trim()) {
      handleAnswer(textInput.trim());
    }
  }, [textInput, handleAnswer]);

  // Handle skip
  const handleSkip = useCallback(() => {
    skipQuestion();
  }, [skipQuestion]);

  // Handle requesting new round
  const handleRequestNewRound = useCallback(async () => {
    if (!onRequestNewRound) return;

    setIsLoadingNewRound(true);
    try {
      const newQuestions = await onRequestNewRound(answers);
      if (newQuestions.length > 0) {
        startNewRound(newQuestions);
      }
    } finally {
      setIsLoadingNewRound(false);
    }
  }, [onRequestNewRound, answers, startNewRound]);

  // If complete, don't render anything (parent handles completion)
  if (isComplete || !currentQuestion) {
    return null;
  }

  const hasOptions = currentQuestion.options && currentQuestion.options.length > 0;

  return (
    <Card className="p-4 border-[var(--accent)]/30 bg-[var(--surface-1)]">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="h-5 w-5 text-[var(--accent)]" />
          <span className="text-sm font-medium">
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          {round > 1 && (
            <Badge variant="secondary" className="ml-2">
              Round {round}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-[var(--text-3)]"
        >
          <SkipForward className="h-4 w-4 mr-1" />
          Skip
        </Button>
      </div>

      {/* Question text */}
      <p className="text-base font-medium mb-4">{currentQuestion.question}</p>

      {/* Options or text input */}
      {hasOptions ? (
        <div className="flex flex-wrap gap-2">
          {currentQuestion.options!.map((option) => (
            <Button
              key={option}
              variant="outline"
              size="sm"
              onClick={() => handleAnswer(option)}
              className="hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]"
            >
              {option}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your answer..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && textInput.trim()) {
                handleTextSubmit();
              }
            }}
            className="flex-1"
          />
          <Button
            onClick={handleTextSubmit}
            disabled={!textInput.trim()}
          >
            Submit
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Round info */}
      {round < 3 && onRequestNewRound && currentIndex === totalQuestions - 1 && (
        <div className="mt-4 pt-4 border-t border-[var(--hairline)]">
          <p className="text-sm text-[var(--text-3)] mb-2">
            Still need more context? We can ask follow-up questions.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestNewRound}
            disabled={isLoadingNewRound}
          >
            {isLoadingNewRound ? "Loading..." : "Ask follow-up questions"}
          </Button>
        </div>
      )}

      {/* Max rounds warning */}
      {round === 3 && (
        <p className="mt-4 text-sm text-[var(--text-3)]">
          This is the final round of questions. We&apos;ll proceed with the best
          available information after this.
        </p>
      )}
    </Card>
  );
}

export { useClarifyingQuestions } from "./useClarifyingQuestions";
export type { ClarificationQuestion } from "./useClarifyingQuestions";
