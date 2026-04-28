/**
 * Proposal edit page route
 * Phase 30: Interactive Proposals - Builder UI
 *
 * Edit an existing proposal with live preview.
 */
import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Save, Send, Eye, Copy, Check } from "lucide-react";
import { getProposal, updateProposal, sendProposal } from "@/serverFunctions/proposals";
import { Button } from "@/client/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/client/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/client/components/ui/dialog";
import { TemplateSelector } from "@/client/components/proposals/TemplateSelector";
import { PricingEditor } from "@/client/components/proposals/PricingEditor";
import { BrandConfigEditor } from "@/client/components/proposals/BrandConfigEditor";
import { ProposalPreview } from "@/client/components/proposals/ProposalPreview";
import type { ProposalContent, BrandConfig, ProposalTemplate } from "@/db/proposal-schema";

export const Route = createFileRoute("/_app/proposals/$proposalId/edit")({
  component: ProposalEditPage,
});

function ProposalEditPage() {
  const { proposalId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch proposal data
  const { data: proposal, isLoading, error } = useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: () => getProposal({ data: { id: proposalId } }),
  });

  // Local state
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
  const [copied, setCopied] = useState(false);

  // Initialize state from proposal
  useEffect(() => {
    if (proposal) {
      setTemplate((proposal.template as ProposalTemplate) ?? "standard");
      setContent(proposal.content as ProposalContent);
      if (proposal.brandConfig) {
        setBrandConfig(proposal.brandConfig as BrandConfig);
      }
      setSetupFeeCents(proposal.setupFeeCents ?? 0);
      setMonthlyFeeCents(proposal.monthlyFeeCents ?? 0);
      setCurrency(proposal.currency ?? "EUR");
    }
  }, [proposal]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Record<string, unknown> }) =>
      updateProposal({ data: data as { id: string; updates: Record<string, unknown> } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: () => sendProposal({ data: { id: proposalId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });

  const handleSave = () => {
    if (!content) return;

    updateMutation.mutate({
      id: proposalId,
      updates: {
        template,
        content,
        brandConfig,
        setupFeeCents,
        monthlyFeeCents,
        currency,
      },
    });
  };

  const handleSend = () => {
    sendMutation.mutate();
  };

  const copyLink = () => {
    if (!proposal) return;
    const url = `${window.location.origin}/p/${proposal.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">Proposal not found</p>
        <a href="/proposals">
          <Button variant="outline">Back to Proposals</Button>
        </a>
      </div>
    );
  }

  const isEditable = proposal.status === "draft";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <a
            href="/proposals"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-xl font-bold">
              {isEditable ? "Edit Proposal" : "View Proposal"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Status: <span className="capitalize">{proposal.status}</span>
              {proposal.sentAt && (
                <span className="ml-2">
                  Sent {new Date(proposal.sentAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={copyLink}
            className="gap-2"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          {isEditable && (
            <>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={updateMutation.isPending || !content}
                className="gap-2"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2" disabled={sendMutation.isPending}>
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Proposal?</DialogTitle>
                    <DialogDescription>
                      This will mark the proposal as sent and make it available
                      via the public link. The proposal will expire in 30 days.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button onClick={handleSend}>
                      Send Proposal
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
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
          {!isEditable && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                This proposal has been sent and cannot be edited. Create a new
                proposal to make changes.
              </p>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="template">Template</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
            </TabsList>

            <TabsContent value="template">
              <TemplateSelector
                selected={template}
                onSelect={isEditable ? setTemplate : () => {}}
              />
            </TabsContent>

            <TabsContent value="pricing">
              <PricingEditor
                setupFeeCents={setupFeeCents}
                monthlyFeeCents={monthlyFeeCents}
                currency={currency}
                onSetupFeeChange={isEditable ? setSetupFeeCents : () => {}}
                onMonthlyFeeChange={isEditable ? setMonthlyFeeCents : () => {}}
                onCurrencyChange={isEditable ? setCurrency : () => {}}
              />
            </TabsContent>

            <TabsContent value="branding">
              <BrandConfigEditor
                config={brandConfig}
                onChange={isEditable ? setBrandConfig : () => {}}
              />
            </TabsContent>

            <TabsContent value="engagement">
              <EngagementStats proposal={proposal} />
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
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Display engagement statistics for a proposal
 */
function EngagementStats({ proposal }: { proposal: { views?: unknown[]; firstViewedAt?: Date | null; acceptedAt?: Date | null } }) {
  const views = proposal.views ?? [];
  const totalViews = views.length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Engagement</h3>
        <p className="text-sm text-muted-foreground">
          Track how recipients interact with your proposal
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">Total Views</p>
          <p className="text-2xl font-bold">{totalViews}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">First Viewed</p>
          <p className="text-lg font-medium">
            {proposal.firstViewedAt
              ? new Date(proposal.firstViewedAt).toLocaleDateString()
              : "-"}
          </p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">Accepted</p>
          <p className="text-lg font-medium">
            {proposal.acceptedAt
              ? new Date(proposal.acceptedAt).toLocaleDateString()
              : "-"}
          </p>
        </div>
      </div>

      {totalViews === 0 && (
        <p className="text-sm text-muted-foreground">
          No views yet. Send the proposal to start tracking engagement.
        </p>
      )}
    </div>
  );
}
