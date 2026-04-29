"use server";

/**
 * Server action to test CMS connection.
 * Phase 41-04: CMS Integration Polish
 */

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { postFastApi } from "@/lib/server-fetch";
import { connectionTestLimiter, checkRateLimit } from "@/lib/rate-limit";

export type CmsPlatform = "wordpress" | "shopify" | "wix" | "webhook";

// Validation schemas
const clientIdSchema = z.string().uuid("Invalid client ID format");

const cmsPlatformSchema = z.enum(["wordpress", "shopify", "wix", "webhook"]);

// Platform-specific credential schemas
const wordpressCredentialsSchema = z.object({
  siteUrl: z.string().url("Invalid WordPress site URL"),
  username: z.string().min(1, "Username is required").max(100),
  applicationPassword: z.string().min(1, "Application password is required").max(200),
});

const shopifyCredentialsSchema = z.object({
  storeDomain: z.string().min(1, "Store domain is required").max(100),
  accessToken: z.string().min(1, "Access token is required").max(200),
});

const wixCredentialsSchema = z.object({
  siteId: z.string().min(1, "Site ID is required").max(100),
  apiKey: z.string().min(1, "API key is required").max(200),
});

const webhookCredentialsSchema = z.object({
  webhookUrl: z.string().url("Invalid webhook URL"),
  secret: z.string().max(200).optional(),
});

// Discriminated union for platform-specific validation
const testConnectionParamsSchema = z.discriminatedUnion("platform", [
  z.object({
    platform: z.literal("wordpress"),
    credentials: wordpressCredentialsSchema,
  }),
  z.object({
    platform: z.literal("shopify"),
    credentials: shopifyCredentialsSchema,
  }),
  z.object({
    platform: z.literal("wix"),
    credentials: wixCredentialsSchema,
  }),
  z.object({
    platform: z.literal("webhook"),
    credentials: webhookCredentialsSchema,
  }),
]);

interface TestConnectionParams {
  platform: CmsPlatform;
  credentials: Record<string, string>;
}

interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Test CMS connection with the provided credentials.
 * @param clientId - The client ID to test connection for
 * @param params - Platform and credentials to test
 * @returns Test result with success status and message
 */
export async function testCmsConnection(
  clientId: string,
  params: TestConnectionParams
): Promise<TestConnectionResult> {
  try {
    const validatedClientId = clientIdSchema.parse(clientId);
    const validatedParams = testConnectionParamsSchema.parse(params);

    const auth = await requireActionAuth();
    await validateClientOwnership(validatedClientId, auth);

    // Rate limit: 10 tests per minute (prevents SSRF abuse)
    await checkRateLimit(connectionTestLimiter, auth.userId);

    const result = await postFastApi<TestConnectionResult>(
      `/api/clients/${validatedClientId}/test-connection`,
      validatedParams
    );
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? "Invalid input",
      };
    }
    // Log the actual error for debugging but return a generic message to the client
    console.error('[testCmsConnection] Error:', error);
    return {
      success: false,
      error: "Connection test failed. Please verify your credentials and try again.",
    };
  }
}
