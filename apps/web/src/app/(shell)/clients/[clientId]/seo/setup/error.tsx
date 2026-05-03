"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@tevero/ui";
import Link from "next/link";
import { useParams } from "next/navigation";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SeoSetupError({ error, reset }: ErrorProps) {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;

  useEffect(() => {
    // Log the error for debugging
    console.error("[seo/setup] Error:", error);
  }, [error]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Setup Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Something went wrong while setting up your SEO project. This may be
            a temporary issue.
          </p>

          {error.message && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-mono text-muted-foreground">
                {error.message}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={reset} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button asChild variant="outline">
              <Link href={`/clients/${clientId}/seo` as Parameters<typeof Link>[0]["href"]}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to SEO
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
