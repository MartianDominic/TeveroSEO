import type { FormEvent } from "react";
import { AlertCircle, Search } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { getFieldError, getFormError } from "@/client/lib/forms";
import type { useDomainOverviewController } from "@/client/features/domain/useDomainOverviewController";
import { toSortMode } from "@/client/features/domain/utils";
import type { DomainSortMode } from "@/client/features/domain/types";

type Props = {
  controlsForm: ReturnType<typeof useDomainOverviewController>["controlsForm"];
  isLoading: boolean;
  onSubmit: (event: FormEvent) => void;
  onSortChange: (sort: DomainSortMode) => void;
};

export function DomainSearchCard({
  controlsForm,
  isLoading,
  onSubmit,
  onSortChange,
}: Props) {
  return (
    <Card>
      <CardContent className="gap-4 pt-6">
        <form
          className="grid grid-cols-1 gap-3 lg:grid-cols-12"
          onSubmit={onSubmit}
        >
          <controlsForm.Field name="domain">
            {(field) => {
              const domainError = getFieldError(field.state.meta.errors);

              return (
                <label
                  className={`flex items-center gap-2 h-10 rounded-md border bg-background px-3 text-sm lg:col-span-8 ${domainError ? "border-destructive" : "border-input"} focus-within:outline-none focus-within:ring-2 focus-within:ring-ring`}
                >
                  <Search className="size-4 text-muted-foreground shrink-0" />
                  <input
                    className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                    placeholder="Enter a domain (e.g. coolify.io or example.com/blog)"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={domainError ? true : undefined}
                    aria-describedby={
                      domainError ? "domain-input-error" : undefined
                    }
                  />
                </label>
              );
            }}
          </controlsForm.Field>

          <controlsForm.Field name="sort">
            {(field) => (
              <select
                className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
                value={field.state.value}
                onChange={(event) => {
                  const next = toSortMode(event.target.value) ?? "rank";
                  field.handleChange(next);
                  onSortChange(next);
                }}
              >
                <option value="rank">By Rank</option>
                <option value="traffic">By Traffic</option>
                <option value="volume">By Volume</option>
                <option value="score">By Score</option>
                <option value="cpc">By CPC</option>
              </select>
            )}
          </controlsForm.Field>

          <controlsForm.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                className="lg:col-span-2"
                disabled={isLoading || isSubmitting}
              >
                {isLoading || isSubmitting ? "Loading..." : "Search"}
              </Button>
            )}
          </controlsForm.Subscribe>
        </form>

        <controlsForm.Field name="domain">
          {(field) => {
            const domainError = getFieldError(field.state.meta.errors);

            return domainError ? (
              <p id="domain-input-error" className="text-sm text-destructive">
                {domainError}
              </p>
            ) : null;
          }}
        </controlsForm.Field>

        <controlsForm.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(submitError) => {
            const errorMessage = getFormError(submitError);

            return errorMessage ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            ) : null;
          }}
        </controlsForm.Subscribe>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <controlsForm.Field name="subdomains">
              {(field) => (
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                  }
                />
              )}
            </controlsForm.Field>
            <span className="text-sm">Include subdomains</span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
