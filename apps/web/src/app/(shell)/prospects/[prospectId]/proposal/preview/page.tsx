"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@tevero/ui";
import { ArrowLeft, Download, Send } from "lucide-react";

export default function ProposalPreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const prospectId = params.prospectId as string;
  const proposalId = searchParams.get("id");

  if (!proposalId) {
    return (
      <div className="container py-8">
        <p>No proposal ID provided</p>
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
          <div className="prose prose-sm max-w-none">
            <p className="text-center text-muted-foreground">
              Proposal preview for ID: {proposalId}
            </p>
            <p className="text-center text-muted-foreground text-sm">
              Full preview rendering will load proposal sections from the API
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
