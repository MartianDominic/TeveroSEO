import { Suspense } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getServices } from "./actions";
import { ServiceTable } from "./components/ServiceTable";

/**
 * Services Settings Page
 * Phase 58-02: Service catalog management UI
 *
 * Displays grouped service templates with CRUD operations.
 */

async function ServiceListContent() {
  const result = await getServices();

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  return <ServiceTable services={result.data?.services || []} />;
}

function ServiceListSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">
        Loading services...
      </span>
    </div>
  );
}

export default function ServicesSettingsPage() {
  return (
    <div className="container max-w-5xl py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/settings" className="hover:text-foreground transition-colors">
          Settings
        </Link>
        <span>/</span>
        <span className="text-foreground">Services</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Service Catalog</h1>
        <p className="text-muted-foreground mt-1">
          Manage reusable service templates for proposals. Create packages,
          add-ons, and one-time services with configurable pricing.
        </p>
      </div>

      {/* Service List */}
      <Suspense fallback={<ServiceListSkeleton />}>
        <ServiceListContent />
      </Suspense>
    </div>
  );
}
