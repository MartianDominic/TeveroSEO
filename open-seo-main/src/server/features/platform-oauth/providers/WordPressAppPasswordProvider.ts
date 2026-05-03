/**
 * WordPress Application Password Provider
 * Phase 61-04: Platform Integration Excellence
 *
 * Validates WordPress Application Passwords via REST API.
 * WordPress 5.6+ supports Application Passwords for Basic Auth.
 *
 * @see https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/
 */

export interface WordPressCredentials {
  username: string;
  appPassword: string;
}

export interface WordPressUserInfo {
  id: number;
  name: string;
  slug: string;
  roles: string[];
}

export interface WordPressSiteInfo {
  name: string;
  description: string;
  url: string;
  home: string;
}

export interface ValidationResult {
  valid: boolean;
  user?: WordPressUserInfo;
  error?: string;
}

/**
 * WordPress Application Password provider for credential validation.
 * Uses /wp-json/wp/v2/users/me endpoint per DESIGN.md D-14.
 */
export class WordPressAppPasswordProvider {
  private readonly siteUrl: string;

  constructor(siteUrl: string) {
    // Normalize site URL (remove trailing slash)
    this.siteUrl = siteUrl.replace(/\/$/, "");
  }

  /**
   * Build Basic auth header from credentials.
   * WordPress Application Passwords use standard HTTP Basic Auth.
   */
  private buildAuthHeader(credentials: WordPressCredentials): string {
    const encoded = Buffer.from(
      `${credentials.username}:${credentials.appPassword}`
    ).toString("base64");
    return `Basic ${encoded}`;
  }

  /**
   * Validate credentials by calling /wp-json/wp/v2/users/me
   * per DESIGN.md D-14.
   */
  async validateCredentials(
    credentials: WordPressCredentials
  ): Promise<ValidationResult> {
    try {
      const response = await fetch(
        `${this.siteUrl}/wp-json/wp/v2/users/me`,
        {
          headers: {
            Authorization: this.buildAuthHeader(credentials),
          },
        }
      );

      if (response.status === 401) {
        return { valid: false, error: "Invalid username or application password" };
      }

      if (response.status === 403) {
        return { valid: false, error: "Insufficient permissions" };
      }

      if (!response.ok) {
        return {
          valid: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const user = await response.json() as {
        id: number;
        name: string;
        slug: string;
        roles?: string[];
      };
      return {
        valid: true,
        user: {
          id: user.id,
          name: user.name,
          slug: user.slug,
          roles: user.roles ?? [],
        },
      };
    } catch (error) {
      // Network error or invalid URL
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Get site info (no auth required for public endpoint).
   */
  async getSiteInfo(): Promise<WordPressSiteInfo | null> {
    try {
      const response = await fetch(`${this.siteUrl}/wp-json`);
      if (!response.ok) return null;

      const data = await response.json() as {
        name: string;
        description: string;
        url: string;
        home: string;
      };
      return {
        name: data.name,
        description: data.description,
        url: data.url,
        home: data.home,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if site has WordPress REST API available.
   */
  async isWordPressSite(): Promise<boolean> {
    try {
      const response = await fetch(`${this.siteUrl}/wp-json`, {
        method: "HEAD",
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
