"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { Input, Label } from "@tevero/ui";

/**
 * Validate hex color format (#RRGGBB).
 */
function isValidHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

interface ColorPickerProps {
  /** Current color value (hex format #RRGGBB) */
  value: string;
  /** Called when color changes */
  onChange: (color: string) => void;
  /** Called when user finishes editing (blur) */
  onBlur?: () => void;
  /** Field label */
  label: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Preset color options */
  presets?: string[];
}

/** Default preset colors (common brand colors) */
const DEFAULT_PRESETS = [
  "#3b82f6", // Blue (Tevero default)
  "#10b981", // Green (Tevero default)
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#6366f1", // Indigo
  "#000000", // Black
];

/**
 * Color picker with hex input and visual picker.
 *
 * - Native color picker for visual selection
 * - Manual hex input with validation
 * - Preset color swatches
 */
export function ColorPicker({
  value,
  onChange,
  onBlur,
  label,
  disabled = false,
  presets = DEFAULT_PRESETS,
}: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync input value when external value changes
  useEffect(() => {
    setInputValue(value);
    setIsValid(isValidHex(value));
  }, [value]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;
      // Auto-add # prefix if missing
      if (newValue && !newValue.startsWith("#")) {
        newValue = "#" + newValue;
      }
      setInputValue(newValue);
      const valid = isValidHex(newValue);
      setIsValid(valid);
      if (valid) {
        onChange(newValue);
      }
    },
    [onChange],
  );

  const handleColorPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setIsValid(true);
      onChange(newValue);
    },
    [onChange],
  );

  const handlePresetClick = useCallback(
    (color: string) => {
      if (disabled) return;
      setInputValue(color);
      setIsValid(true);
      onChange(color);
    },
    [disabled, onChange],
  );

  const handleBlur = useCallback(() => {
    if (!isValid) {
      // Reset to last valid value
      setInputValue(value);
      setIsValid(true);
    }
    onBlur?.();
  }, [isValid, value, onBlur]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>

      <div className="flex items-center gap-2">
        {/* Native color picker */}
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          disabled={disabled}
          className={`
            w-10 h-10 rounded-md border border-border shadow-sm
            transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
          style={{ backgroundColor: isValid ? inputValue : value }}
          aria-label={`Pick ${label}`}
        >
          <input
            ref={colorInputRef}
            type="color"
            value={isValid ? inputValue : value}
            onChange={handleColorPickerChange}
            disabled={disabled}
            className="sr-only"
          />
        </button>

        {/* Hex input */}
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder="#000000"
          disabled={disabled}
          className={`w-28 font-mono uppercase ${!isValid ? "border-destructive" : ""}`}
          maxLength={7}
        />
      </div>

      {/* Validation error */}
      {!isValid && (
        <p className="text-xs text-destructive">
          Invalid hex color (use format #RRGGBB)
        </p>
      )}

      {/* Preset swatches */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handlePresetClick(color)}
            disabled={disabled}
            className={`
              w-6 h-6 rounded-sm border transition-all
              ${value === color ? "ring-2 ring-ring ring-offset-1" : "border-border"}
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-110"}
            `}
            style={{ backgroundColor: color }}
            title={color}
            aria-label={`Select ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
