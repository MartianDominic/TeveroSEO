import { RotateCcw } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { Input } from "@/client/components/ui/input";
import type { useDomainFilters } from "@/client/features/domain/hooks/useDomainFilters";
import type { DomainFilterValues } from "@/client/features/domain/types";

type FilterForm = ReturnType<typeof useDomainFilters>["filtersForm"];

type Props = {
  filtersForm: FilterForm;
  activeFilterCount: number;
  resetFilters: () => void;
};

export function DomainFilterPanel({
  filtersForm,
  activeFilterCount,
  resetFilters,
}: Props) {
  return (
    <div className="border-b border-border bg-gradient-to-b from-background to-muted/30 px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Refine table results</p>
          {activeFilterCount > 0 ? (
            <Badge className="text-[10px] px-1 py-0">
              {activeFilterCount} active
            </Badge>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 h-7 text-xs"
          onClick={resetFilters}
          disabled={activeFilterCount === 0}
        >
          <RotateCcw className="size-3" />
          Clear all
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <FilterTextInput
          form={filtersForm}
          name="include"
          label="Include Terms"
          placeholder="audit, checker, template"
        />
        <FilterTextInput
          form={filtersForm}
          name="exclude"
          label="Exclude Terms"
          placeholder="jobs, salary, course"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <FilterRangeInputs
          form={filtersForm}
          title="Traffic"
          minName="minTraffic"
          maxName="maxTraffic"
        />
        <FilterRangeInputs
          form={filtersForm}
          title="Volume"
          minName="minVol"
          maxName="maxVol"
        />
        <FilterRangeInputs
          form={filtersForm}
          title="CPC (USD)"
          minName="minCpc"
          maxName="maxCpc"
          step="0.01"
        />
        <FilterRangeInputs
          form={filtersForm}
          title="Score (KD)"
          minName="minKd"
          maxName="maxKd"
        />
        <FilterRangeInputs
          form={filtersForm}
          title="Rank"
          minName="minRank"
          maxName="maxRank"
        />
      </div>
    </div>
  );
}

function FilterTextInput({
  form,
  name,
  label,
  placeholder,
}: {
  form: FilterForm;
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

function FilterRangeInputs({
  form,
  title,
  minName,
  maxName,
  step,
}: {
  form: FilterForm;
  title: string;
  minName: keyof DomainFilterValues;
  maxName: keyof DomainFilterValues;
  step?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <form.Field name={minName}>
          {(field) => (
            <Input
              className="h-6 text-xs bg-background px-2"
              placeholder="Min"
              type="number"
              step={step}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          )}
        </form.Field>
        <form.Field name={maxName}>
          {(field) => (
            <Input
              className="h-6 text-xs bg-background px-2"
              placeholder="Max"
              type="number"
              step={step}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          )}
        </form.Field>
      </div>
    </div>
  );
}
