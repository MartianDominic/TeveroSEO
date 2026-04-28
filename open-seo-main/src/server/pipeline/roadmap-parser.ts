import type { PhaseNode } from "./types";
import { PipelineError } from "./types";

/**
 * Parse ROADMAP.md content into an array of PhaseNode objects.
 * Extracts phase number, name, dependencies, requirements, status, and plan count.
 */
export function parseRoadmap(content: string): PhaseNode[] {
  const phases: PhaseNode[] = [];

  // Match phase headers: ### Phase 1: Phase Name or ### Phase 30.5: Phase Name
  const phaseHeaderRegex = /### Phase (\d+(?:\.\d+)?): (.+)/g;
  const matches = [...content.matchAll(phaseHeaderRegex)];

  if (matches.length === 0) {
    throw new PipelineError(
      "No valid phase headers found in ROADMAP.md",
      "INVALID_ROADMAP"
    );
  }

  for (const match of matches) {
    const phaseNumber = Number.parseFloat(match[1]);
    const phaseName = match[2].trim();

    // Extract the phase details section (from current header to next header or end)
    const phaseHeaderIndex = match.index!;
    const nextHeaderMatch = content
      .slice(phaseHeaderIndex + match[0].length)
      .match(/### Phase \d+(?:\.\d+)?:/);
    const nextHeaderIndex = nextHeaderMatch
      ? phaseHeaderIndex + match[0].length + nextHeaderMatch.index!
      : content.length;

    const phaseSection = content.slice(phaseHeaderIndex, nextHeaderIndex);

    // Extract dependencies from "**Depends on**: Phase X, Phase Y" or "Nothing"
    const dependencies: number[] = [];
    const dependsOnMatch = phaseSection.match(
      /\*\*Depends on\*\*:\s*(.+?)(?:\n|$)/
    );
    if (dependsOnMatch) {
      const dependsOnText = dependsOnMatch[1].trim();
      // Extract phase numbers from text like "Phase 1, Phase 2"
      const phaseNumberMatches = dependsOnText.matchAll(/Phase (\d+(?:\.\d+)?)/g);
      for (const depMatch of phaseNumberMatches) {
        dependencies.push(Number.parseFloat(depMatch[1]));
      }
    }

    // Extract requirements from "**Requirements**: REQ-01, REQ-02"
    const requirements: string[] = [];
    const requirementsMatch = phaseSection.match(
      /\*\*Requirements\*\*:\s*(.+?)(?:\n|$)/
    );
    if (requirementsMatch) {
      const requirementsText = requirementsMatch[1].trim();
      // Split by comma and trim
      requirements.push(
        ...requirementsText.split(",").map((req) => req.trim())
      );
    }

    // Extract plan count from "**Plans**: N plans"
    let planCount = 0;
    const planCountMatch = phaseSection.match(/\*\*Plans\*\*:\s*(\d+)\s+plans?/);
    if (planCountMatch) {
      planCount = Number.parseInt(planCountMatch[1], 10);
    }

    // Extract status from Progress table
    // Look for line like "| 1. First Phase | 0/3 | Complete | 2026-04-23 |"
    let status: PhaseNode["status"] = "not_started";
    const progressTableRegex = new RegExp(
      `\\|\\s*${phaseNumber}(?:\\.\\d+)?\\.[^|]+\\|[^|]+\\|\\s*(\\w+(?:\\s+\\w+)?)\\s*\\|`,
      "i"
    );
    const progressMatch = content.match(progressTableRegex);
    if (progressMatch) {
      const statusText = progressMatch[1].trim().toLowerCase();
      if (statusText === "complete") {
        status = "complete";
      } else if (statusText === "in progress") {
        status = "in_progress";
      } else {
        status = "not_started";
      }
    }

    // Create slug from name (lowercase, replace spaces with hyphens)
    const slug = phaseName.toLowerCase().replace(/\s+/g, "-");

    phases.push({
      number: phaseNumber,
      name: phaseName,
      slug,
      dependencies,
      requirements,
      status,
      planCount,
    });
  }

  return phases;
}
