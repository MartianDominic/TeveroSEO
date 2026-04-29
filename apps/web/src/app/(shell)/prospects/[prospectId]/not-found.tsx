import Link from "next/link";
import { Button } from "@tevero/ui";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function ProspectNotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <FileQuestion className="h-12 w-12 text-muted-foreground" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Prospect not found
          </h2>
          <p className="text-muted-foreground mt-2">
            The prospect you are looking for does not exist or has been deleted.
          </p>
        </div>
        <Button asChild variant="outline" className="mt-2">
          <Link href={"/prospects" as Parameters<typeof Link>[0]["href"]}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to prospects
          </Link>
        </Button>
      </div>
    </div>
  );
}
