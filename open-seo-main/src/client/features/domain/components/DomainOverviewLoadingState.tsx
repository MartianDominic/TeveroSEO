import { Card, CardContent } from "@/client/components/ui/card";

export function DomainOverviewLoadingState() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="skeleton h-3 w-36" />
            <div className="skeleton h-8 w-44" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-8 w-40" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="gap-3">
          <div className="flex items-center justify-between">
            <div className="skeleton h-8 w-48" />
            <div className="skeleton h-8 w-60" />
          </div>
          <div className="skeleton h-9 w-64" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="grid grid-cols-7 gap-3">
                <div className="skeleton h-4 col-span-2" />
                <div className="skeleton h-4" />
                <div className="skeleton h-4" />
                <div className="skeleton h-4" />
                <div className="skeleton h-4 col-span-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
