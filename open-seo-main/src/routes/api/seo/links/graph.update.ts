/**
 * Link Graph Update API
 * Phase 40-04: T-40-04-03 - Link Graph Update on Publish (P39)
 *
 * POST /api/seo/links/graph/update
 * Updates link graph when new content is published.
 *
 * Security:
 * - Requires Clerk JWT authentication
 * - Validates client_id ownership via resolveClientId
 * - All DB operations wrapped in transaction
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { linkGraph, pageLinks, orphanPages } from "@/db/link-schema";
import { auditPages } from "@/db/app.schema";
import { extractDetailedLinks } from "@/server/lib/linking/link-extractor";
import { eq, and, sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { metrics, recordRequestMetrics } from "@/server/lib/metrics";
import { resolveUserContext } from "@/middleware/ensure-user";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError, asAppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/seo/links/graph/update" });

// Max HTML payload: 5MB
const MAX_HTML_SIZE = 5_000_000;

const requestSchema = z.object({
  clientId: z.string().min(1, "clientId required"),
  url: z.string().url("Valid URL required"),
  html: z.string().min(100, "HTML content required").max(MAX_HTML_SIZE, "HTML exceeds 5MB limit"),
  auditId: z.string().optional(),
});

interface GraphUpdateResponse {
  success: boolean;
  linksExtracted: number;
  internalLinks: number;
  externalLinks: number;
  latencyMs?: number;
  error?: string;
}

/**
 * Derive a deterministic page ID from URL for consistency.
 * Uses a hash-based approach when no auditPages record exists.
 */
