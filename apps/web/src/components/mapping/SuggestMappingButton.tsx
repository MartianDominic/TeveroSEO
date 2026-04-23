"use client";

import { useState } from "react";
import { Button } from "@tevero/ui";
import { Wand2, Loader2 } from "lucide-react";
import { suggestMappings } from "@/actions/seo/mapping";

interface SuggestMappingButtonProps {
  projectId: string;
  clientId: string;
  onComplete: () => void;
}

export function SuggestMappingButton({
  projectId,
  clientId,
  onComplete,
}: SuggestMappingButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSuggest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await suggestMappings({
        projectId,
        clientId,
        includeGsc: true,
        includeSaved: true,
        includeProspect: true,
      });

      setResult(response.message);
      onComplete();
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Button onClick={handleSuggest} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Mapping...
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-4 w-4" />
            Suggest Mapping
          </>
        )}
      </Button>
      {result && (
        <span className="text-sm text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
