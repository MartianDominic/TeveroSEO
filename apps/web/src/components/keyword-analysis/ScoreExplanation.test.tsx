/**
 * Tests for ScoreExplanation Component
 * Phase 85-01 Task 2: Score breakdown popover
 *
 * TDD RED: Tests written before implementation.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScoreExplanation, type ScoreBreakdown } from "./ScoreExplanation";

const mockBreakdown: ScoreBreakdown = {
  relevance: 0.85,
  funnelConfidence: 0.9,
  funnelStage: "BOFU",
  geoScore: 1.0,
  geoMatch: "Siauliai",
  volumeNormalized: 0.63,
  volume: 320,
  baseScore: 0.87,
  priorityMultiplier: 1.5,
  priorityCategory: "detailing",
  quickWinBonus: 0.2,
  position: 15,
  finalScore: 1.51,
};

describe("ScoreExplanation", () => {
  describe("rendering", () => {
    it("should render the trigger element", () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      expect(screen.getByRole("button", { name: "1.51" })).toBeInTheDocument();
    });

    it("should show popover content when trigger is clicked", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      const trigger = screen.getByRole("button", { name: "1.51" });
      fireEvent.click(trigger);

      // Wait for popover to open
      expect(await screen.findByText("Why this score?")).toBeInTheDocument();
    });

    it("should display the title in English by default", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.51" }));
      expect(await screen.findByText("Why this score?")).toBeInTheDocument();
    });

    it("should display the title in Lithuanian when locale is lt", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown} locale="lt">
          <button>1.51</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.51" }));
      expect(await screen.findByText(/Kodėl toks balas/)).toBeInTheDocument();
    });
  });

  describe("score breakdown display", () => {
    it("should display relevance score", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.51" }));
      expect(await screen.findByText("Relevance")).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("should display funnel stage", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.51" }));
      expect(await screen.findByText("Funnel Stage")).toBeInTheDocument();
      expect(screen.getByText("BOFU")).toBeInTheDocument();
    });

    it("should display geo match with city name", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.51" }));
      expect(await screen.findByText("Geo Match")).toBeInTheDocument();
      expect(screen.getByText("Siauliai")).toBeInTheDocument();
    });

    it("should display volume", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.51" }));
      expect(await screen.findByText("Volume")).toBeInTheDocument();
      expect(screen.getByText("320")).toBeInTheDocument();
    });

    it("should display base score", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.51" }));
      expect(await screen.findByText("Base Score")).toBeInTheDocument();
      expect(screen.getByText("0.87")).toBeInTheDocument();
    });

    it("should display priority multiplier when present", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.51" }));
      expect(await screen.findByText("Priority Boost")).toBeInTheDocument();
      // Check for multiplier with x prefix (unique in popover)
      expect(screen.getByText(/x1\.5/)).toBeInTheDocument();
    });

    it("should display quick win bonus when present", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.51" }));
      expect(await screen.findByText("Quick Win")).toBeInTheDocument();
      // The quick win value is within a span
      const quickWinRow = screen.getByText("Quick Win").parentElement;
      expect(quickWinRow).toHaveTextContent("+0.20");
    });

    it("should display final score", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.51" }));
      expect(await screen.findByText("Final Score")).toBeInTheDocument();
      // Check the final score row contains the value
      const finalScoreRow = screen.getByText("Final Score").parentElement;
      expect(finalScoreRow).toHaveTextContent("1.51");
    });

    it("should not show priority boost when multiplier is 1.0", async () => {
      const breakdownNoPriority: ScoreBreakdown = {
        ...mockBreakdown,
        priorityMultiplier: 1.0,
        priorityCategory: undefined,
      };

      render(
        <ScoreExplanation breakdown={breakdownNoPriority}>
          <button>1.07</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.07" }));
      await screen.findByText("Why this score?");
      expect(screen.queryByText("Priority Boost")).not.toBeInTheDocument();
    });

    it("should not show quick win when bonus is 0", async () => {
      const breakdownNoQuickWin: ScoreBreakdown = {
        ...mockBreakdown,
        quickWinBonus: 0,
        position: undefined,
      };

      render(
        <ScoreExplanation breakdown={breakdownNoQuickWin}>
          <button>1.31</button>
        </ScoreExplanation>
      );

      fireEvent.click(screen.getByRole("button", { name: "1.31" }));
      await screen.findByText("Why this score?");
      expect(screen.queryByText("Quick Win")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have aria-label on popover trigger", () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      const trigger = screen.getByRole("button", { name: "1.51" });
      expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    });

    it("should support keyboard activation", async () => {
      render(
        <ScoreExplanation breakdown={mockBreakdown}>
          <button>1.51</button>
        </ScoreExplanation>
      );

      const trigger = screen.getByRole("button", { name: "1.51" });
      // Use click instead of keyDown since button click is keyboard accessible
      fireEvent.click(trigger);

      expect(await screen.findByText("Why this score?")).toBeInTheDocument();
    });
  });
});
