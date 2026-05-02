/**
 * Wix Data Service
 * Phase 61-03: Platform Integration Excellence
 *
 * Fetches site info, pages, and blog posts from Wix APIs.
 */

export interface WixSiteInfo {
  siteDisplayName: string;
  siteUrl: string;
}

export interface WixPage {
  id: string;
  title: string;
  url: string;
}

export interface WixBlogPost {
  id: string;
  title: string;
  slug: string;
}

export interface WixData {
  site: WixSiteInfo;
  pages: WixPage[];
  blogPosts: WixBlogPost[];
}

/**
 * Wix data service for fetching SEO-relevant data.
 */
export class WixService {
  private readonly accessToken: string;
  private readonly baseUrl = "https://www.wixapis.com";

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Execute an API call against Wix REST API.
   */
  private async api<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Wix API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get site information.
   */
  async getSiteInfo(): Promise<WixSiteInfo> {
    const data = await this.api<{
      site: { siteDisplayName: string; url: string };
    }>("/site-properties/v4/properties");

    return {
      siteDisplayName: data.site.siteDisplayName,
      siteUrl: data.site.url,
    };
  }

  /**
   * Get site pages.
   */
  async getPages(): Promise<WixPage[]> {
    const data = await this.api<{
      pages: Array<{ id: string; title: string; url: string }>;
    }>("/site-pages/v2/pages");

    return data.pages.map((p) => ({
      id: p.id,
      title: p.title,
      url: p.url,
    }));
  }

  /**
   * Get blog posts.
   */
  async getBlogPosts(): Promise<WixBlogPost[]> {
    const data = await this.api<{
      posts: Array<{ id: string; title: string; slug: string }>;
    }>("/blog/v3/posts");

    return data.posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
    }));
  }

  /**
   * Get all SEO-relevant data.
   */
  async getAllData(): Promise<WixData> {
    const [site, pages, blogPosts] = await Promise.all([
      this.getSiteInfo(),
      this.getPages(),
      this.getBlogPosts(),
    ]);

    return { site, pages, blogPosts };
  }
}