async function resolvePageId(
  clientId: string,
  url: string,
  auditId?: string
): Promise<string> {
  // Try to find existing page in audit_pages
  if (auditId) {
    const existing = await db
      .select({ id: auditPages.id })
      .from(auditPages)
      .where(eq(auditPages.url, url))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }
  }

  // Generate deterministic ID from clientId + URL
  const encoder = new TextEncoder();
  const data = encoder.encode(`${clientId}:${url}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Return UUID-like format: first 32 chars formatted as UUID
  return `${hashHex.slice(0, 8)}-${hashHex.slice(8, 12)}-${hashHex.slice(12, 16)}-${hashHex.slice(16, 20)}-${hashHex.slice(20, 32)}`;
}

export const Route = createFileRoute("/api/seo/links/graph/update")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const startTime = Date.now();
        // Track context for error logging
        let clientId: string | undefined;
        let url: string | undefined;
        let htmlLength: number | undefined;
        const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

        try {
          // CRITICAL: Authentication - verify Clerk JWT
          const headers = request.headers;
          const userContext = await resolveUserContext(headers);

          // Parse and validate request body
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = requestSchema.safeParse(body);

          if (!parsed.success) {
            log.warn("Invalid request payload", {
              requestId,
              userId: userContext.userId,
              errors: parsed.error.issues,
            });
            recordRequestMetrics("graph.update", startTime, "validation_error");
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          // Extract validated data - these are guaranteed to be defined strings
          const validatedClientId = parsed.data.clientId;
          const validatedUrl = parsed.data.url;
          const { html, auditId } = parsed.data;

          // Capture context for error logging
          clientId = validatedClientId;
          url = validatedUrl;
          htmlLength = html.length;

          // CRITICAL: Authorization - verify user has access to clientId
          const resolvedClientId = await resolveClientId(headers, request.url);

          // If a client ID was provided in the body, ensure it matches the resolved one
          if (resolvedClientId && resolvedClientId !== validatedClientId) {
            log.warn("Client ID mismatch", {
              requestId,
              userId: userContext.userId,
              providedClientId: validatedClientId,
              resolvedClientId,
            });
            throw new AppError("FORBIDDEN", "Client ID mismatch");
          }

          // If no client ID was resolved from headers/URL but one was provided in body,
          // we need to validate the user has access to this client
          if (!resolvedClientId) {
            // resolveClientId validates the client exists and is not archived
            // We need to call it with the body clientId to validate it
            const revalidatedClientId = await resolveClientId(
              new Headers({ "x-client-id": validatedClientId }),
              request.url
            );
            if (!revalidatedClientId) {
              throw new AppError("FORBIDDEN", "Invalid or archived client");
            }
          }

          const siteOrigin = new URL(validatedUrl).origin;

          const extractResult = extractDetailedLinks({
            html,
            pageUrl: validatedUrl,
            siteOrigin,
          });

          const internalLinks = extractResult.links;
          const externalCount = extractResult.externalLinksSkipped;

          // Resolve page ID for the source page
          const pageId = await resolvePageId(validatedClientId, validatedUrl, auditId);

          // HIGH: Wrap all DB operations in a transaction for atomicity
          await db.transaction(async (tx) => {
            // Delete existing links from this source URL
            await tx
              .delete(linkGraph)
              .where(
                and(eq(linkGraph.clientId, validatedClientId), eq(linkGraph.sourceUrl, validatedUrl))
              );

            // Insert new links if we have an auditId
            if (internalLinks.length > 0 && auditId) {
              const linkInserts = internalLinks.map((link) => ({
                id: crypto.randomUUID(),
                clientId: validatedClientId,
                auditId,
                sourceUrl: validatedUrl,
                targetUrl: link.targetUrl,
                anchorText: link.anchorText,
                anchorTextLower: link.anchorText.toLowerCase(),
                anchorContext: link.context,
                position: link.position,
                paragraphIndex: link.paragraphIndex,
                isFirstParagraph: link.paragraphIndex === 1,
                isSecondParagraph: link.paragraphIndex === 2,
                isDoFollow: link.isDoFollow,
                hasNoOpener: link.hasNoOpener,
                hasTitle: link.hasTitle,
                linkType: link.linkType,
              }));

              await tx.insert(linkGraph).values(linkInserts);
            }

            // Update/insert page_links for the source page
            if (auditId) {
              await tx
                .insert(pageLinks)
                .values({
                  id: crypto.randomUUID(),
                  clientId: validatedClientId,
                  auditId,
                  pageId,
                  pageUrl: validatedUrl,
                  outboundTotal: internalLinks.length,
                  outboundInternal: internalLinks.length,
                  outboundExternal: externalCount,
                })
                .onConflictDoUpdate({
                  target: [pageLinks.clientId, pageLinks.pageUrl],
                  set: {
                    outboundTotal: internalLinks.length,
                    outboundInternal: internalLinks.length,
                    outboundExternal: externalCount,
                    computedAt: new Date(),
                  },
                });

              // HIGH: Batch update inbound counts instead of N+1 loop
              const internalTargets = [
                ...new Set(internalLinks.map((l) => l.targetUrl)),
              ];

              if (internalTargets.length > 0) {
                // Use raw SQL for batch increment of inbound counts
                // This updates all target pages in a single query
                await tx.execute(sql`
                  UPDATE page_links
                  SET
                    inbound_total = inbound_total + 1,
                    inbound_body = inbound_body + 1
                  WHERE client_id = ${validatedClientId}
                    AND page_url = ANY(${internalTargets})
                `);
              }
            }

            // Remove from orphan_pages if this URL was orphaned
            await tx
              .delete(orphanPages)
              .where(
                and(eq(orphanPages.clientId, validatedClientId), eq(orphanPages.pageUrl, validatedUrl))
              );
          });

          const response: GraphUpdateResponse = {
            success: true,
            linksExtracted: internalLinks.length + externalCount,
            internalLinks: internalLinks.length,
            externalLinks: externalCount,
            latencyMs: Date.now() - startTime,
          };

          // Record endpoint-specific metrics
          metrics.increment("api.graph.links_extracted", { clientId }, internalLinks.length + externalCount);
          metrics.increment("api.graph.internal_links", { clientId }, internalLinks.length);
          metrics.increment("api.graph.external_links", { clientId }, externalCount);
          recordRequestMetrics("graph.update", startTime, "success", { clientId });

          // Enhanced logging with metrics
          log.info("Link graph updated", {
            requestId,
            clientId,
            url,
            userId: userContext.userId,
            internal: internalLinks.length,
            external: externalCount,
            latencyMs: response.latencyMs,
            hasAuditId: !!auditId,
          });

          return Response.json(response);
        } catch (error) {
          // Handle known AppError types using duck-typing for test compatibility
          const appError = asAppError(error);
          if (appError) {
            const statusMap: Record<string, number> = {
              UNAUTHENTICATED: 401,
              FORBIDDEN: 403,
              NOT_FOUND: 404,
            };
            const status = statusMap[appError.code] ?? 500;

            log.warn("Link graph update rejected", {
              requestId,
              clientId,
              url,
              code: appError.code,
              message: appError.message,
              latencyMs: Date.now() - startTime,
            });

            recordRequestMetrics("graph.update", startTime, "error", { clientId, status: appError.code });

            return Response.json(
              {
                success: false,
                error: appError.message || appError.code,
                linksExtracted: 0,
                internalLinks: 0,
                externalLinks: 0,
              },
              { status }
            );
          }

          // Enhanced error logging with full request context
          recordRequestMetrics("graph.update", startTime, "error", { clientId });
          log.error(
            "Link graph update failed",
            error instanceof Error ? error : new Error(String(error)),
            {
              requestId,
              clientId,
              url,
              htmlLength,
              latencyMs: Date.now() - startTime,
              errorType: error instanceof Error ? error.constructor.name : typeof error,
              stack: error instanceof Error ? error.stack : undefined,
            }
          );

          return Response.json(
            {
              success: false,
              error: "Failed to update link graph",
              linksExtracted: 0,
              internalLinks: 0,
              externalLinks: 0,
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
