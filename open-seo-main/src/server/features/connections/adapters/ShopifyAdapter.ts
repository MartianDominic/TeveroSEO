/**
 * Shopify Platform Adapter
 * Phase 31-03: Platform Adapters
 *
 * Implements PlatformAdapter interface for Shopify Admin GraphQL API.
 * Uses Admin API access token authentication.
 *
 * Shopify Admin API docs: https://shopify.dev/docs/api/admin-graphql
 * Rate limiting: https://shopify.dev/docs/api/usage/rate-limits
 */
import type {
  PlatformAdapter,
  PlatformWriteAdapter,
  WriteResult,
  CapabilityResult,
  ShopifyAdapterConfig,
} from "./BaseAdapter";

// ============================================================================
// Shopify GraphQL Types
// ============================================================================

/**
 * Shopify product object from GraphQL API.
 */
export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  seo: {
    title: string | null;
    description: string | null;
  };
}

/**
 * Generic GraphQL response envelope.
 */
interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * User error from Shopify mutations.
 */
interface UserError {
  field: string[];
  message: string;
}

// ============================================================================
// Shopify Adapter Implementation
// ============================================================================

/**
 * Shopify platform adapter using Admin GraphQL API.
 *
 * Authentication: X-Shopify-Access-Token header.
 * Endpoint: https://{shopDomain}/admin/api/{version}/graphql.json
 *
 * @example
 * ```typescript
 * const adapter = new ShopifyAdapter({
 *   shopDomain: 'mystore.myshopify.com',
 *   accessToken: 'shpat_xxxxxxxxxxxxx',
 * });
 *
 * const result = await adapter.verifyConnection();
 * if (result.connected) {
 *   const product = await adapter.getProduct('gid://shopify/Product/123');
 * }
 * ```
 */
export class ShopifyAdapter implements PlatformWriteAdapter {
  readonly platform = "shopify" as const;
  readonly siteUrl: string;
  private shopDomain: string;
  private accessToken: string;
  private apiVersion: string;

  /**
   * Field mapping for Shopify resources.
   */
  private readonly FIELD_MAP: Record<string, { type: 'seo' | 'metafield'; key: string }> = {
    'title': { type: 'seo', key: 'title' },
    'meta_title': { type: 'seo', key: 'title' },
    'meta_description': { type: 'seo', key: 'description' },
    'handle': { type: 'seo', key: 'handle' },
    'alt_text': { type: 'metafield', key: 'alt' },
  };

  constructor(config: ShopifyAdapterConfig) {
    this.shopDomain = config.shopDomain;
    this.siteUrl = `https://${config.shopDomain}`;
    this.accessToken = config.accessToken;
    // Default to current stable API version
    this.apiVersion = config.apiVersion ?? "2026-04";
  }

