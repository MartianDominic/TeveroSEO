import { Suspense } from "react";
import Link from "next/link";
import { getProposalsForProspect } from "./actions";
import { ProposalTable } from "./components/ProposalTable";
import { Button, Card, CardContent } from "@tevero/ui";
import { Plus, Loader2, ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ prospectId: string }>;
  searchParams: Promise<{ status?: string }>;
}

async function ProposalListContent({
  prospectId,
  status,
}: {
  prospectId: string;
  status?: string;
}) {
  const result = await getProposalsForProspect(prospectId, { status });

  if (!result.success) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          {result.error || "Failed to load proposals"}
        </CardContent>
      </Card>
    );
  }

  return (
    <ProposalTable
      proposals={result.data?.proposals || []}
      prospectId={prospectId}
    />
  );
}

export default async function ProposalsPage({ params, searchParams }: Props) {
  const { prospectId } = await params;
  const { status } = await searchParams;

  return (
    <div className="container max-w-5xl py-8">
      <Link
        href={`/prospects/${prospectId}` as Parameters<typeof Link>[0]["href"]}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Prospect
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Proposals</h1>
          <p className="text-muted-foreground">
            Manage proposals for this prospect
          </p>
        </div>
        <Link href={`/prospects/${prospectId}/proposal/builder` as Parameters<typeof Link>[0]["href"]}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Proposal
          </Button>
        </Link>
      </div>

      <Suspense
        fallback={
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        }
      >
        <ProposalListContent prospectId={prospectId} status={status} />
      </Suspense>
    </div>
  );
}
