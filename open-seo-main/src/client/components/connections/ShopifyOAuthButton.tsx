/**
 * Shopify OAuth Button Component
 * Phase 31-04: Connection Wizard UI
 *
 * Placeholder for Shopify OAuth flow.
 * OAuth implementation will be added in a future phase.
 */
import { Button } from "@/client/components/ui/button";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { ShoppingBag, ExternalLink, AlertTriangle } from "lucide-react";

interface ShopifyOAuthButtonProps {
  shopDomain: string;
  onOAuthComplete?: (accessToken: string) => void;
  onBack: () => void;
}

/**
 * Shopify OAuth button (placeholder).
 */
export function ShopifyOAuthButton({
  shopDomain,
  onBack,
}: ShopifyOAuthButtonProps) {
  return (
    <div className="space-y-4">
      {/* Site URL Display */}
      <div className="p-3 border rounded-lg bg-muted/30">
        <span className="text-sm text-muted-foreground">Connecting to:</span>
        <p className="font-medium">{shopDomain}</p>
      </div>

      {/* Placeholder Notice */}
      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          Shopify OAuth integration is coming soon. For now, you can manually
          enter your Shopify Admin API access token if you have one.
        </AlertDescription>
      </Alert>

      {/* OAuth Flow Info */}
      <div className="p-4 border rounded-lg space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" />
          Shopify Connection
        </h4>
        <p className="text-sm text-muted-foreground">
          To connect a Shopify store, you will need to:
        </p>
        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
          <li>Install our Shopify app from the App Store</li>
          <li>Authorize access to your store</li>
          <li>Return here to complete the connection</li>
        </ol>
        <a
          href="https://shopify.dev/docs/apps/auth/oauth"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Learn about Shopify OAuth
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Placeholder Button */}
      <Button
        type="button"
        disabled
        className="w-full"
      >
        <ShoppingBag className="w-4 h-4 mr-2" />
        Connect with Shopify (Coming Soon)
      </Button>

      {/* Back Button */}
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        className="w-full"
      >
        Back
      </Button>
    </div>
  );
}

export default ShopifyOAuthButton;
