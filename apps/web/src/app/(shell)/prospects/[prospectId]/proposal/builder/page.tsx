"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import { Loader2, FileText, Eye, ArrowLeft, ArrowRight } from "lucide-react";
import { ScenarioSelector } from "./components/ScenarioSelector";
import { SectionEditor } from "./components/SectionEditor";
import {
  generateProposal,
  type ProposalScenario,
  type AwarenessLevel,
  type GeneratedSection,
} from "./actions";

type BuilderStep = "scenario" | "customize" | "pricing" | "sections";

const AWARENESS_LABELS: Record<AwarenessLevel, string> = {
  unaware: "Unaware - Doesn't know they have a problem",
  "problem-aware": "Problem Aware - Knows the problem, not solutions",
  "solution-aware": "Solution Aware - Knows solutions exist",
  "product-aware": "Product Aware - Knows your offer",
  "most-aware": "Most Aware - Ready to buy",
};

export default function ProposalBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const prospectId = params.prospectId as string;

  const [step, setStep] = useState<BuilderStep>("scenario");
  const [scenario, setScenario] = useState<ProposalScenario>("full_audit");
  const [awarenessLevel, setAwarenessLevel] =
    useState<AwarenessLevel>("problem-aware");
  const [pricing, setPricing] = useState({
    setupFee: 500,
    monthlyFee: 800,
    contractMonths: 6,
  });
  const [agencyInfo, setAgencyInfo] = useState({
    name: "",
    positioning: "",
    differentiators: [] as string[],
  });

  const [proposalId, setProposalId] = useState<string | null>(null);
  const [sections, setSections] = useState<GeneratedSection[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateProposal({
        prospectId,
        scenario,
        awarenessLevel,
        pricing,
        agencyInfo: agencyInfo.name ? agencyInfo : undefined,
      });
      setProposalId(result.proposalId);
      setSections(result.sections);
      setAwarenessLevel(result.awarenessLevel);
      setStep("sections");
    });
  };

  const handleSectionUpdate = (index: number, updatedSection: GeneratedSection) => {
    setSections((prev) => {
      const newSections = [...prev];
      newSections[index] = updatedSection;
      return newSections;
    });
  };

  const handlePreview = () => {
    if (!proposalId) return;
    router.push(`/prospects/${prospectId}/proposal/preview?id=${proposalId}` as Parameters<typeof router.push>[0]);
  };

  const renderStepContent = () => {
    switch (step) {
      case "scenario":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">
                Select Proposal Type
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Choose the type of proposal that best fits this prospect&apos;s
                needs.
              </p>
            </div>
            <ScenarioSelector value={scenario} onChange={setScenario} />
            <div className="flex justify-end">
              <Button onClick={() => setStep("customize")}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "customize":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">
                Customize Content
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Adjust the awareness level and agency positioning.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Awareness Level</CardTitle>
                <CardDescription>
                  The AI will detect this automatically, but you can override it
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={awarenessLevel}
                  onValueChange={(v) => setAwarenessLevel(v as AwarenessLevel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(AWARENESS_LABELS) as [AwarenessLevel, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agency Info (Optional)</CardTitle>
                <CardDescription>
                  Add your agency details for personalized proposals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="agency-name">Agency Name</Label>
                  <Input
                    id="agency-name"
                    value={agencyInfo.name}
                    onChange={(e) =>
                      setAgencyInfo({ ...agencyInfo, name: e.target.value })
                    }
                    placeholder="Your Agency Name"
                  />
                </div>
                <div>
                  <Label htmlFor="positioning">Positioning Statement</Label>
                  <Input
                    id="positioning"
                    value={agencyInfo.positioning}
                    onChange={(e) =>
                      setAgencyInfo({
                        ...agencyInfo,
                        positioning: e.target.value,
                      })
                    }
                    placeholder="We help X achieve Y through Z"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("scenario")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep("pricing")}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "pricing":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">
                Set Pricing
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure the investment section pricing.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pricing Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="setup-fee">Setup Fee (EUR)</Label>
                    <Input
                      id="setup-fee"
                      type="number"
                      value={pricing.setupFee}
                      onChange={(e) =>
                        setPricing({
                          ...pricing,
                          setupFee: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="monthly-fee">Monthly Fee (EUR)</Label>
                    <Input
                      id="monthly-fee"
                      type="number"
                      value={pricing.monthlyFee}
                      onChange={(e) =>
                        setPricing({
                          ...pricing,
                          monthlyFee: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="contract-months">Contract (months)</Label>
                    <Input
                      id="contract-months"
                      type="number"
                      value={pricing.contractMonths}
                      onChange={(e) =>
                        setPricing({
                          ...pricing,
                          contractMonths: parseInt(e.target.value) || 6,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Contract Value:</span>
                    <span className="font-semibold">
                      {(
                        pricing.setupFee +
                        pricing.monthlyFee * pricing.contractMonths
                      ).toLocaleString()}{" "}
                      EUR
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("customize")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleGenerate} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Proposal
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case "sections":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  Edit Sections
                </h2>
                <p className="text-sm text-muted-foreground">
                  Review and edit the generated proposal sections.
                </p>
              </div>
              <Button onClick={handlePreview}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </div>

            <div className="space-y-4">
              {sections.map((section, index) => (
                <SectionEditor
                  key={section.type}
                  proposalId={proposalId!}
                  section={section}
                  onUpdate={(updated) => handleSectionUpdate(index, updated)}
                />
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("pricing")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pricing
              </Button>
              <Button onClick={handlePreview}>
                <Eye className="mr-2 h-4 w-4" />
                Preview Proposal
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Prospect
        </Button>
        <h1 className="text-2xl font-bold">Proposal Builder</h1>
        <p className="text-muted-foreground">
          Generate an AI-powered proposal with copywriting frameworks
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2">
          {(["scenario", "customize", "pricing", "sections"] as BuilderStep[]).map(
            (s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : sections.length > 0 || ["scenario", "customize", "pricing"].indexOf(step) >= i
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 3 && (
                  <div className="w-12 h-0.5 bg-muted mx-1" />
                )}
              </div>
            )
          )}
        </div>
      </div>

      {renderStepContent()}
    </div>
  );
}
