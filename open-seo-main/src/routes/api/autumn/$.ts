import { createFileRoute } from "@tanstack/react-router";
import { autumnHandler } from "autumn-js/fetch";
import { resolveUserContext } from "@/middleware/ensure-user";

const handler = autumnHandler({
  identify: async (request) => {
    const context = await resolveUserContext(request.headers);

    return {
      customerId: context.organizationId,
    };
  },
});

function handleAutumnRequest(request: Request) {
  // Clerk auth is always hosted - no mode check needed
  return handler(request);
}

export const Route = createFileRoute("/api/autumn/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return handleAutumnRequest(request);
      },
      POST: async ({ request }: { request: Request }) => {
        return handleAutumnRequest(request);
      },
    },
  },
});
