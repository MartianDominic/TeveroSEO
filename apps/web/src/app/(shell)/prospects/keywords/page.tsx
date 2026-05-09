import { PageHeader } from "@tevero/ui";

import { EntrySelector } from "./components/EntrySelector";

export default function KeywordEntryPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <PageHeader
          title="+ New Keyword Research"
          subtitle="Choose how you want to discover keywords for your prospect"
        />
      </div>

      <EntrySelector />
    </div>
  );
}
