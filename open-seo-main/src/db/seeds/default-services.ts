/**
 * Seed script for default service templates.
 * Phase 58-01: Service Catalog & Extra Services
 *
 * Inserts 8 default service templates (3 SEO packages + 5 add-ons)
 * as system templates (workspaceId = null).
 */
import type { ServiceTemplateInsert } from "../service-catalog-schema";
import { serviceTemplates } from "../service-catalog-schema";

/**
 * Default service templates.
 * These are system templates (workspaceId = null) available to all workspaces.
 */
export const DEFAULT_SERVICES: Omit<ServiceTemplateInsert, "id" | "createdAt" | "updatedAt">[] = [
  // SEO Packages
  {
    workspaceId: null,
    category: "seo_package",
    name: "Starter SEO",
    nameEn: "Starter SEO",
    nameLt: "Pradinis SEO",
    description: "Essential SEO optimization for small businesses",
    descriptionEn: "Essential SEO optimization for small businesses",
    descriptionLt: "Esmine SEO optimizacija mazoms imonems",
    pricingType: "monthly",
    basePriceCents: 50000, // 500 EUR
    setupFeeCents: 100000, // 1,000 EUR
    currency: "EUR",
    inclusions: [
      "5 target keywords",
      "Monthly reporting",
      "Basic on-page optimization",
      "Technical SEO audit",
      "Google Search Console setup",
    ],
    termsTemplate: "SEO services include monthly optimization and reporting. Results may vary based on competition and market conditions.",
    termsTemplateEn: "SEO services include monthly optimization and reporting. Results may vary based on competition and market conditions.",
    termsTemplateLt: "SEO paslaugos apima menesi optimizavima ir ataskaitas. Rezultatai gali skirtis priklausomai nuo konkurencijos ir rinkos salygu.",
    icon: "Zap",
    displayOrder: 1,
    isActive: true,
  },
  {
    workspaceId: null,
    category: "seo_package",
    name: "Growth SEO",
    nameEn: "Growth SEO",
    nameLt: "Augimo SEO",
    description: "Comprehensive SEO for growing businesses",
    descriptionEn: "Comprehensive SEO for growing businesses",
    descriptionLt: "Isami SEO auganciam verslui",
    pricingType: "monthly",
    basePriceCents: 150000, // 1,500 EUR
    setupFeeCents: 250000, // 2,500 EUR
    currency: "EUR",
    inclusions: [
      "15 target keywords",
      "Bi-weekly reporting",
      "Content briefs (4/month)",
      "Link building (5 links/month)",
      "Competitor analysis",
      "Local SEO optimization",
    ],
    termsTemplate: "Growth SEO package includes bi-weekly reporting and active link building. Content production is the client's responsibility unless separately contracted.",
    termsTemplateEn: "Growth SEO package includes bi-weekly reporting and active link building. Content production is the client's responsibility unless separately contracted.",
    termsTemplateLt: "Augimo SEO paketas apima kas dvi savaites ataskaitas ir aktyvu nuorodu kurima. Turinio kurimas yra kliento atsakomybe, nebent atskirai susitarta.",
    icon: "TrendingUp",
    displayOrder: 2,
    isActive: true,
  },
  {
    workspaceId: null,
    category: "seo_package",
    name: "Enterprise SEO",
    nameEn: "Enterprise SEO",
    nameLt: "Imones SEO",
    description: "Full-service SEO for enterprise organizations",
    descriptionEn: "Full-service SEO for enterprise organizations",
    descriptionLt: "Pilna SEO paslauga didelems imonems",
    pricingType: "monthly",
    basePriceCents: 300000, // 3,000 EUR
    setupFeeCents: 500000, // 5,000 EUR
    currency: "EUR",
    inclusions: [
      "Unlimited target keywords",
      "Weekly reporting",
      "Dedicated account manager",
      "Priority support",
      "Content strategy",
      "Link building (15+ links/month)",
      "Technical SEO consulting",
      "International SEO",
    ],
    termsTemplate: "Enterprise SEO includes dedicated account management and priority support. Custom SLA available upon request.",
    termsTemplateEn: "Enterprise SEO includes dedicated account management and priority support. Custom SLA available upon request.",
    termsTemplateLt: "Imones SEO apima dedikuota saskaitos valdytoja ir prioritetini palaikyma. Individualus SLA galimas pagal uzklausa.",
    icon: "Building",
    displayOrder: 3,
    isActive: true,
  },
  // Add-ons
  {
    workspaceId: null,
    category: "addon",
    name: "GMB SEO Optimization",
    nameEn: "GMB SEO Optimization",
    nameLt: "GMB SEO optimizavimas",
    description: "Google Business Profile optimization and management",
    descriptionEn: "Google Business Profile optimization and management",
    descriptionLt: "Google verslo profilio optimizavimas ir valdymas",
    pricingType: "monthly",
    basePriceCents: 20000, // 200 EUR
    setupFeeCents: 0,
    currency: "EUR",
    inclusions: [
      "Profile optimization",
      "Weekly GMB posts (4/month)",
      "Q&A monitoring and responses",
      "Review response drafts",
      "Photo optimization",
    ],
    termsTemplate: "GMB services include profile optimization and weekly posts. Provider does not guarantee specific ranking positions.",
    termsTemplateEn: "GMB services include profile optimization and weekly posts. Provider does not guarantee specific ranking positions.",
    termsTemplateLt: "GMB paslaugos apima profilio optimizavima ir savaitines publikacijas. Tiekejas negarantuoja konkreciu reitingo poziciju.",
    icon: "MapPin",
    displayOrder: 4,
    isActive: true,
  },
  {
    workspaceId: null,
    category: "addon",
    name: "Google Reviews Management",
    nameEn: "Google Reviews Management",
    nameLt: "Google atsiliepimu valdymas",
    description: "Review generation and reputation management",
    descriptionEn: "Review generation and reputation management",
    descriptionLt: "Atsiliepimu generavimas ir reputacijos valdymas",
    pricingType: "monthly",
    basePriceCents: 15000, // 150 EUR
    setupFeeCents: 0,
    currency: "EUR",
    inclusions: [
      "Review generation campaigns",
      "Response management",
      "Reputation monitoring",
      "Monthly review reports",
    ],
    termsTemplate: "Review management does not include incentivized reviews. All review generation follows Google guidelines.",
    termsTemplateEn: "Review management does not include incentivized reviews. All review generation follows Google guidelines.",
    termsTemplateLt: "Atsiliepimu valdymas neapima skatinamu atsiliepimu. Visas atsiliepimu generavimas vyksta pagal Google gaires.",
    icon: "Star",
    displayOrder: 5,
    isActive: true,
  },
  {
    workspaceId: null,
    category: "one_time",
    name: "Website Design",
    nameEn: "Website Design",
    nameLt: "Svetaines dizainas",
    description: "Custom website design and development",
    descriptionEn: "Custom website design and development",
    descriptionLt: "Individualus svetaines dizainas ir kurimas",
    pricingType: "one_time",
    basePriceCents: 200000, // 2,000 EUR (starting price)
    setupFeeCents: 0,
    currency: "EUR",
    inclusions: [
      "Custom design",
      "Responsive layout",
      "SEO-optimized structure",
      "3 revision rounds",
      "Basic content migration",
    ],
    termsTemplate: "Website design includes up to 3 revision rounds. Additional revisions billed at hourly rate. Hosting not included.",
    termsTemplateEn: "Website design includes up to 3 revision rounds. Additional revisions billed at hourly rate. Hosting not included.",
    termsTemplateLt: "Svetaines dizainas apima iki 3 taisymu ciklu. Papildomi taisymai mokami valandiniu tarifu. Talpinimas neitrauktas.",
    icon: "Globe",
    displayOrder: 6,
    isActive: true,
  },
  {
    workspaceId: null,
    category: "one_time",
    name: "CRM & Automation Setup",
    nameEn: "CRM & Automation Setup",
    nameLt: "CRM ir automatizavimo saranka",
    description: "GoHighLevel CRM setup and configuration",
    descriptionEn: "GoHighLevel CRM setup and configuration",
    descriptionLt: "GoHighLevel CRM saranka ir konfiguracija",
    pricingType: "one_time",
    basePriceCents: 50000, // 500 EUR (starting price)
    setupFeeCents: 0,
    currency: "EUR",
    inclusions: [
      "GoHighLevel setup",
      "Pipeline configuration",
      "Automation workflows",
      "Training session (2 hours)",
      "Documentation",
    ],
    termsTemplate: "CRM setup includes initial configuration and training. Ongoing support billed separately. GoHighLevel subscription not included.",
    termsTemplateEn: "CRM setup includes initial configuration and training. Ongoing support billed separately. GoHighLevel subscription not included.",
    termsTemplateLt: "CRM saranka apima pradine konfiguracija ir mokymus. Nuolatinis palaikymas mokamas atskirai. GoHighLevel prenumerata neitraukta.",
    icon: "Users",
    displayOrder: 7,
    isActive: true,
  },
  {
    workspaceId: null,
    category: "addon",
    name: "Booking System",
    nameEn: "Booking System",
    nameLt: "Rezervaciju sistema",
    description: "Online booking and appointment scheduling",
    descriptionEn: "Online booking and appointment scheduling",
    descriptionLt: "Internetine rezervacija ir susitikimu planavimas",
    pricingType: "monthly",
    basePriceCents: 10000, // 100 EUR
    setupFeeCents: 0,
    currency: "EUR",
    inclusions: [
      "Calendar integration",
      "Automated reminders",
      "Online scheduling page",
      "Email notifications",
    ],
    termsTemplate: "Booking system requires compatible calendar. Setup includes integration with Google Calendar or Outlook.",
    termsTemplateEn: "Booking system requires compatible calendar. Setup includes integration with Google Calendar or Outlook.",
    termsTemplateLt: "Rezervaciju sistemai reikia suderinamo kalendoriaus. Saranka apima integracija su Google Calendar arba Outlook.",
    icon: "Calendar",
    displayOrder: 8,
    isActive: true,
  },
];

/**
 * Seed default services into the database.
 * Uses onConflictDoNothing to avoid duplicates on re-run.
 */
export async function seedDefaultServices(db: {
  insert: typeof import("drizzle-orm/pg-core").PgInsertBuilder.prototype.insert;
}): Promise<void> {
  const now = new Date();

  for (const service of DEFAULT_SERVICES) {
    const id = crypto.randomUUID();
    // @ts-expect-error - db type is simplified for flexibility
    await db
      .insert(serviceTemplates)
      .values({
        id,
        ...service,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  console.log(`Seeded ${DEFAULT_SERVICES.length} default service templates`);
}

// Allow running directly
if (typeof require !== "undefined" && require.main === module) {
  import("@/db").then(({ db }) => {
    seedDefaultServices(db)
      .then(() => {
        console.log("Default services seeded successfully");
        process.exit(0);
      })
      .catch((error) => {
        console.error("Failed to seed default services:", error);
        process.exit(1);
      });
  });
}
