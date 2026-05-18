/**
 * Document Builder PDF Export API Route
 * Phase 102: PDF export endpoint
 *
 * POST endpoint for exporting proposals to PDF.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { proposals } from "@/db/schema/document-builder";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { exportToPdf } from "@/lib/document-processing/pdf-export";

// Use Node.js runtime for Puppeteer
export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Request Validation Schema
// ---------------------------------------------------------------------------

const variableContextSchema = z.object({
  prospect: z.record(z.string()).optional(),
  client: z.record(z.string()).optional(),
  agency: z.record(z.string()).optional(),
  custom: z.record(z.string()).optional(),
});

const exportRequestSchema = z.object({
  proposalId: z.string().uuid(),
  variableContext: variableContextSchema.optional(),
  includeTheme: z.boolean().optional().default(true),
});

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    // Authentication check
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Content-Type validation
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = exportRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: parseResult.error.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { proposalId, variableContext, includeTheme } = parseResult.data;

    // Verify workspace ownership
    const proposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
      with: {
        workspace: true,
      },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    // Check workspace access (user must be part of the org that owns the workspace)
    if (proposal.workspace?.clerkOrgId && proposal.workspace.clerkOrgId !== orgId) {
      logger.warn("[doc-builder/export] Unauthorized workspace access attempt", {
        userId,
        orgId,
        workspaceOrgId: proposal.workspace.clerkOrgId,
        proposalId,
      });
      return NextResponse.json(
        { error: "Access denied to this workspace" },
        { status: 403 }
      );
    }

    logger.info("[doc-builder/export] Exporting PDF", {
      userId,
      proposalId,
      includeTheme,
    });

    // Generate PDF
    const pdfBuffer = await exportToPdf({
      proposalId,
      variableContext: variableContext ?? {},
      includeTheme,
    });

    // Return PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="proposal-${proposalId}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    logger.error(
      "[doc-builder/export] Export failed",
      error instanceof Error ? error : { error: String(error) }
    );

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "PDF export failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
