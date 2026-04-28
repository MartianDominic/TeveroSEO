/**
 * Prospect detail page route
 * Phase 28: Keyword Gap Analysis UI
 *
 * Displays prospect details with tabs for different analysis views.
 * Includes Keyword Gaps tab for gap analysis results.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Globe, Building2, Mail, User } from "lucide-react";
import { getProspect } from "@/serverFunctions/prospects";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card } from "@/client/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/client/components/ui/tabs";
import { KeywordGapsTab, QuickWinsTab, StatusBadge } from "@/client/components/prospects";

export const Route = createFileRoute("/_app/prospects/$prospectId")({
  component: ProspectDetailPage,
});

function ProspectDetailPage() {
  const { prospectId } = Route.useParams();

  const { data: prospect, isLoading, error } = useQuery({
    queryKey: ["prospect", prospectId],
    queryFn: () => getProspect({ data: { id: prospectId } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !prospect) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">Prospect not found</p>
        <a href="/prospects">
          <Button variant="outline">Back to Prospects</Button>
        </a>
      </div>
    );
  }

  // Get the most recent analysis with keyword gaps
  const latestAnalysis = prospect.analyses?.[0];
  const keywordGaps = latestAnalysis?.keywordGaps ?? null;
  const domainAuthority = latestAnalysis?.domainMetrics?.domainRank ?? 30; // Default DA 30

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <a
          href="/prospects"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Prospects
        </a>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Globe className="h-6 w-6" />
              {prospect.domain}
            </h1>
            {prospect.companyName && (
              <p className="text-muted-foreground mt-1">{prospect.companyName}</p>
            )}
          </div>
          <StatusBadge status={prospect.status} className="text-sm" />
        </div>
      </div>

      {/* Contact info card */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {prospect.industry ?? "Industry not set"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {prospect.contactName ?? "Contact not set"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {prospect.contactEmail ?? "Email not set"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Created {new Date(prospect.createdAt).toLocaleDateString()}
          </div>
        </div>
      </Card>

      {/* Analysis tabs */}
      <Tabs defaultValue="keyword-gaps">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keyword-gaps">
            Keyword Gaps
            {keywordGaps && keywordGaps.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {keywordGaps.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="quick-wins">Quick Wins</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab prospect={prospect} analysis={latestAnalysis} />
        </TabsContent>

        <TabsContent value="keyword-gaps" className="mt-6">
          <KeywordGapsTab gaps={keywordGaps} domain={prospect.domain} />
        </TabsContent>

        <TabsContent value="quick-wins" className="mt-6">
          <QuickWinsTab
            gaps={keywordGaps}
            domainAuthority={domainAuthority}
            domain={prospect.domain}
          />
        </TabsContent>

        <TabsContent value="competitors" className="mt-6">
          <CompetitorsTab analysis={latestAnalysis} />
        </TabsContent>
      </Tabs>
    </div>
  );
}


interface OverviewTabProps {
  prospect: {
    notes?: string | null;
    source?: string | null;
  };
  analysis?: {
    analysisType: string;
    status: string;
    domainMetrics?: {
      domainRank?: number;
      organicTraffic?: number;
      organicKeywords?: number;
      backlinks?: number;
      referringDomains?: number;
    } | null;
    completedAt?: Date | null;
  } | null;
}

function OverviewTab({ prospect, analysis }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Domain metrics */}
      {analysis?.domainMetrics && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Domain Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Domain Rank</div>
              <div className="text-2xl font-bold">
                {analysis.domainMetrics.domainRank?.toLocaleString() ?? "-"}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Organic Traffic</div>
              <div className="text-2xl font-bold">
                {analysis.domainMetrics.organicTraffic?.toLocaleString() ?? "-"}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Keywords</div>
              <div className="text-2xl font-bold">
                {analysis.domainMetrics.organicKeywords?.toLocaleString() ?? "-"}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Backlinks</div>
              <div className="text-2xl font-bold">
                {analysis.domainMetrics.backlinks?.toLocaleString() ?? "-"}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Ref. Domains</div>
              <div className="text-2xl font-bold">
                {analysis.domainMetrics.referringDomains?.toLocaleString() ?? "-"}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Notes */}
      {prospect.notes && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Notes</h3>
          <Card className="p-4">
            <p className="whitespace-pre-wrap">{prospect.notes}</p>
          </Card>
        </div>
      )}

      {/* Source */}
      {prospect.source && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Source</h3>
          <p className="text-muted-foreground">{prospect.source}</p>
        </div>
      )}

      {!analysis && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No analysis data yet.</p>
          <p className="text-sm mt-2">
            Run an analysis to see domain metrics and keyword opportunities.
          </p>
        </div>
      )}
    </div>
  );
}

interface CompetitorsTabProps {
  analysis?: {
    competitorDomains?: string[] | null;
  } | null;
}

function CompetitorsTab({ analysis }: CompetitorsTabProps) {
  const competitors = analysis?.competitorDomains ?? [];

  if (competitors.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No competitors discovered yet.</p>
        <p className="text-sm mt-2">
          Run a gap analysis to discover competitors and their keywords.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">
        Discovered Competitors ({competitors.length})
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {competitors.map((domain) => (
          <Card key={domain} className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{domain}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
