import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@tevero/ui";
import {
  ArrowLeft,
  Globe,
  Building2,
  User,
  Mail,
  Calendar,
  Loader2,
  FileDown,
} from "lucide-react";
import { AnalysisResults } from "@/components/prospects/AnalysisResults";
import { ScrapedContentDisplay } from "@/components/prospects/ScrapedContentDisplay";
import { BusinessInfoFormWrapper } from "@/components/prospects/BusinessInfoFormWrapper";
import { OpportunityKeywordsSection } from "@/components/prospects/OpportunityKeywordsSection";
import { getProspectDetail } from "./actions";

interface ProspectDetailPageProps {
  params: Promise<{ prospectId: string }>;
}

const STATUS_BADGES: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  new: { label: "New", variant: "secondary" },
  analyzing: { label: "Analyzing...", variant: "default" },
  analyzed: { label: "Analyzed", variant: "outline" },
  converted: { label: "Converted", variant: "default" },
  archived: { label: "Archived", variant: "secondary" },
};

export default async function ProspectDetailPage({
  params,
}: ProspectDetailPageProps) {
  const { prospectId } = await params;

  let prospect;
  try {
    prospect = await getProspectDetail(prospectId);
  } catch {
    notFound();
  }

  if (!prospect) {
    notFound();
  }

  const statusBadge = STATUS_BADGES[prospect.status] ?? STATUS_BADGES.new;
  const latestAnalysis = prospect.analyses[0];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <Link
        href={"/prospects" as Parameters<typeof Link>[0]["href"]}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Prospects
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6 text-muted-foreground" />
              {prospect.domain}
            </h1>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>
          {prospect.companyName && (
            <p className="text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {prospect.companyName}
            </p>
          )}
        </div>
        {latestAnalysis && latestAnalysis.status === "completed" && (
          <Button asChild variant="outline">
            <a
              href={`/api/prospects/${prospectId}/report`}
              download
              className="flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              Export PDF
            </a>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {prospect.contactName && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{prospect.contactName}</span>
              </div>
            )}
            {prospect.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`mailto:${prospect.contactEmail}`}
                  className="hover:underline"
                >
                  {prospect.contactEmail}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                Added {new Date(prospect.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          {prospect.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">{prospect.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {prospect.status === "analyzing" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Analysis in progress... This may take a minute.
            </p>
          </CardContent>
        </Card>
      )}

      {latestAnalysis && latestAnalysis.status === "completed" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Latest Analysis</h2>
            <span className="text-sm text-muted-foreground">
              {latestAnalysis.completedAt
                ? new Date(latestAnalysis.completedAt).toLocaleString()
                : ""}
            </span>
          </div>

          {/* Business Information from Scraping */}
          {latestAnalysis.scrapedContent?.businessInfo &&
            latestAnalysis.scrapedContent.businessInfo.confidence >= 0.5 && (
              <ScrapedContentDisplay
                scrapedContent={latestAnalysis.scrapedContent}
              />
            )}

          {/* Manual entry form if scraping failed or low confidence */}
          {(!latestAnalysis.scrapedContent?.businessInfo ||
            latestAnalysis.scrapedContent.businessInfo.confidence < 0.5) && (
            <BusinessInfoFormWrapper
              prospectId={prospectId}
              analysisId={latestAnalysis.id}
            />
          )}

          <AnalysisResults analysis={latestAnalysis} />

          {/* AI Opportunity Keywords */}
          {latestAnalysis.opportunityKeywords &&
            latestAnalysis.opportunityKeywords.length > 0 && (
              <OpportunityKeywordsSection
                keywords={latestAnalysis.opportunityKeywords}
                domain={prospect.domain}
              />
            )}
        </div>
      )}

      {prospect.status === "new" && prospect.analyses.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No analysis yet. Click &quot;Analyze&quot; to discover keywords
              and competitors.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
