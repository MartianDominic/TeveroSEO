/**
 * Visibility Config Panel Component
 * Phase 96-05: Client Portal
 *
 * Admin panel for configuring per-client visibility settings.
 * Only shown to workspace admins, not clients.
 *
 * Design System v6: ghost-edge shadows, toggle switches.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Switch } from '@/client/components/ui/switch';
import { Label } from '@/client/components/ui/label';

interface VisibilityConfig {
  showClicks: boolean;
  showImpressions: boolean;
  showPosition: boolean;
  showCtr: boolean;
  showQueries: boolean;
  showPages: boolean;
  showCompetitors: boolean;
  canViewGrowing: boolean;
  canViewDecaying: boolean;
  canViewCannibalization: boolean;
  canExport: boolean;
}

interface VisibilityConfigPanelProps {
  clientId: string;
  clientName: string;
  workspaceId: string;
  initialConfig: VisibilityConfig;
  onSave?: (config: VisibilityConfig) => void;
  onCancel?: () => void;
}

const CONFIG_SECTIONS = [
  {
    title: 'Metrics',
    description: 'Control which metrics clients can see',
    fields: [
      { key: 'showClicks', label: 'Clicks', description: 'Show click counts' },
      { key: 'showImpressions', label: 'Impressions', description: 'Show impression counts' },
      { key: 'showPosition', label: 'Position', description: 'Show average position' },
      { key: 'showCtr', label: 'CTR', description: 'Show click-through rate' },
    ],
  },
  {
    title: 'Data Access',
    description: 'Control access to detailed data',
    fields: [
      { key: 'showQueries', label: 'Queries', description: 'Show individual search queries' },
      { key: 'showPages', label: 'Pages', description: 'Show page-level data' },
      { key: 'showCompetitors', label: 'Competitors', description: 'Show competitor analysis' },
    ],
  },
  {
    title: 'Reports',
    description: 'Control access to report sections',
    fields: [
      { key: 'canViewGrowing', label: 'Growing Pages', description: 'View growing content report' },
      { key: 'canViewDecaying', label: 'Decaying Pages', description: 'View decaying content report' },
      {
        key: 'canViewCannibalization',
        label: 'Cannibalization',
        description: 'View keyword cannibalization report',
      },
    ],
  },
  {
    title: 'Actions',
    description: 'Control what clients can do',
    fields: [
      { key: 'canExport', label: 'Export', description: 'Allow CSV and Sheets export' },
    ],
  },
] as const;

export function VisibilityConfigPanel({
  clientId,
  clientName,
  workspaceId,
  initialConfig,
  onSave,
  onCancel,
}: VisibilityConfigPanelProps) {
  const [config, setConfig] = useState<VisibilityConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Check if config has changed from initial
    const changed = Object.keys(config).some(
      (key) => config[key as keyof VisibilityConfig] !== initialConfig[key as keyof VisibilityConfig]
    );
    setHasChanges(changed);
  }, [config, initialConfig]);

  const handleToggle = (key: keyof VisibilityConfig) => {
    setConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/analytics/visibility/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-ID': workspaceId,
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        onSave?.(config);
      } else {
        const error = (await response.json()) as { error?: string };
        console.error('Failed to save visibility config:', error.error);
      }
    } catch (error) {
      console.error('Failed to save visibility config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(initialConfig);
  };

  return (
    <Card className="bg-surface shadow-card">
      <CardHeader className="pb-4 border-b border-hairline">
        <CardTitle className="text-[16px] font-medium text-text-1">
          Visibility Settings
        </CardTitle>
        <p className="text-[13px] text-text-3 mt-1">
          Configure what <span className="font-medium text-text-2">{clientName}</span> can see in
          their portal
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-6">
          {CONFIG_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-3">
              <div>
                <h3 className="text-[14px] font-medium text-text-1">{section.title}</h3>
                <p className="text-[12px] text-text-3">{section.description}</p>
              </div>
              <div className="space-y-2 pl-4 border-l-2 border-hairline">
                {section.fields.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center justify-between py-2 hover:bg-surface-raised/50 rounded px-2 -mx-2 transition-colors"
                  >
                    <div>
                      <Label
                        htmlFor={field.key}
                        className="text-[13px] font-medium text-text-1 cursor-pointer"
                      >
                        {field.label}
                      </Label>
                      <p className="text-sm text-text-3">{field.description}</p>
                    </div>
                    <Switch
                      id={field.key}
                      checked={config[field.key as keyof VisibilityConfig]}
                      onCheckedChange={() => handleToggle(field.key as keyof VisibilityConfig)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-hairline">
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-[12px] text-amber-600">Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
                Cancel
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={!hasChanges || isSaving}
            >
              Reset
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Quick visibility presets
 */
export function VisibilityPresets({
  onApply,
}: {
  onApply: (config: Partial<VisibilityConfig>) => void;
}) {
  const presets = [
    {
      name: 'Full Access',
      description: 'Client sees everything',
      config: {
        showClicks: true,
        showImpressions: true,
        showPosition: true,
        showCtr: true,
        showQueries: true,
        showPages: true,
        showCompetitors: true,
        canViewGrowing: true,
        canViewDecaying: true,
        canViewCannibalization: true,
        canExport: true,
      },
    },
    {
      name: 'Basic Metrics',
      description: 'Clicks, impressions, position only',
      config: {
        showClicks: true,
        showImpressions: true,
        showPosition: true,
        showCtr: true,
        showQueries: false,
        showPages: true,
        showCompetitors: false,
        canViewGrowing: true,
        canViewDecaying: true,
        canViewCannibalization: false,
        canExport: false,
      },
    },
    {
      name: 'Minimal',
      description: 'Just the essentials',
      config: {
        showClicks: true,
        showImpressions: false,
        showPosition: true,
        showCtr: false,
        showQueries: false,
        showPages: false,
        showCompetitors: false,
        canViewGrowing: false,
        canViewDecaying: false,
        canViewCannibalization: false,
        canExport: false,
      },
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <button
          key={preset.name}
          onClick={() => onApply(preset.config)}
          className="px-3 py-1.5 text-[12px] font-medium text-text-2 bg-surface-raised hover:bg-surface-active rounded-md transition-colors"
          title={preset.description}
        >
          {preset.name}
        </button>
      ))}
    </div>
  );
}
