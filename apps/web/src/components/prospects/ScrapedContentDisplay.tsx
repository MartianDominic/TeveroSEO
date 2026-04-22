/**
 * Display component for scraped website content and AI-extracted business info.
 * Phase 27-03: AI Business Extractor
 */
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@tevero/ui";
import { MapPin, Target, Package, Award, Wrench } from "lucide-react";
import type { ScrapedContent } from "@/app/(shell)/prospects/actions";

interface ScrapedContentDisplayProps {
  scrapedContent: ScrapedContent;
}

export function ScrapedContentDisplay({
  scrapedContent,
}: ScrapedContentDisplayProps) {
  const { businessInfo, pages } = scrapedContent;

  if (!businessInfo) {
    return null;
  }

  const confidenceColor =
    businessInfo.confidence >= 0.7
      ? "text-green-600"
      : businessInfo.confidence >= 0.4
        ? "text-yellow-600"
        : "text-red-600";

  const confidenceLabel =
    businessInfo.confidence >= 0.7
      ? "High"
      : businessInfo.confidence >= 0.4
        ? "Medium"
        : "Low";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Business Information</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Analyzed {pages.length} page{pages.length !== 1 ? "s" : ""}
            </span>
            <span>•</span>
            <span className={confidenceColor}>
              {confidenceLabel} confidence ({Math.round(businessInfo.confidence * 100)}%)
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        {businessInfo.summary && (
          <div>
            <p className="text-sm text-muted-foreground">{businessInfo.summary}</p>
          </div>
        )}

        {/* Location and Target Market */}
        <div className="flex flex-wrap gap-4">
          {businessInfo.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{businessInfo.location}</span>
            </div>
          )}
          {businessInfo.targetMarket && (
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium capitalize">
                {businessInfo.targetMarket === "both"
                  ? "Residential & Commercial"
                  : businessInfo.targetMarket}
              </span>
            </div>
          )}
        </div>

        {/* Products */}
        {businessInfo.products.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Products</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {businessInfo.products.map((product, idx) => (
                <Badge key={idx} variant="secondary">
                  {product}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Brands */}
        {businessInfo.brands.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Brands</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {businessInfo.brands.map((brand, idx) => (
                <Badge key={idx} variant="outline">
                  {brand}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Services */}
        {businessInfo.services.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Services</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {businessInfo.services.map((service, idx) => (
                <Badge key={idx} variant="default">
                  {service}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Low confidence warning */}
        {businessInfo.confidence < 0.5 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              Low confidence in extracted information. Please review and manually
              verify the details above.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
