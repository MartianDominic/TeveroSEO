/**
 * Shopify Data Service
 * Phase 61-03: Platform Integration Excellence
 *
 * Fetches products, collections, pages, and redirects from Shopify Admin API.
 * Uses GraphQL for products and REST for legacy endpoints.
 */

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  seoTitle: string;
  seoDescription: string;
  status: string;
}

export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
}

export interface ShopifyPage {
  id: string;
  title: string;
  handle: string;
}

export interface ShopifyRedirect {
  path: string;
  target: string;
}

export interface ShopifyData {
  products: ShopifyProduct[];
  collections: ShopifyCollection[];
  pages: ShopifyPage[];
  redirects: ShopifyRedirect[];
}

/**
 * Shopify data service for fetching SEO-relevant data.
 */
export class ShopifyService {
  private readonly shop: string;
  private readonly accessToken: string;
  private readonly apiVersion = "2024-01";

  constructor(shop: string, accessToken: string) {
    this.shop = shop;
    this.accessToken = accessToken;
  }

  /**
   * Execute a GraphQL query against Shopify Admin API.
   */
  private async graphql<T>(query: string): Promise<T> {
    const response = await fetch(
      `https://${this.shop}/admin/api/${this.apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.accessToken,
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.errors && result.errors.length > 0) {
      throw new Error(`Shopify GraphQL error: ${result.errors[0].message}`);
    }
    return result.data;
  }

  /**
   * Execute a REST API call against Shopify Admin API.
   */
  private async rest<T>(endpoint: string): Promise<T> {
    const response = await fetch(
      `https://${this.shop}/admin/api/${this.apiVersion}/${endpoint}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.accessToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get products with SEO metadata.
   */
  async getProducts(first: number = 50): Promise<ShopifyProduct[]> {
    const query = `{
      products(first: ${first}) {
        edges {
          node {
            id
            title
            handle
            status
            seo {
              title
              description
            }
          }
        }
      }
    }`;

    const data = await this.graphql<{
      products: { edges: Array<{ node: Record<string, unknown> }> };
    }>(query);

    return data.products.edges.map((edge) => ({
      id: edge.node.id as string,
      title: edge.node.title as string,
      handle: edge.node.handle as string,
      status: edge.node.status as string,
      seoTitle: (edge.node.seo as { title?: string })?.title || "",
      seoDescription:
        (edge.node.seo as { description?: string })?.description || "",
    }));
  }

  /**
   * Get collections.
   */
  async getCollections(first: number = 50): Promise<ShopifyCollection[]> {
    const query = `{
      collections(first: ${first}) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }`;

    const data = await this.graphql<{
      collections: { edges: Array<{ node: ShopifyCollection }> };
    }>(query);

    return data.collections.edges.map((edge) => edge.node);
  }

  /**
   * Get pages via REST API.
   */
  async getPages(): Promise<ShopifyPage[]> {
    const data = await this.rest<{ pages: ShopifyPage[] }>("pages.json");
    return data.pages.map((p) => ({
      id: String(p.id),
      title: p.title,
      handle: p.handle,
    }));
  }

  /**
   * Get URL redirects via REST API.
   */
  async getRedirects(): Promise<ShopifyRedirect[]> {
    const data = await this.rest<{
      redirects: Array<{ path: string; target: string }>;
    }>("redirects.json");
    return data.redirects;
  }

  /**
   * Get all SEO-relevant data.
   */
  async getAllData(): Promise<ShopifyData> {
    const [products, collections, pages, redirects] = await Promise.all([
      this.getProducts(),
      this.getCollections(),
      this.getPages(),
      this.getRedirects(),
    ]);

    return { products, collections, pages, redirects };
  }
}
