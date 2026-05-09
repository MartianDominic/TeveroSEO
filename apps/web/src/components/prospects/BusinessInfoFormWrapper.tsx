"use client";

/**
 * Client wrapper for BusinessInfoForm with server action handling.
 * Phase 27-03: AI Business Extractor
 */
import { useRouter } from "next/navigation";

import { saveManualBusinessInfo } from "@/app/(shell)/prospects/[prospectId]/actions";

import { BusinessInfoForm, type BusinessInfoFormData } from "./BusinessInfoForm";

interface BusinessInfoFormWrapperProps {
  prospectId: string;
  analysisId: string;
}

export function BusinessInfoFormWrapper({
  prospectId,
  analysisId,
}: BusinessInfoFormWrapperProps) {
  const router = useRouter();

  const handleSubmit = async (data: BusinessInfoFormData) => {
    await saveManualBusinessInfo(prospectId, analysisId, data);
    router.refresh();
  };

  return <BusinessInfoForm prospectId={prospectId} onSubmit={handleSubmit} />;
}
