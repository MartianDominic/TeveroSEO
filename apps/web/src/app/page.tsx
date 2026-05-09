import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";
type AnyRoute = any; // eslint-disable-line

export const dynamic = "force-dynamic";

/**
 * HIGH-11-01: Root page redirects all users to /clients.
 * New users will see GettingStartedCard onboarding on the clients page.
 * After client creation, users are redirected to /clients/[clientId]/onboarding.
 */
export default async function RootPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in" as AnyRoute);
  redirect("/clients" as AnyRoute);
}
