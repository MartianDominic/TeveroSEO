/**
 * Portal Scope API
 * Phase 89-06: Progress Tracking UI
 *
 * GET /api/portal/scope/:contractId - Get contracted scope data for portal
 */
import { createFileRoute } from "@tanstack/react-router";
import { LockEventService } from "@/server/features/keyword-lockin/services/LockEventService";
import { OutOfScopeService } from "@/server/features/keyword-lockin/services/OutOfScopeService";
import { ContractGoalRepository } from "@/server/features/keyword-lockin/repositories/ContractGoalRepository";
import { getContractById } from "@/server/features/contracts/repositories/ContractRepository";

export const Route = createFileRoute("/api/portal/scope/$contractId")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { contractId: string } }) => {
        try {
          const { contractId } = params;

          // Verify contract exists
          const contract = await getContractById(contractId);
          if (!contract) {
            return Response.json(
              { success: false, error: "Contract not found" },
              { status: 404 }
            );
          }

          // Get contracted keywords summary
          const lockSummary = await LockEventService.getLockEventSummary(contractId);

          // Get goals
          const goals = await ContractGoalRepository.getGoalsByContract(contractId);

          // Get out-of-scope requests
          const outOfScopeSummary = await OutOfScopeService.getPendingSummary(contractId);

          // Calculate keyword status distribution
          const keywords = lockSummary?.keywords ?? [];
          const statusDistribution = {
            total: keywords.length,
            rankedTop10: keywords.filter((k) => k.baselinePosition && k.baselinePosition <= 10).length,
            inProgress: keywords.filter(
              (k) => k.baselinePosition && k.baselinePosition > 10 && k.baselinePosition <= 100
            ).length,
            notStarted: keywords.filter((k) => !k.baselinePosition).length,
          };

          // Format response
          const response = {
            success: true,
            data: {
              contract: {
                id: contract.id,
                title: contract.title,
                status: contract.status,
                expiresAt: contract.expiresAt,
              },
              keywords: {
                total: statusDistribution.total,
                distribution: statusDistribution,
                list: keywords.map((k) => ({
                  id: k.id,
                  text: k.keywordText,
                  volume: k.searchVolume,
                  difficulty: k.difficulty,
                  funnelStage: k.funnelStage,
                  baselinePosition: k.baselinePosition,
                  status: k.status,
                })),
              },
              goals: goals.map((g) => ({
                id: g.id,
                metric: g.metric,
                targetValue: g.targetValue,
                currentValue: g.currentValue,
                achievementPercent: g.achievementPercent,
                targetDeadline: g.targetDeadline,
                status: g.status,
              })),
              outOfScope: {
                pendingCount: outOfScopeSummary.pendingCount,
                requests: outOfScopeSummary.requests.map((r) => ({
                  id: r.id,
                  keywordText: r.keywordText,
                  status: r.status,
                  requestedAt: r.requestedAt,
                  requestedBy: r.requestedBy,
                })),
              },
            },
          };

          return Response.json(response);
        } catch (error) {
          console.error("[portal/scope] Error:", error);
          return Response.json(
            { success: false, error: "Failed to fetch scope data" },
            { status: 500 }
          );
        }
      },
    },
  },
});
