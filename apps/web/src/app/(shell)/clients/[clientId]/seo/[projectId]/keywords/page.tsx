"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Save, Trash2, Loader2, TrendingUp } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from "@tevero/ui";
import {
  researchKeywords,
  saveKeywords,
  getSavedKeywords,
  removeSavedKeyword,
} from "@/actions/seo/keywords";

interface KeywordResult {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
  trend?: number[];
}

interface SavedKeyword {
  id: string;
  keyword: string;
  searchVolume: number;
  competition: number;
  savedAt: string;
}

export default function KeywordsPage() {
  const params = useParams<{ clientId: string; projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clientId, projectId } = params;

  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [locationCode, setLocationCode] = useState("2840"); // US
  const [resultLimit, setResultLimit] = useState("50");
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(
    new Set()
  );

  // Saved keywords query
  const savedQuery = useQuery({
    queryKey: ["saved-keywords", projectId, clientId],
    queryFn: () => getSavedKeywords({ projectId, clientId }),
  });

  // Research mutation
  const researchMutation = useMutation({
    mutationFn: () =>
      researchKeywords({
        projectId,
        clientId,
        keyword,
        locationCode: parseInt(locationCode, 10),
        resultLimit: parseInt(resultLimit, 10),
      }),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (keywords: unknown[]) =>
      saveKeywords({ projectId, clientId, keywords }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-keywords"] });
      setSelectedKeywords(new Set());
    },
  });

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: (savedKeywordId: string) =>
      removeSavedKeyword({ projectId, clientId, savedKeywordId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-keywords"] });
    },
  });

  const handleSearch = () => {
    if (!keyword.trim()) return;
    researchMutation.mutate();
    // Update URL
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("q", keyword);
    router.replace(`?${newParams.toString()}`);
  };

  const handleSaveSelected = () => {
    const results = (researchMutation.data as { rows?: KeywordResult[] })
      ?.rows ?? [];
    const toSave = results.filter((r) => selectedKeywords.has(r.keyword));
    if (toSave.length > 0) {
      saveMutation.mutate(toSave);
    }
  };

  const toggleKeyword = (kw: string) => {
    const newSet = new Set(selectedKeywords);
    if (newSet.has(kw)) {
      newSet.delete(kw);
    } else {
      newSet.add(kw);
    }
    setSelectedKeywords(newSet);
  };

  const results = (researchMutation.data as { rows?: KeywordResult[] })
    ?.rows ?? [];
  const saved = (savedQuery.data as { rows?: SavedKeyword[] })?.rows ?? [];

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold">Keyword Research</h1>

        {/* Search Form */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="keyword">Seed Keyword</Label>
                <Input
                  id="keyword"
                  placeholder="Enter a keyword..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>

              <div className="w-32 space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select value={locationCode} onValueChange={setLocationCode}>
                  <SelectTrigger id="location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2840">United States</SelectItem>
                    <SelectItem value="2826">United Kingdom</SelectItem>
                    <SelectItem value="2036">Australia</SelectItem>
                    <SelectItem value="2124">Canada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-32 space-y-2">
                <Label htmlFor="limit">Results</Label>
                <Select value={resultLimit} onValueChange={setResultLimit}>
                  <SelectTrigger id="limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSearch}
                disabled={!keyword.trim() || researchMutation.isPending}
              >
                {researchMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Research
              </Button>

              {selectedKeywords.size > 0 && (
                <Button
                  variant="outline"
                  onClick={handleSaveSelected}
                  disabled={saveMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save {selectedKeywords.size} keywords
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Keyword Ideas ({results.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {results.map((result) => (
                  <div
                    key={result.keyword}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-muted/50 ${
                      selectedKeywords.has(result.keyword) ? "bg-primary/10" : ""
                    }`}
                    onClick={() => toggleKeyword(result.keyword)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedKeywords.has(result.keyword)}
                        onChange={() => toggleKeyword(result.keyword)}
                        className="h-4 w-4"
                      />
                      <span className="font-medium">{result.keyword}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{result.searchVolume.toLocaleString()} vol</span>
                      <Badge variant="outline">
                        {(result.competition * 100).toFixed(0)}% comp
                      </Badge>
                      <span>${result.cpc.toFixed(2)} CPC</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saved Keywords */}
        <Card>
          <CardHeader>
            <CardTitle>Saved Keywords ({saved.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {savedQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : saved.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No saved keywords yet. Research and save keywords above.
              </p>
            ) : (
              <div className="space-y-1">
                {saved.map((kw) => (
                  <div
                    key={kw.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                  >
                    <div>
                      <span className="font-medium">{kw.keyword}</span>
                      <span className="ml-4 text-sm text-muted-foreground">
                        {kw.searchVolume.toLocaleString()} vol
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMutation.mutate(kw.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
