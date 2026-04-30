"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tevero/ui";
import { Search, FileText, Zap, BarChart3, Eye } from "lucide-react";

interface EntryOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  cost: string;
  workspace: boolean;
}

const ENTRY_OPTIONS: EntryOption[] = [
  {
    id: "quick-check",
    title: "Quick Check",
    description: "Check 1-20 keywords instantly",
    icon: <Zap className="h-8 w-8" />,
    route: "/prospects/keywords/quick-check",
    cost: "~$0.005/kw",
    workspace: false,
  },
  {
    id: "csv-import",
    title: "Import CSV",
    description: "Upload from Ahrefs, SEMrush, or Moz",
    icon: <FileText className="h-8 w-8" />,
    route: "/prospects/[id]/keywords/import",
    cost: "$0 if metrics present",
    workspace: true,
  },
  {
    id: "full-discovery",
    title: "Full Discovery",
    description: "Complete keyword research",
    icon: <Search className="h-8 w-8" />,
    route: "/prospects/[id]/analysis",
    cost: "~$0.04",
    workspace: true,
  },
  {
    id: "gap-analysis",
    title: "Gap Analysis",
    description: "Find missing keywords vs competitors",
    icon: <BarChart3 className="h-8 w-8" />,
    route: "/prospects/[id]/gap-analysis",
    cost: "~$0.04",
    workspace: true,
  },
  {
    id: "competitor-spy",
    title: "Competitor Spy",
    description: "See what competitors rank for",
    icon: <Eye className="h-8 w-8" />,
    route: "/prospects/keywords/competitor-spy",
    cost: "~$0.02",
    workspace: false,
  },
];

interface EntrySelectorProps {
  prospectId?: string;
}

export function EntrySelector({ prospectId }: EntrySelectorProps) {
  const router = useRouter();

  const handleSelect = (option: EntryOption) => {
    if (option.workspace && !prospectId) {
      // Redirect to create prospect first
      const newProspectRoute = `/prospects/new?next=${encodeURIComponent(option.route)}`;
      router.push(newProspectRoute as Parameters<typeof router.push>[0]);
      return;
    }

    const route = option.route.replace("[id]", prospectId || "");
    router.push(route as Parameters<typeof router.push>[0]);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {ENTRY_OPTIONS.map((option) => (
        <Card
          key={option.id}
          className="cursor-pointer shadow-card hover:shadow-lift hover:-translate-y-px transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          onClick={() => handleSelect(option)}
        >
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 rounded-[var(--radius-input)] bg-surface-2">{option.icon}</div>
            <div>
              <CardTitle className="text-lg">{option.title}</CardTitle>
              <CardDescription>{option.description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-[12px] text-text-3">
              <span>
                {option.workspace ? "Requires prospect" : "No workspace needed"}
              </span>
              <span>{option.cost}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
