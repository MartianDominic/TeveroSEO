"use client";

/**
 * Error boundary for signing success page.
 * FIX-06 M-NEXT-02: Added error.tsx boundary.
 */
import { useEffect } from "react";
import { Button } from "@tevero/ui";
import { AlertCircle } from "lucide-react";
import { logError } from "@/lib/errors";

export default function SigningSuccessError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("SigningSuccessError", error, {
      digest: error.digest,
      page: "[locale]/c/[token]/success",
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-6">
          We encountered an error displaying the confirmation page.
          Your signature may still have been recorded successfully.
        </p>
        <Button onClick={reset} className="w-full">
          Try again
        </Button>
      </div>
    </div>
  );
}
