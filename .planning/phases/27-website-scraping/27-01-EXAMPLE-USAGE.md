# DataForSEO Scraper - Example Usage

## Basic Usage

```typescript
import { scrapeProspectPage } from "@/server/lib/scraper";

// Scrape a prospect's website
const result = await scrapeProspectPage("https://example.com");

if (result.success) {
  console.log("Title:", result.page.title);
  console.log("Meta Description:", result.page.metaDescription);
  console.log("H1 Tags:", result.page.h1s);
  console.log("Word Count:", result.page.wordCount);
  console.log("Has Structured Data:", result.page.hasStructuredData);
  console.log("Cost:", `$${(result.costCents / 100).toFixed(4)}`);
} else {
  console.error("Scraping failed:", result.error);
  console.log("Cost (even on error):", `$${(result.costCents / 100).toFixed(4)}`);
}
```

## With Billing Context (Metered)

```typescript
import { createDataforseoClient } from "@/server/lib/dataforseoClient";

// Create metered client (tracks usage, deducts credits)
const client = createDataforseoClient({
  userId: "user_123",
  organizationId: "org_456",
  projectId: "proj_789",
});

// Fetch raw HTML (two-step API flow)
const rawHtml = await client.onPage.fetchRawHtml({
  url: "https://example.com",
});

console.log("HTML Length:", rawHtml.html.length);
console.log("Status Code:", rawHtml.statusCode);
console.log("Response Time:", rawHtml.responseTimeMs, "ms");
console.log("Redirect URL:", rawHtml.redirectUrl);
```

## Full PageAnalysis Fields

```typescript
interface PageAnalysis {
  // Basic Info
  url: string;
  statusCode: number;
  redirectUrl: string | null;
  responseTimeMs: number;

  // Head Metadata
  title: string;
  metaDescription: string;
  canonical: string | null;
  robotsMeta: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;

  // Headings
  h1s: string[];
  headingOrder: number[]; // e.g., [1, 2, 2, 3, 1] for heading hierarchy

  // Content
  wordCount: number;

  // Images
  images: Array<{ src: string | null; alt: string | null }>;

  // Links (normalized URLs)
  internalLinks: string[];
  externalLinks: string[];

  // Structured Data
  hasStructuredData: boolean;

  // Internationalization
  hreflangTags: string[];
}
```

## In a BullMQ Worker

```typescript
import { scrapeProspectPage } from "@/server/lib/scraper";
import { Worker } from "bullmq";

const worker = new Worker("prospect-analysis", async (job) => {
  const { prospectId, url } = job.data;

  // Step 1: Scrape the page
  const scrapeResult = await scrapeProspectPage(url);

  if (!scrapeResult.success) {
    throw new Error(`Scraping failed: ${scrapeResult.error}`);
  }

  // Step 2: Store in database
  await db.prospects.update(prospectId, {
    title: scrapeResult.page.title,
    metaDescription: scrapeResult.page.metaDescription,
    h1Count: scrapeResult.page.h1s.length,
    wordCount: scrapeResult.page.wordCount,
    hasStructuredData: scrapeResult.page.hasStructuredData,
    scrapeCostCents: scrapeResult.costCents,
    scrapedAt: new Date(),
  });

  return { prospectId, costCents: scrapeResult.costCents };
});
```

## Error Handling

```typescript
import { scrapeProspectPage } from "@/server/lib/scraper";

try {
  const result = await scrapeProspectPage(url);

  if (result.success) {
    // Process successful result
    processPageAnalysis(result.page);
  } else {
    // Handle scraping error (API error, network error, etc.)
    logError("Scraping failed", {
      url,
      error: result.error,
      costCents: result.costCents,
    });
  }
} catch (error) {
  // Handle unexpected errors (database errors, etc.)
  logError("Unexpected error", { url, error });
}
```

## Cost Tracking

```typescript
import { scrapeProspectPage } from "@/server/lib/scraper";

async function batchScrapeProspects(urls: string[]) {
  let totalCostCents = 0;
  const results = [];

  for (const url of urls) {
    const result = await scrapeProspectPage(url);
    totalCostCents += result.costCents;
    results.push(result);
  }

  console.log(`Scraped ${urls.length} pages`);
  console.log(`Total cost: $${(totalCostCents / 100).toFixed(2)}`);
  console.log(`Average cost per page: $${(totalCostCents / urls.length / 100).toFixed(4)}`);

  return results;
}
```

## Integration with Prospect Analysis

```typescript
import { scrapeProspectPage } from "@/server/lib/scraper";
import { createDataforseoClient } from "@/server/lib/dataforseoClient";

async function analyzeProspect(domain: string, customer: BillingCustomerContext) {
  const client = createDataforseoClient(customer);

  // 1. Scrape homepage
  const homepage = await scrapeProspectPage(`https://${domain}`);

  // 2. Get keywords they rank for
  const keywords = await client.prospect.keywordsForSite({
    target: domain,
    locationCode: 2840, // USA
    languageCode: "en",
    limit: 100,
  });

  // 3. Get competitors
  const competitors = await client.prospect.competitorsDomain({
    target: domain,
    locationCode: 2840,
    languageCode: "en",
    limit: 20,
  });

  if (!homepage.success) {
    throw new Error(`Failed to scrape homepage: ${homepage.error}`);
  }

  return {
    domain,
    homepage: homepage.page,
    keywords,
    competitors,
    totalCostCents: homepage.costCents,
  };
}
```

## Testing with Mock Data

```typescript
import { vi } from "vitest";
import { scrapeProspectPage } from "./dataforseoScraper";

// Mock fetch in tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

test("scrapes page successfully", async () => {
  // Mock content_parsing/live response
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: async () => JSON.stringify({
      status_code: 20000,
      tasks: [{
        status_code: 20000,
        path: ["v3", "on_page", "content_parsing", "live"],
        cost: 0.02,
        result_count: 1,
        result: [{ items: [{ id: "task-123" }] }],
      }],
    }),
  });

  // Mock raw_html response
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: async () => JSON.stringify({
      status_code: 20000,
      tasks: [{
        status_code: 20000,
        path: ["v3", "on_page", "raw_html"],
        cost: 0.0,
        result_count: 1,
        result: [{
          items: [{
            html: "<html><head><title>Test</title></head></html>",
            status_code: 200,
            page_timing: { time_to_interactive: 1000 },
            redirect_url: null,
          }],
        }],
      }],
    }),
  });

  const result = await scrapeProspectPage("https://example.com");

  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.page.title).toBe("Test");
    expect(result.costCents).toBe(2.0);
  }
});
```
