/**
 * BrandConfigEditor component
 * Phase 30: Interactive Proposals - Builder UI
 *
 * Allows editing proposal branding (logo, colors, font).
 */
import { useState } from "react";
import { Card } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Button } from "@/client/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Upload, X, Palette } from "lucide-react";
import type { BrandConfig } from "@/db/proposal-schema";

interface BrandConfigEditorProps {
  config: BrandConfig;
  onChange: (config: BrandConfig) => void;
}

const FONT_FAMILIES = [
  { id: "Inter", name: "Inter", sample: "Aa" },
  { id: "Roboto", name: "Roboto", sample: "Aa" },
  { id: "Open Sans", name: "Open Sans", sample: "Aa" },
  { id: "Lato", name: "Lato", sample: "Aa" },
  { id: "Poppins", name: "Poppins", sample: "Aa" },
  { id: "Montserrat", name: "Montserrat", sample: "Aa" },
];

const COLOR_PRESETS = [
  { primary: "#2563eb", secondary: "#1e40af", name: "Blue" },
  { primary: "#16a34a", secondary: "#15803d", name: "Green" },
  { primary: "#7c3aed", secondary: "#6d28d9", name: "Purple" },
  { primary: "#dc2626", secondary: "#b91c1c", name: "Red" },
  { primary: "#ea580c", secondary: "#c2410c", name: "Orange" },
  { primary: "#0891b2", secondary: "#0e7490", name: "Teal" },
];

/**
 * Renders brand configuration form
 */
export function BrandConfigEditor({ config, onChange }: BrandConfigEditorProps) {
  const [logoPreview, setLogoPreview] = useState<string | null>(config.logoUrl);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview URL
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      onChange({ ...config, logoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    onChange({ ...config, logoUrl: null });
  };

  const handleColorChange = (key: "primaryColor" | "secondaryColor", value: string) => {
    onChange({ ...config, [key]: value });
  };

  const handlePresetClick = (preset: { primary: string; secondary: string }) => {
    onChange({
      ...config,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Brand Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Customize the proposal's appearance to match your brand
        </p>
      </div>

      {/* Logo upload */}
      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <div className="relative">
              <div className="w-32 h-16 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={handleRemoveLogo}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <label className="w-32 h-16 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mt-1">Upload</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </label>
          )}
          <p className="text-sm text-muted-foreground">
            Recommended: PNG or SVG, max 2MB
          </p>
        </div>
      </div>

      {/* Color scheme */}
      <div className="space-y-4">
        <Label className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Color Scheme
        </Label>

        {/* Color presets */}
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted transition-colors ${
                config.primaryColor === preset.primary
                  ? "ring-2 ring-primary ring-offset-2"
                  : ""
              }`}
            >
              <div className="flex">
                <div
                  className="w-4 h-4 rounded-l"
                  style={{ backgroundColor: preset.primary }}
                />
                <div
                  className="w-4 h-4 rounded-r"
                  style={{ backgroundColor: preset.secondary }}
                />
              </div>
              <span className="text-sm">{preset.name}</span>
            </button>
          ))}
        </div>

        {/* Custom colors */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary-color">Primary Color</Label>
            <div className="flex gap-2">
              <Input
                id="primary-color"
                type="color"
                value={config.primaryColor}
                onChange={(e) => handleColorChange("primaryColor", e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                type="text"
                value={config.primaryColor}
                onChange={(e) => handleColorChange("primaryColor", e.target.value)}
                className="flex-1 font-mono"
                placeholder="#2563eb"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondary-color">Secondary Color</Label>
            <div className="flex gap-2">
              <Input
                id="secondary-color"
                type="color"
                value={config.secondaryColor}
                onChange={(e) => handleColorChange("secondaryColor", e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                type="text"
                value={config.secondaryColor}
                onChange={(e) => handleColorChange("secondaryColor", e.target.value)}
                className="flex-1 font-mono"
                placeholder="#1e40af"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Font family */}
      <div className="space-y-2">
        <Label>Font Family</Label>
        <Select
          value={config.fontFamily}
          onValueChange={(value) => onChange({ ...config, fontFamily: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.id} value={font.id}>
                <span style={{ fontFamily: font.id }}>{font.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Preview card */}
      <Card className="p-4 overflow-hidden">
        <p className="text-sm text-muted-foreground mb-2">Preview</p>
        <div
          className="p-4 rounded-lg text-white"
          style={{
            background: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})`,
            fontFamily: config.fontFamily,
          }}
        >
          {logoPreview && (
            <img src={logoPreview} alt="Logo" className="h-8 mb-2" />
          )}
          <h4 className="text-lg font-bold">Sample Headline</h4>
          <p className="text-sm opacity-90">This is how your proposal will look</p>
        </div>
      </Card>
    </div>
  );
}
