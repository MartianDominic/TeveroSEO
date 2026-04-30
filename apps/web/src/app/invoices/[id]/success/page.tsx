/**
 * Invoice payment success page.
 * Phase 54-05: Checkout Widget + E2E Testing
 *
 * Shown after successful payment. Thank you message with next steps.
 */
import { CheckCircle } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoiceSuccessPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-12 h-12 text-emerald-600" />
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Payment Successful!
        </h1>
        <p className="text-gray-600 mb-8">
          Thank you for your payment. Your invoice has been marked as paid and
          you will receive a confirmation email shortly.
        </p>

        {/* Invoice Reference */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-8">
          <p className="text-sm text-gray-500 mb-1">Invoice Reference</p>
          <p className="font-mono text-gray-900">{id}</p>
        </div>

        {/* Next Steps */}
        <div className="bg-emerald-50 rounded-lg p-6 mb-8 text-left">
          <h2 className="font-semibold text-emerald-900 mb-3">What happens next?</h2>
          <ul className="space-y-2 text-sm text-emerald-800">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium">
                1
              </span>
              <span>You will receive a payment confirmation email</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium">
                2
              </span>
              <span>Your onboarding checklist is now active</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium">
                3
              </span>
              <span>Our team will reach out within 24 hours</span>
            </li>
          </ul>
        </div>

        {/* Support Link */}
        <p className="text-sm text-gray-500">
          Questions?{" "}
          <Link
            href="mailto:support@teveroseo.com"
            className="text-emerald-600 hover:underline"
          >
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}
