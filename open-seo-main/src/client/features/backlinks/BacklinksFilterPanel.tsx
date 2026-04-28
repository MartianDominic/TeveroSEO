import { RotateCcw } from "lucide-react";
import type { BacklinksTab } from "@/types/schemas/backlinks";
import type { BacklinksFiltersState } from "./useBacklinksFilters";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Checkbox } from "@/client/components/ui/checkbox";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = { Field: React.ComponentType<any> };

function FilterTextInput({
  form,
  name,
  label,
  placeholder,
}: {
  form: AnyForm;
  name: string;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <form.Field name={name}>
        {(field: {
          state: { value: string };
          handleChange: (v: string) => void;
        }) => (
          <Input
            className="h-8 text-sm bg-background w-full"
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
  form: AnyForm;
  title: string;
  minName: string;
  maxName: string;
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
  form: AnyForm;
  name: string;
  placeholder: string;
  step?: string;
}) {
  return (
    <form.Field name={name}>
      {(field: {
        state: { value: string };
        handleChange: (v: string) => void;
      }) => (
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

function BacklinksTabFilters({
  form,
}: {
  form: BacklinksFiltersState["backlinks"]["form"];
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <FilterTextInput
          form={form}
          name="include"
          label="Include Terms"
          placeholder="example.com, blog"
        />
        <FilterTextInput
          form={form}
          name="exclude"
          label="Exclude Terms"
          placeholder="spam, forum"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <FilterRangeInputs
          form={form}
          title="Domain Authority"
          minName="minDomainRank"
          maxName="maxDomainRank"
        />
        <FilterRangeInputs
          form={form}
          title="Link Authority"
          minName="minLinkAuthority"
          maxName="maxLinkAuthority"
        />
        <FilterRangeInputs
          form={form}
          title="Spam Score"
          minName="minSpamScore"
          maxName="maxSpamScore"
          step="0.1"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Link Type
          </p>
          <form.Field name="linkType">
            {(field) => (
              <div className="flex items-center gap-1">
                {(["", "dofollow", "nofollow"] as const).map((value) => (
                  <Button
                    key={value || "all"}
                    type="button"
                    size="sm"
                    variant={field.state.value === value ? "secondary" : "ghost"}
                    onClick={() => field.handleChange(value)}
                  >
                    {value === ""
                      ? "All"
                      : value === "dofollow"
                        ? "Dofollow"
                        : "Nofollow"}
                  </Button>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Visibility
          </p>
          <div className="flex items-center gap-3">
            <form.Field name="hideLost">
              {(field) => (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    className="h-3 w-3 shrink-0"
                    checked={field.state.value === "true"}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked ? "true" : "")
                    }
                  />
                  <span className="text-xs">Hide lost</span>
                </label>
              )}
            </form.Field>
            <form.Field name="hideBroken">
              {(field) => (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    className="h-3 w-3 shrink-0"
                    checked={field.state.value === "true"}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked ? "true" : "")
                    }
                  />
                  <span className="text-xs">Hide broken</span>
                </label>
              )}
            </form.Field>
          </div>
        </div>
      </div>
    </>
  );
}

function ReferringDomainsFilters({
  form,
}: {
  form: BacklinksFiltersState["domains"]["form"];
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <FilterTextInput
          form={form}
          name="include"
          label="Include Terms"
          placeholder="example.com, blog"
        />
        <FilterTextInput
          form={form}
          name="exclude"
          label="Exclude Terms"
          placeholder="spam, forum"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <FilterRangeInputs
          form={form}
          title="Backlinks"
          minName="minBacklinks"
          maxName="maxBacklinks"
        />
        <FilterRangeInputs
          form={form}
          title="Rank"
          minName="minRank"
          maxName="maxRank"
        />
      </div>
    </>
  );
}

function TopPagesFilters({
  form,
}: {
  form: BacklinksFiltersState["pages"]["form"];
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <FilterTextInput
          form={form}
          name="include"
          label="Include Terms"
          placeholder="/blog, /products"
        />
        <FilterTextInput
          form={form}
          name="exclude"
          label="Exclude Terms"
          placeholder="/tag, /author"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <FilterRangeInputs
          form={form}
          title="Backlinks"
          minName="minBacklinks"
          maxName="maxBacklinks"
        />
        <FilterRangeInputs
          form={form}
          title="Referring Domains"
          minName="minReferringDomains"
          maxName="maxReferringDomains"
        />
        <FilterRangeInputs
          form={form}
          title="Rank"
          minName="minRank"
          maxName="maxRank"
        />
      </div>
    </>
  );
}

export function BacklinksFilterPanel({
  activeTab,
  filters,
}: {
  activeTab: BacklinksTab;
  filters: BacklinksFiltersState;
}) {
  const current = filters[activeTab];

  return (
    <div className="shrink-0 border-b border-border bg-gradient-to-b from-background to-muted/30 px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Refine results</p>
          {current.activeFilterCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-primary px-1.5 py-0 text-[10px] font-medium text-primary-foreground border-0">
              {current.activeFilterCount} active
            </span>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1"
          onClick={current.reset}
          disabled={current.activeFilterCount === 0}
        >
          <RotateCcw className="size-3" />
          Clear all
        </Button>
      </div>

      {activeTab === "backlinks" ? (
        <BacklinksTabFilters form={filters.backlinks.form} />
      ) : null}
      {activeTab === "domains" ? (
        <ReferringDomainsFilters form={filters.domains.form} />
      ) : null}
      {activeTab === "pages" ? (
        <TopPagesFilters form={filters.pages.form} />
      ) : null}
    </div>
  );
}