  /**
   * Execute a GraphQL query or mutation against the Shopify Admin API.
   * Uses 30 second timeout to prevent hanging requests.
   *
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @returns Typed response data
   * @throws Error on HTTP, GraphQL, or timeout errors
   */
  private async graphql<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const res = await fetch(
        `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": this.accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        throw new Error(`Shopify API error ${res.status}: ${await res.text()}`);
      }

      const json: GraphQLResponse<T> = await res.json();

      if (json.errors?.length) {
        throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
      }

      return json.data!;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error("Shopify API timeout after 30s");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Verify connection is valid by querying shop info.
   * Assumes write_products scope if connected (OAuth tokens either have it or don't).
   *
   * @returns CapabilityResult with connected status and detected capabilities
   */
  async verifyConnection(): Promise<CapabilityResult> {
    try {
      const query = `
        query ShopInfo {
          shop {
            name
            primaryDomain {
              url
            }
          }
        }
      `;

      await this.graphql<{ shop: { name: string } }>(query);

      return {
        connected: true,
        capabilities: {
          canReadProducts: true,
          canWriteProducts: true, // Assumes write_products scope
          canReadSeo: true,
          canWriteSeo: true,
        },
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Test if the adapter has write permission.
   * For Shopify OAuth tokens, either have write scope or they don't.
   * We trust the scope was granted during OAuth flow.
   *
   * @returns true if connection is valid (implies write access)
   */
  async testWritePermission(): Promise<boolean> {
    const result = await this.verifyConnection();
    return result.connected;
  }

  /**
   * Get a product by ID with SEO fields.
   *
   * @param id - Shopify product GID (e.g., 'gid://shopify/Product/123')
   * @returns Product with SEO information
   */
  async getProduct(id: string): Promise<ShopifyProduct> {
    const query = `
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          seo {
            title
            description
          }
        }
      }
    `;

    const data = await this.graphql<{ product: ShopifyProduct }>(query, { id });
    return data.product;
  }

  /**
   * Update product SEO fields.
   *
   * @param id - Shopify product GID
   * @param seo - SEO fields to update (title, description)
   * @returns Updated product
   * @throws Error on userErrors from Shopify
   */
  async updateProductSeo(
    id: string,
    seo: { title?: string; description?: string }
  ): Promise<ShopifyProduct> {
    const mutation = `
      mutation UpdateProductSeo($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            handle
            seo {
              title
              description
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await this.graphql<{
      productUpdate: {
        product: ShopifyProduct;
        userErrors: UserError[];
      };
    }>(mutation, {
      input: { id, seo },
    });

    if (data.productUpdate.userErrors.length) {
      throw new Error(data.productUpdate.userErrors[0].message);
    }

    return data.productUpdate.product;
  }

  // ============================================================================
  // PlatformWriteAdapter Implementation (Phase 33-03)
  // ============================================================================

  /**
   * Parse Shopify resource ID to determine type and GID.
   * Expects format: "product/123" or "page/456" or "collection/789"
   */
  private parseResourceId(resourceId: string): { type: string; gid: string } {
    const [type, id] = resourceId.split('/');
    if (!type || !id) {
      throw new Error(`Invalid resource ID format: ${resourceId}. Expected 'type/id'`);
    }

    const gidMap: Record<string, string> = {
      'product': 'Product',
      'page': 'OnlineStorePage',
      'collection': 'Collection',
      'image': 'MediaImage',
    };

    const gidType = gidMap[type] || type;
    return { type, gid: `gid://shopify/${gidType}/${id}` };
  }

  async readField(resourceId: string, field: string): Promise<string | null> {
    const { type, gid } = this.parseResourceId(resourceId);
    const mapping = this.FIELD_MAP[field];

    try {
      if (type === 'product') {
        const query = `
          query getProduct($id: ID!) {
            product(id: $id) {
              title
              handle
              seo { title description }
            }
          }
        `;
        const data = await this.graphql<{ product: { title: string; handle: string; seo: { title: string; description: string } } }>(
          query,
          { id: gid }
        );

        if (!data.product) return null;

        if (mapping?.type === 'seo') {
          return data.product.seo?.[mapping.key as keyof typeof data.product.seo] || null;
        }
        if (field === 'title') return data.product.title;
        if (field === 'handle') return data.product.handle;
      }

      // Similar patterns for page and collection...
      return null;
    } catch {
      return null;
    }
  }

  async writeField(resourceId: string, field: string, value: string): Promise<WriteResult> {
    const { type, gid } = this.parseResourceId(resourceId);

    try {
      if (type === 'product') {
        const mutation = `
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id }
              userErrors { field message }
            }
          }
        `;

        let input: Record<string, unknown> = { id: gid };

        if (field === 'title' || field === 'meta_title') {
          input.seo = { title: value };
        } else if (field === 'meta_description') {
          input.seo = { description: value };
        } else if (field === 'handle') {
          input.handle = value;
        }

        const data = await this.graphql<{
          productUpdate: { userErrors: { field: string; message: string }[] }
        }>(mutation, { input });

        if (data.productUpdate.userErrors.length > 0) {
          return {
            success: false,
            error: data.productUpdate.userErrors.map(e => e.message).join(', '),
          };
        }

        return { success: true };
      }

      // Page updates
      if (type === 'page') {
        const mutation = `
          mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
            pageUpdate(id: $id, page: $page) {
              page { id }
              userErrors { field message }
            }
          }
        `;

        let page: Record<string, unknown> = {};
        if (field === 'title' || field === 'meta_title') {
          page.seo = { title: value };
        } else if (field === 'meta_description') {
          page.seo = { description: value };
        }

        const data = await this.graphql<{
          pageUpdate: { userErrors: { field: string; message: string }[] }
        }>(mutation, { id: gid, page });

        if (data.pageUpdate.userErrors.length > 0) {
          return {
            success: false,
            error: data.pageUpdate.userErrors.map(e => e.message).join(', '),
          };
        }

        return { success: true };
      }

      return { success: false, error: `Unsupported resource type: ${type}` };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async updateMeta(resourceId: string, meta: Record<string, string>): Promise<WriteResult> {
    // For Shopify, bulk updates are done via the same mutation with combined input
    const { type, gid } = this.parseResourceId(resourceId);

    try {
      if (type === 'product') {
        const seo: Record<string, string> = {};
        let handle: string | undefined;

        for (const [field, value] of Object.entries(meta)) {
          if (field === 'title' || field === 'meta_title') {
            seo.title = value;
          } else if (field === 'meta_description') {
            seo.description = value;
          } else if (field === 'handle') {
            handle = value;
          }
        }

        const mutation = `
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id }
              userErrors { field message }
            }
          }
        `;

        const input: Record<string, unknown> = { id: gid };
        if (Object.keys(seo).length > 0) input.seo = seo;
        if (handle) input.handle = handle;

        const data = await this.graphql<{
          productUpdate: { userErrors: { field: string; message: string }[] }
        }>(mutation, { input });

        if (data.productUpdate.userErrors.length > 0) {
          return {
            success: false,
            error: data.productUpdate.userErrors.map(e => e.message).join(', '),
          };
        }

        return { success: true };
      }

      return { success: false, error: `Bulk meta update not supported for ${type}` };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async updateImageAlt(imageId: string, alt: string): Promise<WriteResult> {
    try {
      // Shopify image alt is updated via productImageUpdate or fileUpdate mutation
      const mutation = `
        mutation fileUpdate($input: [FileUpdateInput!]!) {
          fileUpdate(files: $input) {
            files { id alt }
            userErrors { field message }
          }
        }
      `;

      const data = await this.graphql<{
        fileUpdate: { userErrors: { field: string; message: string }[] }
      }>(mutation, {
        input: [{ id: `gid://shopify/MediaImage/${imageId}`, alt }],
      });

      if (data.fileUpdate.userErrors.length > 0) {
        return {
          success: false,
          error: data.fileUpdate.userErrors.map(e => e.message).join(', '),
        };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async updateImageAttributes(imageId: string, _attributes: Record<string, string>): Promise<WriteResult> {
    // Shopify doesn't support setting width/height/loading via API
    // These are determined by the image itself or theme settings
    return {
      success: false,
      error: 'Image dimension attributes are controlled by Shopify themes',
    };
  }
}
