/**
 * ScorecardDisplay Component
 * Phase 92-09: UI Components for On-Page Mastery
 *
 * Displays the 41-point SEO scorecard with passed/failed rules.
 * Uses design-system-v6 typography and accordion patterns.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/client/components/ui/accordion";
import { CheckCircle, XCircle } from "lucide-react";

interface ScorecardResult {
  score: number;
  passed: boolean;
  passedRules: Array<{ id: string; name: string; score: number; weight: number }>;
  failedRules: Array<{
    id: string;
    name: string;
    score: number;
    weight: number;
    message: string;
  }>;
  vertical: string;
  isYmyl: boolean;
}

interface Props {
  scorecard: ScorecardResult;
}

export function ScorecardDisplay({ scorecard }: Props) {
  const threshold = scorecard.isYmyl ? 85 : 70;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>41-Point Scorecard</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-bold ${
                scorecard.passed ? "text-green-600" : "text-red-600"
              }`}
            >
              {scorecard.score}
            </span>
            <span className="text-[13px] text-muted-foreground">
              / 100 (min: {threshold})
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {scorecard.passedRules.length}
            </div>
            <div className="text-[14px] text-muted-foreground">Passed</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {scorecard.failedRules.length}
            </div>
            <div className="text-[14px] text-muted-foreground">Failed</div>
          </div>
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="passed">
            <AccordionTrigger className="text-green-700">
              <span className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                Passed Rules ({scorecard.passedRules.length})
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1 text-[14px]">
                {scorecard.passedRules.map((rule) => (
                  <li key={rule.id} className="flex justify-between">
                    <span>{rule.name}</span>
                    <Badge variant="outline">{rule.score}</Badge>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="failed">
            <AccordionTrigger className="text-red-700">
              <span className="flex items-center">
                <XCircle className="h-4 w-4 mr-2" />
                Failed Rules ({scorecard.failedRules.length})
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 text-[14px]">
                {scorecard.failedRules.map((rule) => (
                  <li key={rule.id} className="border-l-2 border-red-300 pl-2">
                    <div className="flex justify-between font-medium">
                      <span>{rule.name}</span>
                      <Badge variant="destructive">{rule.score}</Badge>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      {rule.message}
                    </p>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
