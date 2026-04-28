import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Search } from "lucide-react";
import {
  createFormValidationErrors,
  getFieldError,
  shouldValidateFieldOnChange,
} from "@/client/lib/forms";
import type { BacklinksSearchState } from "./backlinksPageTypes";
import { resolveBacklinksSearchScope } from "./backlinksSearchScope";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";

type SearchDraft = Pick<BacklinksSearchState, "target" | "scope">;

function getBacklinksValidationErrors(
  value: SearchDraft,
  shouldValidateUntouchedField: boolean,
) {
  if (value.target.trim()) {
    return null;
  }

  if (!shouldValidateUntouchedField) {
    return null;
  }

  return createFormValidationErrors({
    fields: {
      target: "Enter a domain or URL to analyze.",
    },
  });
}

export function BacklinksSearchCard({
  errorMessage,
  initialValues,
  isFetching,
  onSubmit,
}: {
  errorMessage: string | null;
  initialValues: SearchDraft;
  isFetching: boolean;
  onSubmit: (values: SearchDraft) => void;
}) {
  const [userSelectedScope, setUserSelectedScope] = useState(false);
  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: ({ formApi, value }) =>
        getBacklinksValidationErrors(
          value,
          shouldValidateFieldOnChange(formApi, "target"),
        ),
      onSubmit: ({ value }) => getBacklinksValidationErrors(value, true),
    },
    onSubmit: ({ value }) => {
      const target = value.target.trim();
      const scope = resolveBacklinksSearchScope({
        target,
        selectedScope: value.scope,
        userSelectedScope,
      });

      onSubmit({
        ...value,
        target,
        scope,
      });
    },
  });

  useEffect(() => {
    form.reset(initialValues);
    setUserSelectedScope(false);
  }, [form, initialValues]);

  return (
    <Card className="bg-background border border-border">
      <CardContent className="gap-4">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
              <form.Field name="target">
                {(field) => {
                  const targetError = getFieldError(field.state.meta.errors);

                  return (
                    <label
                      className={`input input-bordered lg:col-span-10 flex items-center gap-2 ${targetError ? "input-error" : ""}`}
                    >
                      <Search className="size-4 text-muted-foreground" />
                      <input
                        placeholder="Enter a domain or URL"
                        value={field.state.value}
                        onChange={(event) => {
                          const nextTarget = event.target.value;
                          field.handleChange(nextTarget);
                          if (!userSelectedScope) {
                            form.setFieldValue(
                              "scope",
                              resolveBacklinksSearchScope({
                                target: nextTarget,
                                selectedScope: form.state.values.scope,
                                userSelectedScope: false,
                              }),
                            );
                          }
                        }}
                      />
                    </label>
                  );
                }}
              </form.Field>

              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    type="submit"
                    className="lg:col-span-2"
                    disabled={isFetching || isSubmitting}
                  >
                    {isFetching || isSubmitting ? "Loading..." : "Search"}
                  </Button>
                )}
              </form.Subscribe>
            </div>

            <form.Field name="target">
              {(field) => {
                const targetError = getFieldError(field.state.meta.errors);

                return targetError ? (
                  <p className="text-sm text-destructive">{targetError}</p>
                ) : null;
              }}
            </form.Field>

            <div className="flex items-center gap-1">
              <form.Field name="scope">
                {(field) => (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={field.state.value === "domain" ? "secondary" : "ghost"}
                      onClick={() => {
                        setUserSelectedScope(true);
                        field.handleChange("domain");
                      }}
                    >
                      Site-wide
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={field.state.value === "page" ? "secondary" : "ghost"}
                      onClick={() => {
                        setUserSelectedScope(true);
                        field.handleChange("page");
                      }}
                    >
                      Exact page
                    </Button>
                  </>
                )}
              </form.Field>
            </div>
          </div>
        </form>

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
