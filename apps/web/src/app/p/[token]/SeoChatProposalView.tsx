/**
 * SEO Chat Proposal View
 * Phase 98-07: Public prospect portal for SEO Chat proposals
 *
 * Co-located components for the /p/[token] route when viewing SEO Chat proposals.
 * Separated from legacy proposal view to maintain clean separation of concerns.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Globe,
  Target,
  TrendingUp,
  Package,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { ProposalData } from '@/lib/seo-chat/prospect-portal';

interface SeoChatProposalViewProps {
  proposal: ProposalData;
}

/**
 * Main SEO Chat proposal display component
 *
 * Renders the full proposal with agency branding, domain health,
 * target keywords, package details, and CTA.
 */
export function SeoChatProposalView({ proposal }: SeoChatProposalViewProps) {
  const packageDetails = getPackageDetails(proposal.package);

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Header with agency branding */}
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Your SEO Proposal</h1>
        <p className="text-muted-foreground">
          Prepared by {proposal.workspaceName} for {proposal.domain}
        </p>
      </header>

      {/* Domain Overview */}
      {proposal.analysisResults.domainHealth && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Current Domain Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{proposal.analysisResults.domainHealth.da}</p>
                <p className="text-sm text-muted-foreground">Domain Authority</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{proposal.analysisResults.domainHealth.dr}</p>
                <p className="text-sm text-muted-foreground">Domain Rating</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{formatNumber(proposal.analysisResults.domainHealth.traffic)}</p>
                <p className="text-sm text-muted-foreground">Monthly Traffic</p>
              </div>
            </div>
            <p className="mt-4 text-muted-foreground">
              {proposal.analysisResults.domainHealth.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Target Keywords */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Target Keywords
            </span>
            <Badge variant="secondary">{proposal.keywords.length} keywords</Badge>
          </CardTitle>
          <CardDescription>
            Keywords selected for your SEO campaign based on volume, difficulty, and business relevance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {proposal.keywords.slice(0, 10).map((kw, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <span className="font-medium">{kw.keyword}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {kw.volume.toLocaleString()} vol
                  </span>
                  <Badge variant="outline">{kw.feasibility}</Badge>
                </div>
              </div>
            ))}
            {proposal.keywords.length > 10 && (
              <p className="text-center text-sm text-muted-foreground pt-2">
                +{proposal.keywords.length - 10} more keywords
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Package */}
      {packageDetails && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Recommended Package
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex-1 min-w-64">
                <h3 className="text-2xl font-bold">{packageDetails.name}</h3>
                <p className="text-muted-foreground">{packageDetails.description}</p>
                <ul className="mt-4 space-y-2">
                  {packageDetails.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{packageDetails.price}</p>
                <p className="text-sm text-muted-foreground">per month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="py-8 text-center">
          <h3 className="text-2xl font-bold mb-2">Ready to Get Started?</h3>
          <p className="mb-6 opacity-90">
            Let&apos;s discuss how we can help {proposal.domain} grow.
          </p>
          <Button size="lg" variant="secondary">
            Schedule a Call
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          <Clock className="inline h-3 w-3 mr-1" />
          Proposal generated on {proposal.createdAt.toLocaleDateString()}
        </p>
        {proposal.expiresAt && (
          <p className="mt-1">
            Valid until {proposal.expiresAt.toLocaleDateString()}
          </p>
        )}
      </footer>
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getPackageDetails(pkg: string) {
  const packages: Record<string, { name: string; description: string; price: string; features: string[] }> = {
    pamatas: {
      name: 'Pamatas',
      description: 'Essential SEO foundation for small businesses',
      price: '€497',
      features: [
        'Technical SEO audit',
        'On-page optimization',
        'Monthly reporting',
        '5 target keywords',
      ],
    },
    augimas: {
      name: 'Augimas',
      description: 'Growth-focused SEO for scaling businesses',
      price: '€997',
      features: [
        'Everything in Pamatas',
        'Content strategy',
        'Link building (10/mo)',
        '15 target keywords',
      ],
    },
    autoritetas: {
      name: 'Autoritetas',
      description: 'Authority building for market leaders',
      price: '€1,997',
      features: [
        'Everything in Augimas',
        'Digital PR',
        'Link building (25/mo)',
        '30 target keywords',
      ],
    },
  };
  return packages[pkg] || null;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
