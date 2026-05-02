/**
 * WordPress Data Service
 * Phase 61-04: Platform Integration Excellence
 *
 * Fetches posts, pages, categories, and tags from WordPress REST API.
 * Supports Yoast SEO and RankMath SEO meta fields.
 */

export interface WPPost {
  id: number;
  title: string;
  slug: string;
  status: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
}

export interface WPPage {
  id: number;
  title: string;
  slug: string;
  template: string;
}

export interface WPCategory {
  id: number;
  name: string;
  count: number;
}

export interface WPTag {
  id: number;
  name: string;
  count: number;
}

export interface WordPressData {
  posts: WPPost[];
  pages: WPPage[];
  categories: WPCategory[];
  tags: WPTag[];
}

/**
 * WordPress data fetching service using Application Passwords.
 */
export class WordPressService {
  private readonly siteUrl: string;
  private readonly authHeader: string;

  constructor(
    siteUrl: string,
    credentials: { username: string; appPassword: string }
  ) {
    this.siteUrl = siteUrl.replace(/\/$/, "");
    this.authHeader = `Basic ${Buffer.from(
      `${credentials.username}:${credentials.appPassword}`
    ).toString("base64")}`;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.siteUrl}/wp-json${endpoint}`, {
      headers: { Authorization: this.authHeader },
    });

    if (!response.ok) {
      throw new Error(`WordPress API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getPosts(perPage: number = 100): Promise<WPPost[]> {
    const posts = await this.fetch<any[]>(
      `/wp/v2/posts?per_page=${perPage}&status=any`
    );

    return posts.map((post) => ({
      id: post.id,
      title: post.title.rendered,
      slug: post.slug,
      status: post.status,
      // Yoast/RankMath SEO fields if available
      seoTitle: post.yoast_head_json?.title ?? post.rank_math_title,
      seoDescription:
        post.yoast_head_json?.description ?? post.rank_math_description,
      focusKeyword:
        post.yoast_head_json?.focuskw ?? post.rank_math_focus_keyword,
    }));
  }

  async getPages(perPage: number = 100): Promise<WPPage[]> {
    const pages = await this.fetch<any[]>(`/wp/v2/pages?per_page=${perPage}`);

    return pages.map((page) => ({
      id: page.id,
      title: page.title.rendered,
      slug: page.slug,
      template: page.template || "default",
    }));
  }

  async getCategories(): Promise<WPCategory[]> {
    return this.fetch<WPCategory[]>("/wp/v2/categories?per_page=100");
  }

  async getTags(): Promise<WPTag[]> {
    return this.fetch<WPTag[]>("/wp/v2/tags?per_page=100");
  }

  async getAllData(): Promise<WordPressData> {
    const [posts, pages, categories, tags] = await Promise.all([
      this.getPosts(),
      this.getPages(),
      this.getCategories(),
      this.getTags(),
    ]);

    return { posts, pages, categories, tags };
  }
}
