/**
 * TemplateSelector component
 * Phase 30: Interactive Proposals - Builder UI
 *
 * Allows selecting between proposal templates (standard, premium, enterprise).
 */
import { Card } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Check, Star, Building2 } from "lucide-react";
import type { ProposalTemplate } from "@/db/proposal-schema";

interface TemplateSelectorProps {
  selected: ProposalTemplate;
  onSelect: (template: ProposalTemplate) => void;
}

interface TemplateOption {
  id: ProposalTemplate;
  name: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  recommended?: boolean;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "standard",
    name: "Standard",
    description: "Clean, professional proposal for small to medium businesses",
    icon: <Check className="h-6 w-6" />,
    features: [
      "SEO performance overview",
      "Keyword opportunities",
      "Basic ROI calculator",
      "Investment breakdown",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    description: "Enhanced proposal with advanced analytics and visualizations",
    icon: <Star className="h-6 w-6" />,
    features: [
      "Everything in Standard",
      "Interactive ROI calculator",
      "Competitor comparison",
      "Traffic projections chart",
      "Custom branding",
    ],
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Full-featured proposal for large organizations",
    icon: <Building2 className="h-6 w-6" />,
    features: [
      "Everything in Premium",
      "Multi-location analysis",
      "Custom sections",
      "White-label option",
      "Priority support",
    ],
  },
];

/**
 * Renders template selection cards
 */
export function TemplateSelector({ selected, onSelect }: TemplateSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Select Template</h3>
        <p className="text-sm text-muted-foreground">
          Choose a template that best fits your client's needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className={`relative p-6 cursor-pointer transition-all hover:shadow-md ${
              selected === template.id
                ? "ring-2 ring-primary border-primary"
                : "hover:border-primary/50"
            }`}
            onClick={() => onSelect(template.id)}
          >
            {template.recommended && (
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                Recommended
              </Badge>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div
                className={`p-2 rounded-lg ${
                  selected === template.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {template.icon}
              </div>
              <div>
                <h4 className="font-semibold">{template.name}</h4>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              {template.description}
            </p>

            <ul className="space-y-2">
              {template.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            {selected === template.id && (
              <div className="absolute top-4 right-4">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
