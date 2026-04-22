"use client";

import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Button, Input, Label } from "@tevero/ui";

interface PlatformCredentialsFormProps {
  platform:
    | "wordpress"
    | "shopify"
    | "wix"
    | "squarespace"
    | "webflow"
    | "custom"
    | "pixel";
  onSubmit: (credentials: Record<string, string>) => void;
  loading: boolean;
}

// Platform-specific field configurations
const PLATFORM_FIELDS: Record<
  string,
  Array<{
    name: string;
    label: string;
    type: "text" | "password";
    placeholder: string;
    helpText?: string;
    helpLink?: string;
  }>
> = {
  wordpress: [
    {
      name: "username",
      label: "Username",
      type: "text",
      placeholder: "admin",
    },
    {
      name: "appPassword",
      label: "Application Password",
      type: "password",
      placeholder: "abcd 1234 efgh 5678",
      helpText: "Generate in Users > Profile > Application Passwords",
      helpLink:
        "https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/",
    },
  ],
  shopify: [
    {
      name: "accessToken",
      label: "Admin API Access Token",
      type: "password",
      placeholder: "shpat_xxxxxxxxxxxxx",
      helpText: "From Settings > Apps > Develop apps > Create app",
      helpLink: "https://shopify.dev/docs/apps/getting-started/create",
    },
  ],
  wix: [
    {
      name: "siteId",
      label: "Site ID",
      type: "text",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
    {
      name: "accessToken",
      label: "API Key",
      type: "password",
      placeholder: "IST.xxxxx",
      helpText: "Create in Wix Dev Center > OAuth Apps",
      helpLink: "https://dev.wix.com/api/rest/getting-started/api-keys",
    },
  ],
  squarespace: [
    {
      name: "siteId",
      label: "Site ID",
      type: "text",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
    {
      name: "apiKey",
      label: "API Key",
      type: "password",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      helpText: "Settings > Developer API Keys",
      helpLink:
        "https://developers.squarespace.com/commerce-apis/authentication-and-permissions",
    },
  ],
  webflow: [
    {
      name: "siteId",
      label: "Site ID",
      type: "text",
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
    },
    {
      name: "accessToken",
      label: "API Token",
      type: "password",
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      helpText: "Site Settings > Integrations > Generate API token",
      helpLink:
        "https://developers.webflow.com/data/docs/getting-started-with-apps",
    },
  ],
};

export function PlatformCredentialsForm({
  platform,
  onSubmit,
  loading,
}: PlatformCredentialsFormProps) {
  const fields = PLATFORM_FIELDS[platform] || [];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, ""]))
  );

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const isValid = fields.every((f) => values[f.name]?.trim());

  if (platform === "custom" || platform === "pixel") {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          Custom sites require pixel installation. This will be available soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h4 className="text-sm font-medium capitalize">{platform} Credentials</h4>

      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            type={field.type}
            placeholder={field.placeholder}
            value={values[field.name]}
            onChange={(e) => handleChange(field.name, e.target.value)}
            disabled={loading}
          />
          {field.helpText && (
            <p className="text-xs text-muted-foreground">
              {field.helpText}
              {field.helpLink && (
                <>
                  {" "}
                  <a
                    href={field.helpLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Learn more <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      ))}

      <Button type="submit" className="w-full" disabled={!isValid || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Connect
      </Button>
    </form>
  );
}
