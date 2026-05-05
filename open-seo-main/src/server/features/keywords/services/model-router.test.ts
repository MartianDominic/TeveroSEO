import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ModelRouter, type TaskType } from "./model-router";

describe("ModelRouter", () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter();
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    vi.stubEnv("XAI_API_KEY", "test-xai-key");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    router.resetCircuits();
  });

  describe("selectModel", () => {
    it("selects cheapest model for classification", () => {
      const model = router.selectModel("classification", 50);
      // llama-3.1-8b-instant is cheapest for classification
      expect(model.id).toBe("llama-3.1-8b-instant");
    });

    it("selects model with required capability", () => {
      const model = router.selectModel("lithuanian_complex", 50);
      // Only llama-3.3-70b has lithuanian_complex capability
      expect(model.id).toBe("llama-3.3-70b");
    });

    it("respects batch size limits", () => {
      // Batch size 150 exceeds llama-3.1-8b-instant's maxBatchSize of 200
      // but llama-3.3-70b has maxBatchSize of 100
      const model = router.selectModel("classification", 150);
      expect(model.id).toBe("llama-3.1-8b-instant");
    });

    it("throws when no model available", () => {
      expect(() => {
        router.selectModel("nonexistent_task" as TaskType, 50);
      }).toThrow("No model available for task");
    });
  });

  describe("getAvailableModels", () => {
    it("returns all models when circuits closed", () => {
      const models = router.getAvailableModels();
      expect(models.length).toBe(3);
    });
  });

  describe("resetCircuits", () => {
    it("resets all circuit breakers", () => {
      router.resetCircuits();
      const models = router.getAvailableModels();
      expect(models.length).toBe(3);
    });
  });

  describe("call", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: "test response" } }],
              usage: { prompt_tokens: 100, completion_tokens: 50 },
            }),
        })
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns result with cost", async () => {
      const result = await router.call("classification", [
        { role: "user", content: "classify this" },
      ]);

      expect(result.result).toBe("test response");
      expect(result.model).toBe("llama-3.1-8b-instant");
      expect(result.cost).toBeGreaterThan(0);
      expect(result.usage.input).toBe(100);
      expect(result.usage.output).toBe(50);
    });

    it("calculates cost correctly", async () => {
      const result = await router.call("classification", [
        { role: "user", content: "test" },
      ]);

      // llama-3.1-8b-instant: input=0.05, output=0.08 per million tokens
      // 100 input tokens = 0.000005, 50 output tokens = 0.000004
      const expectedCost = (100 / 1_000_000) * 0.05 + (50 / 1_000_000) * 0.08;
      expect(result.cost).toBeCloseTo(expectedCost, 10);
    });

    it("calls correct provider endpoint", async () => {
      await router.call("classification", [{ role: "user", content: "test" }]);

      expect(fetch).toHaveBeenCalledWith(
        "https://api.groq.com/openai/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-groq-key",
          }),
        })
      );
    });
  });
});
