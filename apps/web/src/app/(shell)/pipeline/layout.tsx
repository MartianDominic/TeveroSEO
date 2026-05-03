import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pipeline | Tevero",
  description: "Manage prospects through your sales funnel.",
};

export default function PipelineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
