"use server";

/**
 * Server action to test CMS connection.
 * Phase 41-04: CMS Integration Polish
 */

import { auth } from "@clerk/nextjs/server";
import { postFastApi } from "@/lib/server-fetch";

export type CmsPlatform = "wordpress" | "shopify" | "wix" | "webhook";

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
  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  try {
    const result = await postFastApi<TestConnectionResult>(
      `/api/clients/${clientId}/test-connection`,
      params
    );
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    };
  }
}
