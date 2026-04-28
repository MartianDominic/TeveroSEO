"use server";

export type ProposalScenario = "focused" | "full_audit" | "competitor_only";
export type AwarenessLevel =
  | "unaware"
  | "problem-aware"
  | "solution-aware"
  | "product-aware"
  | "most-aware";

export interface GeneratedSection {
  type: string;
  title: string;
  content: string;
  language: string;
}

export interface GenerateProposalInput {
  prospectId: string;
  scenario: ProposalScenario;
  awarenessLevel?: AwarenessLevel;
  pricing: {
    setupFee: number;
    monthlyFee: number;
    contractMonths: number;
  };
  agencyInfo?: {
    name?: string;
    positioning?: string;
    differentiators?: string[];
  };
}

export interface ProposalResult {
  proposalId: string;
  sections: GeneratedSection[];
  awarenessLevel: AwarenessLevel;
}

export async function generateProposal(
  input: GenerateProposalInput
): Promise<ProposalResult> {
  const openSeoUrl = process.env.OPEN_SEO_URL || "http://localhost:3001";

  const response = await fetch(`${openSeoUrl}/api/proposals/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate proposal: ${error}`);
  }

  const result = await response.json();
  return result.data;
}

export async function regenerateSection(
  proposalId: string,
  sectionType: string
): Promise<GeneratedSection> {
  const openSeoUrl = process.env.OPEN_SEO_URL || "http://localhost:3001";

  const response = await fetch(
    `${openSeoUrl}/api/proposals/${proposalId}/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionType }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to regenerate section");
  }

  const result = await response.json();
  return result.data;
}

export async function updateSection(
  proposalId: string,
  sectionType: string,
  content: string
): Promise<void> {
  const openSeoUrl = process.env.OPEN_SEO_URL || "http://localhost:3001";

  const response = await fetch(
    `${openSeoUrl}/api/proposals/${proposalId}/sections`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionType, content }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update section");
  }
}
