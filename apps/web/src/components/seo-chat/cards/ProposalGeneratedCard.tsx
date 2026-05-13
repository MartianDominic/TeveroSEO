'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ProposalGeneratedCardProps {
  result: {
    proposalId: string;
    magicLink: string;
    package: string;
    keywordCount: number;
  };
}

export function ProposalGeneratedCard({ result }: ProposalGeneratedCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="w-full max-w-md border-primary/50 bg-primary/5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Proposal Generated
          </span>
          <Badge variant="default" className="bg-green-600">
            Ready
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <span>
            Package: <strong className="capitalize">{result.package}</strong>
          </span>
          <span>
            Keywords: <strong>{result.keywordCount}</strong>
          </span>
        </div>

        {/* Magic link actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy Link
              </>
            )}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            asChild
          >
            <a href={result.magicLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Open Portal
            </a>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Share this link with your prospect to let them view the proposal.
        </p>
      </CardContent>
    </Card>
  );
}
