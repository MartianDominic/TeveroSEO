import { describe, expect, it } from "vitest";
import {
  keywordsForSiteItemSchema,
  competitorsDomainItemSchema,
} from "@/server/lib/dataforseoSchemas";

describe("keywordsForSiteItemSchema", () => {
  it("validates items with keyword, keyword_data, ranked_serp_element", () => {
    const validItem = {
      keyword: "sauna heater",
      location_code: 2840,
      language_code: "en",
      keyword_info: {
        search_volume: 1000,
        cpc: 2.5,
        competition: 0.3,
        competition_level: "MEDIUM",
        categories: [123, 456],
        monthly_searches: [
          { year: 2026, month: 3, search_volume: 1200 },
          { year: 2026, month: 2, search_volume: 900 },
        ],
      },
      keyword_info_normalized_with_bing: {
        search_volume: 1100,
      },
      impressions_info: {
        se_type: "google",
        last_updated_time: "2026-04-01",
        bid: 1.5,
        match_type: "exact",
        ad_position_min: 1.2,
        ad_position_max: 3.5,
        ad_position_average: 2.3,
        cpc_min: 1.0,
        cpc_max: 4.0,
        cpc_average: 2.5,
        daily_impressions_min: 50,
        daily_impressions_max: 200,
        daily_impressions_average: 100,
        daily_clicks_min: 5,
        daily_clicks_max: 20,
        daily_clicks_average: 10,
        daily_cost_min: 5.0,
        daily_cost_max: 50.0,
        daily_cost_average: 25.0,
      },
      serp_info: {
        serp_type: "regular",
        check_url: "https://www.google.com/search?q=sauna+heater",
        serp_check_time: "2026-04-15 10:30:00 +00:00",
      },
      ranked_serp_element: {
        se_type: "google",
        serp_item: {
          se_type: "google",
          type: "organic",
          rank_group: 5,
          rank_absolute: 5,
          position: "left",
          xpath: "/html/body/...",
          domain: "example.com",
          url: "https://example.com/saunas",
          title: "Best Sauna Heaters | Example",
          description: "Find the best sauna heaters for your home.",
          etv: 150.5,
          estimated_paid_traffic_cost: 75.0,
          rank_changes: {
            previous_rank_absolute: 7,
            is_new: false,
            is_up: true,
            is_down: false,
          },
        },
      },
    };

    const result = keywordsForSiteItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keyword).toBe("sauna heater");
      expect(result.data.keyword_info?.search_volume).toBe(1000);
      expect(result.data.ranked_serp_element?.serp_item?.rank_absolute).toBe(5);
    }
  });

  it("validates minimal item with only required keyword field", () => {
    const minimalItem = {
      keyword: "barrel sauna",
    };

    const result = keywordsForSiteItemSchema.safeParse(minimalItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keyword).toBe("barrel sauna");
    }
  });

  it("rejects item without keyword field", () => {
    const invalidItem = {
      keyword_info: {
        search_volume: 500,
      },
    };

    const result = keywordsForSiteItemSchema.safeParse(invalidItem);
    expect(result.success).toBe(false);
  });
});

describe("competitorsDomainItemSchema", () => {
  it("validates items with domain, avg_position, sum_position, intersections", () => {
    const validItem = {
      se_type: "google",
      domain: "competitor1.com",
      avg_position: 5.5,
      sum_position: 550,
      intersections: 100,
      full_domain_metrics: {
        organic: {
          pos_1: 5,
          pos_2_3: 10,
          pos_4_10: 25,
          pos_11_20: 30,
          pos_21_30: 15,
          pos_31_40: 10,
          pos_41_50: 5,
          pos_51_60: 3,
          pos_61_70: 2,
          pos_71_80: 1,
          pos_81_90: 0,
          pos_91_100: 0,
          etv: 5000.5,
          impressions_etv: 10000,
          count: 106,
          estimated_paid_traffic_cost: 2500.0,
          is_new: 3,
          is_up: 15,
          is_down: 8,
          is_lost: 2,
        },
      },
    };

    const result = competitorsDomainItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe("competitor1.com");
      expect(result.data.avg_position).toBe(5.5);
      expect(result.data.intersections).toBe(100);
      expect(result.data.full_domain_metrics?.organic?.etv).toBe(5000.5);
    }
  });

  it("validates minimal item with only required domain field", () => {
    const minimalItem = {
      domain: "competitor2.com",
    };

    const result = competitorsDomainItemSchema.safeParse(minimalItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe("competitor2.com");
    }
  });

  it("rejects item without domain field", () => {
    const invalidItem = {
      avg_position: 8.2,
      intersections: 75,
    };

    const result = competitorsDomainItemSchema.safeParse(invalidItem);
    expect(result.success).toBe(false);
  });
});
