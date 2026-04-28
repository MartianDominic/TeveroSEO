import { createServerFn } from "@tanstack/react-start";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { hasDataForSEOCredentials } from "@/server/lib/dataforseo-auth";

export const getSeoApiKeyStatus = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(() => {
    return { configured: hasDataForSEOCredentials() };
  });
