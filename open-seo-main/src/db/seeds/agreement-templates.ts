/**
 * Seed script for agreement templates.
 * Phase 55-06: Legal Agreement Templates
 *
 * Inserts pre-approved Lithuanian and English SEO services agreement templates.
 */
import { db } from "@/db";
import { agreementTemplates } from "../agreement-template-schema";
import { SEO_SERVICES_TEMPLATE_LT } from "@/server/features/contracts/templates/seo-services-lt";
import { SEO_SERVICES_TEMPLATE_EN } from "@/server/features/contracts/templates/seo-services-en";
import { nanoid } from "nanoid";

// Use nanoid as cuid2 replacement
const createId = () => nanoid();

/**
 * Seed agreement templates into the database.
 * Uses onConflictDoNothing to avoid duplicates on re-run.
 */
export async function seedAgreementTemplates(): Promise<void> {
  const now = new Date();

  const templates = [
    {
      id: createId(),
      name: SEO_SERVICES_TEMPLATE_LT.name,
      description: SEO_SERVICES_TEMPLATE_LT.description,
      language: SEO_SERVICES_TEMPLATE_LT.language,
      type: SEO_SERVICES_TEMPLATE_LT.type,
      sections: SEO_SERVICES_TEMPLATE_LT.sections,
      variables: SEO_SERVICES_TEMPLATE_LT.variables,
      version: 1,
      isActive: true,
      approvedAt: now,
      approvedBy: "system",
      createdAt: now,
      updatedAt: now,
      createdBy: "system",
    },
    {
      id: createId(),
      name: SEO_SERVICES_TEMPLATE_EN.name,
      description: SEO_SERVICES_TEMPLATE_EN.description,
      language: SEO_SERVICES_TEMPLATE_EN.language,
      type: SEO_SERVICES_TEMPLATE_EN.type,
      sections: SEO_SERVICES_TEMPLATE_EN.sections,
      variables: SEO_SERVICES_TEMPLATE_EN.variables,
      version: 1,
      isActive: true,
      approvedAt: now,
      approvedBy: "system",
      createdAt: now,
      updatedAt: now,
      createdBy: "system",
    },
  ];

  for (const template of templates) {
    await db
      .insert(agreementTemplates)
      .values(template)
      .onConflictDoNothing();
  }

  console.log(`Seeded ${templates.length} agreement templates`);
}

// Allow running directly
if (require.main === module) {
  seedAgreementTemplates()
    .then(() => {
      console.log("Agreement templates seeded successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to seed agreement templates:", error);
      process.exit(1);
    });
}
