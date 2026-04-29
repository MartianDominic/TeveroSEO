/**
 * Cron endpoint for processing proposal and prospect automations.
 * Phase 30-08: Pipeline & Automation
 * Phase 30.5-07: Prospect Pipeline Automation
 *
 * Called hourly via cron to:
 * - Process time-based triggers (not viewed, no action)
 * - Process engagement signal triggers (hot prospect)
 * - Process prospect pipeline automations (score_threshold, time_in_stage)
 * - Send follow-up emails
 * - Notify agency
 *
 * Endpoint: GET /api/cron/automations
 * Protected by CRON_SECRET header
 */

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { processAutomations } from "@/server/features/proposals/automation";
import { processProspectAutomations } from "@/server/features/prospects/automation/prospectAutomation";
import { db } from "@/db/index";
import { organization } from "@/db/user-schema";
import { createLogger } from "@/server/lib/logger";

/**
 * Get all workspace IDs for cron processing.
 * Each workspace has its own automations to process.
 */
async function getAllWorkspaceIds(): Promise<string[]> {
  const orgs = await db.select({ id: organization.id }).from(organization);
  return orgs.map((o) => o.id);
}

const log = createLogger({ module: "cron-automations" });

export const Route = createFileRoute("/api/cron/automations")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // SECURITY: CRON_SECRET is required - endpoint is disabled without it
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          log.error("CRON_SECRET environment variable not set - endpoint disabled");
          return Response.json(
            { error: "Cron endpoint not configured" },
            { status: 503 }
          );
        }

        // SECURITY: Use timing-safe comparison to prevent timing attacks
        const authHeader = request.headers.get("Authorization");
        const expectedAuth = `Bearer ${cronSecret}`;

        let isAuthorized = false;
        if (authHeader) {
          try {
            const authBuffer = Buffer.from(authHeader);
            const expectedBuffer = Buffer.from(expectedAuth);
            // timingSafeEqual requires same length buffers
            if (authBuffer.length === expectedBuffer.length) {
              isAuthorized = timingSafeEqual(authBuffer, expectedBuffer);
            }
          } catch {
            // Any error in comparison should fail closed
            isAuthorized = false;
          }
        }

        if (!isAuthorized) {
          log.warn("Unauthorized cron request", {
            hasAuthHeader: !!authHeader,
            path: new URL(request.url).pathname,
          });
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        log.info("Processing automations via cron");

        try {
          const workspaceIds = await getAllWorkspaceIds();
          log.info("Processing automations for workspaces", { count: workspaceIds.length });

          // Aggregate results from all workspaces
          const proposalResults = { processed: 0, executed: 0, errors: 0 };
          const prospectResults = { processed: 0, executed: 0, errors: 0 };

          for (const workspaceId of workspaceIds) {
            try {
              // Process proposal automations
              const proposalResult = await processAutomations(workspaceId);
              proposalResults.processed += proposalResult.processed;
              proposalResults.executed += proposalResult.executed;
              proposalResults.errors += proposalResult.errors;

              // Process prospect automations
              const prospectResult = await processProspectAutomations(workspaceId);
              prospectResults.processed += prospectResult.processed;
              prospectResults.executed += prospectResult.executed;
              prospectResults.errors += prospectResult.errors;
            } catch (error) {
              log.error(
                "Workspace automation failed",
                error instanceof Error ? error : new Error(String(error)),
                { workspaceId }
              );
              proposalResults.errors++;
              prospectResults.errors++;
            }
          }

          log.info("Automations processed successfully", {
            workspacesProcessed: workspaceIds.length,
            proposals: proposalResults,
            prospects: prospectResults,
          });

          return Response.json({
            success: true,
            data: {
              proposals: proposalResults,
              prospects: prospectResults,
              workspacesProcessed: workspaceIds.length,
            },
          });
        } catch (error) {
          log.error(
            "Automation processing failed",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
