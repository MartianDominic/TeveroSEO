/**
 * Pre-Signing Configuration Page
 * Phase 59: Agreement & Signing Excellence - Pre-Signing Flow (59-06)
 *
 * Admin configures signers, sets signing order, and sends invitations.
 * Accessible only to authenticated workspace members.
 */
import { notFound } from "next/navigation";

import { PreSigningForm } from "@/components/agreement/PreSigningForm";

import { getPreSigningData } from "./actions";

interface Props {
  params: Promise<{ clientId: string; agreementId: string }>;
}

export default async function PreSignPage({ params }: Props) {
  const { clientId, agreementId } = await params;

  if (!clientId || !agreementId) {
    notFound();
  }

  const data = await getPreSigningData(clientId, agreementId);

  if ("error" in data) {
    return (
      <div className="container py-8">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Unable to Load Agreement
          </h1>
          <p className="text-gray-600">{data.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {data.agreement.title}
        </h1>
        <p className="text-gray-600">
          Configure signers and send for signatures
        </p>
      </div>

      <PreSigningForm initialData={data} />
    </div>
  );
}
