"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@tevero/ui";
import { ArrowLeft, Download, Send, Loader2, AlertCircle } from "lucide-react";
import {
  getProposalForPreview,
  type ProposalPreviewData,
} from "../builder/actions";

export default function ProposalPreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const prospectId = params.prospectId as string;
  const proposalId = searchParams.get("id");

  const [proposal, setProposal] = useState<ProposalPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProposal() {
      if (!proposalId) {
        setError("No proposal ID provided");
        setLoading(false);
        return;
      }

      try {
        const result = await getProposalForPreview(proposalId);
        if (result.success) {
          setProposal(result.data);
        } else {
          setError(result.error || "Failed to load proposal");
        }
      } catch (err) {
        setError("An unexpected error occurred while loading the proposal");
      } finally {
        setLoading(false);
      }
    }

    loadProposal();
  }, [proposalId]);

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Editor
        </Button>
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center text-destructive">
              <AlertCircle className="h-6 w-6 mr-2" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="container max-w-4xl py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Editor
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No proposal found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Editor
        </Button>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button>
            <Send className="mr-2 h-4 w-4" />
            Send to Prospect
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-8">
          <div className="proposal-preview space-y-8">
            {proposal.sections.map((section) => (
              <div key={section.type} className="section">
                <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                  {section.title}
                </h2>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
