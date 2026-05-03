import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | Tevero",
  description: "Platform configuration and API integrations.",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
