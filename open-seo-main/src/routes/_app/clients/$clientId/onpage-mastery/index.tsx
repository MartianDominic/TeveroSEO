/**
 * On-Page Mastery Dashboard
 * Phase 92-09: UI Components for On-Page Mastery
 *
 * Main dashboard page for on-page SEO quality visualization.
 * Includes Tier 5 toggle and scorecard display.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Switch } from "@/client/components/ui/switch";
import { Label } from "@/client/components/ui/label";

interface SettingsData {
  tier5Enabled: boolean;
  verticalOverride: string | null;
  qualityGateTier: string;
  excludedChecks: string[];
}

interface ScoreData {
  id: string;
  score: number;
  pageUrl: string;
}

export const Route = createFileRoute(
  "/_app/clients/$clientId/onpage-mastery/" as never
)({
  component: OnPageMasteryDashboard,
});

function OnPageMasteryDashboard() {
  const { clientId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["onpage-settings", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/onpage-mastery/settings/${clientId}`);
      const json = (await res.json()) as { data: SettingsData };
      return json.data;
    },
  });

  const { data: scores, isLoading: scoresLoading } = useQuery({
    queryKey: ["onpage-scores", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/onpage-mastery/scorecard/${clientId}`);
      const json = (await res.json()) as { data: ScoreData[] };
      return json.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch(`/api/onpage-mastery/settings/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier5Enabled: enabled }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onpage-settings", clientId] });
    },
  });

  if (settingsLoading || scoresLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">On-Page SEO Mastery</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="tier5"
              checked={settings?.tier5Enabled ?? false}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
            <Label htmlFor="tier5" className="text-[14px]">
              Enable Tier 5 Quality Checks
            </Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quality Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-[14px]">
              {scores?.length || 0} pages analyzed with Tier 5 quality checks
            </p>
            {settings?.tier5Enabled ? (
              <p className="text-green-600 text-[14px] mt-2">
                Tier 5 checks are enabled for this client.
              </p>
            ) : (
              <p className="text-yellow-600 text-[14px] mt-2">
                Enable Tier 5 to access advanced quality analysis.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Quality Gate Tier:</dt>
                <dd className="font-medium">
                  {settings?.qualityGateTier || "basic"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Vertical Override:</dt>
                <dd className="font-medium">
                  {settings?.verticalOverride || "Auto-detect"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Excluded Checks:</dt>
                <dd className="font-medium">
                  {settings?.excludedChecks?.length || 0}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
