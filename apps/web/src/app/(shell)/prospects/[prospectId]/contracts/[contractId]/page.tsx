import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Separator,
} from "@tevero/ui";
import { ArrowLeft, FileText, Clock } from "lucide-react";
import Link from "next/link";
import { getContractDetail } from "../actions";
import { SignatureStatus } from "../components/SignatureStatus";
import { PaymentStatus } from "../components/PaymentStatus";

export default async function ContractDetailPage({
  params,
}: {
  params: { prospectId: string; contractId: string };
}) {
  const result = await getContractDetail(params.contractId);

  if (!result.success || !result.data) {
    notFound();
  }

  const contract = result.data;

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("lt-LT", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/prospects/${params.prospectId}/contracts`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Atgal
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {contract.title}
          </h1>
          <p className="text-muted-foreground">Sutarties informacija</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Būsena</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Pasirašymas
              </span>
              <SignatureStatus
                status={contract.status}
                signedAt={contract.signedAt}
                signerName={contract.signerName}
              />
            </div>

            {contract.invoice && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Apmokėjimas
                  </span>
                  <PaymentStatus
                    status={contract.invoice.status}
                    totalCents={contract.invoice.totalCents}
                    currency={contract.invoice.currency}
                    paidAt={contract.invoice.paidAt}
                    paymentUrl={contract.invoice.stripePaymentUrl}
                  />
                </div>
              </>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Sukurta</span>
                <p className="font-medium">{formatDate(contract.createdAt)}</p>
              </div>
              {contract.signedAt && (
                <div>
                  <span className="text-muted-foreground">Pasirašyta</span>
                  <p className="font-medium">
                    {formatDate(contract.signedAt)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Istorija</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contract.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nėra įvykių</p>
              ) : (
                contract.activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="mt-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        {activity.activityType === "status_changed"
                          ? `Būsena pasikeitė: ${
                              (activity.activityData as any).fromStatus
                            } → ${(activity.activityData as any).toStatus}`
                          : activity.activityType === "created"
                          ? "Sutartis sukurta"
                          : activity.activityType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contract Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Sutarties turinys
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          {contract.content.sections.map((section, index) => (
            <div key={index} className="mb-6">
              <h3 className="text-base font-semibold">{section.title}</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {section.body}
              </p>
            </div>
          ))}

          {contract.content.terms && (
            <div className="mt-8 pt-4 border-t">
              <h3 className="text-base font-semibold">Sąlygos</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {contract.content.terms}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
