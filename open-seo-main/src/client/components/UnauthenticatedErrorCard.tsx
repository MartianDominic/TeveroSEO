import { useEffect } from "react";
import { getSignInHref, getSignInHrefForLocation } from "@/lib/auth-redirect";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/client/components/ui/card";

type UnauthenticatedErrorCardProps = {
  message: string;
  onRetry?: () => void;
};

export function UnauthenticatedErrorCard({
  message,
  onRetry,
}: UnauthenticatedErrorCardProps) {
  const isHostedMode = isHostedClientAuthMode();
  const signInHref =
    typeof window === "undefined"
      ? getSignInHref("/")
      : getSignInHrefForLocation(window.location);

  useEffect(() => {
    if (typeof window === "undefined" || !isHostedMode) {
      return;
    }

    window.location.replace(signInHref);
  }, [isHostedMode, signInHref]);

  if (isHostedMode) {
    return null;
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle>Authentication required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-foreground/70">{message}</p>
        <p className="text-sm text-foreground/70">
          This deployment uses external authentication. Refresh your access
          session, then try again.
        </p>
      </CardContent>
      {onRetry ? (
        <CardFooter className="justify-end">
          <Button size="sm" onClick={onRetry}>
            Try Again
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
