import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clients | Tevero",
  description: "Manage your agency clients and their SEO campaigns.",
};

export default function ClientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
