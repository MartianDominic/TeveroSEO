"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@tevero/ui";
import { Button } from "@tevero/ui";
import { AlertItem } from "./AlertItem";
import { AlertBadge } from "./AlertBadge";
import type { Alert } from "@/actions/alerts";
import { getClientAlerts, updateAlertStatus, getAlertCount } from "@/actions/alerts";

interface AlertDrawerProps {
  clientId: string;
  initialCount?: number;
}

export function AlertDrawer({ clientId, initialCount = 0 }: AlertDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  const hasCritical = alerts.some(
    (a) => a.severity === "critical" && a.status === "pending",
  );

  useEffect(() => {
    if (open) {
      startTransition(async () => {
        const pending = await getClientAlerts(clientId, "pending");
        setAlerts(pending);
      });
    }
  }, [open, clientId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const newCount = await getAlertCount(clientId);
      setCount(newCount);
    }, 60000);
    return () => clearInterval(interval);
  }, [clientId]);

  const handleAcknowledge = async (alertId: string) => {
    await updateAlertStatus(clientId, alertId, "acknowledge");
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    setCount((prev) => Math.max(0, prev - 1));
    router.refresh();
  };

  const handleDismiss = async (alertId: string) => {
    await updateAlertStatus(clientId, alertId, "dismiss");
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    setCount((prev) => Math.max(0, prev - 1));
    router.refresh();
  };

  return (
    <>
      <AlertBadge
        count={count}
        hasCritical={hasCritical}
        onClick={() => setOpen(true)}
      />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Alerts</SheetTitle>
            <SheetDescription>
              {count === 0
                ? "No pending alerts"
                : `${count} pending alert${count !== 1 ? "s" : ""}`}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2 max-h-[calc(100vh-200px)] overflow-y-auto">
            {isPending ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Loading alerts...
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                All caught up! No pending alerts.
              </div>
            ) : (
              alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledge}
                  onDismiss={handleDismiss}
                  compact
                />
              ))
            )}
          </div>
          {alerts.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <Link href={`/clients/${clientId}/alerts` as Parameters<typeof Link>[0]["href"]}>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setOpen(false)}
                >
                  View All Alerts
                </Button>
              </Link>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
