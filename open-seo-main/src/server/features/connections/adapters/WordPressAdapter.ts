/**
 * WordPress Platform Adapter
 * Phase 31-03: Platform Adapters
 *
 * Implements PlatformAdapter interface for WordPress REST API v2.
 * Uses Application Password authentication (Basic Auth).
 *
 * WordPress REST API docs: https://developer.wordpress.org/rest-api/
 * Application Passwords: https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/
 */
import type {
  PlatformAdapter,
  PlatformWriteAdapter,
  WriteResult,
  CapabilityResult,
  WordPressAdapterConfig,
} from "./BaseAdapter";

// ============================================================================
// WordPress API Types
// ============================================================================

/**
 * WordPress user object from /users/me endpoint.
 */
interface WPUser {
  id: number;
  name: string;
  capabilities: Record<string, boolean>;
}

/**
 * WordPress post object from REST API.
 * Using raw mode (context=edit) returns raw field values.
 */
export interface WPPost {
  id: number;
  title: { rendered: string; raw?: string };
  content: { rendered: string; raw?: string };
  excerpt: { rendered: string; raw?: string };
  status: string;
  slug: string;
  meta?: Record<string, unknown>;
}

/**
 * Input data for updating a WordPress post.
 * Uses string values which WordPress API converts internally.
 */
export interface WPPostUpdateInput {
  title?: string;
  content?: string;
  excerpt?: string;
  meta?: Record<string, unknown>;
}

// ============================================================================
// WordPress Adapter Implementation
// ============================================================================

/**
 * WordPress platform adapter using REST API v2.
 *
 * Authentication: Basic Auth with username:appPassword.
 * Base URL: {siteUrl}/wp-json/wp/v2
 *
 * @example
 * ```typescript
 * const adapter = new WordPressAdapter({
 *   siteUrl: 'https://example.com',
 *   username: 'admin',
 *   appPassword: 'abcd 1234 efgh 5678',
 * });
 *
 * const result = await adapter.verifyConnection();
 * if (result.connected) {
 *   const post = await adapter.getPost(123);
 * }
 * ```
 */
export class WordPressAdapter implements PlatformWriteAdapter {
  readonly platform = "wordpress" as const;
  readonly siteUrl: string;
  private baseUrl: string;
  private auth: string;

  /**
   * Field mapping from generic field names to WordPress REST API fields.
   */
  private readonly FIELD_MAP: Record<string, string> = {
    'title': 'title',
    'meta_title': 'yoast_meta.yoast_wpseo_title',
    'meta_description': 'yoast_meta.yoast_wpseo_metadesc',
    'og_title': 'yoast_meta.yoast_wpseo_opengraph-title',
    'og_description': 'yoast_meta.yoast_wpseo_opengraph-description',
    'canonical': 'yoast_meta.yoast_wpseo_canonical',
    'h1': 'title', // H1 often mirrors post title in WP
    'alt_text': 'alt_text',
    'excerpt': 'excerpt',
  };

  constructor(config: WordPressAdapterConfig) {
    // Normalize URL - remove trailing slash
    this.siteUrl = config.siteUrl.replace(/\/$/, "");
    this.baseUrl = `${this.siteUrl}/wp-json/wp/v2`;

    // Pre-compute Basic Auth header value
    this.auth = Buffer.from(
      `${config.username}:${config.appPassword}`
    ).toString("base64");
  }

