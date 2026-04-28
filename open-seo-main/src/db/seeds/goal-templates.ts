/**
 * Seed script for goal templates.
 * Phase 22: Goal-Based Metrics System
 */
import { db } from "../index";
import { goalTemplates } from "../goals-schema";

const templates = [
  {
    id: "tmpl-kw-top10",
    goalType: "keywords_top_10",
    name: "Keywords in Top 10",
    description: "Track how many target keywords rank in Google positions 1-10",
    unit: "keywords",
    defaultTarget: "10",
    hasDenominator: true,
    computationMethod: "count_keywords_in_range",
    displayOrder: 1,
  },
  {
    id: "tmpl-kw-top3",
    goalType: "keywords_top_3",
    name: "Keywords in Top 3",
    description: "Track keywords in premium positions 1-3",
    unit: "keywords",
    defaultTarget: "5",
    hasDenominator: true,
    computationMethod: "count_keywords_in_range",
    displayOrder: 2,
  },
  {
    id: "tmpl-kw-pos1",
    goalType: "keywords_position_1",
    name: "#1 Rankings",
    description: "Track keywords holding the #1 position",
    unit: "keywords",
    defaultTarget: "2",
    hasDenominator: true,
    computationMethod: "count_keywords_in_range",
    displayOrder: 3,
  },
  {
    id: "tmpl-weekly-clicks",
    goalType: "weekly_clicks",
    name: "Weekly Organic Clicks",
    description: "Target organic clicks from Google per week",
    unit: "clicks",
    defaultTarget: "500",
    hasDenominator: false,
    computationMethod: "sum_clicks_period",
    displayOrder: 4,
  },
  {
    id: "tmpl-monthly-clicks",
    goalType: "monthly_clicks",
    name: "Monthly Organic Clicks",
    description: "Target organic clicks from Google per month",
    unit: "clicks",
    defaultTarget: "2000",
    hasDenominator: false,
    computationMethod: "sum_clicks_period",
    displayOrder: 5,
  },
  {
    id: "tmpl-ctr",
    goalType: "ctr_target",
    name: "CTR Target",
    description: "Maintain click-through rate above threshold",
    unit: "%",
    defaultTarget: "3",
    hasDenominator: false,
    computationMethod: "avg_ctr_period",
    displayOrder: 6,
  },
  {
    id: "tmpl-traffic-growth",
    goalType: "traffic_growth",
    name: "MoM Traffic Growth",
    description: "Achieve month-over-month traffic growth percentage",
    unit: "%",
    defaultTarget: "10",
    hasDenominator: false,
    computationMethod: "mom_growth_pct",
    displayOrder: 7,
  },
  {
    id: "tmpl-impressions",
    goalType: "impressions_target",
    name: "Monthly Impressions",
    description: "Target search impressions per month",
    unit: "impressions",
    defaultTarget: "10000",
    hasDenominator: false,
    computationMethod: "sum_impressions_period",
    displayOrder: 8,
  },
  {
    id: "tmpl-custom",
    goalType: "custom",
    name: "Custom Goal",
    description: "Define a custom goal with manual progress tracking",
    unit: null,
    defaultTarget: null,
    hasDenominator: false,
    computationMethod: "manual",
    displayOrder: 99,
  },
];

export async function seedGoalTemplates() {
  console.log("Seeding goal templates...");

  for (const template of templates) {
    await db
      .insert(goalTemplates)
      .values(template)
      .onConflictDoUpdate({
        target: goalTemplates.id,
        set: {
          name: template.name,
          description: template.description,
          unit: template.unit,
          defaultTarget: template.defaultTarget,
          hasDenominator: template.hasDenominator,
          computationMethod: template.computationMethod,
          displayOrder: template.displayOrder,
        },
      });
  }

  console.log(`Seeded ${templates.length} goal templates`);
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  seedGoalTemplates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
