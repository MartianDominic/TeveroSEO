import { createServerFn } from "@tanstack/react-start";
import { getBacklinksAccessStatus } from "@/server/features/backlinks/backlinksAccess";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { backlinksProjectSchema } from "@/types/schemas/backlinks";

export const getBacklinksAccessSetupStatus = createServerFn({
  method: "GET",
})
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => backlinksProjectSchema.parse(data))
  .handler(async () => getBacklinksAccessStatus());

export const testBacklinksAccess = createServerFn({
  method: "POST",
})
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => backlinksProjectSchema.parse(data))
  .handler(async () => {
    // Clerk auth is always hosted - backlinks are platform-managed
    // No manual DataForSEO access test needed
    return getBacklinksAccessStatus();
  });
