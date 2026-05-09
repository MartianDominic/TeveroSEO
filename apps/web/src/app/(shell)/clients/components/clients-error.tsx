"use client";

/**
 * ClientsError - Error state component for clients page
 *
 * HIGH-01 FIX: Extracted error handling to a client component
 * for the retry functionality.
 */

import React from "react";

import { useRouter } from "next/navigation";

import { AlertCircle, RefreshCw } from "lucide-react";

import { Button, PageHeader } from "@tevero/ui";

interface ClientsErrorProps {
  message: string;
}

export function ClientsError({ message }: ClientsErrorProps) {
  const router = useRouter();

  const handleRetry = () => {
    // Force a full page refresh to re-run the server component
    router.refresh();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Clients"
        subtitle="Manage your agency clients"
      />

      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Failed to load clients
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            {message}
          </p>
        </div>
        <Button variant="outline" onClick={handleRetry}>
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
