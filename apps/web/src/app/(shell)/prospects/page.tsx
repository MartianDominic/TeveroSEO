import { PageHeader } from "@tevero/ui";
import { ProspectList } from "@/components/prospects/ProspectList";
import { AddProspectDialog } from "@/components/prospects/AddProspectDialog";
import { getProspects, getRemainingAnalyses } from "./actions";

export default async function ProspectsPage() {
  const [prospectsResult, remainingAnalyses] = await Promise.all([
    getProspects({ pageSize: 50 }),
    getRemainingAnalyses(),
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Prospects"
          subtitle="Analyze potential clients before they sign up"
        />
        <AddProspectDialog />
      </div>

      <ProspectList
        prospects={prospectsResult.data}
        remainingAnalyses={remainingAnalyses}
      />
    </div>
  );
}
