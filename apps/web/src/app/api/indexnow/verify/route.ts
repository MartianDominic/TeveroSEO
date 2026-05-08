/**
 * IndexNow Key Verification API
 *
 * Verifies that an IndexNow key file is properly deployed and accessible.
 * Used by the manual instruction UI to confirm successful deployment.
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// Types
// ============================================================================

interface VerifyResponse {
  verified: boolean;
  url: string;
  content?: string;
  error?: string;
  details?: {
    statusCode?: number;
    contentType?: string;
    contentLength?: number;
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract expected API key from URL.
 * URL format: https://domain.com/{apiKey}.txt
 */
function extractExpectedKey(url: string): string | null {
  const match = url.match(/\/([a-f0-9-]+)\.txt$/i);
  return match ? match[1] : null;
}

/**
 * Validate that content matches expected key.
 * Content should be exactly the key, with optional whitespace trimmed.
 */
function validateContent(content: string, expectedKey: string): boolean {
  const trimmed = content.trim();
  return trimmed === expectedKey;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  // Validate URL parameter
  if (!url) {
    return NextResponse.json<VerifyResponse>(
      {
        verified: false,
        url: "",
        error: "Missing url parameter",
      },
      { status: 400 }
    );
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return NextResponse.json<VerifyResponse>(
      {
        verified: false,
        url,
        error: "Invalid URL format",
      },
      { status: 400 }
    );
  }

  // Extract expected key from URL
  const expectedKey = extractExpectedKey(url);
  if (!expectedKey) {
    return NextResponse.json<VerifyResponse>(
      {
        verified: false,
        url,
        error: "URL does not match IndexNow key file pattern ({key}.txt)",
      },
      { status: 400 }
    );
  }

  try {
    // Fetch the key file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "TeveroSEO-IndexNow-Verifier/1.0",
        Accept: "text/plain, */*",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    // Check HTTP status
    if (!response.ok) {
      return NextResponse.json<VerifyResponse>({
        verified: false,
        url,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: {
          statusCode: response.status,
        },
      });
    }

    // Read content
    const content = await response.text();
    const contentType = response.headers.get("content-type") || "";

    // Validate content
    const isValid = validateContent(content, expectedKey);

    if (!isValid) {
      // Provide helpful error based on what we found
      let errorMessage = "File content does not match expected key";

      if (content.includes("<html") || content.includes("<!DOCTYPE")) {
        errorMessage = "File returns HTML instead of plain text. Check server configuration.";
      } else if (content.trim().length === 0) {
        errorMessage = "File is empty";
      } else if (content.includes("\n") && content.split("\n").length > 1) {
        errorMessage = "File contains multiple lines. It should contain only the API key.";
      } else if (content.includes(" ")) {
        errorMessage = "File contains spaces. It should contain only the API key.";
      }

      return NextResponse.json<VerifyResponse>({
        verified: false,
        url,
        content: content.substring(0, 200), // Truncate for safety
        error: errorMessage,
        details: {
          statusCode: response.status,
          contentType,
          contentLength: content.length,
        },
      });
    }

    // Success
    return NextResponse.json<VerifyResponse>({
      verified: true,
      url,
      content: content.trim(),
      details: {
        statusCode: response.status,
        contentType,
        contentLength: content.length,
      },
    });
  } catch (err) {
    const error = err as Error;

    // Handle specific error types
    let errorMessage = "Failed to fetch key file";

    if (error.name === "AbortError") {
      errorMessage = "Request timed out. The server may be slow or unreachable.";
    } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
      errorMessage = "Domain not found. Check the URL.";
    } else if (error.message.includes("ECONNREFUSED")) {
      errorMessage = "Connection refused. The server may be down.";
    } else if (error.message.includes("certificate")) {
      errorMessage = "SSL certificate error. Check HTTPS configuration.";
    }

    return NextResponse.json<VerifyResponse>({
      verified: false,
      url,
      error: errorMessage,
    });
  }
}

// ============================================================================
// POST: Batch verification
// ============================================================================

interface BatchVerifyRequest {
  urls: string[];
}

interface BatchVerifyResult {
  url: string;
  verified: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  let body: BatchVerifyRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { urls } = body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "urls must be a non-empty array" },
      { status: 400 }
    );
  }

  if (urls.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 URLs per batch" },
      { status: 400 }
    );
  }

  // Verify all URLs in parallel
  const results = await Promise.all(
    urls.map(async (url): Promise<BatchVerifyResult> => {
      try {
        const expectedKey = extractExpectedKey(url);
        if (!expectedKey) {
          return { url, verified: false, error: "Invalid URL format" };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "TeveroSEO-IndexNow-Verifier/1.0",
            Accept: "text/plain, */*",
          },
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return { url, verified: false, error: `HTTP ${response.status}` };
        }

        const content = await response.text();
        const isValid = validateContent(content, expectedKey);

        return { url, verified: isValid, error: isValid ? undefined : "Content mismatch" };
      } catch (err) {
        return { url, verified: false, error: (err as Error).message };
      }
    })
  );

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      verified: results.filter((r) => r.verified).length,
      failed: results.filter((r) => !r.verified).length,
    },
  });
}
