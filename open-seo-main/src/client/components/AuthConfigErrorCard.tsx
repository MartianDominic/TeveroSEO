import { ShieldAlert } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/client/components/ui/card";

const README_CLOUDFLARE_ACCESS_URL =
  "https://github.com/every-app/open-seo#cloudflare-deployment--access-setup";

type AuthConfigErrorCardProps = {
  message: string;
  onRetry?: () => void;
};

export function AuthConfigErrorCard({
  message,
  onRetry,
}: AuthConfigErrorCardProps) {
  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-destructive" />
          Authentication setup required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="alert alert-error">
          <span>{message}</span>
        </div>

        <p className="text-sm text-foreground/70">
          Check the auth environment variables for your selected
          <code className="mx-1">AUTH_MODE</code>. Cloudflare Access requires
          <code className="mx-1">TEAM_DOMAIN</code> and
          <code className="mx-1">POLICY_AUD</code>. Hosted mode requires
          <code className="mx-1">BETTER_AUTH_SECRET</code> and
          <code className="ml-1">BETTER_AUTH_URL</code>.
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {onRetry ? (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Try Again
          </Button>
        ) : null}
        <Button size="sm" asChild>
          <a
            href={README_CLOUDFLARE_ACCESS_URL}
            target="_blank"
            rel="noreferrer"
          >
            Open Setup Guide
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