  /**
   * Make an authenticated request to the WordPress REST API.
   * Uses 30 second timeout to prevent hanging requests.
   *
   * @param endpoint - API endpoint (e.g., '/posts/123')
   * @param options - Fetch options
   * @returns Parsed JSON response
   * @throws Error if response is not OK or times out
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Basic ${this.auth}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`WordPress API error ${res.status}: ${error}`);
      }

      return res.json();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error(`WordPress API timeout after 30s: ${endpoint}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Verify connection is valid and detect capabilities.
   * Calls /users/me to check authentication and read user capabilities.
   *
   * @returns CapabilityResult with connected status and detected capabilities
   */
  async verifyConnection(): Promise<CapabilityResult> {
    try {
      const user = await this.request<WPUser>("/users/me");

      return {
        connected: true,
        capabilities: {
          // If authenticated, user can read (public endpoints)
          canReadPosts: true,
          canWritePosts: user.capabilities?.edit_posts ?? false,
          canReadPages: true,
          canWritePages: user.capabilities?.edit_pages ?? false,
          canReadMedia: true,
          canWriteMedia: user.capabilities?.upload_files ?? false,
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
   * Test if the user has write permission for posts.
   * Relies on verifyConnection capabilities check.
   *
   * @returns true if user can write posts
   */
  async testWritePermission(): Promise<boolean> {
    const result = await this.verifyConnection();
    return result.connected && (result.capabilities?.canWritePosts ?? false);
  }

  /**
   * Get a single post by ID with raw content (context=edit).
   *
   * @param postId - WordPress post ID
   * @returns Post object with raw content fields
   */
  async getPost(postId: number): Promise<WPPost> {
    return this.request<WPPost>(`/posts/${postId}?context=edit`);
  }

  /**
   * Update a post by ID.
   * Uses POST method (not PUT) as per WordPress REST API conventions.
   *
   * @param postId - WordPress post ID
   * @param data - Fields to update (title, content, excerpt, meta, etc.)
   * @returns Updated post object
   */
  async updatePost(
    postId: number,
    data: WPPostUpdateInput
  ): Promise<WPPost> {
    return this.request<WPPost>(`/posts/${postId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Get paginated list of posts.
   *
   * @param params - Pagination and filter params
   * @returns Array of posts
   */
  async getPosts(params?: {
    page?: number;
    per_page?: number;
    status?: string;
  }): Promise<WPPost[]> {
    const query = new URLSearchParams();

    if (params?.page) query.set("page", String(params.page));
    if (params?.per_page) query.set("per_page", String(params.per_page));
    if (params?.status) query.set("status", params.status);
    query.set("context", "edit");

    return this.request<WPPost[]>(`/posts?${query.toString()}`);
  }

  // ============================================================================
  // PlatformWriteAdapter Implementation (Phase 33-03)
  // ============================================================================

  /**
   * Read a specific field from a WordPress post.
   */
  async readField(resourceId: string, field: string): Promise<string | null> {
    const postId = parseInt(resourceId, 10);
    if (isNaN(postId)) {
      return null;
    }

    try {
      const post = await this.getPost(postId);

      // Handle nested fields (e.g., 'yoast_meta.yoast_wpseo_title')
      const wpField = this.FIELD_MAP[field] || field;
      const parts = wpField.split('.');

      let value: unknown = post;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          return null;
        }
      }

      // Handle WordPress's { rendered, raw } structure
      if (value && typeof value === 'object' && 'raw' in (value as object)) {
        return (value as { raw: string }).raw;
      }

      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }

  /**
   * Write a value to a specific field on a WordPress post.
   */
  async writeField(resourceId: string, field: string, value: string): Promise<WriteResult> {
    const postId = parseInt(resourceId, 10);
    if (isNaN(postId)) {
      return { success: false, error: 'Invalid resource ID' };
    }

    try {
      const wpField = this.FIELD_MAP[field] || field;

      // Build update payload based on field type
      let payload: Record<string, unknown> = {};

      if (wpField.startsWith('yoast_meta.')) {
        // Yoast SEO meta fields
        const yoastField = wpField.replace('yoast_meta.', '');
        payload = { meta: { [yoastField]: value } };
      } else if (field === 'title' || field === 'h1') {
        payload = { title: value };
      } else if (field === 'excerpt') {
        payload = { excerpt: value };
      } else {
        // Generic meta field
        payload = { meta: { [wpField]: value } };
      }

      await this.request(`/posts/${postId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update multiple meta fields at once on a WordPress post.
   */
  async updateMeta(resourceId: string, meta: Record<string, string>): Promise<WriteResult> {
    const postId = parseInt(resourceId, 10);
    if (isNaN(postId)) {
      return { success: false, error: 'Invalid resource ID' };
    }

    try {
      // Build combined payload
      const wpMeta: Record<string, string> = {};
      let directFields: Record<string, string> = {};

      for (const [field, value] of Object.entries(meta)) {
        const wpField = this.FIELD_MAP[field] || field;

        if (wpField.startsWith('yoast_meta.')) {
          wpMeta[wpField.replace('yoast_meta.', '')] = value;
        } else if (field === 'title' || field === 'h1') {
          directFields['title'] = value;
        } else if (field === 'excerpt') {
          directFields['excerpt'] = value;
        } else {
          wpMeta[wpField] = value;
        }
      }

      const payload = {
        ...directFields,
        ...(Object.keys(wpMeta).length > 0 ? { meta: wpMeta } : {}),
      };

      await this.request(`/posts/${postId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update image alt text in WordPress media library.
   */
  async updateImageAlt(imageId: string, alt: string): Promise<WriteResult> {
    const attachmentId = parseInt(imageId, 10);
    if (isNaN(attachmentId)) {
      return { success: false, error: 'Invalid image ID' };
    }

    try {
      await this.request(`/media/${attachmentId}`, {
        method: 'POST',
        body: JSON.stringify({ alt_text: alt }),
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update image attributes (WordPress doesn't support this via REST API directly).
   * For dimensions and lazy loading, these need to be handled in the content HTML.
   */
  async updateImageAttributes(imageId: string, attributes: Record<string, string>): Promise<WriteResult> {
    // WordPress doesn't support width/height/loading attributes via media API
    // These would need to be set in the post content HTML
    // For now, return not supported
    return {
      success: false,
      error: 'Image attribute updates must be done via content HTML in WordPress'
    };
  }
}
