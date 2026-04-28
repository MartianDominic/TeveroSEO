/**
 * Proposal builder page route
 * Phase 30: Interactive Proposals - Builder UI
 *
 * Create/edit proposal for a prospect with live preview.
 */
import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Save, Send, Eye, Settings } from "lucide-react";
import { getProspect } from "@/serverFunctions/prospects";
import { createProposal, updateProposal, sendProposal } from "@/serverFunctions/proposals";
import { generateDefaultContent } from "@/server/features/proposals/services/ProposalService";
import { Button } from "@/client/components/ui/button";
import { Card } from "@/client/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/client/components/ui/tabs";
import { TemplateSelector } from "@/client/components/proposals/TemplateSelector";
import { PricingEditor } from "@/client/components/proposals/PricingEditor";
import { BrandConfigEditor } from "@/client/components/proposals/BrandConfigEditor";
import { ProposalPreview } from "@/client/components/proposals/ProposalPreview";
import type { ProposalContent, BrandConfig, ProposalTemplate } from "@/db/proposal-schema";

export const Route = createFileRoute("/_app/prospects/$prospectId/proposal")({
  component: ProposalBuilderPage,
});

function ProposalBuilderPage() {
  const { prospectId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch prospect data
  const { data: prospect, isLoading, error } = useQuery({
    queryKey: ["prospect", prospectId],
    queryFn: () => getProspect({ data: { id: prospectId } }),
  });

  // Local state for proposal
  const [template, setTemplate] = useState<ProposalTemplate>("standard");
  const [content, setContent] = useState<ProposalContent | null>(null);
  const [brandConfig, setBrandConfig] = useState<BrandConfig>({
    logoUrl: null,
    primaryColor: "#2563eb",
    secondaryColor: "#1e40af",
    fontFamily: "Inter",
  });
  const [setupFeeCents, setSetupFeeCents] = useState(250000);
  const [monthlyFeeCents, setMonthlyFeeCents] = useState(150000);
  const [currency, setCurrency] = useState("EUR");
  const [activeTab, setActiveTab] = useState("template");
  const [showPreview, setShowPreview] = useState(false);

  // Generate default content when prospect loads
  useEffect(() => {
    if (prospect && !content) {
      const defaultContent = generateDefaultContent(prospect as Parameters<typeof generateDefaultContent>[0]);
      setContent(defaultContent);
      setSetupFeeCents(defaultContent.investment.setupFee * 100);
      setMonthlyFeeCents(defaultContent.investment.monthlyFee * 100);
    }
  }, [prospect, content]);

  // Create proposal mutation
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      createProposal({ data: data as Record<string, unknown> }),
    onSuccess: (proposal) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      navigate({ to: `/proposals/${proposal.id}/edit` });
    },
  });

  // Handle save as draft
  const handleSave = () => {
    if (!content) return;

    createMutation.mutate({
      prospectId,
      template,
      content,
      brandConfig,
      setupFeeCents,
      monthlyFeeCents,
      currency,
    });
  };

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <a
            href={`/prospects/${prospectId}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-xl font-bold">Create Proposal</h1>
            <p className="text-sm text-muted-foreground">
              for {prospect.companyName ?? prospect.domain}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={createMutation.isPending || !content}
            className="gap-2"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Draft
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor panel */}
        <div
          className={`flex-1 overflow-auto p-6 ${
            showPreview ? "hidden lg:block lg:w-1/2" : ""
          }`}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="template">Template</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>

            <TabsContent value="template">
              <TemplateSelector selected={template} onSelect={setTemplate} />
            </TabsContent>

            <TabsContent value="pricing">
              <PricingEditor
                setupFeeCents={setupFeeCents}
                monthlyFeeCents={monthlyFeeCents}
                currency={currency}
                onSetupFeeChange={setSetupFeeCents}
                onMonthlyFeeChange={setMonthlyFeeCents}
                onCurrencyChange={setCurrency}
              />
            </TabsContent>

            <TabsContent value="branding">
              <BrandConfigEditor config={brandConfig} onChange={setBrandConfig} />
            </TabsContent>

            <TabsContent value="content">
              {content ? (
                <ContentEditor content={content} onChange={setContent} />
              ) : (
                <p className="text-muted-foreground">Loading content...</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview panel */}
        {showPreview && content && (
          <div className="w-full lg:w-1/2 border-l bg-muted/30">
            <ProposalPreview
              content={{
                ...content,
                investment: {
                  ...content.investment,
                  setupFee: setupFeeCents / 100,
                  monthlyFee: monthlyFeeCents / 100,
                },
              }}
              brandConfig={brandConfig}
              companyName={prospect.companyName ?? undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple content editor for proposal text
 */
function ContentEditor({
  content,
  onChange,
}: {
  content: ProposalContent;
  onChange: (content: ProposalContent) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Content</h3>
        <p className="text-sm text-muted-foreground">
          Edit the proposal content. Advanced editing coming soon.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Headline</label>
          <input
            type="text"
            value={content.hero.headline}
            onChange={(e) =>
              onChange({
                ...content,
                hero: { ...content.hero, headline: e.target.value },
              })
            }
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Subheadline</label>
          <input
            type="text"
            value={content.hero.subheadline}
            onChange={(e) =>
              onChange({
                ...content,
                hero: { ...content.hero, subheadline: e.target.value },
              })
            }
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Next Steps (one per line)
          </label>
          <textarea
            value={content.nextSteps.join("\n")}
            onChange={(e) =>
              onChange({
                ...content,
                nextSteps: e.target.value.split("\n").filter(Boolean),
              })
            }
            className="w-full px-3 py-2 border rounded-md min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Inclusions (one per line)
          </label>
          <textarea
            value={content.investment.inclusions.join("\n")}
            onChange={(e) =>
              onChange({
                ...content,
                investment: {
                  ...content.investment,
                  inclusions: e.target.value.split("\n").filter(Boolean),
                },
              })
            }
            className="w-full px-3 py-2 border rounded-md min-h-[100px]"
          />
        </div>
      </Card>

      <Card className="p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          <Settings className="h-4 w-4 inline mr-1" />
          Opportunities and ROI data are automatically generated from the
          prospect's analysis. Edit these in the JSON view (coming soon).
        </p>
      </Card>
    </div>
  );
}
