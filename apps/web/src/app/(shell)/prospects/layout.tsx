import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prospects | Tevero",
  description: "Analyze potential clients before they sign up.",
};

export default function ProspectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
