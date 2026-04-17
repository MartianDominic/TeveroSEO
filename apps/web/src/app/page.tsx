import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
type AnyRoute = any; // eslint-disable-line

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in" as AnyRoute);
  redirect("/clients" as AnyRoute);
}
