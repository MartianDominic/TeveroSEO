import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import type { KeywordResearchControllerState } from "./types";

export function FilterTextInput({
  form,
  name,
  label,
  placeholder,
}: {
  form: KeywordResearchControllerState["filtersForm"];
  name: "include" | "exclude";
  label: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <form.Field name={name}>
        {(field) => (
          <Input
            className="h-8 text-sm bg-background"
            placeholder={placeholder}
            value={field.state.value}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>
    </div>
  );
}

export function FilterRangeInputs({
  form,
  title,
  minName,
  maxName,
  step,
}: {
  form: KeywordResearchControllerState["filtersForm"];
  title: string;
  minName: "minVol" | "minCpc" | "minKd";
  maxName: "maxVol" | "maxCpc" | "maxKd";
  step?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <CompactRangeInput
          form={form}
          name={minName}
          placeholder="Min"
          step={step}
        />
        <CompactRangeInput
          form={form}
          name={maxName}
          placeholder="Max"
          step={step}
        />
      </div>
    </div>
  );
}

function CompactRangeInput({
  form,
  name,
  placeholder,
  step,
}: {
  form: KeywordResearchControllerState["filtersForm"];
  name: "minVol" | "maxVol" | "minCpc" | "maxCpc" | "minKd" | "maxKd";
  placeholder: string;
  step?: string;
}) {
  return (
    <form.Field name={name}>
      {(field) => (
        <Input
          className="h-6 text-xs bg-background px-2"
          placeholder={placeholder}
          type="number"
          step={step}
          value={field.state.value}
          onChange={(event) => field.handleChange(event.target.value)}
        />
      )}
    </form.Field>
  );
}

export function EmptyFilterResults({
  activeFilterCount,
  resetFilters,
}: {
  activeFilterCount: number;
  resetFilters: () => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4 text-muted-foreground gap-3">
      <p className="text-sm font-medium">
        No keywords match your current filters.
      </p>
      {activeFilterCount > 0 ? (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
