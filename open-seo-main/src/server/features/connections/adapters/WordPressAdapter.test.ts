/**
 * WordPress Adapter Tests
 * Phase 31-03: Platform Adapters
 *
 * Tests WordPress REST API integration with mocked fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WordPressAdapter } from "./WordPressAdapter";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("WordPressAdapter", () => {
  const config = {
    siteUrl: "https://example.com",
    username: "admin",
    appPassword: "abcd 1234 efgh 5678",
  };

  let adapter: WordPressAdapter;

  beforeEach(() => {
    adapter = new WordPressAdapter(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should set platform to wordpress", () => {
      expect(adapter.platform).toBe("wordpress");
    });

    it("should normalize siteUrl by removing trailing slash", () => {
      const adapterWithSlash = new WordPressAdapter({
        ...config,
        siteUrl: "https://example.com/",
      });
      expect(adapterWithSlash.siteUrl).toBe("https://example.com");
    });
  });

  describe("verifyConnection", () => {
    it("should return connected=true with correct capabilities for admin user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          name: "Admin User",
          capabilities: {
            edit_posts: true,
            edit_pages: true,
            upload_files: true,
          },
        }),
      });

      const result = await adapter.verifyConnection();

      expect(result.connected).toBe(true);
      expect(result.capabilities).toEqual({
        canReadPosts: true,
        canWritePosts: true,
        canReadPages: true,
        canWritePages: true,
        canReadMedia: true,
        canWriteMedia: true,
      });
    });

    it("should return connected=false for invalid credentials (401)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const result = await adapter.verifyConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toContain("401");
    });

    it("should detect limited capabilities for contributor user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 2,
          name: "Contributor",
          capabilities: {
            edit_posts: true,
            edit_pages: false,
            upload_files: false,
          },
        }),
      });

      const result = await adapter.verifyConnection();

      expect(result.connected).toBe(true);
      expect(result.capabilities?.canWritePosts).toBe(true);
      expect(result.capabilities?.canWritePages).toBe(false);
      expect(result.capabilities?.canWriteMedia).toBe(false);
    });
  });

  describe("testWritePermission", () => {
    it("should return true when user has edit_posts capability", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          capabilities: { edit_posts: true },
        }),
      });

      const result = await adapter.testWritePermission();

      expect(result).toBe(true);
    });

    it("should return false when user lacks edit_posts capability", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          capabilities: { edit_posts: false },
        }),
      });

      const result = await adapter.testWritePermission();

      expect(result).toBe(false);
    });
  });

  describe("getPost", () => {
    it("should fetch post with ?context=edit for full content", async () => {
      const mockPost = {
        id: 123,
        title: { rendered: "Test Post", raw: "Test Post" },
        content: { rendered: "<p>Content</p>", raw: "Content" },
        excerpt: { rendered: "", raw: "" },
        status: "publish",
        slug: "test-post",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPost,
      });

      const post = await adapter.getPost(123);

      expect(post).toEqual(mockPost);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/wp-json/wp/v2/posts/123?context=edit",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic "),
          }),
        })
      );
    });
  });

  describe("updatePost", () => {
    it("should send POST to /posts/{id} with JSON body", async () => {
      const mockUpdatedPost = {
        id: 123,
        title: { rendered: "Updated Title", raw: "Updated Title" },
        content: { rendered: "<p>Updated</p>", raw: "Updated" },
        excerpt: { rendered: "", raw: "" },
        status: "publish",
        slug: "test-post",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatedPost,
      });

      const post = await adapter.updatePost(123, {
        title: "Updated Title",
        content: "Updated",
      });

      expect(post).toEqual(mockUpdatedPost);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/wp-json/wp/v2/posts/123",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Updated Title", content: "Updated" }),
        })
      );
    });
  });

  describe("getPosts", () => {
    it("should fetch paginated posts with query params", async () => {
      const mockPosts = [
        { id: 1, title: { rendered: "Post 1" } },
        { id: 2, title: { rendered: "Post 2" } },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPosts,
      });

      const posts = await adapter.getPosts({ page: 2, per_page: 10, status: "draft" });

      expect(posts).toEqual(mockPosts);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("page=2"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("per_page=10"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("status=draft"),
        expect.any(Object)
      );
    });
  });

  describe("auth header encoding", () => {
    it("should use correct Base64 encoding of username:appPassword", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, capabilities: {} }),
      });

      await adapter.verifyConnection();

      const expectedAuth = Buffer.from(`${config.username}:${config.appPassword}`).toString("base64");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${expectedAuth}`,
          }),
        })
      );
    });
  });
});
