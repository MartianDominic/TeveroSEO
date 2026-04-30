import { Suspense } from "react";
import Link from "next/link";
import { getContracts } from "./actions";
import { ContractTable } from "./components/ContractTable";
import { Card, CardContent } from "@tevero/ui";
import { Loader2, ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ prospectId: string }>;
}

async function ContractListContent({ prospectId }: { prospectId: string }) {
  const result = await getContracts(prospectId);

  if (!result.success) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          {result.error || "Failed to load contracts"}
        </CardContent>
      </Card>
    );
  }

  return (
    <ContractTable
      contracts={result.data || []}
      prospectId={prospectId}
    />
  );
}

export default async function ContractsPage({ params }: Props) {
  const { prospectId } = await params;

  return (
    <div className="container max-w-5xl py-8">
      <Link
        href={`/prospects/${prospectId}` as Parameters<typeof Link>[0]["href"]}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Grįžti į prospektą
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sutartys</h1>
          <p className="text-muted-foreground">
            Sutarčių valdymas ir pasirašymo būsena
          </p>
        </div>
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
        <ContractListContent prospectId={prospectId} />
      </Suspense>
    </div>
  );
}
