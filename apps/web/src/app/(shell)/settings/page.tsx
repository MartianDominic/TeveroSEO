"use client";

/**
 * GlobalSettingsPage - Platform Settings
 *
 * HIGH-02 FIX: Refactored from 1043-line monolithic component.
 * Tab components extracted to ./components/ for maintainability:
 * - ApiIntegrationsTab: API keys and secrets management
 * - VoiceTemplatesTab: Writing style templates
 * - ModelDefaultsTab: Default AI model configuration
 *
 * Note: This page remains a client component because the Tabs
 * component requires client-side interactivity. The tab content
 * components fetch their own data, which is appropriate for
 * settings forms that require heavy interactivity.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { ChevronRight, CreditCard, Package } from "lucide-react";

import { WithErrorBoundary } from "@/components/with-error-boundary";

import {
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@tevero/ui";

import {
  ApiIntegrationsTab,
  VoiceTemplatesTab,
  ModelDefaultsTab,
} from "./components";

type AnyRoute = Parameters<typeof redirect>[0];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function GlobalSettingsPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <PageHeader title="Global Settings" subtitle="Platform configuration and API integrations" />

      {/* Quick Links to Settings Sub-pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 mb-8">
        <Link href={"/settings/services" as AnyRoute} className="group">
          <div className="rounded-lg border border-border bg-card p-4 hover:border-primary transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Service Catalog</h3>
                  <p className="text-xs-safe text-muted-foreground">Manage service templates for proposals</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </Link>

        <Link href={"/settings/payments" as AnyRoute} className="group">
          <div className="rounded-lg border border-border bg-card p-4 hover:border-primary transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Payment Settings</h3>
                  <p className="text-xs-safe text-muted-foreground">Configure payment providers</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </Link>
      </div>

      <Tabs defaultValue="api" className="mt-6">
        <TabsList>
          <TabsTrigger value="api">API Integrations</TabsTrigger>
          <TabsTrigger value="voice">Voice Templates</TabsTrigger>
          <TabsTrigger value="models">Model Defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <WithErrorBoundary name="ApiIntegrationsTab">
            <ApiIntegrationsTab />
          </WithErrorBoundary>
        </TabsContent>

        <TabsContent value="voice">
          <WithErrorBoundary name="VoiceTemplatesTab">
            <VoiceTemplatesTab />
          </WithErrorBoundary>
        </TabsContent>

        <TabsContent value="models">
          <WithErrorBoundary name="ModelDefaultsTab">
            <ModelDefaultsTab />
          </WithErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
