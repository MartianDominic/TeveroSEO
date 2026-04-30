"use client";

/**
 * CSV Import Page
 * Phase 43-03: CSV Import + Metric Detection
 *
 * Multi-step flow: Upload -> Mapping -> Import -> Complete
 */

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Checkbox,
  Badge,
} from "@tevero/ui";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ColumnMapper } from "./components/ColumnMapper";
import {
  previewCsv,
  importCsv,
  type ColumnMapping,
  type CsvPreviewResponse,
  type CsvImportResponse,
} from "./actions";

type ImportStep = "upload" | "mapping" | "importing" | "complete";

export default function CsvImportPage() {
  const params = useParams();
  const router = useRouter();
  const prospectId = params.prospectId as string;

  const [step, setStep] = useState<ImportStep>("upload");
  const [csvContent, setCsvContent] = useState<string>("");
  const [preview, setPreview] = useState<CsvPreviewResponse | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [forceEnrich, setForceEnrich] = useState(false);
  const [importResult, setImportResult] = useState<CsvImportResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setLoading(true);
      setError(null);

      try {
        const content = await file.text();
        setCsvContent(content);

        const previewData = await previewCsv(prospectId, content);
        setPreview(previewData);
        setMappings(previewData.detection.mappings);
        setStep("mapping");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [prospectId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  const handleImport = async () => {
    setStep("importing");
    setLoading(true);

    try {
      const result = await importCsv(
        prospectId,
        csvContent,
        mappings,
        forceEnrich
      );
      setImportResult(result);
      setStep("complete");
    } catch (e) {
      setError((e as Error).message);
      setStep("mapping");
    } finally {
      setLoading(false);
    }
  };

  const getFormatBadge = (format: string) => {
    const colors: Record<string, string> = {
      ahrefs: "bg-warning-soft text-warning",
      semrush: "bg-info-soft text-info",
      moz: "bg-accent-soft text-accent-ink",
      generic: "bg-surface-2 text-text-2",
      keywords_only: "bg-warning-soft text-warning",
    };
    return (
      <Badge className={colors[format] || colors.generic}>
        {format.replace("_", " ")}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Import Keywords</h1>
        <p className="text-text-3 mt-2">
          Upload a CSV from Ahrefs, SEMrush, Moz, or any other tool
        </p>
      </div>

      {step === "upload" && (
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-[var(--radius-card)] p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-accent bg-accent-soft"
                  : "border-hairline-2 bg-surface-2 hover:bg-surface-3"
              }`}
            >
              <input {...getInputProps()} />
              {loading ? (
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-text-3" />
              ) : (
                <Upload className="h-12 w-12 mx-auto text-text-3" />
              )}
              <p className="mt-4 text-lg">
                {isDragActive
                  ? "Drop your CSV here"
                  : "Drop CSV here or click to upload"}
              </p>
              <p className="text-[12px] text-text-3 mt-2">
                Supports: Ahrefs, SEMrush, Moz, Generic CSV
              </p>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-error-soft text-error rounded-[var(--radius-input)] flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "mapping" && preview && (
        <>
          <Card className="mb-6 shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Detected Format: {getFormatBadge(preview.detection.detectedFormat)}
                  </CardTitle>
                  <CardDescription>
                    {preview.totalRows.toLocaleString()} keywords found
                  </CardDescription>
                </div>
                {preview.detection.enrichmentNeeded ? (
                  <Badge variant="outline" className="text-warning border-warning">
                    API enrichment needed (~$
                    {((preview.totalRows * preview.detection.estimatedCost) / 100).toFixed(2)})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-success border-success">
                    No API needed - metrics present
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ColumnMapper mappings={mappings} onChange={setMappings} />

              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-4">Power User Options</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={forceEnrich}
                      onCheckedChange={(checked) => setForceEnrich(!!checked)}
                    />
                    <span className="text-sm">
                      Force re-enrich (overwrite CSV metrics with fresh data)
                    </span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-error-soft text-error rounded-[var(--radius-input)] flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button onClick={handleImport}>
              Import {preview.totalRows.toLocaleString()} Keywords
            </Button>
          </div>
        </>
      )}

      {step === "importing" && (
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-accent" />
            <p className="mt-4 text-lg">Importing keywords...</p>
          </CardContent>
        </Card>
      )}

      {step === "complete" && importResult && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle className="h-6 w-6" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-surface-2 rounded-[var(--radius-input)] text-center">
                <div className="text-3xl font-bold">
                  {importResult.importResult.inserted}
                </div>
                <div className="text-[12px] text-text-3">New Keywords</div>
              </div>
              <div className="p-4 bg-surface-2 rounded-[var(--radius-input)] text-center">
                <div className="text-3xl font-bold">
                  {importResult.importResult.merged}
                </div>
                <div className="text-[12px] text-text-3">Merged</div>
              </div>
              <div className="p-4 bg-surface-2 rounded-[var(--radius-input)] text-center">
                <div className="text-3xl font-bold">
                  {importResult.importResult.skipped}
                </div>
                <div className="text-[12px] text-text-3">
                  Skipped (duplicates)
                </div>
              </div>
            </div>

            {importResult.importResult.enrichment && (
              <div className="p-4 bg-info-soft rounded-[var(--radius-input)] mb-6">
                <h4 className="font-medium mb-2">Enrichment Summary</h4>
                <p className="text-[12px]">
                  {importResult.importResult.enrichment.enriched} enriched via
                  API |{" "}
                  {importResult.importResult.enrichment.cached} from cache |
                  Cost: $
                  {(
                    importResult.importResult.enrichment.totalCostCents / 100
                  ).toFixed(2)}
                </p>
              </div>
            )}

            {importResult.warnings.length > 0 && (
              <div className="p-4 bg-warning-soft rounded-[var(--radius-input)] mb-6">
                <h4 className="font-medium mb-2">Warnings</h4>
                <ul className="list-disc list-inside text-[12px]">
                  {importResult.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              onClick={() => router.push(`/prospects/${prospectId}/keywords` as Parameters<typeof router.push>[0])}
            >
              View Keywords
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
