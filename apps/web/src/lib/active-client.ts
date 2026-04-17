import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_CLIENT_COOKIE } from "./cookies";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRoute = any;

export async function getActiveClientId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_CLIENT_COOKIE)?.value ?? null;
}

export async function requireActiveClientId(): Promise<string> {
  const id = await getActiveClientId();
  if (!id) redirect("/clients" as AnyRoute);
  return id;
}
