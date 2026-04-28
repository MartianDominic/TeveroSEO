/**
 * WordPress Credential Form Component
 * Phase 31-04: Connection Wizard UI
 *
 * Form for WordPress Application Password authentication.
 * Includes help link to WordPress app password documentation.
 */
import { useState, useCallback } from "react";
import { Input } from "@/client/components/ui/input";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Loader2, ExternalLink, AlertCircle, Eye, EyeOff } from "lucide-react";

interface WordPressCredentialFormProps {
  siteUrl: string;
  onSubmit: (credentials: { username: string; appPassword: string }) => Promise<void>;
  onBack: () => void;
  error?: string | null;
  isSubmitting?: boolean;
}

/**
 * WordPress credential form with username and app password.
 */
export function WordPressCredentialForm({
  siteUrl,
  onSubmit,
  onBack,
  error,
  isSubmitting = false,
}: WordPressCredentialFormProps) {
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  /**
   * Handle form submission.
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError(null);

      // Validate inputs
      if (!username.trim()) {
        setValidationError("Username is required");
        return;
      }

      if (!appPassword.trim()) {
        setValidationError("Application Password is required");
        return;
      }

      // App passwords should have spaces (WordPress format: xxxx xxxx xxxx xxxx xxxx)
      // But we accept both with and without spaces
      const cleanPassword = appPassword.replace(/\s/g, "");
      if (cleanPassword.length < 16) {
        setValidationError(
          "Application Password should be at least 16 characters"
        );
        return;
      }

      await onSubmit({
        username: username.trim(),
        appPassword: appPassword.trim(),
      });
    },
    [username, appPassword, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Site URL Display */}
      <div className="p-3 border rounded-lg bg-muted/30">
        <span className="text-sm text-muted-foreground">Connecting to:</span>
        <p className="font-medium">{siteUrl}</p>
      </div>

      {/* Help Info */}
      <Alert>
        <AlertDescription className="text-sm">
          WordPress requires an{" "}
          <strong>Application Password</strong> for API access.
          This is different from your login password.
          <a
            href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 ml-1 text-primary hover:underline"
          >
            Learn more
            <ExternalLink className="w-3 h-3" />
          </a>
        </AlertDescription>
      </Alert>

      {/* Username Field */}
      <div className="space-y-2">
        <Label htmlFor="username">WordPress Username</Label>
        <Input
          id="username"
          type="text"
          placeholder="admin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <p className="text-xs text-muted-foreground">
          Your WordPress admin username
        </p>
      </div>

      {/* Application Password Field */}
      <div className="space-y-2">
        <Label htmlFor="appPassword">Application Password</Label>
        <div className="relative">
          <Input
            id="appPassword"
            type={showPassword ? "text" : "password"}
            placeholder="xxxx xxxx xxxx xxxx xxxx"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            autoComplete="new-password"
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Go to WordPress Admin &rarr; Users &rarr; Profile &rarr; Application Passwords
        </p>
      </div>

      {/* Error Messages */}
      {(error || validationError) && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error || validationError}</span>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </form>
  );
}

export default WordPressCredentialForm;
