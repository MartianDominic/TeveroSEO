"use client";

import { useState } from "react";
import { Loader2, Search, BarChart3, ShoppingBag, Globe, FileCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from "@tevero/ui";

interface PlatformConnectionFlowProps {
  prospectId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PLATFORMS = [
  {
    id: "google",
    name: "Google",
    icon: <Search className="h-5 w-5" />,
    services: ["Search Console", "Analytics", "Business Profile"],
  },
  {
    id: "shopify",
    name: "Shopify",
    icon: <ShoppingBag className="h-5 w-5" />,
    needsShop: true,
  },
  {
    id: "wix",
    name: "Wix",
    icon: <Globe className="h-5 w-5" />,
  },
  {
    id: "wordpress",
    name: "WordPress",
    icon: <FileCode className="h-5 w-5" />,
    needsCredentials: true,
  },
];

export function PlatformConnectionFlow({
  prospectId,
  onClose,
  onSuccess,
}: PlatformConnectionFlowProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState("");
  const [wpCredentials, setWpCredentials] = useState({
    siteUrl: "",
    username: "",
    appPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleConnect = () => {
    const params = new URLSearchParams({
      services: "searchConsole,analytics",
    });
    if (prospectId) params.set("prospectId", prospectId);
    window.location.href = `/api/oauth/google/authorize?${params}`;
  };

  const handleShopifyConnect = () => {
    if (!shopDomain) return;
    const params = new URLSearchParams({ shop: shopDomain });
    if (prospectId) params.set("prospectId", prospectId);
    window.location.href = `/api/oauth/shopify/authorize?${params}`;
  };

  const handleWixConnect = () => {
    const params = new URLSearchParams();
    if (prospectId) params.set("prospectId", prospectId);
    window.location.href = `/api/oauth/wix/authorize?${params}`;
  };

  const handleWordPressConnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate first
      const validateRes = await fetch("/api/connections/wordpress/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wpCredentials),
      });
      const validation = await validateRes.json();

      if (!validation.valid) {
        setError(validation.error || "Invalid credentials");
        return;
      }

      // Connect
      const connectRes = await fetch("/api/connections/wordpress/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...wpCredentials,
          workspaceId: "default", // Will be set by backend from auth
          prospectId,
        }),
      });

      if (!connectRes.ok) {
        const data = await connectRes.json();
        throw new Error(data.error || "Connection failed");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedPlatform(null);
    setError(null);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-background border rounded-lg shadow-[var(--shadow-modal)] p-6">
        <DialogHeader>
          <DialogTitle>
            {selectedPlatform ? `Connect ${selectedPlatform}` : "Connect Platform"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {!selectedPlatform ? (
          <div className="grid gap-3 mt-4">
            {PLATFORMS.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setSelectedPlatform(p.id)}
              >
                <div className="flex items-center gap-3">
                  {p.icon}
                  <div className="text-left">
                    <div className="font-medium">{p.name}</div>
                    {p.services && (
                      <div className="text-xs text-muted-foreground">
                        {p.services.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        ) : selectedPlatform === "google" ? (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Connect your Google account to access Search Console and Analytics data.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleGoogleConnect}>Connect Google</Button>
            </div>
          </div>
        ) : selectedPlatform === "shopify" ? (
          <div className="space-y-4 mt-4">
            <div>
              <Label>Shop domain</Label>
              <div className="flex gap-2 items-center mt-1">
                <Input
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="your-store"
                />
                <span className="text-muted-foreground">.myshopify.com</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleShopifyConnect} disabled={!shopDomain}>
                Connect Shopify
              </Button>
            </div>
          </div>
        ) : selectedPlatform === "wix" ? (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Connect your Wix account to access site data.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleWixConnect}>Connect Wix</Button>
            </div>
          </div>
        ) : selectedPlatform === "wordpress" ? (
          <div className="space-y-4 mt-4">
            <div>
              <Label>Site URL</Label>
              <Input
                value={wpCredentials.siteUrl}
                onChange={(e) =>
                  setWpCredentials((c) => ({ ...c, siteUrl: e.target.value }))
                }
                placeholder="https://your-site.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Username</Label>
              <Input
                value={wpCredentials.username}
                onChange={(e) =>
                  setWpCredentials((c) => ({ ...c, username: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>Application Password</Label>
              <Input
                type="password"
                value={wpCredentials.appPassword}
                onChange={(e) =>
                  setWpCredentials((c) => ({ ...c, appPassword: e.target.value }))
                }
                placeholder="xxxx xxxx xxxx xxxx"
                className="mt-1"
              />
              <a
                href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline mt-1 inline-block"
              >
                How to create an Application Password
              </a>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                onClick={handleWordPressConnect}
                disabled={
                  isLoading ||
                  !wpCredentials.siteUrl ||
                  !wpCredentials.username ||
                  !wpCredentials.appPassword
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect WordPress"
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
