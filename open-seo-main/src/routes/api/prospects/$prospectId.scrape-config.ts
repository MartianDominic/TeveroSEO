/**
 * Prospect Scrape Config API Route.
 * Phase 43: Prospect Keyword Pipeline - AI Selector Discovery
 *
 * GET /api/prospects/:prospectId/scrape-config - Get scrape configuration
 * PUT /api/prospects/:prospectId/scrape-config - Update scrape configuration
 * POST /api/prospects/:prospectId/scrape-config - AI discovery / test extraction
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { prospectScrapeConfigs } from "@/db/prospect-scrape-config-schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { selectorDiscoveryService } from "@/server/features/scraping/services/SelectorDiscoveryService";
import { CustomExtractor } from "@/server/features/scraping/services/CustomExtractor";
import { createLogger } from "@/server/lib/logger";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/prospects/:id/scrape-config" });

// Validation schemas
const ExtractionFieldSchema = z.object({
  name: z.string(),
  selectors: z.array(z.string()),
  type: z.enum(["text", "attribute", "html"]),
  attribute: z.string().optional(),
  transform: z.enum(["trim", "lowercase", "number", "price"]).optional(),
});

const ExtractionRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  urlPattern: z.string(),
  pageType: z.enum(["product", "category", "brand", "other"]),
  fields: z.array(ExtractionFieldSchema),
  enabled: z.boolean(),
});

const UpdateConfigSchema = z.object({
  extractionRules: z.array(ExtractionRuleSchema).optional(),
  maxPages: z.number().min(1).max(5000).optional(),
  maxDepth: z.number().min(1).max(10).optional(),
  rateLimit: z.number().min(1).max(10).optional(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
});

const DiscoverActionSchema = z.object({
  action: z.literal("discover"),
  html: z.string().min(100),
  url: z.string().url(),
});

const TestActionSchema = z.object({
  action: z.literal("test"),
  rule: ExtractionRuleSchema,
  html: z.string().min(100),
  url: z.string().url(),
});

export const Route = createFileRoute(
  "/api/prospects/$prospectId/scrape-config",
)({
  server: {
    handlers: {
      /**
       * GET /api/prospects/:prospectId/scrape-config
       *
       * Get scrape configuration for a prospect.
       * Returns null if no config exists yet.
       */
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { prospectId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { prospectId } = params;

          log.info("Fetching scrape config", { prospectId });

          const configs = await db
            .select()
            .from(prospectScrapeConfigs)
            .where(eq(prospectScrapeConfigs.prospectId, prospectId))
            .limit(1);

          return Response.json({
            success: true,
            data: configs[0] || null,
          });
        } catch (err) {
          log.error(
            "Failed to fetch scrape config",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json(
            { success: false, error: (err as Error).message },
            { status: 500 },
          );
        }
      },

      /**
       * PUT /api/prospects/:prospectId/scrape-config
       *
       * Update or create scrape configuration for a prospect.
       */
      PUT: async ({
        request,
        params,
      }: {
        request: Request;
        params: { prospectId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { prospectId } = params;
          const body = await request.json();
          const input = UpdateConfigSchema.parse(body);

          log.info("Updating scrape config", { prospectId });

          // Check if config exists
          const existing = await db
            .select()
            .from(prospectScrapeConfigs)
            .where(eq(prospectScrapeConfigs.prospectId, prospectId))
            .limit(1);

          if (existing.length > 0) {
            // Update existing
            await db
              .update(prospectScrapeConfigs)
              .set({
                ...input,
                updatedAt: new Date(),
              })
              .where(eq(prospectScrapeConfigs.id, existing[0].id));
          } else {
            // Create new
            await db.insert(prospectScrapeConfigs).values({
              id: `scrape_${nanoid(12)}`,
              prospectId,
              ...input,
            });
          }

          return Response.json({ success: true });
        } catch (err) {
          if (err instanceof z.ZodError) {
            return Response.json(
              { success: false, error: err.issues },
              { status: 400 },
            );
          }
          log.error(
            "Failed to update scrape config",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json(
            { success: false, error: (err as Error).message },
            { status: 500 },
          );
        }
      },

      /**
       * POST /api/prospects/:prospectId/scrape-config
       *
       * Handle actions: AI selector discovery or test extraction.
       *
       * Actions:
       * - discover: Use AI to discover CSS selectors from HTML
       * - test: Test an extraction rule against sample HTML
       */
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { prospectId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { prospectId } = params;
          const body = (await request.json()) as { action?: string };

          // Determine action type
          const action = body.action;

          if (action === "discover") {
            // Validate discover action input
            const input = DiscoverActionSchema.parse(body);

            log.info("Running AI selector discovery", { prospectId });

            // Run AI discovery
            const result = await selectorDiscoveryService.discoverSelectors(
              input.html,
              input.url,
            );

            // Save discovered selectors to config
            const existing = await db
              .select()
              .from(prospectScrapeConfigs)
              .where(eq(prospectScrapeConfigs.prospectId, prospectId))
              .limit(1);

            if (existing.length > 0) {
              await db
                .update(prospectScrapeConfigs)
                .set({
                  detectedPlatform: result.platform,
                  aiSelectors: result.selectors,
                  updatedAt: new Date(),
                })
                .where(eq(prospectScrapeConfigs.id, existing[0].id));
            } else {
              await db.insert(prospectScrapeConfigs).values({
                id: `scrape_${nanoid(12)}`,
                prospectId,
                detectedPlatform: result.platform,
                aiSelectors: result.selectors,
              });
            }

            return Response.json({ success: true, data: result });
          }

          if (action === "test") {
            // Validate test action input
            const input = TestActionSchema.parse(body);

            log.info("Testing extraction rule", { prospectId });

            // Test the rule
            const extractor = new CustomExtractor([input.rule]);
            const result = extractor.testRule(input.rule, input.html, input.url);

            return Response.json({ success: true, data: result });
          }

          return Response.json(
            { success: false, error: "Unknown action" },
            { status: 400 },
          );
        } catch (err) {
          if (err instanceof z.ZodError) {
            return Response.json(
              { success: false, error: err.issues },
              { status: 400 },
            );
          }
          log.error(
            "Scrape config action failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json(
            { success: false, error: (err as Error).message },
            { status: 500 },
          );
        }
      },
    },
  },
});
