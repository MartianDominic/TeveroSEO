"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@tevero/ui";
import {
  Globe,
  User,
  Mail,
  Building2,
  MoreVertical,
  Search,
  Trash2,
  ExternalLink,
  Loader2,
  Check,
} from "lucide-react";
import type { Prospect } from "@/app/(shell)/prospects/actions";
import {
  deleteProspectAction,
  triggerAnalysisAction,
} from "@/app/(shell)/prospects/actions";

interface ProspectCardProps {
  prospect: Prospect;
  canAnalyze: boolean;
  onAnalyzeStart?: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const STATUS_BADGES: Record<
  Prospect["status"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  new: { label: "New", variant: "secondary" },
  analyzing: { label: "Analyzing...", variant: "default" },
  analyzed: { label: "Analyzed", variant: "outline" },
  converted: { label: "Converted", variant: "default" },
  archived: { label: "Archived", variant: "secondary" },
};

export function ProspectCard({
  prospect,
  canAnalyze,
  onAnalyzeStart,
  selected = false,
  onToggleSelect,
}: ProspectCardProps) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const statusBadge = STATUS_BADGES[prospect.status] ?? STATUS_BADGES.new;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    onAnalyzeStart?.();
    try {
      await triggerAnalysisAction(prospect.id);
      router.refresh();
    } catch (error) {
      console.error("Failed to trigger analysis:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this prospect?")) return;
    setDeleting(true);
    setMenuOpen(false);
    try {
      await deleteProspectAction(prospect.id);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete prospect:", error);
    } finally {
      setDeleting(false);
    }
  };

  const isAnalyzing = prospect.status === "analyzing" || analyzing;

  return (
    <Card className={`hover:shadow-md transition-shadow ${selected ? "ring-2 ring-primary" : ""}`} onClick={onToggleSelect}>
      {onToggleSelect && (
        <div className="absolute top-3 left-3 z-10">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 bg-background"}`}>
            {selected && <Check className="h-3 w-3" />}
          </div>
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Link
                href={`/prospects/${prospect.id}` as Parameters<typeof Link>[0]["href"]}
                className="hover:underline"
              >
                {prospect.domain}
              </Link>
            </CardTitle>
            {prospect.companyName && (
              <CardDescription className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {prospect.companyName}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-40 p-1">
                <Link
                  href={`/prospects/${prospect.id}` as Parameters<typeof Link>[0]["href"]}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent w-full"
                  onClick={() => setMenuOpen(false)}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Details
                </Link>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent w-full text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="text-sm text-muted-foreground space-y-1">
          {prospect.contactName && (
            <div className="flex items-center gap-2">
              <User className="h-3 w-3" />
              <span>{prospect.contactName}</span>
            </div>
          )}
          {prospect.contactEmail && (
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3" />
              <span>{prospect.contactEmail}</span>
            </div>
          )}
          {prospect.industry && (
            <div className="text-xs mt-2">
              <Badge variant="outline" className="font-normal">
                {prospect.industry}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !canAnalyze}
          size="sm"
          className="w-full"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              {prospect.status === "analyzed" ? "Re-analyze" : "Analyze"}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
